/*
        :::   :::   :::::::::: ::::    ::: :::    :::  ::::::::
      :+:+: :+:+:  :+:        :+:+:   :+: :+:    :+: :+:    :+:
    +:+ +:+:+ +:+ +:+        :+:+:+  +:+ +:+    +:+ +:+
   +#+  +:+  +#+ +#++:++#   +#+ +:+ +#+ +#+    +:+ +#++:++#++
  +#+       +#+ +#+        +#+  +#+#+# +#+    +#+        +#+
 #+#       #+# #+#        #+#   #+#+# #+#    #+# #+#    #+#
###       ### ########## ###    ####  ########   ########
*/
class Menu {
    constructor(buttons, shape, options) {
        this.visible = true;
        this.type = 'menu';
        this.shape = shape;
        this.padding = 10;
        this.title = '';
        this.text = '';
        this.style = 'center_stacked'
        this.buttons = buttons;
        if (typeof options === 'object')
            for (var key of Object.keys(options)) {
                this[key] = options[key];
            }
    }

    step() {
        let x, y;
        // if the player's controller is keyboard
        if (game.player.controller.type == 'keyboard') {
            x = game.player.controller.realX;
            y = game.player.controller.realY;
            game.player.interface.menuIndex = -1;
        } else if (game.player.controller.type == 'touch') {
            if (game.player.controller.lastTouch) {
                x = game.player.controller.lastTouch.x;
                y = game.player.controller.lastTouch.y;
            } else {
                x = 0;
                y = 0;
            }
            // convert from center of screen to top left of screen
            game.player.interface.menuIndex = -1;
        } else if (game.player.controller.type == 'gamepad') {
            if (game.player.controller.buttons.selectUp.current && !game.player.controller.buttons.selectUp.last) {
                game.player.interface.menuIndex--;
                if (game.player.interface.menuIndex < 0) game.player.interface.menuIndex = this.buttons.length - 1;
            }
            if (game.player.controller.buttons.selectDown.current && !game.player.controller.buttons.selectDown.last) {
                game.player.interface.menuIndex++;
                if (game.player.interface.menuIndex >= this.buttons.length) game.player.interface.menuIndex = 0;
            }
        }

        let offsetx = this.shape.x;
        let offsety = this.shape.y;
        if (this.style === 'center_stacked') {
            offsetx = (game.window.w / 2) - (this.shape.w / 2) + this.shape.x;
            offsety = (game.window.h / 2) - (this.shape.h / 2) + this.shape.y;
        }

        // for every player and bot in the bots list
        for (const player of [game.player, ...game.match.bots]) {
            // if the player is a player
            if (player instanceof Player) {
                // check if mouse is inside any button
                for (const button of this.buttons) {
                    // check if mouse is inside the button
                    if (
                        x >= button.area.x + offsetx && x <= button.area.x + offsetx + button.area.w &&
                        y >= button.area.y + offsety && y <= button.area.y + offsety + button.area.h ||
                        game.player.interface.menuIndex == this.buttons.indexOf(button)
                    ) {
                        button.selected = true;
                        // check if the button is being pressed
                        if (player.controller.buttons.fire.current || player.controller.buttons.inventory2.current || player.controller.type == 'touch') {
                            // if so, run the button's function
                            button.func();
                        }
                    } else {
                        button.selected = false;
                    }
                }
            }
        }
    }

    draw() {
        if (this.visible == false) return;
        let offsetx, offsety;
        if (this.style === 'center_stacked') {
            offsetx = (game.window.w / 2) - (this.shape.w / 2) + this.shape.x;
            offsety = (game.window.h / 2) - (this.shape.h / 2) + this.shape.y;
            ctx.textAlign = "center";
        }
        // stroke a box around the menu
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.fillRect(offsetx, offsety, this.shape.w, this.shape.h);
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2;
        // console.log(offsetx, offsety, this.shape.w, this.shape.h);
        ctx.strokeRect(offsetx, offsety, this.shape.w, this.shape.h);

        // draw the text
        ctx.fillStyle = "#FFFFFF";
        ctx.font = '16px Jura';
        ctx.fillText(this.title, offsetx + this.shape.w / 2, offsety - 10);
        ctx.fillText(this.text, offsetx + this.shape.w / 2, offsety + this.padding + 16);


        // draw each button
        for (const button of this.buttons) {
            button.draw(
                offsetx + this.padding,
                offsety + this.padding
            );
        }
    }
}

/*
 ######
 #     # #    # ##### #####  ####  #    #  ####
 #     # #    #   #     #   #    # ##   # #
 ######  #    #   #     #   #    # # #  #  ####
 #     # #    #   #     #   #    # #  # #      #
 #     # #    #   #     #   #    # #   ## #    #
 ######   ####    #     #    ####  #    #  ####

*/
class Menu_Button {
    constructor(area, text, func, options) {
        this.area = area;
        this.text = text;
        this.func = func;
        this.active = true;
        this.selected = false;
    }

