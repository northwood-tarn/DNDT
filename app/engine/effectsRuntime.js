// app/engine/effectsRuntime.js
// Centralized executor for ongoing & immediate effects.
// Now includes knockback resolution for generic "push" effects.

import { applyPush } from "./knockback.js";

// Store ongoing effects on the actor as an array: actor.effects = [{ kind, ... }, ...]
function ensureEffectsArray(actor) {
  if (!actor.effects) actor.effects = [];
  return actor.effects;
}

/**
 * Apply immediate, on-hit effects (e.g., push) to a single target.
 * Call this right after you confirm a failed save or a hit.
 * @param {Object} args
 * @param {Object} args.state - game state (expects state.combat.tileGrid and state.combat.enemies)
 * @param {Object} args.source - actor applying the effect (e.g., caster)
 * @param {Object} args.target - target actor
 * @param {Array<Object>} args.effects - array of effect descriptors (from spell.hooks.applyEffect or similar)
 * @param {Function} [args.log] - optional logger
 */
export function applyOnHitEffects({ state, source, target, effects = [], log = () => {} }) {
  if (!effects || effects.length === 0) return;

  for (const eff of effects) {
    if (!eff || !eff.kind) continue;

    switch (eff.kind) {
      case "push": {
        const grid = state?.combat?.tileGrid;
        if (!grid) break;
        const actors = [state?.combat?.player, ...(state?.combat?.enemies || [])].filter(Boolean);
        const res = applyPush({
          grid,
          actor: target,
          from: { x: source.x, y: source.y },
          maxFeet: eff.distanceFt ?? 0,
          actors
        });
        if (res.moved > 0) {
          log(`${target.name || "Target"} is pushed ${res.moved * 5} ft.`);
        }
        break;
      }

      // Extend with other immediate effects here, e.g. prone, pull, slide, etc.
      default:
        break;
    }
  }
}

/**
 * Tick end-of-turn for ongoing effects attached to an actor.
 * Right now supports Witch Bolt sequence.
 * @param {Object} actor
 * @param {Object} ctx - { state, log }
 */
export function tickEndOfTurn(actor, ctx = {}) {
  const log = ctx.log || (() => {});
  const effects = ensureEffectsArray(actor);
  if (!effects.length) return;

  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    if (!e) continue;

    if (e.kind === "witch_bolt_link_sequence") {
      const { target, diceSequence = [] } = e;
      if (!target || target.hp <= 0) { effects.splice(i,1); continue; }

      // apply next die
      const next = diceSequence.shift();
      if (!next) { effects.splice(i,1); continue; } // finished

      const dmg = rollDie(next);
      target.hp -= dmg;
      log(`Witch Bolt arcs again for ${dmg} lightning (${next}).`);

      // keep remaining sequence
      if (diceSequence.length) {
        e.diceSequence = diceSequence;
      } else {
        effects.splice(i, 1);
      }
    }
  }
}

function rollDie(label = "1d4") {
  const m = /^1d(\d+)$/.exec(label);
  const sides = m ? parseInt(m[1], 10) : 4;
  return 1 + Math.floor(Math.random() * sides);
}

/**
 * Convenience: add an ongoing effect to an actor (avoids scene files touching internals)
 * @param {Object} actor
 * @param {Object} effect - effect descriptor
 */
export function addEffect(actor, effect) {
  const arr = ensureEffectsArray(actor);
  arr.push({ ...effect });
}

/**
 * Apply Mage Armor immediately — exported in case a UI button or script needs it.
 * Typical usage is via your spell executor after a successful cast on a willing target.
 */
export function applyMageArmor(target) {
  if (!target) return;
  // Remember previous AC baseline so you can restore if you later add explicit expiration by time.
  if (typeof target._prevAC === "undefined") target._prevAC = target.ac;
  const dex = target.abilityMods?.DEX ?? 0;
  target.ac = Math.max(target.ac || 0, 13 + dex);
}
