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
    let sharedBulletHitSfx = null;
    if (typeof window !== 'undefined') {
        sharedBulletHitSfx = new Audio('sfx/hit_01.wav');
    }
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
            if (typeof window !== 'undefined') this.touchSFX = sharedBulletHitSfx;
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
                const nearbyCharacters = (game.match.map && typeof game.match.map.getNearbyCharacters === 'function')
                    ? game.match.map.getNearbyCharacters(this.HB, this.user)
                    : game.match.characters;
                for (let c of nearbyCharacters) {
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
                const nearbyBlocks = (game.match.map && typeof game.match.map.getNearbyBlocks === 'function')
                    ? game.match.map.getNearbyBlocks(this.HB)
                    : game.match.map.blocks;
                for (const c of nearbyBlocks) { //For each block
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
            this.type = 'slash';
            this.damage = 10;
            this.livetime = 10;
            this.touchSFX = typeof window !== 'undefined' ? Sounds.hit_lance : null;
            this.opacity = 0; // Make bullet visible
            this.shadowDraw = true; // Enable shadow
            this.force = 0.2;
            // Default sword colors (gray/silver)
            this.color = [200, 200, 200];
            this.colorSide = [150, 150, 150];
            
            if (typeof options === 'object')
                for (var key of Object.keys(options)) {
                    if (key == 'runFunc') {
                    }
                    else if (key == 'drawFunc') {
                    } else {
                        this[key] = options[key];
                    }
                }
            
            // Set defaults if not provided (for client-side spawning from server data)
            if (!this.speed) {
                this.speed = new Utils.Vect3(0, 0, 0);
            }
            if (this.user && this.user.color) {
                this.color = this.user.color;
            }
            
            // Set radius and height BEFORE generating HB
            if (this.user && this.user.HB && this.user.HB.radius) {
                this.radius = this.user.HB.radius + 10;
            } else {
                this.radius = 20; // Default radius
            }
            this.height = 8; // Set height for cylinder drawing
            this.HB = Utils.generateHB(this);

            // Add silver sword line to draw functions (in addition to default bullet rendering)
            this.drawFunc.push(() => {
                // Safety check: ensure user and required properties exist
                if (!this.user || !this.user.HB || !this.user.HB.pos) {
                    return;
                }
                
                // Draw a line from the user extending forward in the sword's fixed direction
                ctx.beginPath();
                ctx.strokeStyle = 'rgba(200, 200, 200, 1)'; // Silver sword
                ctx.lineWidth = 5;
                
                // Find where the user is on the camera
                let compareX = game.player.camera.x - this.user.HB.pos.x;
                let compareY = game.player.camera.y - this.user.HB.pos.y;
                
                // Start point at user's position
                ctx.moveTo(
                    game.window.w / 2 - compareX,
                    game.window.h / 2 - compareY - this.user.HB.pos.z - this.user.HB.height / 2
                );
                
                // Use the fixed sword direction (from this.speed) to calculate end point
                // Normalize the speed vector to get direction
                let swordDistance = Math.sqrt(this.speed.x ** 2 + this.speed.y ** 2);
                let swordLength = 60; // Sword visual length
                
                if (swordDistance > 0) {
                    let dirX = (this.speed.x / swordDistance) * swordLength;
                    let dirY = (this.speed.y / swordDistance) * swordLength;
                    
                    // Draw line extending in the sword's fixed direction
                    ctx.lineTo(
                        game.window.w / 2 - compareX + dirX,
                        game.window.h / 2 - compareY + dirY - this.user.HB.pos.z - this.user.HB.height / 2
                    );
                }
                
                ctx.stroke();
            });

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
            // Position stays relative to user (follows player like lance)
            if (this.user && this.user.HB) {
                this.HB.pos.x = this.user.HB.pos.x + this.speed.x;
                this.HB.pos.y = this.user.HB.pos.y + this.speed.y;
                this.HB.pos.z = this.user.HB.pos.z + this.speed.z;
            }

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
       ::::::::  :::            :::      ::::::::  :::    :::
      :+:    :+: :+:          :+: :+:   :+:    :+: :+:    :+:
     +:+        +:+         +:+   +:+  +:+        +:+    +:+
    +#++:++#++ +#+        +#++:++#++: +#++:++#++ +#++:++#++
          +#+ +#+        +#+     +#+        +#+ +#+    +#+
   #+#    #+# #+#        #+#     #+# #+#    #+# #+#    #+#
    ########  ########## ###     ###  ########  ###    ###
    */
    class LanceSlash extends Bullet {
        constructor(options) {
            super(options);
            this.type = 'lanceSlash';
            this.baseDamage = 10; // Base damage
            this.damage = this.baseDamage;
            this.livetime = 30;
            this.touchSFX = typeof window !== 'undefined' ? Sounds.hit_lance : null;
            this.opacity = 0; // Make bullet invisible (hitbox only visible in debug mode)
            this.shadowDraw = false; // Disable shadow
            this.force = 1.0;
            // Keep default bullet colors (orange/red)
            this.color = [255, 100, 0];
            this.colorSide = [255, 50, 0];
            
            if (typeof options === 'object')
                for (var key of Object.keys(options)) {
                    if (key == 'runFunc') {
                    }
                    else if (key == 'drawFunc') {
                    } else {
                        this[key] = options[key];
                    }
                }
            
            // Set defaults if not provided (for client-side spawning from server data)
            if (!this.speed) {
                this.speed = new Utils.Vect3(0, 0, 0);
            }
            if (this.user && this.user.color) {
                this.color = this.user.color;
            }
            
            // Set radius and height BEFORE generating HB
            // Use the radius from options if provided (server spawning sets it to 40 for lance length)
            // Otherwise use default for client-side spawning from server data
            if (!this.radius) {
                if (this.user && this.user.HB && this.user.HB.radius) {
                    this.radius = this.user.HB.radius + 25;
                } else {
                    this.radius = 35; // Default radius
                }
            }
            if (!this.height) {
                this.height = 10; // Set height for cylinder drawing
            }
            this.HB = Utils.generateHB(this);

            // Add debris generation to runFunc (like original LanceBullet)
            this.runFunc.push(function () {
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

            // Add purple/pink lance line to draw functions (in addition to default bullet rendering)
            this.drawFunc.push(() => {
                // Safety check: ensure user and required properties exist
                if (!this.user || !this.user.HB || !this.user.HB.pos) {
                    return;
                }
                
                // Draw a line from the user extending forward in the lance's fixed direction
                ctx.beginPath();
                ctx.strokeStyle = 'rgba(255, 0, 255, 0.8)'; // Purple/magenta lance
                ctx.lineWidth = 6;
                
                // Find where the user is on the camera
                let compareX = game.player.camera.x - this.user.HB.pos.x;
                let compareY = game.player.camera.y - this.user.HB.pos.y;
                
                // Start point at user's position
                ctx.moveTo(
                    game.window.w / 2 - compareX,
                    game.window.h / 2 - compareY - this.user.HB.pos.z - this.user.HB.height / 2
                );
                
                // Use the fixed lance direction (from this.speed) to calculate end point
                // Normalize the speed vector to get direction
                let lanceDistance = Math.sqrt(this.speed.x ** 2 + this.speed.y ** 2);
                let lanceLength = 80; // Lance visual length
                
                if (lanceDistance > 0) {
                    let dirX = (this.speed.x / lanceDistance) * lanceLength;
                    let dirY = (this.speed.y / lanceDistance) * lanceLength;
                    
                    // Draw line extending in the lance's fixed direction
                    ctx.lineTo(
                        game.window.w / 2 - compareX + dirX,
                        game.window.h / 2 - compareY + dirY - this.user.HB.pos.z - this.user.HB.height / 2
                    );
                }
                
                ctx.stroke();
                
                // Debug: Draw hitbox cylinder
                if (game.debug) {
                    // Find where the hitbox center is on the camera
                    let hbCompareX = game.player.camera.x - this.HB.pos.x;
                    let hbCompareY = game.player.camera.y - this.HB.pos.y;
                    
                    // Draw hitbox circle at midpoint of z height
                    ctx.beginPath();
                    ctx.strokeStyle = 'rgba(255, 255, 0, 0.7)'; // Yellow
                    ctx.fillStyle = 'rgba(255, 255, 0, 0.1)'; // Semi-transparent yellow fill
                    ctx.lineWidth = 2;
                    ctx.arc(
                        game.window.w / 2 - hbCompareX,
                        game.window.h / 2 - hbCompareY - this.HB.pos.z - this.HB.height / 2,
                        this.HB.radius,
                        0,
                        Math.PI * 2
                    );
                    ctx.fill();
                    ctx.stroke();
                    
                    // Draw center point at midpoint of z height
                    ctx.fillStyle = 'rgba(255, 0, 0, 0.8)'; // Red center dot
                    ctx.beginPath();
                    ctx.arc(
                        game.window.w / 2 - hbCompareX,
                        game.window.h / 2 - hbCompareY - this.HB.pos.z - this.HB.height / 2,
                        3,
                        0,
                        Math.PI * 2
                    );
                    ctx.fill();
                }
            });

            // Hit splash - purple/pink debris
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
                            color: [255, tempC, 0], // Orange/yellow hit
                            livetime: 20,
                            dying: true,
                            shadowDraw: false,
                            solid: false
                        }));
                }
            }
        }

        step() {
            // Don't call super.step() - we need custom collision handling
            if (this.active && this.livetime != 0) {
                const owner = this.parent || this.user;
                
                // Position stays relative to user
                if (owner && owner.HB) {
                    this.HB.pos.x = owner.HB.pos.x + this.speed.x;
                    this.HB.pos.y = owner.HB.pos.y + this.speed.y;
                    this.HB.pos.z = owner.HB.pos.z + this.speed.z;
                }
                
                // Get normalized lance direction for damage calculations
                let lanceDistance = Math.sqrt(this.speed.x ** 2 + this.speed.y ** 2);
                let lanceNormX = lanceDistance > 0 ? this.speed.x / lanceDistance : 0;
                let lanceNormY = lanceDistance > 0 ? this.speed.y / lanceDistance : 0;
                
                /*
                ___     _ _         _
                / __|  _| (_)_ _  __| |___ _ _
                | (_| || | | | ' \/ _` / -_) '_|
                \___\_, |_|_|_||_\__,_\___|_|
                |__/
                */
                const nearbyCharacters = (game.match.map && typeof game.match.map.getNearbyCharacters === 'function')
                    ? game.match.map.getNearbyCharacters(this.HB, this.user)
                    : game.match.characters;
                for (let c of nearbyCharacters) {
                    if (c === this.user) //Don't collide with yourself
                        continue;
                    let side = this.HB.collide(c.HB); //Check for collision
                    if (side && c.solid && c.team !== this.user.team) {
                        // Calculate speed damage at time of collision
                        let speedMagnitude = owner && owner.speed ? 
                            Math.sqrt(owner.speed.x ** 2 + owner.speed.y ** 2) : 0;
                        let speedDamage = speedMagnitude * 1;
                        
                        // Calculate angle between lance direction and user-to-target direction
                        let targetDirX = c.HB.pos.x - (owner ? owner.HB.pos.x : this.user.HB.pos.x);
                        let targetDirY = c.HB.pos.y - (owner ? owner.HB.pos.y : this.user.HB.pos.y);
                        let targetDistance = Math.sqrt(targetDirX ** 2 + targetDirY ** 2);
                        
                        if (targetDistance > 0) {
                            // Normalize target direction
                            let targetNormX = targetDirX / targetDistance;
                            let targetNormY = targetDirY / targetDistance;
                            
                            // Calculate dot product (cosine of angle)
                            let dotProduct = (lanceNormX * targetNormX) + (lanceNormY * targetNormY);
                            
                            // Clamp to [-1, 1] range
                            dotProduct = Math.max(-1, Math.min(1, dotProduct));
                            
                            // Convert to angle in radians, then degrees
                            let angleRadians = Math.acos(dotProduct);
                            let angleDegrees = angleRadians * (180 / Math.PI);
                            
                            // Linear damage reduction: 0° = 100%, 90° = 0%
                            // Formula: 1 - (angle / 90)
                            let angleMultiplier = Math.max(0, 1 - (angleDegrees / 90));
                            
                            // Final damage = base + (speed * angle alignment)
                            this.damage = this.baseDamage + (speedDamage * angleMultiplier);
                            
                            // Server-side logging
                            if (typeof window === 'undefined') {
                                console.log(`[Lance Hit] Target: ${c.id.substring(0, 4)} | Angle: ${angleDegrees.toFixed(1)}° | Multiplier: ${(angleMultiplier * 100).toFixed(1)}% | Speed: ${speedMagnitude.toFixed(1)} | Damage: ${this.damage.toFixed(1)}`);
                            }
                        } else {
                            // Target is at same position, full damage
                            this.damage = this.baseDamage + speedDamage;
                            
                            // Server-side logging
                            if (typeof window === 'undefined') {
                                console.log(`[Lance Hit] Target: ${c.id.substring(0, 4)} | Angle: 0.0° (center) | Multiplier: 100.0% | Speed: ${speedMagnitude.toFixed(1)} | Damage: ${this.damage.toFixed(1)}`);
                            }
                        }
                        
                        //play hit sound
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
                const nearbyBlocks = (game.match.map && typeof game.match.map.getNearbyBlocks === 'function')
                    ? game.match.map.getNearbyBlocks(this.HB)
                    : game.match.map.blocks;
                for (const c of nearbyBlocks) { //For each block
                    let side = this.HB.collide(c.HB); //Check for collision
                    if (c.solid && side) { //If the block is solid and you collided
                        this.active = false;
                        this.hitSplash();
                    }
                }

                // Run custom functions
                for (let i = 0; i < this.runFunc.length; i++) {
                    this.runFunc[i]();
                }

                // Countdown livetime
                this.livetime--;
                if (this.livetime <= 0) {
                    this.active = false;
                }
            }
        }
    }

    return { Bullet, Slash, RifleBullet, LanceSlash };
}));