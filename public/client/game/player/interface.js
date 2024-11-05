/*
      ::::::::::: ::::    ::: ::::::::::: :::::::::: :::::::::  ::::::::::   :::      ::::::::  ::::::::::
         :+:     :+:+:   :+:     :+:     :+:        :+:    :+: :+:        :+: :+:   :+:    :+: :+:
        +:+     :+:+:+  +:+     +:+     +:+        +:+    +:+ +:+       +:+   +:+  +:+        +:+
       +#+     +#+ +:+ +#+     +#+     +#++:++#   +#++:++#:  :#::+::# +#++:++#++: +#+        +#++:++#
      +#+     +#+  +#+#+#     +#+     +#+        +#+    +#+ +#+      +#+     +#+ +#+        +#+
     #+#     #+#   #+#+#     #+#     #+#        #+#    #+# #+#      #+#     #+# #+#    #+# #+#
########### ###    ####     ###     ########## ###    ### ###      ###     ###  ########  ##########
*/
class Interface {
    constructor(player) {
        this.player = player;
        this.xhair = new Image();
        this.xhair.src = 'img/sprites/xhair.png';
        this.hud = {
            barW: 48
        }
        this.drawFriendlyRing = 0.5;
        this.drawNeutralRing = 0.5;
        this.drawEnemyRing = 0.5;
        this.touchButton = {
            inventory1: null,
            inventory2: null,
            pause: null
        }
        this.minimapRadius = 80;
        this.menuIndex = -1;
        this.menus = [];
        this.drawFunc = []; // A list of functions to draw during the draw step
    }

    /*
                                 #     # #     # ######
     #####  #####    ##   #    # #     # #     # #     #
     #    # #    #  #  #  #    # #     # #     # #     #
     #    # #    # #    # #    # ####### #     # #     #
     #    # #####  ###### # ## # #     # #     # #     #
     #    # #   #  #    # ##  ## #     # #     # #     #
     #####  #    # #    # #    # #     #  #####  ######

    */
    drawHUD() {
        // Run all drawFunc
        for (const func of this.drawFunc) {
            func();
        }

        // The normal HUD in every game mode
        if (this.player.character.active) {

            // Map Edge
            this.drawMapEdge();

            //Minimap
            this.drawMinimap();

            //Ammo
            this.drawAmmo();

            //Crosshair
            this.drawXhair();

            //Menu
            this.drawMenu();

            if (game.debug) {
                ctx.fillStyle = "#FFFFFF";
                ctx.font = '12px Jura';
                ctx.fillText(game.fps, 100, 150);
                document.getElementById("debugger").style.display = "block";
            } else {
                document.getElementById("debugger").style.display = "none";
            }

        }
    }

    drawMapEdge() {
        // Map locators
        ctx.fillStyle = "#FF0000";
        ctx.fillRect((this.player.camera.x / game.match.map.w) * game.window.w - 3, 0, 6, 6);
        ctx.fillRect((this.player.camera.x / game.match.map.w) * game.window.w - 3, game.window.h - 6, 6, 6);
        ctx.fillStyle = "#0000FF";
        ctx.fillRect(0, (this.player.camera.y / game.match.map.h) * game.window.h - 3, 6, 6);
        ctx.fillRect(game.window.w - 6, (this.player.camera.y / game.match.map.h) * game.window.h - 3, 6, 6);
    }

