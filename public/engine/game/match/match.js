(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        // Nodejs
        module.exports = factory();
    } else {
        // Browser globals (root is window)
        root.Matches = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    class Match {
        constructor() {
            this.matchType = 'Match';
            this.characters = [];
            this.paused = false;
            this.runFunc = [];
            this.map = null;
            this.stage = 'awaitPlayers';
            this.time = {
                tickRate: 1000 / 60,
                ticks: 0,
                start: performance.now(),
                last: performance.now(),
                delta: 0
            }
            this.setup();
        }

        reset() { }

        setup() { }

        awaitPlayers() {
            // if the length of the global game players is greater than or equal to the max players, start the match
            if (global.game.players.length == global.game.maxPlayers) {
                // Sockets.broadcast({ debug: 'All players ready. Creating characters' });
                // create a new character for each player
                for (let i = 0; i < global.game.players.length; i++) {
                    this.characters.push(new Characters.Character({ id: allID++ }));
                }
                this.stage = 'startMatch';
            }
        }

        step() {

            this.time.ticks++;
            this.time.delta = (performance.now() - this.time.last) / this.time.tickRate;
            this.time.last = performance.now();

            switch (this.stage) {
                case 'awaitPlayers':
                    this.awaitPlayers();
                    return;
                default:
                    break;
            }
            if (!this.paused) {
                for (const chara of this.characters) {
                    chara.step();
                }

                if (this.map) {
                    for (const block of this.map.blocks) {
                        block.step();
                    }

                    for (const bullet of this.map.bullets) {
                        bullet.step();
                    }

                    for (const debris of this.map.debris) {
                        debris.step();
                    }

                    this.map.step();
                }

                // Run all runFunc
                for (const func of this.runFunc) {
                    func();
                }

                // Remove old bots
                for (const e of this.characters) {
                    if (e.character.cleanup && !e.character.active) {
                        //Remove npcs
                        this.characters = this.characters.filter(function (el) { return el != e; });
                    }
                }
            }
        }

        draw() { }
    }

    return { Match };
}));