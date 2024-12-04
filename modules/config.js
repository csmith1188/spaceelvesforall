const dotenv = require('dotenv');
dotenv.config();
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);

module.exports = {
    // Load the settings from the environment variables
    // To set your own, make a file called ".env",
    // and add lines like this: PORT=3000
    // The port to run this on
    PORT: process.env.PORT || 3000,
    // The URL for the Formbar authentication server
    AUTH_URL: process.env.AUTH_URL || 'http://192.168.1.103:420/oauth',
    // The URL for this server for the oauth callback
    THIS_URL: process.env.THIS_URL || 'http://192.168.1.103:3000',
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