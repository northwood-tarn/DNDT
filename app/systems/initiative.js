// systems/initiative.js — unified initiative system (ESM)
//
// Merges the simple state-driven approach (auto-populate from combat state, getters/nextTurn)
// with the richer, rules-aware approach (advantage, bonuses, deterministic tie-breaks).
//
// Key exports:
// - rollInitiative(actors=[], opts={ state }) -> { order, rolls, surprised }
// - insertIntoInitiative(order, actorId, afterRound=false) -> string[]
// - buildActorsFromState(state) -> minimal actors[] (adapts current state.combat shape)
// - applyInitiativeToState(state, result) -> mutates state.combat.{turnOrder,turnIndex,rolls}
// - getCurrentCombatant(state) -> actor id
// - nextTurn(state) -> void
//
// Notes:
// - Uses utils/dice.js and systems/abilities.js for mods/advantage/bonuses.
// - Preserves convenience functions to work with existing state.combat turn handling.
// - Sorting: total desc, dexMod desc, name asc, stable index asc.
//
// Dependencies expected in your repo:
//   ../utils/dice.js             (rollWithDetail)
//   ./abilities.js               (getInitiativeComponents, getAbilityMod)
//   ../data/enemies.js           (getEnemyStats) — only used by buildActorsFromState adapter
//
import { rollWithDetail } from "../utils/dice.js";
import { getInitiativeComponents, getAbilityMod } from "./abilities.js";
import { getEnemyStats } from "../data/enemies.js";  // adapter only

function d20WithAdv(adv=0){
  // Try native advantage on the dice API first
  try {
    const res = rollWithDetail("1d20", { adv });
    if (res && typeof res.total === "number") {
      const rolls = res.rolls || (res.detail ? res.detail : [res.roll ?? res.total]);
      return { d20: res.total, detail: rolls };
    }
  } catch(_) {}
  // Manual fallback
  const a = rollWithDetail("1d20");
  const r1 = a.roll ?? a.total;
  if (!adv) return { d20: r1, detail: [r1] };
  const b = rollWithDetail("1d20");
  const r2 = (b.roll ?? b.total);
  return adv > 0
    ? { d20: Math.max(r1, r2), detail: [r1, r2] }
    : { d20: Math.min(r1, r2), detail: [r1, r2] };
}

export function rollInitiative(actors=[], opts={}){
  const gameState = opts.state;
  const withRolls = actors.map((a, index) => {
    const name = a.name || a.id;
    // Derived components from abilities (mod, adv, bonus)
    const { mod, adv, bonus } = getInitiativeComponents(a, gameState);
    const r = d20WithAdv(adv || 0);
    const total = r.d20 + (mod || 0) + (bonus || 0);
    const dexMod = (typeof a.dexMod === "number")
      ? a.dexMod
      : getAbilityMod(a, "dex", gameState);
    return {
      id: a.id,
      name,
      surprised: !!a.surprised,
      index,
      dexMod,
      bonus: bonus || 0,
      d20: r.d20,
      detail: r.detail || [r.d20],
      total
    };
  });

  withRolls.sort((x,y) => {
    if (y.total !== x.total) return y.total - x.total;
    if (y.dexMod !== x.dexMod) return y.dexMod - x.dexMod;
    const nx = (x.name||"").toLowerCase(), ny = (y.name||"").toLowerCase();
    if (nx !== ny) return nx < ny ? -1 : 1;
    return x.index - y.index;
  });

  const order = withRolls.map(r => r.id);
  const rolls = {};
  withRolls.forEach(r => { rolls[r.id] = { total: r.total, d20: r.d20, mod: r.dexMod, bonus: r.bonus }; });
  const surprised = {};
  withRolls.forEach(r => { if (r.surprised) surprised[r.id] = true; });

  return { order, rolls, surprised };
}

export function insertIntoInitiative(order, actorId, afterRound=false){
  const next = order.slice();
  if (afterRound) next.push(actorId);
  else next.splice(order.length, 0, actorId);
  return next;
}

// ---- Adapters for current combat state shape ----
export function buildActorsFromState(state){
  const actors = [];
  if (!state || !state.combat) return actors;

  // Player
  if (state.combat.player) {
    const p = state.combat.player;
    const dexMod = getAbilityMod(state.player || p, "dex", state);
    actors.push({
      id: "player",
      name: (state.player && (state.player.name || "player")) || "player",
      dexMod,
      abilities: state.player?.abilities || p.abilities,
      initBonus: state.player?.initBonus || 0,
      surprised: !!state.player?.surprised
    });
  }

  // Enemies
  const list = Array.isArray(state.combat.enemies) ? state.combat.enemies : [];
  list.forEach((enemy, idx) => {
    const stats = getEnemyStats(enemy.id) || {};
    const dexMod = (typeof stats.dexMod === "number")
      ? stats.dexMod
      : getAbilityMod(stats, "dex", state);
    actors.push({
      id: `${enemy.id}_${idx}`,
      name: enemy.name || enemy.id,
      enemyId: enemy.id,
      dexMod,
      abilities: stats.abilities || { dex: stats.dex },
      initBonus: stats.initBonus || 0,
      surprised: !!enemy.surprised
    });
  });

  return actors;
}

export function applyInitiativeToState(state, result){
  if (!state || !state.combat || !result) return;
  state.combat.turnOrder = result.order.slice();
  state.combat.turnIndex = 0;
  state.combat.initiativeRolls = result.rolls;
  state.combat.surprised = result.surprised;
}

export function getCurrentCombatant(state){
  const order = state?.combat?.turnOrder || [];
  const idx = state?.combat?.turnIndex ?? 0;
  return order[idx];
}

export function nextTurn(state){
  const order = state?.combat?.turnOrder || [];
  if (!order.length) return;
  state.combat.turnIndex = (state.combat.turnIndex + 1) % order.length;
}
