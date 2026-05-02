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
const gameWsUrl =
    typeof GAME_WS_PATH === 'string' && GAME_WS_PATH.length
        ? `${wsProtocol}//${window.location.host}${GAME_WS_PATH}`
        : `${wsProtocol}//${window.location.hostname}:${PORT}/game`;
const gameWSS = new WebSocket(gameWsUrl);

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
                        game.players.push(new Players.Player({ ...player, token: token }));
                        game.players[game.players.length - 1].camera = new Camera({ owner: game.players[game.players.length - 1] });
                    } else {
                        game.players.push(new Players.Player(player));
                    }
                } else {
                    const existingPlayer = game.players.find(p => p.token.displayName === player.token.displayName);
                    if (existingPlayer) {
                        existingPlayer.spectator = !!player.spectator;
                        if (player.connected !== undefined) existingPlayer.connected = player.connected;
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
            if (message.match) {
                if (message.match.stage !== undefined) game.match.stage = message.match.stage;
                if (message.match.scoreboard !== undefined) game.match.scoreboard = message.match.scoreboard;
                if (message.match.playerReady !== undefined) game.match.playerReady = message.match.playerReady;
                if (message.match.participantIds !== undefined) game.match.participantIds = message.match.participantIds;
                if (message.match.banner !== undefined) game.match.banner = message.match.banner;
                if (message.match.roundsTotal !== undefined) game.match.roundsTotal = message.match.roundsTotal;
                if (message.match.winsToTakeSeries !== undefined) game.match.winsToTakeSeries = message.match.winsToTakeSeries;
                if (message.match.lastWinner !== undefined) game.match.lastWinner = message.match.lastWinner;
                if (message.match.matchWinner !== undefined) game.match.matchWinner = message.match.matchWinner;
            }

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
                        
                        // Update server position and state
                        c.serverPos.x = character.p.x;
                        c.serverPos.y = character.p.y;
                        c.serverPos.z = character.p.z;
                        c.serverPos.time = message.serverTick || message.time;

                        c.snapshotBuffer = c.snapshotBuffer || [];
                        const snapshotReceiveTime = Date.now();
                        const snapshotEntry = {
                            time: snapshotReceiveTime,
                            pos: { x: character.p.x, y: character.p.y, z: character.p.z },
                            speed: character.s ? { x: character.s.x, y: character.s.y, z: character.s.z } : null,
                            mom: character.m ? { x: character.m.x, y: character.m.y, z: character.m.z } : null
                        };
                        const maxSnapshots = c.maxSnapshotBuffer || 20;
                        if (c.snapshotBuffer.length >= maxSnapshots) {
                            c.snapshotBuffer.shift();
                        }
                        c.snapshotBuffer.push(snapshotEntry);
                        
                        // Reconcile local predicted player using server input acknowledgement.
                        if (c.parent && c.parent === game.player && Number.isFinite(character.isq)) {
                            const ackAdvanced = character.isq > c.lastServerInputSeq;
                            game.reconcileWithServer(c, character.p, character.isq, character.s, ackAdvanced);
                            c.lastServerInputSeq = Math.max(c.lastServerInputSeq, character.isq);
                        }
                        
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
                        
                        const createWeaponInstance = (weaponType) => {
                            switch (weaponType) {
                                case 'pistol':
                                    return new Items.Pistol();
                                case 'rifle':
                                    return new Items.Rifle();
                                case 'lance':
                                    return new Items.Lance();
                                case 'flamer':
                                    return new Items.Flamer();
                                case 'sword':
                                    return new Items.Sword();
                                default:
                                    return new Items.Pistol();
                            }
                        };

                        // Sync inventory weapons and ammo
                        if (character.inv && Array.isArray(character.inv)) {
                            // Hard-replace inventory to prevent stale local weapon state after resets.
                            c.inventory = [];
                            for (let i = 0; i < character.inv.length; i++) {
                                const weaponType = character.inv[i].w;
                                const weaponAmmo = character.inv[i].a || 0;
                                const weaponNextCool = character.inv[i].nc;
                                const weaponReloading = character.inv[i].r;

                                let weaponInstance = createWeaponInstance(weaponType);
                                weaponInstance.ammo = weaponAmmo;
                                if (weaponNextCool !== undefined) {
                                    weaponInstance.nextCool = game.match.time.ticks + weaponNextCool;
                                }
                                if (weaponReloading !== undefined) {
                                    weaponInstance.reloading = weaponReloading;
                                }
                                weaponInstance.owner = c;
                                c.inventory.push(weaponInstance);
                            }
                            if (c.inventory.length === 0) {
                                const fallback = new Items.Sword();
                                fallback.owner = c;
                                c.inventory.push(fallback);
                            }
                            c.item = Math.max(0, Math.min(c.item || 0, c.inventory.length - 1));
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