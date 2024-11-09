(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        // Nodejs
        module.exports = factory();
    } else {
        // Browser globals (root is window)
        root.Matches = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    class Match {
        constructor() {
            this.characters = [];
            this.paused = false;
            this.runFunc = [];
            this.ticks = 0;
            this.setup();
        }

        reset() { }

        setup() { }

        step() {
            if (!this.paused) {
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
                    if (e.character.cleanup && !e.character.active) {
                        //Remove npcs
                        this.characters = this.characters.filter(function (el) { return el != e; });
                    }
                }

                this.ticks++;
            }
        }

        draw() { }
    }

    return { Match };
}));