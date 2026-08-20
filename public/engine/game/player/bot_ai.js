(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.BotAI = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {

    function mkButton() {
        return { current: 0, last: 0 };
    }

    /**
     * @param {{ includeAimZ?: boolean }} [options]
     */
    function createBotController(options) {
        const ctrl = {
            buttons: {
                start: mkButton(), moveLeft: mkButton(), moveRight: mkButton(), moveUp: mkButton(), moveDown: mkButton(),
                jump: mkButton(), brake: mkButton(), boost: mkButton(), fire: mkButton(), altfire: mkButton(),
                inventory1: mkButton(), inventory2: mkButton(), throw: mkButton(),
                weaponPrevious: mkButton(), weaponNext: mkButton(), selectLeft: mkButton(), selectRight: mkButton()
            },
            aimX: 0,
            aimY: 0
        };
        if (options && options.includeAimZ) {
            ctrl.aimZ = 0;
        }
        return ctrl;
    }

    function copyButtonsCurrentToLast(ctrl) {
        if (!ctrl || !ctrl.buttons) return;
        for (const key of Object.keys(ctrl.buttons)) {
            const b = ctrl.buttons[key];
            if (b && Object.prototype.hasOwnProperty.call(b, 'last')) b.last = b.current;
        }
    }

    function distSq(ax, ay, bx, by) {
        const dx = bx - ax;
        const dy = by - ay;
        return dx * dx + dy * dy;
    }

    function getBlocks(match) {
        return (match && match.map && Array.isArray(match.map.blocks)) ? match.map.blocks : [];
    }

    /** Reserve clips for ballistic / plasma (undefined-safe). */
    function reserveClips(botChar, ammoType) {
        if (!botChar || !botChar.ammo || !ammoType) return 0;
        const n = botChar.ammo[ammoType];
        return typeof n === 'number' ? n : 0;
    }

    /** Gun magazine has no shots (reload briefly sets ammo before tick completes). */
    function gunMagazineDry(it) {
        if (!it || (it.type !== 'ballistic' && it.type !== 'plasma')) return false;
        return (it.ammo || 0) <= 0;
    }

    function gunCanReloadOrShoot(it, botChar) {
        if (!it || (it.type !== 'ballistic' && it.type !== 'plasma')) return false;
        if ((it.ammo || 0) > 0) return true;
        if (it.reloading) return true;
        return reserveClips(botChar, it.type) > 0;
    }

    /**
     * Prefer a ranged weapon that can fire or reload; otherwise sword if present.
     * Avoids stuck-on-empty-slot when inventory length vs item index mismatches.
     */
    function switchToUsableWeapon(inv, botChar) {
        if (!inv.length) return;
        let cur = inv[botChar.item];
        if (cur && gunCanReloadOrShoot(cur, botChar)) return;
        for (let i = 0; i < inv.length; i++) {
            const it = inv[i];
            if (gunCanReloadOrShoot(it, botChar)) {
                botChar.item = i;
                return;
            }
        }
        const si = inv.findIndex(it => it && it.weapon === 'sword');
        if (si >= 0) botChar.item = si;
    }

    function clampItemIndex(botChar, inv) {
        if (!inv.length) return;
        if (!Number.isFinite(botChar.item) || botChar.item < 0 || botChar.item >= inv.length) {
            botChar.item = 0;
        }
    }

    function findNearestEnemy(match, botChar) {
        let enemy = null;
        let best = Infinity;
        for (const c of match.characters) {
            if (!c || !c.active || c === botChar) continue;
            if (c.team === botChar.team) continue;
            const d = distSq(botChar.HB.pos.x, botChar.HB.pos.y, c.HB.pos.x, c.HB.pos.y);
            if (d < best) {
                best = d;
                enemy = c;
            }
        }
        return enemy;
    }

    function closestPickup(match, botChar, pred) {
        let best = null;
        let bestD = Infinity;
        for (const b of getBlocks(match)) {
            if (!b || b.active === false) continue;
            if (!pred(b)) continue;
            const bx = b.HB && b.HB.pos ? b.HB.pos.x : (b.spawnPos && b.spawnPos.x);
            const by = b.HB && b.HB.pos ? b.HB.pos.y : (b.spawnPos && b.spawnPos.y);
            if (typeof bx !== 'number' || typeof by !== 'number') continue;
            const d = distSq(botChar.HB.pos.x, botChar.HB.pos.y, bx, by);
            if (d < bestD) {
                bestD = d;
                best = b;
            }
        }
        return best;
    }

    function inventoryGuns(inv) {
        return inv.map((it, i) => ({ it, i })).filter(x =>
            x.it && (x.it.type === 'ballistic' || x.it.type === 'plasma'));
    }

    function hasSword(inv) {
        return inv.some(it => it && it.weapon === 'sword');
    }

    function swordPP(inv) {
        const s = inv.find(it => it && it.weapon === 'sword');
        return s && s.ppCost != null ? s.ppCost : 40;
    }

    function applySteerToward(ctrl, botChar, targetX, targetY, ticks, opts) {
        const dx = targetX - botChar.HB.pos.x;
        const dy = targetY - botChar.HB.pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const moveTh = (opts && opts.moveThreshold != null) ? opts.moveThreshold : 90;
        ctrl.buttons.moveLeft.current = dx < -moveTh ? 1 : 0;
        ctrl.buttons.moveRight.current = dx > moveTh ? 1 : 0;
        ctrl.buttons.moveUp.current = dy < -moveTh ? 1 : 0;
        ctrl.buttons.moveDown.current = dy > moveTh ? 1 : 0;
        ctrl.aimX = dx / dist;
        ctrl.aimY = dy / dist;
        if (Object.prototype.hasOwnProperty.call(ctrl, 'aimZ')) ctrl.aimZ = 0;
        ctrl.buttons.jump.current = (dist < 260 && (ticks % 120) < 10) ? 1 : 0;
        ctrl.buttons.boost.current = (dist > 420 && ticks % 90 === 0) ? 1 : 0;
    }

    function applyFleeFrom(ctrl, botChar, ex, ey, ticks) {
        const dx = ex - botChar.HB.pos.x;
        const dy = ey - botChar.HB.pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const moveTh = 90;
        ctrl.buttons.moveLeft.current = dx > moveTh ? 1 : 0;
        ctrl.buttons.moveRight.current = dx < -moveTh ? 1 : 0;
        ctrl.buttons.moveUp.current = dy > moveTh ? 1 : 0;
        ctrl.buttons.moveDown.current = dy < -moveTh ? 1 : 0;
        ctrl.aimX = -dx / dist;
        ctrl.aimY = -dy / dist;
        if (Object.prototype.hasOwnProperty.call(ctrl, 'aimZ')) ctrl.aimZ = 0;
        ctrl.buttons.jump.current = (dist < 320 && (ticks % 100) < 12) ? 1 : 0;
        ctrl.buttons.boost.current = (dist < 500 && ticks % 70 === 0) ? 1 : 0;
    }

    function applyCombatBaseline(ctrl, botChar, enemy, ticks, opts) {
        const fireDist = (opts && opts.fireDist) || 580;
        const fireMod = (opts && opts.fireMod) || 26;
        const dx = enemy.HB.pos.x - botChar.HB.pos.x;
        const dy = enemy.HB.pos.y - botChar.HB.pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        applySteerToward(ctrl, botChar, enemy.HB.pos.x, enemy.HB.pos.y, ticks, opts);
        ctrl.buttons.fire.current = (dist < fireDist && ticks % fireMod === 0) ? 1 : 0;
    }

    function clearAllButtons(ctrl) {
        if (!ctrl || !ctrl.buttons) return;
        for (const key of Object.keys(ctrl.buttons)) {
            if (ctrl.buttons[key]) ctrl.buttons[key].current = 0;
        }
    }

    /**
     * When equipped gun cannot shoot or reload: seek ammo, sword melee, or throw + weapon pickup.
     * Catches edge cases where earlier gates did not run (e.g. wrong item slot).
     */
    function tryHandleDryEquippedRanged(match, botChar, ctrl, inv, guns, enemy, ticks, fireDist, fireMod) {
        const eq = inv[botChar.item];
        if (!eq || eq.weapon === 'sword') return false;
        if (eq.type !== 'ballistic' && eq.type !== 'plasma') return false;
        if (gunCanReloadOrShoot(eq, botChar)) return false;
        if (!enemy) return false;

        const gunTypes = {};
        for (const { it } of guns) {
            if (it.type === 'ballistic' || it.type === 'plasma') gunTypes[it.type] = true;
        }
        const needBallistic = !!gunTypes.ballistic;
        const needPlasma = !!gunTypes.plasma;

        const ammoPick = closestPickup(match, botChar, b => {
            const st = b.subtype || b.ammoType || '';
            if (needBallistic && (st === 'ammo_ballistic' || b.type === 'ammo_ballistic')) return true;
            if (needPlasma && (st === 'ammo_plasma' || b.type === 'ammo_plasma')) return true;
            return false;
        });
        if (ammoPick) {
            const ax = ammoPick.HB && ammoPick.HB.pos ? ammoPick.HB.pos.x : ammoPick.spawnPos.x;
            const ay = ammoPick.HB && ammoPick.HB.pos ? ammoPick.HB.pos.y : ammoPick.spawnPos.y;
            applySteerToward(ctrl, botChar, ax, ay, ticks);
            ctrl.buttons.fire.current = 0;
            return true;
        }

        const si = inv.findIndex(it => it && it.weapon === 'sword');
        if (si >= 0) {
            botChar.item = si;
            if (botChar.pp < swordPP(inv)) {
                applyFleeFrom(ctrl, botChar, enemy.HB.pos.x, enemy.HB.pos.y, ticks);
                ctrl.buttons.fire.current = 0;
                return true;
            }
            applyCombatBaseline(ctrl, botChar, enemy, ticks, { fireDist, fireMod: Math.min(fireMod, 18) });
            return true;
        }

        const loadedWeapon = closestPickup(match, botChar, b => {
            if (b.type !== 'weapon' || !b.item) return false;
            return (b.item.ammo || 0) > 0;
        });
        if (loadedWeapon && inv.length > 0) {
            const wx = loadedWeapon.HB && loadedWeapon.HB.pos ? loadedWeapon.HB.pos.x : loadedWeapon.spawnPos.x;
            const wy = loadedWeapon.HB && loadedWeapon.HB.pos ? loadedWeapon.HB.pos.y : loadedWeapon.spawnPos.y;
            applySteerToward(ctrl, botChar, wx, wy, ticks);
            ctrl.buttons.fire.current = 0;
            ctrl.buttons.throw.last = 0;
            ctrl.buttons.throw.current = 1;
            return true;
        }
        return false;
    }

    /**
     * @param {*} match
     * @param {*} botParent — Players.Bot with .controller and optionally .character
     * @param {{ includeAimZ?: boolean, fireDist?: number, fireMod?: number }} [options]
     */
    function stepDefaultBotAI(match, botParent, options) {
        if (typeof window !== 'undefined') return;
        if (!match || !botParent || !botParent.controller) return;
        const stageOk = match.stage === 'inRound';
        if (!stageOk) return;

        const botChar = botParent.character || match.characters.find(c => c.parent === botParent);
        if (!botChar || !botChar.active) return;

        const ctrl = botParent.controller;
        const ticks = match.time ? match.time.ticks : 0;
        const opts = options || {};
        const fireDist = opts.fireDist != null ? opts.fireDist : 580;
        const fireMod = opts.fireMod != null ? opts.fireMod : 26;

        copyButtonsCurrentToLast(ctrl);

        let inv = (botChar.inventory || []).filter(Boolean);
        clampItemIndex(botChar, inv);

        const enemy = findNearestEnemy(match, botChar);

        // --- 1: Low HP → closest health pickup ---
        if (botChar.hp_max > 0 && botChar.hp / botChar.hp_max < 0.5) {
            const hpPick = closestPickup(match, botChar, b =>
                b.subtype === 'health' || b.type === 'health');
            if (hpPick) {
                const hx = hpPick.HB && hpPick.HB.pos ? hpPick.HB.pos.x : hpPick.spawnPos.x;
                const hy = hpPick.HB && hpPick.HB.pos ? hpPick.HB.pos.y : hpPick.spawnPos.y;
                applySteerToward(ctrl, botChar, hx, hy, ticks);
                ctrl.buttons.fire.current = 0;
                return;
            }
        }

        // --- 2–3: Unarmed → weapon pickup, else flee if no weapon spawns ---
        if (inv.length === 0) {
            const weapPick = closestPickup(match, botChar, b => b.type === 'weapon');
            if (weapPick) {
                const wx = weapPick.HB && weapPick.HB.pos ? weapPick.HB.pos.x : weapPick.spawnPos.x;
                const wy = weapPick.HB && weapPick.HB.pos ? weapPick.HB.pos.y : weapPick.spawnPos.y;
                applySteerToward(ctrl, botChar, wx, wy, ticks);
                ctrl.buttons.fire.current = 0;
                return;
            }
            if (enemy) {
                applyFleeFrom(ctrl, botChar, enemy.HB.pos.x, enemy.HB.pos.y, ticks);
                ctrl.buttons.fire.current = 0;
                return;
            }
            clearAllButtons(ctrl);
            return;
        }

        switchToUsableWeapon(inv, botChar);
        inv = (botChar.inventory || []).filter(Boolean);
        clampItemIndex(botChar, inv);

        // --- 4: Reload from reserves (pulse fire; magazine empty, clips available) ---
        const guns = inventoryGuns(inv);
        let reloadSlot = -1;
        const preferred = inv[botChar.item];
        if (preferred && (preferred.type === 'ballistic' || preferred.type === 'plasma') &&
            (preferred.ammo || 0) <= 0 && !preferred.reloading &&
            reserveClips(botChar, preferred.type) > 0) {
            reloadSlot = botChar.item;
        }
        if (reloadSlot < 0) {
            for (const { it, i } of guns) {
                if ((it.ammo || 0) <= 0 && !it.reloading && reserveClips(botChar, it.type) > 0) {
                    reloadSlot = i;
                    break;
                }
            }
        }
        if (reloadSlot >= 0 && inv[reloadSlot] && !inv[reloadSlot].reloading) {
            botChar.item = reloadSlot;
            if (enemy) {
                const dx = enemy.HB.pos.x - botChar.HB.pos.x;
                const dy = enemy.HB.pos.y - botChar.HB.pos.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                ctrl.aimX = dx / dist;
                ctrl.aimY = dy / dist;
            } else {
                ctrl.aimX = 1;
                ctrl.aimY = 0;
            }
            if (Object.prototype.hasOwnProperty.call(ctrl, 'aimZ')) ctrl.aimZ = 0;
            ctrl.buttons.moveLeft.current = 0;
            ctrl.buttons.moveRight.current = 0;
            ctrl.buttons.moveUp.current = 0;
            ctrl.buttons.moveDown.current = 0;
            ctrl.buttons.jump.current = 0;
            ctrl.buttons.boost.current = 0;
            ctrl.buttons.throw.current = 0;
            ctrl.buttons.fire.last = 0;
            ctrl.buttons.fire.current = 1;
            return;
        }

        const allGunMagsDry = guns.length > 0 && guns.every(({ it }) => gunMagazineDry(it));
        const gunTypes = {};
        for (const { it } of guns) {
            if (it.type === 'ballistic' || it.type === 'plasma') gunTypes[it.type] = true;
        }
        const noReserveForGuns = guns.length > 0 && guns.every(({ it }) =>
            reserveClips(botChar, it.type) <= 0);

        // --- 5: No clips left → closest ammo pickup for carried weapon types ---
        if (allGunMagsDry && noReserveForGuns) {
            const needBallistic = !!gunTypes.ballistic;
            const needPlasma = !!gunTypes.plasma;
            const ammoPick = closestPickup(match, botChar, b => {
                const st = b.subtype || b.ammoType || '';
                if (needBallistic && (st === 'ammo_ballistic' || b.type === 'ammo_ballistic')) return true;
                if (needPlasma && (st === 'ammo_plasma' || b.type === 'ammo_plasma')) return true;
                return false;
            });
            if (ammoPick) {
                const ax = ammoPick.HB && ammoPick.HB.pos ? ammoPick.HB.pos.x : ammoPick.spawnPos.x;
                const ay = ammoPick.HB && ammoPick.HB.pos ? ammoPick.HB.pos.y : ammoPick.spawnPos.y;
                applySteerToward(ctrl, botChar, ax, ay, ticks);
                ctrl.buttons.fire.current = 0;
                return;
            }

            // --- 6: No ammo on map + sword → melee ---
            if (hasSword(inv)) {
                const si = inv.findIndex(it => it && it.weapon === 'sword');
                if (si >= 0) botChar.item = si;
                if (enemy) {
                    if (botChar.pp < swordPP(inv)) {
                        applyFleeFrom(ctrl, botChar, enemy.HB.pos.x, enemy.HB.pos.y, ticks);
                        ctrl.buttons.fire.current = 0;
                        return;
                    }
                    applyCombatBaseline(ctrl, botChar, enemy, ticks, { fireDist, fireMod: Math.min(fireMod, 18) });
                } else {
                    clearAllButtons(ctrl);
                }
                return;
            }

            // --- 7: No sword → drop current weapon, seek loaded weapon pickup ---
            const loadedWeapon = closestPickup(match, botChar, b => {
                if (b.type !== 'weapon' || !b.item) return false;
                return (b.item.ammo || 0) > 0;
            });
            if (loadedWeapon && inv.length > 0) {
                const wx = loadedWeapon.HB && loadedWeapon.HB.pos ? loadedWeapon.HB.pos.x : loadedWeapon.spawnPos.x;
                const wy = loadedWeapon.HB && loadedWeapon.HB.pos ? loadedWeapon.HB.pos.y : loadedWeapon.spawnPos.y;
                applySteerToward(ctrl, botChar, wx, wy, ticks);
                ctrl.buttons.fire.current = 0;
                ctrl.buttons.throw.last = 0;
                ctrl.buttons.throw.current = 1;
                return;
            }
        }

        // Equipped ranged weapon is dead: avoid blindly rushing (handles wrong slot / missed gates)
        if (tryHandleDryEquippedRanged(match, botChar, ctrl, inv, guns, enemy, ticks, fireDist, fireMod)) {
            return;
        }

        // Combat fallback
        if (enemy) {
            const eq = inv[botChar.item];
            if (eq && eq.weapon === 'sword' && botChar.pp < swordPP(inv)) {
                applyFleeFrom(ctrl, botChar, enemy.HB.pos.x, enemy.HB.pos.y, ticks);
                ctrl.buttons.fire.current = 0;
                return;
            }
            applyCombatBaseline(ctrl, botChar, enemy, ticks, { fireDist, fireMod });
            return;
        }

        clearAllButtons(ctrl);
    }

    return {
        mkButton,
        createBotController,
        copyButtonsCurrentToLast,
        stepDefaultBotAI
    };
}));
