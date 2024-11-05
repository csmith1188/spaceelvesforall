/*
 #######                  #     #
 #        ####  #####     #     #  ####  #    #  ####  #####
 #       #    # #    #    #     # #    # ##   # #    # #    #
 #####   #    # #    #    ####### #    # # #  # #    # #    #
 #       #    # #####     #     # #    # #  # # #    # #####
 #       #    # #   #     #     # #    # #   ## #    # #   #
 #        ####  #    #    #     #  ####  #    #  ####  #    #

*/
class Match_ForHonor extends Match {
    constructor() {
        super();
        this.setup();
    }

    reset() {
        super.reset();

        this.lastWinner = null;

        // filter out all blocks that are not 'block'
        this.map.blocks = this.map.blocks.filter(function (el) { return el.type == 'block'; });

        game.player.character.active = true;
        game.player.character.visible = true;
        game.player.character.HB.pos.x = (this.map.w / 2) - 800;
        game.player.character.HB.pos.y = (this.map.h / 2);
        game.player.character.HB.pos.z = 0;
        game.player.character.speed.x = 0;
        game.player.character.speed.y = 0;
        game.player.character.speed.z = 0;
        game.player.character.hp = game.player.character.hp_max;
        game.player.character.inventory = [new Sword()];
        game.player.character.item = 0;
        game.player.character.pp = game.player.character.pp_max;
        game.player.character.ammo.ballistic = 1;
        game.player.character.ammo.plasma = 1;
        this.bots[0].character.active = true;
        this.bots[0].character.visible = true;
        this.bots[0].character.HB.pos.x = (this.map.w / 2) + 800;
        this.bots[0].character.HB.pos.y = (this.map.h / 2);
        this.bots[0].character.HB.pos.z = 0;
        this.bots[0].character.speed.x = 0;
        this.bots[0].character.speed.y = 0;
        this.bots[0].character.speed.z = 0;
        this.bots[0].character.hp = this.bots[0].character.hp_max;
        this.bots[0].character.inventory = [new Sword()];
        this.bots[0].character.item = 0;
        this.bots[0].character.pp = this.bots[0].character.pp_max;
        this.bots[0].character.ammo.ballistic = 1;
        this.bots[0].character.ammo.plasma = 1;

        // Add health pickups to each side fothe map
        this.map.blocks.push(new HealthPickup(
            allID++,
            new Vect3((this.map.w / 2) - 800, (this.map.h / 2) + 96, 0),
            new Vect3(128, 128, 64)));
        this.map.blocks.push(new HealthPickup(
            allID++,
            new Vect3((this.map.w / 2) + 800, (this.map.h / 2) - 96, 0),
            new Vect3(128, 128, 64)));
        // add both ammo pickups to top and bottom of map
        this.map.blocks.push(new Ammo_Ballistic(
            allID++,
            new Vect3((this.map.w / 2) - 500, (this.map.h / 2) - 400, 0),
            new Vect3(128, 128, 64)));
        this.map.blocks.push(new Ammo_Plasma(
            allID++,
            new Vect3((this.map.w / 2) + 472, (this.map.h / 2) + 400, 0),
            new Vect3(128, 128, 64)));
        this.map.blocks.push(new Ammo_Ballistic(
            allID++,
            new Vect3((this.map.w / 2) + 378, (this.map.h / 2) + 400, 0),
            new Vect3(128, 128, 64)));
        this.map.blocks.push(new Ammo_Plasma(
            allID++,
            new Vect3((this.map.w / 2) - 408, (this.map.h / 2) - 400, 0),
            new Vect3(128, 128, 64)));


        // add weapons to the center of the map
        this.map.blocks.push(new WeaponPickup(
            allID++,
            new Vect3((this.map.w / 2), (this.map.h / 2), 0),
            new Vect3(0, 0, 0),
            { weapon: 'pistol', pickupDelay: 0 }));
        this.map.blocks.push(new WeaponPickup(
            allID++,
            new Vect3((this.map.w / 2), (this.map.h / 2), 0),
            new Vect3(0, 0, 0),
            { weapon: 'lance', pickupDelay: 0 }));
        this.map.blocks.push(new WeaponPickup(
            allID++,
            new Vect3((this.map.w / 2), (this.map.h / 2), 0),
            new Vect3(0, 0, 0),
            { weapon: 'rifle', pickupDelay: 0 }));
        this.map.blocks.push(new WeaponPickup(
            allID++,
            new Vect3((this.map.w / 2), (this.map.h / 2) + 0, 0),
            new Vect3(0, 0, 0),
            { weapon: 'flamer', pickupDelay: 0 }));

        // for every block in the blocks array
        // if the block's type is not 'block'
        // add one to the counter
        let blockCounter = 0;
        for (const block of this.map.blocks) {
            if (block.type == 'weapon') {
                block.sineOffset = blockCounter++;
                block.runFunc.push(
                    function (bc) {
                        this.HB.pos.x = this.spawn.x + sineAnimate(100, 0.025, (this.sineOffset * 60));
                        this.HB.pos.y = this.spawn.y + sineAnimate(100, 0.025, (this.sineOffset * 60) + 60);
                    }.bind(block)
                );
            }
        }

    }

