
// app/engine/combat.js
// Patch: respect obscuring zones (fog) and enforce concentration checks on damage.

import { hasCondition } from "../data/conditions.js";
import { applyMetamagicToSpell } from "../engine/metamagicEffects.js";
import { qualifiesForSneakAttack } from "../utils/sneakAttackUtils.js";
import { clearHiddenStatus, stealthCheckAtDisadvantage } from "../engine/actionEconomy.js";
import { classes } from "../data/classes.js";
import { rollD20 } from "../utils/dice.js";
import { endConcentration, onDamageCheckConcentration } from "./concentration.js";
import { state } from "../state/stateStore.js";

function inAnyFogZone(s) {
  const zones = s?.combat?.zones || [];
  return function isObscuredAt(entity) {
    for (const z of zones) {
      if (z.type !== "fog") continue;
      const dx = Math.abs((entity.x ?? 0) - (z.center.x ?? 0));
      const dy = Math.abs((entity.y ?? 0) - (z.center.y ?? 0));
      const dist = Math.max(dx, dy);
      if (dist <= z.radiusTiles) return true;
    }
    return false;
  };
}

export function canSeeTarget(attacker, target, tile = {}) {
  if (hasCondition(attacker, "Blinded")) return false;
  const obscuredHere = tile.isObscured || inAnyFogZone(state)(attacker) || inAnyFogZone(state)(target);
  if (obscuredHere && !attacker.senses?.seeThroughFog) return false;
  if (target.invisible && !attacker.senses?.seeInvisible) return false;
  return true;
}

export async function resolveAttack(attacker, defender, tile = {}, logFn = console.log, allies = []) {
  if (!canSeeTarget(attacker, defender, tile)) {
    logFn(`${attacker.name} can't see ${defender.name} clearly and misses.`);
    return false;
  }

  clearHiddenStatus(attacker, logFn); // attacking reveals hidden

  const { total: d20, roll: firstRoll, usedLucky } = rollD20({ actor: attacker, logFn, context: { type: 'attack', label: 'Attack' } });
  const attackMod = attacker.attackBonus || 0;
  const total = d20 + attackMod;

  const ac = defender.ac || 10;
  const hit = total >= ac;

  if (usedLucky) { try { logFn(`${attacker.name} calls on Lucky.`); } catch {} }

  if (hit) {
    let dmg = Math.floor(Math.random() * (attacker.damageDie || 6)) + 1 + (attacker.damageBonus || 0);

    if (attacker.class === "Rogue" && qualifiesForSneakAttack(attacker, defender, allies)) {
      const diceMap = classes.Rogue?.sneakAttack?.diceByLevel || {};
      const sneakDice = diceMap[attacker.level] || 1;
      for (let i = 0; i < sneakDice; i++) {
        dmg += Math.floor(Math.random() * 6) + 1;
      }
      logFn(`${attacker.name} performs a sneak attack! Extra ${sneakDice}d6 applied.`);
    }

    defender.hp -= dmg;

    // Concentration check for defender if applicable
    try { onDamageCheckConcentration(state, defender, dmg, logFn); } catch {}

    if (defender.isHidden && tile.isAoE) {
      stealthCheckAtDisadvantage(defender, logFn);
    }

    logFn(`${attacker.name} hits ${defender.name} for ${dmg} damage!`);
  } else {
    logFn(`${attacker.name} misses ${defender.name}.`);
  }

  return hit;
}

// (Rest of file remains unchanged from your previous version)
