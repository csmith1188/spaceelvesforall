// UMD: loads in AMD, Node (tests/server), or browser globals — mirrors match_forhonormp.js wiring.
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['BotAI', 'Characters', 'Utils', 'Maps', 'Matches', 'Items', 'Powerups', 'Players'], factory);
    } else if (typeof module === 'object' && module.exports) {
        const BotAI = require('../player/bot_ai.js');
        const Characters = require('./character.js');
        const Utils = require('../../utils.js');
        const Maps = require('./map/map.js');
        const Matches = require('./match.js');
        const Items = require('./item.js');
        const Powerups = require('./block/powerup.js');
        const Players = require('../player/player.js');
        module.exports = factory(BotAI, Characters, Utils, Maps, Matches, Items, Powerups, Players);
    } else {
        factory(root.BotAI, root.Characters, root.Utils, root.Maps, root.Matches, root.Items, root.Powerups, root.Players);
    }
}(typeof self !== 'undefined' ? self : this, function (BotAI, Characters, Utils, Maps, Matches, Items, Powerups, Players) {
    /** Same grace window as For Honor / game.countConnections before eject (ms). */
    const DISCONNECT_EJECT_MS = 10000;
    /** Match simulation steps per second (`waveTime` / interval comments assume this). */
    const MATCH_TICKS_PER_SEC = 60;
    /** Seconds before the first wave spawn (wave 0 “quiet” period). */
    const WAVE0_DURATION_SEC = 20;
    /** Seconds dropped weapons stay on the ground (`character.js` uses `game.match.despawnTimer`). */
    const DROPPED_WEAPON_LIVETIME_SEC = 60;
    /**
     * Endless waves on Field City: 1–4 duelists, ready gate, drop-in/out, permadeath → spectator,
     * full wipe → summary → jump restarts a new match (same session).
     */
    class ForEver extends Matches.Match {
        constructor(options) {
            super(options);
            this.matchType = 'ForEver';
            this.stage = 'awaitPlayers';
            this.playerReady = {};
            /** Token ids that received a jetbike this match (used for wipe + sync). */
            this.foreverSpawnedIds = [];
            /** Wave count (increments each wave trigger). */
            this.waves = 0;
            /** Ticks between wave spawns (45s at 60 tick rate ≈ 2700). */
            this.waveTime = 2700;
            /** Next tick index when a wave should fire (server). */
            this.nextWaveAtTick = 0;
            /** Match clock anchor when combat starts (server tick). */
            this.matchStartTick = 0;
            /** Snapshot for end screen (authoritative). */
            this.finalWaveSummary = 0;
            this.finalElapsedTicks = 0;
            this.despawnTimer = MATCH_TICKS_PER_SEC * DROPPED_WEAPON_LIVETIME_SEC;

            if (typeof options === 'object') {
                if (options.stage !== undefined) this.stage = options.stage;
                if (options.playerReady) this.playerReady = options.playerReady;
                if (options.foreverSpawnedIds) this.foreverSpawnedIds = options.foreverSpawnedIds;
                if (options.waves !== undefined) this.waves = options.waves;
                if (options.waveTime !== undefined) this.waveTime = options.waveTime;
                if (options.nextWaveAtTick !== undefined) this.nextWaveAtTick = options.nextWaveAtTick;
                if (options.matchStartTick !== undefined) this.matchStartTick = options.matchStartTick;
                if (options.finalWaveSummary !== undefined) this.finalWaveSummary = options.finalWaveSummary;
                if (options.finalElapsedTicks !== undefined) this.finalElapsedTicks = options.finalElapsedTicks;
                if (options.despawnTimer !== undefined) this.despawnTimer = options.despawnTimer;
            }

            if (typeof window !== 'undefined' && typeof Menus !== 'undefined') {
                this.menu = this.menu || new Menus.Menu_Pause([], new Utils.Rect(0, 0, 220, 170));
            }
        }

        /** Mirror For Honor: connected duelists; optionally include spectators for counts. */
        getConnectedPlayers(includeSpectators = false) {
            return game.players.filter(player => {
                if (!player || player.connected !== true) return false;
                if (!includeSpectators && player.spectator) return false;
                return true;
            });
        }

        /** Jump edge → ready flags for connected duelists (same pattern as ForHonorMP). */
        handleReadyInputs() {
            for (const player of this.getConnectedPlayers(false)) {
                if (!player || !player.controller || !player.token || !player.token.id) continue;
                const jump = player.controller.buttons && player.controller.buttons.jump;
                if (jump && jump.current && !jump.last) {
                    this.playerReady[player.token.id] = true;
                    player.ready = true;
                }
            }
        }

        /** Clear ready flags for players who may ready again (restart / lobby). */
        resetReadyState() {
            for (const player of game.players) {
                if (!player || !player.token || !player.token.id) continue;
                if (player.spectator) continue;
                this.playerReady[player.token.id] = false;
                player.ready = false;
            }
        }

        /** Field City, 1–4 duelists, npc slot list for map rendering compatibility. */
        setup() {
            // If this match was reconstructed from server fullPack, preserve the incoming
            // map entity layout (especially random wall blocks) so client/server collisions match.
            const incomingMap = this.map;
            const hasIncomingBlocks = !!(incomingMap && Array.isArray(incomingMap.blocks) && incomingMap.blocks.length);
            if (hasIncomingBlocks) {
                // Build a blank Field City shell, then hydrate from server-auth blocks.
                this.map = new Maps.Map_FieldCity({ startBlocks: 0 });
                this.map.blocks = [];
                this.map.bullets = [];
                this.map.debris = [];
                for (const block of incomingMap.blocks) {
                    this.map.spawn(block);
                }
            } else {
                // Fresh server match: generate local walls once (server-authoritative source of truth).
                this.map = new Maps.Map_FieldCity();
            }
            this.name = 'Forever';
            this.description = 'Survive against endless waves of enemies.';
            this.playerLimit = { min: 1, max: 4 };
            this.bots = [];
            this.waves = 0;
            this.seedOpeningPickups();
        }

        /** Server-only initial + post-restart pickup scatter (used from setup and wipe restart). */
        seedOpeningPickups() {
            if (typeof window !== 'undefined') return;
            let i = 0;
            for (i = 0; i < 10; i++) {
                this.map.blocks.push(new Powerups.Ammo_Ballistic({
                    spawnPos: new Utils.Vect3(Math.round(Math.random() * this.map.w), Math.round(Math.random() * this.map.h), 0),
                    spawnVol: new Utils.Vect3(32, 32, 32),
                    livetime: this.waveTime,
                    dying: true
                }));
                this.map.blocks.push(new Powerups.Ammo_Plasma({
                    spawnPos: new Utils.Vect3(Math.round(Math.random() * this.map.w), Math.round(Math.random() * this.map.h), 0),
                    spawnVol: new Utils.Vect3(32, 32, 32),
                    livetime: this.waveTime,
                    dying: true
                }));
                this.map.blocks.push(new Powerups.HealthPickup({
                    spawnPos: new Utils.Vect3(Math.round(Math.random() * this.map.w), Math.round(Math.random() * this.map.h), 0),
                    spawnVol: new Utils.Vect3(32, 32, 32),
                    livetime: this.waveTime,
                    dying: true
                }));
            }
        }

        /** Wait until at least one connected duelist exists, then gate on ready. */
        awaitPlayers() {
            const connectedPlayers = this.getConnectedPlayers(false);
            if (connectedPlayers.length < 1) {
                return;
            }
            this.resetReadyState();
            this.stage = 'awaitReady';
        }

        /** At least one duelist must jump-ready before we spawn anyone or start waves. */
        isMinReadyGateMet() {
            const connectedPlayers = this.getConnectedPlayers(false);
            if (connectedPlayers.length === 0) return false;
            for (const player of connectedPlayers) {
                const pid = player && player.token ? player.token.id : null;
                if (pid && this.playerReady[pid]) return true;
            }
            return false;
        }

        /** Drop disconnected duelists past grace; clear ready + spawned tracking for removed tokens. */
        purgeDisconnectedDuelistsPastGrace() {
            const now = Date.now();
            game.players = game.players.filter(p => {
                if (!p || p.spectator) return true;
                if (p.connected === true) return true;
                if (typeof p.connected !== 'number') return true;
                if (now - p.connected <= DISCONNECT_EJECT_MS) return true;
                this.characters = this.characters.filter(c => c.parent !== p);
                if (p.token && p.token.id) {
                    delete this.playerReady[p.token.id];
                    const ix = this.foreverSpawnedIds.indexOf(p.token.id);
                    if (ix >= 0) this.foreverSpawnedIds.splice(ix, 1);
                }
                try {
                    if (p.ws && typeof p.ws.close === 'function') p.ws.close();
                } catch (e) { /* noop */ }
                return false;
            });
        }

        /** Spawn jetbikes for every ready duelist under the player cap who lacks a character. */
        spawnReadyHumansIntoRound() {
            const imgs = ['img/sprites/jetbike', 'img/sprites/dark1', 'img/sprites/dark2', 'img/sprites/dark1'];
            const duelists = this.getConnectedPlayers(false).slice(0, this.playerLimit.max);
            const ordered = duelists.filter(p => p && p.token && p.token.id);
            for (const player of duelists) {
                if (!player.token || !player.token.id) continue;
                if (!this.playerReady[player.token.id]) continue;
                const already = this.characters.some(c => c.parent === player);
                if (already) continue;
                const si = ordered.findIndex(p => p.token.id === player.token.id);
                const idx = si < 0 ? 0 : si;
                this.characters.push(new Characters.Jetbike({
                    name: player.token.displayName || 'Pilot',
                    team: 0,
                    parent: player,
                    active: true,
                    cleanup: false,
                    spawnPos: new Utils.Vect3((this.map.w / 2) + (idx * 200 - 300), (this.map.h / 2) + 200, 0),
                    gfx: imgs[idx % imgs.length]
                }));
                // Keep human loadout deterministic across server/client snapshots: sword + pistol.
                const playerChara = this.characters[this.characters.length - 1];
                playerChara.inventory = [];
                const starterSword = new Items.Sword();
                starterSword.owner = playerChara.parent;
                playerChara.inventory.push(starterSword);
                const starterPistol = new Items.Pistol();
                starterPistol.owner = playerChara.parent;
                playerChara.inventory.push(starterPistol);
                // Start on pistol while preserving sword in slot 1 for quick swap.
                playerChara.item = 1;
                if (this.foreverSpawnedIds.indexOf(player.token.id) < 0) {
                    this.foreverSpawnedIds.push(player.token.id);
                }
            }
        }

        /** Drive all spawned wave bots with shared default bot AI on the server. */
        updateWaveBotsAI() {
            if (this.stage !== 'inRound') return;
            for (const botParent of this.bots) {
                if (!botParent || !botParent.character || !botParent.character.active) continue;
                BotAI.stepDefaultBotAI(this, botParent, { fireDist: 620, fireMod: 22 });
            }
        }

        /** Serialize mode fields for snapshots / clients. */
        pack() {
            return {
                stage: this.stage,
                playerReady: this.playerReady,
                foreverSpawnedIds: this.foreverSpawnedIds,
                waves: this.waves,
                waveTime: this.waveTime,
                nextWaveAtTick: this.nextWaveAtTick,
                matchStartTick: this.matchStartTick,
                finalWaveSummary: this.finalWaveSummary,
                finalElapsedTicks: this.finalElapsedTicks,
                despawnTimer: this.despawnTimer
            };
        }

        /**
         * Server tick order: disconnect hygiene → cap duelists → simulation → mode FSM + waves.
         * Clients return after super.step (they mirror pack() + draw).
         */
        step() {
            if (typeof window === 'undefined') {
                this.purgeDisconnectedDuelistsPastGrace();
                // Feed synthetic controls before physics so bot characters actually move/fire.
                this.updateWaveBotsAI();
                // Cap at four non-spectator duelists: overflow → spectator, strip their characters.
                const duelists = game.players.filter(pl => pl && pl.connected === true && !pl.spectator);
                if (duelists.length > this.playerLimit.max) {
                    let iCap = 0;
                    for (iCap = this.playerLimit.max; iCap < duelists.length; iCap++) {
                        const overflow = duelists[iCap];
                        overflow.spectator = true;
                        this.characters = this.characters.filter(c => c.parent !== overflow);
                        if (overflow.token && overflow.token.id) {
                            delete this.playerReady[overflow.token.id];
                        }
                    }
                }
            }
            super.step();
            this.ticks = this.time.ticks;
            if (typeof window !== 'undefined') {
                return;
            }

            // --- Wipe summary → jump restarts: strip map loot, re-seed, clear roster, awaitReady. ---
            if (this.stage === 'allDead') {
                let jumpRestart = false;
                // Everyone is spectator after a wipe, so restart input must read from all connected players.
                for (const player of this.getConnectedPlayers(true)) {
                    if (!player.controller || !player.controller.buttons || !player.controller.buttons.jump) continue;
                    const j = player.controller.buttons.jump;
                    if (j.current && !j.last) {
                        jumpRestart = true;
                        break;
                    }
                }
                if (jumpRestart) {
                    this.map.blocks = this.map.blocks.filter(function (el) { return el.type === 'block'; });
                    this.characters = [];
                    this.bots = [];
                    this.foreverSpawnedIds = [];
                    this.waves = 0;
                    this.finalWaveSummary = 0;
                    this.finalElapsedTicks = 0;
                    this.nextWaveAtTick = 0;
                    this.matchStartTick = 0;
                    for (const player of game.players) {
                        if (!player || !player.token) continue;
                        player.spectator = false;
                    }
                    this.resetReadyState();
                    this.seedOpeningPickups();
                    this.stage = 'awaitReady';
                }
                return;
            }

            // --- awaitReady: jump-readied players spawn once ≥1 ready; then clock + waves arm. ---
            if (this.stage === 'awaitReady') {
                this.handleReadyInputs();
                if (!this.isMinReadyGateMet()) {
                    return;
                }
                this.spawnReadyHumansIntoRound();
                if (!this.characters.some(c => game.players.includes(c.parent))) {
                    return;
                }
                this.matchStartTick = this.time.ticks;
                this.nextWaveAtTick = this.time.ticks + MATCH_TICKS_PER_SEC * WAVE0_DURATION_SEC;
                this.waves = 0;
                this.stage = 'inRound';
                return;
            }

            if (this.stage !== 'inRound') {
                return;
            }

            // --- Drop-in: newly ready duelists spawn mid-wave when slots allow. ---
            this.handleReadyInputs();
            this.spawnReadyHumansIntoRound();

            // --- Permadeath: human jetbike inactive → parent spectator + compaction flag. ---
            for (const chara of this.characters) {
                if (!chara || !chara.parent) continue;
                if (!game.players.includes(chara.parent)) continue;
                if (chara.parent.spectator) continue;
                if (chara.active) continue;
                chara.parent.spectator = true;
                chara.cleanup = true;
            }

            // --- Full wipe when every spawned duelist has no active character left. ---
            let anySpawnedAlive = false;
            for (const id of this.foreverSpawnedIds) {
                const parent = game.players.find(pl => pl && pl.token && pl.token.id === id);
                if (!parent || parent.spectator) continue;
                const chara = this.characters.find(c => c.parent === parent);
                if (chara && chara.active) {
                    anySpawnedAlive = true;
                    break;
                }
            }
            if (this.foreverSpawnedIds.length > 0 && !anySpawnedAlive) {
                this.finalWaveSummary = this.waves;
                this.finalElapsedTicks = Math.max(0, this.time.ticks - this.matchStartTick);
                this.characters = [];
                this.bots = [];
                this.stage = 'allDead';
                return;
            }

            // --- Wave timer: every waveTime ticks spawn enemies + pickups (legacy pacing). ---
            if (this.time.ticks < this.nextWaveAtTick) {
                return;
            }
            this.nextWaveAtTick = this.time.ticks + this.waveTime;
            this.waves++;

            let enemyTarget = null;
            for (const chara of this.characters) {
                if (!chara || !chara.active) continue;
                if (!chara.parent) continue;
                if (!game.players.includes(chara.parent)) continue;
                if (chara.parent.spectator) continue;
                enemyTarget = chara;
                break;
            }
            let i = 0;
            for (i = 0; i < Math.ceil(this.waves / 2); i++) {
                const botParent = new Players.Bot({
                    token: { id: 'fe_npc_' + Utils.uuidGen(4), displayName: Characters.getName() },
                    connected: true,
                    spectator: false,
                    ready: true
                });
                botParent.controller = BotAI.createBotController({ includeAimZ: true });
                this.bots.push(botParent);
                this.characters.push(new Characters.Jetbike({
                    name: botParent.token.displayName,
                    team: 1,
                    parent: botParent,
                    active: true,
                    cleanup: false,
                    spawnPos: new Utils.Vect3(Math.round(Math.random() * this.map.w), Math.round(Math.random() * this.map.h), 0),
                    target: enemyTarget,
                    color: [0, 0, 255],
                    gfx: 'img/sprites/dark2'
                }));
                const botChara = this.characters[this.characters.length - 1];
                botParent.character = botChara;
                const randWeapon = Math.floor(Math.random() * 4);
                if (randWeapon === 0) botChara.inventory.push(new Items.Pistol());
                else if (randWeapon === 1) botChara.inventory.push(new Items.Rifle());
                else if (randWeapon === 2) botChara.inventory.push(new Items.Flamer());
                else botChara.inventory.push(new Items.Lance());
                botChara.item = Math.round(Math.random());
            }

            for (i = 0; i < 5; i++) {
                this.map.blocks.push(new Powerups.Ammo_Ballistic({
                    spawnPos: new Utils.Vect3(Math.round(Math.random() * this.map.w), Math.round(Math.random() * this.map.h), 0),
                    spawnVol: new Utils.Vect3(32, 32, 32),
                    livetime: this.waveTime * 3,
                    dying: true
                }));
                this.map.blocks.push(new Powerups.Ammo_Plasma({
                    spawnPos: new Utils.Vect3(Math.round(Math.random() * this.map.w), Math.round(Math.random() * this.map.h), 0),
                    spawnVol: new Utils.Vect3(32, 32, 32),
                    livetime: this.waveTime * 3,
                    dying: true
                }));
                this.map.blocks.push(new Powerups.HealthPickup({
                    spawnPos: new Utils.Vect3(Math.round(Math.random() * this.map.w), Math.round(Math.random() * this.map.h), 0),
                    spawnVol: new Utils.Vect3(32, 32, 32),
                    livetime: this.waveTime * 3,
                    dying: true
                }));
            }

            /** Same footprint as ammo/health pickups in this wave (zero volume = no collision). */
            const weaponPickupVol = new Utils.Vect3(32, 32, 32);
            const midRand = Math.floor(Math.random() * 4);
            if (midRand === 0) {
                this.map.blocks.push(new Powerups.WeaponPickup({
                    spawnPos: new Utils.Vect3((this.map.w / 2), (this.map.h / 2), 0),
                    spawnVol: weaponPickupVol,
                    weapon: 'pistol',
                    pickupDelay: 0,
                    livetime: this.waveTime * 3,
                    dying: true
                }));
            } else if (midRand === 1) {
                this.map.blocks.push(new Powerups.WeaponPickup({
                    spawnPos: new Utils.Vect3((this.map.w / 2), (this.map.h / 2), 0),
                    spawnVol: weaponPickupVol,
                    weapon: 'rifle',
                    pickupDelay: 0,
                    livetime: this.waveTime * 3,
                    dying: true
                }));
            } else if (midRand === 2) {
                this.map.blocks.push(new Powerups.WeaponPickup({
                    spawnPos: new Utils.Vect3((this.map.w / 2), (this.map.h / 2), 0),
                    spawnVol: weaponPickupVol,
                    weapon: 'flamer',
                    pickupDelay: 0,
                    livetime: this.waveTime * 3,
                    dying: true
                }));
            } else {
                this.map.blocks.push(new Powerups.WeaponPickup({
                    spawnPos: new Utils.Vect3((this.map.w / 2), (this.map.h / 2), 0),
                    spawnVol: weaponPickupVol,
                    weapon: 'lance',
                    pickupDelay: 0,
                    livetime: this.waveTime * 3,
                    dying: true
                }));
            }

            if (this.waves % 2 === 0) {
                const spawns = (this.waves > 1) ? Math.floor(this.waves / 4) : 1;
                let k = 0;
                for (k = 0; k < spawns; k++) {
                    const allyParent = new Players.Bot({
                        token: { id: 'fe_ally_' + Utils.uuidGen(4), displayName: Characters.getName() },
                        connected: true,
                        spectator: false,
                        ready: true
                    });
                    allyParent.controller = BotAI.createBotController({ includeAimZ: true });
                    this.bots.push(allyParent);
                    this.characters.push(new Characters.Jetbike({
                        name: allyParent.token.displayName,
                        team: 0,
                        parent: allyParent,
                        active: true,
                        cleanup: false,
                        spawnPos: new Utils.Vect3((this.map.w / 2), (this.map.h / 2), 0),
                        target: null,
                        color: [0, 255, 0],
                        gfx: 'img/sprites/dark1',
                        runFunc: [
                            function () { }.bind(this.characters[this.characters.length - 1])
                        ]
                    }));
                    const allyChara = this.characters[this.characters.length - 1];
                    allyParent.character = allyChara;
                    allyChara.HB = new Utils.Cylinder(new Utils.Vect3(Math.round(Math.random() * this.map.w), Math.round(Math.random() * this.map.h), 0), 29, 37);
                    const ar = Math.floor(Math.random() * 3);
                    if (ar === 0) {
                        const ar2 = Math.floor(Math.random() * 4);
                        allyChara.inventory.push(new Items.Pistol());
                        if (ar2 === 0) allyChara.inventory.push(new Items.Pistol());
                        else if (ar2 === 1) allyChara.inventory.push(new Items.Rifle());
                        else if (ar2 === 2) allyChara.inventory.push(new Items.Flamer());
                        else allyChara.inventory.push(new Items.Flamer());
                        allyChara.item = Math.round(Math.random());
                    }
                }
            }
        }

        /** HUD: timer + wave during combat; ready/wipe overlays follow replicated stage. */
        draw() {
            if (this.stage === 'awaitPlayers') {
                if (this.map) {
                    this.map.draw();
                } else {
                    super.draw();
                }
            } else {
                super.draw();
            }

            // --- Ready panel: waiting for first jump to start or post-restart gate. ---
            if (this.stage === 'awaitPlayers' || this.stage === 'awaitReady') {
                const panelW = 520;
                const panelH = 260;
                const x = (game.gameView.w / 2) - (panelW / 2);
                const y = (game.gameView.h / 2) - (panelH / 2);
                ctx.fillStyle = 'rgba(0,0,0,0.58)';
                ctx.fillRect(x, y, panelW, panelH);
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 2;
                ctx.strokeRect(x, y, panelW, panelH);
                ctx.textAlign = 'center';
                ctx.fillStyle = '#FFFFFF';
                ctx.font = '28px Jura';
                ctx.fillText('Forever — Ready Up', x + panelW / 2, y + 42);
                ctx.font = '18px Jura';
                ctx.fillText('Press jump to ready (need ≥1 ready to start)', x + panelW / 2, y + 76);
                ctx.font = '15px Jura';
                ctx.fillText('1–4 duelists · Drop-in/out · Dead → spectator this match', x + panelW / 2, y + 102);
                const slots = this.playerLimit.max;
                let si = 0;
                for (si = 0; si < slots; si++) {
                    const connected = this.getConnectedPlayers(false);
                    const slotPlayer = connected[si];
                    const slotX = x + 30 + si * 118;
                    const slotY = y + 130;
                    ctx.fillStyle = 'rgba(0,0,0,0.55)';
                    ctx.fillRect(slotX, slotY, 108, 100);
                    ctx.strokeStyle = '#FFFFFF';
                    ctx.strokeRect(slotX, slotY, 108, 100);
                    ctx.fillStyle = '#FFFFFF';
                    ctx.font = '15px Jura';
                    if (!slotPlayer) {
                        ctx.fillText('Empty', slotX + 54, slotY + 40);
                    } else {
                        const pid = slotPlayer.token.id;
                        ctx.fillText(slotPlayer.token.displayName || 'Player', slotX + 54, slotY + 36);
                        ctx.fillStyle = this.playerReady[pid] ? '#4CD964' : '#FFFFFF';
                        ctx.fillText(this.playerReady[pid] ? 'Ready' : 'Not ready', slotX + 54, slotY + 62);
                    }
                }
            }

            // --- Combat HUD: elapsed time + wave index (no scoreboard). ---
            if (this.stage === 'inRound') {
                const elapsedTicks = Math.max(0, this.time.ticks - this.matchStartTick);
                const sec = Math.floor(elapsedTicks / 60);
                const mm = Math.floor(sec / 60);
                const ss = sec % 60;
                const timeStr = (mm < 10 ? '0' : '') + mm + ':' + (ss < 10 ? '0' : '') + ss;
                const nextWaveIn = Math.max(0, this.nextWaveAtTick - this.time.ticks);
                const nextSec = Math.floor(nextWaveIn / 60);
                const hudText = 'Wave: ' + this.waves + '  |  Time: ' + timeStr + '  |  Next wave: ~' + nextSec + 's';
                ctx.font = '16px Jura';
                const pad = 10;
                const panelW = ctx.measureText(hudText).width + (pad * 2);
                const panelH = 32;
                const panelX = (game.gameView.w / 2) - (panelW / 2);
                const panelY = 14;
                // Top HUD window to mirror For Honor's scoreboard strip placement.
                ctx.fillStyle = 'rgba(0,0,0,0.48)';
                ctx.fillRect(panelX, panelY, panelW, panelH);
                ctx.fillStyle = '#FFFFFF';
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 1;
                ctx.strokeRect(panelX, panelY, panelW, panelH);
                ctx.textAlign = 'center';
                ctx.fillText(hudText, game.gameView.w / 2, panelY + 21);
            }

            // --- All dead: final summary + jump to restart (clients mirror server fields). ---
            if (this.stage === 'allDead') {
                ctx.fillStyle = 'rgba(0,0,0,0.55)';
                ctx.fillRect(0, 0, game.gameView.w, game.gameView.h);
                ctx.textAlign = 'center';
                ctx.fillStyle = '#FFFFFF';
                ctx.font = '36px Jura';
                ctx.fillText('Match over', game.gameView.w / 2, game.gameView.h / 2 - 48);
                ctx.font = '22px Jura';
                ctx.fillText('Waves reached: ' + this.finalWaveSummary, game.gameView.w / 2, game.gameView.h / 2 - 8);
                const et = this.finalElapsedTicks;
                const sec = Math.floor(et / 60);
                const mm = Math.floor(sec / 60);
                const ss = sec % 60;
                const timeStr = (mm < 10 ? '0' : '') + mm + ':' + (ss < 10 ? '0' : '') + ss;
                ctx.fillText('Survival time: ' + timeStr, game.gameView.w / 2, game.gameView.h / 2 + 28);
                ctx.font = '18px Jura';
                ctx.fillText('Press jump to return to ready (restart match)', game.gameView.w / 2, game.gameView.h / 2 + 72);
            }

            if (this.menu && game.paused) {
                this.menu.step();
                this.menu.draw();
            }
        }
    }

    Matches.ForEver = ForEver;
    return Matches;
}));
