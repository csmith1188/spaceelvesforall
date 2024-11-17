// const MasterWSS = new WebSocket('ws://localhost:3000/chat');

// MasterWSS.addEventListener('open', () => {
//     console.log('Connected to Master WSS');
// });

// MasterWSS.addEventListener('message', (event) => {
//     try {
//         const message = JSON.parse(event.data);
//         console.log(message);
//     } catch (error) {
//         console.log(error);
//     }
// });

// MasterWSS.addEventListener('error', () => {
//     console.log('Error connecting to Master WSS');
// });



const gameWSS = new WebSocket('ws://localhost:10000/game');

gameWSS.addEventListener('open', () => {
    console.log('Connected to Game WSS');
});

gameWSS.addEventListener('message', (event) => {
    let message;
    try {
        message = JSON.parse(event.data);
        // console.log(message);
    } catch (error) {
        console.log(error);
        return;
    }
    if (game) {
        if (message.players) {
            for (let player of message.players) {
                //if a player is in the message but not the game.players array, add a new Player
                if (!game.players.find(p => p.token.username === player.token.username)) {
                    // if this player's token's id is the same as the client's token id
                    if (player.token.username === token.username) {
                        game.players.push(new Players.Player({ token: token }));
                        game.players[game.players.length - 1].camera = new Camera({ owner: game.players[game.players.length - 1] });
                    } else {
                        game.players.push(new Players.Player(player));
                    }
                }
                // if a player is in the game.players array but not in the message, remove the player
                if (!message.players.find(p => p.token.username === player.token.username)) {
                    game.players = game.players.filter(p => p.token.username !== player.token.username);
                }
            }
        }

        if (message.characters) {
            for (let character of message.characters) {
                let c = game.match.characters.find(c => c.parent.token.username === character.ownerName);
                if (c) {
                    c.serverPos.x = character.pos.x;
                    c.serverPos.y = character.pos.y;
                    c.serverPos.z = character.pos.z;
                    c.serverPos.time = message.time;
                    c.id = character.id;
                }
            }
        }

        if (message.bullets) {
            for (let bullet of message.bullets) {
                let b = game.match.map.bullets.find(b => b.id === bullet.id);
                if (b) {
                    //if the bullet is a cube, set the bullet's pos and volume
                    if (bullet.shape == 'cube') {
                        b.serverPos.pos.x = bullet.pos.x;
                        b.serverPos.pos.y = bullet.pos.y;
                        b.serverPos.pos.z = bullet.pos.z;
                        b.serverVol.vol.x = bullet.vol.x;
                        b.serverPos.vol.y = bullet.vol.y;
                        b.serverPos.vol.z = bullet.vol.z;
                        b.serverPos.speed = bullet.speed;
                    } else if (bullet.shape == 'cylinder') {
                        //if the bullet is a sphere, set the bullet's pos and volume
                        b.serverPos.pos.x = bullet.pos.x;
                        b.serverPos.pos.y = bullet.pos.y;
                        b.serverPos.pos.z = bullet.pos.z;
                        b.serverPos.radius = bullet.radius;
                        b.serverPos.height = bullet.height;
                        b.serverPos.speed = bullet.speed;
                    }
                    b.serverPos.time = message.time;
                } else {
                    //if the bullet is not in the game, add it
                    game.match.map.spawn(bullet);
                }
                // remove bullets not in the message
                // game.match.map.bullets = game.match.map.bullets.filter(b => bullet.id === b.id);
            }
        }

        if (message.powerups) {
            for (let powerup of message.powerups) {
                let p = game.match.map.blocks.find(p => p.id === powerup.id);
                if (p) {
                    p.serverPos.x = powerup.pos.x;
                    p.serverPos.y = powerup.pos.y;
                    p.serverPos.z = powerup.pos.z;
                    p.serverPos.time = message.time;
                } else {
                    game.match.map.spawn({ type: "pickup", ...powerup });
                }
            }
        }

        if (message.newMatch) {
            game.loadMatch(message.newMatch);
        }
    }
});

gameWSS.addEventListener('close', (event) => {
    console.log('Disconnected from Game WSS');

});