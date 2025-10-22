// Start an express server with websockets
const express = require('express');
// import express session module
const session = require('express-session');
// import the express-ws module
const expressWs = require('express-ws')
// import local environment variables
require('dotenv').config();
// sqlite3 session store
const SQLiteStore = require('connect-sqlite3')(session);
// Retrieve all command-line arguments starting from the third element
const args = process.argv.slice(2);
// Import the API routes
const api_router = require('./modules/game_api.js');

var PORT = 10000;
var DEBUG = false;

// Example: Log each argument
args.forEach((arg, index) => {
    console.info(`Argument ${index + 1}: ${arg}`);
    if (arg.split(" ")[0] === '-p') {
        PORT = parseInt(arg.split(" ")[1]);
        console.info(`PORT: ${PORT}`);
    }
    if (arg.split(" ")[0] === '-dev') {
        DEBUG = true;
        console.info(`DEBUG: ${DEBUG}`);
    }
});

// The secret for the session data
const SS_SECRET = process.env.SS_SECRET || 'secret';

const app = express();

// set the express view engine to ejs
app.set('view engine', 'ejs');

// set express to use public for static files
app.use(express.static(__dirname + '/public'));

// Use the imported routes
app.use('/api', api_router);

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

game = new Games.Game({wss: wss, broadcast: Sockets.broadcast});
if (DEBUG) {
    game.debug = true;
}
game.loadMatch('ForHonorMP');

// Define a route handler for the default home page
app.get('/', (req, res) => {
    if (req.session.token) {
        const masterHost = process.env.THIS_URL || 'localhost';
        const masterPort = process.env.PORT || 3000;
        
        // Build master URL properly, handling cases where hostname might include protocol
        let masterUrl;
        if (masterHost.startsWith('http://') || masterHost.startsWith('https://')) {
            // If hostname already has protocol, extract just the hostname and rebuild
            const hostname = masterHost.replace(/^https?:\/\//, '').split(':')[0];
            const protocol = masterHost.startsWith('https://') ? 'https' : 'http';
            masterUrl = `${protocol}://${hostname}:${masterPort}`;
        } else {
            // If no protocol, add http
            masterUrl = `http://${masterHost}:${masterPort}`;
        }
        
        res.render('client', { 
            token: req.session.token, 
            PORT: PORT, 
            THIS_URL: masterHost, 
            MASTER_PORT: masterPort,
            masterUrl: masterUrl
        });
    } else {
        const masterHost = process.env.THIS_URL || 'localhost';
        const masterPort = process.env.PORT || 3000;
        
        // Build redirect URL properly
        let redirectUrl;
        if (masterHost.startsWith('http://') || masterHost.startsWith('https://')) {
            const hostname = masterHost.replace(/^https?:\/\//, '').split(':')[0];
            const protocol = masterHost.startsWith('https://') ? 'https' : 'http';
            redirectUrl = `${protocol}://${hostname}:${masterPort}`;
        } else {
            redirectUrl = `http://${masterHost}:${masterPort}`;
        }
        
        res.redirect(redirectUrl);
    }
});

app.ws('/game', Sockets.gameHandler);

// Start the server on port 3000
app.listen(PORT, '0.0.0.0', () => {
    const host = process.env.THIS_URL || 'localhost';
    console.info(`Game server started on http://${host}:${PORT}`);
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