    setup() {
        super.setup();
        this.map = new Map_Deathbox();
        this.name = "For Honor";
        this.description = "A duel to the death.";

        // Add player 1
        game.player.character = new Jetbike(
            allID++,
            new Vect3((this.map.w / 2) - 800, (this.map.h / 2), 0),
            game.player,
            { name: 'Cpt. Fabius', gfx: 'img/sprites/jetbike', cleanup: false });
        game.player.interface = new Interface_LocalMP(game.player, 0, 0);

        // Add player 2
        this.bots.push(new Player()) //Kevin / Jae'Sin
        this.bots[this.bots.length - 1].character = new Jetbike(
            allID++,
            new Vect3((this.map.w / 2) + 800, (this.map.h / 2), 0),
            this.bots[this.bots.length - 1],
            { name: getName(), team: 1, gfx: 'img/sprites/dark2', cleanup: false, color: [0, 0, 255] }
        );
        // Change to local multiplayer interaface
        this.bots[this.bots.length - 1].interface = new Interface_LocalMP(this.bots[this.bots.length - 1], () => { return game.window.w - 280 }, 0);

        // Create a block to attach the camera to
        this.bots[this.bots.length - 1].name = 'Player 2';
        this.blocks.push(new Block(
            allID++,
            new Vect3((this.map.w / 2), (this.map.h / 2), 0),
            new Vect3(0, 0, 0),
            { solid: false, visible: false }));
        // Attach the camera to the block
        game.player.camera.target = this.blocks[this.blocks.length - 1];

        this.reset();
    }

    step() {
        super.step();
        if (game.window.w < 1720 || game.window.h < 920) {
            this.paused = true;
            this.menu = this.menus.tooSmall;
        } else if (this.menu) {
            this.paused = false;
            this.menu = null;
        }

        // TODO: handle more than two players
        if (!game.player.character.active || !this.bots[0].character.active) {
            this.lastWinner = (game.player.character.active) ? game.player.name : this.bots[0].name;
            if (game.player.controller.buttons.inventory1.current) {
                this.reset();
            }
        }

        if (this.menu)
            this.menu.step();

    }

    draw() {
        super.draw();
        if (this.lastWinner) {
            ctx.fillStyle = "rgba(0,0,0,0.5)";
            ctx.fillRect(0, 0, game.window.w, game.window.h);
            ctx.fillStyle = "#FFFFFF";
            ctx.font = "36px Jura";
            ctx.textAlign = "center";
            // first draw the text in black to create a shadow
            ctx.fillStyle = "#000000";
            ctx.fillText(`${this.lastWinner} wins!`, game.window.w / 2 + 2, game.window.h / 2 - 88);
            ctx.fillStyle = "#FFFFFF";
            // then draw the text in white
            ctx.fillText(`${this.lastWinner} wins!`, game.window.w / 2, game.window.h / 2 - 90);
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
            ctx.fillText(`Press [ ${promptButton} ] to restart`, game.window.w / 2 + 2, game.window.h / 2 + 42);
            ctx.fillStyle = "#FFFFFF";
            // then draw the text in white
            ctx.fillText(`Press [ ${promptButton} ] to restart`, game.window.w / 2, game.window.h / 2 + 40);
            if (game.player.controller.type == 'touch') {
                let img = new Image();
                img.src = 'img/sprites/inventory/sword_inactive.png';
                ctx.drawImage(img, (game.window.w / 2) - 150, game.window.h - 64, 64, 64);
            }
        }
        if (this.menu)
            this.menu.draw();
    }
}