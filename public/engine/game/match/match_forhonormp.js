(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['Characters', 'Utils', 'Maps', 'Matches', 'Items', 'Powerups'], factory);
    } else if (typeof module === 'object' && module.exports) {
        // Nodejs
        const Characters = require('./character.js');
        const Utils = require('../../utils.js');
        const Maps = require('./map/map.js');
        const Matches = require('./match.js');
        const Items = require('./item.js');
        const Powerups = require('./block/powerup.js');
        module.exports = factory(Characters, Utils, Maps, Matches, Items, Powerups);
    } else {
        // Browser globals (root is window)
        root.ForHonorMP = factory(root.Characters, root.Utils, root.Maps, root.Matches, root.Items, root.Powerups);
    }
}(typeof self !== 'undefined' ? self : this, function (Characters, Utils, Maps, Matches, Items, Powerups) {
    /*
     #######                  #     #
     #        ####  #####     #     #  ####  #    #  ####  #####
     #       #    # #    #    #     # #    # ##   # #    # #    #
     #####   #    # #    #    ####### #    # # #  # #    # #    #
     #       #    # #####     #     # #    # #  # # #    # #####
     #       #    # #   #     #     # #    # #   ## #    # #   #
     #        ####  #    #    #     #  ####  #    #  ####  #    #
    
    */
    class ForHonorMP extends Matches.Match {
        constructor(options) {
            super(options);
            this.setup();
            this.initializeModeState();
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
            if (typeof window !== 'undefined' && typeof Menus !== 'undefined') {
                this.menu = this.menu || new Menus.Menu_Pause([], new Utils.Rect(0, 0, 220, 170));
            }
        }

        initializeModeState() {
            this.roundsTotal = 3;
            this.winsToTakeSeries = Math.floor(this.roundsTotal / 2) + 1;
            this.scoreboard = {};
            this.playerReady = {};
            this.participantIds = [];
            this.banner = {
                visible: false,
                headline: '',
                subline: '',
                untilTick: 0
            };
            this.lastWinner = null;
            this.matchWinner = null;
            this.stage = 'awaitPlayers';
        }

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

        getConnectedPlayers(includeSpectators = false) {
            return game.players.filter(player => {
                if (!player || player.connected !== true) return false;
                if (!includeSpectators && player.spectator) return false;
                return true;
            });
        }

        clearTransientState() {
            this.lastWinner = null;
            this.matchWinner = null;
            this.banner.visible = false;
            this.banner.headline = '';
            this.banner.subline = '';
            this.banner.untilTick = 0;
        }

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

        resetReadyState() {
            for (const player of game.players) {
                if (!player || !player.token || !player.token.id) continue;
                if (player.spectator) continue;
                this.playerReady[player.token.id] = false;
                player.ready = false;
            }
        }

        setup() {
            this.map = new Maps.Map_Deathbox();
            this.name = "For Honor";
            this.description = "A duel to the death.";
            this.playerLimit = { min: 2, max: 2 };
        }

        awaitPlayers() {
            const connectedPlayers = this.getConnectedPlayers(false);
            if (connectedPlayers.length < this.playerLimit.min) {
                return;
            }
            this.resetReadyState();
            this.setCharactersCombatEnabled(false);
            this.stage = 'awaitReady';
        }

        ensureParticipantsAndCharacters() {
            const duelPlayers = this.getConnectedPlayers(false).slice(0, this.playerLimit.max);
            this.participantIds = duelPlayers
                .filter(player => player && player.token && player.token.id)
                .map(player => player.token.id);

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
            this.ensurePlayerScoreEntries();
        }

        resetRound() {
            super.reset();
            this.clearTransientState();

            this.map.blocks = this.map.blocks.filter(function (el) { return el.type === 'block'; });

            for (let i = 0; i < this.characters.length; i++) {
                const chara = this.characters[i];
                chara.active = true;
                chara.visible = true;
                chara.solid = true;
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

        resetSeriesScores() {
            for (const key of Object.keys(this.scoreboard)) {
                this.scoreboard[key] = 0;
            }
        }

        showBanner(headline, subline, durationTicks) {
            this.banner.visible = true;
            this.banner.headline = headline;
            this.banner.subline = subline || '';
            this.banner.untilTick = this.time.ticks + durationTicks;
        }

        resolveWinnerAndScore() {
            const activeCharacters = this.characters.filter(character => character.active);
            if (activeCharacters.length !== 1 || this.characters.length <= 1) return;

            const winningCharacter = activeCharacters[0];
            const winnerId = winningCharacter.parent && winningCharacter.parent.token ? winningCharacter.parent.token.id : null;
            if (!winnerId) return;

            this.lastWinner = winningCharacter.name;
            this.scoreboard[winnerId] = (this.scoreboard[winnerId] || 0) + 1;
            this.resetReadyState();
            this.setCharactersCombatEnabled(false);

            if (this.scoreboard[winnerId] >= this.winsToTakeSeries) {
                this.matchWinner = winningCharacter.name;
                this.showBanner(`${this.matchWinner} wins the match`, `Score ${this.buildScoreLine()}`, 180);
                this.resetSeriesScores();
                this.stage = 'matchResult';
            } else {
                this.showBanner(`${this.lastWinner} wins round`, `Score ${this.buildScoreLine()}`, 150);
                this.stage = 'roundResult';
            }
        }

        handleReadyInputs() {
            for (const player of this.getConnectedPlayers(false)) {
                if (!player || !player.controller || !player.token || !player.token.id) continue;
                const fire = player.controller.buttons && player.controller.buttons.fire;
                if (fire && fire.current && !fire.last) {
                    this.playerReady[player.token.id] = true;
                    player.ready = true;
                }
            }
        }

        areAllConnectedPlayersReady() {
            const connectedPlayers = this.getConnectedPlayers(false);
            if (connectedPlayers.length < this.playerLimit.min) return false;
            for (const player of connectedPlayers) {
                const pid = player && player.token ? player.token.id : null;
                if (!pid || !this.playerReady[pid]) return false;
            }
            return true;
        }

        isAnyConnectedPlayerReady() {
            const connectedPlayers = this.getConnectedPlayers(false);
            for (const player of connectedPlayers) {
                const pid = player && player.token ? player.token.id : null;
                if (pid && this.playerReady[pid]) return true;
            }
            return false;
        }

        isLocalPlayerReady() {
            if (typeof window === 'undefined') return false;
            if (!game.player || !game.player.token || !game.player.token.id) return false;
            return !!this.playerReady[game.player.token.id];
        }

        buildScoreLine() {
            const parts = [];
            for (const pid of this.participantIds) {
                if (!pid) continue;
                const player = game.players.find(p => p && p.token && p.token.id === pid);
                const name = player && player.token ? player.token.displayName : 'Player';
                parts.push(`${name}: ${this.scoreboard[pid] || 0}`);
            }
            return parts.join('  |  ');
        }

        getInputPromptText() {
            if (typeof window !== 'undefined' && game.player && game.player.spectator) {
                return 'Press Fire to switch camera';
            }
            return 'Press fire to ready';
        }

        maybeStartRoundFromReady() {
            this.handleReadyInputs();
            if (!this.areAllConnectedPlayersReady()) return;
            this.ensureParticipantsAndCharacters();
            this.resetRound();
            this.stage = 'inRound';
        }

        maybeAdvanceFromResult() {
            this.handleReadyInputs();
            // Keep result stage active so non-ready players still see the banner.
            // Once both are ready, move forward.
            if (!this.areAllConnectedPlayersReady()) return;
            this.banner.visible = false;
            this.banner.headline = '';
            this.banner.subline = '';
            this.stage = 'awaitReady';
        }

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
                matchWinner: this.matchWinner
            };
        }

        step() {
            super.step();
            if (typeof window !== 'undefined') {
                return;
            }

            this.ensurePlayerScoreEntries();
            if (this.stage === 'awaitReady') {
                this.maybeStartRoundFromReady();
                return;
            }

            if (this.stage === 'inRound') {
                this.resolveWinnerAndScore();
                return;
            }

            if (this.stage === 'roundResult' || this.stage === 'matchResult') {
                this.maybeAdvanceFromResult();
            }
        }

        drawWaitingSlots() {
            const panelW = 540;
            const panelH = 280;
            const x = (game.gameView.w / 2) - (panelW / 2);
            const y = (game.gameView.h / 2) - (panelH / 2);
            const connectedPlayers = this.getConnectedPlayers(false);
            const spectatorCount = this.getConnectedPlayers(true).length - connectedPlayers.length;

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

            const slotW = 230;
            const slotH = 130;
            const slotY = y + 130;
            for (let i = 0; i < this.playerLimit.max; i++) {
                const slotX = x + 36 + (i * (slotW + 12));
                const slotPlayer = connectedPlayers[i];
                const pid = slotPlayer && slotPlayer.token ? slotPlayer.token.id : null;
                const isReady = !!(pid && this.playerReady[pid]);

                ctx.fillStyle = "rgba(0,0,0,0.55)";
                ctx.fillRect(slotX, slotY, slotW, slotH);
                ctx.strokeStyle = isReady ? "#4CD964" : "#FFFFFF";
                ctx.lineWidth = 2;
                ctx.strokeRect(slotX, slotY, slotW, slotH);

                ctx.fillStyle = "#FFFFFF";
                ctx.font = "18px Jura";
                const playerName = slotPlayer ? slotPlayer.token.displayName : "Waiting...";
                ctx.fillText(playerName, slotX + (slotW / 2), slotY + 44);

                ctx.font = "16px Jura";
                if (!slotPlayer) {
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

        drawBanner() {
            if (!this.banner.visible && this.stage !== 'roundResult' && this.stage !== 'matchResult') return;

            if (this.banner.untilTick && this.time.ticks > this.banner.untilTick && this.stage === 'inRound') {
                this.banner.visible = false;
                return;
            }

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
        }

        drawScoreStrip() {
            if (this.stage !== 'inRound') return;
            const scoreLine = this.buildScoreLine();
            if (!scoreLine) return;

            const pad = 10;
            ctx.font = "16px Jura";
            const textW = ctx.measureText(scoreLine).width + (pad * 2);
            const x = (game.gameView.w / 2) - (textW / 2);
            const y = 14;
            const h = 32;
            ctx.fillStyle = "rgba(0,0,0,0.48)";
            ctx.fillRect(x, y, textW, h);
            ctx.strokeStyle = "#FFFFFF";
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, textW, h);
            ctx.fillStyle = "#FFFFFF";
            ctx.textAlign = "center";
            ctx.fillText(scoreLine, game.gameView.w / 2, y + 21);
        }

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

            const localReadyFromResult = (this.stage === 'roundResult' || this.stage === 'matchResult') && this.isLocalPlayerReady();

            if (this.stage === 'awaitPlayers' || this.stage === 'awaitReady' || localReadyFromResult) {
                this.drawWaitingSlots();
            }
            if ((this.stage === 'roundResult' || this.stage === 'matchResult') && !localReadyFromResult) {
                this.drawBanner();
            } else if (this.stage === 'inRound') {
                this.drawScoreStrip();
            }

            if (this.menu && game.paused) {
                this.menu.step();
                this.menu.draw();
            }
        }
    }

    Matches.ForHonorMP = ForHonorMP;

    return Matches;
}));