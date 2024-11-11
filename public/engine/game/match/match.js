(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['Characters', 'Utils'], factory);
    } else if (typeof module === 'object' && module.exports) {
        // Nodejs
        const Characters = require('./character.js');
        const Utils = require('../../utils.js');
        module.exports = factory(Characters, Utils);
    } else {
        // Browser globals (root is window)
        root.Matches = factory(root.Characters, root.Utils);
    }
}(typeof self !== 'undefined' ? self : this, function (Characters, Utils) {
    class Match {
        constructor() {
            this.allID = 0;
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
            // if (game.players.length == game.maxPlayers) {
            if (game.players.length == game.maxPlayers) {
                // create a new character for each player
                for (let i = 0; i < game.players.length; i++) {
                    console.log('Creating character for player', game.players[i].token.username);
                    this.characters.push(new Characters.Character({ id: this.allID++, active: false, cleanup: false, startVector: new Utils.Vect3(i * 10, i * 10, 0) }));
                }
                this.stage = 'startMatch';
            }
        }

        step() {
            if (!this.paused) {
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
                    if (e.cleanup && !e.active) {
                        //Remove npcs
                        this.characters = this.characters.filter(function (el) { return el != e; });
                    }
                }
            }
        }

        draw() {
            // clear the screen and draw a green rectangle
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'green';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'black';
            ctx.fillText(this.time.ticks, 10, 50);

            if (this.map) {
                for (const block of this.map.blocks) {
                    block.draw();
                }

                for (const bullet of this.map.bullets) {
                    bullet.draw();
                }

                for (const debris of this.map.debris) {
                    debris.draw();
                }

                this.map.draw();
            }

            for (const chara of this.characters) {
                chara.draw();
            }

        }
    }

    return { Match };
}));