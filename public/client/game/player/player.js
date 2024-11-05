class Bot {
    constructor(options) {
        this.type = 'bot';
        this.name = 'Bot';
        this.character = new Character(allID++, new Vect3(0,0,0), this);
        this.controller = new DummyController();
        this.best = {
            air: 0,
            airtime: 0,
            speed: 0,
            damage: 0,
            lap: 0
        }
        // Options
        if (typeof options === 'object')
            for (var key of Object.keys(options)) {
                this[key] = options[key];
            }
    }

    /*
          :::     :::::::::::
       :+: :+:       :+:
     +:+   +:+      +:+
   +#++:++#++:     +#+
  +#+     +#+     +#+
 #+#     #+#     #+#
###     ### ###########
*/
    AI() {
        if (this.character.target) {
            if (this.character.target !== this.character) {
                // Calculate distance to target
                let compareX = this.character.target.HB.pos.x - this.character.HB.pos.x;
                let compareY = this.character.target.HB.pos.y - this.character.HB.pos.y;

                let distance = Math.sqrt(compareX ** 2 + compareY ** 2); // Pythagoras

                let findRange;

                // If that player's character's inventory has at least one item
                // make findRange the range of the current item in the inventory
                if (this.character.inventory.length > 0) {
                    findRange = this.character.inventory[this.character.item].range / 2;
                } else {
                    findRange = this.character.HB.radius * 2;
                }

                if (distance > findRange) { // If the target is too far away, move towards it

                    let dx = compareX / distance; // Normalized vector
                    let dy = compareY / distance;

                    // Calculate the directness of the movement
                    let directX = (Math.abs(dx) + 1.4) / 2;
                    if (directX > 1) directX = 1;
                    let directY = (Math.abs(dy) + 1.4) / 2;
                    if (directY > 1) directY = 1;

                    // Aim towards the target
                    this.controller.aimX = dx;
                    this.controller.aimY = dy;

                    // Move towards the target
                    if (compareX > 0) { // If the target is to the right, move right
                        this.controller.buttons.moveLeft.current = 0; // Reset left movement
                        this.controller.buttons.moveRight.current = directX; // Move right
                        this.character.img.src = this.character.gfx + '.png'; // Face right
                    }
                    else if (compareX <= 0) { // If the target is to the left, move left
                        this.controller.buttons.moveRight.current = 0; // Reset right movement
                        this.controller.buttons.moveLeft.current = directX; // Move left
                        this.character.img.src = this.character.leftgfx + '.png'; // Face left
                    } else { // Otherwise, reset horizontal movement
                        this.controller.buttons.moveLeft.current = this.controller.buttons.moveRight.current = 0; // Reset horizontal movement
                    }
                    if (compareY < 0) { // If the target is above, move up
                        this.controller.buttons.moveDown.current = 0; // Reset down movement
                        this.controller.buttons.moveUp.current = directX; // Move up
                    }
                    else if (compareY > 0) { // If the target is below, move down
                        this.controller.buttons.moveUp.current = 0; // Reset up movement
                        this.controller.buttons.moveDown.current = directX; // Move down
                    } else { // Otherwise, reset vertical movement
                        this.controller.buttons.moveDown.current = this.controller.buttons.moveUp.current = 0; // Reset vertical movement
                    }
                }

                /*
                  __  __                          __      __
                 |  \/  |__ _ _ _  __ _ __ _ ___  \ \    / /__ __ _ _ __  ___ _ _
                 | |\/| / _` | ' \/ _` / _` / -_)  \ \/\/ / -_) _` | '_ \/ _ \ ' \
                 |_|  |_\__,_|_||_\__,_\__, \___|   \_/\_/\___\__,_| .__/\___/_||_|
                                       |___/                       |_|
                */
                // Switch guns when empty
                if (this.character.inventory.length == 0) {
                    // If the character has no weapons, set this character's target to the closest weapon pickup on the map
                    let closestWeapon = null;
                    closestWeapon = this.findClosestBlockByType(['weapon']);
                    if (closestWeapon) this.character.target = closestWeapon;
                    else this.character.target = this.character;
                    this.character.item = 0;
                } else {
                    // find the weapon that either has ammo in it, or the character has ammo for, and has the longest range
                    let bestWeapon = null;
                    let bestRange = 0;
                    for (let i = 0; i < this.character.inventory.length; i++) {
                        if (this.character.inventory[i].ammo > 0 || this.character.ammo[this.character.inventory[i].type] > 0) {
                            if (this.character.inventory[i].range > bestRange) {
                                bestRange = this.character.inventory[i].range;
                                bestWeapon = i;
                            }
                        }
                    }
                    if (bestWeapon !== null) this.character.item = bestWeapon;
                    else this.character.item = 0;
                    // TODO: Priorize getting ammo for gun if all you have is a sword
                }

                // If this character's hp is below 25, set this character's target to the closest health pickup on the map
                if (this.character.hp < 25) {
                    let closestHealth = null;
                    closestHealth = this.findClosestBlockByType(['health']);
                    if (closestHealth) this.character.target = closestHealth;
                    else this.character.target = this.character;
                }

                /*
                    _  _   _           _
                   /_\| |_| |_ __ _ __| |__
                  / _ \  _|  _/ _` / _| / /
                 /_/ \_\__|\__\__,_\__|_\_\
    
                */
                if (this.character.inventory.length > 0) {
                    // if the current weapon is empty, and the character has ammo for it, reload
                    if (this.character.inventory[this.character.item].ammo == 0 && this.character.ammo[this.character.inventory[this.character.item].type] > 0) {
                        this.controller.buttons.fire.current = 1;
                    } else {
                        this.controller.buttons.fire.current = 0;
                    }
                    // if the current weapon is not empty, and the target is in range, shoot
                    if (
                        Math.abs(distance) <= this.character.inventory[this.character.item].range &&
                        this.character.target.team != this.character.team &&
                        this.character.target instanceof Character
                    ) {
                        // if the target is above, jump and shoot
                        if (this.character.target.HB.pos.z > this.character.HB.pos.z && this.character.pp > 50) {
                            this.controller.buttons.jump.current = 1;
                        } else {
                            this.controller.buttons.jump.current = 0;
                        }
                        // fire
                        this.controller.buttons.fire.current = 1;
                    }
                    else {
                        this.controller.buttons.jump.current = 0;
                        this.controller.buttons.fire.current = 0;
                    }

                    //If my target is not active
                    if (!this.character.target.active || this.character.target.team == this.character.team) {
                        this.findTarget();
                    }
                }
            } else {
                this.controller.resetButtons();
            }
        } else {
            this.findTarget();
        }
    }

    findTarget() {
        this.character.target = null;

        // Look for closest NPC or Player to attack
        let closestPlayer = null;
        let closestDistance = Infinity;
        for (const npc of [game.player, ...game.match.bots]) {
            if (npc.character.active && npc.character.team != this.character.team) {
                let compareX = npc.character.HB.pos.x - this.character.HB.pos.x;
                let compareY = npc.character.HB.pos.y - this.character.HB.pos.y;
                let distance = Math.sqrt(compareX ** 2 + compareY ** 2); // Pythagoras
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestPlayer = npc.character;
                }
            }
        }
        this.character.target = closestPlayer;

        // Look for pickups
        if (this.character.target === null && this.character.hp < 75)
            this.character.target = this.findClosestBlockByType(['health']);
        if (this.character.target === null && this.character.inventory.length < 2)
            this.character.target = this.findClosestBlockByType(['weapon']);
        if (this.character.target === null && this.character.ammo.ballistic < 5)
            this.character.target = this.findClosestBlockByType(['ammo_ballistic']);
        if (this.character.target === null && this.character.ammo.plasma < 5)
            this.character.target = this.findClosestBlockByType(['ammo_plasma']);

        //Try to get back into formation
        if (this.character.target === null)
            for (const npc of [game.player, ...game.match.bots]) {
                if (npc.character.active && npc.character.team == this.character.team && npc != this) this.character.target = npc.character;
            }
        // Target itself?
        if (this.character.target === null) this.character.target = this.character;
    }


    findClosestBlockByType(type) {
        let closestBlock = null;
        let closestDistance = Infinity;
        for (const block of game.match.map.blocks) {
            if (type.includes(block.subtype) || type.includes(block.type)) {
                let compareX = block.HB.pos.x - this.character.HB.pos.x;
                let compareY = block.HB.pos.y - this.character.HB.pos.y;
                let distance = Math.sqrt(compareX ** 2 + compareY ** 2); // Pythagoras
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestBlock = block;
                }
            }
        }
        return closestBlock;
    }

}

class Player extends Bot {
    constructor(options) {
        super(options);
        this.type = 'player';
        this.name = 'Player 1'
        this.character = new Character(allID++, new Vect3(0,0,0), this);
        this.controller = new Controller(this);
        this.camera = new Camera(this, { target: this.character });
        this.interface = new Interface(this);
        // Options
        if (typeof options === 'object')
            for (var key of Object.keys(options)) {
                this[key] = options[key];
            }
    }

    AI() {
        return
    }
}