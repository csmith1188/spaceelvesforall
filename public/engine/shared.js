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

    class Thing {
        constructor(pos={x:0, y:0}, name="noname", size = 32, color = 'green') {
            this.name = name;
            this.pos = { x: pos.x || 0, y: pos.y || 0 };
            this.vel = { x: pos.x || 0, y: pos.y || 0 };
            this.buttons = {
                up: false,
                down: false,
                left: false,
                right: false
            };
            this.ctlrChange = false;
            this.spd = 2;
            this.friction = 0.9;
            this.maxSpd = 5;
            this.r = size;
            this.color = 'green';
        }

        move() {
            this.pos.x += this.vel.x;
            this.pos.y += this.vel.y;
        }

        draw(ctx) {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.pos.x, this.pos.y, this.r, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    return { Thing };
}));