import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

/** Bind an ephemeral port, release it, and return the number for a child server. */
export function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      server.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

/**
 * Spawn app.js on PORT=0 and parse the bound port from the listen log.
 * Avoids random-port collisions across parallel node:test files.
 * `env` may be an object or `(dataDir) => object` when paths need the temp dir.
 */
export function spawnApp(env = {}, { dataDirPrefix = "motl-http-", dataDir: existingDir } = {}) {
  const dataDir = existingDir || fs.mkdtempSync(path.join(os.tmpdir(), dataDirPrefix));
  const extraEnv = typeof env === "function" ? env(dataDir) : env;
  const child = spawn(process.execPath, ["site/app.js"], {
    cwd: path.resolve("."),
    env: {
      ...process.env,
      PORT: "0",
      DATA_DIR: dataDir,
      SKIP_FORMBAR: "1",
      SKIP_GAME_SPAWN: "1",
      METRICS: "",
      METRICS_LOG: "0",
      NODE_ENV: "test",
      ...extraEnv,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let buf = "";
  let resolvedPort = 0;
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`server did not listen\n${buf}`)), 20000);
    const onData = (chunk) => {
      buf += chunk.toString();
      const match = buf.match(/listening on https?:\/\/[^:\s]+:(\d+)/i);
      if (match) {
        resolvedPort = Number(match[1]);
        clearTimeout(timer);
        resolve();
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`server exited ${code}\n${buf}`));
    });
  });
  return {
    child,
    dataDir,
    ready,
    output: () => buf,
    get base() {
      return `http://127.0.0.1:${resolvedPort}`;
    },
    get port() {
      return resolvedPort;
    },
  };
}

export async function stopApp(server) {
  if (!server || !server.child) return;
  server.child.kill();
  await new Promise((resolve) => server.child.once("exit", resolve));
  if (server.dataDir) {
    fs.rmSync(server.dataDir, { recursive: true, force: true });
  }
}

export function cookieJar() {
  let cookie = "";
  return {
    csrf: "",
    store(res) {
      const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
      for (const line of raw) {
        const part = String(line).split(";")[0];
        if (part.startsWith("elves.sid=") && part !== cookie) {
          cookie = part;
          this.csrf = "";
        }
      }
    },
    header() {
      return cookie ? { cookie } : {};
    },
  };
}

/**
 * Load a form page and capture its CSRF token. Prefer the POST target path
 * when it renders a form (signup/login already session.save before HTML).
 * Falls back across a few token-bearing pages — never the landing `/`.
 */
export async function primeCsrf(base, jar, formPath = "/login") {
  const candidates = [formPath, "/login", "/signup", "/games"].filter(
    (path, i, all) => all.indexOf(path) === i,
  );
  let lastStatus = 0;
  for (const path of candidates) {
    const res = await fetch(`${base}${path}`, { headers: jar.header(), redirect: "manual" });
    jar.store(res);
    lastStatus = res.status;
    if (res.status >= 300 && res.status < 400) continue;
    const html = await res.text();
    const match = html.match(/name="_csrf" value="([^"]+)"/);
    if (match) {
      jar.csrf = match[1];
      return;
    }
  }
  jar.csrf = "";
  throw new Error(`expected CSRF token in HTML (last status ${lastStatus})`);
}

function formPathFor(urlPath) {
  // CSRF is session-wide. Only prime paths that always render a form without
  // extra query state (/reset needs ?token= or it may omit the field).
  const pathOnly = String(urlPath || "/").split("?")[0] || "/";
  if (pathOnly === "/signup") return "/signup";
  return "/login";
}

/**
 * Cookie + CSRF fetch helper for spawned app.js servers.
 * Retries a POST once on 403 after re-priming — parallel npm test can hit
 * SQLite session-store busyTimeout (~5s) and drop the CSRF session.
 */
export async function fetchSession(base, url, jar, init = {}) {
  const method = String(init.method || "GET").toUpperCase();
  const primePath = formPathFor(url);
  const body = init.body;

  async function once() {
    if (method === "POST") await primeCsrf(base, jar, primePath);
    if (body instanceof URLSearchParams && jar.csrf) {
      body.set("_csrf", jar.csrf);
    }
    const res = await fetch(`${base}${url}`, {
      ...init,
      body,
      headers: {
        ...(init.headers || {}),
        ...jar.header(),
      },
      redirect: "manual",
    });
    jar.store(res);
    const type = res.headers.get("content-type") || "";
    if (type.includes("text/html")) {
      const html = await res.clone().text();
      const match = html.match(/name="_csrf" value="([^"]+)"/);
      if (match) jar.csrf = match[1];
    }
    return res;
  }

  let res = await once();
  if (method === "POST" && res.status === 403) {
    await res.arrayBuffer().catch(() => {});
    res = await once();
  }
  return res;
}
