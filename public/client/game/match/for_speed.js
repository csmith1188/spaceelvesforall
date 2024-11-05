/*
 #######                   #####
 #        ####  #####     #     # #####  ###### ###### #####
 #       #    # #    #    #       #    # #      #      #    #
 #####   #    # #    #     #####  #    # #####  #####  #    #
 #       #    # #####           # #####  #      #      #    #
 #       #    # #   #     #     # #      #      #      #    #
 #        ####  #    #     #####  #      ###### ###### #####

*/

class Match_ForSpeed extends Match {
    constructor() {
        super();
        this.setup();
    }

    reset() {
        super.reset();
        this.bots = [];
        this.setup();
    }

    setup() {
        super.setup();

        super.setup();
        this.map = new Map_FieldCity({ w: 9600, h: 9600, startBlocks: 200 });
        this.map.tileSet = new Tileset({ generate: true, size: new Vect2(200, 200) })
        this.name = "For Speed";
        this.description = "A deadly race to the finish.";

        // Add player 1
        game.player.character = new Jetbike(
            allID++,
            new Vect3((this.map.w / 2) + 4500, (this.map.h / 2)),
            game.player,
            {
                name: 'Cpt. Fabius', gfx: 'img/sprites/jetbike',
                laps: -1, lapsTimes: [], lapTime: 0, lapBest: null, startTime: null, endTime: null,
                hp: 250, hp_max: 250
            });
        game.player.camera.target = game.player.character

        //place 16 blocks in a circle around the center of the map
        //distributed 22.5 degrees apart
        //starting 100 pixels above the center of the map
        //by pushing a new Block object to the map.blocks array
        this.goals = [];
        for (let i = 1; i < 17; i++) {
            let ranX = Math.round(Math.random() * 200) - 100;
            let ranY = Math.round(Math.random() * 200) - 100;
            this.map.blocks.push(new Block(
                allID++,
                new Vect3((this.map.w / 2) + (4000 + ((ranX + 500) * (i % 2))) * Math.cos(i * -22.5 * Math.PI / 180), (this.map.h / 2) + (4000 + ((ranY + 500) * (i % 2))) * Math.sin(i * -22.5 * Math.PI / 180), 0),
                new Vect3(128, 128, 64),
                { color: [101, 101, 101], colorSide: [201, 201, 201], solid: false, opacity: 0.25 }
            ));
            this.map.blocks[this.map.blocks.length - 1].trigger = function (actor, side) {
                // if the person who touched this is tracking goals
                if (actor.goal >= 0)
                    //if the actor's goal is the same as this block
                    if (actor.goals[actor.goal] === this) {
                        if (actor == game.player.character) { // Only play for the player until sound ranges are implemented
                            sounds.wallhit.currentTime = 0;
                            if (!this.muted) sounds.goal.play();
                        }
                        if (actor.goal == 0) {
                            // Start new lap
                            game.match.newLap(actor);
                        }
                        actor.goal++;
                        if (actor.goal >= actor.goals.length) {
                            actor.goal = 0;
                        }
                    }
            }.bind(this.map.blocks[this.map.blocks.length - 1]);
            this.map.blocks[this.map.blocks.length - 1].runFunc.push(function () {
                // get the index of this block and the player's goal in their goals array
                let index = game.player.character.goals.indexOf(this);
                let goal = game.player.character.goal;
                // if the index of this block is less than the index of the player's goal in their goals array
                if (index < goal) {
                    this.color = [128, 128, 0];
                    this.colorSide = [255, 255, 0];
                }
                // else if it's the same index
                else if (index == goal) {
                    this.color = [0, 128, 0];
                    this.colorSide = [0, 255, 0];
                }
                // else
                else {
                    this.color = [0, 0, 128];
                    this.colorSide = [0, 0, 255];
                }

            }.bind(this.map.blocks[this.map.blocks.length - 1]));
            this.goals.push(this.map.blocks[this.map.blocks.length - 1]);

            game.player.character.goals = this.goals;
            game.player.character.goal = 0;
        }

    }

    step() {
        super.step();
        if (game.player.character.active) {
            game.player.character.target = game.player.character.goals[game.player.character.goal];
        } else {
            game.player.character.target = null;
            if (game.player.character.endTime == null) game.player.character.endTime = this.ticks;
            if (game.player.controller.buttons.inventory1.current)
                this.reset();
        }
    }

