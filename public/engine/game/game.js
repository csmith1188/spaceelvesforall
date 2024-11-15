(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD
        define(['Matches'], factory);
    } else if (typeof module === 'object' && module.exports) {
        // Node.js
        const Matches = require('./match/match.js');
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
            this.maxPlayers = 2;
            this.client = false;
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
                start: Date.now()
            }
            // loop through the options and add them to the game
            for (let key in options) {
                if (options.hasOwnProperty(key)) {
                    this[key] = options[key];
                }
            }
        }

        step() {

            if (this.client) {
                this.player = this.players.find(player => player.token.id == token.id);
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
                            gameWSS.send(JSON.stringify({ controller: player.controller.newState }));
                        }
                    }
                }
                else if (this.match) {
                    // this.match.paused = `Player ${player.id} has no controller`;
                }
            }

            if (this.match) {
                this.match.step();
                if (this.client) {
                    this.match.draw();
                    this.player.camera.update(this.player); // Update the camera
                } else {
                    // get all characters whose HB is not equal to their lastHB
                    let characters = this.match.characters.filter(character => character.HB != character.lastHB);
                    // replace each character in the list with their pack()ed version
                    characters = characters.map(character => character.pack());
                    // send all characters to the client
                    this.broadcast(this.wss, { characters: characters });
                }
            }
        }

        loadMatch(match) {
            switch (match) {
                case 'Match':
                    this.match = new Matches.Match();
                    break;
                default:
                    this.match = new Matches.Match();
                    break;
            }
        }

        loadPlayer(options) {
            this.players.push(Players.Player(options));
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