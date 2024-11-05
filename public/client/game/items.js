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
        if (game.match.ticks == this.nextCool) {
            if (this.reloading) {
                this.reloading = false;
                if (this.owner instanceof Player)
                    this.reload_done.play();
            }
        }
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
        this.shootSFX = sounds.shoot_pistol;
        this.reload_empty = sounds.reload_empty;
        this.reload_done = sounds.reload_done;
        this.projectileSpeed = 20;
        this.range = 400;
        this.coolDown = 10;
        this.reloadTime = 60;
        this.nextCool = 0;
        this.reloading = false;
        this.ammo = 12;
        this.ammoMax = 12;
        this.icon = new Image();
        this.icon.src = 'img/sprites/inventory/pistol_active.png';
        this.iconInactive = new Image();
        this.iconInactive.src = 'img/sprites/inventory/pistol_inactive.png';
        // Options
        if (typeof options === 'object')
            for (var key of Object.keys(options)) {
                this[key] = options[key];
            }
    }

    use(user, aimX, aimY, aimZ, mode) {
        // Check cooldown
        if (game.match.ticks > this.nextCool) {
            // Stop reloading
            this.reloading = false;
            // Check ammo
            if (this.ammo > 0) {
                // Set next cooldown
                this.nextCool = game.match.ticks + this.coolDown;
                this.ammo--; // consume a bullet
                this.shootSFX.currentTime = 0;
                if (!user.muted) this.shootSFX.play(); // play shoot sound
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
                game.match.map.bullets.push(
                    new Bullet(
                        allID++, // ID
                        new Vect3(user.HB.pos.x, user.HB.pos.y, user.HB.pos.z), new Vect3(4, 4, 0), user, // Position and size
                        {
                            speed: new Vect3(aimX, aimY, 0), //aimZ doesn't work
                            color: user.color
                        }
                    )
                );

                if (user.parent.controller.type == 'gamepad') user.parent.controller.rumble(100, 0.5, 0);
                if (user.parent.controller.type == 'touch' && user.parent.controller.canVibrate) navigator.vibrate(50);


            } else {
                if (this.owner instanceof Player)
                    if (!user.muted)
                        this.reload_empty.play();
                if (user.ammo[this.type] > 0 && !this.reloading) {
                    this.reloading = true;    // set reloading to true
                    this.ammo = this.ammoMax;   // reload
                    this.nextCool = game.match.ticks + this.reloadTime; // set reload time
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
        this.shootSFX = new Audio('sfx/rifle_shoot.wav');
        this.reload_empty = sounds.reload_empty;
        this.reload_done = sounds.reload_done;
        this.projectileSpeed = 30;
        this.damage = 40;
        this.range = 600;
        this.coolDown = 40;
        this.reloadTime = 180;
        this.nextCool = 0;
        this.reloading = false;
        this.ammo = 3;
        this.ammoMax = 3;
        this.icon = new Image();
        this.icon.src = 'img/sprites/inventory/rifle_active.png';
        this.iconInactive = new Image();
        this.iconInactive.src = 'img/sprites/inventory/rifle_inactive.png';
        // Options
        if (typeof options === 'object')
            for (var key of Object.keys(options)) {
                this[key] = options[key];
            }
    }

    use(user, aimX, aimY, aimZ, mode) {
        // Check cooldown
        if (game.match.ticks > this.nextCool) {
            // Stop reloading
            this.reloading = false;
            // Check ammo
            if (this.ammo > 0) {
                // Set next cooldown
                this.nextCool = game.match.ticks + this.coolDown;
                let xaim = aimX;
                let yaim = aimY;
                let zaim = aimZ;
                this.ammo--; // consume a bullet
                this.shootSFX.currentTime = 0;
                if (!user.muted) this.shootSFX.play(); // play shoot sound
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
                // Add bullet to map
                game.match.map.bullets.push(
                    new Bullet(
                        allID++, // ID
                        new Vect3(user.HB.pos.x, user.HB.pos.y, user.HB.pos.z), new Vect3(4, 4, 0), user, // Position and size
                        {
                            speed: new Vect3(xaim, yaim, 0), //zaim doesn't work
                            color: user.color,
                            damage: this.damage,
                            livetime: 300,
                            touchSFX: sounds.hit_rifle
                        }));
                // Change bullet runfunc
                game.match.map.bullets[game.match.map.bullets.length - 1].runFunc.push(
                    function () {
                        let tempx = ((Math.random() * 1) - 0.5) * 2;
                        let tempy = ((Math.random() * 1) - 0.5) * 2;
                        let tempz = ((Math.random() * 1) - 0.5) * 2;
                        game.match.map.debris.push(
                            new Block(
                                allID++,
                                new Vect3(this.HB.pos.x, this.HB.pos.y, this.HB.pos.z),
                                new Vect3(1, 1, 1),
                                {
                                    speed: new Vect3(tempx, tempy, tempz),
                                    HB: new Cube(new Vect3(this.HB.pos.x, this.HB.pos.y, this.HB.pos.z), new Vect3(4, 4, 4)),
                                    z: this.HB.pos.z,
                                    color: [220, 220, 200],
                                    livetime: 15,
                                    dying: true,
                                    shadowDraw: false,
                                    solid: false,
                                }));
                    }.bind(game.match.map.bullets[game.match.map.bullets.length - 1])
                );
                //Change hitSpash
                game.match.map.bullets[game.match.map.bullets.length - 1].hitSplash = function () {
                    for (let parts = 0; parts < 20; parts++) {
                        let tempx = (Math.random() * 4) - 2;
                        let tempy = (Math.random() * 4) - 2;
                        let tempz = (Math.random() * 4) - 2;
                        let tempC = Math.ceil(Math.random() * 255);
                        game.match.map.debris.push(
                            new Block(
                                allID++,
                                new Vect3(this.HB.pos.x, this.HB.pos.y, this.HB.pos.z),
                                new Vect3(1, 1, 1),
                                {
                                    speed: new Vect3(tempx + (this.speed.x * 0.25), tempy + (this.speed.y * 0.25), tempz + (this.speed.z * 0.25)),
                                    HB: new Cube(new Vect3(this.HB.pos.x, this.HB.pos.y, this.HB.pos.z), new Vect3(6, 3, 1)),
                                    z: this.HB.pos.z,
                                    color: [0, tempC, 255],
                                    livetime: 20,
                                    dying: true,
                                    shadowDraw: false,
                                    solid: false
                                }));
                    }
                }.bind(game.match.map.bullets[game.match.map.bullets.length - 1])

                // Push player back by the negative of the aim vector
                user.speed.x -= (aimX / distance) * 10;
                user.speed.y -= (aimY / distance) * 10;
                user.speed.z -= (aimZ / distance) * 10;

                // Shake the camera
                if (user.parent.camera) user.parent.camera.shakeTime = 10;
                if (user.parent.controller.type == 'gamepad') user.parent.controller.rumble(100, 0, 1.0);
                if (user.parent.controller.type == 'touch' && user.parent.controller.canVibrate) navigator.vibrate(50);


            } else {
                if (this.owner instanceof Player)
                    if (!user.muted)
                        this.reload_empty.play();
                if (user.ammo[this.type] > 0 && !this.reloading) {
                    this.reloading = true;    // set reloading to true
                    this.ammo = this.ammoMax;   // reload
                    this.nextCool = game.match.ticks + this.reloadTime; // set reload time
                    user.ammo[this.type]--;      // consume a clip from a user
                    if (this.owner instanceof Player)
                        if (!user.muted)
                            this.reload_empty.play();
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
        this.shootSFX = sounds.shoot_flamer;
        this.reload_empty = sounds.reload_empty;
        this.reload_done = sounds.reload_done;
        this.projectileSpeed = 10;
        this.range = 200;
        this.coolDown = 6;
        this.reloadTime = 60;
        this.nextCool = 0;
        this.reloading = false;
        this.ammo = 6;
        this.ammoMax = 6;
        this.icon = new Image();
        this.icon.src = 'img/sprites/inventory/flamer_active.png';
        this.iconInactive = new Image();
        this.iconInactive.src = 'img/sprites/inventory/flamer_inactive.png';
        // Options
        if (typeof options === 'object')
            for (var key of Object.keys(options)) {
                this[key] = options[key];
            }
    }
    use(user, aimX, aimY, mode) {
        // Check cooldown
        if (game.match.ticks > this.nextCool) {
            user.parent.controller.buttons.fire.last = 0;
            // Check ammo
            if (this.ammo > 0) {
                // Stop reloading
                this.reloading = false;
                // Set next cooldown
                this.nextCool = game.match.ticks + this.coolDown;
                this.ammo--; // consume a bullet
                this.shootSFX.currentTime = 0;
                // if (!user.muted) this.shootSFX.play(); // play shoot sound
                if (!user.muted)
                    this.shootSFX.play(); // play shoot sound
                for (let i = 0; i < 5; i++) {

                    // There's a serious bug here.
                    // The first bullet always shoots in the direction of the cursor
                    // The rest will spread out weirdly

                    let distance = Math.sqrt(aimX ** 2 + aimY ** 2);
                    aimX = (aimX / distance) * (this.projectileSpeed + user.speed.x);
                    aimY = (aimY / distance) * (this.projectileSpeed + user.speed.y);

                    let spreadMagnitude = user.accuracy * 30;

                    let spreadX = (Math.random() * 2 - 1) * spreadMagnitude;
                    let spreadY = (Math.random() * 2 - 1) * spreadMagnitude;

                    aimX += spreadX;
                    aimY += spreadY;
                    // Add bullets to map
                    game.match.map.bullets.push(
                        new Bullet(
                            allID++, // ID
                            new Vect3(user.HB.pos.x, user.HB.pos.y, user.HB.pos.z), new Vect3(4, 4, 0), user, // Position and size
                            {
                                livetime: 16,
                                speed: new Vect3(aimX, aimY, 0),
                                color: user.color,
                                damage: 10,
                                touchSFX: sounds.hit_flamer
                            }
                        )
                    );
                }

                if (user.parent.controller.type == 'gamepad') user.parent.controller.rumble(100, 0, 0.5);
                if (user.parent.controller.type == 'touch' && user.parent.controller.canVibrate) navigator.vibrate(50);


            } else {
                if (this.owner instanceof Player)
                    if (!user.muted)
                        this.reload_empty.play();
                if (user.ammo[this.type] > 0 && !this.reloading) {
                    this.reloading = true;    // set reloading to true
                    this.ammo = this.ammoMax;   // reload
                    this.nextCool = game.match.ticks + this.reloadTime; // set reload time
                    user.ammo[this.type]--;      // consume a clip from a user
                    if (this.owner instanceof Player)
                        if (!user.muted)
                            this.reload_empty.play();
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
        this.shootSFX = sounds.shoot_lance;
        this.reload_empty = sounds.reload_empty;
        this.reload_done = sounds.reload_done;
        this.boostSpeed = 15;
        this.hopSpeed = 6;
        this.range = 300;
        this.coolDown = 120;
        this.reloadTime = 60;
        this.nextCool = 0;
        this.reloading = false;
        this.ammo = 4;
        this.ammoMax = 4;
        this.icon = new Image();
        this.icon.src = 'img/sprites/inventory/lance_active.png';
        this.iconInactive = new Image();
        this.iconInactive.src = 'img/sprites/inventory/lance_inactive.png';
        // Options
        if (typeof options === 'object')
            for (var key of Object.keys(options)) {
                this[key] = options[key];
            }
    }

    use(user, aimX, aimY, aimZ, mode) {
        // Check cooldown
        if (game.match.ticks > this.nextCool) {
            // Stop reloading
            this.reloading = false;
            // Check ammo
            if (this.ammo > 0) {
                // Set next cooldown
                this.nextCool = game.match.ticks + this.coolDown;
                this.ammo--; // consume a bullet
                this.shootSFX.currentTime = 0;
                if (!user.muted) this.shootSFX.play(); // play shoot sound
                //find the distance from player to mouse with pythagorean theorem
                let distance = ((aimX ** 2) + (aimY ** 2)) ** 0.5;
                //Normalize the dimension distance by the real distance (ratio)
                aimX = (aimX / distance) * this.boostSpeed;
                aimY = (aimY / distance) * this.boostSpeed;
                aimZ = (aimZ / distance) * this.boostSpeed;

                aimZ += this.hopSpeed;

                // add aim to user speed
                user.speed.x += aimX;
                user.speed.y += aimY;
                user.speed.z += aimZ;

                // Add a new missile at this user's position
                game.match.map.bullets.push(
                    new Bullet(
                        allID++, // ID
                        new Vect3(user.HB.pos.x, user.HB.pos.y, user.HB.pos.z), new Vect3(4, 4, 0), user, // Position and size
                        {
                            speed: new Vect3(aimX, aimY, 0),
                            parent: user,
                            color: user.color,
                            damage: 10,
                            livetime: 30,
                            touchSFX: sounds.hit_lance,
                            opacity: 0,
                            shadowDraw: false,
                            force: 1
                        }
                    )
                );
                // Run this function every frame the bullet is alive
                game.match.map.bullets[game.match.map.bullets.length - 1].runFunc.push(
                    function () {
                        // Match the user's position
                        this.HB.pos.x = this.parent.HB.pos.x;
                        this.HB.pos.y = this.parent.HB.pos.y;
                        this.HB.pos.z = this.parent.HB.pos.z;
                        // this damage is equal to the true speed of the player
                        this.damage = Math.sqrt(Math.abs(this.parent.speed.x) ** 2 + Math.abs(this.parent.speed.y) ** 2 + Math.abs(this.parent.speed.z) ** 2);
                        // multiply damage
                        this.damage *= 2;
                        // add a debris block to the map at the player's position with a random speed
                        let tempx = ((Math.random() * 1) - 0.5) * 10;
                        let tempy = ((Math.random() * 1) - 0.5) * 10;
                        let tempz = ((Math.random() * 1) - 0.5) * 10;
                        let tempC1 = Math.ceil(Math.random() * 255);
                        let tempC2 = Math.ceil(Math.random() * 255);
                        // add a debris block to the map at the player's position with a random speed
                        game.match.map.debris.push(
                            new Block(
                                allID++,
                                new Vect3(this.HB.pos.x, this.HB.pos.y, this.HB.pos.z),
                                new Vect3(1, 1, 1),
                                {
                                    speed: new Vect3(tempx, tempy, tempz),
                                    HB: new Cube(new Vect3(this.HB.pos.x, this.HB.pos.y, this.HB.pos.z), new Vect3(4, 4, 4)),
                                    z: this.HB.pos.z,
                                    color: [tempC1, 0, tempC2],
                                    colorSide: [tempC2, 0, tempC1],
                                    livetime: 15,
                                    dying: true,
                                    shadowDraw: false,
                                    solid: false,
                                }));

                    }.bind(game.match.map.bullets[game.match.map.bullets.length - 1])
                )
                //Change hitSpash
                game.match.map.bullets[game.match.map.bullets.length - 1].hitSplash = function () {
                    for (let parts = 0; parts < 20; parts++) {
                        let tempx = (Math.random() * 4) - 2;
                        let tempy = (Math.random() * 4) - 2;
                        let tempz = (Math.random() * 4) - 2;
                        let tempC = Math.ceil(Math.random() * 255);
                        game.match.map.debris.push(
                            new Block(
                                allID++,
                                new Vect3(this.HB.pos.x, this.HB.pos.y, this.HB.pos.z),
                                new Vect3(1, 1, 1),
                                {
                                    speed: new Vect3(tempx + (this.speed.x * 0.25), tempy + (this.speed.y * 0.25), tempz + (this.speed.z * 0.25)),
                                    HB: new Cube(new Vect3(this.HB.pos.x, this.HB.pos.y, this.HB.pos.z), new Vect3(6, 3, 1)),
                                    z: this.HB.pos.z,
                                    color: [255, tempC, 0],
                                    livetime: 20,
                                    dying: true,
                                    shadowDraw: false,
                                    solid: false
                                }));
                    }
                }.bind(game.match.map.bullets[game.match.map.bullets.length - 1])
                game.match.map.bullets[game.match.map.bullets.length - 1].HB.radius = user.HB.radius + 10;

                // If the user has a gamepad, rumble
                if (user.parent.controller.type == 'gamepad') user.parent.controller.rumble(100, 1.0, 0);
                if (user.parent.controller.type == 'touch' && user.parent.controller.canVibrate) navigator.vibrate(50);



            } else {
                if (this.owner instanceof Player)
                    if (!user.muted)
                        this.reload_empty.play();
                if (user.ammo[this.type] > 0 && !this.reloading) {
                    this.reloading = true;    // set reloading to true
                    this.ammo = this.ammoMax;   // reload
                    this.nextCool = game.match.ticks + this.reloadTime; // set reload time
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
        this.shootSFX = sounds.shoot_sword;
        this.reload_empty = sounds.reload_empty;
        this.reload_done = sounds.reload_done;
        this.ppCost = 40;
        this.range = 150;
        this.coolDown = 10;
        this.reloadTime = 0;
        this.nextCool = 0;
        this.reloading = false;
        this.ammo = 1;
        this.ammoMax = 1;
        this.icon = new Image();
        this.icon.src = 'img/sprites/inventory/sword_active.png';
        this.iconInactive = new Image();
        this.iconInactive.src = 'img/sprites/inventory/sword_inactive.png';
        // Options
        if (typeof options === 'object')
            for (var key of Object.keys(options)) {
                this[key] = options[key];
            }
    }

    use(user, aimX, aimY, aimZ, mode) {
        // Check cooldown
        if (game.match.ticks > this.nextCool) {
            // Stop reloading
            this.reloading = false;
            // Check ammo
            if (user.pp >= this.ppCost) {
                user.pp -= this.ppCost;
                // Set next cooldown
                this.nextCool = game.match.ticks + this.coolDown;
                this.shootSFX.currentTime = 0;
                if (!user.muted) this.shootSFX.play(); // play shoot sound
                //find the distance from player to mouse with pythagorean theorem
                let distance = ((aimX ** 2) + (aimY ** 2)) ** 0.5;
                //Normalize the dimension distance by the real distance (ratio)
                aimX = (aimX / distance) * 30;
                aimY = (aimY / distance) * 30;
                aimZ = (aimZ / distance) * 30;

                // Add a new missile at this user's position
                game.match.map.bullets.push(
                    new Bullet(
                        allID++, // ID
                        new Vect3(user.HB.pos.x, user.HB.pos.y, user.HB.pos.z), new Vect3(4, 4, 0), user, // Position and size
                        {
                            speed: new Vect3(aimX, aimY, 0),
                            parent: user,
                            color: user.color,
                            damage: 10,
                            livetime: 10,
                            touchSFX: sounds.hit_lance,
                            opacity: 0,
                            shadowDraw: false,
                            force: 0.2
                        }
                    )
                );
                // Overwrite the runFunc list with this function
                // TODO: Make a new bullet class for a sword strike
                game.match.map.bullets[game.match.map.bullets.length - 1].runFunc = [
                    function () {
                        this.HB.pos.x = this.parent.HB.pos.x + aimX;
                        this.HB.pos.y = this.parent.HB.pos.y + aimY;
                        this.HB.pos.z = this.parent.HB.pos.z + aimZ;

                        // add a debris block to the map at the player's position with a random speed
                        let tempx = ((Math.random() * 1) - 0.5) * 2;
                        let tempy = ((Math.random() * 1) - 0.5) * 2;
                        let tempz = ((Math.random() * 1) - 0.5) * 2;
                        let tempC1 = Math.ceil(Math.random() * 255);
                        let tempC2 = Math.ceil(Math.random() * 255);

                        let compareX = this.HB.pos.x - ((this.parent.HB.pos.x - this.HB.pos.x) / 2);
                        let compareY = this.HB.pos.y - ((this.parent.HB.pos.y - this.HB.pos.y) / 2);

                        game.match.map.debris.push(
                            new Block(
                                allID++,
                                new Vect3(this.HB.pos.x, this.HB.pos.y, this.HB.pos.z),
                                new Vect3(1, 1, 1),
                                {
                                    speed: new Vect3(tempx, tempy, tempz),
                                    HB: new Cube(new Vect3(compareX, compareY, this.HB.pos.z + this.HB.height), new Vect3(2, 2, 2)),
                                    z: this.HB.pos.z,
                                    color: [tempC1, tempC1, tempC1],
                                    colorSide: [tempC2, tempC2, tempC2],
                                    livetime: 15,
                                    dying: true,
                                    shadowDraw: false,
                                    solid: false,
                                }));

                    }.bind(game.match.map.bullets[game.match.map.bullets.length - 1])
                ];
                // Add custom draw function
                game.match.map.bullets[game.match.map.bullets.length - 1].drawFunc.push(
                    function () {
                        // Draw a line from the user to the bullet
                        ctx.beginPath();
                        ctx.strokeStyle = 'rgba(200,200,200,1)';
                        ctx.lineWidth = 5;
                        // find where the user is on the camera
                        let compareX = game.player.camera.x - this.parent.HB.pos.x;
                        let compareY = game.player.camera.y - this.parent.HB.pos.y;
                        ctx.moveTo(
                            game.window.w / 2 - compareX,
                            game.window.h / 2 - compareY - this.parent.HB.pos.z - this.parent.HB.height / 2
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
                            game.window.h / 2 - compareY - targetY - this.parent.HB.pos.z - this.parent.HB.height / 2
                        );
                        ctx.stroke();
                    }.bind(game.match.map.bullets[game.match.map.bullets.length - 1])
                )
                //Change hitSpash
                game.match.map.bullets[game.match.map.bullets.length - 1].hitSplash = function () {
                    for (let parts = 0; parts < 20; parts++) {
                        let tempx = (Math.random() * 4) - 2;
                        let tempy = (Math.random() * 4) - 2;
                        let tempz = (Math.random() * 4) - 2;
                        let tempC = Math.ceil(Math.random() * 255);
                        game.match.map.debris.push(
                            new Block(
                                allID++,
                                new Vect3(this.HB.pos.x, this.HB.pos.y, this.HB.pos.z),
                                new Vect3(1, 1, 1),
                                {
                                    speed: new Vect3(tempx + (this.speed.x * 0.25), tempy + (this.speed.y * 0.25), tempz + (this.speed.z * 0.25)),
                                    HB: new Cube(new Vect3(this.HB.pos.x, this.HB.pos.y, this.HB.pos.z), new Vect3(6, 3, 1)),
                                    z: this.HB.pos.z,
                                    color: [tempC, tempC, tempC],
                                    livetime: 20,
                                    dying: true,
                                    shadowDraw: false,
                                    solid: false
                                }));
                    }
                }.bind(game.match.map.bullets[game.match.map.bullets.length - 1])
                game.match.map.bullets[game.match.map.bullets.length - 1].HB.radius = user.HB.radius + 10;


            } else {
                if (this.owner instanceof Player)
                    if (!user.muted)
                        this.reload_empty.play();
                if (user.ammo[this.type] > 0 && !this.reloading) {
                    this.reloading = true;    // set reloading to true
                    this.ammo = this.ammoMax;   // reload
                    this.nextCool = game.match.ticks + this.reloadTime; // set reload time
                    user.ammo[this.type]--;      // consume a clip from a user
                }
            }
        }
    }
}