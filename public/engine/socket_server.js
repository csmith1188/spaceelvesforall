const Players = require('./game/player/player.js');

function broadcast(server, data) {
    if (!server) return;
    for (const player of server.getWss().clients) {
        player.send(JSON.stringify(data));
    }
}

function gameHandler(ws, req) {
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

    // set the token for the websocket
    ws.token = req.session.token;

    let findPlayer = game.players.find(player => player.token.id === ws.token.id);
    if (!findPlayer) {
        console.info('Player not found. Creating new player', ws.token.displayName);
        let spectator = false;
        if (game.match) {
            const activePlayers = game.players.filter(player => !player.spectator).length;
            if (activePlayers >= game.match.playerLimit.max) {
                spectator = true;
                console.info(`Game full, joining spectator: ${ws.token.displayName}`);
            }
        }
        game.players.push(new Players.Player({ token: ws.token, ws: ws, spectator }));
        if (spectator) {
            ws.send(JSON.stringify({ debug: 'Joined as spectator' }));
        }
    } else {
        console.info('Player found. Reconnecting player.', ws.token.displayName);
        findPlayer.ws = ws;
        findPlayer.connected = true;
    }

    let playersList = [];
    for (const player of game.players) {
        playersList.push(player.fullPack());
    }


    // broadcast the new player list to all players
    broadcast(game.wss, { debug: 'Player connected', players: playersList });

    ws.send(JSON.stringify({ debug: 'Loaded new match', newMatch: game.match.fullPack() }));

    // listen for messages
    ws.on('message', (message) => {
        // If the message is not formatted as JSON, this will fail.
        try {
            // parse the message
            message = JSON.parse(message);
            // find the player
            let player = game.players.find(player => player.token.id === ws.token.id);
            // if the player is not found, close the connection
            if (!player) {
                console.log('Could not find you in this game.');

                ws.send(JSON.stringify({ debug: 'Could not find you in this game.' }));
                ws.close();
                return;
            }

            if (message.controller) {
                // for each controller input, update the player's controller's button
                player.controller.aimX = message.aimX;
                player.controller.aimY = message.aimY;
                player.controller.aimZ = message.aimZ;
                player.controller.newState = message.controller;
                if (Number.isFinite(message.inputSeq)) {
                    player.lastProcessedInputSeq = message.inputSeq;
                }
            }

            if (message.getCharacter) {
                let character = game.match.characters.find(character => character.id == message.getCharacter);
                // Send a spawn-safe payload (no circular refs like target->character->parent->controller->owner).
                if (character) {
                    const characterPayload = {
                        id: character.id,
                        type: character.type,
                        name: character.name,
                        team: character.team,
                        active: character.active,
                        visible: character.visible,
                        solid: character.solid,
                        cleanup: character.cleanup,
                        spawnPos: {
                            x: character.HB.pos.x,
                            y: character.HB.pos.y,
                            z: character.HB.pos.z
                        },
                        gfx: character.gfx,
                        parent: character.parent && typeof character.parent.pack === 'function'
                            ? character.parent.pack()
                            : { token: { id: character.parent?.token?.id } },
                        inventory: (character.inventory || []).map((item) => ({
                            weapon: item.weapon || item.type || 'sword',
                            ammo: item.ammo
                        }))
                    };
                    ws.send(JSON.stringify({ character: characterPayload }));
                }
            }

        } catch (error) {
            console.error(error);
        }
    });

    // listen for disconnects
    ws.on('close', () => {
        // set the player to disconnected
        let player = game.players.find(player => player.token.id === ws.token.id);
        player.connected = Date.now();
        let playersList = [];
        for (const player of game.players) {
            playersList.push(player.pack());
        }
        // broadcast the new player list
        broadcast(game.wss, { debug: 'Player disconnected', players: playersList });
    });

}

module.exports = { broadcast, gameHandler };