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
        console.log(message);
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
                        game.players.push(new Players.Player({ ...player, ...{ camera: new Camera() } }));
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
        if (message.newMatch) {
            game.loadMatch(message.match);
        }
    }
});

gameWSS.addEventListener('close', (event) => {
    console.log('Disconnected from Game WSS');

});