function broadcast(clients, sender, room, message) {
    for (const client of clients) {
        if (client.rooms.includes(room)) {
            client.send(JSON.stringify({ sender: sender, room: room, message: message }));
        }
    }
}

function userList(clients, room) {
    let users = [];
    for (const client of clients) {
        if (client.rooms.includes(room)) {
            users.push(client.token.username);
        }
    }
    return users;
}

module.exports = (app, wss) => {
    app.ws('/chat', (ws, req) => {
        console.info(`Client connected, ${new Date()}`);

        ws.token = req.session.token;
        ws.rooms = ['lfg'];
        ws.currentRoom = 'lfg';

        ws.send(JSON.stringify({ sender: 'Server', room: 'All', message: 'You have joined the chat', userList: userList(wss.getWss().clients, ws.currentRoom), rooms: ws.rooms, currentRoom: ws.currentRoom }));

        ws.on('message', (data) => {
            try {
                data = JSON.parse(data);
                if (data.message) {
                    console.info(`Received data: ${data.message}`);
                    // the first word is the command if it starts with '/'
                    if (data.message.trim().startsWith('/')) {
                        const command = data.message.split(' ')[0].substring(1);
                        const args = data.message.split(' ').slice(1);
                        console.log(`Command: ${command}, Args: ${args}`);

                        switch (command) {
                            case 'join':
                                if (args[0]) {
                                    ws.currentRoom = args[0];
                                    ws.rooms.push(args[0]);
                                    ws.send(JSON.stringify({ sender: 'Server', room: args[0], message: 'You have joined the room', rooms: ws.rooms, currentRoom: ws.currentRoom }));
                                }
                                break;
                            case 'leave':
                                if (args[0]) {
                                    ws.rooms = ws.rooms.filter(room => room !== args[0]);
                                    ws.currentRoom = ws.rooms[0];
                                    ws.send(JSON.stringify({ sender: 'Server', room: args[0], message: 'You have left the room', rooms: ws.rooms, currentRoom: ws.currentRoom }));
                                }
                                break;
                            case 'list':
                                ws.send(JSON.stringify({ rooms: ws.rooms }));
                                break;
                            case 'help':
                                ws.send(JSON.stringify({ sender: 'Server', room: command, message: 'Available commands: /join xxx, /leave xxx, /list, /help. /xxx to start speaking in room xxx' }));
                                break;
                            default:
                                ws.currentRoom = command;
                                if (!ws.rooms.includes(command)) {
                                    ws.rooms.push(command);
                                    ws.send(JSON.stringify({ userList: userList(wss.getWss().clients, ws.currentRoom), rooms: ws.rooms, sender: 'Server', room: command, message: `You have joined room ${command}`, currentRoom: ws.currentRoom }));
                                } else {
                                    ws.send(JSON.stringify({ currentRoom: ws.currentRoom }));

                                }
                                //remove command from message
                                data.message = data.message.substring(command.length + 1);
                                if (data.message.trim()) {
                                    broadcast(wss.getWss().clients, ws.token.username, ws.currentRoom, data.message);
                                }
                                // ws.send(JSON.stringify({ error: `Unknown command: ${command}` }));
                                break;
                        }
                    } else {
                        broadcast(wss.getWss().clients, ws.token.username, ws.currentRoom, data.message);
                    }
                }
            } catch (err) {
                console.error(err);
                ws.send(JSON.stringify({ error: `Error parsing message: ${err}` }));
            }
        });

        // listen for disconnects
        ws.on('close', () => {
            console.info(`Client disconnected, ${new Date()}`);
        });
    })
}