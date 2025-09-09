// app/systems/encounterRunner.js
// TRIMMED: No player normalization here. Reads state.player as the sole authority.

import { state } from "../state/stateStore.js";
import { rollWithDetail } from "../utils/dice.js";
import { getAbilityMod } from "./abilities.js";
import { rollInitiative } from "./initiative.js";

function getEnemyFromDb(enemyKey){
  try {
    const mod = require("../data/enemies.js");
    const db = (mod.enemies || mod.default || mod) || {};
    return db[enemyKey] || null;
  } catch (e) {
    return null;
  }
}

function resolveActor(desc){
  if (desc.role === 'pc' && desc.ref === 'player'){
    // Use the live player as-is. No normalization here.
    const p = state.player || {};
    // carry in encounter-provided distance if any (for PC usually 0)
    const pc = { ...p };
    if (typeof desc.distanceFromPC === 'number') pc.distanceFromPC = desc.distanceFromPC|0;
    return pc;
  }
  if (desc.role === 'npc'){
    const base = desc.inline || (desc.enemyKey ? getEnemyFromDb(desc.enemyKey) : null) || {};
    const npc = {
      id: desc.enemyId || base.id || desc.enemyKey || "npc",
      name: base.name || desc.enemyId || desc.enemyKey || "Creature",
      ac: base.ac ?? 12,
      hp: base.hp ?? base.maxHp ?? 7,
      maxHp: base.maxHp ?? base.hp ?? 7,
      attackBonus: base.attackBonus ?? 3,
      damage: base.damage || "1d6+2",
      abilities: base.abilities || { dex: base.dex ?? 12 },
      initBonus: base.initBonus || 0,
      surprised: !!base.surprised,
      pipsRemaining: base.pipsRemaining || 0,
      distanceFromPC: typeof desc.distanceFromPC === 'number' ? (desc.distanceFromPC|0) : (base.distanceFromPC || 5)
    };
    return npc;
  }
  return null;
}

export function buildEncounter(encounterDef){
  const pcs = [];
  const npcs = [];
  for (const p of (encounterDef.participants || [])){
    const actor = resolveActor(p);
    if (!actor) continue;
    if (p.role === 'pc') pcs.push(actor);
    else npcs.push(actor);
  }
  const actors = [...pcs, ...npcs];
  const init = rollInitiative(actors, { state });
  return {
    pcs, npcs,
    order: init.order,
    rolls: init.rolls,
    surprised: init.surprised,
    round: 1,
    triggers: encounterDef.triggers || [],
    title: encounterDef.title,
    returnAreaId: encounterDef.returnAreaId
  };
}

export function nextRound(enc){ enc.round += 1; }

function comparatorFactory(enc){
  return (aId, bId) => {
    const a = getActorById(enc, aId);
    const b = getActorById(enc, bId);
    const ra = enc.rolls[aId], rb = enc.rolls[bId];
    if (rb.total !== ra.total) return rb.total - ra.total;
    const am = (typeof a.dexMod === 'number') ? a.dexMod : getAbilityMod(a, 'dex', state);
    const bm = (typeof b.dexMod === 'number') ? b.dexMod : getAbilityMod(b, 'dex', state);
    if (bm !== am) return bm - am;
    const na = (a.name||a.id).toLowerCase(), nb = (b.name||b.id).toLowerCase();
    if (na !== nb) return na < nb ? -1 : 1;
    return 0;
  };
}

export function getActorById(enc, id){
  for (const a of enc.pcs) if (a.id === id) return a;
  for (const a of enc.npcs) if (a.id === id) return a;
  return null;
}

export function spawnDueAtRoundStart(enc){
  const due = (enc.triggers || []).filter(t => t.type === 'spawn' && t.at === 'roundStart' && t.round === enc.round);
  for (const t of due){
    spawnActor(enc, t.actor);
  }
}

export function getEndOfRoundAnnouncements(enc){
  const out = [];
  const nextRoundNum = enc.round + 1;
  for (const t of (enc.triggers || [])){
    if (t.type === 'spawn' && t.round === nextRoundNum && (t.announceAtEndOfPrev || t.announceText)){
      if (t.announceText) out.push(t.announceText);
    }
  }
  return out;
}

function spawnActor(enc, actorDesc){
  const actor = resolveActor(actorDesc);
  if (!actor) return;
  enc.npcs.push(actor);
  const r = rollWithDetail("1d20");
  const d20 = r.roll ?? r.total;
  const total = d20 + (actor.initBonus || 0);
  enc.rolls[actor.id] = { total, d20, mod: 0, bonus: actor.initBonus || 0 };
  enc.order.push(actor.id);
  enc.order.sort(comparatorFactory(enc));
}
