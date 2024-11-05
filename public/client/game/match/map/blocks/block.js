/*
      :::::::::  :::        ::::::::   ::::::::  :::    :::
     :+:    :+: :+:       :+:    :+: :+:    :+: :+:   :+:
    +:+    +:+ +:+       +:+    +:+ +:+        +:+  +:+
   +#++:++#+  +#+       +#+    +:+ +#+        +#++:++
  +#+    +#+ +#+       +#+    +#+ +#+        +#+  +#+
 #+#    #+# #+#       #+#    #+# #+#    #+# #+#   #+#
#########  ########## ########   ########  ###    ###
*/

class Block {
    constructor(id, posVect, volVect, options) {
        // Position
        this.spawn = new Vect3(posVect.x, posVect.y, posVect.z)
        this.HB = new Cube(new Vect3(posVect.x, posVect.y, posVect.z), new Vect3(volVect.x, volVect.y, volVect.z))
        this.aim = new Vect3(0, 0, 0);
        this.angle = new Vect3(0, 0, 0);
        this.speed = new Vect3(0, 0, 0);

        // Lifespan
        this.id = id;
        this.parent = {};   // Who does this belong to?
        this.active = true; //Are we tracking this in the game?
        this.dying = false; //Is the lifespan counting down?
        this.cleanup = true; //Is this ready to be removed from the game?
        this.livetime = -1; //Number of frames to live (-1 forever)
        this.repeat = 0;

        // Properties
        this.target = {};   // What is it chasing?
        this.mobile = false;
        this.solid = true;
        this.gravity = false;
        this.visible = true;
        this.runFunc = [];
        this.reflection = 0.5;
        this.friction = 0.5;
        this.type = 'block';

        // Graphics
        this.imgFile = '';  // Leave blank to add collision to a background
        this.imgFileSide = '';
        this.opacity = 1;
        this.color = [100, 100, 100];    // Leave blank to add collision to a background
        this.colorSide = [200, 200, 200]; //The color of the wall of the block
        this.img = new Image();
        this.img.src = this.imgFile;
        this.imgSide = new Image();
        this.imgSide.src = this.imgFileSide;
        this.drawStyle = 'tile'; // 'tile' or 'stretch'
        this.shadowDraw = false;
        this.shadow = new Image();
        this.shadow.src = 'img/sprites/shadow.png';
        this.drawFunc = [];
        // Options
        if (typeof options === 'object')
            for (var key of Object.keys(options)) {
                this[key] = options[key];
            }
        this.img.src = this.imgFile;
    }

    step() {
        /*
                                          _
          _ __  _____ _____ _ __  ___ _ _| |_
         | '  \/ _ \ V / -_) '  \/ -_) ' \  _|
         |_|_|_\___/\_/\___|_|_|_\___|_||_\__|

        */
        if (this.livetime != 0) {
            this.HB.pos.x += this.speed.x;
            this.HB.pos.y += this.speed.y;
            this.HB.pos.z += this.speed.z;
            if (this.dying)
                this.livetime--;
            for (const func of this.runFunc) {
                func();
            }
        } else if (this.livetime == 0) {
            this.active = false;
        }
    }

