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

// Helper function to build full URL
function buildUrl(hostname, port, path = '', protocol = null) {
    const normalizedHost = normalizeHostname(hostname);
    const urlProtocol = protocol || extractProtocol(hostname);
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    
    // Only omit port for standard ports (80 for HTTP, 443 for HTTPS)
    const isStandardPort = (urlProtocol === 'https' && port === 443) || (urlProtocol === 'http' && port === 80);
    
    if (isStandardPort) {
        return `${urlProtocol}://${normalizedHost}${cleanPath}`;
    } else {
        return `${urlProtocol}://${normalizedHost}:${port}${cleanPath}`;
    }
}

const THIS_HOST = normalizeHostname(process.env.THIS_URL);
const AUTH_HOST = normalizeHostname(process.env.AUTH_URL);
const THIS_PROTOCOL = extractProtocol(process.env.THIS_URL);
const AUTH_PROTOCOL = extractProtocol(process.env.AUTH_URL);
const PORT = process.env.PORT || 3000;

module.exports = {
    // Load the settings from the environment variables
    // To set your own, make a file called ".env",
    // and add lines like this: PORT=3000
    // The port to run this on
    PORT: PORT,
    // The hostname for the Formbar authentication server
    AUTH_URL: AUTH_HOST,
    // The hostname for this server for the oauth callback
    THIS_URL: THIS_HOST,
    // Helper functions for URL construction
    buildThisUrl: (path = '') => buildUrl(process.env.THIS_URL, PORT, path),
    buildAuthUrl: (path = '') => {
        // For auth URL, use the port from the original URL or no port if not specified
        const authUrl = process.env.AUTH_URL;
        if (authUrl && authUrl.includes(':')) {
            // If port is already specified in the URL, use it as-is
            const cleanPath = path.startsWith('/') ? path : `/${path}`;
            return `${authUrl}${cleanPath}`;
        } else {
            // If no port specified, don't add one
            return buildUrl(authUrl, '', path);
        }
    },
    // Protocol information
    THIS_PROTOCOL: THIS_PROTOCOL,
    AUTH_PROTOCOL: AUTH_PROTOCOL,
    // The secret for the session data
    SS_SECRET: process.env.SS_SECRET || 'secret',
    // The host, email and password for the email server
    EMAIL_HOST: process.env.EMAIL_HOST,
    EMAIL_USER: process.env.EMAIL_USER,
    EMAIL_PASS: process.env.EMAIL_PASS,
    // create a session middleware with a secret key using in memory store
    sessionMiddleware: session({
        store: new SQLiteStore(),
        secret: process.env.SS_SECRET || 'secret',
        resave: false,
        saveUninitialized: true,
        cookie: {
            secure: false,
            httpOnly: true,
            sameSite: 'Lax',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        }
    })
};