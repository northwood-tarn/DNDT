import {
  DEFAULT_CHARACTER_SLOT,
  normalizeCharacterRecord,
  recoverCharacterRecord,
  updateCharacterRecordFromCombatActor,
} from "../character/characterRepository.js";

export const SAVE_GAME_SCHEMA_VERSION = 1;
export const DEFAULT_SAVE_GAME_SLOT = "autosave";

export function createEmptySaveGameState(options = {}) {
  const activeSlot = options.activeSlot || DEFAULT_CHARACTER_SLOT;
  return normalizeSaveGameState({
    schemaVersion: SAVE_GAME_SCHEMA_VERSION,
    runId: options.runId || createRunId(),
    savedAt: options.savedAt || new Date().toISOString(),
    party: {
      activeSlot,
      slots: options.partySlots || [activeSlot],
      characterRecords: {},
    },
    world: {
      flags: {},
      visitedAreas: {},
      location: null,
    },
    rests: {
      shortRestsUsed: {},
      hungryStreak: {},
    },
    inventory: {
      shared: [],
    },
    encounter: {
      activeEncounterId: null,
      activeScenarioId: null,
      state: null,
      lastOutcome: null,
    },
    metadata: options.metadata || {},
    ...options.overrides,
  });
}

export function createSaveGameFromCharacterRecord(record, options = {}) {
  const slot = options.slot || record?.slot || DEFAULT_CHARACTER_SLOT;
  return upsertCharacterRecord(createEmptySaveGameState({ ...options, activeSlot: slot }), slot, record);
}

export function normalizeSaveGameState(saveGame) {
  if (!saveGame || typeof saveGame !== "object") throw new Error("SaveGameState must be an object");
  const activeSlot = saveGame.party?.activeSlot || DEFAULT_CHARACTER_SLOT;
  const slots = unique([activeSlot, ...(saveGame.party?.slots || [])]);
  const characterRecords = {};
  for (const [slot, record] of Object.entries(saveGame.party?.characterRecords || {})) {
    if (record) characterRecords[slot] = normalizeCharacterRecord({ ...record, slot });
  }
  return {
    schemaVersion: saveGame.schemaVersion || SAVE_GAME_SCHEMA_VERSION,
    runId: saveGame.runId || createRunId(),
    savedAt: saveGame.savedAt || new Date().toISOString(),
    party: {
      activeSlot,
      slots,
      characterRecords,
    },
    world: {
      flags: { ...(saveGame.world?.flags || {}) },
      visitedAreas: { ...(saveGame.world?.visitedAreas || {}) },
      location: saveGame.world?.location ? structuredClone(saveGame.world.location) : null,
    },
    rests: {
      shortRestsUsed: { ...(saveGame.rests?.shortRestsUsed || {}) },
      hungryStreak: { ...(saveGame.rests?.hungryStreak || {}) },
    },
    inventory: {
      shared: structuredClone(saveGame.inventory?.shared || []),
    },
    encounter: {
      activeEncounterId: saveGame.encounter?.activeEncounterId || null,
      activeScenarioId: saveGame.encounter?.activeScenarioId || null,
      state: saveGame.encounter?.state ? structuredClone(saveGame.encounter.state) : null,
      lastOutcome: saveGame.encounter?.lastOutcome ? structuredClone(saveGame.encounter.lastOutcome) : null,
    },
    metadata: structuredClone(saveGame.metadata || {}),
  };
}

export function upsertCharacterRecord(saveGame, slot, record) {
  const normalized = normalizeSaveGameState(saveGame);
  const normalizedRecord = normalizeCharacterRecord({ ...record, slot });
  return touchSaveGame({
    ...normalized,
    party: {
      ...normalized.party,
      activeSlot: normalized.party.activeSlot || slot,
      slots: unique([...normalized.party.slots, slot]),
      characterRecords: {
        ...normalized.party.characterRecords,
        [slot]: normalizedRecord,
      },
    },
  });
}

export function getActiveCharacterRecord(saveGame) {
  const normalized = normalizeSaveGameState(saveGame);
  return normalized.party.characterRecords[normalized.party.activeSlot] || null;
}

export function setActivePartySlot(saveGame, slot) {
  const normalized = normalizeSaveGameState(saveGame);
  return touchSaveGame({
    ...normalized,
    party: {
      ...normalized.party,
      activeSlot: slot,
      slots: unique([...normalized.party.slots, slot]),
    },
  });
}

export function applyCombatResultToSaveGame(saveGame, options = {}) {
  const normalized = normalizeSaveGameState(saveGame);
  const slot = options.slot || normalized.party.activeSlot;
  const record = normalized.party.characterRecords[slot];
  if (!record) return normalized;
  const actor = findCombatActor(options.snapshot, options.actorId || "generated_pc");
  if (!actor) return normalized;
  const updatedRecord = updateCharacterRecordFromCombatActor(record, actor, options);
  return touchSaveGame({
    ...normalized,
    party: {
      ...normalized.party,
      characterRecords: {
        ...normalized.party.characterRecords,
        [slot]: updatedRecord,
      },
    },
    encounter: {
      ...normalized.encounter,
      lastOutcome: createEncounterOutcome(options.snapshot, actor),
    },
  });
}

