// Start an express server with websockets
require('./modules/polyfillSlowBuffer.js');
const http = require('http');
const express = require('express');
const expressWs = require('express-ws');
// load the configuration file
const config = require('./modules/config.js');
const { registerMasterGsProxy, createGsUpgradeHandler } = require('./modules/masterGsProxy.js');
// load modules/authorization.js
const auth = require('./modules/authorization.js');
// load modules/gameServer.js
const game = require('./modules/gameServer.js');
const { createGameStatusHub } = require('./modules/gameStatusHub.js');

// Create a new express application
const app = express();
const server = http.createServer(app);
const wss = expressWs(app, server);

// use the session middleware in express
app.use(config.sessionMiddleware);

// WebSocket
require('./modules/chat.js')(app, wss);
const gameStatusHub = createGameStatusHub({ app, wss });

// set the express view engine to ejs
app.set('view engine', 'ejs');

// set express to use public for static files
app.use(express.static(__dirname + '/public'));

// read the body of the request
app.use(express.urlencoded({ extended: true }));

function isAuthenticated(req, res, next) {
    if (req.session.user || (req.session.token && req.session.token.displayName)) next();
    else res.redirect('/login');
}

/** Formbar OAuth accounts are treated as verified once logged in. */
function isVerified(req, res, next) {
    if (req.session.token && req.session.token.verified) next();
    else if (req.session.user) next();
    else res.render('error', { error: 'You must log in with Formbar first.' });
}

// Define a route handler for the default home page
app.get('/', (req, res) => {
    let gamesList = [];
    if (req.session.user || req.session.token) {
        gamesList = gameStatusHub.getPublicGames();
    }
    res.render('index', {
        this_url: config.buildThisUrl('/login'),
        gamesList,
        token: req.session.token || null,
        user: req.session.user || null
    });
});

// Handle account management endpoints
app.get('/login', auth.loginGET);
app.get('/logout', auth.logoutGET);

// game page
app.get('/newgame', isAuthenticated, isVerified, game.spawnGameServer);

registerMasterGsProxy(app, server, config);

const tryGsUpgrade = createGsUpgradeHandler(config);
const wsSrv = wss.getWss();
server.removeAllListeners('upgrade');
server.on('upgrade', (req, socket, head) => {
    if (tryGsUpgrade(req, socket, head)) return;
    wsSrv.handleUpgrade(req, socket, head, (ws) => {
        wsSrv.emit('connection', ws, req);
    });
});

server.listen(config.PORT, '0.0.0.0', () => {
    console.info(`Server started on ${config.buildThisUrl()}`);
    if (config.API_KEY) {
        require('./modules/formbarClient.js')(config);
    }
});