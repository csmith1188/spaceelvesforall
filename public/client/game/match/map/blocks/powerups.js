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
class PickUp extends Block {
    constructor(id, posVect, volVect, options) {
        super(id, posVect, volVect, options);
        this.HB = new Cube(new Vect3(posVect.x, posVect.y, posVect.z + 16), new Vect3(32, 32, 16));
        this.type = 'pickup';
        this.touchSFX = sounds.pickup_ammo;
        this.solid = false;
        this.shadowDraw = true;
        this.runFunc = [
            (actor, side) => {
                this.HB.pos.z = sineAnimate(5, 0.05) + 10;
            }
        ]
        if (typeof options === 'object')
            for (var key of Object.keys(options)) {
                this[key] = options[key];
            }
        this.img.src = this.imgFile;

    }

    trigger(actor, side) {
        if (actor instanceof Character) {
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
    constructor(id, posVect, volVect, options) {
        super(id, posVect, volVect, options);
        this.type = 'pickup';
        this.subtype = 'ammo_ballistic';
        this.imgFile = 'img/sprites/pickups/ammo_ballistic_top.png';
        this.imgFileSide = 'img/sprites/pickups/ammo_ballistic_side.png';
        this.color = [255, 0, 0];
        this.colorSide = [255, 128, 128];
        this.shadowDraw = true;
        this.runFunc.push((actor, side) => {
            if (actor instanceof Character)
                if (actor.ammo.ballistic < actor.ammo.ballisticMax) {
                    actor.ammo.ballistic++; // Add ballistic ammo
                    // Play pickup sound
                    this.touchSFX.currentTime = 0;
                    if (!actor.muted)
                        this.touchSFX.play();
                } else {
                    this.active = true; // Turn this back on if the player is full ammo
                }
        });
        if (typeof options === 'object')
            for (var key of Object.keys(options)) {
                this[key] = options[key];
            }
        this.img.src = this.imgFile;
        this.imgSide.src = this.imgFileSide;
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
    constructor(id, posVect, volVect, options) {
        super(id, posVect, volVect, options);
        this.type = 'pickup';
        this.subtype = 'ammo_plasma';
        this.imgFile = 'img/sprites/pickups/ammo_plasma_top.png';
        this.imgFileSide = 'img/sprites/pickups/ammo_plasma_side.png';
        this.img.src = this.imgFile;
        this.color = [255, 0, 255];
        this.colorSide = [255, 128, 255];
        this.shadowDraw = true;
        this.runFunc.push((actor, side) => {
            if (actor instanceof Character)
                if (actor.ammo.plasma < actor.ammo.plasmaMax) {
                    // Play pickup sound
                    this.touchSFX.currentTime = 0;
                    if (!actor.muted)
                        this.touchSFX.play();
                    actor.ammo.plasma++; // Add plasma ammo
                } else {
                    this.active = true; // Turn this back on if the player is full ammo
                }
        });
        if (typeof options === 'object')
            for (var key of Object.keys(options)) {
                this[key] = options[key];
            }
        this.img.src = this.imgFile;
        this.imgSide.src = this.imgFileSide;
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
    constructor(id, posVect, volVect, options) {
        super(id, posVect, volVect, options);
        this.type = 'pickup';
        this.subtype = 'health';
        this.imgFile = 'img/sprites/pickups/health_top.png';
        this.imgFileSide = 'img/sprites/pickups/health_side.png';
        this.touchSFX = sounds.pickup_health;
        this.color = [0, 255, 0];
        this.colorSide = [128, 255, 128];
        //if health is not full
        this.runFunc.push((actor, side) => {
            if (actor instanceof Character)
                if (actor.hp < actor.hp_max) {
                    // Play pickup sound
                    this.touchSFX.currentTime = 0;
                    if (!actor.muted)
                        this.touchSFX.play();
                    actor.hp = Math.min(actor.hp + 50, actor.hp_max); // Add health
                }
                else {
                    this.active = true; // Turn this back on if the player is full health
                }
        });
        if (typeof options === 'object')
            for (var key of Object.keys(options)) {
                this[key] = options[key];
            }
        this.img.src = this.imgFile;
        this.imgSide.src = this.imgFileSide;
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
    constructor(id, posVect, volVect, options = {}) {
        super(id, posVect, volVect, options);
        this.type = 'weapon';
        this.weapon = 'pistol'
        this.item = new Pistol();
        this.ammoMax = 10;
        this.shadowDraw = true;
        this.pickupDelay = ((game.match) ? game.match.ticks : 0) + 180;
        this.touchSFX = sounds.pickup_weapon;
        this.runFunc = [(actor, side) => {
            if (this.pickupDelay < game.match.ticks) {
                if (actor instanceof Character) {
                    if (actor.inventory.length < 2) {
                        if (!actor.muted)
                            this.touchSFX.play();
                        if (actor.parent instanceof Player)
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
                this[key] = options[key];
            }

        if (this.weapon == 'pistol') {
            this.item = new Pistol();
            if (this.ammo == undefined) this.ammo = 12;
            this.ammoMax = 12;
            this.item.ammo = this.ammo;
            if (this.ammo < this.ammoMax) this.imgFile = 'img/sprites/inventory/pistol_inactive.png';
            else this.imgFile = 'img/sprites/inventory/pistol_active.png';
            this.imgFileSide = 'img/sprites/pickups/ammo_ballistic_side.png';
        }
        if (this.weapon == 'rifle') {
            this.item = new Rifle();
            if (this.ammo == undefined) this.ammo = 3;
            this.ammoMax = 3;
            this.item.ammo = this.ammo;
            if (this.ammo < this.ammoMax) this.imgFile = 'img/sprites/inventory/rifle_inactive.png';
            else this.imgFile = 'img/sprites/inventory/rifle_active.png';
            this.imgFileSide = 'img/sprites/pickups/ammo_ballistic_side.png';
        }
        if (this.weapon == 'flamer') {
            this.item = new Flamer();
            if (this.ammo == undefined) this.ammo = 6;
            this.ammoMax = 6;
            this.item.ammo = this.ammo;
            if (this.ammo < this.ammoMax) this.imgFile = 'img/sprites/inventory/flamer_inactive.png';
            else this.imgFile = 'img/sprites/inventory/flamer_active.png';
            this.imgFileSide = 'img/sprites/pickups/ammo_plasma_side.png';
        }
        if (this.weapon == 'lance') {
            this.item = new Lance();
            if (this.ammo == undefined) this.ammo = 4;
            this.ammoMax = 4;
            this.item.ammo = this.ammo;
            if (this.ammo < this.ammoMax) this.imgFile = 'img/sprites/inventory/lance_inactive.png';
            else this.imgFile = 'img/sprites/inventory/lance_active.png';
            this.imgFileSide = 'img/sprites/pickups/ammo_plasma_side.png';
        }
        if (this.weapon == 'sword') {
            this.item = new Sword();
            this.imgFile = 'img/sprites/inventory/sword_active.png';
            this.imgFileSide = 'img/sprites/pickups/grey_side.png';
        }
        this.img.src = this.imgFile;
        this.imgSide.src = this.imgFileSide;
    }
}