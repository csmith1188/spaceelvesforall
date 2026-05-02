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

function getMasterStatusWsUrl() {
    const masterHostRaw = process.env.THIS_URL || 'localhost';
    const masterPort = process.env.PORT || 3000;
    const secure = masterHostRaw.startsWith('https://');
    const host = masterHostRaw.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
    const protocol = secure ? 'wss' : 'ws';
    return `${protocol}://${host}:${masterPort}/master/game-status`;
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
        
        const gameWsPath = pathConfig.gamePublicPrefix
            ? `/${pathConfig.gamePublicPrefix}/${PORT}/game`
            : null;
        res.render('client', { 
            token: req.session.token, 
            PORT: PORT, 
            THIS_URL: masterHost, 
            MASTER_PORT: masterPort,
            masterUrl: masterUrl,
            gameWsPath: gameWsPath
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

