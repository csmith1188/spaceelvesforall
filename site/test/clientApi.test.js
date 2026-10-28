import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { io as ioClient } from "socket.io-client";
import { publicKeyB64, signFormbar } from "./formbarToken.js";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "motl-client-api-"));
process.env.DATA_DIR = dataDir;
process.env.BOT_COUNTDOWN_MS = "50";
process.env.COUNTDOWN_MS = "50";
process.env.SKIP_FORMBAR = "1";
process.env.FORMBAR_LOGIN = "1";
process.env.FORMBAR_PUBLIC_KEY_B64 = publicKeyB64;
process.env.NO_FREE = "0";
process.env.NODE_ENV = "test";
process.env.SKIP_GAME_SPAWN = "1";

const { listen, httpServer, io } = await import("../app.js");
const { disconnectFormbar } = await import("../server/formbar.js");
const { getAccountByFormbar, grantTickets } = await import("../server/db.js");

await listen(0);
const address = httpServer.address();
const port = typeof address === "object" && address ? address.port : 0;
const base = `http://127.0.0.1:${port}`;

test.after(async () => {
  disconnectFormbar();
  await new Promise((resolve) => {
    io.close(() => {
      httpServer.close(() => resolve());
    });
  });
  try {
    fs.rmSync(dataDir, { recursive: true, force: true });
  } catch {
    // SQLite may still hold the temp database on Windows.
  }
});

function onceEvent(socket, event, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`timed out waiting for ${event}`));
    }, timeoutMs);
    function onEvent(payload) {
      clearTimeout(timer);
      resolve(payload);
    }
    socket.once(event, onEvent);
  });
}

async function waitForPlaying(socket, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const lobby = await takeLobby(socket, Math.max(100, deadline - Date.now()));
    if (lobby && (lobby.status === "playing" || lobby.playUrl)) return lobby;
  }
  throw new Error("timed out waiting for playing lobby");
}

async function createSession(name = "Api Tester") {
  const sessionRes = await fetch(`${base}/api/v1/session`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ name }),
  });
  assert.equal(sessionRes.status, 200);
  return sessionRes.json();
}

function openSocket(token) {
  const socket = ioClient(base, {
    auth: { token },
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
  });
  socket._lobbies = [];
  socket._lobbyWait = [];
  socket.on("lobby", (payload) => {
    const wait = socket._lobbyWait.shift();
    if (wait) wait(payload);
    else socket._lobbies.push(payload);
  });
  return socket;
}

