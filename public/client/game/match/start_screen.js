/*
  #####                                #####
 #     # #####   ##   #####  #####    #     #  ####  #####  ###### ###### #    #
 #         #    #  #  #    #   #      #       #    # #    # #      #      ##   #
  #####    #   #    # #    #   #       #####  #      #    # #####  #####  # #  #
       #   #   ###### #####    #            # #      #####  #      #      #  # #
 #     #   #   #    # #   #    #      #     # #    # #   #  #      #      #   ##
  #####    #   #    # #    #   #       #####   ####  #    # ###### ###### #    #

*/
class Start_Screen extends Match {
    constructor() {
        super();
    }

    reset() {
        super.reset();

    }

    setup() {
        super.setup();
        this.map = new Map_Deathbox();
        this.name = "Game Menu";
        this.description = "";
        this.despawnTimer = 360;
        game.player.character.active = false;
        game.player.character.visible = false;
        this.map.blocks.push(new Block(
            allID++,
            new Vect3((this.map.w / 2) - 0, (this.map.h / 2), 0),
            new Vect3(0, 0, 0),
            { color: [101, 101, 101], colorSide: [201, 201, 201] }))
        game.player.camera.target = this.map.blocks[this.map.blocks.length - 1];
        // loop twice
        for (let i = 0; i < 2; i++) {
            this.bots.push(new Bot()) //Kevin / Jae'Sin
            this.bots[this.bots.length - 1].character = new Jetbike(
                allID++,
                new Vect3(Math.random() * this.map.w, Math.random() * this.map.h),
                this.bots[this.bots.length - 1],
                { name: getName(), team: 1, gfx: 'img/sprites/dark2', color: [0, 0, 255], muted: true }
            );
            this.bots[this.bots.length - 1].character.inventory.push(new Pistol());
            this.bots.push(new Bot()) //Kevin / Jae'Sin
            this.bots[this.bots.length - 1].character = new Jetbike(
                allID++,
                new Vect3(Math.random() * this.map.w, Math.random() * this.map.h),
                this.bots[this.bots.length - 1],
                { name: getName(), team: 0, gfx: 'img/sprites/dark1', color: [0, 128, 0], muted: true }
            );
            this.bots[this.bots.length - 1].character.inventory.push(new Pistol());
        }
        game.menu = game.menus.main;
    }

    step = () => {
        super.step();
        // counter number of bot characters on each team
        let team0 = 0;
        let team1 = 0;
        for (let i = 0; i < this.bots.length; i++) {
            if (this.bots[i].character.team == 0) team0++;
            if (this.bots[i].character.team == 1) team1++;
        }
        // if there are more bots on team 0 than team 1, add a bot to team 1
        if (team0 > team1) {
            this.bots.push(new Bot()) //Kevin / Jae'Sin
            this.bots[this.bots.length - 1].character = new Jetbike(
                allID++,
                new Vect3(Math.random() * this.map.w, Math.random() * this.map.h),
                this.bots[this.bots.length - 1],
                { name: getName(), team: 1, gfx: 'img/sprites/dark2', color: [0, 0, 255], muted: true }
            );
            this.bots[this.bots.length - 1].character.inventory.push(new Pistol());
        }
        // if there are more bots on team 1 than team 0, add a bot to team 0
        if (team1 > team0) {
            this.bots.push(new Bot()) //Kevin / Jae'Sin
            this.bots[this.bots.length - 1].character = new Jetbike(
                allID++,
                new Vect3(Math.random() * this.map.w, Math.random() * this.map.h),
                this.bots[this.bots.length - 1],
                { name: getName(), team: 0, gfx: 'img/sprites/dark1', color: [0, 0, 255], muted: true }
            );
            this.bots[this.bots.length - 1].character.inventory.push(new Pistol());
        }
    }

    draw() {
        // draw a vignette with a gradient
        let gradient = ctx.createRadialGradient(game.window.w / 2, game.window.h / 2, 0, game.window.w / 2, game.window.h / 2, game.window.w / 2);
        gradient.addColorStop(0, "rgba(20,0,20,0)");
        gradient.addColorStop(1, "rgba(20,0,20,1)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, game.window.w, game.window.h);
        // draw the title
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "36px Jura";
        ctx.textAlign = "center";
        // first draw the text in black to create a shadow
        ctx.fillStyle = "#000000";
        ctx.fillText(`Space Elves on Jetbikes`, game.window.w / 2 + 2, game.window.h / 2 - 88);
        ctx.fillStyle = "#FFFFFF";
        // then draw the text in white
        ctx.fillText(`Space Elves on Jetbikes`, game.window.w / 2, game.window.h / 2 - 90);
    }
}