    /*
     ######
     #     # #####    ##   #    #
     #     # #    #  #  #  #    #
     #     # #    # #    # #    #
     #     # #####  ###### # ## #
     #     # #   #  #    # ##  ##
     ######  #    # #    # #    #

    */
    draw() {
        if (game.player.camera._3D) {
            this.draw3D();
        } else {

            let compareX = game.player.camera.x - this.HB.pos.x;
            let compareY = game.player.camera.y - this.HB.pos.y;

            /*
                 _                           _ _         _
              __| |_ _ __ ___ __ __  __ _  _| (_)_ _  __| |___ _ _
             / _` | '_/ _` \ V  V / / _| || | | | ' \/ _` / -_) '_|
             \__,_|_| \__,_|\_/\_/  \__|\_, |_|_|_||_\__,_\___|_|
                                        |__/
            */
            if (this.HB instanceof Cylinder) {
                // Draw shadow
                if (this.shadowDraw) {
                    ctx.globalAlpha = 0.4;
                    ctx.drawImage(
                        this.shadow,
                        game.window.w / 2 - compareX,
                        game.window.h / 2 - compareY,
                        this.HB.radius,
                        this.HB.radius
                    );
                    ctx.globalAlpha = 1;
                }
                if (this.imgFile) {
                    ctx.drawImage(this.img, game.window.w / 2 - compareX, game.window.h / 2 - compareY - this.HB.pos.z, this.HB.radius, this.HB.radius);
                } else {
                    //SIDE
                    ctx.fillStyle = `rgba(${this.colorSide[0]}, ${this.colorSide[1]}, ${this.colorSide[2]}, ${this.opacity})`;
                    ctx.beginPath();
                    ctx.ellipse(
                        game.window.w / 2 - compareX,
                        game.window.h / 2 - compareY - this.HB.pos.z,
                        this.HB.radius,
                        this.HB.radius,
                        0, 0, 2 * Math.PI
                    );
                    ctx.fill();
                    ctx.beginPath();
                    ctx.fillRect(
                        game.window.w / 2 - compareX - this.HB.radius,
                        game.window.h / 2 - compareY - this.HB.pos.z - this.HB.height,
                        this.HB.radius * 2,
                        this.HB.height
                    );
                    ctx.fill();
                    //TOP
                    ctx.fillStyle = `rgba(${this.color[0]}, ${this.color[1]}, ${this.color[2]}, ${this.opacity})`;
                    ctx.beginPath();
                    ctx.ellipse(
                        game.window.w / 2 - compareX,
                        game.window.h / 2 - compareY - this.HB.height - this.HB.pos.z,
                        this.HB.radius,
                        this.HB.radius,
                        0, 0, 2 * Math.PI
                    );
                    ctx.fill();

                }
            }
            /*
                 _                           _
              __| |_ _ __ ___ __ __  __ _  _| |__  ___
             / _` | '_/ _` \ V  V / / _| || | '_ \/ -_)
             \__,_|_| \__,_|\_/\_/  \__|\_,_|_.__/\___|

            */
            if (this.HB instanceof Cube) {
                // Draw shadow
                if (this.shadowDraw) {
                    ctx.globalAlpha = 0.4;
                    ctx.drawImage(
                        this.shadow,
                        game.window.w / 2 - compareX,
                        game.window.h / 2 - compareY,
                        this.HB.volume.x,
                        this.HB.volume.y
                    );
                    ctx.globalAlpha = 1;
                }
                // Box shadow
                // ctx.fillStyle = 'rgba(0,0,0,0.2)'
                // ctx.fillRect(
                //     game.window.w / 2 - compareX,
                //     game.window.h / 2 - compareY,
                //     this.HB.volume.x,
                //     this.HB.volume.y
                // );
                if (this.imgFile) {
                    if (this.drawStyle == 'stretch') {
                        ctx.drawImage(
                            this.img,
                            game.window.w / 2 - compareX,
                            game.window.h / 2 - compareY - this.HB.volume.z - this.HB.pos.z,
                            this.HB.volume.x,
                            this.HB.volume.y
                        );
                        ctx.drawImage(
                            this.imgSide,
                            game.window.w / 2 - compareX,
                            game.window.h / 2 - compareY - this.HB.pos.z - this.HB.volume.z + this.HB.volume.y,
                            this.HB.volume.x,
                            this.HB.volume.z
                        );
                    } else if (this.drawStyle == 'tile') {
                        let texture = new Image();
                        texture.src = this.imgFile;
                        let pattern = ctx.createPattern(texture, 'repeat');
                        ctx.fillStyle = pattern;

                        // Translate the context by the top-left corner of the rectangle
                        ctx.translate(game.window.w / 2 - compareX, game.window.h / 2 - compareY - this.HB.volume.z - this.HB.pos.z);

                        // Now fill the rectangle, but with the origin at (0, 0)
                        ctx.fillRect(0, 0, this.HB.volume.x, this.HB.volume.y);

                        // Translate the context back
                        ctx.translate(-(game.window.w / 2 - compareX), -(game.window.h / 2 - compareY - this.HB.volume.z - this.HB.pos.z));

                        texture = new Image();
                        texture.src = this.imgFileSide;
                        pattern = ctx.createPattern(texture, 'repeat');
                        ctx.fillStyle = pattern;
                        ctx.translate(game.window.w / 2 - compareX, game.window.h / 2 - compareY - this.HB.pos.z - this.HB.volume.z + this.HB.volume.y);
                        ctx.fillRect(0, 0, this.HB.volume.x, this.HB.volume.z);
                        ctx.translate(-(game.window.w / 2 - compareX), -(game.window.h / 2 - compareY - this.HB.pos.z - this.HB.volume.z + this.HB.volume.y));
                    }
                } else {
                    //TOP
                    ctx.fillStyle = `rgba(${this.color[0]}, ${this.color[1]}, ${this.color[2]}, ${this.opacity})`;
                    ctx.fillRect(
                        game.window.w / 2 - compareX,
                        game.window.h / 2 - compareY - this.HB.volume.z - this.HB.pos.z,
                        this.HB.volume.x,
                        this.HB.volume.y
                    );
                    //SIDE
                    ctx.fillStyle = `rgba(${this.colorSide[0]}, ${this.colorSide[1]}, ${this.colorSide[2]}, ${this.opacity})`;
                    ctx.fillRect(
                        game.window.w / 2 - compareX,
                        game.window.h / 2 - compareY - this.HB.pos.z - this.HB.volume.z + this.HB.volume.y,
                        this.HB.volume.x,
                        this.HB.volume.z
                    );
                }
            }
        }

        // Draw any custom draw functions
        for (const func of this.drawFunc) {
            func();
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
                         _                           _ _         _
                      __| |_ _ __ ___ __ __  __ _  _| (_)_ _  __| |___ _ _
                     / _` | '_/ _` \ V  V / / _| || | | | ' \/ _` / -_) '_|
                     \__,_|_| \__,_|\_/\_/  \__|\_, |_|_|_||_\__,_\___|_|
                                                |__/
                    */
        if (this.HB instanceof Cylinder) {
            // Draw shadow
            if (this.shadowDraw) {
                ctx.globalAlpha = 0.4;
                ctx.drawImage(
                    this.shadow,
                    game.window.w / 2 - compareX,
                    game.window.h / 2 - compareY,
                    this.HB.radius,
                    this.HB.radius
                );
                ctx.globalAlpha = 1;
            }
            if (this.imgFile) {
                ctx.drawImage(this.img, game.window.w / 2 - compareX, game.window.h / 2 - compareY - this.HB.pos.z, this.HB.radius, this.HB.radius);
            } else {
                //SIDE
                ctx.beginPath();
                ctx.fillStyle = `rgba(${this.colorSide[0]}, ${this.colorSide[1]}, ${this.colorSide[2]}, ${this.opacity})`;
                ctx.ellipse(
                    game.window.w / 2 - compareX,
                    game.window.h / 2 - (compareY * game.player.camera.angle) - (this.HB.pos.z * (1 - game.player.camera.angle)),
                    this.HB.radius,
                    this.HB.radius * game.player.camera.angle,
                    0, 0, 2 * Math.PI
                );
                ctx.fill();
                ctx.beginPath();
                ctx.fillRect(
                    game.window.w / 2 - compareX - this.HB.radius,
                    game.window.h / 2 - (compareY * game.player.camera.angle) - (this.HB.height * (1 - game.player.camera.angle)) - (this.HB.pos.z * (1 - game.player.camera.angle)),
                    this.HB.radius * 2,
                    this.HB.height * (1 - game.player.camera.angle)
                );
                ctx.fill();
                //TOP
                ctx.beginPath();
                ctx.fillStyle = `rgba(${this.color[0]}, ${this.color[1]}, ${this.color[2]}, ${this.opacity})`;
                ctx.ellipse(
                    game.window.w / 2 - compareX,
                    game.window.h / 2 - (compareY * game.player.camera.angle) - (this.HB.height * (1 - game.player.camera.angle)) - (this.HB.pos.z * (1 - game.player.camera.angle)),
                    this.HB.radius,
                    this.HB.radius * game.player.camera.angle,
                    0, 0, 2 * Math.PI
                );
                ctx.fill();
            }
        }
        /*
             _                           _
          __| |_ _ __ ___ __ __  __ _  _| |__  ___
         / _` | '_/ _` \ V  V / / _| || | '_ \/ -_)
         \__,_|_| \__,_|\_/\_/  \__|\_,_|_.__/\___|
 
        */
        if (this.HB instanceof Cube) {
            // Draw shadow
            if (this.shadowDraw) {
                ctx.globalAlpha = 0.4;
                ctx.drawImage(
                    this.shadow,
                    game.window.w / 2 - compareX,
                    game.window.h / 2 - (compareY * game.player.camera.angle),
                    this.HB.volume.x,
                    this.HB.volume.y * game.player.camera.angle
                );
                ctx.globalAlpha = 1;
            }
            if (this.imgFile) {
                // ctx.drawImage(this.img, game.window.w / 2 - compareX, game.window.h / 2 - compareY - this.HB.pos.z, this.HB.volume.x, this.HB.volume.y);
            } else if (this.color) {
                ctx.fillStyle = `rgba(${this.color[0]}, ${this.color[1]}, ${this.color[2]}, ${this.opacity})`;
                ctx.fillRect(
                    game.window.w / 2 - compareX,
                    game.window.h / 2 - (compareY * game.player.camera.angle) - (this.HB.volume.z * (1 - game.player.camera.angle)) - (this.HB.pos.z * (1 - game.player.camera.angle)),
                    this.HB.volume.x,
                    this.HB.volume.y * game.player.camera.angle
                );
                if (this.colorSide) {
                    ctx.fillStyle = `rgba(${this.colorSide[0]}, ${this.colorSide[1]}, ${this.colorSide[2]}, ${this.opacity})`;
                    ctx.fillRect(
                        game.window.w / 2 - compareX,
                        game.window.h / 2 - (compareY * game.player.camera.angle) - (this.HB.pos.z * (1 - game.player.camera.angle)) - (this.HB.volume.z * (1 - game.player.camera.angle)) + (this.HB.volume.y * game.player.camera.angle),
                        this.HB.volume.x,
                        this.HB.volume.z * (1 - game.player.camera.angle)
                    );
                }
            }
        }
    }

    /*
     #######
        #    #####  #  ####   ####  ###### #####
        #    #    # # #    # #    # #      #    #
        #    #    # # #      #      #####  #    #
        #    #####  # #  ### #  ### #      #####
        #    #   #  # #    # #    # #      #   #
        #    #    # #  ####   ####  ###### #    #

    */
    trigger(actor, side) {
        return
    }

}


/*
      :::::::::   ::::::::  :::     :::   ::: :::::::::  :::        ::::::::   ::::::::  :::    :::
     :+:    :+: :+:    :+: :+:     :+:   :+: :+:    :+: :+:       :+:    :+: :+:    :+: :+:   :+:
    +:+    +:+ +:+    +:+ +:+      +:+ +:+  +:+    +:+ +:+       +:+    +:+ +:+        +:+  +:+
   +#++:++#+  +#+    +:+ +#+       +#++:   +#++:++#+  +#+       +#+    +:+ +#+        +#++:++
  +#+        +#+    +#+ +#+        +#+    +#+    +#+ +#+       +#+    +#+ +#+        +#+  +#+
 #+#        #+#    #+# #+#        #+#    #+#    #+# #+#       #+#    #+# #+#    #+# #+#   #+#
###         ########  ########## ###    #########  ########## ########   ########  ###    ###
*/
class PolyBlock {
    constructor(id, x, y, options) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.d = 16;
        this.tags = [];
        this.coords = [];
        this.color = '';
        this.splash = '';
        if (typeof options === 'object')
            for (var key of Object.keys(options)) {
                this[key] = options[key];
            }
    }

