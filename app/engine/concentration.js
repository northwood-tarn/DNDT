
// app/engine/concentration.js
// Centralized concentration management for casters and monsters.
// One concentration effect per actor. Saves on damage: DC = max(10, floor(damage/2)).
// Effect payload is a small record with a required remove() callback to clean up world state.

import { abilityModFrom } from "./statUtils.js"; // tiny helper; fallback inline if missing
import { rollD20 } from "../utils/dice.js";

function getActorId(actor) {
  return actor?.id || actor?.name || "actor";
}

export function isConcentrating(actor) {
  return !!actor?.concentration?.active;
}

// Begin concentrating on a new effect. If already concentrating, end the old one first.
export function beginConcentration(state, actor, payload, log = ()=>{}) {
  if (!state.combat) state.combat = {};
  if (!state.combat.concentrationByActor) state.combat.concentrationByActor = new Map();

  // End previous if present
  if (actor.concentration?.active) {
    try { actor.concentration?.remove?.("replaced"); } catch {}
    actor.concentration = { active:false };
  }

  const record = {
    active: true,
    spellId: payload.spellId || "unknown",
    effectId: payload.effectId || `conc_${Date.now()}`,
    remove: payload.remove || (()=>{}),
    roundsMax: payload.roundsMax ?? null
  };
  actor.concentration = record;
  state.combat.concentrationByActor.set(getActorId(actor), record);
  log(`${actor.name || "Actor"} begins concentrating on ${payload.label || record.spellId}.`);
  return record;
}

// Explicitly drop concentration (e.g., casting another concentration spell, ending, or losing focus).
export function endConcentration(state, actor, reason = "ended", log = ()=>{}) {
  const rec = actor?.concentration;
  if (!rec?.active) return;
  try { rec.remove?.(reason); } catch {}
  if (state?.combat?.concentrationByActor) {
    state.combat.concentrationByActor.delete(getActorId(actor));
  }
  actor.concentration = { active:false };
  log(`${actor.name || "Actor"} loses concentration (${reason}).`);
}

// Call this whenever an actor that is concentrating takes damage.
export function onDamageCheckConcentration(state, actor, damage, log = ()=>{}) {
  const rec = actor?.concentration;
  if (!rec?.active) return;
  // DC = max(10, floor(damage/2))
  const dc = Math.max(10, Math.floor(damage / 2));
  const conMod = abilityModFrom(actor, "CON");
  const save = rollD20({ actor, logFn:()=>{}, context:{ type:'save', label:'Concentration' } }).total + conMod;
  const passed = save >= dc;
  log(`Concentration check: d20 + CON ${conMod>=0?`+${conMod}`:conMod} = ${save} vs DC ${dc} → ${passed ? "SUCCESS" : "FAILURE"}.`);
  if (!passed) {
    endConcentration(state, actor, "failed_save", log);
  }
}

// Optional: tick down round-limited concentration effects at end of each of the actor's turns.
export function onEndOfTurnTick(state, actor, log = ()=>{}) {
  const rec = actor?.concentration;
  if (!rec?.active || rec.roundsMax == null) return;
  rec.roundsMax -= 1;
  if (rec.roundsMax <= 0) {
    endConcentration(state, actor, "duration_expired", log);
  }
}