    draw(x, y) {
        ctx.textAlign = "center";
        ctx.fillStyle = "#000000";
        ctx.fillRect(this.area.x + x, this.area.y + y, this.area.w, this.area.h);
        ctx.fillStyle = "#FFFFFF";
        ctx.font = '16px Jura';
        // draw text in center of button
        ctx.fillText(this.text, this.area.x + x + this.area.w / 2, this.area.y + y + this.area.h / 2 + 6);
        if (this.selected) {
            ctx.strokeStyle = "#FFFFFF";
            ctx.lineWidth = 2;
            ctx.strokeRect(this.area.x + x, this.area.y + y, this.area.w, this.area.h);
        }
    }
}

/*
 ######
 #     #   ##   #    #  ####  ######
 #     #  #  #  #    # #      #
 ######  #    # #    #  ####  #####
 #       ###### #    #      # #
 #       #    # #    # #    # #
 #       #    #  ####   ####  ######

*/
class Menu_Pause extends Menu {
    constructor(buttons, shape, options) {
        super(buttons, shape, options);
        this.style = 'center_stacked';
        this.type = 'pause';
        this.buttons = [
            new Menu_Button(new Rect(0, 0, 150, 30), "Restart Match", function () { game.match.reset(); game.match.setup(); game.paused = false; }),
            new Menu_Button(new Rect(0, 40, 150, 30), "Quit to Menu", function () { game.match = new Start_Screen(); game.paused = false; game.menu = game.menus.main }),
            // new Menu_Button(new Rect(0, 80, 150, 30), "Button 3", function () { window.alert("Button 3"); }),
            new Menu_Button(new Rect(0, 120, 150, 30), "Resume", function () { game.paused = false; })
        ]
    }
}

/*
    #                                             ###
   # #   #    #   ##   # ##### # #    #  ####      #  #    # #####  #    # #####
  #   #  #    #  #  #  #   #   # ##   # #    #     #  ##   # #    # #    #   #
 #     # #    # #    # #   #   # # #  # #          #  # #  # #    # #    #   #
 ####### # ## # ###### #   #   # #  # # #  ###     #  #  # # #####  #    #   #
 #     # ##  ## #    # #   #   # #   ## #    #     #  #   ## #      #    #   #
 #     # #    # #    # #   #   # #    #  ####     ### #    # #       ####    #

*/
class Menu_Awaiting extends Menu {
    constructor(buttons, shape, options) {
        super(buttons, shape, options);
        this.style = 'center_stacked';
        this.type = 'pause';
        this.buttons = []
    }
    draw(text) {
        super.draw();
        let offsetx, offsety;
        if (this.style === 'center_stacked') {
            offsetx = (game.window.w / 2) - (this.shape.w / 2) - this.shape.x;
            offsety = (game.window.h / 2) - (this.shape.h / 2) - this.shape.y;
        }
        ctx.textAlign = "center";
        ctx.fillStyle = "#FFFFFF";
        ctx.font = '16px Jura';
        ctx.fillText(text, offsetx + this.shape.w / 2, offsety + this.shape.h / 2 + 6);
    }
}

/*
 #     #                    #     #
 ##   ##   ##   # #    #    ##   ## ###### #    # #    #
 # # # #  #  #  # ##   #    # # # # #      ##   # #    #
 #  #  # #    # # # #  #    #  #  # #####  # #  # #    #
 #     # ###### # #  # #    #     # #      #  # # #    #
 #     # #    # # #   ##    #     # #      #   ## #    #
 #     # #    # # #    #    #     # ###### #    #  ####

*/
class Menu_Main extends Menu {
    constructor(buttons, shape, options) {
        super(buttons, shape, options);
        this.style = 'center_stacked';
        this.type = 'pause';
        this.buttons = [
            new Menu_Button(new Rect(0, 0, 150, 30), "For Speed", function () { game.match = new Match_ForSpeed(); game.menu = null; game.paused = false; }),
            new Menu_Button(new Rect(0, 40, 150, 30), "For Honor", function () { game.match = new Match_ForHonor(); game.menu = null; game.paused = false; }),
            new Menu_Button(new Rect(0, 80, 150, 30), "For Ever", function () { game.match = new Match_ForEver(); game.menu = null; game.paused = false; }),
            // new Menu_Button(new Rect(0, 120, 150, 30), "debugmode", function () { game.match = new DebugMatch(); game.menu = null; game.paused = false; }),
            new Menu_Button(new Rect(0, 160, 150, 30), "Exit", function () { window.close(); })
        ]
    }
}