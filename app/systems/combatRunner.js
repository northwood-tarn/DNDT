// systems/combatRunner.js — unified combat bootstrap + orchestration (ESM)
// Round/turn flow now includes: startRound() resets, endTurn() utility,
// victory/defeat checks, mid-combat join/remove (soft), and a formal eligibility predicate.
//
// Public API:
//   startCombat(encounterIdOrDef)
//   getActorById(enc, id)
//   spawnDueAtRoundStart(enc)
//   getEndOfRoundAnnouncements(enc)
//   nextRound(enc)
//   endTurn(enc, log?)
//   joinMidCombat(enc, actorDesc)         // NEW (stable insert into initiative)
//   removeActor(enc, actorId, opts?)      // NEW (soft remove; keeps order visible)
//
import { sceneManager } from "../engine/sceneManager.js";
import CombatScene from "../scenes/CombatScene.js";
import { state } from "../state/stateStore.js";
import { rollWithDetail } from "../utils/dice.js";
import { rollInitiative } from "./initiative.js";
import { startRound, resetTurnEconomyForAll, startTurn } from "./turnEconomy.js";
import { tickEndOfTurn } from "./turnEffects.js";

// Optional registries (best-effort)
let encountersTable = {};
try {
  const mod = await import("../data/encounters.js");
  encountersTable = (mod && (mod.default || mod.encounters)) || {};
} catch (_) {}

let enemiesDB = {};
try {
  const mod = await import("../data/enemies.js");
  enemiesDB = (mod && (mod.default || mod.enemies)) || {};
} catch (_) {}

// ---- actor resolvers ----
function buildPlayerActorFromState(desc) {
  const p = state.player || {};
  const out = { ...p };
  if (typeof desc?.distanceFromPC === "number") out.distanceFromPC = desc.distanceFromPC | 0;
  out.id = out.id || "player";
  out.name = out.name || "Player";
  if (typeof out.dexMod !== "number") {
    const dexMod = (p?.derived?.abilityMods?.dex) ?? p?.dexMod ?? 0;
    out.dexMod = dexMod | 0;
  }
  return out;
}

function buildEnemyActor(desc, idx) {
  const key = desc.enemyKey || desc.id || "enemy";
  const base = desc.inline || enemiesDB[key] || {};
  const id = desc.enemyId || base.id || key;
  return {
    id,
    name: base.name || id,
    enemyKey: key,
    kind: "npc",
    ac: base.ac ?? desc.ac ?? 12,
    hp: base.hp ?? base.maxHp ?? desc.hp ?? 7,
    maxHp: base.maxHp ?? base.hp ?? desc.maxHp ?? 7,
    attackBonus: base.attackBonus ?? desc.attackBonus ?? 3,
    damage: base.damage || desc.damage || "1d6+2",
    abilities: base.abilities || { dex: base.dex ?? 12 },
    initBonus: base.initBonus || 0,
    surprised: !!base.surprised,
    pipsRemaining: base.pipsRemaining || 0,
    distanceFromPC: typeof desc.distanceFromPC === "number" ? (desc.distanceFromPC | 0) : (base.distanceFromPC || 5),
    dexMod: typeof base.dexMod === "number" ? base.dexMod : undefined
  };
}

function resolveActor(part, idx) {
  if (part.role === "pc" && part.ref === "player") return buildPlayerActorFromState(part);
  if (part.role === "npc") return buildEnemyActor(part, idx);
  return null;
}

// ---- encounter assembly ----
function assembleActorsFromEncounter(encDef) {
  const out = [];
  let npcIdx = 0;
  const parts = encDef.participants || [];
  if (parts.length === 0) {
    parts.push(
      { role: "pc", ref: "player" },
      { role: "npc", enemyKey: "goblin", enemyId: "goblin_a", distanceFromPC: 5 },
      { role: "npc", enemyKey: "goblin", enemyId: "goblin_b", distanceFromPC: 5 }
    );
  }
  for (const part of parts) {
    const actor = resolveActor(part, npcIdx);
    if (!actor) continue;
    out.push(actor);
    if (part.role === "npc") npcIdx++;
  }
  return out;
}

export function getActorById(enc, id) {
  return enc.actors.find(a => a.id === id) || null;
}

