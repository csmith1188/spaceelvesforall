(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD
        define(['Cameras'], factory);
    } else if (typeof module === 'object' && module.exports) {
        // Node.js
        const Cameras = require('./camera.js');
        module.exports = factory();
    } else {
        // Browser globals: attach each export directly to the global scope
        root.Players = factory(root.Cameras);
    }
}(typeof self !== 'undefined' ? self : this, function (Cameras) {

    class Bot {
        constructor(options) {
            this.id = null;
            this.controller = null;
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
    }

    class Player extends Bot {
        constructor(options) {
            super(options);
            this.ws = null;
            this.token = {};
            this.inMenu = false;
            this.ready = false;
            // loop through the options and add them to the player
            for (let key in options) {
                if (options.hasOwnProperty(key)) {
                    this[key] = options[key];
                }
            }
        }

    }

    return { Bot, Player };
}));