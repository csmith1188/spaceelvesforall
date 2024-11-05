const MasterWSS = new WebSocket('ws://localhost:3000/chat');

MasterWSS.addEventListener('open', () => {
    console.log('Connected to Master WSS');
});

MasterWSS.addEventListener('message', (event) => {
    try {
        const message = JSON.parse(event.data);
        console.log(message);
    } catch (error) {
        console.log(error);
    }
});

MasterWSS.addEventListener('error', () => {
    console.log('Error connecting to Master WSS');
});

const gameWSS = new WebSocket('ws://localhost:10000/game');

gameWSS.addEventListener('open', () => {
    console.log('Connected to Game WSS');
});

gameWSS.addEventListener('message', (event) => {
    try {
        const message = JSON.parse(event.data);
        console.log(message);
        if (message.players) {
            game.players = message.players;
        }
    } catch (error) {
        console.log(error);
    }
});

gameWSS.addEventListener('close', (event) => {
    console.log('Disconnected from Game WSS');

});