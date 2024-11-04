document.addEventListener('keydown', function (event) {
    switch (event.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
            gameWSS.send(JSON.stringify({ press: 'up' }));
            break;
        case 'ArrowDown':
        case 's':
        case 'S':
            gameWSS.send(JSON.stringify({ press: 'down' }));
            break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
            gameWSS.send(JSON.stringify({ press: 'left' }));
            break;
        case 'ArrowRight':
        case 'd':
        case 'D':
            gameWSS.send(JSON.stringify({ press: 'right' }));
            break;
    }
});

document.addEventListener('keyup', function (event) {
    switch (event.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
            gameWSS.send(JSON.stringify({ release: 'up' }));
            break;
        case 'ArrowDown':
        case 's':
        case 'S':
            gameWSS.send(JSON.stringify({ release: 'down' }));
            break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
            gameWSS.send(JSON.stringify({ release: 'left' }));
            break;
        case 'ArrowRight':
        case 'd':
        case 'D':
            gameWSS.send(JSON.stringify({ release: 'right' }));
            break;
    }
});