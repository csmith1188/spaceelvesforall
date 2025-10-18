(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['Utils', 'Blocks', 'Items'], factory);
    } else if (typeof module === 'object' && module.exports) {
        // Nodejs
        const Utils = require('../../../utils.js');
        const Blocks = require('./block.js');
        const Items = require('../item.js');
        module.exports = factory(Utils, Blocks, Items);
    } else {
        // Browser globals (root is window)
        root.Powerups = factory(root.Utils, root.Blocks, root.Items);
    }
}(typeof self !== 'undefined' ? self : this, function (Utils, Blocks, Items) {
    /*
          :::::::::   ::::::::  :::       ::: :::::::::: :::::::::         :::    ::: :::::::::
         :+:    :+: :+:    :+: :+:       :+: :+:        :+:    :+:        :+:    :+: :+:    :+:
        +:+    +:+ +:+    +:+ +:+       +:+ +:+        +:+    +:+        +:+    +:+ +:+    +:+
       +#++:++#+  +#+    +:+ +#+  +:+  +#+ +#++:++#   +#++:++#:         +#+    +:+ +#++:++#+
      +#+        +#+    +#+ +#+ +#+#+ +#+ +#+        +#+    +#+        +#+    +#+ +#+
     #+#        #+#    #+#  #+#+# #+#+#  #+#        #+#    #+#        #+#    #+# #+#
    ###         ########    ###   ###   ########## ###    ###         ########  ###
    */

    /*
     ######
     #     # #  ####  #    # #    # #####
     #     # # #    # #   #  #    # #    #
     ######  # #      ####   #    # #    #
     #       # #      #  #   #    # #####
     #       # #    # #   #  #    # #
     #       #  ####  #    #  ####  #
    
    */
    class PickUp extends Blocks.Block {
        constructor(options) {
            super(options);
            this.type = 'pickup';
            this.subtype = 'pickup';
            if (typeof window !== 'undefined') this.touchSFX = Sounds.pickup_ammo;
            this.solid = false;
            this.shadowDraw = true;
            this.runFunc = [
                () => {
                    this.HB.pos.z = Utils.sineAnimate(5, 0.05) + 10;
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

            // this.HB = new Utils.Cube(new Utils.Vect3(spawnPos.x, spawnPos.y, spawnPos.z + 16), new Utils.Vect3(32, 32, 32));

            // if (typeof window !== 'undefined') this.img.src = this.imgFile;

        }

        pack() {
            let pack = {
                id: this.id,
                pos: this.HB.pos
            }
            if (this.user != null) {
                pack.user = {
                    id: this.user.id,
                    team: this.user.team,
                    name: this.user.name
                }
            }
            if (this.HB instanceof Utils.Cube) {
                pack.shape = 'cube';
                pack.vol = this.HB.volume;
            } else if (this.HB instanceof Utils.Cylinder) {
                pack.shape = 'cylinder';
                pack.radius = this.HB.radius;
                pack.height = this.HB.height;
            }

            pack.subtype = this.subtype;

            // // for each key in this object
            // // if that key's value is not equal to the default value
            // // add it to the pack
            // for (let key in this) {
            //     if (this[key] !== PickUp.prototype[key]) {
            //         if (key == 'runFunc') {
            //             let noNatives = this[key].filter(func => !func.toString().includes('[native code]'));
            //             packed[key] = noNatives.map(func => func.toString());
            //         }
            //         else
            //             packed[key] = this[key];
            //     }
            // }

            // let noNatives = this.runFunc.filter(func => !func.toString().includes('[native code]'));
            // pack.runFunc = noNatives.map(func => func.toString());

            return pack;
        }

        trigger(actor, side) {
            if (game.match.characters.includes(actor)) {
                this.active = false;
                // if this actor's target was this pickup, set it to null
                if (actor.target == this) actor.target = null;
                //run every runFunc
                for (const func of this.runFunc) {
                    func(actor, side);
                }

            }
        }
    }

    /*
        #                            ######
       # #   #    # #    #  ####     #     #   ##   #      #      #  ####  ##### #  ####
      #   #  ##  ## ##  ## #    #    #     #  #  #  #      #      # #        #   # #    #
     #     # # ## # # ## # #    #    ######  #    # #      #      #  ####    #   # #
     ####### #    # #    # #    #    #     # ###### #      #      #      #   #   # #
     #     # #    # #    # #    #    #     # #    # #      #      # #    #   #   # #    #
     #     # #    # #    #  ####     ######  #    # ###### ###### #  ####    #   #  ####
    
    */
    class Ammo_Ballistic extends PickUp {
        constructor(options) {
            super(options);
            this.type = 'pickup';
            this.subtype = 'ammo_ballistic';
            this.imgFile = 'img/sprites/pickups/ammo_ballistic_top.png';
            this.imgFileSide = 'img/sprites/pickups/ammo_ballistic_top.png';
            // this.imgFileSide = 'img/sprites/pickups/ammo_ballistic_side.png';
            this.color = [255, 0, 0];
            this.colorSide = [255, 128, 128];
            this.shadowDraw = true;
            this.runFunc.push((actor, side) => {
                if (game.match.characters.includes(actor)) {
                    if (actor.ammo.ballistic < actor.ammo.ballisticMax) {
                        actor.ammo.ballistic++; // Add ballistic ammo
                        if (typeof window !== 'undefined') {
                            // Play pickup sound
                            this.touchSFX.currentTime = 0;
                            if (!actor.muted)
                                this.touchSFX.play().catch(err => {});
                        }
                    } else {
                        this.active = true; // Turn this back on if the player is full ammo
                    }
                }
            });
            if (typeof options === 'object')
                for (var key of Object.keys(options)) {
                    if (key == 'runFunc') {
                    }
                    else if (key == 'drawFunc') {
                    } else {
                        this[key] = options[key];
                    }
                }
            if (typeof window !== 'undefined') {
                this.img.src = this.imgFile;
                this.imgSide.src = this.imgFileSide;
            }
        }
    }

    /*
        #                            ######
       # #   #    # #    #  ####     #     # #        ##    ####  #    #   ##
      #   #  ##  ## ##  ## #    #    #     # #       #  #  #      ##  ##  #  #
     #     # # ## # # ## # #    #    ######  #      #    #  ####  # ## # #    #
     ####### #    # #    # #    #    #       #      ######      # #    # ######
     #     # #    # #    # #    #    #       #      #    # #    # #    # #    #
     #     # #    # #    #  ####     #       ###### #    #  ####  #    # #    #
    
    */
    class Ammo_Plasma extends PickUp {
        constructor(options) {
            super(options);
            this.type = 'pickup';
            this.subtype = 'ammo_plasma';
            this.imgFile = 'img/sprites/pickups/ammo_plasma_top.png';
            this.imgFileSide = 'img/sprites/pickups/ammo_plasma_top.png';
            // this.imgFileSide = 'img/sprites/pickups/ammo_plasma_side.png';
            this.color = [255, 0, 255];
            this.colorSide = [255, 128, 255];
            this.shadowDraw = true;
            this.runFunc.push((actor, side) => {
                if (game.match.characters.includes(actor)) {
                    if (actor.ammo.plasma < actor.ammo.plasmaMax) {
                        if (typeof window !== 'undefined') {
                            // Play pickup sound
                            this.touchSFX.currentTime = 0;
                            if (!actor.muted)
                                this.touchSFX.play().catch(err => {});
                        }
                        actor.ammo.plasma++; // Add plasma ammo
                    } else {
                        this.active = true; // Turn this back on if the player is full ammo
                    }
                }
            });
            if (typeof options === 'object')
                for (var key of Object.keys(options)) {
                    if (key == 'runFunc') {
                    }
                    else if (key == 'drawFunc') {
                    } else {
                        this[key] = options[key];
                    }
                }
            if (typeof window !== 'undefined') {
                this.img.src = this.imgFile;
                this.imgSide.src = this.imgFileSide;
            }
        }
    }

    /*
     #     #
     #     # ######   ##   #      ##### #    #
     #     # #       #  #  #        #   #    #
     ####### #####  #    # #        #   ######
     #     # #      ###### #        #   #    #
     #     # #      #    # #        #   #    #
     #     # ###### #    # ######   #   #    #
    
    */
    class HealthPickup extends PickUp {
        constructor(options) {
            super(options);
            this.type = 'pickup';
            this.subtype = 'health';
            this.imgFile = 'img/sprites/pickups/health_top.png';
            this.imgFileSide = 'img/sprites/pickups/health_top.png';
            // this.imgFileSide = 'img/sprites/pickups/health_side.png';
            if (typeof window !== 'undefined') this.touchSFX = Sounds.pickup_health;
            this.color = [0, 255, 0];
            this.colorSide = [128, 255, 128];
            //if health is not full
            this.runFunc.push((actor, side) => {
                if (game.match.characters.includes(actor)) {
                    if (actor.hp < actor.hp_max) {
                        // Play pickup sound (client-side only)
                        if (typeof window !== 'undefined') {
                            this.touchSFX.currentTime = 0;
                            if (!actor.muted)
                                this.touchSFX.play().catch(err => {});
                        }
                        
                        // Apply health (server-authoritative)
                        actor.hp = Math.min(actor.hp + 50, actor.hp_max);
                        
                        // Remove pickup from map (both client and server)
                        this.active = false;
                        
                        // Handle respawn (server-side only)
                        if (typeof window === 'undefined' && this.respawnTime && this.respawnTime > 0) {
                            setTimeout(() => {
                                this.active = true;
                            }, this.respawnTime);
                        }
                    }
                    else {
                        this.active = true; // Turn this back on if the player is full health
                    }
                }
            });
            if (typeof options === 'object')
                for (var key of Object.keys(options)) {
                    if (key == 'runFunc') {
                    }
                    else if (key == 'drawFunc') {
                    } else {
                        this[key] = options[key];
                    }
                }
            if (typeof window !== 'undefined') {
                this.img.src = this.imgFile;
                this.imgSide.src = this.imgFileSide;
            }
        }
    }

    /*
     #     #
     #  #  # ######   ##   #####   ####  #    #
     #  #  # #       #  #  #    # #    # ##   #
     #  #  # #####  #    # #    # #    # # #  #
     #  #  # #      ###### #####  #    # #  # #
     #  #  # #      #    # #      #    # #   ##
      ## ##  ###### #    # #       ####  #    #
    
    */

    class WeaponPickup extends PickUp {
        constructor(options) {
            super(options);
            this.type = 'weapon';
            this.weapon = 'pistol'
            this.item = new Items.Pistol();
            this.ammoMax = 10;
            this.shadowDraw = true;
            this.pickupDelay = ((game.match) ? game.match.time.ticks : 0) + 180;
            if (typeof window !== 'undefined') this.touchSFX = Sounds.pickup_weapon;
            this.runFunc = [(actor, side) => {
                if (actor) {
                    if (this.pickupDelay < game.time.ticks) {
                        if (game.match.characters.includes(actor)) {
                            if (actor.inventory.length < 2) {
                                if (!actor.muted && typeof window !== 'undefined')
                                    this.touchSFX.play().catch(err => {});
                                this.item.owner = actor.parent;
                                actor.inventory.push(this.item); // Add to inventory
                            }
                            else {
                                this.active = true; // Turn this back on if the player is full inventory
                            }
                        }
                    }
                    else {
                        this.active = true; // Turn this back on if the player is full inventory
                    }
                }
                this.speed.z -= game.match.map.gravity;
                if (this.HB.pos.z < 0) {
                    this.HB.pos.z = 0;
                    this.speed.z = 0;
                    this.speed.x *= game.match.map.friction.ground;
                    this.speed.y *= game.match.map.friction.ground;
                }
            }];

            if (typeof options === 'object')
                for (var key of Object.keys(options)) {
                    if (key == 'runFunc') {
                    }
                    else if (key == 'drawFunc') {
                    } else {
                        this[key] = options[key];
                    }
                }

            if (this.weapon == 'pistol') {
                this.item = new Items.Pistol();
                if (this.ammo == undefined) this.ammo = 12;
                this.ammoMax = 12;
                this.item.ammo = this.ammo;
                if (this.ammo < this.ammoMax) this.imgFile = 'img/sprites/inventory/pistol_inactive.png';
                else this.imgFile = 'img/sprites/inventory/pistol_active.png';
                this.imgFileSide = 'img/sprites/inventory/pistol_inactive.png';
                // this.imgFileSide = 'img/sprites/pickups/ammo_ballistic_side.png';
            }
            if (this.weapon == 'rifle') {
                this.item = new Items.Rifle();
                if (this.ammo == undefined) this.ammo = 3;
                this.ammoMax = 3;
                this.item.ammo = this.ammo;
                if (this.ammo < this.ammoMax) this.imgFile = 'img/sprites/inventory/rifle_inactive.png';
                else this.imgFile = 'img/sprites/inventory/rifle_active.png';
                this.imgFileSide = 'img/sprites/inventory/rifle_inactive.png';
                // this.imgFileSide = 'img/sprites/pickups/ammo_ballistic_side.png';
            }
            if (this.weapon == 'flamer') {
                this.item = new Items.Flamer();
                if (this.ammo == undefined) this.ammo = 6;
                this.ammoMax = 6;
                this.item.ammo = this.ammo;
                if (this.ammo < this.ammoMax) this.imgFile = 'img/sprites/inventory/flamer_inactive.png';
                else this.imgFile = 'img/sprites/inventory/flamer_active.png';
                this.imgFileSide = 'img/sprites/inventory/flamer_inactive.png';
                // this.imgFileSide = 'img/sprites/pickups/ammo_plasma_side.png';
            }
            if (this.weapon == 'lance') {
                this.item = new Items.Lance();
                if (this.ammo == undefined) this.ammo = 4;
                this.ammoMax = 4;
                this.item.ammo = this.ammo;
                if (this.ammo < this.ammoMax) this.imgFile = 'img/sprites/inventory/lance_inactive.png';
                else this.imgFile = 'img/sprites/inventory/lance_active.png';
                this.imgFileSide = 'img/sprites/inventory/lance_inactive.png';
                // this.imgFileSide = 'img/sprites/pickups/ammo_plasma_side.png';
            }
            if (this.weapon == 'sword') {
                this.item = new Items.Sword();
                this.imgFile = 'img/sprites/inventory/sword_active.png';
                this.imgFileSide = 'img/sprites/inventory/sword_inactive.png';
                // this.imgFileSide = 'img/sprites/pickups/grey_side.png';
            }
            if (typeof window !== 'undefined') {
                this.img.src = this.imgFile;
                this.imgSide.src = this.imgFileSide;
            }
        }

        pack() {
            let pack = {
                id: this.id,
                pos: this.HB.pos
            }
            if (this.user != null) {
                pack.user = {
                    id: this.user.id,
                    team: this.user.team,
                    name: this.user.name
                }
            }
            if (this.HB instanceof Utils.Cube) {
                pack.shape = 'cube';
                pack.vol = this.HB.volume;
            } else if (this.HB instanceof Utils.Cylinder) {
                pack.shape = 'cylinder';
                pack.radius = this.HB.radius;
                pack.height = this.HB.height;
            }

            pack.subtype = this.subtype;
            pack.weapon = this.weapon;
            pack.ammo = this.ammo;

            return pack;
        }

    }
    return { Ammo_Ballistic, Ammo_Plasma, HealthPickup, WeaponPickup };
}));