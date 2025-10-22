// const MasterWSS = new WebSocket(`ws://${THIS_URL}:${MASTER_PORT}/chat`);

// MasterWSS.addEventListener('open', () => {
//     console.log('Connected to Master WSS');
// });

// MasterWSS.addEventListener('message', (event) => {
//     try {
//         const message = JSON.parse(event.data);
//         console.log(message);
//     } catch (error) {
//         console.log(error);
//     }
// });

// MasterWSS.addEventListener('error', () => {
//     console.log('Error connecting to Master WSS');
// });



// Determine WebSocket protocol based on current page protocol
const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const gameWSS = new WebSocket(`${wsProtocol}//${window.location.hostname}:${PORT}/game`);

gameWSS.addEventListener('open', () => {
    console.log('Connected to Game WSS');
});

gameWSS.addEventListener('message', (event) => {
    let message;
    try {
        message = JSON.parse(event.data);
        
        // Record network statistics
        if (typeof networkStats !== 'undefined') {
            networkStats.recordPacket(event.data.length, 'down');
        }
    } catch (error) {
        console.log(error);
        if (typeof networkStats !== 'undefined') {
            networkStats.detectAnomaly('Parse Error', { error: error.message, data: event.data });
        }
        return;
    }

    if (message.debug) {
        console.log(message.debug);
    }

    if (game) {
        if (message.players) {
            for (let player of message.players) {
                //if a player is in the message but not the game.players array, add a new Player
                if (!game.players.find(p => p.token.displayName === player.token.displayName)) {
                    // if this player's token's id is the same as the client's token id
                    if (player.token.displayName === token.displayName) {
                        game.players.push(new Players.Player({ token: token }));
                        game.players[game.players.length - 1].camera = new Camera({ owner: game.players[game.players.length - 1] });
                    } else {
                        game.players.push(new Players.Player(player));
                    }
                }
                // if a player is in the game.players array but not in the message, remove the player
                if (!message.players.find(p => p.token.displayName === player.token.displayName)) {
                    game.players = game.players.filter(p => p.token.displayName !== player.token.displayName);
                }
            }

        }

        if (message.newMatch) {
            game.loadMatch(message.newMatch);
        }

        if (game.match) {
            if (message.characters) {
                for (let character of message.characters) {
                    let c = game.match.characters.find(c => c.id === character.i);
                    if (c) {
                        // Update sync debug before changing positions
                        if (typeof syncDebug !== 'undefined' && syncDebug.enabled) {
                            syncDebug.updateEntity(character.i, 
                                { x: character.p.x, y: character.p.y, z: character.p.z },
                                { x: c.HB.pos.x, y: c.HB.pos.y, z: c.HB.pos.z }
                            );
                        }
                        
                        // Check if this is the local player for client-side prediction reconciliation
                        if (c.parent && c.parent === game.player && message.inputSeq !== undefined) {
                            game.reconcileWithServer(c, character.p, message.inputSeq);
                        }
                        
                        // Update server position and state
                        c.serverPos.x = character.p.x;
                        c.serverPos.y = character.p.y;
                        c.serverPos.z = character.p.z;
                        c.serverPos.time = message.time;
                        
                        // Store server speed for better reconciliation
                        if (character.s) {
                            if (!c.serverSpeed) {
                                c.serverSpeed = { x: 0, y: 0, z: 0 };
                            }
                            c.serverSpeed.x = character.s.x;
                            c.serverSpeed.y = character.s.y;
                            c.serverSpeed.z = character.s.z;
                        }
                        
                        // Update momentum for facing direction
                        if (character.m) {
                            c.mom.x = character.m.x;
                            c.mom.y = character.m.y;
                            c.mom.z = character.m.z;
                        }
                        
                        c.id = character.i;
                        c.hp = character.h;
                        c.pp = character.pp;
                        c.ammo = character.a;
                        
                        // Sync active, visible, and solid states (important for match resets and death)
                        if (character.ac !== undefined) {
                            c.active = character.ac;
                        }
                        if (character.vis !== undefined) {
                            c.visible = character.vis;
                        }
                        if (character.sol !== undefined) {
                            c.solid = character.sol;
                        }
                        
                        // Sync inventory and current weapon
                        if (character.item !== undefined) {
                            c.item = character.item;
                        }
                        
                        // Sync inventory weapons and ammo
                        if (character.inv && Array.isArray(character.inv)) {
                            // Sync each weapon in inventory
                            for (let i = 0; i < character.inv.length; i++) {
                                const weaponType = character.inv[i].w;
                                const weaponAmmo = character.inv[i].a || 0;
                                const weaponNextCool = character.inv[i].nc;
                                const weaponReloading = character.inv[i].r;
                                
                                if (c.inventory[i]) {
                                    // Update existing weapon's ammo and type
                                    if (c.inventory[i].weapon === weaponType) {
                                        // Same weapon, just update ammo and cooldown
                                        c.inventory[i].ammo = weaponAmmo;
                                        if (weaponNextCool !== undefined) {
                                            // Convert relative cooldown time to absolute using client's tick counter
                                            c.inventory[i].nextCool = game.match.time.ticks + weaponNextCool;
                                        }
                                        if (weaponReloading !== undefined) {
                                            c.inventory[i].reloading = weaponReloading;
                                        }
                                    } else {
                                        // Different weapon, replace it
                                        let weaponInstance;
                                        switch(weaponType) {
                                            case 'pistol':
                                                weaponInstance = new Items.Pistol();
                                                break;
                                            case 'rifle':
                                                weaponInstance = new Items.Rifle();
                                                break;
                                            case 'lance':
                                                weaponInstance = new Items.Lance();
                                                break;
                                            case 'flamer':
                                                weaponInstance = new Items.Flamer();
                                                break;
                                            default:
                                                weaponInstance = new Items.Pistol();
                                        }
                                        weaponInstance.ammo = weaponAmmo;
                                        if (weaponNextCool !== undefined) {
                                            // Convert relative cooldown time to absolute using client's tick counter
                                            weaponInstance.nextCool = game.match.time.ticks + weaponNextCool;
                                        }
                                        if (weaponReloading !== undefined) {
                                            weaponInstance.reloading = weaponReloading;
                                        }
                                        weaponInstance.owner = c;
                                        c.inventory[i] = weaponInstance;
                                    }
                                } else {
                                    // Add new weapon to inventory
                                    let weaponInstance;
                                    switch(weaponType) {
                                        case 'pistol':
                                            weaponInstance = new Items.Pistol();
                                            break;
                                        case 'rifle':
                                            weaponInstance = new Items.Rifle();
                                            break;
                                        case 'lance':
                                            weaponInstance = new Items.Lance();
                                            break;
                                        case 'flamer':
                                            weaponInstance = new Items.Flamer();
                                            break;
                                        default:
                                            weaponInstance = new Items.Pistol();
                                    }
                                    weaponInstance.ammo = weaponAmmo;
                                    if (weaponNextCool !== undefined) {
                                        // Convert relative cooldown time to absolute using client's tick counter
                                        weaponInstance.nextCool = game.match.time.ticks + weaponNextCool;
                                    }
                                    if (weaponReloading !== undefined) {
                                        weaponInstance.reloading = weaponReloading;
                                    }
                                    weaponInstance.owner = c;
                                    c.inventory.push(weaponInstance);
                                }
                            }
                            
                            // Remove extra weapons if server has fewer
                            if (c.inventory.length > character.inv.length) {
                                c.inventory.length = character.inv.length;
                            }
                        }
                        
                        // Apply remote player input state for client-side prediction
                        if (character.inp && c.parent && c.parent !== game.player && c.parent.controller) {
                            c.parent.controller.buttons.moveLeft.current = character.inp.ml || 0;
                            c.parent.controller.buttons.moveRight.current = character.inp.mr || 0;
                            c.parent.controller.buttons.moveUp.current = character.inp.mu || 0;
                            c.parent.controller.buttons.moveDown.current = character.inp.md || 0;
                            c.parent.controller.buttons.jump.current = character.inp.j || 0;
                            c.parent.controller.buttons.brake.current = character.inp.br || 0;
                            c.parent.controller.buttons.boost.current = character.inp.bo || 0;
                        }
                    } else {
                        gameWSS.send(JSON.stringify({ getCharacter: character.i }));
                    }
                    // remove characters not in the message
                    // WARNING! message.characters only sends characters who *have not moved* since the last message
                    // game.match.characters = game.match.characters.filter(c => character.id === c.id);
                }
            }

            if (message.character) {
                let c = game.match.characters.find(c => c.id === message.character.id);
                if (!c) game.match.spawnCharacter(message.character);
            }

            if (message.bullets !== undefined) {
                // Collect valid bullet IDs from this update
                const validBulletIds = new Set();
                
                // Update bullets from server
                for (let bullet of message.bullets) {
                    validBulletIds.add(bullet.i);
                    let b = game.match.map.bullets.find(b => b.id === bullet.i);
                    if (b) {
                        //if the bullet is a cube, set the bullet's pos and volume
                        if (bullet.sh == 'c') {
                            b.serverPos.pos.x = bullet.p.x;
                            b.serverPos.pos.y = bullet.p.y;
                            b.serverPos.pos.z = bullet.p.z;
                            b.serverVol.vol.x = bullet.v.x;
                            b.serverPos.vol.y = bullet.v.y;
                            b.serverPos.vol.z = bullet.v.z;
                            b.serverPos.speed = bullet.s;
                        } else if (bullet.sh == 'cy') {
                            //if the bullet is a cylinder, set the bullet's pos and volume
                            b.serverPos.pos.x = bullet.p.x;
                            b.serverPos.pos.y = bullet.p.y;
                            b.serverPos.pos.z = bullet.p.z;
                            b.serverPos.radius = bullet.r;
                            b.serverPos.height = bullet.h;
                            b.serverPos.speed = bullet.s;
                        }
                        b.serverPos.time = message.time;
                    } else {
                        // Convert compressed format back to expected format for spawning
                        const bulletData = {
                            id: bullet.i,
                            pos: bullet.p,
                            speed: bullet.s,
                            type: bullet.t,
                            bulletType: bullet.bt, // rifle, lance, etc.
                            user: bullet.u,
                            shape: bullet.sh,
                            vol: bullet.v,
                            radius: bullet.r,
                            height: bullet.h
                        };
                        bulletData.serverPos = { pos: { x: bullet.p.x, y: bullet.p.y, z: bullet.p.z }, time: message.time };
                        //if the bullet is not in the game, add it
                        game.match.map.spawn(bulletData);
                }
                }
                
                // Remove bullets not in server update (server only sends active bullets)
                game.match.map.bullets = game.match.map.bullets.filter(b => validBulletIds.has(b.id));
            }

            if (message.powerups) {
                const validPowerupIds = new Set();
                
                for (let powerup of message.powerups) {
                    validPowerupIds.add(powerup.id);
                    let p = game.match.map.blocks.find(p => p.id === powerup.id);
                    if (p) {
                        p.HB.pos.x = powerup.pos.x;
                        p.HB.pos.y = powerup.pos.y;
                        p.HB.pos.z = powerup.pos.z;
                        p.active = true; // Server says it's active
                    } else {
                        // Convert compressed format back to expected format for spawning
                        const powerupData = {
                            id: powerup.id,
                            spawnPos: powerup.pos,
                            type: "pickup",
                            subtype: powerup.subtype
                        };
                        game.match.map.spawn(powerupData);
                    }
                }
                
                // Mark powerups not in server update as inactive (but don't remove yet - let collision happen first)
                for (let block of game.match.map.blocks) {
                    if (block.type === 'pickup' && !validPowerupIds.has(block.id)) {
                        block.active = false;
                    }
                }
                
                // Remove powerups that have been inactive (cleanup after collision detection)
                game.match.map.blocks = game.match.map.blocks.filter(b => 
                    b.type !== 'pickup' || b.active || b.cleanup === false
                );
            }

            if (message.weapons) {
                const validWeaponIds = new Set();
                
                for (let weapon of message.weapons) {
                    validWeaponIds.add(weapon.id);
                    let p = game.match.map.blocks.find(p => p.id === weapon.id);
                    if (p) {
                        // Store server position for smooth interpolation
                        if (!p.serverPos) {
                            p.serverPos = { 
                                pos: { x: weapon.pos.x, y: weapon.pos.y, z: weapon.pos.z },
                                time: game.match.ticks
                            };
                            // Initialize at server position to avoid initial jump
                        p.HB.pos.x = weapon.pos.x;
                        p.HB.pos.y = weapon.pos.y;
                        p.HB.pos.z = weapon.pos.z;
                    } else {
                            // Update target position from server
                            p.serverPos.pos.x = weapon.pos.x;
                            p.serverPos.pos.y = weapon.pos.y;
                            p.serverPos.pos.z = weapon.pos.z;
                            p.serverPos.time = game.match.ticks;
                        }
                        
                        // Add interpolation function to runFunc if not already there
                        if (!p.hasWeaponInterpolation) {
                            p.runFunc.push(function() {
                                if (this.serverPos && this.serverPos.pos) {
                                    // Smooth interpolation every frame (not just on network updates)
                                    const lerpFactor = 0.25; // Higher = snappier, lower = smoother
                                    this.HB.pos.x += (this.serverPos.pos.x - this.HB.pos.x) * lerpFactor;
                                    this.HB.pos.y += (this.serverPos.pos.y - this.HB.pos.y) * lerpFactor;
                                    this.HB.pos.z += (this.serverPos.pos.z - this.HB.pos.z) * lerpFactor;
                                }
                            }.bind(p));
                            p.hasWeaponInterpolation = true;
                        }
                    } else {
                        // Spawn new weapon pickup
                        const weaponData = {
                            id: weapon.id,
                            spawnPos: weapon.pos,
                            type: "weapon",
                            weapon: weapon.weapon || 'pistol'
                        };
                        game.match.map.spawn(weaponData);
                    }
                }
                
                // Remove weapons not in server update (picked up or despawned)
                game.match.map.blocks = game.match.map.blocks.filter(w => w.type !== 'weapon' || validWeaponIds.has(w.id));
            }
        }
    }
});

gameWSS.addEventListener('close', (event) => {
    console.log('Disconnected from Game WSS');

});