const Players = require('./game/player/player.js');

function broadcast(server, data) {
    if (!server) return;
    console.log('Broadcasting', data);
    for (const player of server.getWss().clients) {
        player.send(JSON.stringify(data));
    }
}

function gameHandler(ws, req) {
    // get this ws's server
    const wss = game.wss;

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
    if (!(game.maxPlayers > game.players.length)) {
        console.error('Game server is full');
        ws.send(JSON.stringify({ debug: 'Game server is full' }));
        ws.close();
        return;
    }

    // set the token for the websocket
    ws.token = req.session.token;

    // if this is the first player when this user connects, load a new match
    if (game.players.length == 0) game.loadMatch('Match');
    ws.send(JSON.stringify({ debug: 'Loaded new match', newMatch: game.match }));

    // create a new player
    game.players.push(new Players.Player({ token: ws.token, ws: ws }));

    let playersList = [];
    for (const player of game.players) {
        playersList.push(player.pack());
    }

    // broadcast the new player to all players
    broadcast(wss, { debug: 'Player connected', players: playersList });

    // listen for messages
    ws.on('message', (message) => {
        // If the message is not formatted as JSON, this will fail.
        try {
            // parse the message
            message = JSON.parse(message);
            // find the player
            let player = game.players.find(player => player.token === ws.token);
            // if the player is not found, close the connection
            if (!player) {
                ws.send(JSON.stringify({ debug: 'Could not find you in this game.' }));
                ws.close();
                return;
            }

            if (message.controller) {
                // for each controller input, update the player's controller's button
                for (let button in message.controller) {
                    player.controller.buttons[button] = message.controller[button];
                }
            }

        } catch (error) {
            console.error(error);
        }
    });

    // listen for disconnects
    ws.on('close', () => {
        // remove the player from the game
        game.players = game.players.filter(player => player.token !== ws.token);
        // broadcast the new player list
        broadcast(wss, { debug: 'Player disconnected', players: game.players });
    });

}

module.exports = { broadcast, gameHandler };