class Camera {
    constructor(owner, options) {
        this.owner = owner;
        this.target;
        this.radius;
        this.angle = 1;
        this._3D = 0;
        this.shakeTime = 0;
        this.shakeIntensity = 10;
        this.shakeFrequency = 2;
        if (typeof options === 'object')
            for (var key of Object.keys(options)) {
                this[key] = options[key];
            }
    }

    update() {
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
    }

}