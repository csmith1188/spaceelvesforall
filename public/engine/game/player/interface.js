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

    class Window {
        constructor(options) {
            this.size = {
                width: 800,
                height: 600
            };
            this.pos = {
                x: 0,
                y: 0
            };
            this.content = '';
            this.title = '';
            this.buttons = [];
            this.style = {
                backgroundColor: rgba(0, 0, 0, 0.5),
                color: '#fff',
                border: '1px solid #000',
                borderRadius: '5px',
                padding: '10px',
                margin: '10px'
            };
            // options
            for (let key in options) {
                if (options.hasOwnProperty(key)) {
                    this[key] = options[key];
                }
            }
        }

        draw() {
            // draw the window in html
            const window = document.createElement('div');
            window.style = this.style;
            window.style.position = 'absolute';
            // 
            window.innerText = this.content;
        }
    }

    return { Bot, Player };
}));