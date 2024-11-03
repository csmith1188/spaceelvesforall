document.addEventListener('keydown', function(event) {
    switch(event.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
            console.log('Up key pressed');
            break;
        case 'ArrowDown':
        case 's':
        case 'S':
            console.log('Down key pressed');
            break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
            console.log('Left key pressed');
            break;
        case 'ArrowRight':
        case 'd':
        case 'D':
            console.log('Right key pressed');
            break;
    }
});

document.addEventListener('keyup', function(event) {
    switch(event.key) {
        case 'ArrowUp':
        case 'w':
            console.log('Up key released');
            break;
        case 'ArrowDown':
        case 's':
            console.log('Down key released');
            break;
        case 'ArrowLeft':
        case 'a':
            console.log('Left key released');
            break;
        case 'ArrowRight':
        case 'd':
            console.log('Right key released');
            break;
    }
});