export function restSaveGame(saveGame, options = {}) {
  const normalized = normalizeSaveGameState(saveGame);
  const slot = options.slot || normalized.party.activeSlot;
  const record = normalized.party.characterRecords[slot];
  if (!record) return normalized;
  const restType = options.restType || "long_rest";
  const rested = recoverCharacterRecord(record, restType, options);
  const rests = updateRestState(normalized.rests, slot, restType);
  return touchSaveGame({
    ...normalized,
    rests,
    party: {
      ...normalized.party,
      characterRecords: {
        ...normalized.party.characterRecords,
        [slot]: rested,
      },
    },
  });
}

export function setStoryFlag(saveGame, flagId, value = true) {
  const normalized = normalizeSaveGameState(saveGame);
  return touchSaveGame({
    ...normalized,
    world: {
      ...normalized.world,
      flags: {
        ...normalized.world.flags,
        [flagId]: value,
      },
    },
  });
}

export function clearStoryFlag(saveGame, flagId) {
  const normalized = normalizeSaveGameState(saveGame);
  const flags = { ...normalized.world.flags };
  delete flags[flagId];
  return touchSaveGame({ ...normalized, world: { ...normalized.world, flags } });
}

export function hasStoryFlag(saveGame, flagId) {
  return normalizeSaveGameState(saveGame).world.flags[flagId] === true;
}

export function setSaveGameLocation(saveGame, location) {
  const normalized = normalizeSaveGameState(saveGame);
  const areaId = location?.areaId || location?.area || null;
  const visitedAreas = areaId ? { ...normalized.world.visitedAreas, [areaId]: true } : normalized.world.visitedAreas;
  return touchSaveGame({
    ...normalized,
    world: {
      ...normalized.world,
      visitedAreas,
      location: location ? structuredClone(location) : null,
    },
  });
}

export function setActiveEncounterState(saveGame, encounterState = {}) {
  const normalized = normalizeSaveGameState(saveGame);
  return touchSaveGame({
    ...normalized,
    encounter: {
      ...normalized.encounter,
      activeEncounterId: encounterState.encounterId || encounterState.activeEncounterId || null,
      activeScenarioId: encounterState.scenarioId || encounterState.activeScenarioId || null,
      state: structuredClone(encounterState.state || encounterState),
    },
  });
}

export function clearActiveEncounterState(saveGame, outcome = null) {
  const normalized = normalizeSaveGameState(saveGame);
  return touchSaveGame({
    ...normalized,
    encounter: {
      activeEncounterId: null,
      activeScenarioId: null,
      state: null,
      lastOutcome: outcome ? structuredClone(outcome) : normalized.encounter.lastOutcome,
    },
  });
}

export function validateSaveGameState(saveGame) {
  const errors = [];
  let normalized = null;
  try {
    normalized = normalizeSaveGameState(saveGame);
  } catch (error) {
    return { valid: false, errors: [error.message] };
  }
  if (normalized.schemaVersion !== SAVE_GAME_SCHEMA_VERSION) errors.push(`schemaVersion must be ${SAVE_GAME_SCHEMA_VERSION}`);
  if (!normalized.runId) errors.push("runId is required");
  if (!normalized.party.activeSlot) errors.push("party.activeSlot is required");
  for (const slot of normalized.party.slots) {
    const record = normalized.party.characterRecords[slot];
    if (record && record.slot !== slot) errors.push(`party.characterRecords.${slot}.slot must match its party slot`);
  }
  if (normalized.encounter.state && !normalized.encounter.activeEncounterId && !normalized.encounter.activeScenarioId) {
    errors.push("encounter.state requires activeEncounterId or activeScenarioId");
  }
  return { valid: errors.length === 0, errors, saveGame: normalized };
}

function touchSaveGame(saveGame) {
  return { ...normalizeSaveGameState(saveGame), savedAt: new Date().toISOString() };
}

function updateRestState(rests, slot, restType) {
  if (restType === "short_rest") {
    return {
      ...rests,
      shortRestsUsed: {
        ...rests.shortRestsUsed,
        [slot]: (rests.shortRestsUsed[slot] || 0) + 1,
      },
    };
  }
  if (restType === "long_rest") {
    return {
      ...rests,
      shortRestsUsed: { ...rests.shortRestsUsed, [slot]: 0 },
      hungryStreak: { ...rests.hungryStreak, [slot]: 0 },
    };
  }
  return rests;
}

function createEncounterOutcome(snapshot, actor) {
  return {
    outcome: snapshot?.outcome || null,
    round: snapshot?.round || null,
    actorId: actor?.id || null,
    hp: actor?.hp ?? null,
    maxHp: actor?.maxHp ?? null,
    defeated: actor?.defeated === true || actor?.hp <= 0,
  };
}

function findCombatActor(snapshot, actorId) {
  if (!snapshot?.actors?.length) return null;
  return snapshot.actors.find((actor) => actor.id === actorId) ||
    snapshot.actors.find((actor) => actor.team === "heroes") ||
    null;
}

function createRunId() {
  return `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}
