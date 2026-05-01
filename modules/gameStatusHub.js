const HEARTBEAT_TIMEOUT_MS = 5000;
const PRUNE_INTERVAL_MS = 1000;

function normalizeHost(rawHost) {
    if (!rawHost) return 'localhost';
    return rawHost.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
}

function createGameStatusHub({ app, wss }) {
    const gameStatusMap = new Map();
    const lobbyClients = new Set();
    const masterSecret = process.env.MASTER_SERVER_SECRET || '';

    function gameToPublic(game) {
        return {
            gameId: game.gameId,
            port: game.port,
            url: game.url,
            status: game.status,
            players: game.players,
            match: game.match,
            timeUpMs: game.timeUpMs,
            startedAt: game.startedAt,
            lastSeenAt: game.lastSeenAt
        };
    }

    function getPublicGames() {
        return Array.from(gameStatusMap.values())
            .map(gameToPublic)
            .sort((a, b) => a.port - b.port);
    }

    function sendSnapshot(ws) {
        ws.send(JSON.stringify({
            type: 'games.snapshot',
            games: getPublicGames(),
            timestamp: Date.now()
        }));
    }

    function broadcastPatch(action, game) {
        const payload = {
            type: 'games.patch',
            action,
            game: game ? gameToPublic(game) : null,
            timestamp: Date.now()
        };
        const serialized = JSON.stringify(payload);
        for (const client of lobbyClients) {
            if (client.readyState === 1) {
                client.send(serialized);
            }
        }
    }

    function isGameServerAuthorized(message) {
        if (!masterSecret) return true;
        return message.secret === masterSecret;
    }

    function upsertGame(message) {
        const now = Date.now();
        const gameId = message.gameId || `game-${message.port}`;
        const existing = gameStatusMap.get(gameId);
        const host = normalizeHost(process.env.THIS_URL);
        const protocol = process.env.THIS_URL && process.env.THIS_URL.startsWith('https://') ? 'https' : 'http';
        const next = {
            gameId,
            port: message.port,
            url: `${protocol}://${host}:${message.port}/`,
            status: message.type === 'game.ending' ? 'ending' : (message.status || 'online'),
            players: {
                current: message.players?.current || 0,
                max: message.players?.max || 0,
                usernames: Array.isArray(message.players?.usernames) ? message.players.usernames : []
            },
            match: {
                type: message.match?.type || 'Unknown',
                status: message.match?.status || 'waiting',
                score: message.match?.score || { teamA: 0, teamB: 0 }
            },
            timeUpMs: Number.isFinite(message.timeUpMs) ? message.timeUpMs : 0,
            startedAt: message.startedAt || existing?.startedAt || now,
            lastSeenAt: now
        };
        gameStatusMap.set(gameId, next);
        broadcastPatch(existing ? 'updated' : 'added', next);
    }

    app.ws('/master/game-status', (ws) => {
        ws.on('message', (raw) => {
            let message;
            try {
                message = JSON.parse(raw);
            } catch (error) {
                ws.send(JSON.stringify({ type: 'error', error: 'invalid_json' }));
                return;
            }

            if (!isGameServerAuthorized(message)) {
                ws.send(JSON.stringify({ type: 'error', error: 'unauthorized' }));
                ws.close();
                return;
            }

            if (!message.type || !Number.isFinite(message.port)) {
                ws.send(JSON.stringify({ type: 'error', error: 'invalid_message' }));
                return;
            }

            if (message.type === 'game.register' || message.type === 'game.heartbeat') {
                upsertGame(message);
                return;
            }

            if (message.type === 'game.ending') {
                const gameId = message.gameId || `game-${message.port}`;
                const existing = gameStatusMap.get(gameId);
                if (existing) {
                    gameStatusMap.delete(gameId);
                    broadcastPatch('removed', existing);
                }
            }
        });
    });

    app.ws('/master/games-live', (ws) => {
        lobbyClients.add(ws);
        sendSnapshot(ws);

        ws.on('close', () => {
            lobbyClients.delete(ws);
        });
    });

    setInterval(() => {
        const now = Date.now();
        for (const [gameId, game] of gameStatusMap.entries()) {
            if (now - game.lastSeenAt > HEARTBEAT_TIMEOUT_MS) {
                gameStatusMap.delete(gameId);
                broadcastPatch('removed', game);
            }
        }
    }, PRUNE_INTERVAL_MS);

    return {
        getPublicGames
    };
}

module.exports = { createGameStatusHub };
