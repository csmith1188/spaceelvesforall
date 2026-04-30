(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['Utils'], factory);
    } else if (typeof module === 'object' && module.exports) {
        // Nodejs
        const Utils = require('../../../utils.js');
        module.exports = factory(Utils);
    } else {
        // Browser globals (root is window)
        root.Blocks = factory(root.Utils);
    }
}(typeof self !== 'undefined' ? self : this, function (Utils) {

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
        constructor(options) {
            // Position
            this.id = Utils.uuidGen(4);
            this.spawnPos = new Utils.Vect3(0, 0, 0);
            this.spawnVol = new Utils.Vect3(32, 32, 32);
            this.aim = new Utils.Vect3(0, 0, 0);
            this.angle = new Utils.Vect3(0, 0, 0);
            this.speed = new Utils.Vect3(0, 0, 0);
            this.serverPos = {
                pos: { x: 0, y: 0, z: 0 },
                vol: { x: 0, y: 0, z: 0 },
                speed: { x: 0, y: 0, z: 0 },
                time: 0
            }
            this.user = { id: null };

            // Lifespan
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
            // if not in a browser
            if (typeof window !== 'undefined') {
                this.img = new Image();
                this.img.src = this.imgFile;
                this.imgSide = new Image();
                this.imgSide.src = this.imgFileSide;
                this.shadow = new Image();
                this.shadow.src = 'img/sprites/shadow.png';
                this._tilePatternTop = null;
                this._tilePatternSide = null;
            }
            this.drawStyle = 'tile'; // 'tile' or 'stretch'
            this.shadowDraw = false;
            this.drawFunc = [];
            // Options
            if (typeof options === 'object') {
                for (var key of Object.keys(options)) {
                    if (key == 'runFunc') {
                        this[key] = [];
                        this.runFunc = options[key].map(fnStr => {
                            return new Function(`return (${fnStr});`)(); // Create function from string
                        });
                    }
                    else if (key == 'drawFunc') {
                    } else {
                        this[key] = options[key];
                    }
                }
            }

            this.HB = Utils.generateHB(this);

            if (typeof window !== 'undefined') {
                // Apply final image sources after options are merged.
                this.img.src = this.imgFile || '';
                this.imgSide.src = this.imgFileSide || '';
                this._tilePatternTop = null;
                this._tilePatternSide = null;
            }
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
                if (this.HB instanceof Utils.Cylinder) {
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
                if (this.HB instanceof Utils.Cube) {
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
                            if (!this._tilePatternTop && this.img) {
                                this._tilePatternTop = ctx.createPattern(this.img, 'repeat');
                            }
                            if (this._tilePatternTop) {
                                ctx.fillStyle = this._tilePatternTop;
                            } else {
                                ctx.fillStyle = `rgba(${this.color[0]}, ${this.color[1]}, ${this.color[2]}, ${this.opacity})`;
                            }

                            // Translate the context by the top-left corner of the rectangle
                            ctx.translate(game.window.w / 2 - compareX, game.window.h / 2 - compareY - this.HB.volume.z - this.HB.pos.z);

                            // Now fill the rectangle, but with the origin at (0, 0)
                            ctx.fillRect(0, 0, this.HB.volume.x, this.HB.volume.y);

                            // Translate the context back
                            ctx.translate(-(game.window.w / 2 - compareX), -(game.window.h / 2 - compareY - this.HB.volume.z - this.HB.pos.z));

                            if (!this._tilePatternSide && this.imgSide) {
                                this._tilePatternSide = ctx.createPattern(this.imgSide, 'repeat');
                            }
                            if (this._tilePatternSide) {
                                ctx.fillStyle = this._tilePatternSide;
                            } else {
                                ctx.fillStyle = `rgba(${this.colorSide[0]}, ${this.colorSide[1]}, ${this.colorSide[2]}, ${this.opacity})`;
                            }
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
            if (this.HB instanceof Utils.Cylinder) {
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
            if (this.HB instanceof Utils.Cube) {
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

        /*
         ######
         #     #   ##    ####  #    #
         #     #  #  #  #    # #   #
         ######  #    # #      ####
         #       ###### #      #  #
         #       #    # #    # #   #
         #       #    #  ####  #    #

        */
        pack() {
            let pack = {
                i: this.id, // id
                p: this.HB.pos, // pos
                s: this.speed, // speed
                t: this.type // type
            }
            if (this.bulletType) {
                pack.bt = this.bulletType; // bullet type (rifle, lance, etc.)
            }
            if (this.user != null) {
                pack.u = { // user
                    i: this.user.id, // id
                    tm: this.user.team, // team
                    n: this.user.name // name
                }
            }
            if (this.HB instanceof Utils.Cube) {
                pack.sh = 'c'; // shape: cube
                pack.v = this.HB.vol; // vol
            } else if (this.HB instanceof Utils.Cylinder) {
                pack.sh = 'cy'; // shape: cylinder
                pack.r = this.HB.radius; // radius
                pack.h = this.HB.height; // height
            }

            return pack;
        }

        fullPack() {
            const packed = {
                characters: this.characters.map(chara => chara.fullPack()),
                blocks: this.map.blocks.map(block => block.fullPack()),
                debris: []
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
          :::::::::   ::::::::  :::     :::   ::: :::::::::  :::        ::::::::   ::::::::  :::    :::
         :+:    :+: :+:    :+: :+:     :+:   :+: :+:    :+: :+:       :+:    :+: :+:    :+: :+:   :+:
        +:+    +:+ +:+    +:+ +:+      +:+ +:+  +:+    +:+ +:+       +:+    +:+ +:+        +:+  +:+
       +#++:++#+  +#+    +:+ +#+       +#++:   +#++:++#+  +#+       +#+    +:+ +#+        +#++:++
      +#+        +#+    +#+ +#+        +#+    +#+    +#+ +#+       +#+    +#+ +#+        +#+  +#+
     #+#        #+#    #+# #+#        #+#    #+#    #+# #+#       #+#    #+# #+#    #+# #+#   #+#
    ###         ########  ########## ###    #########  ########## ########   ########  ###    ###
    */
    class PolyBlock {
        constructor(x, y, options) {
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
                                game.match.map.debris.push(new Debris(c.x, c.y + (c.h / 2), { wind: false, w: 16, h: 12, z: c.z, color: this.splash, livetime: 12, dying: true, landable: true }))
                            }
                            game.match.map.debris.push(new Debris(c.x, c.y + (c.h / 2), { wind: false, w: 6, h: 6, xspeed: tempx, zspeed: 3 + tempz, z: c.z + c.hover, color: this.splash, livetime: 30, dying: true, landable: true }))
                        }
                    }
                }
            }
        }
    }

    return { Block, PolyBlock };
}));