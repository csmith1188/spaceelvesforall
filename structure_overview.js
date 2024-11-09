const game = { // A collection of players carried across multiple matches
    socket: {},
    players: [
        {
            player: {
                controller: {}
            }
        }
    ],
    match: {
        tokens: [
            {
                token: {
                    owner: player
                }
            }
        ],
        blocks: [],
        debris: [], //client side only
        map: {},
        time: { ticks, seconds },
        state: { started, ended, paused },
        AI: () => {}
    }
};