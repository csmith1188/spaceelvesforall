class Game {
    constructor() {
        this.window = {
            w: 900,
            h: 600,
            cx: this.w / 2,
            cy: this.h / 2,
        }
        this.paused = false;
        this.awaitingInput = false;
        this.menu = null;
        this.debug = false;
        this.allID = 0;
        this.menus = {
            pause: new Menu_Pause([], new Rect(0, 0, 170, 170)),
            awaitingInput: new Menu_Awaiting([], new Rect(0, 0, 350, 50)),
            main: new Menu_Main([], new Rect(0, 50, 170, 210))
        }
        this.player = new Player();
        this.ticks = 0;
        this.lastTimestamp = 0;
        this.fps = 0;
        listenLastDevice();
    }

    /*
          :::::::: ::::::::::: :::::::::: :::::::::
        :+:    :+:    :+:     :+:        :+:    :+:
       +:+           +:+     +:+        +:+    +:+
      +#++:++#++    +#+     +#++:++#   +#++:++#+
            +#+    +#+     +#+        +#+
    #+#    #+#    #+#     #+#        #+#
    ########     ###     ########## ###
    */

    step() {
        // Advance the game's master tick counter
        this.ticks++;

        // The next two lines will always max screen
        this.window.h = window.innerHeight;
        this.window.w = window.innerWidth;
        this.player.camera.radius = Math.sqrt((this.window.w / 2) ** 2 + (this.window.h / 2) ** 2)

        canvas.width = this.window.w;
        canvas.height = this.window.h;

        this.checkInput();

        this.player.controller.read(); // Read the input from the main player

        // If the game is waiting for a controller to press a button
        if (this.awaitingInput) {
            this.menus.awaitingInput.step(); // Show the input menu
        }

        // If the game is paused
        else if (this.paused) {
            this.menus.pause.step(); // Show the pause menu
        }

        // If the game is not paused and all controllers have been assigned, play the match
        else {

            if (this.menu) {
                this.menu.step(); // Show the main menu
            }

            for (const bot of this.match.bots) {
                bot.controller.read(); // Read the input from every player and bot
            }

            this.match.step(); // Then step the match
        }

        this.player.camera.update(); // Update the camera

        //Performance Check
        const currentTimestamp = performance.now();
        const elapsedMilliseconds = currentTimestamp - this.lastTimestamp;
        this.fps = Math.round(1000 / elapsedMilliseconds);

        // Update last timestamp
        this.lastTimestamp = currentTimestamp;

        //Draw game
        this.draw();

    }

    /*
              :::::::::  :::::::::      :::     :::       :::
             :+:    :+: :+:    :+:   :+: :+:   :+:       :+:
            +:+    +:+ +:+    +:+  +:+   +:+  +:+       +:+
           +#+    +:+ +#++:++#:  +#++:++#++: +#+  +:+  +#+
          +#+    +#+ +#+    +#+ +#+     +#+ +#+ +#+#+ +#+
         #+#    #+# #+#    #+# #+#     #+#  #+#+# #+#+#
        #########  ###    ### ###     ###   ###   ###
        */

    draw() {
        if (this.awaitingInput) {
            this.menus.awaitingInput.draw("Awaiting Controller Input...\n" + this.awaitingInput);
        } else {

            //Draw Map
            this.match.map.draw(this.player.character);

            //Draw Map Lighting
            this.match.map.lighting();

            //Draw Match
            this.match.draw();

            //Draw each HUD
            for (const bot of [this.player, ...this.match.bots]) {
                if (bot.interface)
                    bot.interface.drawHUD();
            }

            //Draw Controller HUD
            for (const bot of [this.player, ...this.match.bots]) {
                if (bot.controller)
                    bot.controller.draw();
            }

            if (this.menu)
                this.menu.draw();
        }

        if (this.paused)
            this.menus.pause.draw();


    }

    checkInput() {
        for (const player of [this.player, ...this.match.bots]) {
            if (player.controller.type == "controller") {
                this.awaitingInput = player.name;
                if (lastDevice == null)
                    // for each connected gamepad, add an event listener to check for input
                    for (const gamepad of navigator.getGamepads()) {
                        if (gamepad)
                            if (gamepad.buttons.some(button => button.pressed))
                                lastDevice = gamepad.index;
                    }
                if (lastDevice !== null) {
                    for (const other of [this.player, ...this.match.bots]) {
                        if (other.controller.type == lastDevice || other.controller.gamepadIndex === lastDevice) {
                            lastDevice = null;
                            return;
                        }
                    }

                    // if the lastDevice was keyboard, touch, pad or something else
                    if (lastDevice == "keyboard") {
                        player.controller = new Keyboard(player);
                    } else if (lastDevice == "touch") {
                        player.controller = new Touch(player);
                    } else {
                        player.controller = new GamePad(player, lastDevice);
                    }
                    lastDevice = null;
                    this.awaitingInput = false;
                }
                break;
            }
        }
    }
}