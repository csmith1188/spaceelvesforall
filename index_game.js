// Start an express server with websockets without socket.io
const express = require('express');
// import express session module
const session = require('express-session');
// import the websockets module
const WebSocket = require('ws');
// import the express-ws module
const expressWs = require('express-ws')
// import local environment variables
require('dotenv').config();
// import webtoken module
const jwt = require('jsonwebtoken');
// sqlite3 session store
const SQLiteStore = require('connect-sqlite3')(session);
// Retrieve all command-line arguments starting from the third element
const args = process.argv.slice(2);

var PORT = 11100;

// Example: Log each argument
args.forEach((arg, index) => {
    console.info(`Argument ${index + 1}: ${arg}`);
    if (arg.split(" ")[0] === '-p') {
        PORT = parseInt(arg.split(" ")[1]);
        console.info(`PORT: ${PORT}`);
    }
});

// The secret for the session data
const SS_SECRET = process.env.SS_SECRET || 'secret';

const app = express();

// set the express view engine to ejs
app.set('view engine', 'ejs');

// set express to use public for static files
app.use(express.static(__dirname + '/public'));

// create a session middleware with a secret key using in memory store
const sessionMiddleware = session({
    store: new SQLiteStore(),
    secret: SS_SECRET,
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
const wss = expressWs(app);

// Define a route handler for the default home page
app.get('/', (req, res) => {
    if (req.session.token) {
        res.render('game', { token: req.session.token });
    } else {
        res.redirect('http://localhost:3000');
    }
});

app.ws('/game', (ws, req) => {
    // send the client their id when they connect
    ws.send(JSON.stringify({ message: 'You are connected to the game server' }));
    console.info(`Game Client connected, ${new Date()}`);

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
    console.info(`Server started on http://localhost:${PORT}`);
});

const { greet } = require('./public/engine/shared.js');
console.log(greet("Node.js"));