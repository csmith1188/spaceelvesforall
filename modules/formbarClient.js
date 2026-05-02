/**
 * Optional socket.io-client connection to the Formbar server (same pattern as formbarboilerplate).
 * Starts only when API_KEY is set in the environment.
 */
module.exports = function formbarClient(config) {
    const { io } = require('socket.io-client');

    const socket = io(config.AUTH_BASE, {
        extraHeaders: { api: config.API_KEY },
        transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
        console.info('[Formbar] Connected to auth server');
        socket.emit('getActiveClass');
    });

    socket.on('disconnect', () => {
        console.info('[Formbar] Disconnected from auth server');
    });

    socket.on('setClass', (classData) => {
        console.info('[Formbar] Class data:', classData);
        socket.emit('classUpdate');
    });

    socket.on('classUpdate', (classroomData) => {
        if (!classroomData) return;
        console.info(
            `[Formbar] Classroom id: ${classroomData.id}, Name: ${classroomData.className}, Active: ${classroomData.isActive}`
        );
        if (classroomData.poll) {
            console.info(
                `[Formbar] Responses: ${classroomData.poll.totalResponses} / ${classroomData.poll.totalResponders}`
            );
        }
    });

    return socket;
};
