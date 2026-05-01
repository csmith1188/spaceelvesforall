(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        // Nodejs
        module.exports = factory();
    } else {
        // Browser globals (root is window)
        root.Camera = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {

    class Camera {
        constructor(options) {
            this.owner = null;
            this.x = 0;
            this.y = 0;
            this.target;
            this.radius = 800;
            this.zoom = 1;
            this.angle = 1;
            this._3D = 0;
            this.shakeTime = 0;
            this.shakeIntensity = 10;
            this.shakeFrequency = 2;
            this.spectatorIndex = 0;
            if (typeof options === 'object')
                for (var key of Object.keys(options)) {
                    this[key] = options[key];
                }
        }

        getSpectatorTargets() {
            if (!game || !game.match || !game.match.characters) return [];
            const living = game.match.characters.filter(character => character.active);
            return living;
        }

        update() {
            if (this.owner && this.owner.spectator) {
                const targets = this.getSpectatorTargets();
                if (targets.length > 0) {
                    if (this.owner.controller && this.owner.controller.buttons) {
                        const fire = this.owner.controller.buttons.fire;
                        if (fire && fire.current && !fire.last) {
                            this.spectatorIndex = (this.spectatorIndex + 1) % targets.length;
                        }
                    }
                    if (this.spectatorIndex >= targets.length) this.spectatorIndex = 0;
                    this.target = targets[this.spectatorIndex];
                    this.x = this.target.HB.pos.x;
                    this.y = this.target.HB.pos.y;
                    return;
                }
            }

            // find the game's match's character whose parent is this camera's owner
            this.target = game.match.characters.find(character => character.parent == this.owner);
            if (this.target) {
                if (this.target.active) {
                    this.x = this.target.HB.pos.x;
                    this.y = this.target.HB.pos.y;
                } else if (game.match && game.match.map) {
                    this.x = game.match.map.w / 2;
                    this.y = game.match.map.h / 2;
                }
            } else {
                if (game.match && game.match.map) {
                    this.x = game.match.map.w / 2;
                    this.y = game.match.map.h / 2;
                }
            }
            /*
            // Move camera to next sensible target when player character is inactive or missing
            if (!this.owner.character.active) {
                if (this.owner.character.lastColNPC)
                    if (this.owner.character.lastColNPC.active)
                        this.target = this.owner.character.lastColNPC
                    else
                        for (const npc of npcs) {
                            if (npc.active && npc.team == this.owner.character.team)
                                this.target = npc
                        }
                if (!this.target)
                    for (const npc of npcs) {
                        if (npc.active)
                            this.target = npc
                    }
            }

            //Update Camera Position
            if (this.target) {
                this.x = this.target.HB.pos.x;
                this.y = this.target.HB.pos.y;
            }

            //Update Camera Shake
            if (this.shakeTime > 0) {
                this.shakeTime--;
                this.x += sineAnimate(this.shakeIntensity, this.shakeFrequency) + this.shakeIntensity;
                // this.y += sineAnimate();
            }

            // if (this._3D) {
            //     this.x = this.target.x + Math.cos(this.angle) * this.radius;
            //     this.y = this.target.y + Math.sin(this.angle) * this.radius;
            // } else {
            //     this.x = this.target.x;
            //     this.y = this.target.y;
            // }
            */
        }

    }
    return Camera;
}));