    draw() {
        super.draw();

        if (game.player.character.active) {

            if (game.match.ticks < 240) {
                let alpha = 1 - (game.match.ticks) / 240;
                //first draw the text in black to create a shadow
                ctx.fillStyle = "rgba(0,0,0," + alpha + ")";
                ctx.font = "30px Jura";
                ctx.textAlign = "center";
                ctx.fillText(this.name, game.window.w / 2 + 2, game.window.h / 2 - 138);
                ctx.font = "20px Jura";
                ctx.fillText(this.description, game.window.w / 2 + 2, game.window.h / 2 - 98);
                //then draw the text in white
                ctx.fillStyle = "rgba(255,255,255," + alpha + ")";
                ctx.font = "30px Jura";
                ctx.textAlign = "center";
                ctx.fillText(this.name, game.window.w / 2, game.window.h / 2 - 140);
                ctx.font = "20px Jura";
                ctx.fillText(this.description, game.window.w / 2, game.window.h / 2 - 100);
            }

            let matchBox = new Vect2((game.window.w / 2) - 150, game.window.h - 280);

            // draw the lap counter in the matchBox
            ctx.fillStyle = "#FFFFFF";
            ctx.font = "16px Jura";
            ctx.textAlign = "left";
            // first draw the text in black to create a shadow
            ctx.fillStyle = "#000000";
            ctx.fillStyle = "#FFFFFF";
            if (game.player.character.startTime) {
                ctx.fillStyle = "#000000";
                ctx.fillText(`Lap ${game.player.character.laps + 1} of 3`, matchBox.x + 2, matchBox.y + 52);
                ctx.fillText(`Time: ${formatTicks(game.match.ticks - game.player.character.lapTime)}`, matchBox.x + 2, matchBox.y + 72);
                ctx.fillText(`Total: ${formatTicks(this.ticks - game.player.character.startTime)}`, matchBox.x + 2, matchBox.y + 92);
                ctx.fillStyle = "#FFFFFF";
                ctx.fillText(`Lap ${game.player.character.laps + 1} of 3`, matchBox.x, matchBox.y + 50);
                ctx.fillText(`Time: ${formatTicks(game.match.ticks - game.player.character.lapTime)}`, matchBox.x, matchBox.y + 70);
                ctx.fillText(`Total: ${formatTicks(this.ticks - game.player.character.startTime)}`, matchBox.x, matchBox.y + 90);
            }
        } else {
            // draw "Finished!" or "You failed!" in the top center of the screen in green or red
            ctx.font = "36px Jura";
            ctx.textAlign = "center";
            // first draw the text in black to create a shadow
            ctx.fillStyle = "#000000";
            let state, color;
            if (game.player.character.laps >= 3) { color = "#00FF00"; state = "Finished!"; }
            else { color = "#FF0000"; state = "Failed!"; }
            ctx.fillText(state, game.window.w / 2 + 2, 92);
            ctx.fillStyle = color;
            ctx.fillText(state, game.window.w / 2, 90);
            // Draw the player's time
            ctx.fillStyle = "#FFFFFF";
            ctx.font = "16px Jura";
            ctx.textAlign = "center";
            // first draw the text in black to create a shadow
            ctx.fillStyle = "#000000";
            ctx.fillText(`Best Lap: ${formatTicks(game.player.character.lapBest)}`, game.window.w / 2 + 2, 132);
            ctx.fillText(`Total: ${formatTicks(game.player.character.endTime - game.player.character.startTime)}`, game.window.w / 2 + 2, 152);
            ctx.fillStyle = "#FFFFFF";
            ctx.fillText(`Best Lap: ${formatTicks(game.player.character.lapBest)}`, game.window.w / 2, 130);
            ctx.fillText(`Total: ${formatTicks(game.player.character.endTime - game.player.character.startTime)}`, game.window.w / 2, 150);
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
            ctx.fillText(`Press [ ${promptButton} ] to restart`, game.window.w / 2 + 2, 192);
            ctx.fillStyle = "#FFFFFF";
            // then draw the text in white
            ctx.fillText(`Press [ ${promptButton} ] to restart`, game.window.w / 2, 190);
            if (game.player.controller.type == 'touch') {
                let img = new Image();
                img.src = 'img/sprites/inventory/sword_inactive.png';
                ctx.drawImage(img, (game.window.w / 2) - 150, game.window.h - 64, 64, 64);
            }
        }
    }