// ---- mid-combat join/leave ----
export function joinMidCombat(enc, actorDesc){
  // Resolve and insert using the same logic as initial spawns
  spawnActor(enc, actorDesc);
  // If there are no living/eligible actors besides the joiner, ensure turnIdx points sensibly
  if (!isEligible(getActorById(enc, getActiveActorId(enc)))) {
    // move to the first eligible after sorting
    enc.turnIdx = findNextEligibleIndex(enc, enc.turnIdx ?? 0);
  }
}

export function removeActor(enc, actorId, opts = { reason: "left" }){
  // Soft remove: keep in order for UI/history; mark as removed so eligibility skips them.
  const a = getActorById(enc, actorId);
  if (a) {
    a.removed = true;
    a.removeReason = opts.reason || "left";
  }
}

// ---- basic registry helpers ----
export function spawnDueAtRoundStart(enc) {
  const due = (enc.triggers || []).filter(t => t.type === "spawn" && t.at === "roundStart" && t.round === enc.round);
  for (const t of due) spawnActor(enc, t.actor);
}

export function getEndOfRoundAnnouncements(enc) {
  const out = [];
  const nextRoundNum = (enc.round | 0) + 1;
  for (const t of (enc.triggers || [])) {
    if (t.type === "spawn" && t.round === nextRoundNum && (t.announceAtEndOfPrev || t.announceText)) {
      if (t.announceText) out.push(t.announceText);
    }
  }
  return out;
}

function spawnActor(enc, actorDesc) {
  const actor = resolveActor(actorDesc);
  if (!actor) return;
  enc.actors.push(actor);
  // Give them a roll and insert into order
  const r = rollWithDetail("1d20");
  const d20 = r.roll ?? r.total;
  const total = d20 + (actor.initBonus || 0) + (actor.dexMod || 0);
  enc.rolls[actor.id] = { total, d20, mod: actor.dexMod || 0, bonus: actor.initBonus || 0 };
  enc.order.push(actor.id);
  // Stable sort like initial initiative (total desc, dexMod desc, name asc)
  enc.order.sort((aId, bId) => {
    const a = enc.rolls[aId], b = enc.rolls[bId];
    if (b.total !== a.total) return b.total - a.total;
    const am = enc.rolls[aId]?.mod ?? 0, bm = enc.rolls[bId]?.mod ?? 0;
    if (bm !== am) return bm - am;
    const na = (getActorById(enc, aId)?.name || aId).toLowerCase();
    const nb = (getActorById(enc, bId)?.name || bId).toLowerCase();
    if (na !== nb) return na < nb ? -1 : 1;
    return 0;
  });
}

// ---- eligibility & active helpers ----
function getActiveActorId(enc){
  return enc.order[(enc.turnIdx ?? 0) % Math.max(1, enc.order.length)];
}

function hasCondition(a, name){
  if (!a) return false;
  const conds = new Set([...(a.conditions || []), ...(a.tempConditions || [])]);
  return conds.has(name);
}

export function isEligible(a){
  if (!a) return false;
  if (a.removed) return false;                 // left combat (soft removal)
  if (typeof a.hp === "number" && a.hp <= 0) return false; // downed
  if (a.skipTurn) return false;                // explicit flag from systems
  // Common incapacitation conditions
  if (hasCondition(a, "Unconscious")) return false;
  if (hasCondition(a, "Paralyzed")) return false;
  if (hasCondition(a, "Stunned")) return false;
  if (hasCondition(a, "Incapacitated")) return false;
  return true;
}

function findNextEligibleIndex(enc, startIdx){
  const n = enc.order.length;
  for (let i=1; i<=n; i++){
    const idx = (startIdx + i) % n;
    const id = enc.order[idx];
    const a = getActorById(enc, id);
    if (isEligible(a)) return idx;
  }
  return startIdx; // fallback: everyone is ineligible; keep index
}

// ---- Round advance ----
export function nextRound(enc) {
  enc.round = (enc.round | 0) + 1;
  // Reset per-round economy across all actors (reactions, etc.)
  startRound({ combat: enc });
  // HARD RESET per-turn budgets at round start (as per your preference)
  resetTurnEconomyForAll({ combat: enc });
  // Trigger any round-start spawns
  spawnDueAtRoundStart(enc);
  // Announcements for UI
  enc._roundAnnouncements = getEndOfRoundAnnouncements(enc);
}

