(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['Characters', 'Utils', 'Maps'], factory);
    } else if (typeof module === 'object' && module.exports) {
        // Nodejs
        const Characters = require('./character.js');
        const Utils = require('../../utils.js');
        const Maps = require('./map/map.js');
        module.exports = factory(Characters, Utils, Maps);
    } else {
        // Browser globals (root is window)
        root.Matches = factory(root.Characters, root.Utils, root.Maps);
    }
}(typeof self !== 'undefined' ? self : this, function (Characters, Utils, Maps) {
    class Match {
        constructor() {
            this.matchType = 'Match';
            this.characters = [];
            this.paused = false;
            this.runFunc = [];
            this.map = null;
            this.stage = 'awaitPlayers';
            this.time = {
                ticks: 0,
                start: performance.now()
            }
            this.setup();
        }

        reset() {
        }

        setup() {
            this.map = new Maps.Map_Deathbox();
        }

        awaitPlayers() {
            // if the length of the global game players is greater than or equal to the max players, start the match
            if (game.players.length >= game.playerLimit.min) {
                // create a new character for each player
                for (let i = 0; i < game.players.length; i++) {
                    console.log('Creating character for player', game.players[i].token.username);
                    this.characters.push(new Characters.Jetbike({ name: game.players[i].token.username, parent: game.players[i], active: true, cleanup: false, spawnVect: new Utils.Vect3(i * 100 + 100, i * 100 + 100, 0), gfx: 'img/sprites/jetbike' }));
                }
                this.stage = 'startMatch';
            }
        }

        step() {
            if (!this.paused) {
                this.time.ticks++;

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
            if (this.map) {

                this.map.draw();

                for (const block of this.map.blocks) {
                    block.draw();
                }

                for (const bullet of this.map.bullets) {
                    bullet.draw();
                }

                for (const debris of this.map.debris) {
                    debris.draw();
                }

            }

            for (const chara of this.characters) {
                chara.draw();
            }

        }
    }

    return { Match };
}));