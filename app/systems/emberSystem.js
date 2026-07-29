// app/systems/emberSystem.js
// Discovery + menu for Embers: named fast-travel beacons + long rest/save/inventory.
// Minimal UI implemented with the existing shell + logSystem; key handling inside caller scene.
import { logSystem } from "../engine/log.js";
import { state } from "../state/stateStore.js";
import { normalizeSaveGameState } from "../state/saveGameState.js";

export const UNDERSIZED_PARTY_WARNING = "Combat and exploration have been balanced with a three-member team in mind. Are you are sure want to venture out with less?";

function key(x,y){ return `${x},${y}`; }

export function ensureArea(areaId){
  if (!state.embers) state.embers = {};
  if (!state.embers[areaId]) state.embers[areaId] = new Map();
  return state.embers[areaId];
}

export function discoverEmber(areaId, ember){
  // ember: { id, name, x, y }
  const m = ensureArea(areaId);
  m.set(ember.id, { name: ember.name, x: ember.x, y: ember.y });
  logSystem(`An ember marks this place: ${ember.name}.`);
}

export function listDiscovered(areaId){
  const m = ensureArea(areaId);
  return Array.from(m.entries()).map(([id, e]) => ({ id, ...e }));
}

export function findEmber(areaId, id){
  const m = ensureArea(areaId);
  return m.get(id) || null;
}

// Choose an adjacent landing tile next to an ember; prefers south, then east, west, north.
export function pickLanding(ember, W=40, H=18){
  const candidates = [
    { x: ember.x, y: ember.y+1 },
    { x: ember.x+1, y: ember.y },
    { x: ember.x-1, y: ember.y },
    { x: ember.x, y: ember.y-1 }
  ];
  // Clamp to bounds; we don't have collision here, so caller can refine later.
  for (const c of candidates){
    c.x = Math.max(1, Math.min(W-2, c.x));
    c.y = Math.max(1, Math.min(H-2, c.y));
  }
  return candidates[0];
}

// Build a numbered list menu model; caller renders and handles keys.
export function buildEmberMenu(areaId, currentId, options = {}){
  const entries = listDiscovered(areaId);
  const here = entries.find(e => e.id === currentId);
  const others = entries.filter(e => e.id !== currentId);
  const items = [];
  items.push({ id: "rest", label: "Take a long rest" });
  items.push({ id: "inventory", label: "Use items from your inventory" });
  items.push({ id: "party", label: "Manage companions" });
  items.push({ id: "save", label: "Save game" });
  items.push({ id: "load", label: "Load game" });
  if (others.length){
    items.push({ id: "travel", label: "Fast travel to another ember" });
  }
  const departure = getEmberDepartureCheck(options.saveGame, { confirmed: options.departureConfirmed === true });
  items.push({
    id: "leave",
    label: "Leave the ember",
    requiresConfirmation: departure.requiresConfirmation,
    confirmationMessage: departure.message,
  });
  return { here, others, items };
}

export function getEmberDepartureCheck(saveGame, options = {}) {
  const activeCompanionCount = saveGame?.party?.companions?.activeIds?.length || 0;
  const requiresConfirmation = activeCompanionCount < 2 && options.confirmed !== true;
  return {
    allowed: !requiresConfirmation,
    requiresConfirmation,
    message: requiresConfirmation ? UNDERSIZED_PARTY_WARNING : null,
    activeCompanionCount,
  };
}

export function leaveEmber(saveGame, options = {}) {
  const departure = getEmberDepartureCheck(saveGame, options);
  if (!departure.allowed) return { ok: false, saveGame, departure, inspiringLeader: null };
  const normalized = normalizeSaveGameState(saveGame);
  const result = applyInspiringLeaderDeparture(normalized);
  return { ok: true, saveGame: result.saveGame, departure, inspiringLeader: result.summary };
}

function applyInspiringLeaderDeparture(saveGame) {
  if (saveGame.metadata?.emberLongRestPending !== true) {
    return { saveGame, summary: null };
  }
  const slot = saveGame.party.activeSlot;
  const record = saveGame.party.characterRecords[slot];
  const feature = record?.resolvedCharacterSheet?.features?.find((candidate) => (
    candidate.id === "inspiring_leader" || candidate.grants?.featId === "inspiring_leader"
  ));
  const next = structuredClone(saveGame);
  next.metadata.emberLongRestPending = false;
  if (!feature || !record?.runtime) return { saveGame: next, summary: null };

  const sheet = record.resolvedCharacterSheet;
  const chosenAbility = sheet.metadata?.featChoices?.inspiring_leader?.ability || "charisma";
  const abilityModifier = sheet.abilities?.[chosenAbility]?.modifier || 0;
  const amount = Math.max(0, (sheet.identity?.level || 1) + abilityModifier);
  const affected = [];
  const nextRecord = next.party.characterRecords[slot];
  nextRecord.runtime.tempHp = Math.max(nextRecord.runtime.tempHp || 0, amount);
  if (nextRecord.actorInstance?.state) nextRecord.actorInstance.state.tempHp = Math.max(nextRecord.actorInstance.state.tempHp || 0, amount);
  if (next.party.actorInstances[slot]?.state) next.party.actorInstances[slot].state.tempHp = Math.max(next.party.actorInstances[slot].state.tempHp || 0, amount);
  affected.push(nextRecord.id);

  for (const companionId of next.party.companions.activeIds) {
    const companion = next.party.companions.recruited[companionId];
    if (!companion?.instance?.state) continue;
    companion.instance.state.tempHp = Math.max(companion.instance.state.tempHp || 0, amount);
    affected.push(companionId);
  }
  return { saveGame: next, summary: { amount, affected } };
}