    /*
                                    #
     #####  #####    ##   #    #   # #   #    # #    #  ####
     #    # #    #  #  #  #    #  #   #  ##  ## ##  ## #    #
     #    # #    # #    # #    # #     # # ## # # ## # #    #
     #    # #####  ###### # ## # ####### #    # #    # #    #
     #    # #   #  #    # ##  ## #     # #    # #    # #    #
     #####  #    # #    # #    # #     # #    # #    #  ####

    */
    drawAmmo() {
        if (this.player.character.active) {
            let item = this.player.character.inventory[this.player.character.item];

            let ammoBox = new Vect2((game.window.w / 2) - 130, game.window.h - 170);

            ctx.textAlign = "left";

            // draw the cooldown bar
            // if the item exists, draw the cooldown and ammo bars
            if (item) {
                // draw background   
                ctx.fillStyle = "#000000";
                ctx.fillRect(ammoBox.x + 20, ammoBox.y, 10, 100);
                // draw filled portion of bar
                let maxTime = (item.reloading) ? item.reloadTime : item.coolDown;
                ctx.fillStyle = "#0000FF";
                ctx.fillRect(
                    ammoBox.x + 20, // left of bar
                    ammoBox.y + 100 // bottom of bar
                    - (Math.min( // the smaller value of
                        Math.max(item.nextCool - game.match.ticks, 0) / maxTime, // 0 to 1 of cooldown
                        1) // or 1 (if cooldown is greater than 1)
                        * 100), // times the size of the full bar
                    10, // width of bar
                    (Math.min(  // bar is the same height as the distance from top, conviently
                        Math.max(item.nextCool - game.match.ticks, 0) / maxTime,
                        1)
                        * 100) // times the size of the full bar
                );
                if (item.type == "ballistic" || item.type == "plasma") {
                    // draw the ammo bar
                    ctx.fillStyle = "#000000";
                    ctx.fillRect(ammoBox.x, ammoBox.y, 10, 100);
                    // if the ammo is ballistic, draw it red, otherwise, draw it purple
                    if (item.type == "ballistic") ctx.fillStyle = "#FF0000";
                    else ctx.fillStyle = "#FF00FF";
                    ctx.fillRect(ammoBox.x, ammoBox.y + 100 - (item.ammo / item.ammoMax) * 100, 10, (item.ammo / item.ammoMax) * 100);
                }
            }


            // if the player has ballistic ammo
            if (this.player.character.ammo.ballistic > 0) {
                // draw the player's ballistic ammo pips
                ctx.fillStyle = "#000000";
                ctx.font = '12px Jura';
                ctx.fillStyle = "#000000";
                ctx.fillRect(ammoBox.x + 230, ammoBox.y, 10, 100);
                ctx.fillStyle = "#FF0000";
                // for each pip, draw a rectangle
                for (let i = this.player.character.ammo.ballistic - 1; i >= 0; i--) {
                    ctx.fillRect(ammoBox.x + 231, ammoBox.y + 101 - ((i + 1) * 100 / this.player.character.ammo.plasmaMax), 8, (100 / this.player.character.ammo.plasmaMax) - 2);
                }
            }

            // if the player has plasma ammo
            if (this.player.character.ammo.plasma > 0) {
                // draw the player's plasma ammo pips
                ctx.fillStyle = "#000000";
                ctx.font = '12px Jura';
                ctx.fillStyle = "#000000";
                ctx.fillRect(ammoBox.x + 250, ammoBox.y, 10, 100);
                ctx.fillStyle = "#FF00FF";
                // for each pip, draw a rectangle
                for (let i = this.player.character.ammo.plasma - 1; i >= 0; i--) {
                    ctx.fillRect(ammoBox.x + 251, ammoBox.y + 101 - ((i + 1) * 100 / this.player.character.ammo.plasmaMax), 8, (100 / this.player.character.ammo.plasmaMax) - 2);
                }
            }

            /*
              _                 _
             (_)_ ___ _____ _ _| |_ ___ _ _ _  _
             | | ' \ V / -_) ' \  _/ _ \ '_| || |
             |_|_||_\_/\___|_||_\__\___/_|  \_, |
                                            |__/
            */
            //if one item, it is active
            if (this.player.character.inventory.length == 1) ctx.drawImage(this.player.character.inventory[0].icon, (game.window.w / 2) - 150, game.window.h - 64, 64, 64);
            else if (this.player.character.inventory.length == 2) {
                // if you have two, draw both
                switch (this.player.character.item) {
                    case 0:
                        ctx.drawImage(this.player.character.inventory[0].icon, (game.window.w / 2) - 150, game.window.h - 64, 64, 64);
                        ctx.drawImage(this.player.character.inventory[1].iconInactive, (game.window.w / 2) + 88, game.window.h - 64, 64, 64);
                        break;
                    case 1:
                        ctx.drawImage(this.player.character.inventory[0].iconInactive, (game.window.w / 2) - 150, game.window.h - 64, 64, 64)
                        ctx.drawImage(this.player.character.inventory[1].icon, (game.window.w / 2) + 88, game.window.h - 64, 64, 64);
                        break;
                }
            }
            this.touchButton.inventory1 = new Rect((game.window.w / 2) - 150, game.window.h - 64, 64, 64);
            this.touchButton.inventory2 = new Rect((game.window.w / 2) + 90, game.window.h - 64, 64, 64);
            this.touchButton.pause = new Rect(game.window.w - 55, 5, 50, 50);
            if (this.itemChangeTicks > game.match.ticks && this.player.character.inventory[this.player.character.item]) {
                // globalAlpha is percentage of time left
                ctx.globalAlpha = (this.itemChangeTicks - game.match.ticks) / 180;
                // center the text
                ctx.textAlign = "center";
                // draw black shadow first
                ctx.fillStyle = "#000000";
                ctx.font = '16px Jura';
                ctx.fillText(this.player.character.inventory[this.player.character.item].name, (game.window.w / 2) + 1, game.window.h - 59);
                // then draw white text
                ctx.fillStyle = "#FFFFFF";
                ctx.fillText(this.player.character.inventory[this.player.character.item].name, (game.window.w / 2), game.window.h - 60);
            }
            ctx.globalAlpha = 1;

        }
    }

