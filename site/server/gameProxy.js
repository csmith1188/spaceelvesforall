/**
 * Forwards /{GAME_PUBLIC_PREFIX}/{port}/ to the game process on 127.0.0.1.
 */
import httpProxy from "http-proxy";

function escapeRegexSegment(seg) {
  return seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function gamePublicPrefix() {
  const raw = process.env.GAME_PUBLIC_PREFIX;
  const value = raw == null ? "gs" : raw;
  return String(value).trim().replace(/^\/+|\/+$/g, "");
}

export function parseGsPath(pathname, prefix, masterPort) {
  if (!prefix) return null;
  const re = new RegExp(`^/${escapeRegexSegment(prefix)}/(\\d+)(/.*)?$`);
  const m = String(pathname || "").match(re);
  if (!m) return null;
  const port = Number(m[1]);
  if (!Number.isFinite(port) || port === Number(masterPort)) return null;
  return { port, path: m[2] || "/" };
}

let upgradeProxy = null;

function proxyServer() {
  if (upgradeProxy) return upgradeProxy;
  upgradeProxy = httpProxy.createProxyServer({
    xfwd: true,
    ws: true,
    changeOrigin: true,
  });
  upgradeProxy.on("error", (_err, _req, socket) => {
    if (socket && !socket.destroyed && typeof socket.destroy === "function") {
      socket.destroy();
    }
  });
  return upgradeProxy;
}

export function tryGsUpgrade(req, socket, head, masterPort) {
  const prefix = gamePublicPrefix();
  if (!prefix) return false;
  const pathname = String(req.url || "").split("?")[0];
  const parsed = parseGsPath(pathname, prefix, masterPort);
  if (!parsed) return false;
  const qs = String(req.url || "").includes("?")
    ? String(req.url).slice(String(req.url).indexOf("?"))
    : "";
  req.url = parsed.path + qs;
  proxyServer().ws(req, socket, head, { target: `http://127.0.0.1:${parsed.port}` });
  return true;
}

export function registerGameProxy(app, { masterPort } = {}) {
  const prefix = gamePublicPrefix();
  if (!prefix) return;
  const webProxy = httpProxy.createProxyServer({
    xfwd: true,
    changeOrigin: true,
  });
  webProxy.on("error", (_err, _req, res) => {
    sendProxyWait(res);
  });

  app.get(new RegExp(`^/${escapeRegexSegment(prefix)}/[0-9]+$`), (req, res) => {
    const q = req.url.indexOf("?") >= 0 ? req.url.slice(req.url.indexOf("?")) : "";
    res.redirect(301, `${req.path}/${q}`);
  });

  app.use((req, res, next) => {
    const pathname = (req.originalUrl || req.url || "").split("?")[0];
    const parsed = parseGsPath(pathname, prefix, masterPort);
    if (!parsed) return next();
    const full = req.originalUrl || req.url || "";
    const qs = full.includes("?") ? full.slice(full.indexOf("?")) : "";
    req.url = parsed.path + qs;
    webProxy.web(req, res, { target: `http://127.0.0.1:${parsed.port}` }, (err) => {
      if (err) sendProxyWait(res);
    });
  });
}

function sendProxyWait(res) {
  if (!res || res.headersSent || typeof res.writeHead !== "function") return;
  res.writeHead(502, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  res.end("<!DOCTYPE html><title>Starting match</title><meta http-equiv=\"refresh\" content=\"1\"><p>The match is still starting. Reloading…</p>");
}
