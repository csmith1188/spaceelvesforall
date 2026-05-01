(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['Utils', 'Blocks', 'Projectiles'], factory);
    } else if (typeof module === 'object' && module.exports) {
        // Nodejs
        const Utils = require('../../../utils.js');
        const Blocks = require('../block/block.js');
        const Projectiles = require('../block/projectile.js');
        module.exports = factory(Utils, Blocks, Projectiles);
    } else {
        // Browser globals (root is window)
        root.Maps = factory(root.Utils, root.Blocks, root.Projectiles);
    }
}(typeof self !== 'undefined' ? self : this, function (Utils, Blocks, Projectiles) {
    class Map {
        constructor(options) {
            this.name = "Map";
            this.tileSize = 48;
            this.tileSet = new Tileset({ generate: true });
            this.w = this.tileSize * this.tileSet.grid[0].length; //7200
            this.h = this.tileSize * this.tileSet.grid.length; //4800
            this.nodes = [];

            this.friction = {
                air: 0.01,
                ground: 0.1
            }

            this.gravity = 1;
            this.stopZone = 0.1;
            this.grace = 10;
            this.floor = 0;
            this.collideReflect = 0.2;

            if (Utils.isClient()) {
                this.bgimg = new Image();
                this.bgimg.src = "img/tiles/tile001.png";
            }

            this.blocks = [];
            this.lastBlock = () => { return this.blocks[this.blocks.length - 1]; }
            this.bullets = [];
            this.debris = [];
            this.renderCache = {
                npcs: [],
                entities: []
            };
            this.spatialIndex = {
                cellSize: 192,
                characters: new globalThis.Map(),
                blocks: new globalThis.Map()
            };

            this.lightValue = [0, 0, 24, 0.15];

            this.runFunc = []; // A list of functions to run during the step

            if (typeof options == 'object')
                for (const setting of Object.keys(options)) {
                    if (this[setting] !== undefined)
                        this[setting] = options[setting];
                }

        }

        /*
          #####
         #     # #####    ##   #    # #    #
         #       #    #  #  #  #    # ##   #
          #####  #    # #    # #    # # #  #
               # #####  ###### # ## # #  # #
         #     # #      #    # ##  ## #   ##
          #####  #      #    # #    # #    #

        */
        spawn(block) {
            if (!block.spawnPos)
                block.spawnPos = new Utils.Vect3(block.pos.x, block.pos.y, block.pos.z);
            if (block.type == "cube")
                block.spawnVol = new Utils.Vect3(block.vol.x, block.vol.y, block.vol.z);
            // block.serverPos = { pos: block.pos, time: block.time };
            // delete block.pos;
            // delete block.vol;
            // Find character by user ID for bullets/projectiles, or by block ID for other entities
            let character = block.user && block.user.i 
                ? game.match.characters.find(c => c.id === block.user.i)
                : game.match.characters.find(c => c.id === block.id);
            if (block.type == "block") {
                this.blocks.push(new Blocks.Block(
                    {
                        spawnPos: block.spawnPos,
                        spawnVol: block.spawnVol,
                        imgFile: 'img/tiles/wall_top.png', imgFileSide: 'img/tiles/wall_side.png'
                    }
                ));
            }
            else if (block.type == "bullet") {
                // Choose bullet class based on bulletType
                let BulletClass = Projectiles.Bullet; // default
                if (block.bulletType === 'rifle') {
                    BulletClass = Projectiles.RifleBullet;
                } else if (block.bulletType === 'lance') {
                    BulletClass = Projectiles.LanceBullet;
                }
                
                this.bullets.push(new BulletClass(
                    {
                        spawnPos: block.spawnPos,
                        radius: block.radius,
                        height: block.height,
                        user: character || block.user,
                        speed: block.speed,
                        serverPos: { pos: block.pos, time: block.time },
                        id: block.id
                    }
                ));
            }
            else if (block.type == "lanceSlash") {
                this.bullets.push(new Projectiles.LanceSlash(
                    {
                        spawnPos: block.spawnPos,
                        radius: block.radius,
                        height: block.height,
                        user: character || block.user,
                        speed: block.speed,
                        serverPos: { pos: block.pos, time: block.time },
                        parent: character || block.user,
                        id: block.id
                    }
                ));
            }
            else if (block.type == "slash") {
                this.bullets.push(new Projectiles.Slash(
                    {
                        spawnPos: block.spawnPos,
                        radius: block.radius,
                        height: block.height,
                        user: character || block.user,
                        speed: block.speed,
                        serverPos: { pos: block.pos, time: block.time },
                        id: block.id
                    }
                ));
            }
            else if (block.type == "lanceSlash") {
                this.bullets.push(new Projectiles.LanceSlash(
                    {
                        spawnPos: block.spawnPos,
                        radius: block.radius,
                        height: block.height,
                        user: character || block.user,
                        speed: block.speed,
                        serverPos: { pos: block.pos, time: block.time },
                        id: block.id
                    }
                ));
            }
            else if (block.type == "pickup") {
                switch (block.subtype) {
                    case "health":
                        this.blocks.push(new Powerups.HealthPickup(block));
                        break;
                    case "ammo_ballistic":
                        this.blocks.push(new Powerups.Ammo_Ballistic(block));
                        break;
                    case "ammo_plasma":
                        this.blocks.push(new Powerups.Ammo_Plasma(block));
                        break;
                    default:
                        this.blocks.push(new Powerups.HealthPickup(block));
                        break;
                }
            } else if (block.type == "weapon") {
                this.blocks.push(new Powerups.WeaponPickup(block));
            }
        }

        /*
                                       #     #               #     #
         #####  #    # # #      #####  ##    #   ##   #    # ##   ## ######  ####  #    #
         #    # #    # # #      #    # # #   #  #  #  #    # # # # # #      #      #    #
         #####  #    # # #      #    # #  #  # #    # #    # #  #  # #####   ####  ######
         #    # #    # # #      #    # #   # # ###### #    # #     # #           # #    #
         #    # #    # # #      #    # #    ## #    #  #  #  #     # #      #    # #    #
         #####   ####  # ###### #####  #     # #    #   ##   #     # ######  ####  #    #
    
        */
        buildNavMesh() {
            this.nodes = [];
            for (let x = 0; x < this.w / this.tileSize; x++) {
                for (let y = 0; y < this.h / this.tileSize; y++) {
                    this.nodes.push(new Node(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize));
                    for (const block of this.blocks) {
                        if (this.nodes[this.nodes.length - 1].pos.collideCube(block.HB) && block.type == "block") {
                            this.nodes[this.nodes.length - 1].pass = false;
                        } else {
                        }
                    }
                }
            }
        }

        /*
      #####
     #     # ##### ###### #####
     #         #   #      #    #
      #####    #   #####  #    #
           #   #   #      #####
     #     #   #   #      #
      #####    #   ###### #
    
    */
        step() {
            let writeBlocks = 0;
            for (let i = 0; i < this.blocks.length; i++) {
                const e = this.blocks[i];
                if (!(e.cleanup && !e.active)) this.blocks[writeBlocks++] = e;
            }
            this.blocks.length = writeBlocks;

            let writeBullets = 0;
            for (let i = 0; i < this.bullets.length; i++) {
                const e = this.bullets[i];
                if (!(e.cleanup && !e.active)) this.bullets[writeBullets++] = e;
            }
            this.bullets.length = writeBullets;

            let writeDebris = 0;
            for (let i = 0; i < this.debris.length; i++) {
                const e = this.debris[i];
                if (!(e.cleanup && !e.active)) this.debris[writeDebris++] = e;
            }
            this.debris.length = writeDebris;
            const maxDebris = 400;
            if (this.debris.length > maxDebris) {
                this.debris.splice(0, this.debris.length - maxDebris);
            }

            // Run all runFunc
            for (const func of this.runFunc) {
                func();
            }

        }

        clearSpatialBuckets(bucketMap) {
            bucketMap.clear();
        }

        addToSpatialBucket(bucketMap, key, entity) {
            let bucket = bucketMap.get(key);
            if (!bucket) {
                bucket = [];
                bucketMap.set(key, bucket);
            }
            bucket.push(entity);
        }

        entityBounds(entity) {
            if (!entity || !entity.HB) {
                return null;
            }
            if (entity.HB.volume) {
                return {
                    minX: entity.HB.pos.x,
                    minY: entity.HB.pos.y,
                    maxX: entity.HB.pos.x + entity.HB.volume.x,
                    maxY: entity.HB.pos.y + entity.HB.volume.y
                };
            }
            const radius = Number.isFinite(entity.HB.radius) ? entity.HB.radius : 0;
            return {
                minX: entity.HB.pos.x - radius,
                minY: entity.HB.pos.y - radius,
                maxX: entity.HB.pos.x + radius,
                maxY: entity.HB.pos.y + radius
            };
        }

        indexEntity(bucketMap, entity) {
            const bounds = this.entityBounds(entity);
            if (!bounds) {
                return;
            }
            const size = this.spatialIndex.cellSize;
            const minCellX = Math.floor(bounds.minX / size);
            const maxCellX = Math.floor(bounds.maxX / size);
            const minCellY = Math.floor(bounds.minY / size);
            const maxCellY = Math.floor(bounds.maxY / size);
            for (let gx = minCellX; gx <= maxCellX; gx++) {
                for (let gy = minCellY; gy <= maxCellY; gy++) {
                    this.addToSpatialBucket(bucketMap, `${gx},${gy}`, entity);
                }
            }
        }

        rebuildSpatialIndex(characters = [], blocks = this.blocks) {
            this.clearSpatialBuckets(this.spatialIndex.characters);
            this.clearSpatialBuckets(this.spatialIndex.blocks);
            for (const chara of characters) {
                if (chara && chara.active !== false) {
                    this.indexEntity(this.spatialIndex.characters, chara);
                }
            }
            for (const block of blocks) {
                if (block && block.active !== false) {
                    this.indexEntity(this.spatialIndex.blocks, block);
                }
            }
        }

        collectNearby(bucketMap, hb, exclude = null) {
            if (!hb) {
                return [];
            }
            const radiusX = Number.isFinite(hb.radius) ? hb.radius : (hb.volume ? hb.volume.x / 2 : 0);
            const radiusY = Number.isFinite(hb.radius) ? hb.radius : (hb.volume ? hb.volume.y / 2 : 0);
            const minX = hb.pos.x - radiusX;
            const maxX = hb.pos.x + radiusX;
            const minY = hb.pos.y - radiusY;
            const maxY = hb.pos.y + radiusY;
            const size = this.spatialIndex.cellSize;
            const minCellX = Math.floor(minX / size);
            const maxCellX = Math.floor(maxX / size);
            const minCellY = Math.floor(minY / size);
            const maxCellY = Math.floor(maxY / size);
            const out = [];
            const seen = new Set();
            for (let gx = minCellX; gx <= maxCellX; gx++) {
                for (let gy = minCellY; gy <= maxCellY; gy++) {
                    const bucket = bucketMap.get(`${gx},${gy}`);
                    if (!bucket) {
                        continue;
                    }
                    for (const entity of bucket) {
                        if (!entity || entity === exclude || seen.has(entity.id)) {
                            continue;
                        }
                        seen.add(entity.id);
                        out.push(entity);
                    }
                }
            }
            return out;
        }

        getNearbyCharacters(hb, exclude = null) {
            return this.collectNearby(this.spatialIndex.characters, hb, exclude);
        }

        getNearbyBlocks(hb) {
            return this.collectNearby(this.spatialIndex.blocks, hb, null);
        }

        /*
    
         #####  #####    ##   #    #
         #    # #    #  #  #  #    #
         #    # #    # #    # #    #
         #    # #####  ###### # ## #
         #    # #   #  #    # ##  ##
         #####  #    # #    # #    #
    
        */
        draw() {
            /*
            ___                      _     ___ _            _   _         _                                   _
            / __|_ _ ___ _  _ _ _  __| |   / __| |___  _    | | | |_ _  __| |___ _ _ __ _ _ _ ___ _  _ _ _  __| |
            | (_ | '_/ _ \ || | ' \/ _` |_  \__ \ / / || |_  | |_| | ' \/ _` / -_) '_/ _` | '_/ _ \ || | ' \/ _` |
            \___|_| \___/\_,_|_||_\__,_( ) |___/_\_\\_, ( )  \___/|_||_\__,_\___|_| \__, |_| \___/\_,_|_||_\__,_|
                                     |/           |__/|/                          |___/
        */
            //Ground
            ctx.fillStyle = "#333300";
            ctx.fillRect(0, 0, game.gameView.w, game.gameView.h);

            //If in 3D mode, draw the sky (This overdraws things past the horizon, even if visible)
            if (game.player.camera._3D) {
                ctx.fillStyle = "#8cb8ff";
                ctx.fillRect(0, 0, game.gameView.w, (game.gameView.h / 2) /* * (1 - game.player.camera.angle)) */);
            }

            // If in 3D mode, draw the underground (This overdraws things past the underground, even if visible)
            if (game.player.camera._3D) {
                ctx.fillStyle = "#281800";
                ctx.fillRect(0, (game.gameView.h / 2) /* +  ((game.gameView.h / 1)  * (game.player.camera.angle) ) */, game.gameView.w, game.gameView.h);
            }

            /*
              _____ _ _
             |_   _(_) |___ ___
             | | | | / -_|_-<
             |_| |_|_\___/__/
             
             */
            try {
                this.tileSet.draw();

            } catch (error) {
                console.error(error);

            }

            /*
              ___             _            ___  _     _        _
              | _ \___ _ _  __| |___ _ _   / _ \| |__ (_)___ __| |_ ___
             |   / -_) ' \/ _` / -_) '_| | (_) | '_ \| / -_) _|  _(_-<
             |_|_\___|_||_\__,_\___|_|    \___/|_.__// \___\__|\__/__/
             |__/
             */
            //Put Bot player characters into a list
            const npcs = this.renderCache.npcs;
            npcs.length = 0;
            for (const npc in game.match.bots) {
                npcs.push(game.match.bots[npc].character);
            }

            const renderList = this.renderCache.entities;
            renderList.length = 0;
            renderList.push(...game.match.characters, ...npcs, ...game.match.map.blocks, ...game.match.map.bullets, ...game.match.map.debris);
            if (renderList.length > 1) {
                renderList.sort((a, b) => {
                    if (a.HB.pos.y < b.HB.pos.y + b.HB.pos.z) return -1;
                    if (a.HB.pos.y > b.HB.pos.y + b.HB.pos.z) return 1;
                    return 0;
                });
            }
            let visibleEntities = 0;
            for (const entity of renderList) {
                // if the entity is within the camera's viewable radius
                let compareX = game.player.camera.x - entity.HB.pos.x;
                let compareY = game.player.camera.y - entity.HB.pos.y;
                let horizonCalc = 0;
                if (game.player.camera._3D)
                    horizonCalc = (game.gameView.h / 2) * (1 - game.player.camera.angle)
                // Expand culling by entity bounds so partially visible blocks still draw.
                let boundsX = 0;
                let boundsY = 0;
                if (entity.HB && entity.HB.volume) {
                    boundsX = entity.HB.volume.x;
                    boundsY = entity.HB.volume.y + (entity.HB.volume.z || 0) + Math.max(0, entity.HB.pos.z || 0);
                } else if (entity.HB && Number.isFinite(entity.HB.radius)) {
                    const diameter = entity.HB.radius * 2;
                    boundsX = diameter;
                    boundsY = diameter + (entity.HB.height || 0) + Math.max(0, entity.HB.pos.z || 0);
                }
                if (game.player.camera.radius + boundsX > Math.abs(compareX) && game.player.camera.radius + boundsY > Math.abs(compareY) - horizonCalc) {
                    entity.draw(game.player.character);
                    visibleEntities++;
                }
            }
            game.debugPerf.visibleEntities = visibleEntities;

            /*
      ___                         _                _                                   _
      | __|__  __ _   __ _ _ _  __| |  _  _ _ _  __| |___ _ _ __ _ _ _ ___ _  _ _ _  __| |
      | _/ _ \/ _` | / _` | ' \/ _` | | || | ' \/ _` / -_) '_/ _` | '_/ _ \ || | ' \/ _` |
      |_|\___/\__, | \__,_|_||_\__,_|  \_,_|_||_\__,_\___|_| \__, |_| \___/\_,_|_||_\__,_|
      |___/                                          |___/
      */
            // Overdraw the sky as a gradient from the half of the top of the screen to the horizon to the horizon
            if (game.player.camera._3D) {
                let grd = ctx.createLinearGradient(
                    0,
                    (game.gameView.h / 4) * (1 - game.player.camera.angle),
                    0,
                    (game.gameView.h / 4) * (1 - game.player.camera.angle) + (game.gameView.h / 6) * (1 - game.player.camera.angle));
                grd.addColorStop(0, "rgba(140, 184, 255, 1)");
                grd.addColorStop(1, "rgba(140, 184, 255, 0)");
                ctx.fillStyle = grd;
                ctx.fillRect(0, 0, game.gameView.w, (game.gameView.h / 2) * (1 - game.player.camera.angle));
            }

            // overdraw the underground as a gradient from the bottom of the screen to the underground horizon
            if (game.player.camera._3D) {
                let grd = ctx.createLinearGradient(
                    0,
                    (game.gameView.h / 2) + ((game.gameView.h / 1) * (game.player.camera.angle)) + (game.gameView.h / 8) * (game.player.camera.angle),
                    0,
                    (game.gameView.h / 2) + ((game.gameView.h / 1) * (game.player.camera.angle))
                );
                grd.addColorStop(0, "rgba(40, 24, 0, 1)");
                // grd.addColorStop(0.5, "rgba(40, 24, 0, 0.5)");
                grd.addColorStop(1, "rgba(40, 24, 0, 0)");
                ctx.fillStyle = grd;
                ctx.fillRect(0, (game.gameView.h / 2) + ((game.gameView.h / 1) * (game.player.camera.angle)), game.gameView.w, game.gameView.h);
            }

            /*
                 _     _
              __| |___| |__ _  _ __ _
              / _` / -_) '_ \ || / _` |
             \__,_\___|_.__/\_,_\__, |
             |___/
             */
            //If debugging, show node grid
            if (game.debug)
                for (const node of this.nodes) {
                    node.draw();
                }
        }

        /*
        
        #      #  ####  #    # ##### # #    #  ####
        #      # #    # #    #   #   # ##   # #    #
        #      # #      ######   #   # # #  # #
        #      # #  ### #    #   #   # #  # # #  ###
        #      # #    # #    #   #   # #   ## #    #
             ###### #  ####  #    #   #   # #    #  ####
        
            */
        lighting() {
            // ctx.globalCompositeOperation = "screen";
            ctx.fillStyle = `rgba(${this.lightValue[0]}, ${this.lightValue[1]}, ${this.lightValue[2]}, ${this.lightValue[3]})`
            ctx.fillRect(0, 0, game.gameView.w, game.gameView.h);
            // ctx.globalCompositeOperation = "source-over";
        }

        pack() {
            return {};
        }

        fullPack() {
            const packed = {
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
          ::::    :::  ::::::::  :::::::::  ::::::::::
         :+:+:   :+: :+:    :+: :+:    :+: :+:
        :+:+:+  +:+ +:+    +:+ +:+    +:+ +:+
       +#+ +:+ +#+ +#+    +:+ +#+    +:+ +#++:++#
      +#+  +#+#+# +#+    +#+ +#+    +#+ +#+
     #+#   #+#+# #+#    #+# #+#    #+# #+#
    ###    ####  ########  #########  ##########
    */
    class Node {
        constructor(x, y, w, h) {
            this.pos = new Rect(x, y, w, h)
            this.pass = true;
        }

        draw() {
            // if (this.pass) {
            //     ctx.strokeStyle = "#0000FF"
            //     // return
            //     // else
            //     // ctx.strokeStyle = "#FF0000"
            //     let compareX = game.player.camera.x - this.pos.x;
            //     let compareY = game.player.camera.y - this.pos.y;
            //     if (game.player.camera.radius > Math.max(Math.abs(compareX), Math.abs(compareY))) {
            //         ctx.lineWidth = 0.2;
            //         if (game.player.camera._3D)
            //             ctx.strokeRect(
            //                 game.gameView.w / 2 - compareX,
            //                 game.gameView.h / 2 - (compareY * game.player.camera.angle),
            //                 this.pos.w,
            //                 this.pos.h * game.player.camera.angle
            //             );
            //         else
            //             ctx.strokeRect(game.gameView.w / 2 - compareX, game.gameView.h / 2 - compareY, this.pos.w, this.pos.h);
            //     }
            // }
        }
    }

    /*
          :::::::::: ::::::::::: :::::::::: :::        :::::::::          :::::::: ::::::::::: ::::::::::: :::   :::
         :+:            :+:     :+:        :+:        :+:    :+:        :+:    :+:    :+:         :+:     :+:   :+:
        +:+            +:+     +:+        +:+        +:+    +:+        +:+           +:+         +:+      +:+ +:+
       :#::+::#       +#+     +#++:++#   +#+        +#+    +:+        +#+           +#+         +#+       +#++:
      +#+            +#+     +#+        +#+        +#+    +#+        +#+           +#+         +#+        +#+
     #+#            #+#     #+#        #+#        #+#    #+#        #+#    #+#    #+#         #+#        #+#
    ###        ########### ########## ########## #########          ######## ###########     ###        ###
    */
    class Map_FieldCity extends Map {
        constructor(options) {
            super(options);
            this.name = "Field City";
            this.startBlocks = 50;
            if (typeof options == 'object')
                for (const setting of Object.keys(options)) {
                    if (this[setting] !== undefined)
                        this[setting] = options[setting];
                }
            this.setup();
        }

        setup = () => {
            /*
                _      _    _   ___ _         _
               /_\  __| |__| | | _ ) |___  __| |__ ___
              / _ \/ _` / _` | | _ \ / _ \/ _| / /(_-<
             /_/ \_\__,_\__,_| |___/_\___/\__|_\_\/__/
            
            */
            for (let i = 0; i < this.startBlocks; i++) {
                let ran1 = function () { return Math.floor(Math.random() * 3) + 1 }
                let ran2 = function () { return Math.floor(Math.random() * 3) + 1 }
                let ran3 = function () { return Math.floor(Math.random() * 3) + 1 }
                this.blocks.push(new Blocks.Block(
                    new Utils.Vect3(Math.round(Math.random() * this.w), Math.round(Math.random() * this.h), 0),
                    new Utils.Vect3(ran1() * 48, ran2() * 48, ran3() * 48),
                    { imgFile: 'img/tiles/wall_top.png', imgFileSide: 'img/tiles/wall_side.png' }))
            }
        }
    }

    class Map_Deathbox extends Map {
        constructor() {
            super();
            this.name = "Deathbox";
            this.setup();
        }

        setup() {
            this.w = 48 * 40; // 1872
            this.h = 48 * 22; // 1056
            this.tileSet = new Tileset({ size: { x: 40, y: 22 }, generate: true });
            /*
                _      _    _   ___ _         _
               /_\  __| |__| | | _ ) |___  __| |__ ___
              / _ \/ _` / _` | | _ \ / _ \/ _| / /(_-<
             /_/ \_\__,_\__,_| |___/_\___/\__|_\_\/__/
            
            */
            // for (let i = 0; i < 10; i++) {
            //     let ran1 = function () { return Math.floor(Math.random() * 3) + 1 }
            //     let ran2 = function () { return Math.floor(Math.random() * 3) + 1 }
            //     let ran3 = function () { return Math.floor(Math.random() * 3) + 1 }
            //     this.blocks.push(new Blocks.Block(
            //         new Utils.Vect3(Math.round(Math.random() * this.w), Math.round(Math.random() * this.h), 0),
            //         new Utils.Vect3(ran1() * 48, ran2() * 48, ran3() * 48),
            //         { imgFile: 'img/tiles/wall_top.png', imgFileSide: 'img/tiles/wall_side.png' }))
            // }

            let mapCX = this.w / 2;
            let mapCY = this.h / 2;

            let opts = { imgFile: 'img/tiles/wall_top.png', imgFileSide: 'img/tiles/wall_side.png' }

            this.blocks.push(new Blocks.Block({
                spawnPos: new Utils.Vect3(mapCX - 700, mapCY + 30, 0),
                spawnVol: new Utils.Vect3(this.tileSize, 200, 128),
                ...opts
            }))
            this.blocks.push(new Blocks.Block({
                spawnPos: new Utils.Vect3(mapCX + 700, mapCY - 230, 0),
                spawnVol: new Utils.Vect3(this.tileSize, 200, 128),
                ...opts
            }))
            // horizontal wall in top left quadrant of map
            this.blocks.push(new Blocks.Block({
                spawnPos: new Utils.Vect3(mapCX - 500, mapCY - 230, 0),
                spawnVol: new Utils.Vect3(500, this.tileSize, 128),
                ...opts
            }));
            // horizontal wall in bottom right quadrant of map
            this.blocks.push(new Blocks.Block({
                spawnPos: new Utils.Vect3(mapCX, mapCY + 230, 0),
                spawnVol: new Utils.Vect3(500, this.tileSize, 128),
                ...opts
            }));
            // square short wall in bottom left quadrant of map
            this.blocks.push(new Blocks.Block({
                spawnPos: new Utils.Vect3(mapCX - 400, mapCY + 230, 0),
                spawnVol: new Utils.Vect3(this.tileSize * 2, this.tileSize * 2, this.tileSize),
                ...opts
            }));
            // square short wall in top right quadrant of map
            this.blocks.push(new Blocks.Block({
                spawnPos: new Utils.Vect3(mapCX + 400 - (this.tileSize * 2), mapCY - 230 - (this.tileSize), 0),
                spawnVol: new Utils.Vect3(this.tileSize * 2, this.tileSize * 2, this.tileSize),
                ...opts
            }));
            // push into the blocks array a block across the bottom of the map
            this.blocks.push(new Blocks.Block({
                spawnPos: new Utils.Vect3(0, this.h, 0),
                spawnVol: new Utils.Vect3(this.w, this.tileSize, this.tileSize),
                ...opts
            }))
            // push into the blocks array a block across the top of the map
            this.blocks.push(new Blocks.Block({
                spawnPos: new Utils.Vect3(0, -this.tileSize, 0),
                spawnVol: new Utils.Vect3(this.w, this.tileSize, this.tileSize),
                ...opts
            }))
            // push into the blocks array a block across the left of the map
            this.blocks.push(new Blocks.Block({
                spawnPos: new Utils.Vect3(0, 0, 0),
                spawnVol: new Utils.Vect3(this.tileSize, this.h, this.tileSize),
                ...opts
            }))
            // push into the blocks array a block across the right of the map
            this.blocks.push(new Blocks.Block({
                spawnPos: new Utils.Vect3(this.w - this.tileSize, 0, 0),
                spawnVol: new Utils.Vect3(this.tileSize, this.h, this.tileSize),
                ...opts
            }))

            // this.buildNavMesh();

        }
    }

    class Tileset {
        constructor(options) {
            this.tileSize = 48;
            this.grid = [[]];
            this.generate = false;
            this.size = new Utils.Vect2(100, 100);
            if (typeof options == 'object')
                for (const setting of Object.keys(options)) {
                    if (this[setting] !== undefined)
                        this[setting] = options[setting];
                }
            if (this.generate) {
                this.randomGrid(this.size);
            }

        }

        randomGrid = (size) => {
            for (let y = 0; y < size.y; y++) {
                this.grid.push([]);
                for (let x = 0; x < size.x; x++) {
                    // 1 in 20 chance of not getting grass
                    let ran = Math.floor(Math.random() * 20);
                    if (ran == 0) ran = Math.floor(Math.random() * 6)
                    else ran = 0;
                    this.grid[y].push(
                        ['G', 'B', 'D', 'T', 'E']
                        [ran]
                    );
                }
            }
        }

        draw = () => {
            if (game.player.camera._3D) {
                this.draw3D();
            } else {
                let count = 0;
                const rows = this.grid.length;
                if (!rows) {
                    game.debugPerf.tileDrawCount = 0;
                    return;
                }
                const colsTotal = this.grid[0].length || 0;
                const halfViewW = game.gameView.w / 2;
                const halfViewH = game.gameView.h / 2;
                const radiusTilesX = Math.ceil(halfViewW / this.tileSize) + 2;
                const radiusTilesY = Math.ceil(halfViewH / this.tileSize) + 2;
                const centerTileX = Math.floor(game.player.camera.x / this.tileSize);
                const centerTileY = Math.floor(game.player.camera.y / this.tileSize);
                const startY = Math.max(0, centerTileY - radiusTilesY);
                const endY = Math.min(rows - 1, centerTileY + radiusTilesY);
                const startX = Math.max(0, centerTileX - radiusTilesX);
                const endX = Math.min(colsTotal - 1, centerTileX + radiusTilesX);
                for (let y = startY; y <= endY; y++) {
                    let compareY = game.player.camera.y - (y * this.tileSize);
                    for (let x = startX; x <= endX; x++) {
                        let compareX = game.player.camera.x - (x * this.tileSize);
                        const drawX = game.gameView.w / 2 - compareX;
                        const drawY = game.gameView.h / 2 - compareY;
                        // Rectangle viewport culling so all tiles in render area are drawn.
                        if (
                            drawX + this.tileSize < 0 ||
                            drawY + this.tileSize < 0 ||
                            drawX > game.gameView.w ||
                            drawY > game.gameView.h
                        ) {
                            continue;
                        }
                        count++;
                        let tileIMG = this.decodeTile(this.grid[y][x]);
                        ctx.drawImage(
                            tileIMG,
                            drawX,
                            drawY,
                            this.tileSize,
                            this.tileSize
                        );
                    }
                }
                game.debugPerf.tileDrawCount = count;
            }
        }

        draw3D = () => {
            // For every column that the map can make from the total space
            let count = 0;
            const rows = this.grid.length
            let firstRow = 0;
            let midRow = 0;
            let rowTrack = 0;
            let perspectiveW = 0;
            let compareY = 0;
            let compareX = 0;
            let nom = 0;
            let denom = 0;
            for (let y = 0; y < rows; y++) {
                compareY = game.player.camera.y - (y * this.tileSize);
                let horizonCalc = (game.gameView.h / 2) * (1 - game.player.camera.angle)
                if (game.player.camera.radius > Math.abs(compareY) - horizonCalc) {


                    //Calculate the perspective
                    nom = compareY - game.gameView.h;
                    denom = game.gameView.h;
                    perspectiveW = nom / denom;
                    // perspectiveW = 1 - ((compareY / game.gameView.h));


                    // Was this the first row?
                    if (firstRow == 0) {
                        firstRow = y
                        console.log("First row is " + firstRow);
                        console.log(compareY, nom, denom, perspectiveW);
                    }
                    //if this compareY is horizontal to the player's vertical hitbox
                    if (compareY <= this.tileSize / 2 && compareY > -this.tileSize / 2) {
                        midRow = y;
                        console.log("Mid row is " + midRow);
                        console.log(compareY, nom, denom, perspectiveW);
                    }
                    rowTrack = y;
                    //For every row
                    const cols = this.grid[y].length

                    // console.log(game.gameView.h / 2 - (compareY * (perspectiveW * game.player.camera.angle)));

                    for (let x = 0; x < cols; x++) {
                        compareX = game.player.camera.x - (x * this.tileSize);
                        //If the tile is within the camera's viewable radius and the horizon
                        if (game.player.camera.radius > Math.abs(compareX)) {
                            count++;
                            let tileIMG = this.decodeTile(this.grid[y][x]);
                            // ctx.drawImage(
                            //     tileIMG,
                            //     game.gameView.w / 2 - compareX * perspectiveW,
                            //     game.gameView.h / 2 - compareY * perspectiveW * game.player.camera.angle,
                            //     this.tileSize * perspectiveW,
                            //     this.tileSize * perspectiveW * game.player.camera.angle
                            // );
                            //draw a rectangle to show the perspective
                            ctx.strokeStyle = "#FF0000";
                            ctx.strokeRect(
                                game.gameView.w / 2 - compareX * perspectiveW,
                                game.gameView.h / 2 - compareY * perspectiveW,
                                this.tileSize * perspectiveW,
                                this.tileSize * perspectiveW,
                            );

                            ctx.stroke();
                        }
                    }
                }
            }
            // console.log("The last row is " + rowTrack);
            // console.log(nom, (game.player.camera.y - (rowTrack * this.tileSize)) + game.gameView.h, perspectiveW);

            // console.log("Drew a total of " + count + " tiles");
        }

        decodeTile = (tile) => {
            switch (tile) {
                case 'G':
                    return tiles.G;
                case 'B':
                    return tiles.B;
                case 'D':
                    return tiles.D;
                case 'T':
                    return tiles.T;
                case 'E':
                    return tiles.E;
                default:
                    return tiles.G;
            }
        }
    }

    const tiles = (() => {
        list = {
            'G': 'img/tiles/tile001.png',
            'B': 'img/tiles/tile002.png',
            'D': 'img/tiles/tile003.png',
            'T': 'img/tiles/tile004.png',
            'E': 'img/tiles/tile005.png'
        }

        //for every tile in the list, replace the value with a new image object whose source is the value
        for (const tile in list) {
            if (typeof window !== 'undefined') {
                let path = list[tile];
                list[tile] = new Image();
                list[tile].src = path;
            }
        }

        return list;
    })();


    return { Map, Map_FieldCity, Map_Deathbox };
}));