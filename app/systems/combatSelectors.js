// app/systems/combatSelectors.js
// Canonical helpers for reading combat state.
// Prefer these over poking state.combat.* fields directly.

import { state as globalState } from "../state/stateStore.js";

// Internal: resolve a "combat container" from various inputs.
// Accepts either:
//   - full game state (with .combat)
//   - an encounter-like object with .actors (treated as combat itself)
function resolveCombatContainer(source) {
  if (!source) return null;

  // If this already looks like a combat/encounter object, use it directly.
  if (Array.isArray(source.actors)) return source;

  // Otherwise, treat it as full game state.
  const s = source.combat ? source : globalState;
  return s.combat || null;
}

export function getCombatState(source = globalState) {
  return resolveCombatContainer(source);
}

export function isCombatActive(source = globalState) {
  const combat = resolveCombatContainer(source);
  return !!(combat && Array.isArray(combat.actors) && combat.actors.length);
}

export function getActors(source = globalState) {
  const combat = resolveCombatContainer(source);
  if (!combat || !Array.isArray(combat.actors)) return [];
  return combat.actors.filter(Boolean);
}

export function getActorById(source, id) {
  const combat = resolveCombatContainer(source || globalState);
  if (!combat || !Array.isArray(combat.actors)) return null;
  return combat.actors.find(a => a && a.id === id) || null;
}

export function getRoundNumber(source = globalState) {
  const combat = resolveCombatContainer(source);
  return combat?.round ?? 0;
}

export function getActiveActorId(source = globalState) {
  const combat = resolveCombatContainer(source);
  if (!combat) return null;

  const order = Array.isArray(combat.order) && combat.order.length
    ? combat.order
    : (combat.turnOrder || []);

  if (!order.length) return null;

  const idx = (typeof combat.turnIdx === "number")
    ? combat.turnIdx
    : (combat.turnIndex ?? 0);

  return order[idx] ?? null;
}

export function getActiveActor(source = globalState) {
  const combat = resolveCombatContainer(source);
  if (!combat) return null;
  const activeId = getActiveActorId(source);
  if (!activeId) return null;
  return getActorById(combat, activeId);
}