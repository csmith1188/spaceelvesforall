(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['Utils'], factory);
    } else if (typeof module === 'object' && module.exports) {
        // Nodejs
        const Utils = require('../../utils.js');
        module.exports = factory(Utils);
    } else {
        // Browser globals (root is window)
        root.Controllers = factory(root.Utils);
    }
}(typeof self !== 'undefined' ? self : this, function (Utils) {
    /*
          ::::::::::: ::::    ::: :::::::::  :::    ::: ::::::::::: ::::::::
             :+:     :+:+:   :+: :+:    :+: :+:    :+:     :+:    :+:    :+:
            +:+     :+:+:+  +:+ +:+    +:+ +:+    +:+     +:+    +:+
           +#+     +#+ +:+ +#+ +#++:++#+  +#+    +:+     +#+    +#++:++#++
          +#+     +#+  +#+#+# +#+        +#+    +#+     +#+           +#+
         #+#     #+#   #+#+# #+#        #+#    #+#     #+#    #+#    #+#
    ########### ###    #### ###         ########      ###     ########
    */

    let utils = {
        lastDevice: null,
        _listening: false,
        _gamepadPollTimer: null,
        setLastDevice: (device) => {
            utils.lastDevice = device;
        },
        isModifierKey: (event) => {
            const key = event.key;
            return key === "Alt" ||
                key === "AltGraph" ||
                key === "Control" ||
                key === "Meta" ||
                key === "Shift" ||
                key === "F10";
        },
        blockModifierHotkeys: (event) => {
            // Allow pure modifier key presses (Shift/Alt/Ctrl/etc.) to reach game controls.
            // Only block browser shortcut combos that include a modifier + another key.
            if (utils.isModifierKey(event)) {
                return;
            }
            const hasShortcutModifier = event.ctrlKey || event.metaKey || event.altKey;
            if (hasShortcutModifier || event.key === "F10") {
                event.preventDefault();
            }
        },
        gamepadHasActivity: (gamepad) => {
            if (!gamepad) return false;
            const axisThreshold = 0.25;
            if (Array.isArray(gamepad.axes)) {
                for (const axis of gamepad.axes) {
                    if (Math.abs(axis) >= axisThreshold) return true;
                }
            }
            if (Array.isArray(gamepad.buttons)) {
                for (const button of gamepad.buttons) {
                    if (button && (button.pressed || button.value > 0.5)) return true;
                }
            }
            return false;
        },
        listenLastDevice: () => {
            if (utils._listening) return;
            utils._listening = true;
            document.addEventListener("keydown", (event) => {
                utils.blockModifierHotkeys(event);
                utils.setLastDevice("keyboard");
            }, { capture: true });
            document.addEventListener("keyup", (event) => {
                utils.blockModifierHotkeys(event);
                utils.setLastDevice("keyboard");
            }, { capture: true });
            window.addEventListener("mousedown", () => {
                utils.setLastDevice("keyboard");
            }, { passive: true });
            window.addEventListener("mousemove", () => {
                utils.setLastDevice("keyboard");
            }, { passive: true });
            window.addEventListener("wheel", () => {
                utils.setLastDevice("keyboard");
            }, { passive: true });
            window.addEventListener("touchstart", () => {
                utils.setLastDevice("touch");
            }, { passive: true });
            window.addEventListener("touchmove", () => {
                utils.setLastDevice("touch");
            }, { passive: true });
            window.addEventListener("gamepadconnected", (event) => {
                if (event && event.gamepad) {
                    utils.setLastDevice(event.gamepad.index);
                }
            });
            window.addEventListener("blur", () => {
                utils.lastDevice = null;
            });
            utils._gamepadPollTimer = setInterval(() => {
                const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
                for (const gp of gamepads) {
                    if (utils.gamepadHasActivity(gp)) {
                        utils.setLastDevice(gp.index);
                    }
                }
            }, 80);
        }
    };

    // Collect all input data and send it to the controller for better handling
    function getCanvasRelative(e, center = true) {
        bx = canvas.getBoundingClientRect();
        const scaleX = bx.width > 0 ? canvas.width / bx.width : 1;
        const scaleY = bx.height > 0 ? canvas.height / bx.height : 1;
        if (center === true) {
            return {
                x: (e.clientX - (bx.left + bx.width / 2)) * scaleX,
                y: (e.clientY - (bx.top + bx.height / 2)) * scaleY,
                bx: bx
            };
        } else if (center) {
            if (center instanceof Utils.Vect3) {
                center = { x: center.x, y: center.y, z: center.z };
            }
            else {
                // if the center has a center() method, call it
                if (center.center)
                    center = center.center();
                center.x = game.player.camera.x - center.x;
                center.y = game.player.camera.y - center.y;
            }
            return {
                x: (e.clientX - (bx.left + bx.width / 2)) * scaleX + center.x,
                y: (e.clientY - (bx.top + bx.height / 2)) * scaleY + center.y,
                bx: bx
            };
        } else {
            return {
                x: (e.clientX - bx.left) * scaleX,
                y: (e.clientY - bx.top) * scaleY,
                bx: bx
            };
        }
    }

    /*
          ::::::::   ::::::::  ::::    ::: ::::::::::: :::::::::   ::::::::  :::        :::        :::::::::: :::::::::
        :+:    :+: :+:    :+: :+:+:   :+:     :+:     :+:    :+: :+:    :+: :+:        :+:        :+:        :+:    :+:
       +:+        +:+    +:+ :+:+:+  +:+     +:+     +:+    +:+ +:+    +:+ +:+        +:+        +:+        +:+    +:+
      +#+        +#+    +:+ +#+ +:+ +#+     +#+     +#++:++#:  +#+    +:+ +#+        +#+        +#++:++#   +#++:++#:
     +#+        +#+    +#+ +#+  +#+#+#     +#+     +#+    +#+ +#+    +#+ +#+        +#+        +#+        +#+    +#+
    #+#    #+# #+#    #+# #+#   #+#+#     #+#     #+#    #+# #+#    #+# #+#        #+#        #+#        #+#    #+#
    ########   ########  ###    ####     ###     ###    ###  ########  ########## ########## ########## ###    ###
    */
    class Controller {
        constructor(owner) {
            this.owner = owner;
            this.type = "controller";
            this.newState = {};
            this.inputHistory = []; // Store input history for reconciliation
            this.lastInputSequence = 0;
            this.setupInputs();
        }

        setupInputs() {
            this.resetButtons();
        }

        read() {
            // Remember the last state of every command
            for (const button in this.buttons) {
                this.buttons[button].last = this.buttons[button].current;
            }
        }

        /** Absolute button snapshot for the wire — never delta-compress held inputs. */
        getAbsoluteNetworkState() {
            const state = {};
            for (const button in this.buttons) {
                state[button] = this.buttons[button].current;
            }
            return state;
        }

        syncNewStateFromButtons() {
            // Keep full absolute state. Delta compression over an unreliable channel
            // drops release packets and leaves the server holding keys forever.
            this.newState = this.getAbsoluteNetworkState();
        }

        // Store input for client-side prediction
        storeInput(inputState, aimX, aimY, aimZ) {
            this.lastInputSequence++;
            const now = Date.now();
            const input = {
                sequence: this.lastInputSequence,
                state: { ...inputState },
                aimX: aimX,
                aimY: aimY,
                aimZ: aimZ,
                timestamp: now
            };
            
            this.inputHistory.push(input);
            
            // Keep only recent inputs (last 2 seconds) without reallocating the array each tick.
            const cutoff = now - 2000;
            while (this.inputHistory.length && this.inputHistory[0].timestamp <= cutoff) {
                this.inputHistory.shift();
            }
        }

        discardInputsUpTo(sequence) {
            this.inputHistory = this.inputHistory.filter(input => input.sequence > sequence);
        }

        resetButtons() {
            this.buttons = {
                moveRight: { current: 0, last: 0 },
                moveLeft: { current: 0, last: 0 },
                moveDown: { current: 0, last: 0 },
                moveUp: { current: 0, last: 0 },
                jump: { current: 0, last: 0 },
                brake: { current: 0, last: 0 },
                boost: { current: 0, last: 0 },
                fire: { current: 0, last: 0 },
                altfire: { current: 0, last: 0 },
                weaponPrevious: { current: 0, last: 0 },
                weaponNext: { current: 0, last: 0 },
                start: { current: 0, last: 0 },
                select: { current: 0, last: 0 },
                inventory1: { current: 0, last: 0 },
                inventory2: { current: 0, last: 0 },
                throw: { current: 0, last: 0 },
                selectRight: { current: 0, last: 0 },
                selectLeft: { current: 0, last: 0 },
                selectUp: { current: 0, last: 0 },
                selectDown: { current: 0, last: 0 }
            };
        }

        draw() {

        }

        rumble() {

        }
    }

    /*
          :::    ::: :::::::::: :::   ::: :::::::::   ::::::::      :::     :::::::::  :::::::::
         :+:   :+:  :+:        :+:   :+: :+:    :+: :+:    :+:   :+: :+:   :+:    :+: :+:    :+:
        +:+  +:+   +:+         +:+ +:+  +:+    +:+ +:+    +:+  +:+   +:+  +:+    +:+ +:+    +:+
       +#++:++    +#++:++#     +#++:   +#++:++#+  +#+    +:+ +#++:++#++: +#++:++#:  +#+    +:+
      +#+  +#+   +#+           +#+    +#+    +#+ +#+    +#+ +#+     +#+ +#+    +#+ +#+    +#+
     #+#   #+#  #+#           #+#    #+#    #+# #+#    #+# #+#     #+# #+#    #+# #+#    #+#
    ###    ### ##########    ###    #########   ########  ###     ### ###    ### #########
    */
    class Keyboard extends Controller {
        constructor(owner) {
            super(owner);
            this.type = "keyboard";
        }

        clearHeldInputs() {
            this.upKey = 0;
            this.leftKey = 0;
            this.downKey = 0;
            this.rightKey = 0;
            this.spaceKey = 0;
            this.shiftKey = 0;
            this.altKey = 0;
            this.inventory1Key = 0;
            this.inventory2Key = 0;
            this.throwKey = 0;
            this.startKey = 0;
            this.clickButton = 0;
            this.rclickButton = 0;
            this.wheelUp = 0;
            this.wheelDown = 0;
        }

        applyKeyCode(code, pressed) {
            const value = pressed ? 1 : 0;
            switch (code) {
                case "KeyW":
                case "ArrowUp":
                    this.upKey = value;
                    break;
                case "KeyA":
                case "ArrowLeft":
                    this.leftKey = value;
                    break;
                case "KeyS":
                case "ArrowDown":
                    this.downKey = value;
                    break;
                case "KeyD":
                case "ArrowRight":
                    this.rightKey = value;
                    break;
                case "Space":
                    this.spaceKey = value;
                    break;
                case "KeyQ":
                    this.inventory1Key = value;
                    break;
                case "KeyE":
                    this.inventory2Key = value;
                    break;
                case "KeyF":
                    this.throwKey = value;
                    break;
                case "Escape":
                    this.startKey = value;
                    break;
                case "ShiftLeft":
                case "ShiftRight":
                    this.shiftKey = value;
                    break;
                case "AltLeft":
                case "AltRight":
                    this.altKey = value;
                    break;
                default:
                    break;
            }
        }

        setupInputs() {
            super.setupInputs();
            this.clearHeldInputs();

            /*
              _  __         ___
             | |/ /___ _  _|   \ _____ __ ___ _  ___
             | ' </ -_) || | |) / _ \ V  V / ' \(_-<
             |_|\_\___|\_, |___/\___/\_/\_/|_||_/__/
                       |__/
            */
            // Prefer event.code (physical key) so releases still match after Shift/Alt/layout changes.
            // Clear all held state on blur/visibility loss — browsers often drop keyup in those cases.
            document.addEventListener("keydown", function (event) {
                if (event.altKey && event.code !== "AltLeft" && event.code !== "AltRight") {
                    event.preventDefault();
                }
                if (event.repeat) return;
                this.applyKeyCode(event.code, true);
            }.bind(this));
            /*
              _  __         _   _
             | |/ /___ _  _| | | |_ __ ___
             | ' </ -_) || | |_| | '_ (_-<
             |_|\_\___|\_, |\___/| .__/__/
                       |__/      |_|
            */
            document.addEventListener("keyup", function (event) {
                this.applyKeyCode(event.code, false);
                // Modifier flags from event are authoritative after any release.
                this.shiftKey = Number(event.shiftKey);
                this.altKey = Number(event.altKey);
            }.bind(this));

            const releaseAll = () => this.clearHeldInputs();
            window.addEventListener("blur", releaseAll);
            document.addEventListener("visibilitychange", () => {
                if (document.visibilityState !== "visible") releaseAll();
            });

            /*
              __  __
             |  \/  |___ _  _ ___ ___
             | |\/| / _ \ || (_-</ -_)
             |_|  |_\___/\_,_/__/\___|
    
            */
            window.addEventListener("mousedown", function (event) {
                let coords = getCanvasRelative(event, false); // from top-left
                this.realX = coords.x;
                this.realY = coords.y;
                coords = getCanvasRelative(event, true); // from top-left
                this.centerX = coords.x;
                this.centerY = coords.y;
                coords = getCanvasRelative(event, { x: this.owner.camera.x, y: this.owner.camera.y, z: 0 });
                this.aimX = coords.x
                this.aimY = coords.y
                // Get which mousebutton they clicked
                if (event.button == 0)
                    this.clickButton = 1
                else if (event.button == 2)
                    this.rclickButton = 1
            }.bind(this));
            window.addEventListener("mouseup", function (event) {
                if (event.button == 0)
                    this.clickButton = 0;
                else if (event.button == 2)
                    this.rclickButton = 0;
            }.bind(this));
            // Mouseup can be lost if the button is released outside the window.
            window.addEventListener("pointerup", function (event) {
                if (event.button == 0)
                    this.clickButton = 0;
                else if (event.button == 2)
                    this.rclickButton = 0;
            }.bind(this));
            window.addEventListener("wheel", function (event) {
                this.wheelUp = (event.wheelDelta > 0) * 1;
                this.wheelDown = (event.wheelDelta < 0) * 1;
            }.bind(this));
            window.addEventListener('mousemove', function (event) {
                let coords = getCanvasRelative(event, false); // from top-left
                this.realX = coords.x;
                this.realY = coords.y;
                coords = getCanvasRelative(event, true); // from top-left
                this.centerX = coords.x;
                this.centerY = coords.y;
                coords = getCanvasRelative(event, { x: this.owner.camera.x, y: this.owner.camera.y, z: 0 });
                this.aimX = coords.x
                this.aimY = coords.y
            }.bind(this));
            window.addEventListener("contextmenu", e => e.preventDefault());
        }

        read() {
            super.read();
            // Because buttons can get cleared at other points, we need to check for them here at the same time as other inputs
            if (this.rightKey) this.buttons.moveRight.current = this.newState.moveRight = 1;
            else this.buttons.moveRight.current = this.newState.moveRight = 0;
            if (this.leftKey) this.buttons.moveLeft.current = this.newState.moveLeft = 1;
            else this.buttons.moveLeft.current = this.newState.moveLeft = 0;
            if (this.downKey) this.buttons.moveDown.current = this.newState.moveDown = 1;
            else this.buttons.moveDown.current = this.newState.moveDown = 0;
            if (this.upKey) this.buttons.moveUp.current = this.newState.moveUp = 1;
            else this.buttons.moveUp.current = this.newState.moveUp = 0;
            if (this.spaceKey) this.buttons.jump.current = this.newState.jump = 1;
            else this.buttons.jump.current = this.newState.jump = 0;
            if (this.shiftKey) this.buttons.brake.current = this.newState.brake = 1;
            else this.buttons.brake.current = this.newState.brake = 0;
            if (this.altKey) this.buttons.boost.current = this.newState.boost = 1;
            else this.buttons.boost.current = this.newState.boost = 0;
            if (this.clickButton) this.buttons.fire.current = this.newState.fire = 1;
            else this.buttons.fire.current = this.newState.fire = 0;
            if (this.rclickButton) this.buttons.altfire.current = this.newState.altfire = 1;
            else this.buttons.altfire.current = this.newState.altfire = 0;
            if (this.inventory1Key) this.buttons.inventory1.current = this.newState.inventory1 = 1;
            else this.buttons.inventory1.current = this.newState.inventory1 = 0;
            if (this.inventory2Key) this.buttons.inventory2.current = this.newState.inventory2 = 1;
            else this.buttons.inventory2.current = this.newState.inventory2 = 0;
            if (this.startKey) this.buttons.start.current = this.newState.start = 1;
            else this.buttons.start.current = this.newState.start = 0;
            if (this.throwKey) this.buttons.throw.current = this.newState.throw = 1;
            else this.buttons.throw.current = this.newState.throw = 0;
            if (this.wheelUp) {
                this.buttons.weaponPrevious.current = this.newState.weaponPrevious = this.wheelUp;
                this.wheelUp = 0;
            }
            else this.buttons.weaponPrevious.current = this.newState.weaponPrevious = 0;
            if (this.wheelDown) {
                this.buttons.weaponNext.current = this.newState.weaponNext = this.wheelDown;
                this.wheelDown = 0;
            }
            else this.buttons.weaponNext.current = this.newState.weaponNext = 0;
            // Absolute snapshot (no delta strip) — see getAbsoluteNetworkState / game send path.
        }
    }

    /*
          ::::::::      :::       :::   :::   :::::::::: :::::::::     :::     :::::::::
        :+:    :+:   :+: :+:    :+:+: :+:+:  :+:        :+:    :+:  :+: :+:   :+:    :+:
       +:+         +:+   +:+  +:+ +:+:+ +:+ +:+        +:+    +:+ +:+   +:+  +:+    +:+
      :#:        +#++:++#++: +#+  +:+  +#+ +#++:++#   +#++:++#+ +#++:++#++: +#+    +:+
     +#+   +#+# +#+     +#+ +#+       +#+ +#+        +#+       +#+     +#+ +#+    +#+
    #+#    #+# #+#     #+# #+#       #+# #+#        #+#       #+#     #+# #+#    #+#
    ########  ###     ### ###       ### ########## ###       ###     ### #########
    */
    class GamePad extends Controller {
        constructor(owner, gamepadIndexIndex) {
            super(owner);
            this.type = "gamepad";
            this.gamepadIndex = gamepadIndexIndex;
            this.deadzone = 0.2;
            this.selectzone = 0.8;
        }

        setupInputs() {
            super.setupInputs();
            window.addEventListener('gamepaddisconnected', (event) => {
                this.gamepadIndex = null;
            });
        }

        read() {
            super.read();
            if (this.gamepadIndex != null) {
                let gp = navigator.getGamepads()[this.gamepadIndex];
                if (!gp) return;
                if (utils.gamepadHasActivity(gp)) {
                    utils.setLastDevice(this.gamepadIndex);
                }
                // Get AXES
                // Move Right
                if (gp.axes[0] > this.deadzone) this.buttons.moveRight.current = gp.axes[0];
                else this.buttons.moveRight.current = 0;
                // Select Right
                if (gp.axes[0] > this.selectzone) this.buttons.selectRight.current = gp.axes[0];
                else this.buttons.selectRight.current = 0;
                // Move Left
                if (gp.axes[0] < this.deadzone * -1) this.buttons.moveLeft.current = gp.axes[0] * -1;
                else this.buttons.moveLeft.current = 0;
                // Select Left
                if (gp.axes[0] < this.selectzone * -1) this.buttons.selectLeft.current = gp.axes[0] * -1;
                else this.buttons.selectLeft.current = 0;
                // Move Down
                if (gp.axes[1] > this.deadzone) this.buttons.moveDown.current = gp.axes[1];
                else this.buttons.moveDown.current = 0;
                // Select Down
                if (gp.axes[1] > this.selectzone) this.buttons.selectDown.current = gp.axes[1];
                else this.buttons.selectDown.current = 0;
                // Move Up
                if (gp.axes[1] < this.deadzone * -1) this.buttons.moveUp.current = gp.axes[1] * -1;
                else this.buttons.moveUp.current = 0;
                // Select Up
                if (gp.axes[1] < this.selectzone * -1) this.buttons.selectUp.current = gp.axes[1] * -1;
                else this.buttons.selectUp.current = 0;
                // If either axis of stick 2 is outside of deadzone
                if (Math.abs(gp.axes[2]) >= this.deadzone || Math.abs(gp.axes[3]) >= this.deadzone) {
                    this.aimX = gp.axes[2] * 100;
                    this.aimY = gp.axes[3] * 100;
                }
                if (gp.buttons[10].pressed) this.buttons.brake.current = 1;
                else this.buttons.brake.current = 0;
                if (gp.buttons[4].pressed) this.buttons.boost.current = 1;
                else this.buttons.boost.current = 0;

                // A button to switch to weapon 0
                if (gp.buttons[0].pressed) this.buttons.inventory2.current = 1;
                else this.buttons.inventory2.current = 0;
                // X button to switch to weapon 1
                if (gp.buttons[2].pressed) this.buttons.inventory1.current = 1;
                else this.buttons.inventory1.current = 0;
                // B button to throw
                if (gp.buttons[1].pressed) this.buttons.throw.current = 1;
                else this.buttons.throw.current = 0;

                // Left trigger to space
                if (gp.buttons[6].pressed) this.buttons.jump.current = 1;
                else this.buttons.jump.current = 0;

                // Right trigger to click
                if (gp.buttons[7].pressed) this.buttons.fire.current = 1;
                else this.buttons.fire.current = 0;

                // Select Button reloads window
                if (gp.buttons[8].pressed) if (game.match.ticks > 180) location.reload();

                // Start button pauses game
                if (gp.buttons[9].pressed) this.buttons.start.current = 1;
                else this.buttons.start.current = 0;
                if (gp.buttons[5].pressed) {
                    game.player.camera._3D = 1;
                    game.player.camera.angle = 0.35;
                } else {
                    game.player.camera._3D = false;
                    game.player.camera.angle = 1;
                }
            }
            this.syncNewStateFromButtons();
        }

        draw() {
            super.draw();
        }

        rumble(duration, weak, strong) {
            if (this.gamepadIndex != null) {
                let gp = navigator.getGamepads()[this.gamepadIndex];
                if (gp && gp.vibrationActuator) {
                    // Start a vibration effect
                    gp.vibrationActuator.playEffect("dual-rumble", {
                        startDelay: 0,
                        duration: duration,
                        weakMagnitude: weak,
                        strongMagnitude: strong
                    });
                }
            }
        }
    }

    /*
      ::::::::::: ::::::::  :::    :::  ::::::::  :::    ::: :::::::::     :::     :::::::::
         :+:    :+:    :+: :+:    :+: :+:    :+: :+:    :+: :+:    :+:  :+: :+:   :+:    :+:
        +:+    +:+    +:+ +:+    +:+ +:+        +:+    +:+ +:+    +:+ +:+   +:+  +:+    +:+
       +#+    +#+    +:+ +#+    +:+ +#+        +#++:++#++ +#++:++#+ +#++:++#++: +#+    +:+
      +#+    +#+    +#+ +#+    +#+ +#+        +#+    +#+ +#+       +#+     +#+ +#+    +#+
     #+#    #+#    #+# #+#    #+# #+#    #+# #+#    #+# #+#       #+#     #+# #+#    #+#
    ###     ########   ########   ########  ###    ### ###       ###     ### #########
    */
    class Touch extends Controller {
        constructor(owner) {
            super(owner);
            this.type = "touch";
            this.touch = {
                enabled: true,
                event: {},
                left: {
                    pos: new Vect3(150, 150, 75),
                    radius: 75
                },
                right: {
                    pos: new Vect3(150, 150, 75),
                    radius: 75
                }
            };
            this.lastTouch = null;
        }

        /*
          #####
         #     # ###### ##### #    # #####
         #       #        #   #    # #    #
          #####  #####    #   #    # #    #
               # #        #   #    # #####
         #     # #        #   #    # #
          #####  ######   #    ####  #
    
        */
        setupInputs() {
            super.setupInputs();
            window.addEventListener('touchstart', (event) => {
                event.preventDefault();
                event.stopImmediatePropagation();
                this.touch.enabled = true;
                this.touch.event = event;
                this.touch.eventType = 'start';

            }, { passive: false });

            window.addEventListener('touchmove', (event) => {
                event.preventDefault();
                event.stopImmediatePropagation();
                this.touch.event = event;
                this.touch.eventType = 'move';
            }, { passive: false });

            window.addEventListener('touchend', (event) => {
                event.preventDefault();
                event.stopImmediatePropagation();
                this.touch.event = event;
                this.touch.eventType = 'end';
            }, { passive: false });

            window.addEventListener('touchcancel', (event) => {
                event.preventDefault();
                event.stopImmediatePropagation();
                getTouch(event);
            }, { passive: false });

            this.canVibrate = false;
            if ('vibrate' in navigator)
                this.canVibrate = true;
        }

        /*
         ######
         #     # ######   ##   #####
         #     # #       #  #  #    #
         ######  #####  #    # #    #
         #   #   #      ###### #    #
         #    #  #      #    # #    #
         #     # ###### #    # #####
    
        */
        read() {
            super.read();
            if (this.touch.event.target == canvas) {
                let touchLeftFound = false;
                let touchRightFound = false;
                for (const touch of this.touch.event.targetTouches) {
                    let touchCoord = getCanvasRelative(touch, false);
                    this.lastTouch = touchCoord;


                    if (this.owner.interface.touchButton.inventory1)
                        if (this.owner.interface.touchButton.inventory1.collidePoint(touchCoord.x, touchCoord.y))
                            this.buttons.inventory1.current = 1;
                        else this.buttons.inventory1.current = 0;
                    if (this.owner.interface.touchButton.inventory2)
                        if (this.owner.interface.touchButton.inventory2.collidePoint(touchCoord.x, touchCoord.y))
                            this.buttons.inventory2.current = 1;
                        else this.buttons.inventory2.current = 0;
                    if (this.owner.interface.touchButton.pause)
                        if (this.owner.interface.touchButton.pause.collidePoint(touchCoord.x, touchCoord.y) && this.touch.eventType != 'move')
                            this.buttons.start.current = 1;
                        else this.buttons.start.current = 0;

                    // Check for left touch
                    let touchX = touchCoord.x - this.touch.left.pos.x;
                    let touchY = touchCoord.y - (game.window.h - this.touch.left.pos.y);
                    let distance = Math.sqrt(touchX ** 2 + touchY ** 2);
                    if (distance < this.touch.left.radius * 2) {

                        touchLeftFound = true;

                        if (distance > this.touch.right.radius)
                            if (game.match.ticks - this.touch.left.lastBoostTouch <= 10)
                                this.buttons.boost.current = 1;
                        //Normalize, but add a little bonus outside of main ring
                        touchX /= (distance / this.touch.left.radius) * 100;
                        touchY /= (distance / this.touch.left.radius) * 100;

                        //Cap the bonus at 1
                        if (touchX > 1) touchX = 1;
                        if (touchX > 1) touchX = 1;

                        //Attach to movement functions
                        if (touchX < 0) this.buttons.moveLeft.current = Math.abs(touchX);
                        if (touchX > 0) this.buttons.moveRight.current = Math.abs(touchX);
                        if (touchY < 0) this.buttons.moveUp.current = Math.abs(touchY);
                        if (touchY > 0) this.buttons.moveDown.current = Math.abs(touchY);

                    }
                    // Check for right touch
                    touchX = touchCoord.x - (game.window.w - this.touch.right.pos.x);
                    touchY = touchCoord.y - (game.window.h - this.touch.right.pos.y);
                    distance = Math.sqrt(touchX ** 2 + touchY ** 2);
                    if (distance < this.touch.right.radius * 2) {
                        touchRightFound = true;
                        //Button was pressed                            
                        if (distance > this.touch.right.radius) this.buttons.fire.current = 1;
                        //Normalize, then change the aim angle
                        touchX /= distance;
                        touchY /= distance;
                        this.aimX = touchX;
                        this.aimY = touchY;

                    }
                }
                if (!touchLeftFound) {
                    this.buttons.moveLeft.current = 0;
                    this.buttons.moveRight.current = 0;
                    this.buttons.moveUp.current = 0;
                    this.buttons.moveDown.current = 0;
                }
            }
            if (this.touch.eventType == 'end') {
                this.buttons.fire.current = 0;
                this.buttons.boost.current = 0;
                for (const touch of this.touch.event.changedTouches) {
                    let touchCoord = getCanvasRelative(touch);
                    let touchX = touchCoord.x - this.touch.left.pos.x;
                    let touchY = touchCoord.y - (game.window.h - this.touch.left.pos.y);
                    let distance = Math.sqrt(touchX ** 2 + touchY ** 2);
                    if ((distance > this.touch.left.radius) && (distance < (this.touch.left.radius * 2)))
                        this.touch.left.lastBoostTouch = game.match.ticks;
                }

            }
            this.touch.event = {};
            this.touch.eventType = {};
            this.syncNewStateFromButtons();
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
            super.draw();

            if (!game.paused && this.owner.character.active) {
                ctx.globalAlpha = 0.05;
                ctx.lineWidth = 8;
                ctx.strokeStyle = "#FFFFFF";
                ctx.fillStyle = "#000000";
                /*
                  _         __ _     _               _
                 | |   ___ / _| |_  | |_ ___ _  _ __| |_
                 | |__/ -_)  _|  _| |  _/ _ \ || / _| ' \
                 |____\___|_|  \__|  \__\___/\_,_\__|_||_|
        
                */
                ctx.beginPath();
                ctx.arc(
                    this.touch.left.pos.x,
                    game.window.h - this.touch.left.pos.y,
                    this.touch.left.radius * 2,
                    0, 2 * Math.PI);
                ctx.closePath();
                ctx.fill()
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(
                    this.touch.left.pos.x,
                    game.window.h - this.touch.left.pos.y,
                    this.touch.left.radius,
                    0, 2 * Math.PI);
                ctx.closePath();
                ctx.fill()
                ctx.stroke();
                /*
                  ___ _      _   _     _               _
                 | _ (_)__ _| |_| |_  | |_ ___ _  _ __| |_
                 |   / / _` | ' \  _| |  _/ _ \ || / _| ' \
                 |_|_\_\__, |_||_\__|  \__\___/\_,_\__|_||_|
                       |___/
                */
                ctx.beginPath();
                ctx.arc(
                    game.window.w - this.touch.right.pos.x,
                    game.window.h - this.touch.right.pos.y,
                    this.touch.right.radius * 2,
                    0, 2 * Math.PI);
                ctx.closePath();
                ctx.fill()
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(
                    game.window.w - this.touch.right.pos.x,
                    game.window.h - this.touch.right.pos.y,
                    this.touch.right.radius,
                    0, 2 * Math.PI);
                ctx.closePath();
                ctx.fill()
                ctx.stroke();
                ctx.globalAlpha = 1;
            }

            /*
              ___
             | _ \__ _ _  _ ___ ___
             |  _/ _` | || (_-</ -_)
             |_| \__,_|\_,_/__/\___|
            */
            // draw a rectangle  in the top right corner for the pause button
            ctx.fillStyle = "rgba(255,255,255,0.5)";
            ctx.fillRect(game.window.w - 55, 5, 50, 50);
            // white outline
            ctx.strokeStyle = "#FFFFFF";
            ctx.lineWidth = 2;
            ctx.strokeRect(game.window.w - 55, 5, 50, 50);
            // draw a pause icon
            ctx.fillStyle = "#000000";
            ctx.fillRect(game.window.w - 45, 15, 10, 30);
            ctx.fillRect(game.window.w - 25, 15, 10, 30);

        }
    }

    /*
          :::::::::  :::    :::   :::   :::     :::   :::  :::   :::
         :+:    :+: :+:    :+:  :+:+: :+:+:   :+:+: :+:+: :+:   :+:
        +:+    +:+ +:+    +:+ +:+ +:+:+ +:+ +:+ +:+:+ +:+ +:+ +:+
       +#+    +:+ +#+    +:+ +#+  +:+  +#+ +#+  +:+  +#+  +#++:
      +#+    +#+ +#+    +#+ +#+       +#+ +#+       +#+   +#+
     #+#    #+# #+#    #+# #+#       #+# #+#       #+#   #+#
    #########   ########  ###       ### ###       ###   ###
    */
    class DummyController extends Controller {
        constructor(owner) {
            super(owner);
            this.type = "dummy";
        }
        setupInputs() { return }
        read() { return }
        draw() { return }
    }

    class SocketController extends Controller {
        constructor(owner) {
            super(owner);
            this.type = "socket";
        }
        read() {
            super.read();
            // Client sends an absolute button snapshot each tick. Apply every known
            // button (missing key => released) so a lost prior release cannot stick.
            if (!this.newState || typeof this.newState !== 'object') return;
            for (const button in this.buttons) {
                this.buttons[button].current = Object.prototype.hasOwnProperty.call(this.newState, button)
                    ? this.newState[button]
                    : 0;
            }
        }
        draw() { return }
    }

    return { Keyboard, GamePad, Touch, DummyController, SocketController, utils };
}));