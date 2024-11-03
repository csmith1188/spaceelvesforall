// import child process handler
const { spawn } = require('child_process');

exports.gameServerCount = 11100;
exports.gameServers = [];

exports.spawnGameServer = (req, res) => {
    // Start another Node.js script with the port argument
    const child = spawn('node', ['game/index_game.js', '-p ' + exports.gameServerCount]); // add { detached: true } to run in the background
    child.PORT = exports.gameServerCount;

    // Listen for standard output (stdout) data from the child process
    child.stdout.on('data', (data) => {
        console.info(`Server Info ${child.PORT}: ${data}`);
    });

    // Listen for standard error (stderr) data from the child process
    child.stderr.on('data', (data) => {
        console.error(`Server Error ${child.PORT}: ${data}`);
    });

    // Listen for the child process to close (when it finishes or exits)
    child.on('close', (code) => {
        console.info(`Server ${child.PORT} exited with code ${code}`);
    });

    // Optional: Listen for exit events in case the process is terminated unexpectedly
    child.on('exit', (code, signal) => {
        if (signal) {
            console.info(`Server ${child.PORT} was killed with signal: ${signal}`);
        } else {
            console.info(`Server ${child.PORT} exited with code: ${code}`);
        }
    });

    res.redirect(`http://localhost:${child.PORT}/`);

    exports.gameServers.push(child);
    exports.gameServerCount++;
}