    /*
                                 #     #
     #####  #####    ##   #    #  #   #  #    #   ##   # #####
     #    # #    #  #  #  #    #   # #   #    #  #  #  # #    #
     #    # #    # #    # #    #    #    ###### #    # # #    #
     #    # #####  ###### # ## #   # #   #    # ###### # #####
     #    # #   #  #    # ##  ##  #   #  #    # #    # # #   #
     #####  #    # #    # #    # #     # #    # #    # # #    #

    */
    drawXhair() {
        // origin, angle, distance, size, spread, color, arc, laser, numXhairs
        if (!game.match.paused && !game.paused) {
            let compareX = game.player.camera.x - this.player.character.HB.pos.x;
            let compareY = game.player.camera.y - this.player.character.HB.pos.y;
            // Calculate a relative aimX without changing the original aimX
            let aimX = this.player.controller.aimX;
            let aimY = this.player.controller.aimY;
            //find the distance from this.player to mouse with pythagorean theorem
            let distance = ((aimX ** 2) + (aimY ** 2)) ** 0.5;
            //Normalize the dimension distance by the real distance (ratio)
            //Then multiply by the distance of the out circle
            aimX = (aimX / distance);
            aimY = (aimY / distance);

            let aimRad = 150;

            // Draw the original image
            ctx.drawImage(this.xhair, (game.window.w / 2) - compareX + aimX * aimRad - 8, (game.window.h / 2) - compareY + aimY * aimRad - 8 - (this.player.character.HB.height / 2), 16, 16);

        }
    }

