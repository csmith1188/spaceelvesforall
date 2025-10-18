(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['Utils', 'Blocks'], factory);
    } else if (typeof module === 'object' && module.exports) {
        // Nodejs
        const Utils = require('../../../utils.js');
        const Blocks = require('./block.js');
        module.exports = factory(Utils, Blocks);
    } else {
        // Browser globals (root is window)
        root.Projectiles = factory(root.Utils, root.Blocks);
    }
}(typeof self !== 'undefined' ? self : this, function (Utils, Blocks) {
    /*
      :::::::::  :::::::::   ::::::::  ::::::::::: :::::::::: :::::::: ::::::::::: ::::::::::: :::        :::::::::: ::::::::
     :+:    :+: :+:    :+: :+:    :+:     :+:     :+:       :+:    :+:    :+:         :+:     :+:        :+:       :+:    :+:
    +:+    +:+ +:+    +:+ +:+    +:+     +:+     +:+       +:+           +:+         +:+     +:+        +:+       +:+
   +#++:++#+  +#++:++#:  +#+    +:+     +#+     +#++:++#  +#+           +#+         +#+     +#+        +#++:++#  +#++:++#++
  +#+        +#+    +#+ +#+    +#+     +#+     +#+       +#+           +#+         +#+     +#+        +#+              +#+
 #+#        #+#    #+# #+#    #+# #+# #+#     #+#       #+#    #+#    #+#         #+#     #+#        #+#       #+#    #+#
###        ###    ###  ########   #####      ########## ########     ###     ########### ########## ########## ########
*/
    class Bullet extends Blocks.Block {
        constructor(options) {
            super(options);
            this.spawnPos = new Utils.Vect3(0, 0, 0);
            delete this.spawnVol;
            this.radius = 5;
            this.height = 5;
            this.user = {};
            this.dying = true;
            this.livetime = 100;
            this.type = 'bullet';
            this.color = [255, 0, 0];
            this.colorSide = [255, 128, 0];
            if (typeof window !== 'undefined') this.touchSFX = new Audio('sfx/hit_01.wav');
            this.damage = 10;
            this.force = 0.15; // How much of this projectile's speed is applied to the target
            this.shadowDraw = true;
            this.cleanup = true; // Enable automatic cleanup when inactive
            this.hitSplash = () => {
                for (let parts = 0; parts < 10; parts++) {
                    let tempx = (Math.random() * 4) - 2;
                    let tempy = (Math.random() * 4) - 2;
                    let tempz = (Math.random() * 4) - 2;
                    let tempC = Math.ceil(Math.random() * 255);
                    game.match.map.debris.push(
                        new Blocks.Block({
                            spawnPos: new Utils.Vect3(this.HB.pos.x, this.HB.pos.y, this.HB.pos.z),
                            spawnVol: new Utils.Vect3(2, 1, 1),
                                speed: new Utils.Vect3(tempx, tempy, tempz),
                                color: [255, tempC, 0],
                                livetime: 20,
                                dying: true,
                                shadowDraw: false,
                                solid: false
                            }));
                }
            }
            this.runFunc = [
                // Create Debris
                () => {
                    let tempx = ((Math.random() * 1) - 0.5) * 2;
                    let tempy = ((Math.random() * 1) - 0.5) * 2;
                    let tempz = ((Math.random() * 1) - 0.5) * 2;
                    if (game.match.ticks % 4 == 0) game.match.map.debris.push(
                        new Blocks.Block({
                            spawnPos: new Utils.Vect3(this.HB.pos.x, this.HB.pos.y, this.HB.pos.z),
                            spawnVol: new Utils.Vect3(2, 2, 2),
                                speed: new Utils.Vect3(tempx, tempy, tempz),
                                color: [255, 255, 0],
                                livetime: 15,
                                dying: true,
                                shadowDraw: false,
                                solid: false
                            }));
                }
            ]
            if (typeof options === 'object')
                for (var key of Object.keys(options)) {
                    if (key == 'runFunc') {
                    }
                    else if (key == 'drawFunc') {
                    } else {
                        this[key] = options[key];
                    }
                }

            this.HB = Utils.generateHB(this);

        }

        step() {
            if (this.active && this.livetime != 0) {
                // Move bullets using speed (server-authoritative, no client prediction needed)
                this.HB.pos.x += this.speed.x * game.time.delta;
                this.HB.pos.y += this.speed.y * game.time.delta;
                this.HB.pos.z += this.speed.z * game.time.delta;
                
                // Optional: Gentle correction toward server position if available
                if (typeof window !== 'undefined' && this.serverPos && this.serverPos.pos) {
                    const dx = this.serverPos.pos.x - this.HB.pos.x;
                    const dy = this.serverPos.pos.y - this.HB.pos.y;
                    const dz = this.serverPos.pos.z - this.HB.pos.z;
                    const error = Math.sqrt(dx * dx + dy * dy + dz * dz);
                    
                    // Only correct if error is significant (bullets are fast, small errors OK)
                    if (error > 20) {
                        const correctionFactor = 0.3; // Gentle correction
                        this.HB.pos.x += dx * correctionFactor;
                        this.HB.pos.y += dy * correctionFactor;
                        this.HB.pos.z += dz * correctionFactor;
                    }
                }

                /*
                ___     _ _         _
                / __|  _| (_)_ _  __| |___ _ _
                | (_| || | | | ' \/ _` / -_) '_|
                \___\_, |_|_|_||_\__,_\___|_|
                |__/
                */
                for (let c of game.match.characters) {
                    if (c === this.user) //Don't collide with yourself
                        continue;
                    let side = this.HB.collide(c.HB); //Check for collision
                    if (side && c.solid && c.team !== this.user.team) {
                        //play hit2 sound
                        if (typeof window !== 'undefined') {
                            this.touchSFX.currentTime = 0;
                            if (!this.user.muted)
                                this.touchSFX.play().catch(err => {});
                        }
                        if (!c.invulnerable)
                            c.hp -= this.damage;
                        c.speed.x += this.speed.x * this.force;
                        c.speed.y += this.speed.y * this.force;
                        c.speed.z += this.speed.z * this.force;
                        c.trigger(this, side);
                        this.active = false;
                        this.hitSplash();
                        if (c === game.match.player) {
                            // if the c's parent has a camera, shake it
                            if (c.parent.camera) c.parent.camera.shakeTime = 10;
                            // if the c's controller has a rumble, rumble it
                            if (c.parent.controller.type == 'gamepad') c.parent.controller.rumble(100, 1.0, 1.0);
                            // if the c's controller is a touch controller, rumble it
                            if (c.parent.controller.type == 'touch' && c.parent.controller.canVibrate) navigator.vibrate(100);
                        }
                    }
                }

                /*
                ___ _         _
                | _ ) |___  __| |__ ___
                | _ \ / _ \/ _| / /(_-<
                |___/_\___/\__|_\_\/__/
                
                */
                for (const c of game.match.map.blocks) { //For each block
                    let side = this.HB.collide(c.HB); //Check for collision
                    if (c.solid && side) { //If the block is solid and you collided
                        switch (side) { //see which side you collided on
                            case 'front':
                                //Move the character to the edge of the block
                                this.HB.pos.y = c.HB.pos.y + c.HB.volume.y + this.HB.radius;
                                break;
                            case 'rear':
                                this.HB.pos.y = c.HB.pos.y - this.HB.radius;
                                break;
                            case 'right':
                                this.HB.pos.x = c.HB.pos.x + c.HB.volume.x + this.HB.radius;
                                break;
                            case 'left':
                                this.HB.pos.x = c.HB.pos.x - this.HB.radius;
                                break;
                            case 'top':
                                this.HB.pos.z = c.HB.pos.z + c.HB.volume.z;
                                break;
                            case 'bottom':
                                this.HB.pos.z = c.HB.pos.z - this.HB.height;
                                break;
                            default:
                                //break if you didn't collide
                                break;
                        }
                        //play hit sound
                        if (typeof window !== 'undefined') {
                            this.touchSFX.currentTime = 0;
                            if (!this.user.muted)
                                this.touchSFX.play().catch(err => {});
                        }
                        this.active = false;
                        c.trigger(this, side); //Trigger the block's trigger function
                        this.hitSplash();
                    }
                }

                for (const func of this.runFunc) {
                    func()
                }
                this.livetime--;
            } else if (this.livetime == 0) {
                this.active = false;
            }
        }

    }

    /*
    #####
    #     # #        ##    ####  #    #
     #       #       #  #  #      #    #
      #####  #      #    #  ####  ######
           # #      ######      # #    #
     #     # #      #    # #    # #    #
      #####  ###### #    #  ####  #    #

    */
    class Slash extends Bullet {
        constructor(options) {
            super(options);
            this.speed = new Utils.Vect3(this.user.aimX, this.user.aimY, 0);
            this.type = 'slash';
            this.color = this.user.color;
            this.damage = 10;
            this.livetime = 10;
            this.touchSFX = typeof window !== 'undefined' ? Sounds.hit_lance : null;
            this.opacity = 0;
            this.shadowDraw = false;
            this.force = 0.2
            if (typeof options === 'object')
                for (var key of Object.keys(options)) {
                    if (key == 'runFunc') {
                    }
                    else if (key == 'drawFunc') {
                    } else {
                        this[key] = options[key];
                    }
                }
            this.HB.radius = this.user.HB.radius + 10;
            this.HB = Utils.generateHB(this);

            this.drawFunc = [
                () => {
                    // Draw a line from the user to the bullet
                    ctx.beginPath();
                    ctx.strokeStyle = 'rgba(200,200,200,1)';
                    ctx.lineWidth = 5;
                    // find where the user is on the camera
                    let compareX = game.player.camera.x - this.user.HB.pos.x;
                    let compareY = game.player.camera.y - this.user.HB.pos.y;
                    ctx.moveTo(
                        game.window.w / 2 - compareX,
                        game.window.h / 2 - compareY - this.user.HB.pos.z - this.user.HB.height / 2
                    );
                    // find where the bullet is on the camera
                    let targetX = game.player.camera.x - this.HB.pos.x;
                    let targetY = game.player.camera.y - this.HB.pos.y;
                    // Compare the user and bullet to find angle
                    targetX = compareX - targetX;
                    targetY = compareY - targetY;
                    let distance = Math.sqrt((targetX ** 2) + (targetY ** 2));
                    targetX = (targetX / distance) * -60;
                    targetY = (targetY / distance) * -60;
                    // Draw line from user to target
                    ctx.lineTo(
                        game.window.w / 2 - compareX - targetX,
                        game.window.h / 2 - compareY - targetY - this.user.HB.pos.z - this.user.HB.height / 2
                    );
                    ctx.stroke();
                }
            ]

            this.hitSplash = () => {
                for (let parts = 0; parts < 20; parts++) {
                    let tempx = (Math.random() * 4) - 2;
                    let tempy = (Math.random() * 4) - 2;
                    let tempz = (Math.random() * 4) - 2;
                    let tempC = Math.ceil(Math.random() * 255);
                    game.match.map.debris.push(
                        new Blocks.Block({
                            spawnPos: new Utils.Vect3(this.HB.pos.x, this.HB.pos.y, this.HB.pos.z),
                            spawnVol: new Utils.Vect3(6, 3, 1),
                                speed: new Utils.Vect3(tempx + (this.speed.x * 0.25), tempy + (this.speed.y * 0.25), tempz + (this.speed.z * 0.25)),
                                color: [tempC, tempC, tempC],
                                livetime: 20,
                                dying: true,
                                shadowDraw: false,
                                solid: false
                            }));
                }
            }
        }

        step() {
            super.step();
            this.HB.pos.x = this.user.HB.pos.x + this.speed.x;
            this.HB.pos.y = this.user.HB.pos.y + this.speed.y;
            this.HB.pos.z = this.user.HB.pos.z + this.speed.z;

            // add a debris block to the map at the player's position with a random speed
            let tempx = ((Math.random() * 1) - 0.5) * 2;
            let tempy = ((Math.random() * 1) - 0.5) * 2;
            let tempz = ((Math.random() * 1) - 0.5) * 2;
            let tempC1 = Math.ceil(Math.random() * 255);
            let tempC2 = Math.ceil(Math.random() * 255);

            let compareX = this.HB.pos.x - ((this.user.HB.pos.x - this.HB.pos.x) / 2);
            let compareY = this.HB.pos.y - ((this.user.HB.pos.y - this.HB.pos.y) / 2);

            game.match.map.debris.push(
                new Blocks.Block({
                    spawnPos: new Utils.Vect3(compareX, compareY, this.HB.pos.z + this.HB.height),
                    spawnVol: new Utils.Vect3(2, 2, 2),
                        speed: new Utils.Vect3(tempx, tempy, tempz),
                        color: [tempC1, tempC1, tempC1],
                        colorSide: [tempC2, tempC2, tempC2],
                        livetime: 15,
                        dying: true,
                        shadowDraw: false,
                    solid: false
                    }));
        }
    }

    /*
     :::::::::  ::::::::::: :::::::::: :::        ::::::::::
     :+:    :+:     :+:     :+:        :+:        :+:
    +:+    +:+     +:+     +:+        +:+        +:+
   +#++:++#:      +#+     :#::+::#   +#+        +#++:++#
  +#+    +#+     +#+     +#+        +#+        +#+
 #+#    #+#     #+#     #+#        #+#        #+#
###    ### ########### ###        ########## ##########
    */
    class RifleBullet extends Bullet {
        constructor(options) {
            super(options);
            this.bulletType = 'rifle';
            
            // Add trail debris (client-side only)
            if (typeof window !== 'undefined') {
                this.runFunc.push(function () {
                    if (game.match.time.ticks % 2 == 0) { // Every other frame
                        let tempx = ((Math.random() * 1) - 0.5) * 2;
                        let tempy = ((Math.random() * 1) - 0.5) * 2;
                        let tempz = ((Math.random() * 1) - 0.5) * 2;
                        game.match.map.debris.push(
                            new Blocks.Block({
                                spawnPos: new Utils.Vect3(this.HB.pos.x, this.HB.pos.y, this.HB.pos.z),
                                spawnVol: new Utils.Vect3(4, 4, 4),
                                speed: new Utils.Vect3(tempx, tempy, tempz),
                                color: [220, 220, 200],
                                livetime: 15,
                                dying: true,
                                shadowDraw: false,
                                solid: false
                            }));
                    }
                }.bind(this));
                
                // Custom hit splash (client-side only)
                this.hitSplash = function () {
                    for (let parts = 0; parts < 20; parts++) {
                        let tempx = (Math.random() * 4) - 2;
                        let tempy = (Math.random() * 4) - 2;
                        let tempz = (Math.random() * 4) - 2;
                        let tempC = Math.ceil(Math.random() * 255);
                        game.match.map.debris.push(
                            new Blocks.Block({
                                spawnPos: new Utils.Vect3(this.HB.pos.x, this.HB.pos.y, this.HB.pos.z),
                                spawnVol: new Utils.Vect3(6, 3, 1),
                                speed: new Utils.Vect3(tempx + (this.speed.x * 0.25), tempy + (this.speed.y * 0.25), tempz + (this.speed.z * 0.25)),
                                color: [0, tempC, 255],
                                livetime: 20,
                                dying: true,
                                shadowDraw: false,
                                solid: false
                            }));
                    }
                }.bind(this);
            }
        }
    }

    /*
     :::            :::     ::::    :::  ::::::::  ::::::::::
    :+:          :+: :+:   :+:+:   :+: :+:    :+: :+:
   +:+         +:+   +:+  :+:+:+  +:+ +:+        +:+
  +#+        +#++:++#++: +#+ +:+ +#+ +#+        +#++:++#
 +#+        +#+     +#+ +#+  +#+#+# +#+        +#+
#+#        #+#     #+# #+#   #+#+# #+#    #+# #+#
########## ###     ### ###    ####  ########  ##########
    */
    class LanceBullet extends Bullet {
        constructor(options) {
            super(options);
            this.bulletType = 'lance';
            this.visible = false;
            
            // Make the lance wider (larger hitbox)
            if (this.user && this.user.HB) {
                this.HB.radius = this.user.HB.radius + 10;
            }
            
            // Lance follows the player and damage is based on speed
            this.runFunc.push(function () {
                const owner = this.parent || this.user;
                if (owner && owner.HB && owner.speed) {
                    // Match the user's position
                    this.HB.pos.x = owner.HB.pos.x;
                    this.HB.pos.y = owner.HB.pos.y;
                    this.HB.pos.z = owner.HB.pos.z;
                    // Damage is equal to the true speed of the player
                    this.damage = Math.sqrt(Math.abs(owner.speed.x) ** 2 + Math.abs(owner.speed.y) ** 2 + Math.abs(owner.speed.z) ** 2);
                    // Multiply damage
                    this.damage *= 2;
                }
                
                // Add trail debris (client-side only)
                if (typeof window !== 'undefined') {
                    // Create purple/pink trail debris
                    let tempx = ((Math.random() * 1) - 0.5) * 10;
                    let tempy = ((Math.random() * 1) - 0.5) * 10;
                    let tempz = ((Math.random() * 1) - 0.5) * 10;
                    let tempC1 = Math.ceil(Math.random() * 255);
                    let tempC2 = Math.ceil(Math.random() * 255);
                    game.match.map.debris.push(
                        new Blocks.Block({
                            spawnPos: new Utils.Vect3(this.HB.pos.x, this.HB.pos.y, this.HB.pos.z),
                            spawnVol: new Utils.Vect3(4, 4, 4),
                            speed: new Utils.Vect3(tempx, tempy, tempz),
                            color: [tempC1, 0, tempC2],
                            colorSide: [tempC2, 0, tempC1],
                            livetime: 15,
                            dying: true,
                            shadowDraw: false,
                            solid: false
                        }));
                }
            }.bind(this));
            
            // Custom hit splash (client-side only)
            if (typeof window !== 'undefined') {
                this.hitSplash = function () {
                    for (let parts = 0; parts < 20; parts++) {
                        let tempx = (Math.random() * 4) - 2;
                        let tempy = (Math.random() * 4) - 2;
                        let tempz = (Math.random() * 4) - 2;
                        let tempC = Math.ceil(Math.random() * 255);
                        game.match.map.debris.push(
                            new Blocks.Block({
                                spawnPos: new Utils.Vect3(this.HB.pos.x, this.HB.pos.y, this.HB.pos.z),
                                spawnVol: new Utils.Vect3(6, 3, 1),
                                speed: new Utils.Vect3(tempx + (this.speed.x * 0.25), tempy + (this.speed.y * 0.25), tempz + (this.speed.z * 0.25)),
                                color: [255, tempC, 0],
                                livetime: 20,
                                dying: true,
                                shadowDraw: false,
                                solid: false
                            }));
                    }
                }.bind(this);
            }
        }
    }

    return { Bullet, Slash, RifleBullet, LanceBullet };
}));