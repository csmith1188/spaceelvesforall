// import child process handler
const { spawn } = require('child_process');
const config = require('./config.js');

exports.gameServerCount = 10000;
exports.gameServers = [];

exports.spawnGameServer = (req, res) => {
    // Start another Node.js script with the port argument
    const child = spawn('node', ['index_game.js', '-p ' + exports.gameServerCount]); // add { detached: true } to run in the background
    child.PORT = exports.gameServerCount;
    child.gameId = `game-${child.PORT}`;
    let removedFromMasterList = false;

    const removeFromMasterList = () => {
        if (removedFromMasterList) return;
        removedFromMasterList = true;
        exports.gameServers = exports.gameServers.filter((server) => server !== child);
        console.info(`Removed game server ${child.PORT} from master list`);
    };

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
        removeFromMasterList();
    });

    // Optional: Listen for exit events in case the process is terminated unexpectedly
    child.on('exit', (code, signal) => {
        if (signal) {
            console.info(`Server ${child.PORT} was killed with signal: ${signal}`);
        } else {
            console.info(`Server ${child.PORT} exited with code: ${code}`);
        }
        removeFromMasterList();
    });

    const redirectUrl = config.buildPublicGameUrl(child.PORT);
    res.redirect(redirectUrl);

    exports.gameServers.push(child);
    exports.gameServerCount++;
}