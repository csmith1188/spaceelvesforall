(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['Characters', 'Utils', 'Maps', 'Matches', 'Items', 'Powerups'], factory);
    } else if (typeof module === 'object' && module.exports) {
        // Nodejs
        const Characters = require('./character.js');
        const Utils = require('../../utils.js');
        const Maps = require('./map/map.js');
        const Matches = require('./match.js');
        const Items = require('./item.js');
        const Powerups = require('./block/powerup.js');
        module.exports = factory(Characters, Utils, Maps, Matches, Items, Powerups);
    } else {
        // Browser globals (root is window)
        root.ForHonorMP = factory(root.Characters, root.Utils, root.Maps, root.Matches, root.Items, root.Powerups);
    }
}(typeof self !== 'undefined' ? self : this, function (Characters, Utils, Maps, Matches, Items, Powerups) {
    /*
     #######                  #     #
     #        ####  #####     #     #  ####  #    #  ####  #####
     #       #    # #    #    #     # #    # ##   # #    # #    #
     #####   #    # #    #    ####### #    # # #  # #    # #    #
     #       #    # #####     #     # #    # #  # # #    # #####
     #       #    # #   #     #     # #    # #   ## #    # #   #
     #        ####  #    #    #     #  ####  #    #  ####  #    #
    
    */
    class ForHonorMP extends Matches.Match {
        constructor() {
            super();
            this.setup();
        }

        reset() {
            super.reset();

            this.lastWinner = null;

            // filter out all blocks that are not 'block'
            this.map.blocks = this.map.blocks.filter(function (el) { return el.type == 'block'; });

            // for each character in the characters array
            for (let i in this.characters) {
                this.characters[i].active = true;
                this.characters[i].visible = true;
                this.characters[i].HB.pos.x = (this.map.w / 2) + (i % 2 ? 800 : -800);
                this.characters[i].HB.pos.y = (this.map.h / 2);
                this.characters[i].HB.pos.z = 0;
                this.characters[i].speed.x = 0;
                this.characters[i].speed.y = 0;
                this.characters[i].speed.z = 0;
                this.characters[i].hp = this.characters[i].hp_max;
                this.characters[i].inventory = [new Items.Pistol()];
                this.characters[i].item = 0;
                this.characters[i].pp = this.characters[i].pp_max;
                this.characters[i].ammo.ballistic = 1;
                this.characters[i].ammo.plasma = 1;
            }

            // Add health pickups to each side fothe map
            this.map.blocks.push(new Powerups.HealthPickup({
                spawnPos: new Utils.Vect3((this.map.w / 2) - 800, (this.map.h / 2) + 96, 0),
                spawnVol: new Utils.Vect3(128, 128, 64)
            }));
            this.map.blocks.push(new Powerups.HealthPickup({
                spawnPos: new Utils.Vect3((this.map.w / 2) + 800, (this.map.h / 2) - 96, 0),
                spawnVol: new Utils.Vect3(128, 128, 64)
            }));
            // add both ammo pickups to top and bottom of map
            this.map.blocks.push(new Powerups.Ammo_Ballistic({
                spawnPos: new Utils.Vect3((this.map.w / 2) - 500, (this.map.h / 2) - 400, 0),
                spawnVol: new Utils.Vect3(128, 128, 64)
            }));
            this.map.blocks.push(new Powerups.Ammo_Plasma({
                spawnPos: new Utils.Vect3((this.map.w / 2) + 472, (this.map.h / 2) + 400, 0),
                spawnVol: new Utils.Vect3(128, 128, 64)
            }));
            this.map.blocks.push(new Powerups.Ammo_Ballistic({
                spawnPos: new Utils.Vect3((this.map.w / 2) + 378, (this.map.h / 2) + 400, 0),
                spawnVol: new Utils.Vect3(128, 128, 64)
            }));
            this.map.blocks.push(new Powerups.Ammo_Plasma({
                spawnPos: new Utils.Vect3((this.map.w / 2) - 408, (this.map.h / 2) - 400, 0),
                spawnVol: new Utils.Vect3(128, 128, 64)
            }));


            // add weapons to the center of the map
            this.map.blocks.push(new Powerups.WeaponPickup({
                spawnPos: new Utils.Vect3((this.map.w / 2), (this.map.h / 2), 0),
                spawnVol: new Utils.Vect3(0, 0, 0),
                weapon: 'pistol', pickupDelay: 0
            }));
            this.map.blocks.push(new Powerups.WeaponPickup({
                spawnPos: new Utils.Vect3((this.map.w / 2), (this.map.h / 2), 0),
                spawnVol: new Utils.Vect3(0, 0, 0),
                weapon: 'lance', pickupDelay: 0
            }));
            this.map.blocks.push(new Powerups.WeaponPickup({
                spawnPos: new Utils.Vect3((this.map.w / 2), (this.map.h / 2), 0),
                spawnVol: new Utils.Vect3(0, 0, 0),
                weapon: 'rifle', pickupDelay: 0
            }));
            this.map.blocks.push(new Powerups.WeaponPickup({
                spawnPos: new Utils.Vect3((this.map.w / 2), (this.map.h / 2) + 0, 0),
                spawnVol: new Utils.Vect3(0, 0, 0),
                weapon: 'flamer', pickupDelay: 0
            }));

            // for every block in the blocks array
            // if the block's type is not 'block'
            // add one to the counter
            let blockCounter = 0;
            for (const block of this.map.blocks) {
                if (block.type == 'weapon') {
                    block.sineOffset = blockCounter++;
                    block.runFunc.push(
                        function (bc) {
                            this.HB.pos.x = this.HB.pos.x + Utils.sineAnimate(100, 0.025, (this.sineOffset * 60));
                            this.HB.pos.y = this.HB.pos.y + Utils.sineAnimate(100, 0.025, (this.sineOffset * 60) + 60);
                        }.bind(block)
                    );
                }
            }

        }

        setup() {
            this.map = new Maps.Map_Deathbox();
            this.name = "For Honor";
            this.description = "A duel to the death.";
            // this.reset();
        }

        awaitPlayers() {
            super.awaitPlayers();
            if (game.players.length >= this.playerLimit.min) {
                this.reset();
            }
        }

        step() {
            super.step();

            // this.characters.push(new Characters.Jetbike({ name: game.player.token.username, team: i, parent: game.players[i], active: true, cleanup: false, spawnPos: new Utils.Vect3((this.map.w / 2) - 800, (this.map.h / 2), 10), gfx: 'img/sprites/jetbike' }));
            // game.player.interface = new Interface_LocalMP(game.player, 0, 0);


            // find all characters that are active
            // let activeCharacters = this.characters.filter(character => character.active);
            // if (activeCharacters.length == 1) {
            //     this.lastWinner = activeCharacters[0].name;
            //     if (game.player.controller.buttons.inventory1.current) {
            //         this.reset();
            //     }
            // }

        }

        draw() {
            super.draw();
            if (this.lastWinner) {
                ctx.fillStyle = "rgba(0,0,0,0.5)";
                ctx.fillRect(0, 0, game.gameView.w, game.gameView.h);
                ctx.fillStyle = "#FFFFFF";
                ctx.font = "36px Jura";
                ctx.textAlign = "center";
                // first draw the text in black to create a shadow
                ctx.fillStyle = "#000000";
                ctx.fillText(`${this.lastWinner} wins!`, game.gameView.w / 2 + 2, game.gameView.h / 2 - 88);
                ctx.fillStyle = "#FFFFFF";
                // then draw the text in white
                ctx.fillText(`${this.lastWinner} wins!`, game.gameView.w / 2, game.gameView.h / 2 - 90);
                // draw restart prompt
                let promptButton;
                switch (game.player.controller.type) {
                    case 'keyboard':
                        promptButton = 'Q';
                        break;
                    case 'touch':
                        promptButton = 'Weapon';
                        break;
                    case 'gamepad':
                        promptButton = 'X';
                        break;
                    default:
                        promptButton = 'Weapon';
                        break;
                }
                ctx.font = "20px Jura";
                ctx.textAlign = "center";
                // first draw the text in black to create a shadow
                ctx.fillStyle = "#000000";
                ctx.fillText(`Press [ ${promptButton} ] to restart`, game.gameView.w / 2 + 2, game.gameView.h / 2 + 42);
                ctx.fillStyle = "#FFFFFF";
                // then draw the text in white
                ctx.fillText(`Press [ ${promptButton} ] to restart`, game.gameView.w / 2, game.gameView.h / 2 + 40);
                if (game.player.controller.type == 'touch') {
                    let img = new Image();
                    img.src = 'img/sprites/inventory/sword_inactive.png';
                    ctx.drawImage(img, (game.gameView.w / 2) - 150, game.gameView.h - 64, 64, 64);
                }
            }
            if (this.menu)
                this.menu.draw();
        }
    }

    Matches.ForHonorMP = ForHonorMP;

    return Matches;
}));