import {
  DEFAULT_CHARACTER_SLOT,
  loadCharacterRecord,
  recoverCharacterRecord,
  saveCharacterDraft,
  updateCharacterRecordFromCombatActor,
} from "./characterRepository.js";

export function createCharacterLifecycleState(options = {}) {
  return {
    activeSlot: options.activeSlot || DEFAULT_CHARACTER_SLOT,
    partySlots: options.partySlots || [options.activeSlot || DEFAULT_CHARACTER_SLOT],
    lastCombatResult: options.lastCombatResult || null,
  };
}

export function saveActiveCharacterDraft(draft, options = {}) {
  const lifecycle = options.lifecycle || createCharacterLifecycleState(options);
  return saveCharacterDraft(draft, {
    ...options,
    slot: options.slot || lifecycle.activeSlot,
  });
}

export function loadActiveCharacterRecord(options = {}) {
  const lifecycle = options.lifecycle || createCharacterLifecycleState(options);
  return loadCharacterRecord({
    store: options.store,
    slot: options.slot || lifecycle.activeSlot,
  });
}

export function applyCombatResultToCharacterStore(options = {}) {
  const lifecycle = options.lifecycle || createCharacterLifecycleState(options);
  const slot = options.slot || lifecycle.activeSlot;
  const record = loadCharacterRecord({ store: options.store, slot });
  if (!record) return null;
  const actor = findCharacterActor(options.snapshot, options.actorId || "generated_pc");
  if (!actor) return record;
  const updated = updateCharacterRecordFromCombatActor(record, actor, options);
  options.store?.save(updated);
  lifecycle.lastCombatResult = createCombatLifecycleResult(options.snapshot, actor);
  return updated;
}

export function restCharacterStore(options = {}) {
  const lifecycle = options.lifecycle || createCharacterLifecycleState(options);
  const slot = options.slot || lifecycle.activeSlot;
  const record = loadCharacterRecord({ store: options.store, slot });
  if (!record) return null;
  const recovered = recoverCharacterRecord(record, options.restType || "long_rest", options);
  options.store?.save(recovered);
  return recovered;
}

export function createCombatLifecycleResult(snapshot, actor) {
  return {
    outcome: snapshot?.outcome || null,
    round: snapshot?.round || null,
    actorId: actor?.id || null,
    hp: actor?.hp ?? null,
    maxHp: actor?.maxHp ?? null,
    defeated: actor?.defeated === true || actor?.hp <= 0,
  };
}

function findCharacterActor(snapshot, actorId) {
  if (!snapshot?.actors?.length) return null;
  return snapshot.actors.find((actor) => actor.id === actorId) ||
    snapshot.actors.find((actor) => actor.team === "heroes") ||
    null;
}