// ---- Win/Loss evaluation ----
export function checkEndConditions(enc){
  // Define sides: player is 'player' id; everyone with kind:'npc' (or enemyKey) is enemy
  const actors = enc.actors || [];
  const pcAlive = actors.some(a => (a.id === "player" || a.role === "pc") && !a.removed && (typeof a.hp !== "number" || a.hp > 0));
  const enemiesAlive = actors.some(a => (a.kind === "npc" || a.enemyKey) && !a.removed && (typeof a.hp !== "number" || a.hp > 0));

  if (!enemiesAlive) {
    enc.ended = true; enc.outcome = "victory";
    try { window.dispatchEvent(new CustomEvent("combat:ended", { detail:{ outcome:"victory" } })); } catch {}
    try { window.dispatchEvent(new CustomEvent("game:postCombatOutcome", { detail:{ outcome:"victory" } })); } catch {}
    return "victory";
  }
  if (!pcAlive) {
    enc.ended = true; enc.outcome = "defeat";
    try { window.dispatchEvent(new CustomEvent("combat:ended", { detail:{ outcome:"defeat" } })); } catch {}
    try { window.dispatchEvent(new CustomEvent("game:postCombatOutcome", { detail:{ outcome:"defeat" } })); } catch {}
    return "defeat";
  }
  return null;
}

// ---- Turn advance utility ----
export function endTurn(enc, log = () => {}){
  if (enc.ended) return; // already finished

  // 1) Tick end-of-turn effects for the actor that just finished
  tickEndOfTurn({ combat: enc }, msg => log(msg));

  // 2) Check victory/defeat before advancing
  const outcome = checkEndConditions(enc);
  if (outcome) return; // stop advancing if combat ended

  // 3) Advance turnIdx to next eligible actor
  const currIdx = enc.turnIdx ?? 0;
  const nextIdx = findNextEligibleIndex(enc, currIdx);
  const wrapped = nextIdx <= currIdx; // if we looped around, new round begins

  if (wrapped) {
    // New round: increment, reset round flags, spawns/announcements
    nextRound(enc);
  }

  enc.turnIdx = (wrapped ? 0 : nextIdx);

  // 4) Start-turn reset for the new active actor
  const activeId = getActiveActorId(enc);
  const active = getActorById(enc, activeId);
  if (active) startTurn(active);

  // 5) Emit events (consumable by UI/systems)
  try { window.dispatchEvent(new CustomEvent('combat:turnEnded',  { detail: { actorId: enc.order[currIdx], round: enc.round } })); } catch {}
  try { window.dispatchEvent(new CustomEvent('combat:turnBegan',  { detail: { actorId: activeId, round: enc.round } })); } catch {}
}

// ---- entry point ----
export async function startCombat(encounterIdOrDef) {
  // 1) Resolve encounter definition
  let encDef = null;
  if (typeof encounterIdOrDef === "string") {
    encDef = encountersTable[encounterIdOrDef] || null;
    if (!encDef) {
      try {
        const mod = await import(`../areas/00_dockside/encounters/${encounterIdOrDef}.js`);
        encDef = mod && (mod.default || mod);
      } catch (_) {}
    }
  } else if (encounterIdOrDef && typeof encounterIdOrDef === "object") {
    encDef = encounterIdOrDef;
  }
  if (!encDef) {
    encDef = {
      title: "Skirmish",
      returnAreaId: "00_dockside",
      participants: [
        { role: "pc", ref: "player" },
        { role: "npc", enemyKey: "goblin", enemyId: "goblin_a", distanceFromPC: 5 },
        { role: "npc", enemyKey: "goblin", enemyId: "goblin_b", distanceFromPC: 5 }
      ],
      triggers: [
        { type: "spawn", at: "roundStart", round: 2,
          actor: { role:"npc", enemyKey:"goblin_intern", enemyId:"intern", distanceFromPC: 30 },
          announceAtEndOfPrev: true, announceText: "A Goblin Intern rushes in!" }
      ]
    };
  }

  // 2) Build canonical actors[]
  const actors = assembleActorsFromEncounter(encDef);

  // 3) Roll initiative over actors[]
  const init = rollInitiative(actors, { state });

  // 4) Seed state.combat (canonical)
  state.combat = {
    title: encDef.title || "Combat",
    returnAreaId: encDef.returnAreaId || "00_dockside",
    encounterId: typeof encounterIdOrDef === "string" ? encounterIdOrDef : (encDef.id || "custom"),
    triggers: encDef.triggers || [],
    actors,
    order: init.order,
    rolls: init.rolls,
    surprised: init.surprised,
    round: 1,
    turnIdx: 0
  };

  // 5) Start-of-round initialization
  startRound({ combat: state.combat });
  resetTurnEconomyForAll({ combat: state.combat });
  spawnDueAtRoundStart(state.combat);
  state.combat._roundAnnouncements = getEndOfRoundAnnouncements(state.combat);

  // 6) Hand off to the scene
  sceneManager.replace(CombatScene, { fromLoader: true });

  // 7) Emit first turn-began for UI
  try {
    const firstId = (state.combat.order[0]);
    const firstActor = getActorById(state.combat, firstId);
    if (firstActor) startTurn(firstActor);
    window.dispatchEvent(new CustomEvent('combat:turnBegan',  { detail: { actorId: firstId, round: state.combat.round } }));
  } catch {}
}

