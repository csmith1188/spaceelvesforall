// Start an express server with websockets
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

var PORT = 10000;

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

const Games = require('./public/engine/game/game.js');
const Sockets = require('./public/engine/socket_server.js');

global.game = new Games.Game({wss: wss, broadcast: Sockets.broadcast});

// Define a route handler for the default home page
app.get('/', (req, res) => {
    if (req.session.token) {
        res.render('client', { token: req.session.token, PORT: PORT });
    } else {
        res.redirect('http://192.168.1.103:3000');
    }
});

app.ws('/game', Sockets.gameHandler);

// Start the server on port 3000
app.listen(PORT, () => {
    console.info(`Server started on http://192.168.1.103:${PORT}`);
});

const tickInterval = global.game.time.tickRate; // ~16ms for 60Hz
let lastTick = Date.now();
let running = true;

function gameLoop() {
    if (!running) return;

    const now = Date.now();
    const delta = now - lastTick;

    if (delta >= tickInterval) {
        lastTick = now - (delta % tickInterval); // Adjust for drift
        global.game.step(); // Your game logic
    }

    setImmediate(gameLoop); // Keeps the event loop alive
}

gameLoop();

// Graceful shutdown
process.on('SIGINT', () => {
    running = false;
    process.exit(); 
});
process.on('SIGTERM', () => {
    running = false;
    process.exit();
});

// const gameLoop = setInterval(() => {
//     global.game.step();
// }, global.game.time.tickRate);

// // Graceful shutdown
// process.on('SIGINT', () => {
//     clearInterval(gameLoop);
//     process.exit();
// });
// process.on('SIGTERM', () => {
//     clearInterval(gameLoop);
//     process.exit();
// });

