import {
  DEFAULT_CHARACTER_SLOT,
  normalizeCharacterRecord,
  recoverCharacterRecord,
  updateCharacterRecordFromCombatActor,
} from "../character/characterRepository.js";
import { levelUpCharacterRecord } from "../character/levelUpTransaction.js";
import {
  createActorDefinition,
  createActorInstance,
  validateActorDefinition,
  validateActorInstance,
} from "../actors/actorContract.js";
import { combatActorToActorInstance } from "../actors/actorAdapters.js";

export const SAVE_GAME_SCHEMA_VERSION = 2;
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
      actorInstances: {},
      companions: { recruited: {}, activeIds: [] },
    },
    world: {
      flags: {},
      visitedAreas: {},
      discovery: {},
      traversal: {},
      routeStack: [],
      location: null,
    },
    quests: {},
    rests: {
      shortRestsUsed: {},
      hungryStreak: {},
    },
    inventory: {
      shared: [],
      currency: { gold: options.initialGold || 0 },
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
  const actorInstances = {};
  for (const slot of slots) {
    const explicit = saveGame.party?.actorInstances?.[slot];
    const fromRecord = characterRecords[slot]?.actorInstance;
    if (explicit || fromRecord) actorInstances[slot] = structuredClone(explicit || fromRecord);
  }
  const companions = normalizeCompanions(saveGame.party?.companions);
  return {
    schemaVersion: SAVE_GAME_SCHEMA_VERSION,
    runId: saveGame.runId || createRunId(),
    savedAt: saveGame.savedAt || new Date().toISOString(),
    party: {
      activeSlot,
      slots,
      characterRecords,
      actorInstances,
      companions,
    },
    world: {
      flags: { ...(saveGame.world?.flags || {}) },
      visitedAreas: { ...(saveGame.world?.visitedAreas || {}) },
      discovery: structuredClone(saveGame.world?.discovery || {}),
      traversal: structuredClone(saveGame.world?.traversal || {}),
      routeStack: structuredClone(saveGame.world?.routeStack || []),
      location: saveGame.world?.location ? structuredClone(saveGame.world.location) : null,
      npcServices: structuredClone(saveGame.world?.npcServices || {}),
      fixedEncounterTriggers: structuredClone(saveGame.world?.fixedEncounterTriggers || {}),
    },
    rests: {
      shortRestsUsed: { ...(saveGame.rests?.shortRestsUsed || {}) },
      hungryStreak: { ...(saveGame.rests?.hungryStreak || {}) },
    },
    inventory: {
      shared: structuredClone(saveGame.inventory?.shared || []),
      currency: {
        gold: Math.max(0, Number(saveGame.inventory?.currency?.gold ?? saveGame.inventory?.gold ?? 0) || 0),
      },
    },
    encounter: {
      activeEncounterId: saveGame.encounter?.activeEncounterId || null,
      activeScenarioId: saveGame.encounter?.activeScenarioId || null,
      state: saveGame.encounter?.state ? structuredClone(saveGame.encounter.state) : null,
      lastOutcome: saveGame.encounter?.lastOutcome ? structuredClone(saveGame.encounter.lastOutcome) : null,
    },
    quests: structuredClone(saveGame.quests || {}),
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
      actorInstances: {
        ...normalized.party.actorInstances,
        ...(normalizedRecord.actorInstance ? { [slot]: normalizedRecord.actorInstance } : {}),
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

export function recruitCompanion(saveGame, definitionInput, instanceInput = {}, options = {}) {
  const normalized = normalizeSaveGameState(saveGame);
  const definition = createActorDefinition({ ...definitionInput, kind: "companion" });
  const instance = createActorInstance({
    ...instanceInput,
    id: instanceInput.id || options.id || definition.id,
    definitionId: definition.id,
    kind: "companion",
    team: "heroes",
  });
  const errors = [...validateActorDefinition(definition), ...validateActorInstance(instance, { definition })];
  if (errors.length) throw new Error(`Cannot recruit invalid companion: ${errors.join("; ")}`);
  const recruited = {
    ...normalized.party.companions.recruited,
    [instance.id]: {
      id: instance.id,
      definition,
      instance,
      recruitedAt: options.recruitedAt || normalized.world.location || null,
    },
  };
  const activeIds = options.joinActive !== false && normalized.party.companions.activeIds.length < 2
    ? unique([...normalized.party.companions.activeIds, instance.id])
    : normalized.party.companions.activeIds;
  return touchSaveGame({
    ...normalized,
    party: { ...normalized.party, companions: { recruited, activeIds } },
  });
}

export function setActiveCompanions(saveGame, companionIds, options = {}) {
  const normalized = normalizeSaveGameState(saveGame);
  if (options.atEmber !== true) throw new Error("Active companions can only be changed at an ember");
  const activeIds = unique(companionIds || []);
  if (activeIds.length > 2) throw new Error("The party can include at most two companions");
  for (const id of activeIds) {
    if (!normalized.party.companions.recruited[id]) throw new Error(`Companion ${id} has not been recruited`);
  }
  return touchSaveGame({
    ...normalized,
    party: { ...normalized.party, companions: { ...normalized.party.companions, activeIds } },
  });
}

export function getRecruitedCompanions(saveGame) {
  return Object.values(normalizeSaveGameState(saveGame).party.companions.recruited).map((record) => structuredClone(record));
}

export function getActiveCompanions(saveGame) {
  const companions = normalizeSaveGameState(saveGame).party.companions;
  return companions.activeIds.map((id) => structuredClone(companions.recruited[id])).filter(Boolean);
}

export function applyCombatResultToSaveGame(saveGame, options = {}) {
  const normalized = normalizeSaveGameState(saveGame);
  const slot = options.slot || normalized.party.activeSlot;
  const record = normalized.party.characterRecords[slot];
  const actor = findCombatActor(options.snapshot, options.actorId || "generated_pc");
  const updatedRecord = record && actor ? updateCharacterRecordFromCombatActor(record, actor, options) : record;
  const companions = updateCompanionsFromCombat(normalized.party.companions, options.snapshot);
  return touchSaveGame({
    ...normalized,
    party: {
      ...normalized.party,
      characterRecords: {
        ...normalized.party.characterRecords,
        ...(updatedRecord ? { [slot]: updatedRecord } : {}),
      },
      actorInstances: {
        ...normalized.party.actorInstances,
        ...(updatedRecord?.actorInstance ? { [slot]: updatedRecord.actorInstance } : {}),
      },
      companions,
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
  if (restType === "long_rest" && options.atEmber !== true && options.sleepingService !== true) {
    throw new Error("Long rests can only be taken at an ember or through an NPC sleeping service");
  }
  const rested = recoverCharacterRecord(record, restType, options);
  const rests = updateRestState(normalized.rests, slot, restType);
  return touchSaveGame({
    ...normalized,
    rests,
    metadata: {
      ...normalized.metadata,
      emberLongRestPending: restType === "long_rest" && options.atEmber === true,
    },
    party: {
      ...normalized.party,
      characterRecords: {
        ...normalized.party.characterRecords,
        [slot]: rested,
      },
      actorInstances: {
        ...normalized.party.actorInstances,
        ...(rested.actorInstance ? { [slot]: rested.actorInstance } : {}),
      },
    },
  });
}

export function levelUpSaveGame(saveGame, options = {}) {
  const normalized = normalizeSaveGameState(saveGame);
  const slot = options.slot || normalized.party.activeSlot;
  const record = normalized.party.characterRecords[slot];
  if (!record) throw new Error(`No character record found in party slot ${slot}`);
  const updatedRecord = levelUpCharacterRecord(record, options.values || {}, options);
  return touchSaveGame({
    ...normalized,
    party: {
      ...normalized.party,
      characterRecords: { ...normalized.party.characterRecords, [slot]: updatedRecord },
      actorInstances: { ...normalized.party.actorInstances, [slot]: updatedRecord.actorInstance },
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
    const instance = normalized.party.actorInstances[slot];
    if (record?.actorInstance && instance?.id !== record.actorInstance.id) {
      errors.push(`party.actorInstances.${slot}.id must match its character record actor instance`);
    }
  }
  if (normalized.party.companions.activeIds.length > 2) errors.push("party.companions.activeIds cannot contain more than two companions");
  for (const id of normalized.party.companions.activeIds) {
    if (!normalized.party.companions.recruited[id]) errors.push(`active companion ${id} must be recruited`);
  }
  for (const [id, companion] of Object.entries(normalized.party.companions.recruited)) {
    if (companion.id !== id) errors.push(`party.companions.recruited.${id}.id must match its key`);
    errors.push(...validateActorDefinition(companion.definition).map((error) => `companion ${id} definition: ${error}`));
    errors.push(...validateActorInstance(companion.instance, { definition: companion.definition }).map((error) => `companion ${id} instance: ${error}`));
  }
  if (normalized.encounter.state && !normalized.encounter.activeEncounterId && !normalized.encounter.activeScenarioId) {
    errors.push("encounter.state requires activeEncounterId or activeScenarioId");
  }
  return { valid: errors.length === 0, errors, saveGame: normalized };
}

function touchSaveGame(saveGame) {
  return { ...normalizeSaveGameState(saveGame), savedAt: new Date().toISOString() };
}

function normalizeCompanions(input = {}) {
  const recruited = {};
  for (const [id, record] of Object.entries(input?.recruited || {})) {
    if (!record?.definition || !record?.instance) continue;
    recruited[id] = {
      id,
      definition: createActorDefinition({ ...record.definition, kind: "companion" }),
      instance: createActorInstance({ ...record.instance, id, definitionId: record.definition.id, kind: "companion", team: "heroes" }),
      recruitedAt: record.recruitedAt ? structuredClone(record.recruitedAt) : null,
    };
  }
  return { recruited, activeIds: unique(input?.activeIds || []).filter((id) => recruited[id]).slice(0, 2) };
}

function updateCompanionsFromCombat(companions, snapshot) {
  const updated = normalizeCompanions(companions);
  for (const id of updated.activeIds) {
    const record = updated.recruited[id];
    const actor = snapshot?.actors?.find((candidate) => candidate.id === record.instance.id);
    if (!actor) continue;
    const revived = actor.hp <= 0 ? { ...actor, hp: 1, defeated: false } : actor;
    record.instance = combatActorToActorInstance(revived, record.definition.id, { id: record.instance.id, team: "heroes" });
  }
  return updated;
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
