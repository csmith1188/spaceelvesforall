// Start an express server with websockets
const express = require('express');
// import the express-ws module
const expressWs = require('express-ws')
// import local environment variables
require('dotenv').config();
const pathConfig = require('./modules/config.js');
// Retrieve all command-line arguments starting from the third element
const args = process.argv.slice(2);
// Import the API routes
const api_router = require('./modules/game_api.js');
const WebSocket = require('ws');

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

const app = express();

// set the express view engine to ejs
app.set('view engine', 'ejs');

// set express to use public for static files
app.use(express.static(__dirname + '/public'));

// Use the imported routes
app.use('/api', api_router);

app.use(pathConfig.sessionMiddleware);

// use the express-ws module to add websockets to express
const wss = expressWs(app);

const Games = require('./public/engine/game/game.js');
const Sockets = require('./public/engine/socket_server.js');

game = new Games.Game({wss: wss, broadcast: Sockets.broadcast});
if (DEBUG) {
    game.debug = true;
}
game.loadMatch('ForHonorMP');

const gameStartedAt = Date.now();
const gameId = `game-${PORT}`;
const masterSecret = process.env.MASTER_SERVER_SECRET || '';
const statusIntervalMs = 1000;
let statusWs = null;
let statusInterval = null;
let reconnectTimer = null;
let reconnectDelayMs = 500;
let shuttingDown = false;

/**
 * Game → master WebSocket must hit the process listening for upgrades (loopback), not the public :443/:3440 URL.
 */
function getMasterStatusWsUrl() {
    if (process.env.MASTER_WS_URL) {
        const base = process.env.MASTER_WS_URL.trim().replace(/\/+$/, '');
        return `${base}/master/game-status`;
    }
    const bind = process.env.MASTER_BIND || '127.0.0.1';
    const masterListen = parseInt(process.env.MASTER_LISTEN_PORT || process.env.PORT || '3000', 10);
    return `ws://${bind}:${masterListen}/master/game-status`;
}

function getConnectedUsernames() {
    const usernames = [];
    for (const player of game.players) {
        if (player.connected === true && player.token && player.token.displayName) {
            usernames.push(player.token.displayName);
        }
    }
    return usernames;
}

function getMatchStatusPayload(messageType = 'game.heartbeat') {
    const usernames = getConnectedUsernames();
    const maxPlayers = game.match && game.match.playerLimit ? game.match.playerLimit.max : 0;
    const matchStatus = usernames.length > 0 ? 'in_progress' : 'waiting';
    return {
        type: messageType,
        secret: masterSecret,
        gameId,
        port: PORT,
        status: 'online',
        startedAt: gameStartedAt,
        timeUpMs: Date.now() - gameStartedAt,
        players: {
            current: usernames.length,
            max: maxPlayers,
            usernames
        },
        match: {
            type: game.match && game.match.matchType ? game.match.matchType : 'ForHonorMP',
            status: matchStatus,
            score: { teamA: 0, teamB: 0 }
        },
        timestamp: Date.now()
    };
}

function sendStatusMessage(message) {
    if (!statusWs || statusWs.readyState !== WebSocket.OPEN) return;
    statusWs.send(JSON.stringify(message));
}

function startStatusHeartbeat() {
    if (statusInterval) clearInterval(statusInterval);
    statusInterval = setInterval(() => {
        sendStatusMessage(getMatchStatusPayload('game.heartbeat'));
    }, statusIntervalMs);
}

function connectToMasterStatus() {
    if (shuttingDown) return;
    const statusWsUrl = getMasterStatusWsUrl();
    statusWs = new WebSocket(statusWsUrl);

    statusWs.on('open', () => {
        reconnectDelayMs = 500;
        sendStatusMessage(getMatchStatusPayload('game.register'));
        startStatusHeartbeat();
    });

    statusWs.on('close', () => {
        if (statusInterval) {
            clearInterval(statusInterval);
            statusInterval = null;
        }
        if (shuttingDown) return;
        reconnectTimer = setTimeout(() => {
            connectToMasterStatus();
        }, reconnectDelayMs);
        reconnectDelayMs = Math.min(reconnectDelayMs * 2, 5000);
    });

    statusWs.on('error', () => {
        if (statusWs && statusWs.readyState === WebSocket.OPEN) {
            statusWs.close();
        }
    });
}

function requestShutdown(reason) {
    if (shuttingDown) return;
    shuttingDown = true;
    running = false;
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    if (statusInterval) {
        clearInterval(statusInterval);
        statusInterval = null;
    }

    sendStatusMessage({
        ...getMatchStatusPayload('game.ending'),
        reason,
        status: 'ending'
    });

    if (statusWs && statusWs.readyState === WebSocket.OPEN) {
        statusWs.close();
    }

    setTimeout(() => process.exit(0), 50);
}

connectToMasterStatus();

// Define a route handler for the default home page
app.get('/', (req, res) => {
    const masterUrl = pathConfig.buildThisOrigin();
    if (req.session.token) {
        const gameWsPath = pathConfig.gamePublicPrefix
            ? `/${pathConfig.gamePublicPrefix}/${PORT}/game`
            : null;
        res.render('client', {
            token: req.session.token,
            PORT: PORT,
            THIS_URL: process.env.THIS_URL || 'localhost',
            MASTER_PORT: pathConfig.getPublicBrowserPort(),
            masterUrl,
            gameWsPath: gameWsPath
        });
    } else {
        res.redirect(masterUrl || '/');
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
const emptyServerTimeoutMs = 10000;
let emptySince = Date.now();

function gameLoop() {
    if (!running) return;

    const now = Date.now();
    const delta = now - lastTick;
    const activePlayers = global.game.countConnections();

    if (activePlayers === 0) {
        if (!emptySince) {
            emptySince = now;
        } else if (now - emptySince >= emptyServerTimeoutMs) {
            console.info(`No connected players for ${emptyServerTimeoutMs}ms. Ending game server on port ${PORT}.`);
            requestShutdown('idle_timeout');
            return;
        }
    } else {
        emptySince = null;
    }

    if (delta >= tickInterval) {
        lastTick = now - (delta % tickInterval); // Adjust for drift
        global.game.step(); // Your game logic
    }

    setImmediate(gameLoop); // Keeps the event loop alive
}

gameLoop();

// Graceful shutdown
process.on('SIGINT', () => {
    requestShutdown('shutdown_signal_sigint');
});
process.on('SIGTERM', () => {
    requestShutdown('shutdown_signal_sigterm');
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

