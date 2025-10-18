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
        constructor(options) {
            this.matchType = 'Match';
            this.playerLimit = { min: 1, max: 2 };
            this.characters = [];
            this.paused = false;
            this.runFunc = [];
            this.map = null;
            this.stage = 'awaitPlayers';
            this.time = {
                ticks: 0,
                start: performance.now()
            }

            /*
                ___       _   _
               / _ \ _ __| |_(_)___ _ _  ___
              | (_) | '_ \  _| / _ \ ' \(_-<
               \___/| .__/\__|_\___/_||_/__/
                    |_|
            */
            if (typeof options === 'object')
                for (var key of Object.keys(options)) {
                    this[key] = options[key];
                }



            let spawnList = this.characters;
            this.characters = [];
            for (const character of spawnList) {
                this.spawnCharacter(character);
            }

            this.setup();
        }


        spawnCharacter(chara) {
            if (chara && chara.constructor === Object) {
                chara.lastHB = chara.spawnPos;
                chara.parent = game.players.find(p => p.token.id === chara.parent.token.id);
                let newChara;
                // for each item in the chara.inventory, create a new item and add it to the character's inventory
                switch (chara.type) {
                    case 'jetbike':
                        newChara = new Characters.Jetbike(chara);
                        break;
                    default:
                        newChara = new Characters.Character(chara);
                        break;
                }
                newChara.inventory = chara.inventory.map(item => newChara.spawnWeapon(item));
                this.characters.push(newChara);
            }
        }

        reset() {
        }

        setup() {
            this.map = new Maps.Map_Deathbox();
        }

        awaitPlayers() {
            // if the length of the global game players is greater than or equal to the max players, start the match
            if (game.countConnections() >= this.playerLimit.min) {
                // create a new character for each player
                for (let i = 0; i < game.players.length; i++) {
                    if (typeof window == 'undefined') {
                        console.log('Creating character for player', game.players[i].token.displayName);
                        let images = ['img/sprites/jetbike', 'img/sprites/dark1', 'img/sprites/dark2'];
                        this.characters.push(new Characters.Jetbike({ name: game.players[i].token.displayName, team: i, parent: game.players[i], active: true, cleanup: false, spawnPos: new Utils.Vect3(i * 100 + 100, i * 100 + 100, 0), gfx: images[i] }));

                    }
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

                // Check for players without characters and create them (late joiners)
                if (typeof window === 'undefined') {
                    for (let i = 0; i < game.players.length; i++) {
                        const player = game.players[i];
                        const hasCharacter = this.characters.some(c => c.parent === player);
                        
                        if (!hasCharacter) {
                            console.log('Creating character for late-joining player', player.token.displayName);
                            let images = ['img/sprites/jetbike', 'img/sprites/dark1', 'img/sprites/dark2'];
                            this.characters.push(new Characters.Jetbike({ 
                                name: player.token.displayName, 
                                team: i, 
                                parent: player, 
                                active: true, 
                                cleanup: false, 
                                spawnPos: new Utils.Vect3(i * 100 + 100, i * 100 + 100, 0), 
                                gfx: images[i % images.length] 
                            }));
                        }
                    }
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

                // Combine blocks, bullets, debris, and characters
                let entities = [...this.map.blocks, ...this.map.bullets, ...this.map.debris, ...this.characters];

                // Sort entities by their HB's pos y
                entities.sort((a, b) => a.HB.pos.y - b.HB.pos.y);

                // Draw sorted entities
                for (const entity of entities) {
                    entity.draw();
                }

                // Draw UI
                if (game.player.interface) {
                    game.player.interface.drawHUD();
                }

            }

        }

        pack() {
            return {};
        }

        fullPack() {
            const packed = {
                characters: this.characters.map(chara => chara.fullPack())
            }
            for (const key of Object.keys(this)) {
                if (typeof this[key] !== 'function') {
                    // if pack doesn't have this key, add it
                    if (!packed[key])
                        packed[key] = this[key];
                }
            }
            return packed;
        }
    }

    return { Match };
}));