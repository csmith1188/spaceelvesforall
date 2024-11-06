(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        // Node.js
        module.exports = factory();
    } else {
        // Browser globals: attach each export directly to the global scope
        const exports = factory();
        for (let key in exports) {
            if (exports.hasOwnProperty(key)) {
                root[key] = exports[key];
            }
        }
    }
}(typeof self !== 'undefined' ? self : this, function () {

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
                id: this.id
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