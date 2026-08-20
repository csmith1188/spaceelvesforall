/**
 * When GAME_PUBLIC_PREFIX is set, forwards /{prefix}/{port}/… to 127.0.0.1:{port}
 * (same idea as the nginx snippet). Skips when port equals the master listen port.
 *
 * WebSocket upgrades for /gs/… must be dispatched from index_master together with
 * express-ws so only one handler touches each socket (see index_master.js).
 */
const httpProxy = require('http-proxy');

function escapeRegexSegment(seg) {
    return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseGsPath(pathname, prefix, masterPort) {
    const re = new RegExp(`^/${escapeRegexSegment(prefix)}/(\\d+)(/.*)?$`);
    const m = pathname.match(re);
    if (!m) return null;
    const port = Number(m[1]);
    if (!Number.isFinite(port) || port === masterPort) return null;
    const rest = m[2] || '/';
    return { port, path: rest };
}

/**
 * Returns (req, socket, head) => boolean — true if the upgrade was proxied to a game server.
 * Use from a single server.on('upgrade') alongside ws.Server.handleUpgrade for chat/master.
 */
function createGsUpgradeHandler(config) {
    const raw = (config.gamePublicPrefix || '').trim();
    const prefix = raw.replace(/^\/+|\/+$/g, '');
    if (!prefix) {
        return () => false;
    }

    const masterPort = Number(config.PORT);
    const proxy = httpProxy.createProxyServer({
        xfwd: true,
        ws: true,
        changeOrigin: true
    });

    proxy.on('error', (err, req, socket) => {
        if (socket && !socket.destroyed) {
            socket.destroy();
        }
    });

    return function tryGsUpgrade(req, socket, head) {
        const pathname = req.url.split('?')[0];
        const parsed = parseGsPath(pathname, prefix, masterPort);
        if (!parsed) return false;

        const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
        req.url = parsed.path + qs;

        proxy.ws(req, socket, head, {
            target: `http://127.0.0.1:${parsed.port}`
        });
        return true;
    };
}

function registerMasterGsProxy(app, server, config) {
    const raw = (config.gamePublicPrefix || '').trim();
    const prefix = raw.replace(/^\/+|\/+$/g, '');
    if (!prefix || !server) return;

    const masterPort = Number(config.PORT);
    const proxy = httpProxy.createProxyServer({
        xfwd: true,
        ws: true,
        changeOrigin: true
    });

    proxy.on('error', (err, req, res) => {
        if (res && !res.headersSent && typeof res.writeHead === 'function') {
            res.writeHead(502, { 'Content-Type': 'text/plain' });
            res.end(`Game proxy error: ${err.code || err.message}`);
        } else if (res && res.socket && !res.socket.destroyed) {
            res.socket.destroy();
        }
    });

    app.get(
        new RegExp(`^/${escapeRegexSegment(prefix)}/[0-9]+$`),
        (req, res) => {
            const q = req.url.indexOf('?') >= 0 ? req.url.slice(req.url.indexOf('?')) : '';
            res.redirect(301, `${req.path}/${q}`);
        }
    );

    app.use((req, res, next) => {
        const pathname = (req.originalUrl || req.url || '').split('?')[0];
        const parsed = parseGsPath(pathname, prefix, masterPort);
        if (!parsed) return next();

        const qs = (req.originalUrl || req.url || '').includes('?')
            ? (req.originalUrl || req.url).slice((req.originalUrl || req.url).indexOf('?'))
            : '';
        req.url = parsed.path + qs;

        proxy.web(req, res, { target: `http://127.0.0.1:${parsed.port}` }, (err) => {
            if (err) next(err);
        });
    });
}

module.exports = { registerMasterGsProxy, createGsUpgradeHandler };