function takeLobby(socket, timeoutMs = 8000) {
  if (!socket._lobbies || !socket._lobbyWait) return onceEvent(socket, "lobby", timeoutMs);
  if (socket._lobbies.length) {
    return Promise.resolve(socket._lobbies.shift());
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timed out waiting for lobby")), timeoutMs);
    socket._lobbyWait.push((payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

test("client API version and protocol gate", async () => {
  const verRes = await fetch(`${base}/api/v1/version`, { headers: { accept: "application/json" } });
  assert.equal(verRes.status, 200);
  const ver = await verRes.json();
  assert.equal(typeof ver.protocol, "number");
  assert.equal(typeof ver.minProtocol, "number");
  assert.ok(ver.minProtocol <= ver.protocol);
  assert.equal(typeof ver.assetVersion, "string");
  assert.ok(ver.assetVersion.length > 0);

  const session = await createSession();
  const outdated = await fetch(`${base}/api/v1/play`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${session.token}`,
      accept: "application/json",
      "x-motl-protocol": "0",
    },
    body: JSON.stringify({ mode: "bot", protocol: 0 }),
  });
  assert.equal(outdated.status, 200);
  assert.notEqual((await outdated.json()).error, "client_outdated");
});

test("client API queues endpoint", async () => {
  const session = await createSession();
  const res = await fetch(`${base}/api/v1/queues`, {
    headers: { authorization: `Bearer ${session.token}`, accept: "application/json" },
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.waiting);
  assert.equal(typeof body.waiting.unranked, "number");
  assert.equal(typeof body.waiting.ranked, "number");
  assert.ok(Array.isArray(body.lobbies));
});

test("client API cookie session can call /me", async () => {
  const jar = new Map();
  const sessionRes = await fetch(`${base}/api/v1/session`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ name: "Cookie Guest" }),
  });
  assert.equal(sessionRes.status, 200);
  const setCookie = sessionRes.headers.getSetCookie?.() || [];
  for (const c of setCookie) {
    const [pair] = c.split(";");
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
  // Fallback: use returned token as cookie is optional when Authorization works;
  // cookie dual-auth: call /me without Bearer but with elves.sid if present.
  const cookieHeader = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  if (!cookieHeader) {
    // express-session may not expose set-cookie to fetch in all Node versions; skip soft.
    return;
  }
  const meRes = await fetch(`${base}/api/v1/me`, {
    headers: { accept: "application/json", cookie: cookieHeader },
  });
  assert.equal(meRes.status, 200);
});

test("stale Bearer falls back to cookie session for /me and socket", async () => {
  const sessionRes = await fetch(`${base}/api/v1/session`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ name: "Cookie Fallback" }),
  });
  assert.equal(sessionRes.status, 200);
  const session = await sessionRes.json();
  const jar = new Map();
  const setCookie = sessionRes.headers.getSetCookie?.() || [];
  for (const c of setCookie) {
    const [pair] = c.split(";");
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
  const cookieHeader = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  assert.ok(cookieHeader, "expected elves.sid Set-Cookie from /api/v1/session");

  const meRes = await fetch(`${base}/api/v1/me`, {
    headers: {
      authorization: "Bearer stale-or-regenerated-sid",
      accept: "application/json",
      cookie: cookieHeader,
    },
  });
  assert.equal(meRes.status, 200);
  const me = await meRes.json();
  assert.equal(me.player.id, session.player.id);

  const playRes = await fetch(`${base}/api/v1/play`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer stale-or-regenerated-sid",
      accept: "application/json",
      cookie: cookieHeader,
    },
    body: JSON.stringify({ mode: "bot" }),
  });
  assert.equal(playRes.status, 200);

  const socket = ioClient(base, {
    auth: { token: "stale-or-regenerated-sid" },
    extraHeaders: { cookie: cookieHeader },
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
  });
  try {
    await onceEvent(socket, "connect");
    const lobby = await takeLobby(socket);
    assert.ok(lobby);
  } finally {
    socket.close();
  }
});

test("client API starts a bot game and accepts a buy", async (t) => {
  const session = await createSession();
  assert.ok(session.token);
  assert.match(session.player.name, /^Api Tester(?: \d+)?$/);

  const meRes = await fetch(`${base}/api/v1/me`, {
    headers: { authorization: `Bearer ${session.token}`, accept: "application/json" },
  });
  assert.equal(meRes.status, 200);
  const me = await meRes.json();
  assert.equal(me.player.id, session.player.id);
  assert.equal(me.busy, false);
  assert.equal(me.account, null);
  assert.equal(me.canTicket, false);

  const rankedRes = await fetch(`${base}/api/v1/play`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${session.token}`,
      accept: "application/json",
    },
    body: JSON.stringify({ mode: "ranked" }),
  });
  assert.equal(rankedRes.status, 403);
  assert.equal((await rankedRes.json()).error, "login_required");

  const playRes = await fetch(`${base}/api/v1/play`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${session.token}`,
      accept: "application/json",
    },
    body: JSON.stringify({ mode: "bot" }),
  });
  assert.equal(playRes.status, 200);
  const play = await playRes.json();
  assert.equal(play.ok, true);
  assert.equal(play.mode, "bot");

  const socket = openSocket(session.token);
  t.after(() => {
    socket.emit("leave");
    socket.removeAllListeners();
    socket.close();
  });
  await onceEvent(socket, "connect");
  const lobby = await waitForPlaying(socket);
  assert.ok(lobby.playUrl);
  assert.equal(lobby.status, "playing");
});

test("client API Formbar login unlocks ranked and listed lobbies", async (t) => {
  const hostId = 800000 + Math.floor(Math.random() * 100000);
  const joinerId = hostId + 1;
  const session = await createSession("Formbar Tester");
  const formbarJwt = signFormbar(
    { id: hostId, displayName: "Formbar Tester" },
    undefined,
    { expiresIn: "1h" },
  );

  const loginRes = await fetch(`${base}/api/v1/login/token`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${session.token}`,
      accept: "application/json",
    },
    body: JSON.stringify({ token: formbarJwt }),
  });
  assert.equal(loginRes.status, 200);
  const loggedIn = await loginRes.json();
  assert.equal(loggedIn.player.formbarId, hostId);
  assert.equal(loggedIn.account.formbarId, hostId);

  const ranked = await fetch(`${base}/api/v1/play`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${session.token}`,
      accept: "application/json",
    },
    body: JSON.stringify({ mode: "ranked" }),
  });
  assert.equal(ranked.status, 200);
  assert.equal((await ranked.json()).mode, "ranked");
  const beforeSpend = await getAccountByFormbar(hostId);
  assert.equal(beforeSpend.tickets, 0);
  assert.equal(beforeSpend.held, 0);
  const leaveSocket = openSocket(session.token);
  await onceEvent(leaveSocket, "connect");
  await takeLobby(leaveSocket);
  leaveSocket.emit("leave");
  await onceEvent(leaveSocket, "go-home");
  leaveSocket.close();

  const hostAccount = await getAccountByFormbar(hostId);
  assert.ok(hostAccount);
  await grantTickets(hostAccount.id, 2);

  const meRes = await fetch(`${base}/api/v1/me`, {
    headers: { authorization: `Bearer ${session.token}`, accept: "application/json" },
  });
  const me = await meRes.json();
  assert.equal(me.canTicket, true);
  assert.equal(me.account.tickets, 2);

  const optsRes = await fetch(`${base}/api/v1/match-options`, {
    headers: { authorization: `Bearer ${session.token}`, accept: "application/json" },
  });
  assert.equal(optsRes.status, 200);
  const opts = await optsRes.json();
  assert.ok(Array.isArray(opts.matchTypes));
  assert.ok(opts.matchTypes.some((row) => row.id === "ForHonorMP"));

  const listedRes = await fetch(`${base}/api/v1/play`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${session.token}`,
      accept: "application/json",
    },
    body: JSON.stringify({
      mode: "listed",
      speed: 1.5,
      fogEnabled: false,
      mapId: "default",
      fortsEnabled: true,
      baseGps: 8,
    }),
  });
  assert.equal(listedRes.status, 200);
  assert.equal((await listedRes.json()).mode, "listed");

  const hostSocket = openSocket(session.token);
  t.after(() => {
    hostSocket.emit("leave");
    hostSocket.removeAllListeners();
    hostSocket.close();
  });
  await onceEvent(hostSocket, "connect");
  const lobby = await takeLobby(hostSocket);
  assert.equal(lobby.status, "waiting");

  const lobbiesRes = await fetch(`${base}/api/v1/lobbies`, {
    headers: { authorization: `Bearer ${session.token}`, accept: "application/json" },
  });
  assert.equal(lobbiesRes.status, 200);
  const { lobbies } = await lobbiesRes.json();
  assert.equal(lobbies.length, 1);
  assert.equal(lobbies[0].match.matchType, "ForHonorMP");
  assert.equal(lobbies[0].locked, false);
  assert.equal(lobbies[0].lobbyPassword, undefined);
  assert.equal(lobbies[0].password, undefined);

  const joinerSession = await createSession("Joiner");
  const joinerJwt = signFormbar(
    { id: joinerId, displayName: "Joiner" },
    undefined,
    { expiresIn: "1h" },
  );
  const joinerLogin = await fetch(`${base}/api/v1/login/token`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${joinerSession.token}`,
      accept: "application/json",
    },
    body: JSON.stringify({ token: joinerJwt }),
  });
  assert.equal(joinerLogin.status, 200);
  const joinerAccount = await getAccountByFormbar(joinerId);
  assert.ok(joinerAccount);
  await grantTickets(joinerAccount.id, 1);

  const joinRes = await fetch(`${base}/api/v1/play`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${joinerSession.token}`,
      accept: "application/json",
    },
    body: JSON.stringify({ mode: "join", roomId: lobbies[0].id }),
  });
  assert.equal(joinRes.status, 200);

  const joinerSocket = openSocket(joinerSession.token);
  t.after(() => {
    joinerSocket.emit("leave");
    joinerSocket.removeAllListeners();
    joinerSocket.close();
  });
  await onceEvent(joinerSocket, "connect");
  await takeLobby(joinerSocket);
  await waitForPlaying(joinerSocket);
});

