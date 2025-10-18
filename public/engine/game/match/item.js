(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['Projectiles', 'Utils', 'Blocks'], factory);
    } else if (typeof module === 'object' && module.exports) {
        // Nodejs
        const Projectiles = require('./block/projectile.js');
        const Utils = require('../../utils.js');
        const Blocks = require('./block/block.js');
        module.exports = factory(Projectiles, Utils, Blocks);
    } else {
        // Browser globals (root is window)
        root.Items = factory(root.Projectiles, root.Utils, root.Blocks);
    }
}(typeof self !== 'undefined' ? self : this, function (Projectiles, Utils, Blocks) {

    /*
          ::::::::::: ::::::::::: ::::::::::   :::   :::
             :+:         :+:     :+:         :+:+: :+:+:
            +:+         +:+     +:+        +:+ +:+:+ +:+
           +#+         +#+     +#++:++#   +#+  +:+  +#+
          +#+         +#+     +#+        +#+       +#+
         #+#         #+#     #+#        #+#       #+#
    ###########     ###     ########## ###       ###
    */
    class Item {
        constructor(options) {
            // Options
            if (typeof options === 'object')
                for (var key of Object.keys(options)) {
                    this[key] = options[key];
                }
        }

        use(user, xaim, yaim, mode) {
        }

        step() {
            if (game.match.time.ticks == this.nextCool) {
                if (this.reloading) {
                    this.reloading = false;
                    if (this.owner && typeof window !== 'undefined')
                        this.reload_done.play().catch(err => {});
                }
            }
        }

        pack() {
            return {
                type: this.type,
                name: this.name,
                weapon: this.weapon,
                ammo: this.ammo,
                ammoMax: this.ammoMax
            }
        }

        fullPack() {
            let packed = {};
            for (var key of Object.keys(this)) {
                if (typeof this[key] !== 'function') {
                    if (!packed[key])
                        packed[key] = this[key];
                }
            }
            return packed;
        }

    }

    /*
          ::::::::: ::::::::::: :::::::: ::::::::::: ::::::::  :::
         :+:    :+:    :+:    :+:    :+:    :+:    :+:    :+: :+:
        +:+    +:+    +:+    +:+           +:+    +:+    +:+ +:+
       +#++:++#+     +#+    +#++:++#++    +#+    +#+    +:+ +#+
      +#+           +#+           +#+    +#+    +#+    +#+ +#+
     #+#           #+#    #+#    #+#    #+#    #+#    #+# #+#
    ###       ########### ########     ###     ########  ##########
    */
    class Pistol extends Item {
        constructor(options) {
            super(options);
            this.type = 'ballistic';
            this.name = 'Plutonian Pistol';
            this.weapon = 'pistol';
            if (typeof window !== 'undefined') {
                this.shootSFX = Sounds.shoot_pistol;
                this.reload_empty = Sounds.reload_empty;
                this.reload_done = Sounds.reload_done;
                this.icon = new Image();
                this.icon.src = 'img/sprites/inventory/pistol_active.png';
                this.iconInactive = new Image();
                this.iconInactive.src = 'img/sprites/inventory/pistol_inactive.png';
            }
            this.projectileSpeed = 20;
            this.range = 400;
            this.coolDown = 10;
            this.reloadTime = 60;
            this.nextCool = 0;
            this.reloading = false;
            this.ammo = 12;
            this.ammoMax = 12;
            // Options
            if (typeof options === 'object')
                for (var key of Object.keys(options)) {
                    this[key] = options[key];
                }
        }

        use(user, aimX, aimY, aimZ, mode) {
            // Check cooldown
            if (game.match.time.ticks > this.nextCool) {
                // Stop reloading
                this.reloading = false;
                // Check ammo
                if (this.ammo > 0) {
                    // Set next cooldown
                    this.nextCool = game.match.time.ticks + this.coolDown;
                    this.ammo--; // consume a bullet
                    if (typeof window !== 'undefined') {
                        this.shootSFX.currentTime = 0;
                        if (!user.muted) this.shootSFX.play().catch(err => {}); // play shoot sound
                    }
                    //find the distance from player to mouse with pythagorean theorem
                    let distance = ((aimX ** 2) + (aimY ** 2)) ** 0.5;
                    //Normalize the dimension distance by the real distance (ratio)
                    aimX = (aimX / distance);
                    aimY = (aimY / distance);
                    aimZ = (aimZ / distance);
                    // Add the user's speed and multiply speed BEFORE spread for satisfying flamer
                    let spreadMagnitude = user.accuracy; // Apply spread and user accuracy
                    // Randomize spread
                    let spreadX = (Math.random() * 2 - 1) * spreadMagnitude;
                    let spreadY = (Math.random() * 2 - 1) * spreadMagnitude;
                    let spreadZ = (Math.random() * 2 - 1) * spreadMagnitude;
                    // Add spread to aim
                    aimX += spreadX;
                    aimY += spreadY;
                    aimZ += spreadZ;
                    // Multiply by this bullet's speed
                    aimX *= this.projectileSpeed;
                    aimY *= this.projectileSpeed;
                    aimZ *= this.projectileSpeed;
                    // Add bullet to map
                    if (typeof window === 'undefined')
                        game.match.map.bullets.push(
                            new Projectiles.Bullet(
                                {
                                    spawnPos: new Utils.Vect3(user.HB.pos.x, user.HB.pos.y, user.HB.pos.z), // Position
                                    radius: 4, // size
                                    height: 4,
                                    user: user, // the person firing this bullet
                                    speed: new Utils.Vect3(aimX, aimY, 0), //aimZ doesn't work
                                    color: user.color
                                }
                            )
                        );

                    if (user.parent.controller.type == 'gamepad') user.parent.controller.rumble(100, 0.5, 0);
                    if (user.parent.controller.type == 'touch' && user.parent.controller.canVibrate) navigator.vibrate(50);


                } else {
                    if (this.owner && typeof window !== 'undefined')
                        if (!user.muted)
                            this.reload_empty.play().catch(err => {});
                    if (user.ammo[this.type] > 0 && !this.reloading) {
                        this.reloading = true;    // set reloading to true
                        this.ammo = this.ammoMax;   // reload
                        this.nextCool = game.match.time.ticks + this.reloadTime; // set reload time
                        user.ammo[this.type]--;      // consume a clip from a user
                    }
                }
            }
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
    class Rifle extends Item {
        constructor(options) {
            super(options);
            this.type = 'ballistic';
            this.name = 'Mercurian Rifle';
            this.weapon = 'rifle';
            if (typeof window !== 'undefined') {
                this.shootSFX = new Audio('sfx/rifle_shoot.wav');
                this.reload_empty = Sounds.reload_empty;
                this.reload_done = Sounds.reload_done;
                this.icon = new Image();
                this.icon.src = 'img/sprites/inventory/rifle_active.png';
                this.iconInactive = new Image();
                this.iconInactive.src = 'img/sprites/inventory/rifle_inactive.png';
            }
            this.projectileSpeed = 30;
            this.damage = 40;
            this.range = 600;
            this.coolDown = 40;
            this.reloadTime = 180;
            this.nextCool = 0;
            this.reloading = false;
            this.ammo = 3;
            this.ammoMax = 3;
            // Options
            if (typeof options === 'object')
                for (var key of Object.keys(options)) {
                    this[key] = options[key];
                }
        }

        use(user, aimX, aimY, aimZ, mode) {
            // Check cooldown
            if (game.match.time.ticks > this.nextCool) {
                // Stop reloading
                this.reloading = false;
                // Check ammo
                if (this.ammo > 0) {
                    // Set next cooldown
                    this.nextCool = game.match.time.ticks + this.coolDown;
                    let xaim = aimX;
                    let yaim = aimY;
                    let zaim = aimZ;
                    this.ammo--; // consume a bullet
                    if (typeof window !== 'undefined') {
                        this.shootSFX.currentTime = 0;
                        if (!user.muted) this.shootSFX.play().catch(err => {}); // play shoot sound
                    }
                    //find the distance from player to mouse with pythagorean theorem
                    let distance = ((xaim ** 2) + (yaim ** 2)) ** 0.5;
                    //Normalize the dimension distance by the real distance (ratio)
                    xaim = (xaim / distance);
                    yaim = (yaim / distance);
                    zaim = (zaim / distance);
                    // Multiply by this bullet's speed
                    xaim *= this.projectileSpeed;
                    yaim *= this.projectileSpeed;
                    zaim *= this.projectileSpeed;
                    // Add the user's speed and multiply speed BEFORE spread for satisfying flamer ???
                    // Add bullet to map (server-side only)
                    if (typeof window === 'undefined')
                        game.match.map.bullets.push(
                            new Projectiles.RifleBullet(
                                {
                                    spawnPos: new Utils.Vect3(user.HB.pos.x, user.HB.pos.y, user.HB.pos.z),
                                    radius: 4,
                                    height: 4,
                                    user: user, // Position and size
                                    speed: new Utils.Vect3(xaim, yaim, 0), //zaim doesn't work
                                    color: user.color,
                                    damage: this.damage,
                                    livetime: 300,
                                    touchSFX: Utils.isClient() ? Sounds.hit_rifle : null
                                }));

                    // Push player back by the negative of the aim vector
                    user.speed.x -= (aimX / distance) * 10;
                    user.speed.y -= (aimY / distance) * 10;
                    user.speed.z -= (aimZ / distance) * 10;

                    // Shake the camera
                    if (user.parent.camera) user.parent.camera.shakeTime = 10;
                    if (user.parent.controller.type == 'gamepad') user.parent.controller.rumble(100, 0, 1.0);
                    if (user.parent.controller.type == 'touch' && user.parent.controller.canVibrate) navigator.vibrate(50);


                } else {
                    if (this.owner && typeof window !== 'undefined')
                        if (!user.muted)
                            this.reload_empty.play().catch(err => {});
                    if (user.ammo[this.type] > 0 && !this.reloading) {
                        this.reloading = true;    // set reloading to true
                        this.ammo = this.ammoMax;   // reload
                        this.nextCool = game.match.time.ticks + this.reloadTime; // set reload time
                        user.ammo[this.type]--;      // consume a clip from a user
                        if (this.owner && typeof window !== 'undefined')
                            if (!user.muted)
                                this.reload_empty.play().catch(err => {});
                    }
                }
            }
        }
    }

    /*
          :::::::::: :::            :::       :::   :::   :::::::::: :::::::::
         :+:        :+:          :+: :+:    :+:+: :+:+:  :+:        :+:    :+:
        +:+        +:+         +:+   +:+  +:+ +:+:+ +:+ +:+        +:+    +:+
       :#::+::#   +#+        +#++:++#++: +#+  +:+  +#+ +#++:++#   +#++:++#:
      +#+        +#+        +#+     +#+ +#+       +#+ +#+        +#+    +#+
     #+#        #+#        #+#     #+# #+#       #+# #+#        #+#    #+#
    ###        ########## ###     ### ###       ### ########## ###    ###
    */
    class Flamer extends Item {
        constructor(options) {
            super(options);
            this.type = 'plasma';
            this.name = 'Venusian Lotus';
            this.weapon = 'flamer';
            if (typeof window !== 'undefined') {
                this.shootSFX = Sounds.shoot_flamer;
                this.reload_empty = Sounds.reload_empty;
                this.reload_done = Sounds.reload_done;
                this.icon = new Image();
                this.icon.src = 'img/sprites/inventory/flamer_active.png';
                this.iconInactive = new Image();
                this.iconInactive.src = 'img/sprites/inventory/flamer_inactive.png';
            }
            this.projectileSpeed = 10;
            this.range = 200;
            this.coolDown = 6;
            this.reloadTime = 60;
            this.nextCool = 0;
            this.reloading = false;
            this.ammo = 6;
            this.ammoMax = 6;
            // Options
            if (typeof options === 'object')
                for (var key of Object.keys(options)) {
                    this[key] = options[key];
                }
        }
        use(user, aimX, aimY, mode) {
            // Check cooldown
            if (game.match.time.ticks > this.nextCool) {
                user.parent.controller.buttons.fire.last = 0;
                // Check ammo
                if (this.ammo > 0) {
                    // Stop reloading
                    this.reloading = false;
                    // Set next cooldown
                    this.nextCool = game.match.time.ticks + this.coolDown;
                    this.ammo--; // consume a bullet
                    if (typeof window !== 'undefined') {
                        this.shootSFX.currentTime = 0;
                        if (!user.muted) this.shootSFX.play().catch(err => {}); // play shoot sound
                    }
                    if (!user.muted && Utils.isClient())
                        this.shootSFX.play().catch(err => {}); // play shoot sound
                    
                    // Calculate base aim direction with user momentum
                    let distance = Math.sqrt(aimX ** 2 + aimY ** 2);
                    let baseAimX = (aimX / distance) * this.projectileSpeed;
                    let baseAimY = (aimY / distance) * this.projectileSpeed;
                    
                    // Shoot 5 bullets with spread
                    for (let i = 0; i < 5; i++) {
                        let spreadMagnitude = 5; // Wide spread for flamer
                        let spreadX = (Math.random() * 2 - 1) * spreadMagnitude;
                        let spreadY = (Math.random() * 2 - 1) * spreadMagnitude;
                        
                        // Each bullet gets base aim + user momentum + spread
                        let bulletAimX = baseAimX + user.speed.x + spreadX;
                        let bulletAimY = baseAimY + user.speed.y + spreadY;
                        
                        // Add bullets to map
                        if (typeof window === 'undefined')
                            game.match.map.bullets.push(
                                new Projectiles.Bullet(
                                    {
                                        spawnPos: new Utils.Vect3(user.HB.pos.x, user.HB.pos.y, user.HB.pos.z),
                                        radius: 4,
                                        height: 4,
                                        user: user, // Position and size
                                        livetime: 16, // Short range
                                        speed: new Utils.Vect3(bulletAimX, bulletAimY, 0),
                                        color: user.color,
                                        damage: 10,
                                        touchSFX: Utils.isClient() ? Sounds.hit_flamer : null
                                    }
                                )
                            );
                    }

                    if (user.parent.controller.type == 'gamepad') user.parent.controller.rumble(100, 0, 0.5);
                    if (user.parent.controller.type == 'touch' && user.parent.controller.canVibrate) navigator.vibrate(50);


                } else {
                    if (this.owner && typeof window !== 'undefined')
                        if (!user.muted)
                            this.reload_empty.play().catch(err => {});
                    if (user.ammo[this.type] > 0 && !this.reloading) {
                        this.reloading = true;    // set reloading to true
                        this.ammo = this.ammoMax;   // reload
                        this.nextCool = game.match.time.ticks + this.reloadTime; // set reload time
                        user.ammo[this.type]--;      // consume a clip from a user
                        if (this.owner && typeof window !== 'undefined')
                            if (!user.muted)
                                this.reload_empty.play().catch(err => {});
                    }
                }
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
    class Lance extends Item {
        constructor(options) {
            super(options);
            this.type = 'plasma';
            this.name = 'Martian Lance';
            this.weapon = 'lance';
            if (typeof window !== 'undefined') {
                this.shootSFX = Sounds.shoot_lance;
                this.reload_empty = Sounds.reload_empty;
                this.reload_done = Sounds.reload_done;
                this.icon = new Image();
                this.icon.src = 'img/sprites/inventory/lance_active.png';
                this.iconInactive = new Image();
                this.iconInactive.src = 'img/sprites/inventory/lance_inactive.png';
            }
            this.boostSpeed = 15;
            this.hopSpeed = 6;
            this.range = 300;
            this.coolDown = 120;
            this.reloadTime = 60;
            this.nextCool = 0;
            this.reloading = false;
            this.ammo = 4;
            this.ammoMax = 4;
            // Options
            if (typeof options === 'object')
                for (var key of Object.keys(options)) {
                    this[key] = options[key];
                }
        }

        use(user, aimX, aimY, aimZ, mode) {
            // Check cooldown
            if (game.match.time.ticks > this.nextCool) {
                // Stop reloading
                this.reloading = false;
                // Check ammo
                if (this.ammo > 0) {
                    // Set next cooldown
                    this.nextCool = game.match.time.ticks + this.coolDown;
                    this.ammo--; // consume a bullet
                    if (typeof window !== 'undefined') {
                        this.shootSFX.currentTime = 0;
                        if (!user.muted) this.shootSFX.play().catch(err => {}); // play shoot sound
                    }
                    //find the distance from player to mouse with pythagorean theorem
                    let distance = ((aimX ** 2) + (aimY ** 2)) ** 0.5;
                    //Normalize the dimension distance by the real distance (ratio)
                    let normalizedAimX = aimX / distance;
                    let normalizedAimY = aimY / distance;
                    let normalizedAimZ = aimZ / distance;
                    
                    let boostX = normalizedAimX * this.boostSpeed;
                    let boostY = normalizedAimY * this.boostSpeed;
                    let boostZ = normalizedAimZ * this.boostSpeed;

                    boostZ += this.hopSpeed;

                    // add aim to user speed
                    user.speed.x += boostX;
                    user.speed.y += boostY;
                    user.speed.z += boostZ;

                    // Add a new lance slash at this user's position (raycast like sword)
                    if (typeof window === 'undefined')
                        game.match.map.bullets.push(
                            new Projectiles.LanceSlash(
                                {
                                    spawnPos: new Utils.Vect3(user.HB.pos.x, user.HB.pos.y, user.HB.pos.z),
                                    radius: 4,
                                    height: 4,
                                    user: user,
                                    speed: new Utils.Vect3(normalizedAimX * 30, normalizedAimY * 30, 0),
                                    parent: user,
                                    color: user.color
                                }
                            )
                        );

                    // If the user has a gamepad, rumble
                    if (user.parent.controller.type == 'gamepad') user.parent.controller.rumble(100, 1.0, 0);
                    if (user.parent.controller.type == 'touch' && user.parent.controller.canVibrate) navigator.vibrate(50);



                } else {
                    if (this.owner && typeof window !== 'undefined')
                        if (!user.muted)
                            this.reload_empty.play().catch(err => {});
                    if (user.ammo[this.type] > 0 && !this.reloading) {
                        this.reloading = true;    // set reloading to true
                        this.ammo = this.ammoMax;   // reload
                        this.nextCool = game.match.time.ticks + this.reloadTime; // set reload time
                        user.ammo[this.type]--;      // consume a clip from a user
                    }
                }
            }
        }
    }

    /*
          ::::::::  :::       :::  ::::::::  :::::::::  :::::::::
        :+:    :+: :+:       :+: :+:    :+: :+:    :+: :+:    :+:
       +:+        +:+       +:+ +:+    +:+ +:+    +:+ +:+    +:+
      +#++:++#++ +#+  +:+  +#+ +#+    +:+ +#++:++#:  +#+    +:+
            +#+ +#+ +#+#+ +#+ +#+    +#+ +#+    +#+ +#+    +#+
    #+#    #+#  #+#+# #+#+#  #+#    #+# #+#    #+# #+#    #+#
    ########    ###   ###    ########  ###    ### #########
    */
    class Sword extends Item {
        constructor(options) {
            super(options);
            this.type = 'none';
            this.name = 'Saturnian Scimitar';
            this.weapon = 'sword';
            if (typeof window !== 'undefined') {
                this.shootSFX = Sounds.shoot_sword;
                this.reload_empty = Sounds.reload_empty;
                this.reload_done = Sounds.reload_done;
                this.icon = new Image();
                this.icon.src = 'img/sprites/inventory/sword_active.png';
                this.iconInactive = new Image();
                this.iconInactive.src = 'img/sprites/inventory/sword_inactive.png';
            }
            this.ppCost = 40;
            this.range = 150;
            this.coolDown = 10;
            this.reloadTime = 0;
            this.nextCool = 0;
            this.reloading = false;
            this.ammo = 1;
            this.ammoMax = 1;
            // Options
            if (typeof options === 'object')
                for (var key of Object.keys(options)) {
                    this[key] = options[key];
                }
        }

        use(user, aimX, aimY, aimZ, mode) {
            // Check cooldown
            if (game.match.time.ticks > this.nextCool) {
                // Stop reloading
                this.reloading = false;
                // Check ammo
                if (user.pp >= this.ppCost) {
                    user.pp -= this.ppCost;
                    // Set next cooldown
                    this.nextCool = game.match.time.ticks + this.coolDown;
                    if (typeof window !== 'undefined') {
                        this.shootSFX.currentTime = 0;
                        if (!user.muted) this.shootSFX.play().catch(err => {}); // play shoot sound
                    }
                    //find the distance from player to mouse with pythagorean theorem
                    let distance = ((aimX ** 2) + (aimY ** 2)) ** 0.5;
                    //Normalize the dimension distance by the real distance (ratio)
                    aimX = (aimX / distance) * 30;
                    aimY = (aimY / distance) * 30;
                    aimZ = (aimZ / distance) * 30;

                    // Add a new missile at this user's position
                    if (typeof window === 'undefined') {
                        game.match.map.bullets.push(
                            new Projectiles.Slash(
                                {
                                    spawnPos: new Utils.Vect3(user.HB.pos.x, user.HB.pos.y, user.HB.pos.z),
                                    radius: 4,
                                    height: 4,
                                    user: user,
                                    speed: new Utils.Vect3(aimX, aimY, 0),
                                    parent: user,
                                    color: user.color
                                }
                            )
                        );
                    }
                } else {
                    if (this.owner && typeof window !== 'undefined')
                        if (!user.muted)
                            this.reload_empty.play().catch(err => {});
                    if (user.ammo[this.type] > 0 && !this.reloading) {
                        this.reloading = true;    // set reloading to true
                        this.ammo = this.ammoMax;   // reload
                        this.nextCool = game.match.time.ticks + this.reloadTime; // set reload time
                        user.ammo[this.type]--;      // consume a clip from a user
                    }
                }
            }
        }
    }

    return { Item, Pistol, Rifle, Flamer, Lance, Sword };
}));