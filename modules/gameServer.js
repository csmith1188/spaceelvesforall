// import child process handler
const { spawn } = require('child_process');
<<<<<<< Updated upstream
const config = require('./config.js');
=======
<<<<<<< HEAD
const net = require('net');
=======
const config = require('./config.js');
>>>>>>> db09eebc152f8b2399e7457049dd2b69fe95c446
>>>>>>> Stashed changes

exports.gameServerCount = 10000;
exports.gameServers = [];

const STARTUP_TIMEOUT_MS = 15000;
const PORT_POLL_MS = 100;

function waitForPort(port, timeoutMs) {
    return new Promise((resolve, reject) => {
        const startedAt = Date.now();

        const tryConnect = () => {
            const socket = net.connect({ host: '127.0.0.1', port }, () => {
                socket.end();
                resolve();
            });

            socket.on('error', () => {
                socket.destroy();
                if (Date.now() - startedAt >= timeoutMs) {
                    reject(new Error(`timed out waiting for port ${port}`));
                    return;
                }
                setTimeout(tryConnect, PORT_POLL_MS);
            });
        };

        tryConnect();
    });
}

exports.spawnGameServer = (req, res) => {
<<<<<<< Updated upstream
=======
<<<<<<< HEAD
    const port = exports.gameServerCount++;
    const child = spawn('node', ['index_game.js', '-p ' + port], {
        env: process.env,
    });
    child.PORT = port;
    child.gameId = `game-${port}`;

=======
>>>>>>> Stashed changes
    const requestedMatchType = req.query.matchType;
    const matchType = (requestedMatchType === 'ForHonorMP' || requestedMatchType === 'ForEver')
        ? requestedMatchType
        : 'ForHonorMP';
    // Start another Node.js script with the port argument
    const child = spawn('node', ['index_game.js', '-p ' + exports.gameServerCount, '-m ' + matchType]); // add { detached: true } to run in the background
    child.PORT = exports.gameServerCount;
    child.gameId = `game-${child.PORT}`;
>>>>>>> db09eebc152f8b2399e7457049dd2b69fe95c446
    let removedFromMasterList = false;
    let settled = false;

    const removeFromMasterList = () => {
        if (removedFromMasterList) return;
        removedFromMasterList = true;
        exports.gameServers = exports.gameServers.filter((server) => server !== child);
        console.info(`Removed game server ${port} from master list`);
    };

    const redirectUrl = `/gs/${port}/`;

    const failStartup = (reason) => {
        if (settled || res.headersSent) return;
        settled = true;
        console.error(`Game server ${port} failed to start: ${reason}`);
        res.status(503).send('Game server failed to start. Please try again.');
    };

    const completeStartup = () => {
        if (settled || res.headersSent) return;
        settled = true;
        console.info(`Game server ${port} ready, redirecting to ${redirectUrl}`);
        res.redirect(redirectUrl);
    };

    child.stdout.on('data', (data) => {
        console.info(`Server Info ${port}: ${data}`);
    });

    child.stderr.on('data', (data) => {
        console.error(`Server Error ${port}: ${data}`);
    });

    child.on('close', (code) => {
        console.info(`Server ${port} exited with code ${code}`);
        removeFromMasterList();
        failStartup(`exited with code ${code}`);
    });

    child.on('exit', (code, signal) => {
        if (signal) {
            console.info(`Server ${port} was killed with signal: ${signal}`);
        } else {
            console.info(`Server ${port} exited with code: ${code}`);
        }
        removeFromMasterList();
        failStartup(signal ? `killed with signal ${signal}` : `exited with code ${code}`);
    });

<<<<<<< Updated upstream
=======
<<<<<<< HEAD
=======
>>>>>>> Stashed changes
    const redirectUrl = config.buildPublicGameUrl(child.PORT);
    res.redirect(redirectUrl);

>>>>>>> db09eebc152f8b2399e7457049dd2b69fe95c446
    exports.gameServers.push(child);

    waitForPort(port, STARTUP_TIMEOUT_MS)
        .then(completeStartup)
        .catch((err) => failStartup(err.message));
};
