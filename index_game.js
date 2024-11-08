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
const Players = require('./public/engine/game/player/player.js');
const game = require('./public/engine/game/game.js');
const Matches = require('./public/engine/game/match/match.js');

global.game = new Games.Game();

// Define a route handler for the default home page
app.get('/', (req, res) => {
    if (req.session.token) {
        res.render('game', { token: req.session.token, PORT: PORT });
    } else {
        res.redirect('http://localhost:3000');
    }
});

function broadcast(data) {
    for (const player of global.game.players) {
        player.ws.send(JSON.stringify(data));
    }
}

app.ws('/game', (ws, req) => {
    // send the client their id when they connect
    ws.send(JSON.stringify({ debug: 'You are connected to the game server' }));
    console.info(`Game Client connected, ${new Date()}`);

    // if the client does not have a token, close the connection
    if (!req.session.token) {
        console.error('No token found');
        ws.send(JSON.stringify({ debug: 'You are not authorized.' }));
        ws.close();
        return;
    }

    // if the game is full, close the connection
    if (!(global.game.maxPlayers > global.game.players.length)) {
        console.error('Game server is full');
        ws.send(JSON.stringify({ debug: 'Game server is full' }));
        ws.close();
        return;
    }

    // set the token for the websocket
    ws.token = req.session.token;

    // if there are no players when this user connects, load a new match
    if (global.game.players.length == 0) global.game.loadMatch(new Matches.Match());

    // create a new player
    global.game.players.push(new Players.Player({ token: ws.token, ws: ws }));
    
    // listen for messages
    ws.on('message', (message) => {
        // If the message is not formatted as JSON, this will fail.
        try {
            // parse the message
            message = JSON.parse(message);
            // find the player
            
            let player = global.game.players.find(player => player.token === ws.token);
            // if the player is not found, close the connection
            if (!player) {
                ws.send(JSON.stringify({ debug: 'Could not find you in this game.' }));
                ws.close();
                return;
            }

            if (message.press) {
                player.buttons[message.press] = true;
            }

            if (message.release) {
                player.buttons[message.release] = false;
            }

        } catch (error) {
            console.error(error);
        }
    });

    // listen for disconnects
    ws.on('close', () => {
        // remove the player from the game
        global.game.players = global.game.players.filter(player => player.token !== ws.token);
        // broadcast the new player list
        broadcast({ debug: 'Players Changed', players: global.game.players });
    });
    
    let playersList = [];
    for (const player of global.game.players) {
        playersList.push(player.pack());
    }

    // broadcast the new player to all players
    broadcast({ debug: 'Players Changed', players: playersList });

});

// Start the server on port 3000
app.listen(PORT, () => {
    console.info(`Server started on http://localhost:${PORT}`);
});

setInterval(() => {
    global.game.step();
}, global.game.time.tickRate);

module.exports = {broadcast}