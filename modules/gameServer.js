// import child process handler
const { spawn } = require('child_process');
const net = require('net');
const config = require('./config.js');

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
    const port = exports.gameServerCount++;
    const requestedMatchType = req.query.matchType;
    const matchType = (requestedMatchType === 'ForHonorMP' || requestedMatchType === 'ForEver')
        ? requestedMatchType
        : 'ForHonorMP';

    const child = spawn('node', ['index_game.js', '-p ' + port, '-m ' + matchType], {
        env: process.env,
    });
    child.PORT = port;
    child.gameId = `game-${port}`;

    let removedFromMasterList = false;
    let settled = false;

    const removeFromMasterList = () => {
        if (removedFromMasterList) return;
        removedFromMasterList = true;
        exports.gameServers = exports.gameServers.filter((server) => server !== child);
        console.info(`Removed game server ${port} from master list`);
    };

    const redirectUrl = config.buildPublicGameUrl(port);

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

    exports.gameServers.push(child);

    waitForPort(port, STARTUP_TIMEOUT_MS)
        .then(completeStartup)
        .catch((err) => failStartup(err.message));
};