    draw() {
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(this.pt(game.player.camera, 'x', this.coords[0][0]), this.pt(game.player.camera, 'y', this.coords[0][1]));
        for (const coords of this.coords) {
            ctx.lineTo(this.pt(game.player.camera, 'x', coords[0]), this.pt(game.player.camera, 'y', coords[1]));
        }
        ctx.closePath();
        ctx.fill();
    }

    pt(origin, axis, offset) {
        let compare = origin[axis] - this[axis];
        let dimension = 'w';
        if (axis == 'y') dimension = 'h';
        return game.window[dimension] / 2 - compare + offset;
    }

    step() {

    }

    collide(colliders) {
        for (const c of colliders) {
            if (c != this && c.type != 'block') {
                // Honestly, I just watched this:
                // https://www.youtube.com/watch?v=01E0RGb2Wzo
                let intersections = 0;
                for (const coord of this.coords) {
                    let nextcoord = this.coords[this.coords.indexOf(coord) + 1];
                    if (!nextcoord) nextcoord = this.coords[0];
                    let x1 = coord[0] + this.x;
                    let x2 = nextcoord[0] + this.x;
                    let y1 = coord[1] + this.y;
                    let y2 = nextcoord[1] + this.y;
                    if (c.y < y1 != c.y < y2 &&
                        c.x < (x2 - x1) * (c.y - y1) / (y2 - y1) + x1 &&
                        c.z < this.d)
                        intersections++;
                }

                if (intersections % 2) {
                    c.xspeed *= 0.96;
                    c.yspeed *= 0.96
                    let tempx = (Math.random() * 6) - 3;
                    let tempz = (Math.random() * 6) - 3;
                    if (this.color) {
                        if (game.match.ticks % 4 == 0) {
                            game.match.map.debris.push(new Debris(allID++, c.x, c.y + (c.h / 2), { wind: false, w: 16, h: 12, z: c.z, color: this.splash, livetime: 12, dying: true, landable: true }))
                        }
                        game.match.map.debris.push(new Debris(allID++, c.x, c.y + (c.h / 2), { wind: false, w: 6, h: 6, xspeed: tempx, zspeed: 3 + tempz, z: c.z + c.hover, color: this.splash, livetime: 30, dying: true, landable: true }))
                    }
                }
            }
        }
    }
}