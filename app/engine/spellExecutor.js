// app/engine/spellExecutor.js
// Generic spell executor for combat usage.
// Reads pure-data from app/data/spells.js and applies saves/damage/effects.
// Area finding includes 15-ft cube (Thunderwave) and N‑ft radius (Sleep/Fog Cloud).
// 5 ft == 1 tile convention used.

import { SPELLS, getSpellById } from "../data/spells.js";
import { applyOnHitEffects } from "./effectsRuntime.js";
import { beginConcentration, endConcentration } from "./concentration.js";

function roll(diceSpec) {
  const m = /^(\d+)d(\d+)([+-]\d+)?$/.exec(String(diceSpec).trim());
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  const die = parseInt(m[2], 10);
  const k = m[3] ? parseInt(m[3], 10) : 0;
  let total = k;
  for (let i = 0; i < n; i++) total += 1 + Math.floor(Math.random() * die);
  return total;
}

function abilityModFrom(actor, abilityKey) {
  if (actor?.abilityMods && abilityKey in actor.abilityMods) return actor.abilityMods[abilityKey];
  const score = actor?.abilities?.[abilityKey] ?? 10;
  return Math.floor((score - 10) / 2);
}

function getSpellSaveDC(caster) {
  const pb = caster?.proficiencyBonus ?? 2;
  const mod = caster?.abilityMods?.CHA ?? abilityModFrom(caster, "CHA");
  return 8 + pb + mod;
}

// 15-ft cube centered on caster (Thunderwave-style)
function targetsInSelfCube(state, caster, feet) {
  const tiles = Math.max(1, Math.floor(feet / 5));
  const combat = state?.combat;
  let all = [];
  if (combat?.actors && Array.isArray(combat.actors)) {
    all = combat.actors.filter(Boolean);
  } else {
    all = [ ...(combat?.enemies || []), combat?.player ].filter(Boolean);
  }
  const inCube = [];
  for (const t of all) {
    if (!t || t === caster) continue;
    const dx = Math.abs((t.x ?? 0) - (caster.x ?? 0));
    const dy = Math.abs((t.y ?? 0) - (caster.y ?? 0));
    if (dx <= tiles && dy <= tiles) inCube.push(t);
  }
  return inCube;
}

// N‑ft radius around an origin (for Sleep, Fog Cloud, etc.)
function targetsInRadius(state, origin, feet) {
  const tiles = Math.max(1, Math.floor(feet / 5));
  const combat = state?.combat;
  let all = [];
  if (combat?.actors && Array.isArray(combat.actors)) {
    all = combat.actors.filter(Boolean);
  } else {
    all = [ ...(combat?.enemies || []), combat?.player ].filter(Boolean);
  }
  const inRad = [];
  for (const t of all) {
    if (!t) continue;
    const dx = Math.abs((t.x ?? 0) - (origin.x ?? 0));
    const dy = Math.abs((t.y ?? 0) - (origin.y ?? 0));
    const dist = Math.max(dx, dy); // Chebyshev distance for tiles
    if (dist <= tiles) inRad.push(t);
  }
  return inRad;
}

/**
 * Execute a spell.
 * Supports: thunderwave, sleep, fog_cloud (zones).
 * @param {Object} args
 * @param {Object} args.state
 * @param {Object} args.caster
 * @param {string} args.spellId
 * @param {Array<Object>} [args.targets]
 * @param {Object} [args.origin] - {x,y} center for point‑centered AoEs, defaults to caster
 * @param {Function} [args.log]
 */