    /*
                                 #     #
     #####  #####    ##   #    # ##   ## # #    # # #    #   ##   #####
     #    # #    #  #  #  #    # # # # # # ##   # # ##  ##  #  #  #    #
     #    # #    # #    # #    # #  #  # # # #  # # # ## # #    # #    #
     #    # #####  ###### # ## # #     # # #  # # # #    # ###### #####
     #    # #   #  #    # ##  ## #     # # #   ## # #    # #    # #
     #####  #    # #    # #    # #     # # #    # # #    # #    # #

    */
    drawMinimap() {
        /*
        _  _          _ _   _    _
        | || |___ __ _| | |_| |_ | |__  __ _ _ _ ___
        | __ / -_) _` | |  _| ' \| '_ \/ _` | '_(_-<
        |_||_\___\__,_|_|\__|_||_|_.__/\__,_|_| /__/
 
        */
        // Draw this player's health and power as circles around the minimap edge
        ctx.globalAlpha = 1;
        ctx.lineWidth = 12;
        // Background for both bars
        ctx.beginPath();
        ctx.strokeStyle = "#000000";
        ctx.arc(game.window.w / 2, game.window.h - 100, this.minimapRadius + 7.5, -Math.PI / 2, Math.PI * 1.5);
        ctx.stroke();
        ctx.globalAlpha = 0.75;
        ctx.lineWidth = 4;
        // Health
        ctx.beginPath();
        ctx.strokeStyle = "#00FF00";
        ctx.arc(game.window.w / 2, game.window.h - 100, this.minimapRadius + 10, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * (this.player.character.hp / this.player.character.hp_max)));
        ctx.stroke();
        // Power
        ctx.beginPath();
        ctx.strokeStyle = "#0099FF";
        ctx.arc(game.window.w / 2, game.window.h - 100, this.minimapRadius + 5, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * (this.player.character.pp / this.player.character.pp_max)));
        ctx.stroke();
        ctx.globalAlpha = 1;
        // draw the minimap circle
        ctx.fillStyle = "#000000";
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.arc(game.window.w / 2, game.window.h - 100, this.minimapRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#00FF00";
        for (let i = 1; i < 4; i++) {
            ctx.beginPath();
            ctx.lineWidth = i;
            ctx.arc(game.window.w / 2, game.window.h - 100, (this.minimapRadius / 3) * i, 0, Math.PI * 2);
            ctx.stroke();
        }
        /*
          ___      _
         | _ ) ___| |_ ___
         | _ \/ _ \  _(_-<
         |___/\___/\__/__/
 
        */
        //draw each bot
        for (let i = 0; i < game.match.bots.length; i++) {
            //calculate the distance from the player to the bot
            let distance = Math.sqrt((game.match.bots[i].character.HB.pos.x - game.player.character.HB.pos.x) ** 2 + (game.match.bots[i].character.HB.pos.y - game.player.character.HB.pos.y) ** 2);
            //calculate the angle from the player to the bot
            let angle = Math.atan2(game.match.bots[i].character.HB.pos.y - game.player.character.HB.pos.y, game.match.bots[i].character.HB.pos.x - game.player.character.HB.pos.x);
            //calculate the bot's position on the minimap
            let x = (game.window.w / 2) + (Math.cos(angle) * Math.min(distance / 10, this.minimapRadius));
            let y = (game.window.h - 100) + (Math.sin(angle) * Math.min(distance / 10, this.minimapRadius));
            // if the x or y distance is greater than the minimap radius, reduce opacity 0.5
            if (distance > this.minimapRadius * 12.5)
                ctx.globalAlpha = 0.5;
            else
                ctx.globalAlpha = 1;
            //draw the bot
            if (game.match.bots[i].character.team === game.player.character.team) {
                ctx.fillStyle = "#00FF00";
            } else if (game.match.bots[i].character.team === 0) {
                ctx.fillStyle = "#FFFF00";
            } else {
                ctx.fillStyle = "#FF0000";
            }
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fill();
        }

        /*
          ___
         | _ \_____ __ _____ _ _ _  _ _ __ ___
         |  _/ _ \ V  V / -_) '_| || | '_ (_-<
         |_| \___/\_/\_/\___|_|  \_,_| .__/__/
                                     |_|
        */
        ctx.globalAlpha = 0.5;
        for (let i = 0; i < game.match.map.blocks.length; i++) {
            let item = game.match.map.blocks[i];
            if (item.type == "pickup") {
                //calculate the distance from the player to the bot
                let distance = Math.sqrt((item.HB.pos.x - game.player.character.HB.pos.x) ** 2 + (item.HB.pos.y - game.player.character.HB.pos.y) ** 2);
                if (distance > 2000) continue;
                //calculate the angle from the player to the bot
                let angle = Math.atan2(item.HB.pos.y - game.player.character.HB.pos.y, item.HB.pos.x - game.player.character.HB.pos.x);
                //calculate the bot's position on the minimap
                let x = (game.window.w / 2) + (Math.cos(angle) * Math.min(distance / 10, this.minimapRadius));
                let y = (game.window.h - 100) + (Math.sin(angle) * Math.min(distance / 10, this.minimapRadius));
                //draw the item
                if (item.subtype == "ammo_ballistic") {
                    ctx.fillStyle = "#FF0000";
                    ctx.fillRect(x, y, 4, 4);
                } else if (item.subtype == "ammo_plasma") {
                    ctx.fillStyle = "#FF00FF";
                    ctx.fillRect(x, y, 4, 4);
                } else if (item.subtype == "health") {
                    ctx.fillStyle = "#00FF00";
                    ctx.fillRect(x, y, 4, 4);
                }
            }
        }

        /*
          _____                  _
         |_   _|_ _ _ _ __ _ ___| |_
           | |/ _` | '_/ _` / -_)  _|
           |_|\__,_|_| \__, \___|\__|
                       |___/
        */

        // draw the target on the minimap in yellow
        if (this.player.character.target) {
            let distance = Math.sqrt((this.player.character.target.HB.pos.x - game.player.character.HB.pos.x) ** 2 + (this.player.character.target.HB.pos.y - game.player.character.HB.pos.y) ** 2);
            let angle = Math.atan2(this.player.character.target.HB.pos.y - game.player.character.HB.pos.y, this.player.character.target.HB.pos.x - game.player.character.HB.pos.x);
            let x = (game.window.w / 2) + (Math.cos(angle) * Math.min(distance / 10, this.minimapRadius));
            let y = (game.window.h - 100) + (Math.sin(angle) * Math.min(distance / 10, this.minimapRadius));
            ctx.fillStyle = "#00FF00";
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fill();
        }



        /*
               _
          _ __| |__ _ _  _ ___ _ _
         | '_ \ / _` | || / -_) '_|
         | .__/_\__,_|\_, \___|_|
         |_|          |__/
        */
        ctx.globalAlpha = 1;
        //draw the player
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(game.window.w / 2, game.window.h - 100, 5, 0, Math.PI * 2);
        ctx.fill();

        /*
          ___                  _
         / __|_ __  ___ ___ __| |
         \__ \ '_ \/ -_) -_) _` |
         |___/ .__/\___\___\__,_|
             |_|
        */
        ctx.textAlign = "center";
        ctx.font = '16px Jura';
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#000000";
        ctx.beginPath();
        ctx.arc(game.window.w / 2 - 64, game.window.h - 20, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(game.window.w / 2 + 64, game.window.h - 20, 20, 0, Math.PI * 2);
        ctx.fill();
        // draw a vertical bar in the center of the z position circle
        // that represents the player's z position to a max of 200
        ctx.fillStyle = "#999900";
        ctx.fillRect(game.window.w / 2 - 69, game.window.h - 5, 10, -Math.min((this.player.character.HB.pos.z / 600) * 30, 30));
        // first draw the text in black to create a black outline
        ctx.fillStyle = "#000000";
        ctx.font = '16px Jura';
        ctx.fillText(Math.round(this.player.character.HB.pos.z), game.window.w / 2 - 63, game.window.h - 14);
        // then draw the text in white
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(Math.round(this.player.character.HB.pos.z), game.window.w / 2 - 64, game.window.h - 15);
        // calculate the player's total speed
        let speed = Math.sqrt(this.player.character.speed.x ** 2 + this.player.character.speed.y ** 2 + this.player.character.speed.z ** 2);
        ctx.fillStyle = "#990099";
        ctx.fillRect(game.window.w / 2 + 59, game.window.h - 5, 10, -Math.min((speed / 50) * 30, 30));
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(Math.round(speed), game.window.w / 2 + 64, game.window.h - 15);
        // draw white outline around edge of black circles
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(game.window.w / 2 - 64, game.window.h - 20, 20, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(game.window.w / 2 + 64, game.window.h - 20, 20, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Draw the menu
    drawMenu() {
        // draw every menu
        for (const menu of this.menus) {
            menu.draw();
        }
    }
}


/*
      :::        ::::::::   ::::::::      :::     :::          :::   :::   :::::::::
     :+:       :+:    :+: :+:    :+:   :+: :+:   :+:         :+:+: :+:+:  :+:    :+:
    +:+       +:+    +:+ +:+         +:+   +:+  +:+        +:+ +:+:+ +:+ +:+    +:+
   +#+       +#+    +:+ +#+        +#++:++#++: +#+        +#+  +:+  +#+ +#++:++#+
  +#+       +#+    +#+ +#+        +#+     +#+ +#+        +#+       +#+ +#+
 #+#       #+#    #+# #+#    #+# #+#     #+# #+#        #+#       #+# #+#
########## ########   ########  ###     ### ########## ###       ### ###
*/
class Interface_LocalMP extends Interface {
    constructor(player, posX, posY) {
        super(player);
        this.position = {x: posX, y: posY};
    }

    drawHUD() {
        // Run all drawFunc
        for (const func of this.drawFunc) {
            func();
        }

        // The normal HUD in every game mode
        if (this.player.character.active) {

            //Ammo
            this.drawAmmo();

            //Crosshair
            this.drawXhair();

            //Menu
            this.drawMenu();

        }
    }

    drawAmmo() {

        let item = this.player.character.inventory[this.player.character.item];


        // create a rectangee to put the HUD in
        // Sometimes the position is a function so it can auto-adjust to the size of the window
        let x, y;
        if (this.position.x instanceof Function) x = this.position.x();
        else x = this.position.x;
        if (this.position.y instanceof Function) y = this.position.y();
        else y = this.position.y;

        let hudBox = new Rect(x, y, 280, 100);

        // draw background
        ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
        ctx.fillRect(hudBox.x, hudBox.y, hudBox.w, hudBox.h);
        // draw outline
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2;
        ctx.strokeRect(hudBox.x, hudBox.y, hudBox.w, hudBox.h);

        //draw the cooldown bar
        // if the item exists, draw the cooldown and ammo bars
        if (item) {
            // draw background   
            ctx.fillStyle = "#000000";
            ctx.fillRect(hudBox.x + 20, hudBox.y + 20, 10, 60);
            // draw filled portion of bar
            let maxTime = (item.reloading) ? item.reloadTime : item.coolDown;
            ctx.fillStyle = "#0000FF";
            ctx.fillRect(
                hudBox.x + 20, // left of bar
                hudBox.y + 80 // bottom of bar
                - (Math.min( // the smaller value of
                    Math.max(item.nextCool - game.match.ticks, 0) / maxTime, // 0 to 1 of cooldown
                    1) // or 1 (if cooldown is greater than 1)
                    * 60), // times the size of the full bar
                10, // width of bar
                (Math.min(  // bar is the same height as the distance from top, conviently
                    Math.max(item.nextCool - game.match.ticks, 0) / maxTime,
                    1)
                    * 60) // times the size of the full bar
            );
        }
        // draw the player's ballistic ammo pips
        if (this.player.character.ammo.ballistic > 0) {
            // draw the player's ballistic ammo pips
            ctx.fillStyle = "#000000";
            ctx.font = '12px Jura';
            ctx.fillStyle = "#000000";
            ctx.fillRect(hudBox.x + 230, hudBox.y + 20, 10, 60);
            ctx.fillStyle = "#FF0000";
            // for each pip, draw a rectangle
            for (let i = this.player.character.ammo.ballistic - 1; i >= 0; i--) {
                ctx.fillRect(hudBox.x + 231, hudBox.y + 81 - ((i + 1) * 60 / this.player.character.ammo.plasmaMax), 8, (60 / this.player.character.ammo.plasmaMax) - 2);
            }
        }
        // draw the player's plasma ammo pips
        if (this.player.character.ammo.plasma > 0) {
            ctx.fillStyle = "#000000";
            ctx.font = '12px Jura';
            ctx.fillStyle = "#000000";
            ctx.fillRect(hudBox.x + 250, hudBox.y + 20, 10, 60);
            ctx.fillStyle = "#FF00FF";
            // for each pip, draw a rectangle
            for (let i = this.player.character.ammo.plasma - 1; i >= 0; i--) {
                ctx.fillRect(hudBox.x + 251, hudBox.y + 81 - ((i + 1) * 60 / this.player.character.ammo.plasmaMax), 8, (60 / this.player.character.ammo.plasmaMax) - 2);
            }
        }
        // draw the player's health bar
        ctx.fillStyle = "#000000";
        ctx.fillRect(hudBox.x + 40, hudBox.y + 20, 10, 60);
        ctx.fillStyle = "#00FF00";
        ctx.fillRect(hudBox.x + 40, hudBox.y + 80 - (this.player.character.hp / this.player.character.hp_max) * 60, 10, (this.player.character.hp / this.player.character.hp_max) * 60);
        // draw the player's power bar
        ctx.fillStyle = "#000000";
        ctx.fillRect(hudBox.x + 60, hudBox.y + 20, 10, 60);
        ctx.fillStyle = "#0099FF";
        ctx.fillRect(hudBox.x + 60, hudBox.y + 80 - (this.player.character.pp / this.player.character.pp_max) * 60, 10, (this.player.character.pp / this.player.character.pp_max) * 60);
        // draw the player's name
        // black shadow
        ctx.fillStyle = "#000000";
        ctx.font = '16px Jura';
        ctx.textAlign = "left";
        ctx.fillText(this.player.character.name, hudBox.x + 81, hudBox.y + 19);
        // white text
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(this.player.character.name, hudBox.x + 80, hudBox.y + 18);
        // draw the player's icon
        ctx.drawImage(this.player.character.img, hudBox.x + 80, hudBox.y + 40 - sineAnimate(1, 0.1), 58, 37);


        //if one item, it is active
        if (this.player.character.inventory.length == 1) ctx.drawImage(this.player.character.inventory[0].icon, hudBox.x + 160, hudBox.y + 20, 48, 48);
        else if (this.player.character.inventory.length == 2) {
            // if you have two, draw both
            switch (this.player.character.item) {
                case 0:
                    ctx.drawImage(this.player.character.inventory[1].iconInactive, hudBox.x + 176, hudBox.y + 36, 48, 48);
                    ctx.drawImage(this.player.character.inventory[0].icon, hudBox.x + 160, hudBox.y + 20, 48, 48);
                    break;
                case 1:
                    ctx.drawImage(this.player.character.inventory[0].iconInactive, hudBox.x + 160, hudBox.y + 20, 48, 48)
                    ctx.drawImage(this.player.character.inventory[1].icon, hudBox.x + 176, hudBox.y + 36, 48, 48);
                    break;
            }
        }

    }
}