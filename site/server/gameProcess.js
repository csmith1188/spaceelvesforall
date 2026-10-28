/**
 * Spawn index_game.js for a match and keep its status socket.
 * Ticket charge and MMR are not applied here.
 */
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { child as childLogger } from "./logger.js";
import { tryGsUpgrade, registerGameProxy } from "./gameProxy.js";

const log = childLogger({ component: "gameProcess" });
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

let nextPort = 10000;
const children = new Map();
const statusSockets = new Map();
let onEnded = () => {};

export function setGameEndedHandler(fn) {
  onEnded = typeof fn === "function" ? fn : () => {};
}

function statusSecret() {
  return String(process.env.MASTER_SERVER_SECRET || "");
}

function authorized(msg) {
  const secret = statusSecret();
  if (!secret) return true;
  return msg && msg.secret === secret;
}

export function buildPublicGameUrl(gamePort, thisUrl) {
  const raw = process.env.GAME_PUBLIC_PREFIX;
  const prefix = String(raw == null ? "gs" : raw).trim().replace(/^\/+|\/+$/g, "");
  let origin = String(thisUrl || "http://localhost:3000").replace(/\/+$/, "");
  try {
    origin = new URL(origin).origin;
  } catch {
    origin = origin.replace(/\/+$/, "");
  }
  if (prefix) return `${origin}/${prefix}/${gamePort}/`;
  try {
    const url = new URL(origin);
    url.port = String(gamePort);
    return `${url.origin}/`;
  } catch {
    return `http://127.0.0.1:${gamePort}/`;
  }
}

function portFree(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", () => resolve(false));
    probe.listen(port, "127.0.0.1", () => {
      probe.close(() => resolve(true));
    });
  });
}

async function allocatePort() {
  for (let i = 0; i < 200; i += 1) {
    const port = nextPort;
    nextPort += 1;
    if (nextPort > 20000) nextPort = 10000;
    if (await portFree(port)) return port;
  }
  throw new Error("no free game port");
}

export function noteGameStatus(msg) {
  if (!msg || !authorized(msg)) return;
  const matchId = msg.matchId != null ? String(msg.matchId) : "";
  if (!matchId) return;
  if (msg.type === "game.ending") {
    statusSockets.delete(matchId);
    try {
      onEnded(matchId, msg);
    } catch (err) {
      log.warn({ event: "game_ended_handler_failed", err: String(err && err.message || err) }, "game ended handler failed");
    }
  }
}

export function sendMatchControl(matchId, message) {
  const ws = statusSockets.get(String(matchId));
  if (!ws || ws.readyState !== 1) return false;
  try {
    ws.send(JSON.stringify(message));
    return true;
  } catch {
    return false;
  }
}

export function stopMatch(matchId) {
  sendMatchControl(matchId, { type: "match.shutdown" });
  const child = children.get(String(matchId));
  if (child && !child.killed) {
    child.kill();
  }
  children.delete(String(matchId));
}

export async function spawnMatch({
  matchId,
  matchType,
  seatIds,
  thisUrl,
  masterPort,
}) {
  const id = String(matchId);
  const type = matchType === "ForEver" ? "ForEver" : "ForHonorMP";
  const ids = (seatIds || []).map((s) => String(s)).filter(Boolean);
  if (process.env.SKIP_GAME_SPAWN === "1") {
    const port = await allocatePort();
    return {
      port,
      url: buildPublicGameUrl(port, thisUrl),
      skipped: true,
    };
  }
  const port = await allocatePort();
  const master = Number(masterPort) || Number(process.env.PORT) || 3000;
  const child = spawn(process.execPath, [
    path.join(repoRoot, "index_game.js"),
    `-p ${port}`,
    `-m ${type}`,
  ], {
    cwd: repoRoot,
    env: {
      ...process.env,
      MATCH_ID: id,
      MATCH_TYPE: type,
      SEAT_IDS: ids.join(","),
      MASTER_WS_URL: `ws://127.0.0.1:${master}`,
      MASTER_BIND: "127.0.0.1",
      MASTER_LISTEN_PORT: String(master),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.set(id, child);
  let logBuf = "";
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("game process did not become ready"));
    }, 20000);
    child.stdout.on("data", (buf) => {
      const text = buf.toString();
      logBuf = (logBuf + text).slice(-500);
      if (text.includes(`READY port=${port}`) || logBuf.includes(`READY port=${port}`)) {
        clearTimeout(timer);
        resolve();
      }
      const line = text.trim();
      if (line) log.info({ event: "game_process_log", matchId: id, line: line.slice(0, 400) }, "game process");
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`game process exited ${code} before ready`));
    });
  });
  child.stderr.on("data", (buf) => {
    const line = buf.toString().trim();
    if (line) log.warn({ event: "game_process_err", matchId: id, line: line.slice(0, 400) }, "game process error");
  });
  child.once("exit", (code) => {
    if (children.get(id) === child) children.delete(id);
    log.info({ event: "game_process_exit", matchId: id, code }, "game process exited");
  });
  try {
    await ready;
  } catch (err) {
    if (children.get(id) === child) {
      child.kill();
      children.delete(id);
    }
    throw err;
  }
  return {
    port,
    url: buildPublicGameUrl(port, thisUrl),
    skipped: false,
  };
}

export function attachGameBridge(httpServer, app, { masterPort } = {}) {
  registerGameProxy(app, { masterPort });
  const wss = new WebSocketServer({ noServer: true });
  wss.on("connection", (ws) => {
    let matchId = "";
    ws.on("message", (buf) => {
      let msg;
      try {
        msg = JSON.parse(buf.toString());
      } catch {
        return;
      }
      if (!authorized(msg)) {
        ws.close();
        return;
      }
      if (msg.matchId) {
        matchId = String(msg.matchId);
        statusSockets.set(matchId, ws);
      }
      noteGameStatus(msg);
    });
    ws.on("close", () => {
      if (matchId && statusSockets.get(matchId) === ws) statusSockets.delete(matchId);
    });
  });

  httpServer.on("upgrade", (req, socket, head) => {
    const url = String(req.url || "");
    const pathOnly = url.split("?")[0];
    if (pathOnly === "/master/game-status") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
      return;
    }
    if (tryGsUpgrade(req, socket, head, masterPort)) return;
  });
}

export function shutdownGameProcesses() {
  for (const id of [...children.keys()]) stopMatch(id);
}