export function executeSpell({ state, caster, spellId, targets = null, origin = null, log = ()=>{} }) {
  const spell = typeof spellId === "string" ? (SPELLS[spellId] || getSpellById(spellId)) : spellId;
  if (!spell) { log(`Spell not found: ${spellId}`); return; }

  // THUNDERWAVE
  if (spell.id === "thunderwave") {
    const list = targets || targetsInSelfCube(state, caster, spell.area?.size || 15);
    const dc = getSpellSaveDC(caster);
    for (const target of list) {
      const conMod = abilityModFrom(target, "CON");
      const rollSave = 1 + Math.floor(Math.random() * 20) + conMod;
      const failed = rollSave < dc;
      const dmgRoll = roll(spell.hooks?.damage?.dice || "2d8");
      const dmg = failed ? dmgRoll : Math.floor(dmgRoll / 2);
      target.hp -= dmg;
      log(`${target.name || target.id} ${failed ? "fails" : "succeeds"} CON ${rollSave} vs DC ${dc} → takes ${dmg} thunder.`);
      if (failed && spell.hooks?.applyEffect?.kind === "push") {
        applyOnHitEffects({ state, source: caster, target, effects: [ spell.hooks.applyEffect ], log });
      }
    }
    return;
  }

  // SLEEP (custom: HP threshold + CON save → Unconscious for N rounds; wakes on damage)
  if (spell.id === "sleep") {
    const center = origin || caster;
    const radius = spell.area?.size || 20;
    const list = targets || targetsInRadius(state, center, radius);
    const dc = getSpellSaveDC(caster);
    const hpThreshold = spell.hooks?.applyEffect?.hpThreshold ?? 20;
    const rounds = spell.hooks?.applyEffect?.rounds ?? 2;
    const affectedIds = [];
    for (const target of list) {
      if (target === caster) continue;
      if ((target.hp ?? 0) > hpThreshold) {
        log(`${target.name || target.id} has ${target.hp} HP (> ${hpThreshold}) → not affected by Sleep.`);
        continue;
      }
      const conMod = abilityModFrom(target, "CON");
      const save = 1 + Math.floor(Math.random() * 20) + conMod;
      if (save >= dc) {
        log(`${target.name || target.id} resists Sleep (CON ${save} vs DC ${dc}).`);
        continue;
      }
      // Apply Unconscious
      target.conditions = Array.isArray(target.conditions) ? target.conditions : [];
      if (!target.conditions.includes("Unconscious")) target.conditions.push("Unconscious");
      target._sleepFromSpell = (target._sleepFromSpell || 0) + 1;
      target._sleepRoundsRemaining = Math.max(target._sleepRoundsRemaining || 0, rounds);
      log(`${target.name || target.id} falls Unconscious for up to ${rounds} rounds (wake on damage).`);
      affectedIds.push(target.id || target.name);
    }

    if (spell.concentration) {
      beginConcentration(state, caster, {
        spellId: "sleep",
        label: "Sleep",
        roundsMax: null,
        remove: (reason) => {
          // If we choose to end the effect on concentration loss, wake any target that is still marked from this spell
          const combat = state?.combat;
          const everyone = (combat?.actors && Array.isArray(combat.actors))
            ? combat.actors.filter(Boolean)
            : [ ...(combat?.enemies || []), combat?.player ].filter(Boolean);
          for (const t of everyone) {
            if (!t?._sleepFromSpell) continue;
            // Only wake those still Unconscious from this source
            if (Array.isArray(t.conditions)) {
              const idx = t.conditions.indexOf("Unconscious");
              if (idx >= 0) t.conditions.splice(idx, 1);
            }
            t._sleepFromSpell = 0;
            t._sleepRoundsRemaining = 0;
          }
        }
      }, log);
    }
    return;
  }

  // FOG CLOUD → register an obscuring zone; ends with concentration
  if (spell.id === "fog_cloud") {
    const center = origin || caster;
    const radiusFt = spell.area?.size || 20;
    const radiusTiles = Math.max(1, Math.floor(radiusFt / 5));
    // Only register zones if we have an active combat container; combatRunner owns state.combat.
    if (!state || !state.combat) {
      log("Fog Cloud cast outside of an active combat state; skipping zone registration.");
      return;
    }
    if (!Array.isArray(state.combat.zones)) state.combat.zones = [];
    const zone = { type: "fog", center: { x: center.x, y: center.y }, radiusTiles, heavy: true };
    state.combat.zones.push(zone);
    log(`A dense fog spreads in a ${radiusFt}-ft radius.`);

    if (spell.concentration) {
      beginConcentration(state, caster, {
        spellId: "fog_cloud",
        label: "Fog Cloud",
        remove: () => {
          const arr = state.combat.zones || [];
          const idx = arr.indexOf(zone);
          if (idx >= 0) arr.splice(idx, 1);
        }
      }, log);
    }
    return;
  }

  log(`${spell.name} isn’t handled in executeSpell yet.`);
}