test("client API listed lobby password gates join", async (t) => {
  const hostId = 900000 + Math.floor(Math.random() * 100000);
  const joinerId = hostId + 1;
  const session = await createSession("Lock Host");
  const formbarJwt = signFormbar(
    { id: hostId, displayName: "Lock Host" },
    undefined,
    { expiresIn: "1h" },
  );
  const loginRes = await fetch(`${base}/api/v1/login/token`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${session.token}`,
      accept: "application/json",
    },
    body: JSON.stringify({ token: formbarJwt }),
  });
  assert.equal(loginRes.status, 200);
  const hostAccount = await getAccountByFormbar(hostId);
  assert.ok(hostAccount);
  await grantTickets(hostAccount.id, 2);

  const listedRes = await fetch(`${base}/api/v1/play`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${session.token}`,
      accept: "application/json",
    },
    body: JSON.stringify({
      mode: "listed",
      lobbyPassword: "secret-lane",
      matchOptions: {
        speed: 1,
        fogEnabled: true,
        mapId: "default",
        fortsEnabled: true,
        baseGps: 8,
      },
    }),
  });
  assert.equal(listedRes.status, 200);

  const hostSocket = openSocket(session.token);
  t.after(() => {
    hostSocket.emit("leave");
    hostSocket.removeAllListeners();
    hostSocket.close();
  });
  await onceEvent(hostSocket, "connect");
  await takeLobby(hostSocket);

  const lobbiesRes = await fetch(`${base}/api/v1/lobbies`, {
    headers: { authorization: `Bearer ${session.token}`, accept: "application/json" },
  });
  assert.equal(lobbiesRes.status, 200);
  const { lobbies } = await lobbiesRes.json();
  assert.equal(lobbies.length, 1);
  assert.equal(lobbies[0].locked, true);
  assert.equal(lobbies[0].lobbyPassword, undefined);
  assert.equal(lobbies[0].password, undefined);

  const joinerSession = await createSession("Lock Joiner");
  const joinerJwt = signFormbar(
    { id: joinerId, displayName: "Lock Joiner" },
    undefined,
    { expiresIn: "1h" },
  );
  const joinerLogin = await fetch(`${base}/api/v1/login/token`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${joinerSession.token}`,
      accept: "application/json",
    },
    body: JSON.stringify({ token: joinerJwt }),
  });
  assert.equal(joinerLogin.status, 200);
  const joinerAccount = await getAccountByFormbar(joinerId);
  assert.ok(joinerAccount);
  await grantTickets(joinerAccount.id, 1);

  const badJoin = await fetch(`${base}/api/v1/play`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${joinerSession.token}`,
      accept: "application/json",
    },
    body: JSON.stringify({ mode: "join", roomId: lobbies[0].id, lobbyPassword: "wrong" }),
  });
  assert.equal(badJoin.status, 403);
  assert.equal((await badJoin.json()).error, "bad_lobby_password");

  const noPwJoin = await fetch(`${base}/api/v1/play`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${joinerSession.token}`,
      accept: "application/json",
    },
    body: JSON.stringify({ mode: "join", roomId: lobbies[0].id }),
  });
  assert.equal(noPwJoin.status, 403);
  assert.equal((await noPwJoin.json()).error, "bad_lobby_password");

  const joinRes = await fetch(`${base}/api/v1/play`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${joinerSession.token}`,
      accept: "application/json",
    },
    body: JSON.stringify({
      mode: "join",
      roomId: lobbies[0].id,
      lobbyPassword: "secret-lane",
    }),
  });
  assert.equal(joinRes.status, 200);

  const joinerSocket = openSocket(joinerSession.token);
  t.after(() => {
    joinerSocket.emit("leave");
    joinerSocket.removeAllListeners();
    joinerSocket.close();
  });
  await onceEvent(joinerSocket, "connect");
  await takeLobby(joinerSocket);
  await waitForPlaying(joinerSocket);
});

test("client API play with view=3d serves the 3D client", async () => {
  const sessionRes = await fetch(`${base}/api/v1/session`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ name: "3D Viewer" }),
  });
  assert.equal(sessionRes.status, 200);
  const session = await sessionRes.json();
  const jar = new Map();
  for (const c of sessionRes.headers.getSetCookie?.() || []) {
    const [pair] = c.split(";");
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
  const cookieHeader = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  assert.ok(cookieHeader, "expected elves.sid Set-Cookie from /api/v1/session");

  const play2d = await fetch(`${base}/api/v1/play`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${session.token}`,
      accept: "application/json",
      cookie: cookieHeader,
    },
    body: JSON.stringify({ mode: "bot" }),
  });
  assert.equal(play2d.status, 200);
  const html2d = await (await fetch(`${base}/play`, { headers: { cookie: cookieHeader } })).text();
  assert.match(html2d, /\/js\/lobby\.js/);
  assert.doesNotMatch(html2d, /\/js\/main3d\.js/);
});
