(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD
        define(['Matches'], factory);
    } else if (typeof module === 'object' && module.exports) {
        // Node.js
        const Matches = require('./match/match.js');
        require('./match/match_forhonormp.js');
        module.exports = factory(Matches);
    } else {
        // Browser globals: attach each export directly to the global scope
        const exports = factory(root.Matches);
        for (let key in exports) {
            if (exports.hasOwnProperty(key)) {
                root[key] = exports[key];
            }
        }
    }
}(typeof self !== 'undefined' ? self : this, function (Matches) {

    class Game {
        constructor(options) {
            this.players = [];
            this.client = false;
            this.multiplayer = true;
            this.match = null;
            this.window = {
                w: 0,
                h: 0,
                cx: () => { return this.w / 2 },
                cy: () => { return this.h / 2 }
            };
            this.gameView = {
                w: 0,
                h: 0,
                cx: () => { return this.w / 2 },
                cy: () => { return this.h / 2 }
            };
            this.time = {
                tickRate: 1000 / 60,
                ticks: 0,
                start: performance.now(),
                last: performance.now(),
                diff: 0,
                delta: 0,
                avgList: [],
                avg: 0
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
            this.time.diff = performance.now() - this.time.last;
            this.time.delta = this.time.diff / this.time.tickRate;
            this.time.last = performance.now();
            this.time.avgList.push(this.time.delta);
            if (this.time.avgList.length > 20) {
                this.time.avgList.shift();
                this.time.avg = this.time.avgList.reduce((a, b) => a + b, 0) / this.time.avgList.length;
            }
            // console.log(`Ticks: ${this.time.ticks.toFixed(2)}\t Complete: ${this.time.diff.toFixed(2)}\t Delta: ${this.time.delta.toFixed(2)}\t AVG: ${this.time.avg.toFixed(2)}`);

            if (typeof window !== 'undefined') {
                this.player = this.players.find(player => player.token.id == token.id);
                if (this.player)
                    this.player.interface = this.player.interface || new Interfaces.Interface(this.player);
                this.window.w = window.innerWidth;
                this.window.h = window.innerHeight;
                if (this.player)
                    this.player.camera.radius = Math.sqrt((this.window.w / 2) ** 2 + (this.window.h / 2) ** 2)
                canvas.width = this.window.w;
                canvas.height = this.window.h;
                this.gameView.w = Math.min(window.innerWidth, 1920);
                this.gameView.h = Math.min(window.innerHeight, 1080);
            }

            // handle each player's controller
            for (let player of this.players) {
                player.step();
                if (player.controller) {
                    player.controller.read();
                    if (typeof window !== 'undefined') {
                        //if the newState has at least one property
                        if (Object.keys(player.controller.newState).length > 0) {
                            // send newState to server
                            gameWSS.send(JSON.stringify({ controller: player.controller.newState, aimX: player.controller.aimX, aimY: player.controller.aimY, aimZ: player.controller.aimZ }));
                        }
                    }
                }
                else if (this.match) {
                    // this.match.paused = `Player ${player.id} has no controller`;
                }
            }

            if (this.match) {
                this.match.step();
                if (typeof window !== 'undefined') {
                    if (this.player) {
                        this.match.draw();
                        this.player.camera.update(this.player); // Update the camera
                    }
                } else {
                    /*
                                      _                 _      _
                      ___ ___ _ _  __| |  _  _ _ __  __| |__ _| |_ ___
                     (_-</ -_) ' \/ _` | | || | '_ \/ _` / _` |  _/ -_)
                     /__/\___|_||_\__,_|  \_,_| .__/\__,_\__,_|\__\___|
                                              |_|
                    */
                    // get all characters whose HB is not equal to their lastHB
                    if (this.time.ticks % 3 == 0) {
                        let characters = this.match.characters.filter(character => character.HB != character.lastHB);
                        characters = this.match.characters.filter(character => character.active);
                        // replace each character in the list with their pack()ed version
                        characters = characters.map(character => character.pack());
                        // replace each bullet in the list with their pack()ed version
                        let bullets = this.match.map.bullets.map(bullet => bullet.pack());
                        // get all blocks in the list whose type is pickup
                        let powerups = this.match.map.blocks.filter(block => block.type == 'pickup');
                        // replace each powerup in the list with their pack()ed version
                        powerups = powerups.map(powerup => powerup.pack());
                        // get all blocks in the list whose type is weapon
                        let weapons = this.match.map.blocks.filter(block => block.type == 'weapon');
                        // replace each weapon in the list with their pack()ed version
                        weapons = weapons.map(weapon => weapon.pack());
                        // send all characters to the client
                        this.broadcast(this.wss, {
                            characters: characters,
                            bullets: bullets,
                            powerups: powerups,
                            weapons: weapons,
                            time: Date.now()
                        });
                    }

                }
            }
        }

        countConnections() {
            let count = 0;
            for (let player of this.players) {
                if (player.connected === true) count++;
                else if (Date.now() - player.connected > 10000) player.ws.close();
            }   

            return count;
        }

        loadMatch(match) {
            try {
                if (typeof match === 'string')
                    match = { matchType: match };
                switch (match.matchType) {
                    case 'Match':
                        this.match = new Matches.Match(match);
                        break;
                    case 'ForHonorMP':
                        console.log('For Honor Multiplayer');
                        this.match = new Matches.ForHonorMP(match);
                        break;
                    default:
                        this.match = new Matches.Match(match);
                        break;
                }
            } catch (error) {
                console.log(error);
            }
        }

        loadPlayer(options) {
            this.players.push(Players.Player(options));
        }

        pack() {
            return {
                players: this.players.map(player => player.pack())
            }
        }

        fullPack() {
            const packed = {
                players: this.players.map(player => player.fullPack())
            }
            for (var key of Object.keys(this)) {
                if (typeof this[key] !== 'function') {
                    if (!packed[key])
                        packed[key] = this[key];
                }
            }
            return packed;
        }

    }

    /* For a single instance across all modules, instantiate here, then export */
    /*
    var game = new Game();

    if (typeof window === undefined) {
        game.client = true;
    }
    */

    return { Game /*, game */ };
}));