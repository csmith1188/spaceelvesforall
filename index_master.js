const path = require('path');
// Start an express server with websockets without socket.io
const express = require('express');
// import express session module
const session = require('express-session');
// import the websockets module
const WebSocket = require('ws');
// import the express-ws module
const expressWs = require('express-ws')
// import sqlite3 database module
const sqlite3 = require('sqlite3').verbose();
// import local environment variables
require('dotenv').config();
// import webtoken module
const jwt = require('jsonwebtoken');
// import child process handler
const { spawn } = require('child_process');
// sqlite3 session store
const SQLiteStore = require('connect-sqlite3')(session);

// Load the settings from the environment variables
// To set your own, make a file called ".env",
// and add lines like this: PORT=3000
// The port to run this on
const PORT = process.env.PORT || 3000;
// The URL for the Formbar authentication server
const AUTH_URL = process.env.AUTH_URL || 'http://localhost:420/oauth';
// The URL for this server for the oauth callback
const THIS_URL = process.env.THIS_URL || 'http://localhost:3000/login';
// The secret for the session data
const FB_SECRET = process.env.FB_SECRET || 'secret';

const app = express();

// set the express view engine to ejs
app.set('view engine', 'ejs');

// set express to use public for static files
app.use(express.static(__dirname + '/public'));

// create a session middleware with a secret key using in memory store
const sessionMiddleware = session({
    store: new SQLiteStore(),
    secret: FB_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false,
        httpOnly: true,
        sameSite: 'Lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
});

// use the session middleware in express
app.use(sessionMiddleware);

// use the express-ws module to add websockets to express
expressWs(app);

// This function is used to intercept page loads to check if the user is authenticated
function isAuthenticated(req, res, next) {
    if (req.session.token) next()
    else res.redirect('/login')
};

// Define a route handler for the default home page
app.get('/', (req, res) => {
    // make a list of game server ports
    let gamesList = [];
    if (req.session.token) {
        gameServers.forEach((server) => {
            gamesList.push(server.PORT);
        });
    }
    res.render('index', { this_url: THIS_URL, gamesList: gamesList, token: req.session.token });
});

// game page
app.get('/newgame', (req, res) => {

    // Start another Node.js script with the port argument
    const child = spawn('node', [__dirname + '/game/index_game.js', '-p ' + gameServerCount]); // add { detached: true } to run in the background
    child.PORT = gameServerCount;

    // Listen for standard output (stdout) data from the child process
    child.stdout.on('data', (data) => {
        console.log(`Server Info ${child.PORT}: ${data}`);
    });

    // Listen for standard error (stderr) data from the child process
    child.stderr.on('data', (data) => {
        console.error(`Server Error ${child.PORT}: ${data}`);
    });

    // Listen for the child process to close (when it finishes or exits)
    child.on('close', (code) => {
        console.log(`Server ${child.PORT} exited with code ${code}`);
    });

    // Optional: Listen for exit events in case the process is terminated unexpectedly
    child.on('exit', (code, signal) => {
        if (signal) {
            console.log(`Server ${child.PORT} was killed with signal: ${signal}`);
        } else {
            console.log(`Server ${child.PORT} exited with code: ${code}`);
        }
    });

    res.redirect(`http://localhost:${child.PORT}/`);

    gameServers.push(child);
    gameServerCount++;
});

// login page
app.get('/login', (req, res) => {
    // if there is a session user
    if (req.query.token) {
        // decode the token and set the session token and user
        let tokenData = jwt.decode(req.query.token);
        req.session.token = tokenData;
        // redirect to the home page
        res.redirect('/');
    } else {
        // send them to the Formbar login page
        res.redirect(`${AUTH_URL}?redirectURL=${THIS_URL}`);
    };
});

// Define a route handler for logging out
app.get('/logout', (req, res) => {
    // Destroy the session
    req.session.destroy((err) => {
        if (err) {
            console.error('Session destruction error:', err);
            return res.status(500).send('Could not log out.');
        }
        // Optionally, clear the session cookie
        res.clearCookie('connect.sid'); // Adjust the cookie name if different
        // Redirect the user to the home page or login page
        res.redirect('/');
    });
});

app.ws('/chat', (ws, req) => {
    // send the client their id when they connect
    // ws.send(JSON.stringify({ id: ws.id }));
    console.log(`Client connected, ${new Date()}`);

    ws.on('message', (message) => {
        message = JSON.parse(message);
        if (message.press) {

        }

        if (message.release) {

        }

        if (message.resize) {

        }
    });

    // listen for disconnects
    ws.on('close', () => {

    });
});

// Start the server on port 3000
app.listen(PORT, () => {
    console.log(`Server started on http://localhost:${PORT}`);
});

// open the database file
// let db = new sqlite3.Database('data/database.db', (err) => {
//     if (err) {
//         console.error(err.message);
//     } else {
//         console.log('Connected to the database.');
//     }
// });

var gameServerCount = 11100;
var gameServers = [];