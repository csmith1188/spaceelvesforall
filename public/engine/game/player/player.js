(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD
        define(['Controllers'], factory);
    } else if (typeof module === 'object' && module.exports) {
        // Node.js
        const Controllers = require('./controller.js');
        module.exports = factory(Controllers);
    } else {
        // Browser globals: attach each export directly to the global scope
        root.Players = factory(root.Controllers);
    }
}(typeof self !== 'undefined' ? self : this, function (Controllers) {

    class Bot {
        constructor(options) {
            this.controller = null;
            // this.id = Utils.uuidGen(4);
            // loop through the options and add them to the bot
            for (let key in options) {
                if (options.hasOwnProperty(key)) {
                    this[key] = options[key];
                }
            }
        }

        pack() {
            return {
                id: this.id,
                token: {
                    username: this.token.username,
                    id: this.token.id
                }
            };
        }

        fullPack() {
            const packed = {
                controller: {}
            };
            for (let key in this) {
                if (this.hasOwnProperty(key)) {
                    if (!packed[key])
                        packed[key] = this[key];
                }
            }
            return packed
        }
    }

    class Player extends Bot {
        constructor(options) {
            super(options);
            this.ws = null;
            this.token = {};
            this.inMenu = false;
            this.ready = false;
            this.connected = true;
            if (typeof window === 'undefined') {
                this.controller = new Controllers.SocketController(this);
            }

            // loop through the options and add them to the player
            for (let key in options) {
                if (options.hasOwnProperty(key)) {
                    this[key] = options[key];
                }
            }

            if (typeof window !== 'undefined' && !this.controller) {
                this.awaitingInput = true;
                Controllers.utils.listenLastDevice();
            }
        }

        step() {
            if (typeof window !== 'undefined' && !this.controller && game.player == this) {
                if (Controllers.utils.lastDevice !== null) {
                    // if the lastDevice was keyboard, touch, pad or something else
                    if (Controllers.utils.lastDevice == "keyboard") {
                        this.controller = new Controllers.Keyboard(this);
                    } else if (Controllers.utils.lastDevice == "touch") {
                        this.controller = new Controllers.Touch(this);
                    } else {
                        this.controller = new Controllers.GamePad(this, Controllers.utils.lastDevice);
                    }
                    Controllers.utils.lastDevice = null;
                    // this.awaitingInput = false;
                }
            }
        }

    }

    return { Bot, Player };
}));