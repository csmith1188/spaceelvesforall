(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD
        define(['Matches'], factory);
    } else if (typeof module === 'object' && module.exports) {
        // Node.js
        const Matches = require('./match/match.js');
        require('./player/bot_ai.js');
        require('./match/match_forhonormp.js');
        require('./match/for_ever.js');
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
            this.browserWindow = {
                w: 0,
                h: 0
            };
            this.renderOffset = {
                x: 0,
                y: 0
            };
            this.display = {
                w: 0,
                h: 0
            };
            this.renderScale = 1;
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
                updateInterval: 2, // fixed ticks between network updates (30Hz at 60fps)
                sequenceNumber: 0,
                lastSentState: new Map() // entityId -> last sent state
            }
            this.debugPerf = {
                lastRawDelta: 0,
                stepMs: 0,
                drawMs: 0,
                frameMs: 0,
                lastFrameStamp: 0,
                visibleEntities: 0,
                tileDrawCount: 0
            };
            // loop through the options and add them to the game
            for (let key in options) {
                if (options.hasOwnProperty(key)) {
                    this[key] = options[key];
                }
            }
        }

        step() {
            const stepStart = performance.now();
            if (typeof window !== 'undefined' && this.debugPerf.lastFrameStamp > 0) {
                this.debugPerf.frameMs = stepStart - this.debugPerf.lastFrameStamp;
            }
            this.debugPerf.lastFrameStamp = stepStart;
            this.time.ticks++;
            this.time.diff = performance.now() - this.time.last;
            const rawDelta = this.time.diff / this.time.tickRate;
            this.debugPerf.lastRawDelta = rawDelta;
            // Prevent client frame hitches from exploding physics steps and causing desync.
            // Server remains authoritative; client prediction should stay bounded.
            if (typeof window !== 'undefined') {
                const maxClientDelta = 1.2;
                if (rawDelta > maxClientDelta) {
                    this.time.delta = maxClientDelta;
                } else {
                    this.time.delta = rawDelta;
                }
            } else {
                this.time.delta = rawDelta;
            }
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
                        // Update camera before draw so ground transform + sprites share one pose.
                        this.player.camera.update(this.player);
                        const drawStart = performance.now();
                        this.match.draw();
                        this.debugPerf.drawMs = performance.now() - drawStart;
                        
                        // Draw sync debug overlay
                        if (typeof syncDebug !== 'undefined' && syncDebug.enabled) {
                            const syncCtx = (typeof hudCtx !== 'undefined' && hudCtx) ? hudCtx : ctx;
                            syncDebug.draw(syncCtx, this.player.camera);
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
                    if (this.time.ticks % this.networkConfig.updateInterval == 0) {
                        this.networkConfig.sequenceNumber++;
                        
                        // Get only changed entities using delta compression
                        let characters = this.getChangedCharacters();
                        let bullets = this.getChangedBullets();
                        let powerups = this.getChangedPowerups();
                        let weapons = this.getChangedWeapons();
                        let matchState = (this.match && typeof this.match.pack === 'function') ? this.match.pack() : {};
                        
                        // Only send if there are changes
                        if (
                            characters.length > 0 ||
                            bullets.length > 0 ||
                            powerups.length > 0 ||
                            weapons.length > 0 ||
                            Object.keys(matchState).length > 0
                        ) {
                            this.broadcast(this.wss, {
                                characters: characters,
                                bullets: bullets,
                                powerups: powerups,
                                weapons: weapons,
                                match: matchState,
                                time: Date.now(),
                                serverTick: this.time.ticks,
                                seq: this.networkConfig.sequenceNumber
                            });
                        }
                    }

                }
            }
            this.debugPerf.stepMs = performance.now() - stepStart;
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
                    case 'ForEver':
                        console.log('Forever');
                        this.match = new Matches.ForEver(match);
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

        reconcileWithServer(character, serverPos, inputSeq, serverSpeed = null, ackAdvanced = false) {
            if (!this.player || !this.player.controller || !Number.isFinite(inputSeq)) {
                return;
            }
            // During heavy frame hitches, skip local reconciliation this frame.
            // Applying correction while the client is stalled causes visible rubber-banding.
            if (typeof window !== 'undefined' && this.debugPerf.lastRawDelta > 3) {
                return;
            }

            const dx = serverPos.x - character.HB.pos.x;
            const dy = serverPos.y - character.HB.pos.y;
            const dz = serverPos.z - character.HB.pos.z;
            const error = Math.sqrt((dx * dx) + (dy * dy) + (dz * dz));
            if (ackAdvanced) {
                // While inputs are actively being acknowledged, keep correction gentle.
                if (error > 260) {
                    character.HB.pos.x = serverPos.x;
                    character.HB.pos.y = serverPos.y;
                    character.HB.pos.z = serverPos.z;
                } else if (error > 12) {
                    const correctionFactor = 0.06;
                    const maxCorrectionStep = 3.5;
                    const intendedStep = error * correctionFactor;
                    const clampedStep = Math.min(intendedStep, maxCorrectionStep);
                    const correctionScale = clampedStep / error;
                    character.HB.pos.x += dx * correctionScale;
                    character.HB.pos.y += dy * correctionScale;
                    character.HB.pos.z += dz * correctionScale;
                }

                if (serverSpeed && error > 24) {
                    const speedBlend = 0.08;
                    character.speed.x += (serverSpeed.x - character.speed.x) * speedBlend;
                    character.speed.y += (serverSpeed.y - character.speed.y) * speedBlend;
                    character.speed.z += (serverSpeed.z - character.speed.z) * speedBlend;
                }

                this.player.controller.discardInputsUpTo(inputSeq);
            } else {
                // No new local input acked: converge faster so drift resolves even while coasting.
                if (error > 60) {
                    character.HB.pos.x = serverPos.x;
                    character.HB.pos.y = serverPos.y;
                    character.HB.pos.z = serverPos.z;
                } else if (error > 8) {
                    const correctionFactor = 0.12;
                    const maxCorrectionStep = 6;
                    const intendedStep = error * correctionFactor;
                    const clampedStep = Math.min(intendedStep, maxCorrectionStep);
                    const correctionScale = clampedStep / error;
                    character.HB.pos.x += dx * correctionScale;
                    character.HB.pos.y += dy * correctionScale;
                    character.HB.pos.z += dz * correctionScale;
                }

                if (serverSpeed && error > 12) {
                    const speedBlend = 0.18;
                    character.speed.x += (serverSpeed.x - character.speed.x) * speedBlend;
                    character.speed.y += (serverSpeed.y - character.speed.y) * speedBlend;
                    character.speed.z += (serverSpeed.z - character.speed.z) * speedBlend;
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