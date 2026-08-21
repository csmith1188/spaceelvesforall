// UMD wrapper: same file loads in AMD bundlers, Node (tests/server), or plain browser globals.
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['BotAI', 'Characters', 'Utils', 'Maps', 'Matches', 'Items', 'Powerups', 'Players'], factory);
    } else if (typeof module === 'object' && module.exports) {
        // Nodejs
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
        // Browser globals (root is window). BotAI + Players must load before this script (see client.ejs).
        root.ForHonorMP = factory(root.BotAI, root.Characters, root.Utils, root.Maps, root.Matches, root.Items, root.Powerups, root.Players);
    }
}(typeof self !== 'undefined' ? self : this, function (BotAI, Characters, Utils, Maps, Matches, Items, Powerups, Players) {
    const FOR_HONOR_BOT_TOKEN_ID = '__for_honor_duel_bot__';
    /** Same grace window as `game.countConnections` before forcing WS close (ms). */
    const DISCONNECT_EJECT_MS = 10000;

    /*
     #######                  #     #
     #        ####  #####     #     #  ####  #    #  ####  #####
     #       #    # #    #    #     # #    # ##   # #    # #    #
     #####   #    # #    #    ####### #    # # #  # #    # #    #
     #       #    # #####     #     # #    # #  # # #    # #####
     #       #    # #   #     #     # #    # #   ## #    # #   #
     #        ####  #    #    #     #  ####  #    #  ####  #    #
    
    */
    /**
     * Best-of series duel: two players, first to winsToTakeSeries round wins wins the match.
     * Stages: awaitPlayers → awaitReady → inRound → roundResult or matchResult → awaitReady …
     * Authoritative simulation runs on the server (no window); the browser only renders HUD overlays.
     */
    class ForHonorMP extends Matches.Match {
        constructor(options) {
            super(options);
            // Series length (default 3 rounds); winsToTakeSeries is majority (e.g. 2 wins in a Bo3).
            this.roundsTotal = 3;
            this.winsToTakeSeries = Math.floor(this.roundsTotal / 2) + 1;
            // Per-player token id → round wins in the current series (reset when someone wins the match).
            this.scoreboard = {};
            // Per-player ready flag for gated transitions (ready-up between rounds).
            this.playerReady = {};
            // Duel participants in stable order (used for UI and score line).
            this.participantIds = [];
            this.banner = {
                visible: false,
                headline: '',
                subline: '',
                untilTick: 0
            };
            this.lastWinner = null;
            this.matchWinner = null;
            /** Set when a solo human faces CPU; not in game.players (does not count toward connection limit). */
            this.duelBotParent = null;
            // Match constructor ends in awaitPlayers; base Match.step will call awaitPlayers() when enough clients connect.
            this.stage = 'awaitPlayers';
            // Hydrate from network/sync payload when reconstructing match state.
            if (typeof options === 'object') {
                if (options.scoreboard) this.scoreboard = options.scoreboard;
                if (options.playerReady) this.playerReady = options.playerReady;
                if (options.banner) this.banner = options.banner;
                if (options.roundsTotal) this.roundsTotal = options.roundsTotal;
                if (options.winsToTakeSeries) this.winsToTakeSeries = options.winsToTakeSeries;
                if (options.lastWinner !== undefined) this.lastWinner = options.lastWinner;
                if (options.matchWinner !== undefined) this.matchWinner = options.matchWinner;
                if (options.stage) this.stage = options.stage;
            }
            // Pause menu exists only in the browser client.
            if (typeof window !== 'undefined' && typeof Menus !== 'undefined') {
                this.menu = this.menu || new Menus.Menu_Pause([], new Utils.Rect(0, 0, 220, 170));
            }
        }

        /** Ensure scoreboard and playerReady have keys for every participant so lookups never hit undefined mid-step. */
        ensurePlayerScoreEntries() {
            for (const pid of this.participantIds) {
                if (!pid) continue;
                if (this.scoreboard[pid] === undefined) {
                    this.scoreboard[pid] = 0;
                }
                if (this.playerReady[pid] === undefined) {
                    this.playerReady[pid] = false;
                }
            }
        }

        /** Connected session slots; optionally include spectators (for counts vs duel slots). */
        getConnectedPlayers(includeSpectators = false) {
            return game.players.filter(player => {
                if (!player || player.connected !== true) return false;
                if (!includeSpectators && player.spectator) return false;
                return true;
            });
        }

        /** Toggle whether characters participate in combat (off between rounds / after a KO). */
        setCharactersCombatEnabled(isEnabled) {
            for (const chara of this.characters) {
                chara.active = isEnabled;
                chara.solid = isEnabled;
                chara.visible = true;
                if (!isEnabled) {
                    chara.speed.x = 0;
                    chara.speed.y = 0;
                    chara.speed.z = 0;
                }
            }
        }

        /** Clear ready flags for all non-spectators so the next gate starts fresh. */
        resetReadyState() {
            for (const player of game.players) {
                if (!player || !player.token || !player.token.id) continue;
                if (player.spectator) continue;
                this.playerReady[player.token.id] = false;
                player.ready = false;
            }
        }

        /** Called by Match super constructor: map, metadata, and strict 1v1 player limit. */
        setup() {
            this.map = new Maps.Map_Deathbox();
            this.name = "For Honor";
            this.description = "A duel to the death.";
            this.playerLimit = { min: 2, max: 2 };
        }

        /** At least one duelist connected: leave lobby (bots never count toward connections). */
        awaitPlayers() {
            const connectedPlayers = this.getConnectedPlayers(false);
            if (connectedPlayers.length < 1) {
                return;
            }
            this.resetReadyState();
            this.setCharactersCombatEnabled(false);
            this.stage = 'awaitReady';
        }

        /** Start-of-round: clear result UI state, strip transient map entities, respawn and re-equip duelists. */
        resetRound() {
            super.reset();
            this.lastWinner = null;
            this.matchWinner = null;
            this.banner.visible = false;
            this.banner.headline = '';
            this.banner.subline = '';
            this.banner.untilTick = 0;

            // Remove pickups / weapons from previous round; keep static geometry only.
            this.map.blocks = this.map.blocks.filter(function (el) { return el.type === 'block'; });

            for (let i = 0; i < this.characters.length; i++) {
                const chara = this.characters[i];
                chara.active = true;
                chara.visible = true;
                chara.solid = true;
                // Split spawns on opposite sides of center so duelists start apart.
                chara.HB.pos.x = (this.map.w / 2) + (i % 2 ? 800 : -800);
                chara.HB.pos.y = (this.map.h / 2);
                chara.HB.pos.z = 0;
                chara.speed.x = 0;
                chara.speed.y = 0;
                chara.speed.z = 0;
                chara.hp = chara.hp_max;
                chara.inventory = [];
                const starterWeapon = new Items.Sword();
                starterWeapon.owner = chara;
                chara.inventory.push(starterWeapon);
                chara.item = 0;
                chara.pp = chara.pp_max;
                chara.ammo.ballistic = 1;
                chara.ammo.plasma = 1;
            }

            // Headless server: spawn pickups and animated weapon pickups (not used on browser clients).
            if (typeof window === 'undefined') {
                this.map.blocks.push(new Powerups.HealthPickup({
                    spawnPos: new Utils.Vect3((this.map.w / 2) - 800, (this.map.h / 2) + 96, 0),
                    spawnVol: new Utils.Vect3(128, 128, 64)
                }));
                this.map.blocks.push(new Powerups.HealthPickup({
                    spawnPos: new Utils.Vect3((this.map.w / 2) + 800, (this.map.h / 2) - 96, 0),
                    spawnVol: new Utils.Vect3(128, 128, 64)
                }));
                this.map.blocks.push(new Powerups.Ammo_Ballistic({
                    spawnPos: new Utils.Vect3((this.map.w / 2) - 500, (this.map.h / 2) - 400, 0),
                    spawnVol: new Utils.Vect3(128, 128, 64)
                }));
                this.map.blocks.push(new Powerups.Ammo_Plasma({
                    spawnPos: new Utils.Vect3((this.map.w / 2) + 472, (this.map.h / 2) + 400, 0),
                    spawnVol: new Utils.Vect3(128, 128, 64)
                }));
                this.map.blocks.push(new Powerups.Ammo_Ballistic({
                    spawnPos: new Utils.Vect3((this.map.w / 2) + 378, (this.map.h / 2) + 400, 0),
                    spawnVol: new Utils.Vect3(128, 128, 64)
                }));
                this.map.blocks.push(new Powerups.Ammo_Plasma({
                    spawnPos: new Utils.Vect3((this.map.w / 2) - 408, (this.map.h / 2) - 400, 0),
                    spawnVol: new Utils.Vect3(128, 128, 64)
                }));

                this.map.blocks.push(new Powerups.WeaponPickup({
                    spawnPos: new Utils.Vect3((this.map.w / 2), (this.map.h / 2), 0),
                    spawnVol: new Utils.Vect3(32, 32, 32),
                    weapon: 'pistol', pickupDelay: 0
                }));
                this.map.blocks.push(new Powerups.WeaponPickup({
                    spawnPos: new Utils.Vect3((this.map.w / 2), (this.map.h / 2), 0),
                    spawnVol: new Utils.Vect3(32, 32, 32),
                    weapon: 'lance', pickupDelay: 0
                }));
                this.map.blocks.push(new Powerups.WeaponPickup({
                    spawnPos: new Utils.Vect3((this.map.w / 2), (this.map.h / 2), 0),
                    spawnVol: new Utils.Vect3(32, 32, 32),
                    weapon: 'rifle', pickupDelay: 0
                }));
                this.map.blocks.push(new Powerups.WeaponPickup({
                    spawnPos: new Utils.Vect3((this.map.w / 2), (this.map.h / 2), 0),
                    spawnVol: new Utils.Vect3(32, 32, 32),
                    weapon: 'flamer', pickupDelay: 0
                }));

                // Float weapon pickups on independent sine phases so they do not stack visually.
                let blockCounter = 0;
                for (const block of this.map.blocks) {
                    if (block.type !== 'weapon') continue;
                    block.sineOffset = blockCounter++;
                    if (!block.originalSpawnPos) {
                        block.originalSpawnPos = { x: block.HB.pos.x, y: block.HB.pos.y };
                    }
                    block.runFunc.push(
                        function () {
                            this.HB.pos.x = this.originalSpawnPos.x + Utils.sineAnimate(100, 0.025, (this.sineOffset * 60));
                            this.HB.pos.y = this.originalSpawnPos.y + Utils.sineAnimate(100, 0.025, (this.sineOffset * 60) + 60);
                        }.bind(block)
                    );
                }
            }
        }

        /** Full-screen result messaging; untilTick supports optional auto-hide while inRound (client UX). */
        showBanner(headline, subline, durationTicks) {
            this.banner.visible = true;
            this.banner.headline = headline;
            this.banner.subline = subline || '';
            this.banner.untilTick = this.time.ticks + durationTicks;
        }

        /** Edge-detect jump button: ready / advance when player presses jump this tick. */
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

        /**
         * Solo queue: one human must jump-ready (CPU fills slot at round start).
         * Two humans: both must ready (connection order still capped by slice in round start).
         */
        areAllConnectedPlayersReady() {
            const connectedPlayers = this.getConnectedPlayers(false);
            if (connectedPlayers.length === 0) return false;
            if (connectedPlayers.length === 1) {
                const pid = connectedPlayers[0] && connectedPlayers[0].token ? connectedPlayers[0].token.id : null;
                return !!(pid && this.playerReady[pid]);
            }
            const duelists = connectedPlayers.slice(0, this.playerLimit.max);
            for (const player of duelists) {
                const pid = player && player.token ? player.token.id : null;
                if (!pid || !this.playerReady[pid]) return false;
            }
            return true;
        }

        /** Human-readable series score for banners and the in-round strip. */
        buildScoreLine() {
            const parts = [];
            for (const pid of this.participantIds) {
                if (!pid) continue;
                if (pid === FOR_HONOR_BOT_TOKEN_ID) {
                    parts.push(`Bot: ${this.scoreboard[pid] || 0}`);
                    continue;
                }
                const player = game.players.find(p => p && p.token && p.token.id === pid);
                const name = player && player.token ? player.token.displayName : 'Player';
                parts.push(`${name}: ${this.scoreboard[pid] || 0}`);
            }
            return parts.join('  |  ');
        }

        /** Prompt shown on ready UI and post-round banner (spectators use camera hint). */
        getInputPromptText() {
            if (typeof window !== 'undefined' && game.player && game.player.spectator) {
                return 'Press Fire to switch camera';
            }
            return 'Press jump to ready up';
        }

        /** Serialize mode state for game snapshots / network sync. */
        pack() {
            return {
                stage: this.stage,
                scoreboard: this.scoreboard,
                playerReady: this.playerReady,
                participantIds: this.participantIds,
                banner: this.banner,
                roundsTotal: this.roundsTotal,
                winsToTakeSeries: this.winsToTakeSeries,
                lastWinner: this.lastWinner,
                matchWinner: this.matchWinner,
                duelBotActive: !!this.duelBotParent,
                forHonorBotTokenId: FOR_HONOR_BOT_TOKEN_ID
            };
        }

        ensureDuelBotParent() {
            if (this.duelBotParent) return;
            if (!Players || !Players.Bot) return;
            this.duelBotParent = new Players.Bot({
                id: FOR_HONOR_BOT_TOKEN_ID,
                token: { id: FOR_HONOR_BOT_TOKEN_ID, displayName: 'Bot' },
                connected: true,
                ready: true,
                spectator: false
            });
            this.duelBotParent.controller = BotAI.createBotController({});
        }

        /** Drop any jetbike tied to the For Honor CPU token (reference-safe). */
        stripDuelBotCharacter() {
            this.characters = this.characters.filter(c => {
                if (!c || !c.parent || !c.parent.token) return true;
                if (c.parent.token.id === FOR_HONOR_BOT_TOKEN_ID) return false;
                if (this.duelBotParent && c.parent === this.duelBotParent) return false;
                return true;
            });
        }

        removeDuelBotFully() {
            this.stripDuelBotCharacter();
            this.duelBotParent = null;
            delete this.playerReady[FOR_HONOR_BOT_TOKEN_ID];
            if (this.scoreboard && Object.prototype.hasOwnProperty.call(this.scoreboard, FOR_HONOR_BOT_TOKEN_ID)) {
                delete this.scoreboard[FOR_HONOR_BOT_TOKEN_ID];
            }
        }

        /** Second human joined during a bot match: abort and reset series for a fair human-vs-human gate. */
        dismissDuelBotAndResetForHumans() {
            this.removeDuelBotFully();
            this.participantIds = [];
            this.lastWinner = null;
            this.matchWinner = null;
            this.banner.visible = false;
            this.banner.headline = '';
            this.banner.subline = '';
            this.banner.untilTick = 0;
            for (const k of Object.keys(this.scoreboard)) {
                delete this.scoreboard[k];
            }
            this.resetReadyState();
            this.setCharactersCombatEnabled(false);
            this.stage = 'awaitReady';
        }

        maybeInterruptForSecondHuman() {
            if (this.getConnectedPlayers(false).length < 2 || !this.duelBotParent) return;
            this.dismissDuelBotAndResetForHumans();
        }

        /**
         * Remove non-spectators who stayed disconnected past the grace period (see DISCONNECT_EJECT_MS).
         * Drops their characters from this match and clears ready/score keys for their token.
         */
        purgeDisconnectedDuelistsPastGrace() {
            const now = Date.now();
            let removed = false;
            this._disconnectPurgeHappened = false;
            game.players = game.players.filter(p => {
                if (!p || p.spectator) return true;
                if (p.connected === true) return true;
                if (typeof p.connected !== 'number') return true;
                if (now - p.connected <= DISCONNECT_EJECT_MS) return true;
                this.characters = this.characters.filter(c => c.parent !== p);
                if (p.token && p.token.id) {
                    delete this.playerReady[p.token.id];
                    if (this.scoreboard && Object.prototype.hasOwnProperty.call(this.scoreboard, p.token.id)) {
                        delete this.scoreboard[p.token.id];
                    }
                }
                try {
                    if (p.ws && typeof p.ws.close === 'function') p.ws.close();
                } catch (e) { /* noop */ }
                removed = true;
                return false;
            });
            this._disconnectPurgeHappened = removed;
            return removed;
        }

        /** True when the lone connected human should be snapped into an immediate CPU duel (no ready gate). */
        shouldSnapSoloHumanToCpuMatch() {
            const humans = this.getConnectedPlayers(false);
            if (humans.length !== 1) return false;
            const hid = humans[0].token.id;
            if (this.stage === 'inRound' && this.duelBotParent &&
                this.participantIds.length === 2 &&
                this.participantIds.includes(hid) &&
                this.participantIds.includes(FOR_HONOR_BOT_TOKEN_ID)) {
                return false;
            }
            return true;
        }

        /**
         * True if participantIds still lists a human token that is no longer in game.players
         * (e.g. ejected after disconnect grace). Skips the CPU token.
         */
        participantIdsReferenceRemovedPlayers() {
            if (!this.participantIds || this.participantIds.length === 0) return false;
            for (const pid of this.participantIds) {
                if (pid === FOR_HONOR_BOT_TOKEN_ID) continue;
                const stillInGame = game.players.some(pl => pl && pl.token && pl.token.id === pid);
                if (!stillInGame) return true;
            }
            return false;
        }

        handleNoHumanDuelists() {
            this.removeDuelBotFully();
            this.characters = [];
            this.participantIds = [];
            for (const k of Object.keys(this.scoreboard)) {
                delete this.scoreboard[k];
            }
            this.lastWinner = null;
            this.matchWinner = null;
            this.banner.visible = false;
            this.banner.headline = '';
            this.banner.subline = '';
            this.banner.untilTick = 0;
            this.stage = 'awaitPlayers';
        }

        /** After abandonment: fresh series vs CPU, skip ready/result screens. */
        transitionSoloHumanToImmediateCpuDuel() {
            const duelPlayers = this.getConnectedPlayers(false).slice(0, this.playerLimit.max);
            if (duelPlayers.length !== 1) return;
            this.removeDuelBotFully();
            for (const k of Object.keys(this.scoreboard)) {
                delete this.scoreboard[k];
            }
            this.participantIds = [];
            this.lastWinner = null;
            this.matchWinner = null;
            this.banner.visible = false;
            this.banner.headline = '';
            this.banner.subline = '';
            this.banner.untilTick = 0;
            this.resetReadyState();
            this.beginDuelRoundWithHumanDuelists(duelPlayers);
        }

        maybeTransitionSoloAfterAbandonment() {
            const humans = this.getConnectedPlayers(false);
            if (humans.length === 0) {
                this.handleNoHumanDuelists();
                return;
            }
            if (humans.length !== 1 || !this.shouldSnapSoloHumanToCpuMatch()) return;
            const rosterBroken = this.participantIdsReferenceRemovedPlayers();
            const soloAfterPurge = this._disconnectPurgeHappened === true;
            if (!rosterBroken && !soloAfterPurge) return;
            this.transitionSoloHumanToImmediateCpuDuel();
        }

        /**
         * Spawn humans + optional CPU, reset round, enter inRound. Used by ready gate and disconnect recovery.
         * @param {Array} duelPlayers Connected duelists (length 1 or 2).
         */
        beginDuelRoundWithHumanDuelists(duelPlayers) {
            if (duelPlayers.length === 1) {
                this.ensureDuelBotParent();
                this.participantIds = [duelPlayers[0].token.id, FOR_HONOR_BOT_TOKEN_ID];
            } else {
                this.removeDuelBotFully();
                this.participantIds = duelPlayers
                    .filter(player => player && player.token && player.token.id)
                    .map(player => player.token.id);
            }

            this.characters = this.characters.filter(chara => {
                if (!chara || !chara.parent || !chara.parent.token) return false;
                return this.participantIds.includes(chara.parent.token.id);
            });

            const images = ['img/sprites/jetbike', 'img/sprites/dark1', 'img/sprites/dark2'];
            for (let i = 0; i < duelPlayers.length; i++) {
                const player = duelPlayers[i];
                const hasCharacter = this.characters.some(
                    chara => chara.parent && chara.parent.token && chara.parent.token.id === player.token.id
                );
                if (hasCharacter) continue;
                this.characters.push(new Characters.Jetbike({
                    name: player.token.displayName,
                    team: i + 1,
                    parent: player,
                    active: true,
                    cleanup: false,
                    spawnPos: new Utils.Vect3(i * 100 + 100, i * 100 + 100, 0),
                    gfx: images[i % images.length]
                }));
            }
            if (this.duelBotParent) {
                const hasBot = this.characters.some(c => c.parent === this.duelBotParent);
                if (!hasBot) {
                    this.characters.push(new Characters.Jetbike({
                        name: 'Bot',
                        team: 2,
                        parent: this.duelBotParent,
                        active: true,
                        cleanup: false,
                        spawnPos: new Utils.Vect3(200, 200, 0),
                        gfx: 'img/sprites/dark2'
                    }));
                }
            }
            this.ensurePlayerScoreEntries();
            this.resetRound();
            this.stage = 'inRound';
        }

        updateDuelBotAI() {
            if (!this.duelBotParent || this.stage !== 'inRound') return;
            BotAI.stepDefaultBotAI(this, this.duelBotParent, { fireDist: 560, fireMod: 26 });
        }

        /**
         * Server-only mode progression: browser clients skip this (they receive replicated state).
         * Drives ready gates, round start, KO resolution, and clearing result screens.
         */
        step() {
            if (typeof window === 'undefined') {
                this.purgeDisconnectedDuelistsPastGrace();
                this.maybeTransitionSoloAfterAbandonment();
                this.maybeInterruptForSecondHuman();
                this.updateDuelBotAI();
            }
            super.step();
            // Client: physics/UI elsewhere; do not double-run mode logic.
            if (typeof window !== 'undefined') {
                return;
            }

            this.ensurePlayerScoreEntries();
            // --- Duelists pressed jump: lock humans (+ CPU if solo), spawn jetbikes, start round. ---
            if (this.stage === 'awaitReady') {
                this.handleReadyInputs();
                if (!this.areAllConnectedPlayersReady()) return;

                const duelPlayers = this.getConnectedPlayers(false).slice(0, this.playerLimit.max);
                this.beginDuelRoundWithHumanDuelists(duelPlayers);
                return;
            }

            // --- Combat phase: exactly one survivor means the other was eliminated; award the round. ---
            if (this.stage === 'inRound') {
                const activeCharacters = this.characters.filter(character => character.active);
                // Need two entrants and one KO; otherwise the duel is still ongoing (or not started).
                if (activeCharacters.length !== 1 || this.characters.length <= 1) return;

                const winningCharacter = activeCharacters[0];
                const winnerId = winningCharacter.parent && winningCharacter.parent.token ? winningCharacter.parent.token.id : null;
                if (!winnerId) return;

                this.lastWinner = winningCharacter.name;
                this.scoreboard[winnerId] = (this.scoreboard[winnerId] || 0) + 1;
                this.resetReadyState();
                // Freeze combat until the next ready gate after players acknowledge the banner.
                this.setCharactersCombatEnabled(false);

                if (this.scoreboard[winnerId] >= this.winsToTakeSeries) {
                    this.matchWinner = winningCharacter.name;
                    this.showBanner(`${this.matchWinner} wins the match`, `Score ${this.buildScoreLine()}`, 180);
                    // Fresh series for a possible rematch / next match setup.
                    for (const key of Object.keys(this.scoreboard)) {
                        this.scoreboard[key] = 0;
                    }
                    this.stage = 'matchResult';
                } else {
                    this.showBanner(`${this.lastWinner} wins round`, `Score ${this.buildScoreLine()}`, 150);
                    this.stage = 'roundResult';
                }
                return;
            }

            // --- Result pause: both must ready again before the next countdown / round. ---
            if (this.stage === 'roundResult' || this.stage === 'matchResult') {
                this.handleReadyInputs();
                // Keep result stage active so non-ready players still see the banner.
                // Once both are ready, move forward.
                if (!this.areAllConnectedPlayersReady()) return;
                this.banner.visible = false;
                this.banner.headline = '';
                this.banner.subline = '';
                this.stage = 'awaitReady';
            }
        }

        /**
         * Client (and server headless if called): world draw plus For Honor HUD overlays.
         * Uses global ctx / game from the engine.
         */
        draw() {
            // Lobby: draw map only before full match.update draws characters.
            if (this.stage === 'awaitPlayers') {
                if (this.map) {
                    this.map.draw();
                    if (game && typeof game.clearHudCanvas === 'function') game.clearHudCanvas();
                } else {
                    super.draw();
                }
            } else {
                super.draw();
            }

            const drawOverlays = () => {
            // While on result stages, if this client has readied, show the ready panel instead of the dimmed banner.
            const localReadyFromResult = (this.stage === 'roundResult' || this.stage === 'matchResult') && (typeof window !== 'undefined' && game.player && game.player.token && game.player.token.id && !!this.playerReady[game.player.token.id]);

            // Ready-up panel: lobby, pre-round, or local player waiting on others after they readied on the result screen.
            if (this.stage === 'awaitPlayers' || this.stage === 'awaitReady' || localReadyFromResult) {
                const panelW = 540;
                const panelH = 280;
                const x = (game.gameView.w / 2) - (panelW / 2);
                const y = (game.gameView.h / 2) - (panelH / 2);
                const connectedPlayers = this.getConnectedPlayers(false);
                const spectatorCount = this.getConnectedPlayers(true).length - connectedPlayers.length;

                // Panel frame and title.
                ctx.fillStyle = "rgba(0,0,0,0.58)";
                ctx.fillRect(x, y, panelW, panelH);
                ctx.strokeStyle = "#FFFFFF";
                ctx.lineWidth = 2;
                ctx.strokeRect(x, y, panelW, panelH);

                ctx.textAlign = "center";
                ctx.fillStyle = "#FFFFFF";
                ctx.font = "28px Jura";
                ctx.fillText("For Honor - Ready Up", x + (panelW / 2), y + 42);
                ctx.font = "18px Jura";
                ctx.fillText(this.getInputPromptText(), x + (panelW / 2), y + 72);
                ctx.font = "16px Jura";
                ctx.fillText(`First to ${this.winsToTakeSeries} wins`, x + (panelW / 2), y + 94);
                if (spectatorCount > 0) {
                    ctx.fillText(`Spectators: ${spectatorCount}`, x + (panelW / 2), y + 112);
                }

                // Two slots: show connection + ready state per duel slot.
                const slotW = 230;
                const slotH = 130;
                const slotY = y + 130;
                for (let i = 0; i < this.playerLimit.max; i++) {
                    const slotX = x + 36 + (i * (slotW + 12));
                    const cpuSlot = i === 1 && this.participantIds && this.participantIds.includes(FOR_HONOR_BOT_TOKEN_ID) && connectedPlayers.length < 2;
                    const slotPlayer = cpuSlot ? null : connectedPlayers[i];
                    const pid = slotPlayer && slotPlayer.token ? slotPlayer.token.id : null;
                    const isReady = cpuSlot ? true : !!(pid && this.playerReady[pid]);

                    ctx.fillStyle = "rgba(0,0,0,0.55)";
                    ctx.fillRect(slotX, slotY, slotW, slotH);
                    ctx.strokeStyle = isReady ? "#4CD964" : "#FFFFFF";
                    ctx.lineWidth = 2;
                    ctx.strokeRect(slotX, slotY, slotW, slotH);

                    ctx.fillStyle = "#FFFFFF";
                    ctx.font = "18px Jura";
                    const playerName = cpuSlot ? "Bot" : (slotPlayer ? slotPlayer.token.displayName : "Waiting...");
                    ctx.fillText(playerName, slotX + (slotW / 2), slotY + 44);

                    ctx.font = "16px Jura";
                    if (cpuSlot) {
                        ctx.fillStyle = "#4CD964";
                        ctx.fillText("CPU", slotX + (slotW / 2), slotY + 76);
                        ctx.fillStyle = "#FFFFFF";
                    } else if (!slotPlayer) {
                        ctx.fillText("Not Connected", slotX + (slotW / 2), slotY + 76);
                    } else if (isReady) {
                        ctx.fillStyle = "#4CD964";
                        ctx.fillText("Ready", slotX + (slotW / 2), slotY + 76);
                        ctx.fillStyle = "#FFFFFF";
                    } else {
                        ctx.fillText("Connected", slotX + (slotW / 2), slotY + 76);
                        ctx.fillText("Waiting to ready", slotX + (slotW / 2), slotY + 102);
                    }
                }
            }
            // Full-screen dim + headline/subline while results are showing (this client not yet readied).
            if ((this.stage === 'roundResult' || this.stage === 'matchResult') && !localReadyFromResult) {
                ctx.fillStyle = "rgba(0,0,0,0.5)";
                ctx.fillRect(0, 0, game.gameView.w, game.gameView.h);
                ctx.textAlign = "center";
                ctx.fillStyle = "#FFFFFF";
                ctx.font = "40px Jura";
                ctx.fillText(this.banner.headline || "Round Over", game.gameView.w / 2, game.gameView.h / 2 - 70);
                ctx.font = "22px Jura";
                ctx.fillText(this.banner.subline || this.buildScoreLine(), game.gameView.w / 2, game.gameView.h / 2 - 24);
                ctx.font = "18px Jura";
                ctx.fillText(this.getInputPromptText(), game.gameView.w / 2, game.gameView.h / 2 + 24);
            } else if (this.stage === 'inRound') {
                // Compact score strip during combat (no full-screen overlay).
                const scoreLine = this.buildScoreLine();
                if (scoreLine) {
                    const pad = 10;
                    ctx.font = "16px Jura";
                    const textW = ctx.measureText(scoreLine).width + (pad * 2);
                    const bx = (game.gameView.w / 2) - (textW / 2);
                    const by = 14;
                    ctx.fillStyle = "rgba(0,0,0,0.48)";
                    ctx.fillRect(bx, by, textW, 32);
                    ctx.strokeStyle = "#FFFFFF";
                    ctx.lineWidth = 1;
                    ctx.strokeRect(bx, by, textW, 32);
                    ctx.fillStyle = "#FFFFFF";
                    ctx.textAlign = "center";
                    ctx.fillText(scoreLine, game.gameView.w / 2, by + 21);
                }
            }

            // Pause overlay on top of everything when game.paused.
            if (this.menu && game.paused) {
                this.menu.step();
                this.menu.draw();
            }
            };

            if (game && typeof game.withHudContext === 'function') {
                game.withHudContext(drawOverlays);
            } else {
                drawOverlays();
            }
        }
    }

    // Expose on Matches for game.js to instantiate by match type.
    Matches.ForHonorMP = ForHonorMP;

    return Matches;
}));