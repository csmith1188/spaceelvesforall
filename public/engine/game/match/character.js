(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['Utils', 'Items', 'Powerups'], factory);
    } else if (typeof module === 'object' && module.exports) {
        // Nodejs
        const Utils = require('../../utils.js');
        const Items = require('./item.js');
        const Powerups = require('./block/powerup.js');
        module.exports = factory(Utils, Items, Powerups);
    } else {
        // Browser globals (root is window)
        root.Characters = factory(root.Utils, root.Items, root.Powerups);
    }
}(typeof self !== 'undefined' ? self : this, function (Utils, Items, Powerups) {

    /*
          ::::::::  :::    :::     :::     :::::::::      :::      :::::::: ::::::::::: :::::::::: :::::::::
        :+:    :+: :+:    :+:   :+: :+:   :+:    :+:   :+: :+:   :+:    :+:    :+:     :+:        :+:    :+:
       +:+        +:+    +:+  +:+   +:+  +:+    +:+  +:+   +:+  +:+           +:+     +:+        +:+    +:+
      +#+        +#++:++#++ +#++:++#++: +#++:++#:  +#++:++#++: +#+           +#+     +#++:++#   +#++:++#:
     +#+        +#+    +#+ +#+     +#+ +#+    +#+ +#+     +#+ +#+           +#+     +#+        +#+    +#+
    #+#    #+# #+#    #+# #+#     #+# #+#    #+# #+#     #+# #+#    #+#    #+#     #+#        #+#    #+#
    ########  ###    ### ###     ### ###    ### ###     ###  ########     ###     ########## ###    ###
    */
    class Character {
        constructor(options) {
            this.id = Utils.uuidGen(4);
            this.spawnPos = new Utils.Vect3(0, 0, 0);
            this.radius = 8;
            this.height = 32;
            this.name = '';
            this.parent = {};
            this.active = true;
            this.visible = true;
            this.cleanup = true;
            this.team = 0;
            this.teams = [this.team];
            this.target = null;
            this.type = 'character';

            /*
              ___        _ _   _            ___       _
             | _ \___ __(_) |_(_)___ _ _   |   \ __ _| |_ __ _
             |  _/ _ (_-< |  _| / _ \ ' \  | |) / _` |  _/ _` |
             |_| \___/__/_|\__|_\___/_||_| |___/\__,_|\__\__,_|
    
            */
            this.aim = new Utils.Vect3(0, 0, 0);
            this.angle = new Utils.Vect3(0, 0, 0);
            this.floor = 0;
            this.bouyancy = 1;
            this.hover = 0; // 12
            this.serverPos = new Utils.Vect3(0, 0, 0);
            this.zMod = () => {
                return 0;
            }

            /*
              ___ _           _
             | _ \ |_ _  _ __(_)__ ___
             |  _/ ' \ || (_-< / _(_-<
             |_| |_||_\_, /__/_\__/__/
                      |__/
            */
            this.speed = new Utils.Vect3(0, 0, 0);            // Represents the current speed of the character in the x, y, and z directions.
            this.maxSpeed = new Utils.Vect3(8, 8, 12);        // Represents the maximum speed of the character in the x, y, and z directions.
            this.mom = new Utils.Vect3(0, 0, 0);              // Represents the momentum of the character in the x, y, and z directions.
            this.accel = new Utils.Vect3(0.15, 0.15, 1);      // Represents the acceleration of the character in the x, y, and z directions.
            this.airAccel = new Utils.Vect3(0.08, 0.08, 1);   // Represents the air acceleration of the character in the x, y, and z directions.
            this.brace = 0;                             // Represents the amount of "bracing" the character is doing. 0 = no "bracing", 1 = full "bracing".
            this.solid = true;                          // Represents whether or not the character is solid.   
            this.colliders = [];                        // Represents an array of colliders associated with the character.

            /*
              ___ _        _
             / __| |_ __ _| |_ ___
             \__ \  _/ _` |  _(_-<
             |___/\__\__,_|\__/__/
    
            */
            this.hp = 100;          // Health Points
            this.hp_max = 100;      // Max Health Points
            this.accuracy = 0.1;    // Spread magnitude of weapon
            this.pp = 100;          // Power Points
            this.pp_max = 100;      // Max Power Points
            this.invulnerable = false;  // Can't take damage

            /*
              ___ _
             |_ _| |_ ___ _ __  ___
              | ||  _/ -_) '  \(_-<
             |___|\__\___|_|_|_/__/
    
            */
            this.item = 0;
            // this.inventory = [];
            // this.inventory = [new Items.Sword()];
            this.inventory = [new Items.Pistol()];
            this.inventory[0].owner = this.parent;
            this.ammo = {
                plasma: 1,
                plasmaMax: 5,
                ballistic: 1,
                ballisticMax: 5
            }

            /*
               ___               _    _
              / __|_ _ __ _ _ __| |_ (_)__ ___
             | (_ | '_/ _` | '_ \ ' \| / _(_-<
              \___|_| \__,_| .__/_||_|_\__/__/
                           |_|
            */
            if (typeof window !== 'undefined') {
                this.img = new Image();
                this.shadow = new Image();
                this.shadow.src = 'img/sprites/shadow.png';
                this.deathSFX = Sounds.death;
            }
            this.gfx = 'img/sprites/lilguy';
            this.color = [255, 0, 0];
            this.faceCamera = true;
            this.shadowDraw = true;
            this.muted = false;

            this.runFunc = [];

            /*
                ___       _   _
               / _ \ _ __| |_(_)___ _ _  ___
              | (_) | '_ \  _| / _ \ ' \(_-<
               \___/| .__/\__|_\___/_||_/__/
                    |_|
            */
            if (typeof options === 'object')
                for (var key of Object.keys(options)) {
                    this[key] = options[key];
                }

            // Hitbox must be built after options are applied
            this.HB = Utils.generateHB(this);
            this.lastHB = this.HB;
            this.leftgfx = this.gfx + '_l'; // Set this after options so you only have to set gfx
            if (typeof window !== 'undefined') {
                this.img.src = this.gfx + '.png'
            }

            // this.parent = game.players.find(player => player.token.id === this.parent.token.id);

        }

        /*
              :::::::: ::::::::::: :::::::::: :::::::::
            :+:    :+:    :+:     :+:        :+:    :+:
           +:+           +:+     +:+        +:+    +:+
          +#++:++#++    +#+     +#++:++#   +#++:++#+
                +#+    +#+     +#+        +#+
        #+#    #+#    #+#     #+#        #+#
        ########     ###     ########## ###
        */

        spawnWeapon(item) {
            let newItem = null;
            switch (item.weapon) {
                case 'pistol':
                    newItem = new Items.Pistol(item);
                    break;
                case 'rifle':
                    newItem = new Items.Rifle(item);
                    break;
                case 'lance':
                    newItem = new Items.Lance(item);
                    break;
                case 'flamer':
                    newItem = new Items.Flamer(item);
                    break;
                case 'sword':
                    newItem = new Items.Sword(item);
                    break;
                default:
                    // Default to pistol if unknown weapon type
                    newItem = new Items.Pistol(item);
                    break;
            }
            if (newItem) {
                newItem.owner = this;
            }
            return newItem;
        }

        step() {
            if (this.active) {
                // ALL PLAYERS (local and remote) run full physics simulation
                // Then blend toward server position based on prediction error
                if (this.pp < this.pp_max)
                    this.pp += 1;
                this.floor = 0;

                //Reset Momentum
                this.mom = new Utils.Vect3();

                /*
                         _ _        _     _                _
                  __ ___| | |___ __| |_  (_)_ _  _ __ _  _| |_
                 / _/ _ \ | / -_) _|  _| | | ' \| '_ \ || |  _|
                 \__\___/_|_\___\__|\__| |_|_||_| .__/\_,_|\__|
                                                |_|
                */

                if (this.parent.controller) {
                    // If the player is pressing the start button
                    if (this.parent.controller.buttons.start.current != this.parent.controller.buttons.start.last && this.parent.controller.buttons.start.current)
                        game.paused = !game.paused;

                    if (this.parent.controller.buttons.moveLeft.current) this.mom.x = -1;
                    if (this.parent.controller.buttons.moveRight.current) this.mom.x = 1;
                    if (this.parent.controller.buttons.moveUp.current) this.mom.y = -1;
                    if (this.parent.controller.buttons.moveDown.current) this.mom.y = 1;
                    if (this.parent.controller.buttons.jump.current && this.parent.controller.buttons.brake.current) {
                        this.brace = 1;
                    }
                    else {
                        if (this.parent.controller.buttons.jump.current) {
                            // If the player has positive power points (pp)
                            if (this.pp > 2) {
                                // Sounds.upBoost.currentTime = 0;
                                // if (!this.muted && typeof window !== 'undefined') Sounds.upBoost.play().catch(err => {});
                                // Set the z momentum to 1 (move upwards)
                                this.mom.z = 1;
                                // Decrease the power points by 1
                                this.pp -= 2;
                            }
                        }
                        if (this.parent.controller.buttons.brake.current) this.mom.z = -1;

                    }
                    // if the boost button current is not equal to the boost button last
                    // and the boost current is 1
                    if (this.parent.controller.buttons.boost.current != this.parent.controller.buttons.boost.last && this.parent.controller.buttons.boost.current) {
                        // if the player has positive power points (pp)
                        if (this.pp > 60) {
                            this.pp -= 60;
                            if (typeof window !== 'undefined') {
                                Sounds.boost.currentTime = 0;
                                if (!this.muted) Sounds.boost.play().catch(err => {});
                            }
                            this.speed.x += this.mom.x * 8;
                            this.speed.y += this.mom.y * 8;
                            this.speed.z += this.mom.z * 8;
                        }
                    }
                    /*
                         _             _   _
                      __| |_  ___  ___| |_(_)_ _  __ _
                     (_-< ' \/ _ \/ _ \  _| | ' \/ _` |
                     /__/_||_\___/\___/\__|_|_||_\__, |
                                                 |___/
                    */
                    if (this.parent.controller.buttons.fire.current != this.parent.controller.buttons.fire.last) {
                        if (this.inventory.length) {
                            if (this.parent.controller.buttons.fire.current) {
                                // const xMulti = (game.player.camera._3D) ? game.player.camera.angle : 1;
                                const xMulti = 1;
                                let aimX = this.parent.controller.aimX * xMulti;
                                let aimY = this.parent.controller.aimY;
                                let aimZ = 0;
                                // if (game.player.camera._3D) {
                                //     aimZ = aimY * game.player.camera.angle;
                                //     aimY = aimY * (1 - game.player.camera.angle);
                                // }
                                this.inventory[this.item].use(this, aimX, aimY, aimZ, 0, { color: this.color });
                            }
                        }
                    }

                    /*
                      ___                 _                  __  __                                       _
                     |_ _|_ ___ _____ _ _| |_ ___ _ _ _  _  |  \/  |__ _ _ _  __ _ __ _ ___ _ __  ___ _ _| |_
                      | || ' \ V / -_) ' \  _/ _ \ '_| || | | |\/| / _` | ' \/ _` / _` / -_) '  \/ -_) ' \  _|
                     |___|_||_\_/\___|_||_\__\___/_|  \_, | |_|  |_\__,_|_||_\__,_\__, \___|_|_|_\___|_||_\__|
                                                      |__/                        |___/
                    */
                    // Weapon switching
                    if (this.parent.controller.buttons.inventory1.current != this.parent.controller.buttons.inventory1.last)
                        if (this.parent.controller.buttons.inventory1.current)
                            if (this.inventory.length > 0) {
                                this.item = 0;
                                if (this.parent.interface)
                                    this.parent.interface.itemChangeTicks = game.match.ticks + 180;
                            }

                    if (this.parent.controller.buttons.inventory2.current != this.parent.controller.buttons.inventory2.last)
                        if (this.parent.controller.buttons.inventory2.current)
                            if (this.inventory.length > 1) {
                                this.item = 1;
                                if (this.parent.interface)
                                    this.parent.interface.itemChangeTicks = game.match.ticks + 180;
                            }

                    if (this.parent.controller.buttons.throw.current != this.parent.controller.buttons.throw.last) {
                        if (this.parent.controller.buttons.throw.current) {
                            if (this.inventory.length > 0) {
                                if (typeof window == 'undefined') {
                                    // make a pickup
                                    game.match.map.blocks.push(new Powerups.WeaponPickup(
                                        {
                                            spawnPos: new Utils.Vect3(this.HB.pos.x, this.HB.pos.y, this.HB.pos.z + this.HB.height / 2),
                                            speed: new Utils.Vect3(this.speed.x, this.speed.y, this.speed.z + 20),
                                            weapon: this.inventory[this.item].weapon, ammo: this.inventory[this.item].ammo, livetime: game.match.despawnTimer, dying: true
                                        }));
                                }
                                // remove the item from the inventory
                                this.inventory.splice(this.item, 1)[0];
                                // while the length of the inventory is less than  the item slot plus one, reduce the item slot by one
                                while (this.inventory.length <= this.item && this.item > 0) {
                                    this.item--;
                                }
                                if (this.parent.interface)
                                    this.parent.interface.itemChangeTicks = game.match.ticks + 180;
                            }
                        }
                    }
                }

                // for every item in the inventory, run its step method
                for (let i = 0; i < this.inventory.length; i++) {
                    this.inventory[i].step('player');
                }

                /*
                  __  __            ___                  _
                 |  \/  |__ ___ __ / __|_ __  ___ ___ __| |
                 | |\/| / _` \ \ / \__ \ '_ \/ -_) -_) _` |
                 |_|  |_\__,_/_\_\ |___/ .__/\___\___\__,_|
                                       |_|
                */
                if (Math.abs(this.speed.x) > this.maxSpeed) this.mom.x = 0;
                if (Math.abs(this.speed.y) > this.maxSpeed) this.mom.y = 0;

                /*
                  ___    _    _   _                         _     _             _              _   _
                 | __| _(_)__| |_(_)___ _ _    __ _ _ _  __| |   /_\  __ __ ___| |___ _ _ __ _| |_(_)___ _ _
                 | _| '_| / _|  _| / _ \ ' \  / _` | ' \/ _` |  / _ \/ _/ _/ -_) / -_) '_/ _` |  _| / _ \ ' \
                 |_||_| |_\__|\__|_\___/_||_| \__,_|_||_\__,_| /_/ \_\__\__\___|_\___|_| \__,_|\__|_\___/_||_|
    
                */
                // CHANGE THIS BACK TO GAME.MATCH.MAP.FLOOR INSTEAD OF THIS.FLOOR
                if (this.HB.pos.z <= this.floor) { //Ground
                    //Accelerate Ground
                    this.speed.x += this.mom.x * this.accel.x;
                    this.speed.y += this.mom.y * this.accel.y;
                    this.speed.z += this.mom.z * this.accel.z;
                    // Friction Ground
                    this.speed.x *= 1 - game.match.map.friction.ground;
                    this.speed.y *= 1 - game.match.map.friction.ground;
                } else { //Air
                    //Accelerate Air
                    this.speed.x += this.mom.x * this.airAccel.x;
                    this.speed.y += this.mom.y * this.airAccel.y;
                    this.speed.z += this.mom.z * this.airAccel.z;
                    //Friction Air
                    this.speed.x *= 1 - game.match.map.friction.air;
                    this.speed.y *= 1 - game.match.map.friction.air;
                }
                this.speed.z *= 1 - game.match.map.friction.air; //Air friction always applies to falling/rising

                /*
                     _
                  __| |_ ___ _ __
                 (_-<  _/ _ \ '_ \
                 /__/\__\___/ .__/
                            |_|
                */
                if (Math.abs(this.speed.x) < game.match.map.stopZone) this.speed.x = 0; //Stop if you are below the stop speed
                if (Math.abs(this.speed.y) < game.match.map.stopZone) this.speed.y = 0;
                // if (Math.abs(this.speed.z) < game.match.map.stopZone) this.speed.z = 0; //I don't know if this one makes a difference

                /*
                                    _ _
                  __ _ _ _ __ ___ _(_) |_ _  _
                 / _` | '_/ _` \ V / |  _| || |
                 \__, |_| \__,_|\_/|_|\__|\_, |
                 |___/                    |__/
                */
                this.speed.z -= game.match.map.gravity;


                /*
                  #####
                 #     #  ####  #      #      #  ####  #  ####  #    #
                 #       #    # #      #      # #      # #    # ##   #
                 #       #    # #      #      #  ####  # #    # # #  #
                 #       #    # #      #      #      # # #    # #  # #
                 #     # #    # #      #      # #    # # #    # #   ##
                  #####   ####  ###### ###### #  ####  #  ####  #    #
    
                */
                /*
                   ___     _ _         _
                  / __|  _| (_)_ _  __| |___ _ _
                 | (_| || | | | ' \/ _` / -_) '_|
                  \___\_, |_|_|_||_\__,_\___|_|
                      |__/
                */
                for (let c of game.match.characters) {
                    if (c === this) //Don't collide with yourself
                        continue;
                    c = c; //Get the character from the bot
                    if (this.HB.above(c.HB) && c.solid) //If you are above the block and the block is not solid
                        this.floor = c.HB.pos.z + c.HB.height; //Set the floor to the block's height
                    let side = this.HB.collide(c.HB); //Check for collision
                    if (side) c.trigger(this, side);
                    if (c.solid && this.team != c.team) { //If the other character is solid
                        // On client side, check if this is a remote player
                        const isRemotePlayer = typeof window !== 'undefined' && this.parent && game.player && this.parent !== game.player;
                        
                        // Mark collision time for reconciliation
                        if (side) {
                            this.lastCollisionTime = game.match.ticks;
                        }
                        
                        switch (side) { //See which side you collided on
                            case 'side': //If you collided on the side
                                let xDistance = this.HB.pos.x - c.HB.pos.x;
                                let yDistance = this.HB.pos.y - c.HB.pos.y;
                                //get the distance between the two characters
                                let distance = Math.sqrt(xDistance ** 2 + yDistance ** 2);
                                if (distance > 0) {
                                    //find the x and y angles between the two characters, normalized to 1
                                    let xAngle = xDistance / distance;
                                    let yAngle = yDistance / distance;
                                    //move the character to the edge of the other character
                                    this.HB.pos.x = c.HB.pos.x + (c.HB.radius + this.HB.radius) * xAngle;
                                    this.HB.pos.y = c.HB.pos.y + (c.HB.radius + this.HB.radius) * yAngle;
                                } else {
                                    this.HB.pos.x += c.HB.radius + this.HB.radius;
                                }
                                
                                // HYBRID PHYSICS: On client, only modify THIS character's speed
                                // Don't modify other character's speed - let server/their client handle it
                                if (isRemotePlayer) {
                                    // Remote players on client: only bounce off, don't transfer momentum to others
                                    this.speed.x += c.speed.x * game.match.map.collideReflect * 0.5;
                                    this.speed.y += c.speed.y * game.match.map.collideReflect * 0.5;
                                } else {
                                    // Server or local player: full physics with momentum transfer
                                    const thisSpeedX = this.speed.x;
                                    const thisSpeedY = this.speed.y;
                                    this.speed.x += c.speed.x * game.match.map.collideReflect;
                                    this.speed.y += c.speed.y * game.match.map.collideReflect;
                                    
                                    // Only modify other character if on server or if it's the local player hitting a bot
                                    if (typeof window === 'undefined' || (c.parent && c.parent === game.player)) {
                                        c.speed.x -= thisSpeedX * game.match.map.collideReflect;
                                        c.speed.y -= thisSpeedY * game.match.map.collideReflect;
                                    }
                                }
                                break;
                            case 'top': //If you collided on the top
                                //move the character to the edge of the other character
                                this.HB.pos.z = c.HB.pos.z + c.HB.height;
                                break;
                            case 'bottom': //If you collided on the bottom
                                //move the character to the edge of the other character
                                this.HB.pos.z = c.HB.pos.z - this.HB.height;
                                break;
                            case 'center': //If you collided on the center
                                this.HB.pos.x += c.HB.radius + this.HB.radius;
                                break;
                            default:
                                //break if you didn't collide
                                break;
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
                    if (this.HB.above(c.HB) && c.solid) { //If you are above the block and the block is not solid
                        this.floor = c.HB.pos.z + c.HB.volume.z; //Set the floor to the block's height
                    }
                    let side = this.HB.collide(c.HB); //Check for collision
                    if (side) c.trigger(this, side); //Trigger the block's trigger function
                    if (c.solid && side) { //If the block is solid
                        if (this.owner == game.player) { // Only play for the player until sound ranges are implemented
                            // Sounds.wallhit.currentTime = 0;

                            if (!this.muted && typeof window !== 'undefined') Sounds.wallhit.play().catch(err => {});
                        }
                        switch (side) { //see which side you collided on
                            case 'front':
                                //Reflect the speed and mom by the map's reflect value
                                this.hp -= Math.abs(this.speed.y) / 2;
                                this.speed.y *= -c.reflection;
                                this.mom.y *= -c.reflection;
                                //Move the character to the edge of the block
                                this.HB.pos.y = c.HB.pos.y + c.HB.volume.y + this.HB.radius;
                                break;
                            case 'rear':
                                this.hp -= Math.abs(this.speed.y) / 2;
                                this.speed.y *= -c.reflection;
                                this.mom.y *= -c.reflection;
                                this.HB.pos.y = c.HB.pos.y - this.HB.radius;
                                break;
                            case 'right':
                                this.hp -= Math.abs(this.speed.x) / 2;
                                this.speed.x *= -c.reflection;
                                this.mom.x *= -c.reflection;
                                this.HB.pos.x = c.HB.pos.x + c.HB.volume.x + this.HB.radius;
                                break;
                            case 'left':
                                this.hp -= Math.abs(this.speed.x) / 2;
                                this.speed.x *= -c.reflection;
                                this.mom.x *= -c.reflection;
                                this.HB.pos.x = c.HB.pos.x - this.HB.radius;
                                break;
                            case 'top':
                                this.hp -= Math.abs(this.speed.z) / 2;
                                this.speed.z *= -c.reflection;
                                this.mom.z *= -c.reflection;
                                this.HB.pos.z = c.HB.pos.z + c.HB.volume.z;
                                break;
                            case 'bottom':
                                this.hp -= Math.abs(this.speed.z) / 2;
                                this.speed.z *= -c.reflection;
                                this.mom.z *= -c.reflection;
                                this.HB.pos.z = c.HB.pos.z - this.HB.height;
                                break;
                            default:
                                //break if you didn't collide
                                break;
                        }
                    }
                }

                /*
                  _
                 | |_  _____ _____ _ _
                 | ' \/ _ \ V / -_) '_|
                 |_||_\___/\_/\___|_|
    
                */
                if (this.HB.pos.z < this.hover + this.floor) { //If you are lower than the hover threshold
                    this.speed.z += Math.max((1 - (this.HB.pos.z / this.hover)) * this.bouyancy, 0) + game.match.map.gravity;
                    //Move up by your bouyancy times the percent between your z and you hover, not negative
                    //Also cancel out gravity
                }
                else if (this.HB.pos.z > this.hover + this.floor) { //If you are higher than the hover threshold
                    this.speed.z += Math.max((1 - ((this.HB.pos.z - this.hover) / this.hover)) * this.bouyancy, 0); //Move up by your bouyancy times the percent over the hover, not negative
                }

                /*
                  __  __      _         _   _          __  __
                 |  \/  |__ _| |_____  | |_| |_  ___  |  \/  |_____ _____
                 | |\/| / _` | / / -_) |  _| ' \/ -_) | |\/| / _ \ V / -_)
                 |_|  |_\__,_|_\_\___|  \__|_||_\___| |_|  |_\___/\_/\___|
    
                */

                // make lastHB the same as HB
                this.lastHB = new Utils.Cylinder(new Utils.Vect3(this.HB.pos.x, this.HB.pos.y, this.HB.pos.z), this.HB.radius, this.HB.height);

                // Apply speed-based movement (all players, all platforms)
                this.HB.pos.x += this.speed.x * game.time.delta;
                this.HB.pos.y += this.speed.y * game.time.delta;
                this.HB.pos.z += this.speed.z * game.time.delta;
                
                // SMOOTH RECONCILIATION: Gradually correct toward server position
                if (typeof window !== 'undefined' && this.serverPos && this.serverPos.x !== undefined) {
                    const isLocalPlayer = this.parent && game.player && this.parent === game.player;
                    
                    // Calculate error between current position and server
                    const dx = this.serverPos.x - this.HB.pos.x;
                    const dy = this.serverPos.y - this.HB.pos.y;
                    const dz = this.serverPos.z - this.HB.pos.z;
                    const predictionError = Math.sqrt(dx * dx + dy * dy + dz * dz);
                    
                    // Determine correction speed (pixels per frame to move toward server)
                    let correctionSpeed = 0;
                    
                    if (isLocalPlayer) {
                        // LOCAL PLAYER: Gentle corrections
                        if (predictionError < 10) {
                            correctionSpeed = 0.5; // 0.5 pixels per frame
                        } else if (predictionError < 20) {
                            correctionSpeed = 1.5; // 1.5 pixels per frame
                        } else if (predictionError < 50) {
                            correctionSpeed = 3; // 3 pixels per frame
                        } else {
                            correctionSpeed = predictionError * 0.5; // Snap quickly for large errors
                        }
                    } else {
                        // REMOTE PLAYERS: Faster corrections for visual smoothness
                        if (predictionError < 5) {
                            correctionSpeed = 1; // 1 pixel per frame
                        } else if (predictionError < 10) {
                            correctionSpeed = 2; // 2 pixels per frame
                        } else if (predictionError < 20) {
                            correctionSpeed = 4; // 4 pixels per frame
                        } else if (predictionError < 50) {
                            correctionSpeed = 8; // 8 pixels per frame
                        } else {
                            correctionSpeed = predictionError; // Immediate snap
                        }
                    }
                    
                    // Apply correction (move toward server at fixed speed)
                    if (predictionError > 0.1) {
                        const correctionFactor = Math.min(correctionSpeed / predictionError, 1.0);
                        this.HB.pos.x += dx * correctionFactor;
                        this.HB.pos.y += dy * correctionFactor;
                        this.HB.pos.z += dz * correctionFactor;
                    }
                    
                    // Speed correction for drift prevention
                    if (this.serverSpeed && predictionError > 3) {
                        const speedCorrectionFactor = isLocalPlayer ? 0.1 : 0.2;
                        this.speed.x += (this.serverSpeed.x - this.speed.x) * speedCorrectionFactor;
                        this.speed.y += (this.serverSpeed.y - this.speed.y) * speedCorrectionFactor;
                        this.speed.z += (this.serverSpeed.z - this.speed.z) * speedCorrectionFactor;
                    }
                    
                    this.predictionError = predictionError;
                }

                /*
                   ___       _          __   ___                   _
                  / _ \ _  _| |_   ___ / _| | _ ) ___ _  _ _ _  __| |___
                 | (_) | || |  _| / _ \  _| | _ \/ _ \ || | ' \/ _` (_-<
                  \___/ \_,_|\__| \___/_|   |___/\___/\_,_|_||_\__,_/__/
    
                */
                // If the character is outside of the map boundaries
                if (this.HB.pos.x < 0) {
                    this.HB.pos.x = 0;
                    // refelct the speed and mom by the map's reflect value
                    this.speed.x *= -game.match.map.collideReflect;
                    this.mom.x *= -game.match.map.collideReflect;
                    // Sounds.wallhit.currentTime = 0;
                    if (!this.muted && typeof window !== 'undefined') Sounds.wallhit.play().catch(err => {});
                }
                if (this.HB.pos.x > game.match.map.w) {
                    this.HB.pos.x = game.match.map.w;
                    this.speed.x *= -game.match.map.collideReflect;
                    this.mom.x *= -game.match.map.collideReflect;
                    // Sounds.wallhit.currentTime = 0;
                    if (!this.muted && typeof window !== 'undefined') Sounds.wallhit.play().catch(err => {});
                }
                if (this.HB.pos.y < 0) {
                    this.HB.pos.y = 0;
                    this.speed.y *= -game.match.map.collideReflect;
                    this.mom.y *= -game.match.map.collideReflect;
                    // Sounds.wallhit.currentTime = 0;
                    if (!this.muted && typeof window !== 'undefined') Sounds.wallhit.play().catch(err => {});
                }
                if (this.HB.pos.y > game.match.map.h) {
                    this.HB.pos.y = game.match.map.h;
                    this.speed.y *= -game.match.map.collideReflect;
                    this.mom.y *= -game.match.map.collideReflect;
                    // Sounds.wallhit.currentTime = 0;
                    if (!this.muted && typeof window !== 'undefined') Sounds.wallhit.play().catch(err => {});
                }

                /*
                   ___                      _    ___     _ _ _    _
                  / __|_ _ ___ _  _ _ _  __| |  / __|___| | (_)__(_)___ _ _
                 | (_ | '_/ _ \ || | ' \/ _` | | (__/ _ \ | | (_-< / _ \ ' \
                  \___|_| \___/\_,_|_||_\__,_|  \___\___/_|_|_/__/_\___/_||_|
    
                */
                if (-this.speed.z > this.HB.pos.z + game.match.map.floor) {
                    this.HB.pos.z = 0;
                    // this.speed.z *= -0.5
                    if (this.hover > 0) {
                        if (typeof window !== 'undefined') {
                            // Sounds.groundhit.currentTime = 0;
                            if (!this.muted) Sounds.groundhit.play().catch(err => {});
                        }
                    }
                }

                /*
                  ___                  _ _    __              _   _
                 | _ \_  _ _ _    __ _| | |  / _|_  _ _ _  __| |_(_)___ _ _  ___
                 |   / || | ' \  / _` | | | |  _| || | ' \/ _|  _| / _ \ ' \(_-<
                 |_|_\\_,_|_||_| \__,_|_|_| |_|  \_,_|_||_\__|\__|_\___/_||_/__/
    
                */
                for (const func of this.runFunc) {
                    func();
                }

                if (this.hp <= 0) {
                    this.active = false;
                    this.visible = false;
                    if (!this.muted && typeof window !== 'undefined')
                        this.deathSFX.play().catch(err => {});
                    if (this.inventory[this.item])
                        game.match.map.blocks.push(new Powerups.WeaponPickup(
                            new Utils.Vect3(this.HB.pos.x, this.HB.pos.y, this.HB.pos.z + this.HB.height / 2),
                            new Utils.Vect3(this.speed.x, this.speed.y, this.speed.z + 20),
                            { weapon: this.inventory[this.item].weapon, ammo: this.inventory[this.item].ammo, livetime: game.match.despawnTimer, dying: true }))
                }
            }
        }

        unitColor(fullOpaque = 0) {
            // find the match's character whose owner is the player
            let chara = game.match.characters.find(c => c.parent == game.player);
            if (chara) {
                if (this.team == chara.team) {
                    // return `rgba(0,255,0, ${Math.max(Number(fullOpaque), game.player.interface.drawFriendlyRing)})`;
                    return `rgba(0,255,0,${Math.max(Number(fullOpaque), 0.5)})`;
                }
                else if (chara.teams.includes(this.team)) {
                    // return `rgba(255,255,0, ${Math.max(Number(fullOpaque), game.player.interface.drawNeutralRing)})`;
                    return `rgba(255,255,0,${Math.max(Number(fullOpaque), 0.5)})`;
                }
                else {
                    // return `rgba(255,0,0, ${Math.max(Number(fullOpaque), game.player.interface.drawEnemyRing)})`;
                    return `rgba(255,0,0,${Math.max(Number(fullOpaque), 0.5)})`;
                }
            }
        }

        /*
              :::::::::  :::::::::      :::     :::       :::
             :+:    :+: :+:    :+:   :+: :+:   :+:       :+:
            +:+    +:+ +:+    +:+  +:+   +:+  +:+       +:+
           +#+    +:+ +#++:++#:  +#++:++#++: +#+  +:+  +#+
          +#+    +#+ +#+    +#+ +#+     +#+ +#+ +#+#+ +#+
         #+#    #+# #+#    #+# #+#     #+#  #+#+# #+#+#
        #########  ###    ### ###     ###   ###   ###
        */
        draw() {

            if (!this.active && this.cleanup) {
                return;
            } else if (this.visible) {
                /*
                       _    _                        _    _
                  _ __(_)__| |__  __ _ _ _ __ _ _ __| |_ (_)__
                 | '_ \ / _| / / / _` | '_/ _` | '_ \ ' \| / _|
                 | .__/_\__|_\_\ \__, |_| \__,_| .__/_||_|_\__|
                 |_|             |___/         |_|
                */
                if (this.mom.x < 0) this.img.src = this.leftgfx + '.png'
                if (this.mom.x > 0) this.img.src = this.gfx + '.png'

                let compareX = game.player.camera.x - this.HB.pos.x;
                let compareY = game.player.camera.y - this.HB.pos.y;

                if (game.player.camera._3D) {
                    this.draw3D();
                } else {

                    /*
                         _            _
                      __| |_  __ _ __| |_____ __ __
                     (_-< ' \/ _` / _` / _ \ V  V /
                     /__/_||_\__,_\__,_\___/\_/\_/
         
                    */
                    ctx.globalAlpha = 0.4;
                    let shadowShrink = this.HB.radius * Math.min(((this.HB.pos.z - this.floor) / 128), 1)
                    ctx.drawImage(
                        this.shadow,
                        game.window.w / 2 - compareX - this.HB.radius + shadowShrink,
                        game.window.h / 2 - compareY - this.HB.radius + shadowShrink - this.floor,
                        this.HB.radius * 2 - shadowShrink * 2,
                        this.HB.radius * 2 - shadowShrink * 2
                    );
                    ctx.globalAlpha = 1;

                    /*
                              _        _                 _
                      ___ ___| |___ __| |_ ___ _ _   _ _(_)_ _  __ _
                     (_-</ -_) / -_) _|  _/ _ \ '_| | '_| | ' \/ _` |
                     /__/\___|_\___\__|\__\___/_|   |_| |_|_||_\__, |
                                                               |___/
                    */
                    ctx.strokeStyle = this.unitColor();
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.ellipse(
                        game.window.w / 2 - compareX,
                        game.window.h / 2 - compareY - this.floor,
                        this.HB.radius,
                        this.HB.radius,
                        0, 0, 2 * Math.PI);
                    ctx.stroke();

                    /*
                      _  _          _ _   _      ___
                     | || |___ __ _| | |_| |_   | _ ) __ _ _ _
                     | __ / -_) _` | |  _| ' \  | _ \/ _` | '_|
                     |_||_\___\__,_|_|\__|_||_| |___/\__,_|_|
                    */
                    // draw an arc around the bottom half of the selector ring offest by 10 pixels outside that represents the character's health
                    // draw bar background
                    ctx.strokeStyle = "#000000";
                    ctx.lineWidth = 5;
                    ctx.beginPath();
                    ctx.beginPath();
                    ctx.arc(
                        game.window.w / 2 - compareX,
                        game.window.h / 2 - compareY - this.floor,
                        this.HB.radius + 16,
                        Math.PI * 0.75,
                        Math.PI * 0.25,
                        true
                    );
                    // draw bar
                    ctx.stroke();
                    ctx.strokeStyle = this.unitColor(true);
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(
                        game.window.w / 2 - compareX,
                        game.window.h / 2 - compareY - this.floor,
                        this.HB.radius + 16,
                        Math.PI * 0.75,
                        Math.PI * (0.75 - ((this.hp / this.hp_max) * 0.5)),
                        true
                    );
                    ctx.stroke();

                    /*
                      ___                      ___
                     | _ \_____ __ _____ _ _  | _ ) __ _ _ _
                     |  _/ _ \ V  V / -_) '_| | _ \/ _` | '_|
                     |_| \___/\_/\_/\___|_|   |___/\__,_|_|
                    */
                    //draw an arc around the bottom quarter of the selector ring that displays the character's power
                    //draw bar background
                    ctx.strokeStyle = "#000000";
                    ctx.lineWidth = 5;
                    ctx.beginPath();
                    ctx.arc(
                        game.window.w / 2 - compareX,
                        game.window.h / 2 - compareY - this.floor,
                        this.HB.radius + 8,
                        Math.PI * 0.75,
                        Math.PI * 0.25,
                        true
                    );
                    ctx.stroke();
                    // draw bar
                    ctx.beginPath();
                    ctx.strokeStyle = "#00FFFF";
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(
                        game.window.w / 2 - compareX,
                        game.window.h / 2 - compareY - this.floor,
                        this.HB.radius + 8,
                        Math.PI * 0.75,
                        Math.PI * (0.75 - ((this.pp / this.pp_max) * 0.5)),
                        true
                    );
                    ctx.stroke();


                    /*
                         _                     _
                      __| |_  __ _ _ _ __ _ __| |_ ___ _ _
                     / _| ' \/ _` | '_/ _` / _|  _/ -_) '_|
                     \__|_||_\__,_|_| \__,_\__|\__\___|_|
         
                    */

                    ctx.drawImage(
                        this.img,
                        game.window.w / 2 - compareX - this.HB.radius,
                        game.window.h / 2 - compareY - this.HB.height - this.HB.pos.z - this.zMod(),
                        this.HB.radius * 2, this.HB.height
                    );
                    if (game.debug) {
                        ctx.fillStyle = "#FF0000";
                        ctx.fillRect(game.window.w / 2 - compareX - 2, game.window.h / 2 - compareY - 2, 4, 4);
                        ctx.strokeStyle = "#FF0000";
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.ellipse(
                            game.window.w / 2 - compareX,
                            game.window.h / 2 - compareY - this.HB.pos.z,
                            this.HB.radius,
                            this.HB.radius,
                            0, 0, 2 * Math.PI);
                        ctx.stroke();
                        ctx.beginPath();
                        ctx.ellipse(
                            game.window.w / 2 - compareX,
                            game.window.h / 2 - compareY - this.HB.height - this.HB.pos.z,
                            this.HB.radius,
                            this.HB.radius,
                            0, 0, 2 * Math.PI);
                        ctx.stroke();
                    }

                    /*
                      _  _
                     | \| |__ _ _ __  ___
                     | .` / _` | '  \/ -_)
                     |_|\_\__,_|_|_|_\___|
                    */
                    // Draw character's name above their head
                    ctx.textAlign = "center";
                    //first draw the text in black to create a shadow
                    ctx.fillStyle = '#000000';
                    ctx.font = "12px Jura";
                    ctx.fillText(this.name, game.window.w / 2 - compareX + 2, game.window.h / 2 - compareY - this.HB.height - this.HB.pos.z - 8);
                    //then draw the text in white
                    ctx.fillStyle = '#FFFFFF';
                    ctx.font = "12px Jura";
                    ctx.fillText(this.name, game.window.w / 2 - compareX, game.window.h / 2 - compareY - this.HB.height - this.HB.pos.z - 10);
                }

                /*
                  _                     _     _ _
                 | |_ __ _ _ _ __ _ ___| |_  | (_)_ _  ___
                 |  _/ _` | '_/ _` / -_)  _| | | | ' \/ -_)
                  \__\__,_|_| \__, \___|\__| |_|_|_||_\___|
                              |___/
                */
                // This can draw a line to the closest part of a rectangle
                // except it broke at some point when i moved to utils
                // It can still draw to the XY which is good for tubes, but not blocks
                if (this.target && game.debug) {
                    compareX = game.player.camera.x - this.HB.pos.x; //If you change this to the target.pos
                    compareY = game.player.camera.y - this.HB.pos.y; //If you change this to the target.pos
                    let targetX = game.player.camera.x - this.target.HB.pos.x;
                    let targetY = game.player.camera.y - this.target.HB.pos.y;
                    ctx.strokeStyle = "#FFFFFF"
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(game.window.w / 2 - targetX, game.window.h / 2 - targetY);
                    ctx.lineTo(game.window.w / 2 - compareX, game.window.h / 2 - compareY);
                    ctx.stroke();
                }
            }
        }

        /*
         ######                        #####  ######
         #     # #####    ##   #    # #     # #     #
         #     # #    #  #  #  #    #       # #     #
         #     # #    # #    # #    #  #####  #     #
         #     # #####  ###### # ## #       # #     #
         #     # #   #  #    # ##  ## #     # #     #
         ######  #    # #    # #    #  #####  ######
        
        */
        draw3D() {

            let compareX = game.player.camera.x - this.HB.pos.x;
            let compareY = game.player.camera.y - this.HB.pos.y;

            /*
                 _            _
              __| |_  __ _ __| |_____ __ __
             (_-< ' \/ _` / _` / _ \ V  V /
             /__/_||_\__,_\__,_\___/\_/\_/
            
            */
            ctx.globalAlpha = 0.4;
            let shadowShrink = this.HB.radius * Math.min(((this.HB.pos.z - this.floor) / 128), 1)
            ctx.drawImage(
                this.shadow,
                game.window.w / 2 - compareX - this.HB.radius + shadowShrink,
                game.window.h / 2 - (compareY * game.player.camera.angle) - this.HB.radius + (this.HB.height * (1 - game.player.camera.angle)) + (shadowShrink * game.player.camera.angle) - (this.floor * (1 - game.player.camera.angle)),
                (this.HB.radius * 2) - (shadowShrink * 2),
                ((this.HB.radius * 2) - (shadowShrink * 2)) * game.player.camera.angle
            );
            ctx.globalAlpha = 1;

            /*
                      _        _                 _
              ___ ___| |___ __| |_ ___ _ _   _ _(_)_ _  __ _
             (_-</ -_) / -_) _|  _/ _ \ '_| | '_| | ' \/ _` |
             /__/\___|_\___\__|\__\___/_|   |_| |_|_||_\__, |
                                                       |___/
            */
            ctx.strokeStyle = this.unitColor();
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.ellipse(
                game.window.w / 2 - compareX,
                game.window.h / 2 - (compareY * game.player.camera.angle) - (this.floor * (1 - game.player.camera.angle)),
                this.HB.radius,
                this.HB.radius * game.player.camera.angle,
                0, 0, 2 * Math.PI);
            ctx.stroke();
            // draw an arc around the bottom half of the selector ring offest by 10 pixels outside that represents the character's health, and adjust for camera angle
            // draw bar background
            ctx.strokeStyle = "#000000";
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.beginPath();
            ctx.arc(
                game.window.w / 2 - compareX,
                game.window.h / 2 - (compareY * game.player.camera.angle) - (this.floor * (1 - game.player.camera.angle)),
                this.HB.radius + 10,
                Math.PI,
                Math.PI * 2,
                true
            );
            ctx.stroke();
            ctx.strokeStyle = this.unitColor(true);
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(
                game.window.w / 2 - compareX,
                game.window.h / 2 - (compareY * game.player.camera.angle) - (this.floor * (1 - game.player.camera.angle)),
                this.HB.radius + 10,
                Math.PI,
                Math.PI * (1 - (this.hp / this.hp_max)),
                true
            );
            ctx.stroke();

            if (this.faceCamera)
                ctx.drawImage(
                    this.img,
                    game.window.w / 2 - compareX - this.HB.radius,
                    game.window.h / 2 - (compareY * game.player.camera.angle) - this.HB.height - (this.HB.pos.z * (1 - game.player.camera.angle)) - ((sineAnimate(1, 0.1) * (1 - game.player.camera.angle))),
                    this.HB.radius * 2,
                    this.HB.height
                );
            else
                ctx.drawImage(
                    this.img,
                    game.window.w / 2 - compareX - this.HB.radius,
                    game.window.h / 2 - (compareY * game.player.camera.angle) - (this.HB.height * (1 - game.player.camera.angle)) - (this.HB.pos.z * (1 - game.player.camera.angle)) - ((sineAnimate(1, 0.1) * (1 - game.player.camera.angle))),
                    this.HB.radius * 2,
                    this.HB.height * (1 - game.player.camera.angle)
                );

            // Draw character's name above their head, adjusting for camera angle
            ctx.fillStyle = "#FFFFFF";
            ctx.font = "12px Jura";
            ctx.textAlign = "center";
            ctx.fillText(this.name, game.window.w / 2 - compareX, game.window.h / 2 - (compareY * game.player.camera.angle) - this.HB.height - (this.HB.pos.z * (1 - game.player.camera.angle)) - 10);

            /*
                 _     _                _    _ _   _
              __| |___| |__ _  _ __ _  | |_ (_) |_| |__  _____ __
             / _` / -_) '_ \ || / _` | | ' \| |  _| '_ \/ _ \ \ /
             \__,_\___|_.__/\_,_\__, | |_||_|_|\__|_.__/\___/_\_\
                                |___/
            */
            if (game.debug) {
                ctx.lineWidth = 2;
                ctx.fillStyle = "#FF0000";
                ctx.strokeStyle = "#FF0000";
                ctx.fillRect(game.window.w / 2 - compareX - 2, game.window.h / 2 - (compareY * game.player.camera.angle) - 2, 4, 4);
                ctx.beginPath();
                ctx.ellipse(
                    game.window.w / 2 - compareX,
                    game.window.h / 2 - (compareY * game.player.camera.angle) - (this.HB.pos.z * (1 - game.player.camera.angle)),
                    this.HB.radius,
                    this.HB.radius * game.player.camera.angle,
                    0, 0, 2 * Math.PI);
                ctx.stroke();
                ctx.beginPath();
                ctx.ellipse(
                    game.window.w / 2 - compareX,
                    game.window.h / 2 - (compareY * game.player.camera.angle) - (this.HB.height * (1 - game.player.camera.angle)) - (this.HB.pos.z * (1 - game.player.camera.angle)),
                    this.HB.radius,
                    this.HB.radius * game.player.camera.angle,
                    0, 0, 2 * Math.PI);
                ctx.stroke();
                ctx.lineWidth = 4;
                ctx.strokeStyle = "#FFFFFF";
                let newX = this.HB.pos.x + this.speed.x;
                let newY = this.HB.pos.y + this.speed.y;
                let newZ = this.HB.pos.z + this.speed.z;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(game.window.w / 2, game.window.h / 2);
                compareX = game.player.camera.x - newX;
                compareY = game.player.camera.y - newY;
                let compareZ = newZ - this.HB.pos.z;
                ctx.lineTo(game.window.w / 2 - compareX, game.window.h / 2 - (compareY * game.player.camera.angle) - (this.speed.z * (1 - game.player.camera.angle)));
                ctx.stroke();
            }
        }

        /*
    
         ##### #####  #  ####   ####  ###### #####
           #   #    # # #    # #    # #      #    #
           #   #    # # #      #      #####  #    #
           #   #####  # #  ### #  ### #      #####
           #   #   #  # #    # #    # #      #   #
           #   #    # #  ####   ####  ###### #    #
    
        */
        trigger(actor, side) {

        }

        pack() {
            // Store last controller input state for remote player prediction
            let inputState = null;
            if (this.parent && this.parent.controller) {
                inputState = {
                    ml: this.parent.controller.buttons.moveLeft.current,
                    mr: this.parent.controller.buttons.moveRight.current,
                    mu: this.parent.controller.buttons.moveUp.current,
                    md: this.parent.controller.buttons.moveDown.current,
                    j: this.parent.controller.buttons.jump.current,
                    br: this.parent.controller.buttons.brake.current,
                    bo: this.parent.controller.buttons.boost.current
                };
            }
            
            return {
                t: 'c', // type: character
                tm: this.team, // team
                i: this.id, // id
                p: this.HB.pos, // pos
                s: this.speed, // speed
                h: this.hp, // hp
                pp: this.pp, // pp
                a: this.ammo, // ammo
                item: this.item, // current weapon index
                inv: this.inventory.map(weapon => ({ 
                    w: weapon.weapon || weapon.type, // weapon type
                    a: weapon.ammo, // weapon ammo
                    nc: Math.max(weapon.nextCool - game.match.time.ticks, 0), // remaining cooldown ticks (relative)
                    r: weapon.reloading // is reloading
                })), // inventory
                inp: inputState // input state (compressed)
            }
        }

        fullPack() {
            const packed = {
                type: this.type,
                parent: this.parent.pack(),
                inventory: this.inventory.map(item => item.pack()),
                spawnPos: this.HB.pos,
                serverPos: this.HB.pos
            }
            for (const key of Object.keys(this)) {
                if (typeof this[key] !== 'function') {
                    // if pack doesn't have this key, add it
                    if (!packed[key])
                        packed[key] = this[key];
                }
            }
            return packed;
        }
    }


    /*
         ::::::::::: :::::::::: ::::::::::: ::::::::: ::::::::::: :::    ::: ::::::::::
            :+:     :+:            :+:     :+:    :+:    :+:     :+:   :+:  :+:
           +:+     +:+            +:+     +:+    +:+    +:+     +:+  +:+   +:+
          +#+     +#++:++#       +#+     +#++:++#+     +#+     +#++:++    +#++:++#
         +#+     +#+            +#+     +#+    +#+    +#+     +#+  +#+   +#+
    #+# #+#     #+#            #+#     #+#    #+#    #+#     #+#   #+#  #+#
    #####      ##########     ###     ######### ########### ###    ### ##########
    */
    class Jetbike extends Character {
        constructor(options) {
            super(options);
            this.radius = 29;
            this.height = 37;
            this.type = 'jetbike';
            if (typeof options === 'object')
                for (var key of Object.keys(options)) {
                    this[key] = options[key];
                }
            this.HB = Utils.generateHB(this);
            this.airAccel = new Utils.Vect3(0.15, 0.15, 1);
            this.hover = 16;
            this.lastCombinedSpeed = 0;
            this.zMod = () => {
                return Utils.sineAnimate(1, 0.1);
            }
        }

        step() {
            super.step();
            if (typeof window !== 'undefined') {
                const combinedSpeed = Math.sqrt(this.speed.x ** 2 + this.speed.y ** 2);
                const freq = Math.min(Math.floor(combinedSpeed / 0.6), 19);
                const lastFreq = Math.min(Math.floor(this.lastCombinedSpeed / 0.6), 19);
                if (freq !== lastFreq) {
                    Sounds.prop[lastFreq].pause();
                    Sounds.prop[lastFreq].currentTime = 0;
                }
                if (Sounds.prop[freq].currentTime > (game.time.tickRate * game.time.delta) / 1000)
                    Sounds.prop[freq].currentTime = 0;
                Sounds.prop[freq].volume = 0.2;
                Sounds.prop[freq].play().catch(err => {});
            }
        }
    }

    /*
          ::::    :::     :::       :::   :::   :::::::::: ::::::::
         :+:+:   :+:   :+: :+:    :+:+: :+:+:  :+:       :+:    :+:
        :+:+:+  +:+  +:+   +:+  +:+ +:+:+ +:+ +:+       +:+
       +#+ +:+ +#+ +#++:++#++: +#+  +:+  +#+ +#++:++#  +#++:++#++
      +#+  +#+#+# +#+     +#+ +#+       +#+ +#+              +#+
     #+#   #+#+# #+#     #+# #+#       #+# #+#       #+#    #+#
    ###    #### ###     ### ###       ### ########## ########
    */
    function getName() {
        let names = [
            "Hae'din",
            "Ai'Zaya",
            "Mah'Vrick",
            "Jae'Sin",
            "Loh'Gahn",
            "Ah'Lex",
            "Bek'Hahm",
            "Ry'Ahn",
            "Oh'Lee",
            "Zer'Gling",
            "Bah'Tadog",
            "Lee'Roy",
            "Baelzar",
            "Aegnor",
            "Beleg",
            "Celeborn",
            "Denethor",
            "Ecthelion",
            "Aerendil",
            "Caladwen",
            "Eldamar",
            "Finwe",
            "Haldir",
            "Ithilwen",
            "Luthien",
            "Maedhros",
            "Nimrodel",
            "Orome",
            "Oropher",
            "Quenya",
            "Silmaril",
            "Vanyar",
            "Yavanna",
            "Zirakzigil"
        ];
        return names[Math.floor(Math.random() * names.length)];
    }

    function generateRandomName() {
        let vowels = ['a', 'e', 'i', 'o', 'u'];
        let consonants = ['b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'q', 'r', 's', 't', 'v', 'w', 'x', 'y', 'z'];

        let name = '';
        let length = Math.floor(Math.random() * 10) + 4; // Random length between 2 and 4

        for (let i = 0; i < length; i++) {
            if (i % 2 === 0) {
                name += consonants[Math.floor(Math.random() * consonants.length)];
            } else {
                name += vowels[Math.floor(Math.random() * vowels.length)];
            }
        }

        return name;
    }

    return { Character, Jetbike, getName, generateRandomName };
}));