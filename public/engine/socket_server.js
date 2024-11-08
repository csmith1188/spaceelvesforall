(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD
        define(['Players', 'Matches'], factory);
    } else if (typeof module === 'object' && module.exports) {
        // Node.js
        const Players = require('./game/player/player.js');
        const Matches = require('./game/match/match.js');
        module.exports = factory(Players, Matches);
    } else {
        // Browser globals: attach each export directly to the global scope
        const exports = factory(root.Players, root.Matches);
        for (let key in exports) {
            if (exports.hasOwnProperty(key)) {
                root[key] = exports[key];
            }
        }
    }
}(typeof self !== 'undefined' ? self : this, function (Players, Matches) {

    function broadcast(data) {
        console.log('Broadcasting', data);
        
        for (const player of global.game.players) {
            player.ws.send(JSON.stringify(data));
        }
    }

    function gameHandler (ws, req) {
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
    
        
        // create a new player
        global.game.players.push(new Players.Player({ token: ws.token, ws: ws }));

        // if this is the first player when this user connects, load a new match
        if (global.game.players.length == 1) global.game.loadMatch(new Matches.Match());
        
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
    
    }

    return { broadcast, gameHandler };
}));