const dotenv = require('dotenv');
dotenv.config();
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);

// Helper function to extract protocol from hostname
function extractProtocol(hostname) {
    if (!hostname) return 'http';
    if (hostname.startsWith('https://')) return 'https';
    if (hostname.startsWith('http://')) return 'http';
    return 'http'; // default to http
}

// Helper function to normalize hostname (remove protocol if present)
function normalizeHostname(hostname) {
    if (!hostname) return 'localhost';
    return hostname.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
}

// Helper function to check if hostname is an IP address
function isIPAddress(hostname) {
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    return ipRegex.test(hostname);
}

// Helper function to build full URL (generic)
function buildUrl(hostname, port, path = '', protocol = null) {
    const normalizedHost = normalizeHostname(hostname);
    const urlProtocol = protocol || extractProtocol(hostname);
    const cleanPath =
        path === '' || path == null
            ? ''
            : path.startsWith('/')
              ? path
              : `/${path}`;

    const isStandardPort =
        (urlProtocol === 'https' && port === 443) || (urlProtocol === 'http' && port === 80);

    if (isStandardPort) {
        return `${urlProtocol}://${normalizedHost}${cleanPath}`;
    }
    return `${urlProtocol}://${normalizedHost}:${port}${cleanPath}`;
}

/**
 * Parse THIS_URL for browser-facing links. Host may include :port (e.g. https://app.com:3440).
 * Does NOT use Node's listen PORT — that is only for binding the server.
 */
function parseThisUrlOrigin() {
    const raw = (process.env.THIS_URL || 'http://localhost:3000').trim();
    const protocol = extractProtocol(raw);
    const withoutProto = raw.replace(/^https?:\/\//i, '');
    const hostAndMaybePort = withoutProto.split('/')[0];
    let host;
    let explicitPort = null;
    if (hostAndMaybePort.includes(':')) {
        const idx = hostAndMaybePort.lastIndexOf(':');
        host = hostAndMaybePort.slice(0, idx);
        explicitPort = parseInt(hostAndMaybePort.slice(idx + 1), 10);
        if (Number.isNaN(explicitPort)) explicitPort = null;
    } else {
        host = hostAndMaybePort;
    }

    if (process.env.PUBLIC_PORT !== undefined && String(process.env.PUBLIC_PORT).trim() !== '') {
        const p = parseInt(process.env.PUBLIC_PORT, 10);
        if (!Number.isNaN(p)) explicitPort = p;
    }

    let port = explicitPort;
    if (port === null || Number.isNaN(port)) {
        const isLocal = host === 'localhost' || host === '127.0.0.1';
        if (isLocal) {
            port = Number(process.env.PORT || 3000);
        } else {
            port = protocol === 'https' ? 443 : 80;
        }
    }

    return { host, port, protocol };
}

function buildThisUrl(path = '') {
    const base = (process.env.PUBLIC_URL || '').trim().replace(/\/+$/, '');
    if (base) {
        const cleanPath =
            path === '' || path == null
                ? ''
                : path.startsWith('/')
                  ? path
                  : `/${path}`;
        return `${base}${cleanPath}`;
    }
    const { host, port, protocol } = parseThisUrlOrigin();
    return buildUrl(host, port, path, protocol);
}

/** Origin only (no path), for redirects and links — never uses Node bind port on public hosts. */
function buildThisOrigin() {
    return buildThisUrl('').replace(/\/+$/, '');
}

const THIS_HOST = normalizeHostname(process.env.THIS_URL);
const THIS_PROTOCOL = extractProtocol(process.env.THIS_URL);
const PORT = process.env.PORT || 3000;

/** Formbar / auth server base URL, without trailing /oauth (supports env with or without /oauth). */
function formbarHttpBase() {
    let u = (process.env.AUTH_URL || 'http://localhost:420').trim();
    u = u.replace(/\/+$/, '');
    if (u.endsWith('/oauth')) {
        u = u.slice(0, -'/oauth'.length);
    }
    return u;
}

const AUTH_BASE = formbarHttpBase();
const AUTH_HOST = normalizeHostname(AUTH_BASE);
const AUTH_PROTOCOL = extractProtocol(AUTH_BASE);

const SESSION_SECRET = process.env.SESSION_SECRET || process.env.SS_SECRET || 'secret';
const API_KEY = (process.env.API_KEY || '').trim();

/** Path segment for path-based game URLs (e.g. gs → https://host/gs/<port>/). Empty = use :port in browser. */
const gamePublicPrefix = (process.env.GAME_PUBLIC_PREFIX || '').trim().replace(/^\/+|\/+$/g, '');

/**
 * Public HTTP URL for a spawned game process (lobby links and redirects).
 */
function buildPublicGameUrl(gameListenPort) {
    const { host, port, protocol } = parseThisUrlOrigin();
    if (gamePublicPrefix) {
        const origin = buildUrl(host, port, '', protocol).replace(/\/+$/, '');
        return `${origin}/${gamePublicPrefix}/${gameListenPort}/`;
    }
    return buildUrl(host, gameListenPort, '/', protocol);
}

module.exports = {
    // Load the settings from the environment variables
    // To set your own, make a file called ".env",
    // and add lines like this: PORT=3000
    // The port to run this on
    PORT: PORT,
    gamePublicPrefix,
    buildPublicGameUrl,
    /** Normalized Formbar server hostname (no path). */
    AUTH_URL: AUTH_HOST,
    /** Full base URL for Formbar HTTP/Socket (no /oauth suffix). */
    AUTH_BASE,
    // The hostname for this server for the oauth callback
    THIS_URL: THIS_HOST,
    /** Browser-visible URLs (OAuth redirects, links). Uses THIS_URL / PUBLIC_URL — never the Node bind port except on localhost. */
    buildThisUrl,
    buildThisOrigin,
    /** Port shown in public URLs (443/80 implicit in links when omitted). For dev localhost, Node PORT. */
    getPublicBrowserPort: () => parseThisUrlOrigin().port,
    /**
     * Redirect user to Formbar OAuth; after login Formbar sends them back to redirectUrl with ?token=…
     */
    buildFormbarOAuthRedirect: (redirectUrl) =>
        `${AUTH_BASE}/oauth?redirectURL=${encodeURIComponent(redirectUrl)}`,
    SESSION_SECRET,
    /** Optional Formbar websocket API key (socket.io-client). */
    API_KEY,
    // Protocol information
    THIS_PROTOCOL: THIS_PROTOCOL,
    AUTH_PROTOCOL: AUTH_PROTOCOL,
    // Legacy alias — prefer SESSION_SECRET in .env
    SS_SECRET: SESSION_SECRET,
    // The host, email and password for the email server
    EMAIL_HOST: process.env.EMAIL_HOST,
    EMAIL_USER: process.env.EMAIL_USER,
    EMAIL_PASS: process.env.EMAIL_PASS,
    // create a session middleware with a secret key using in memory store
    sessionMiddleware: session({
        store: new SQLiteStore({ db: 'sessions.db', dir: './data' }),
        secret: SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true,
            sameSite: 'Lax',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        }
    })
};