// ---- Revival & rejoin helpers ----
// Bring a previously removed combatant back without changing initiative order.
export function rejoin(enc, actorId){
  const a = getActorById(enc, actorId);
  if (!a) return false;
  a.removed = false;
  delete a.removeReason;
  return true;
}

// Utility to add/remove a condition string on an actor.
function toggleCondition(a, name, on){
  if (!a) return;
  const arr = Array.isArray(a.conditions) ? a.conditions : (a.conditions = []);
  const set = new Set(arr);
  if (on) set.add(name); else set.delete(name);
  a.conditions = Array.from(set);
}

// Revive an actor: restore HP, clear incapacitating conditions, optionally mark Prone.
// Does not change initiative; actor will act when their seat next comes up and is eligible.
export function revive(enc, actorId, hp = 1, opts = {}){
  const a = getActorById(enc, actorId);
  if (!a) return false;

  const {
    clearConditions = ["Unconscious","Incapacitated","Paralyzed","Stunned"],
    setProne = true,
    removeFlag = true,              // clear soft removal flag
    unendCombatIfNeeded = true      // if combat was marked ended but revival makes both sides alive again, reopen it
  } = opts;

  // Restore life state
  a.hp = Math.max(1, hp|0);
  if (removeFlag) { a.removed = false; delete a.removeReason; }

  // Clear incapacitating conditions
  for (const c of clearConditions) toggleCondition(a, c, false);
  if (setProne) toggleCondition(a, "Prone", true); // common post-revive posture in many systems

  // If combat had ended, re-evaluate
  if (unendCombatIfNeeded && enc.ended) {
    const outcome = checkEndConditionsAfterRevive(enc);
    if (!outcome) { enc.ended = false; delete enc.outcome; }
  }

  // Notify listeners/UI
  try { window.dispatchEvent(new CustomEvent('combat:revived', { detail: { actorId, round: enc.round } })); } catch {}
  return true;
}

// Check whether combat should remain ended after a revival; returns outcome or null if ongoing.
function checkEndConditionsAfterRevive(enc){
  const actors = enc.actors || [];
  const pcAlive = actors.some(a => (a.id === "player" || a.role === "pc") && !a.removed && (typeof a.hp !== "number" || a.hp > 0));
  const enemiesAlive = actors.some(a => (a.kind === "npc" || a.enemyKey) && !a.removed && (typeof a.hp !== "number" || a.hp > 0));
  if (!enemiesAlive) return "victory";
  if (!pcAlive) return "defeat";
  return null;
}

// Convenience: "Relentless Endurance"-style hook. Call from your damage system when an actor would drop to 0.
// Returns true if it converted lethal to 1 HP and applied cooldown flag.
export function tryRelentlessEndurance(a){
  if (!a) return false;
  if (typeof a.hp !== "number") return false;
  if (a.hp > 0) return false;
  if (a._usedRelentlessEnduranceThisRest) return false;
  // Trigger: pop back to 1 HP, clear Unconscious, mark used
  a.hp = 1;
  toggleCondition(a, "Unconscious", false);
  a._usedRelentlessEnduranceThisRest = true;
  return true;
}

// (Optional) Clear Relentless Endurance usage on long rest.
// You can call this from your long_rest.js.
export function resetRelentlessEndurance(encOrState){
  const actors = (encOrState?.combat?.actors) ? encOrState.combat.actors
                : (Array.isArray(encOrState?.actors) ? encOrState.actors : []);
  for (const a of actors) if (a) a._usedRelentlessEnduranceThisRest = false;
}
