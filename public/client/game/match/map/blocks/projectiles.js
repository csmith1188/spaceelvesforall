/*
      :::::::::  :::::::::   ::::::::  ::::::::::: :::::::::: :::::::: ::::::::::: ::::::::::: :::        :::::::::: ::::::::
     :+:    :+: :+:    :+: :+:    :+:     :+:     :+:       :+:    :+:    :+:         :+:     :+:        :+:       :+:    :+:
    +:+    +:+ +:+    +:+ +:+    +:+     +:+     +:+       +:+           +:+         +:+     +:+        +:+       +:+
   +#++:++#+  +#++:++#:  +#+    +:+     +#+     +#++:++#  +#+           +#+         +#+     +#+        +#++:++#  +#++:++#++
  +#+        +#+    +#+ +#+    +#+     +#+     +#+       +#+           +#+         +#+     +#+        +#+              +#+
 #+#        #+#    #+# #+#    #+# #+# #+#     #+#       #+#    #+#    #+#         #+#     #+#        #+#       #+#    #+#
###        ###    ###  ########   #####      ########## ########     ###     ########### ########## ########## ########
*/
class Bullet extends Block {
    constructor(id, posVect, volVect, user, options) {
        super(id, posVect, volVect, options);
        this.user = user;
        this.HB = new Cylinder(new Vect3(posVect.x, posVect.y, posVect.z), volVect.x, volVect.y);
        this.dying = true;
        this.livetime = 100;
        this.type = 'bullet';
        this.color = [255, 0, 0];
        this.colorSide = [255, 128, 0];
        this.touchSFX = new Audio('sfx/hit_01.wav');
        this.damage = 10;
        this.force = 0.15; // How much of this projectile's speed is applied to the target
        this.shadowDraw = true;
        this.hitSplash = () => {
            for (let parts = 0; parts < 10; parts++) {
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
                            speed: new Vect3(tempx, tempy, tempz),
                            HB: new Cube(new Vect3(this.HB.pos.x, this.HB.pos.y, this.HB.pos.z), new Vect3(2, 1, 1)),
                            z: this.HB.pos.z,
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
                    new Block(
                        allID++,
                        new Vect3(this.HB.pos.x, this.HB.pos.y, this.HB.pos.z),
                        new Vect3(1, 1, 1),
                        {
                            speed: new Vect3(tempx, tempy, tempz),
                            HB: new Cube(new Vect3(this.HB.pos.x, this.HB.pos.y, this.HB.pos.z), new Vect3(2, 2, 2)),
                            z: this.HB.pos.z,
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
                this[key] = options[key];
            }
    }

    step() {

        if (this.active && this.livetime != 0) {
            // Move
            this.HB.pos.x += this.speed.x;
            this.HB.pos.y += this.speed.y;
            this.HB.pos.z += this.speed.z;

            /*
               ___     _ _         _
              / __|  _| (_)_ _  __| |___ _ _
             | (_| || | | | ' \/ _` / -_) '_|
              \___\_, |_|_|_||_\__,_\___|_|
                  |__/
            */
            for (let c of [game.player, ...game.match.bots]) {
                if (c.character === this.user) //Don't collide with yourself
                    continue;
                c = c.character; //Get the character from the bot
                let side = this.HB.collide(c.HB); //Check for collision
                if (side && c.solid && c.team !== this.user.team) {
                    //play hit2 sound
                    this.touchSFX.currentTime = 0;
                    if (!this.user.muted)
                        this.touchSFX.play();
                    if (!c.invulnerable)
                        c.hp -= this.damage;
                    c.speed.x += this.speed.x * this.force;
                    c.speed.y += this.speed.y * this.force;
                    c.speed.z += this.speed.z * this.force;
                    c.trigger(this, side);
                    this.active = false;
                    this.hitSplash();
                    // if the c's parent has a camera, shake it
                    if (c.parent.camera) c.parent.camera.shakeTime = 10;
                    // if the c's controller has a rumble, rumble it
                    if (c.parent.controller.type == 'gamepad') c.parent.controller.rumble(100, 1.0, 1.0);
                    // if the c's controller is a touch controller, rumble it
                    if (c.parent.controller.type == 'touch' && c.parent.controller.canVibrate) navigator.vibrate(100);

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
                    this.touchSFX.currentTime = 0;
                    if (!this.user.muted)
                        this.touchSFX.play();
                    this.active = false;
                    c.trigger(this, side); //Trigger the block's trigger function
                    this.hitSplash();
                }
            }

            for (const func of this.runFunc) {
                func();
            }
            this.livetime--;
        } else if (this.livetime == 0) {
            this.active = false;
        }
    }

}