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
                    displayName: this.token.displayName,
                    id: this.token.id
                }
            };
        }

        fullPack() {
            const packed = {
                controller: {},
                ws: {}
            };
            for (let key in this) {
                if (this.hasOwnProperty(key)) {
                    if (!packed[key])
                        packed[key] = this[key];
                }
            }
            delete packed.controller;
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
            this.spectator = false;
            this.connected = true;
            this.lastProcessedInputSeq = -1;
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

        /**
         * Minimal sync payload for broadcasts (e.g. disconnect). Must include connection state
         * so clients can drop duelists from the ready UI when disconnected.
         */
        pack() {
            return {
                id: this.id,
                token: {
                    displayName: this.token.displayName,
                    id: this.token.id
                },
                connected: this.connected === true,
                spectator: !!this.spectator,
                ready: !!this.ready
            };
        }

        step() {
            if (typeof window !== 'undefined' && game.player == this) {
                const lastDevice = Controllers.utils.lastDevice;
                if (lastDevice !== null) {
                    if (lastDevice === "keyboard") {
                        if (!this.controller || this.controller.type !== "keyboard") {
                            this.controller = new Controllers.Keyboard(this);
                        }
                    } else if (lastDevice === "touch") {
                        if (!this.controller || this.controller.type !== "touch") {
                            this.controller = new Controllers.Touch(this);
                        }
                    } else if (Number.isInteger(lastDevice)) {
                        const isMatchingPad = this.controller &&
                            this.controller.type === "gamepad" &&
                            this.controller.gamepadIndex === lastDevice;
                        if (!isMatchingPad) {
                            this.controller = new Controllers.GamePad(this, lastDevice);
                        }
                    }
                    Controllers.utils.lastDevice = null;
                } else if (!this.controller) {
                    // Default to keyboard/mouse if no device has reported activity yet.
                    this.controller = new Controllers.Keyboard(this);
                }
            }
        }

    }

    return { Bot, Player };
}));