    newLap(who) {

        this.spawnBot();

        who.laps++;

        if (who.laps) {
            // push previous time to the laps array
            who.lapsTimes.push(this.ticks - who.lapTime);
        } else {
            // set the start time
            who.startTime = this.ticks;
        }

        // best lap
        if (this.ticks - who.lapTime < who.lapBest || who.lapBest == null) {
            who.lapBest = this.ticks - who.lapTime;
        }

        who.lapTime = this.ticks;

        if (who.laps >= 3) {
            who.endTime = this.ticks;
            who.active = false;
            who.visible = false;
        } else {
            for (let i = 1; i < 16; i++) {
                let ranX = Math.round(Math.random() * 200) - 100;
                let ranY = Math.round(Math.random() * 200) - 100;
                if (i % 2) {
                    // put a powerup between every other block
                    // offset by 11.25 degrees
                    let pickupVect = new Vect3((this.map.w / 2) + (4000 + ((ranX + 500) * (i % 2))) * Math.cos((i * -22.5 - 11.25) * Math.PI / 180), (this.map.h / 2) + (4000 + ((ranY + 500) * (i % 2))) * Math.sin((i * -22.5 - 11.25) * Math.PI / 180), 0);
                    let ranPickup = Math.floor(Math.random() * 4);
                    // switch picks which pickup to add
                    switch (ranPickup) {
                        case 0:
                            this.map.blocks.push(new Ammo_Ballistic(allID++, pickupVect, new Vect3(128, 128, 64), { livetime: 3600, dying: true }));
                            break;
                        case 1:
                            this.map.blocks.push(new Ammo_Plasma(allID++, pickupVect, new Vect3(128, 128, 64), { livetime: 3600, dying: true }));
                            break;
                        case 2:
                            this.map.blocks.push(new HealthPickup(allID++, pickupVect, new Vect3(128, 128, 64), { livetime: 3600, dying: true }));
                            break;
                        case 3:
                            ranPickup = Math.floor(Math.random() * 4);
                            let choice;
                            switch (ranPickup) {
                                case 0:
                                    choice = 'pistol';
                                    break;
                                case 1:
                                    choice = 'rifle';
                                    break;
                                case 2:
                                    choice = 'flamer';
                                    break;
                                case 3:
                                    choice = 'lance';
                                    break;
                                default:
                                    console.log('skip');
                                    break;
                            }
                            this.map.blocks.push(new WeaponPickup(allID++, pickupVect, new Vect3(128, 128, 64), { weapon: choice, pickupDelay: 0 }));
                            break;
                        default:
                            console.log('skip');
                            break;
                    }
                    this.map.blocks.push(new HealthPickup(allID++, pickupVect, new Vect3(128, 128, 64), { livetime: 360, dying: true }));
                }
            }

        }
    }

    spawnBot() {
        // add an enemy bot to the map
        this.bots.push(new Bot()) //Kevin / Jae'Sin
        this.bots[this.bots.length - 1].character = new Jetbike(
            allID++,
            new Vect3((this.map.w / 2) + 4000, (this.map.h / 2) + 1000, 0),
            this.bots[this.bots.length - 1],
            {
                target: game.player.character,
                // target: this.bots[this.bots.length - 1].character,
                name: getName(), team: 1, gfx: 'img/sprites/dark2', color: [0, 0, 255],
                hp: 60, hp_max: 60
            }
        );
        let rand = Math.floor(Math.random() * 4);
        switch (rand) {
            case 0:
                this.bots[this.bots.length - 1].character.inventory.push(new Pistol())
                break;
            case 1:
                this.bots[this.bots.length - 1].character.inventory.push(new Rifle())
                break;
            case 2:
                this.bots[this.bots.length - 1].character.inventory.push(new Flamer())
                break;
            case 3:
                this.bots[this.bots.length - 1].character.inventory.push(new Lance())
                break;
        }
        this.bots[this.bots.length - 1].character.item = Math.round(Math.random());
        this.bots[this.bots.length - 1].character.goals = this.goals;
        this.bots[this.bots.length - 1].character.goal = 0;
    }

}