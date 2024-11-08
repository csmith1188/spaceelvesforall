(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD
        define(['Sockets', 'Matches'], factory);
    } else if (typeof module === 'object' && module.exports) {
        // Node.js
        const Sockets = require('../socket_server.js');
        const Matches = require('./match/match.js');
        module.exports = factory(Sockets, Matches);
    } else {
        // Browser globals: attach each export directly to the global scope
        const exports = factory(root.Sockets, root.Matches);
        for (let key in exports) {
            if (exports.hasOwnProperty(key)) {
                root[key] = exports[key];
            }
        }
    }
}(typeof self !== 'undefined' ? self : this, function (Sockets, Matches) {

    class Game {
        constructor(options) {
            this.players = [];
            this.maxPlayers = 2;
            this.client = false;
            this.match = null;
            this.time = {
                tickRate: 1000 / 60,
                ticks: 0,
                start: performance.now(),
                last: performance.now(),
                delta: 0
            }
            // loop through the options and add them to the game
            for (let key in options) {
                if (options.hasOwnProperty(key)) {
                    this[key] = options[key];
                }
            }
        }

        step() {
            this.time.ticks++;
            this.time.delta = (performance.now() - this.time.last) / this.time.tickRate;
            this.time.last = performance.now();

            // handle each player's controller
            for (let player of this.players) {
                if (player.controller) player.controller.step();
                else if (this.match) this.match.paused = `Player ${player.id} has no controller`;
            }

            if (this.match) this.match.step();
        }

        loadMatch(match) {
            if (match instanceof Matches.Match) {
                console.log('Loading match', match);
                this.match = match;
            } else {
                this.match = new Matches.Match(match);
            }
            if (!this.client) {
                Sockets.broadcast({ debug: 'Loaded new match', match: this.match });
            }
        }
    }

    return { Game };
}));