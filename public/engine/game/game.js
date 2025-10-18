(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD
        define(['Matches'], factory);
    } else if (typeof module === 'object' && module.exports) {
        // Node.js
        const Matches = require('./match/match.js');
        require('./match/match_forhonormp.js');
        module.exports = factory(Matches);
    } else {
        // Browser globals: attach each export directly to the global scope
        const exports = factory(root.Matches);
        for (let key in exports) {
            if (exports.hasOwnProperty(key)) {
                root[key] = exports[key];
            }
        }
    }
}(typeof self !== 'undefined' ? self : this, function (Matches) {

    class Game {
        constructor(options) {
            this.players = [];
            this.client = false;
            this.multiplayer = true;
            this.match = null;
            this.window = {
                w: 0,
                h: 0,
                cx: () => { return this.w / 2 },
                cy: () => { return this.h / 2 }
            };
            this.gameView = {
                w: 0,
                h: 0,
                cx: () => { return this.w / 2 },
                cy: () => { return this.h / 2 }
            };
            this.time = {
                tickRate: 1000 / 60,
                ticks: 0,
                start: performance.now(),
                last: performance.now(),
                diff: 0,
                delta: 0,
                avgList: [],
                avg: 0
            }
            this.networkConfig = {
                updateInterval: 2, // ticks between network updates (20Hz at 60fps)
                maxUpdateInterval: 5, // maximum interval for low activity
                minUpdateInterval: 1, // minimum interval for high activity
                entityThreshold: 20, // switch to higher rate when entity count exceeds this
                lastEntityCount: 0,
                sequenceNumber: 0,
                lastSentState: new Map() // entityId -> last sent state
            }
            // loop through the options and add them to the game
            for (let key in options) {
                if (options.hasOwnProperty(key)) {
                    this[key] = options[key];
                }
            }
        }

        step() {
            this.time.ticks++;
            this.time.diff = performance.now() - this.time.last;
            this.time.delta = this.time.diff / this.time.tickRate;
            this.time.last = performance.now();
            this.time.avgList.push(this.time.delta);
            if (this.time.avgList.length > 20) {
                this.time.avgList.shift();
                this.time.avg = this.time.avgList.reduce((a, b) => a + b, 0) / this.time.avgList.length;
            }
            
            // Update network statistics
            if (typeof window !== 'undefined' && typeof networkStats !== 'undefined') {
                const entityCount = this.match ? 
                    this.match.characters.length + this.match.map.bullets.length + 
                    this.match.map.blocks.filter(b => b.type === 'pickup' || b.type === 'weapon').length : 0;
                
                // Calculate prediction error from all remote characters
                let totalError = 0;
                let errorCount = 0;
                let maxError = 0;
                
                if (this.match && this.player) {
                    for (const character of this.match.characters) {
                        if (character.parent && character.parent !== this.player && character.predictionError !== undefined) {
                            totalError += character.predictionError;
                            maxError = Math.max(maxError, character.predictionError);
                            errorCount++;
                        }
                    }
                }
                
                const avgError = errorCount > 0 ? totalError / errorCount : 0;
                
                networkStats.updateStats({
                    entityCount: entityCount,
                    updateFrequency: 60 / this.networkConfig.updateInterval,
                    serverTickRate: 1000 / this.time.tickRate,
                    clientFrameRate: 1000 / this.time.diff,
                    predictionError: avgError,
                    avgPredictionError: avgError,
                    maxPredictionError: maxError
                });
            }
            // console.log(`Ticks: ${this.time.ticks.toFixed(2)}\t Complete: ${this.time.diff.toFixed(2)}\t Delta: ${this.time.delta.toFixed(2)}\t AVG: ${this.time.avg.toFixed(2)}`);

            if (typeof window !== 'undefined') {
                this.player = this.players.find(player => player.token.id == token.id);
                if (this.player)
                    this.player.interface = this.player.interface || new Interfaces.Interface(this.player);
                this.window.w = window.innerWidth;
                this.window.h = window.innerHeight;
                if (this.player)
                    this.player.camera.radius = Math.sqrt((this.window.w / 2) ** 2 + (this.window.h / 2) ** 2)
                canvas.width = this.window.w;
                canvas.height = this.window.h;
                this.gameView.w = Math.min(window.innerWidth, 1920);
                this.gameView.h = Math.min(window.innerHeight, 1080);
            }

            // handle each player's controller
            for (let player of this.players) {
                player.step();
                if (player.controller) {
                    player.controller.read();
                    if (typeof window !== 'undefined') {
                        //if the newState has at least one property
                        if (Object.keys(player.controller.newState).length > 0) {
                            // Store input for client-side prediction
                            player.controller.storeInput(player.controller.newState, player.controller.aimX, player.controller.aimY, player.controller.aimZ);
                            
                            // Note: Local player input is already applied by character.step()
                            // Client-side prediction happens naturally through normal game simulation
                            
                            // send newState to server
                            const message = JSON.stringify({ 
                                controller: player.controller.newState, 
                                aimX: player.controller.aimX, 
                                aimY: player.controller.aimY, 
                                aimZ: player.controller.aimZ,
                                inputSeq: player.controller.lastInputSequence
                            });
                            gameWSS.send(message);
                            
                            // Record network statistics
                            if (typeof networkStats !== 'undefined') {
                                networkStats.recordPacket(message.length, 'up');
                            }
                        }
                    }
                }
                else if (this.match) {
                    // this.match.paused = `Player ${player.id} has no controller`;
                }
            }

            if (this.match) {
                this.match.step();
                if (typeof window !== 'undefined') {
                    if (this.player) {
                        this.match.draw();
                        this.player.camera.update(this.player); // Update the camera
                        
                        // Draw sync debug overlay
                        if (typeof syncDebug !== 'undefined' && syncDebug.enabled) {
                            syncDebug.draw(ctx, this.player.camera);
                        }
                    }
                } else {
                    /*
                                      _                 _      _
                      ___ ___ _ _  __| |  _  _ _ __  __| |__ _| |_ ___
                     (_-</ -_) ' \/ _` | | || | '_ \/ _` / _` |  _/ -_)
                     /__/\___|_||_\__,_|  \_,_| .__/\__,_\__,_|\__\___|
                                              |_|
                    */
                    // Adaptive network update rate based on entity count
                    const entityCount = this.match.characters.length + this.match.map.bullets.length + 
                                      this.match.map.blocks.filter(b => b.type === 'pickup' || b.type === 'weapon').length;
                    
                    // Adjust update rate based on entity count
                    if (entityCount > this.networkConfig.entityThreshold) {
                        this.networkConfig.updateInterval = this.networkConfig.minUpdateInterval;
                    } else if (entityCount < this.networkConfig.entityThreshold / 2) {
                        this.networkConfig.updateInterval = this.networkConfig.maxUpdateInterval;
                    }
                    
                    if (this.time.ticks % this.networkConfig.updateInterval == 0) {
                        this.networkConfig.sequenceNumber++;
                        
                        // Get only changed entities using delta compression
                        let characters = this.getChangedCharacters();
                        let bullets = this.getChangedBullets();
                        let powerups = this.getChangedPowerups();
                        let weapons = this.getChangedWeapons();
                        
                        // Only send if there are changes
                        if (characters.length > 0 || bullets.length > 0 || powerups.length > 0 || weapons.length > 0) {
                            this.broadcast(this.wss, {
                                characters: characters,
                                bullets: bullets,
                                powerups: powerups,
                                weapons: weapons,
                                time: Date.now(),
                                seq: this.networkConfig.sequenceNumber
                            });
                        }
                    }

                }
            }
        }

        countConnections() {
            let count = 0;
            for (let player of this.players) {
                if (player.connected === true) count++;
                else if (Date.now() - player.connected > 10000) player.ws.close();
            }   

            return count;
        }

        loadMatch(match) {
            try {
                if (typeof match === 'string')
                    match = { matchType: match };
                switch (match.matchType) {
                    case 'Match':
                        this.match = new Matches.Match(match);
                        break;
                    case 'ForHonorMP':
                        console.log('For Honor Multiplayer');
                        this.match = new Matches.ForHonorMP(match);
                        break;
                    default:
                        this.match = new Matches.Match(match);
                        break;
                }
            } catch (error) {
                console.log(error);
            }
        }

        loadPlayer(options) {
            this.players.push(Players.Player(options));
        }

        pack() {
            return {
                players: this.players.map(player => player.pack())
            }
        }

        fullPack() {
            const packed = {
                players: this.players.map(player => player.fullPack())
            }
            for (var key of Object.keys(this)) {
                if (typeof this[key] !== 'function') {
                    if (!packed[key])
                        packed[key] = this[key];
                }
            }
            return packed;
        }

        // Delta compression methods
        getChangedCharacters() {
            const changed = [];
            for (const character of this.match.characters) {
                const currentState = character.pack();
                const lastState = this.networkConfig.lastSentState.get(character.id);
                
                // Skip inactive characters UNLESS they just became inactive (death state needs to be broadcast)
                if (!character.active && lastState && !lastState.ac) {
                    continue;
                }
                
                // Check if character has changed significantly
                if (!lastState || this.hasEntityChanged(lastState, currentState)) {
                    changed.push(currentState);
                    this.networkConfig.lastSentState.set(character.id, currentState);
                }
            }
            return changed;
        }

        getChangedBullets() {
            // ALWAYS send all ACTIVE bullets - they're fast-moving and critical for gameplay
            const changed = [];
            for (const bullet of this.match.map.bullets) {
                // Only send active bullets (skip bullets that hit walls/targets)
                if (bullet.active) {
                    const currentState = bullet.pack();
                    changed.push(currentState);
                    this.networkConfig.lastSentState.set(bullet.id, currentState);
                } else {
                    // Bullet is inactive, remove from tracking (will be cleaned up by map)
                    this.networkConfig.lastSentState.delete(bullet.id);
                }
            }
            return changed;
        }

        getChangedPowerups() {
            // ALWAYS send all powerups - they're static but important for new clients
            const changed = [];
            const powerups = this.match.map.blocks.filter(block => block.type === 'pickup');
            for (const powerup of powerups) {
                const currentState = powerup.pack();
                changed.push(currentState);
                this.networkConfig.lastSentState.set(powerup.id, currentState);
            }
            return changed;
        }

        getChangedWeapons() {
            // ALWAYS send all weapons - they're static but important for new clients
            const changed = [];
            const weapons = this.match.map.blocks.filter(block => block.type === 'weapon');
            for (const weapon of weapons) {
                const currentState = weapon.pack();
                changed.push(currentState);
                this.networkConfig.lastSentState.set(weapon.id, currentState);
            }
            return changed;
        }

        hasEntityChanged(lastState, currentState) {
            // Always send updates for characters (they're fast-moving and need accurate sync)
            if (currentState.t === 'c') {
                // Send if position changed at all (even tiny drifts)
                if (lastState.p && currentState.p) {
                    const dx = Math.abs(lastState.p.x - currentState.p.x);
                    const dy = Math.abs(lastState.p.y - currentState.p.y);
                    const dz = Math.abs(lastState.p.z - currentState.p.z);
                    
                    // Capture even 0.1 pixel changes (slow drift)
                    if (dx > 0.1 || dy > 0.1 || dz > 0.1) return true;
                }
                
                // Send if speed changed (important for drift detection)
                if (lastState.s && currentState.s) {
                    if (Math.abs(lastState.s.x - currentState.s.x) > 0.01) return true;
                    if (Math.abs(lastState.s.y - currentState.s.y) > 0.01) return true;
                    if (Math.abs(lastState.s.z - currentState.s.z) > 0.01) return true;
                }
                
                // Send if input state changed
                if (currentState.inp) return true;
                
                // Always send character updates at least occasionally
                return true;
            }
            
            // Check if position has changed significantly (more than 5 pixels for other entities)
            if (lastState.p && currentState.p) {
                const dx = Math.abs(lastState.p.x - currentState.p.x);
                const dy = Math.abs(lastState.p.y - currentState.p.y);
                const dz = Math.abs(lastState.p.z - currentState.p.z);
                
                if (dx > 5 || dy > 5 || dz > 5) return true;
            }
            
            // Check if other important properties have changed
            if (lastState.h !== currentState.h) return true; // hp
            if (lastState.pp !== currentState.pp) return true; // pp
            if (lastState.ac !== currentState.ac) return true; // active state
            if (lastState.vis !== currentState.vis) return true; // visible state
            if (lastState.sol !== currentState.sol) return true; // solid state
            
            // Check speed (which is an object)
            if (lastState.s && currentState.s) {
                if (Math.abs(lastState.s.x - currentState.s.x) > 0.1) return true;
                if (Math.abs(lastState.s.y - currentState.s.y) > 0.1) return true;
                if (Math.abs(lastState.s.z - currentState.s.z) > 0.1) return true;
            }
            
            return false;
        }

        // Client-side prediction methods
        applyInputToCharacter(character, inputState, aimX, aimY, aimZ) {
            // Apply movement input immediately for responsive feel
            if (inputState.moveRight) character.speed.x = Math.min(character.speed.x + character.accel.x, character.maxSpeed.x);
            if (inputState.moveLeft) character.speed.x = Math.max(character.speed.x - character.accel.x, -character.maxSpeed.x);
            if (inputState.moveUp) character.speed.y = Math.min(character.speed.y + character.accel.y, character.maxSpeed.y);
            if (inputState.moveDown) character.speed.y = Math.max(character.speed.y - character.accel.y, -character.maxSpeed.y);
            if (inputState.jump) character.speed.z = Math.min(character.speed.z + character.accel.z, character.maxSpeed.z);
            
            // Apply aim
            character.aim.x = aimX;
            character.aim.y = aimY;
            character.aim.z = aimZ;
            
            // Apply other actions
            if (inputState.fire && character.inventory[character.item]) {
                character.inventory[character.item].use(character, aimX, aimY, aimZ, 'primary');
            }
        }

        reconcileWithServer(character, serverPos, inputSeq) {
            // For now, use simple reconciliation without input replay
            // The character movement is already being predicted naturally through the game loop
            
            // Check if there's a significant difference between client and server
            const predictionError = Math.sqrt(
                Math.pow(character.HB.pos.x - serverPos.x, 2) + 
                Math.pow(character.HB.pos.y - serverPos.y, 2) + 
                Math.pow(character.HB.pos.z - serverPos.z, 2)
            );
            
            // If prediction error is too large, smoothly correct towards server position
            if (predictionError > 50) {
                // Smooth correction instead of snap
                const correctionFactor = 0.5;
                character.HB.pos.x += (serverPos.x - character.HB.pos.x) * correctionFactor;
                character.HB.pos.y += (serverPos.y - character.HB.pos.y) * correctionFactor;
                character.HB.pos.z += (serverPos.z - character.HB.pos.z) * correctionFactor;
                
                // Log large corrections
                if (typeof networkStats !== 'undefined') {
                    networkStats.detectAnomaly('Large Prediction Error', { 
                        error: predictionError, 
                        serverPos: serverPos,
                        clientPos: { x: character.HB.pos.x, y: character.HB.pos.y, z: character.HB.pos.z }
                    });
                }
            }
        }

    }

    /* For a single instance across all modules, instantiate here, then export */
    /*
    var game = new Game();

    if (typeof window === undefined) {
        game.client = true;
    }
    */

    return { Game /*, game */ };
}));