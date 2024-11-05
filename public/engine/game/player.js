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
        constructor() {
            this.id = null;
            this.buttons = {
                up: {
                    current: false,
                    last: false
                },
                down: {
                    current: false,
                    last: false
                },
                left: {
                    current: false,
                    last: false
                },
                right: {
                    current: false,
                    last: false
                }
            };
        }
    }

    class Player {
        constructor() {
            super();
            this.token = {};
        }
    }

    return { Bot, Player };
}));