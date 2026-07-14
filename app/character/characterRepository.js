import { createCharacterPipelineExport } from "./characterPipelineExport.js";
import {
  combatActorToActorInstance,
  resolvedSheetToActorDefinition,
} from "../actors/actorAdapters.js";
import { resolveActorToCombatActor } from "../actors/actorContract.js";

export const CHARACTER_RECORD_VERSION = 2;
export const DEFAULT_CHARACTER_SLOT = "active";
export const DEFAULT_CHARACTER_STORAGE_NAMESPACE = "dndt.character.";

export function createCharacterRecord(draft, options = {}) {
  const slot = options.slot || DEFAULT_CHARACTER_SLOT;
  const pipelineExport = createCharacterPipelineExport(draft, {
    actorOptions: options.actorOptions,
    registries: options.registries,
    resolveOptions: options.resolveOptions,
  });
  const valid = Boolean(pipelineExport.validityReport?.valid && pipelineExport.combatActor);
  const actorDefinition = valid
    ? resolvedSheetToActorDefinition(pipelineExport.resolvedCharacterSheet, pipelineExport.combatActor, {
        id: options.definitionId,
        kind: options.kind || "player",
      })
    : null;
  const actorInstance = valid
    ? combatActorToActorInstance(pipelineExport.combatActor, actorDefinition.id)
    : null;
  return {
    version: CHARACTER_RECORD_VERSION,
    id: options.id || stableCharacterId(pipelineExport.characterDraft),
    slot,
    status: valid ? "ready" : "invalid",
    savedAt: options.savedAt || new Date().toISOString(),
    characterDraft: pipelineExport.characterDraft,
    resolvedCharacterSheet: pipelineExport.resolvedCharacterSheet,
    combatActor: pipelineExport.combatActor,
    actorDefinition,
    actorInstance,
    runtime: createCharacterRuntimeState(pipelineExport.combatActor),
    validityReport: pipelineExport.validityReport,
    preview: pipelineExport.preview,
  };
}

export function createCharacterMemoryStore(initialRecords = []) {
  const records = new Map();
  for (const record of initialRecords) records.set(record.slot || DEFAULT_CHARACTER_SLOT, normalizeCharacterRecord(record));
  return {
    save(record) {
      const normalized = normalizeCharacterRecord(record);
      records.set(normalized.slot, normalized);
      return structuredClone(normalized);
    },
    load(slot = DEFAULT_CHARACTER_SLOT) {
      const record = records.get(slot);
      return record ? structuredClone(record) : null;
    },
    list() {
      return Array.from(records.values()).map(characterRecordSummary);
    },
    clear(slot = DEFAULT_CHARACTER_SLOT) {
      return records.delete(slot);
    },
  };
}

export function createBrowserCharacterStore(storage = globalThis.localStorage, namespace = DEFAULT_CHARACTER_STORAGE_NAMESPACE) {
  if (!storage) return createCharacterMemoryStore();
  return {
    save(record) {
      const normalized = normalizeCharacterRecord(record);
      storage.setItem(storageKey(namespace, normalized.slot), JSON.stringify(normalized));
      return structuredClone(normalized);
    },
    load(slot = DEFAULT_CHARACTER_SLOT) {
      const raw = storage.getItem(storageKey(namespace, slot));
      return raw ? normalizeCharacterRecord(JSON.parse(raw)) : null;
    },
    list() {
      return storageKeys(storage)
        .filter((key) => key.startsWith(namespace))
        .map((key) => this.load(key.slice(namespace.length)))
        .filter(Boolean)
        .map(characterRecordSummary);
    },
    clear(slot = DEFAULT_CHARACTER_SLOT) {
      storage.removeItem(storageKey(namespace, slot));
      return true;
    },
  };
}

export function saveCharacterDraft(draft, options = {}) {
  const store = options.store || createCharacterMemoryStore();
  const record = createCharacterRecord(draft, options);
  return store.save(record);
}

export function loadCharacterRecord(options = {}) {
  return options.store ? options.store.load(options.slot || DEFAULT_CHARACTER_SLOT) : null;
}

export function loadCombatActorFromCharacter(options = {}) {
  const record = options.record || loadCharacterRecord(options);
  if (!record || record.status !== "ready") return null;
  if (record.actorDefinition && record.actorInstance) {
    const instance = applyRuntimeStateToActorInstance(record.actorInstance, record.runtime);
    return resolveActorToCombatActor(record.actorDefinition, instance);
  }
  if (!record.combatActor) return null;
  return applyRuntimeStateToCombatActor(record.combatActor, record.runtime);
}

export function createCharacterRuntimeState(actor) {
  if (!actor) return null;
  return {
    hp: actor.hp,
    maxHp: actor.maxHp,
    tempHp: actor.tempHp || 0,
    defeated: actor.defeated === true || actor.hp <= 0,
    spellSlots: structuredClone(actor.spellSlots || {}),
    resources: structuredClone(actor.resources || []),
    inventory: structuredClone(actor.inventory || []),
    conditions: structuredClone(actor.conditions || []),
    activeEffects: structuredClone(actor.activeEffects || []),
    marks: structuredClone(actor.marks || []),
    luck: actor.luck ? structuredClone(actor.luck) : null,
  };
}

export function applyRuntimeStateToCombatActor(actor, runtime) {
  if (!actor || !runtime) return structuredClone(actor);
  const hp = Number.isFinite(runtime.hp) ? runtime.hp : actor.hp;
  return {
    ...structuredClone(actor),
    hp,
    maxHp: Number.isFinite(runtime.maxHp) ? runtime.maxHp : actor.maxHp,
    tempHp: runtime.tempHp || 0,
    spellSlots: structuredClone(runtime.spellSlots || actor.spellSlots || {}),
    resources: structuredClone(runtime.resources || actor.resources || []),
    inventory: structuredClone(runtime.inventory || actor.inventory || []),
    conditions: structuredClone(runtime.conditions || []),
    activeEffects: structuredClone(runtime.activeEffects || actor.activeEffects || []),
    marks: structuredClone(runtime.marks || []),
    luck: runtime.luck ? structuredClone(runtime.luck) : actor.luck,
    defeated: runtime.defeated === true || hp <= 0,
  };
}

export function updateCharacterRecordFromCombatActor(record, actor, options = {}) {
  const normalized = normalizeCharacterRecord(record);
  if (!actor || actor.team !== "heroes") return normalized;
  return normalizeCharacterRecord({
    ...normalized,
    savedAt: options.savedAt || new Date().toISOString(),
    runtime: createCharacterRuntimeState(actor),
    actorInstance: normalized.actorDefinition
      ? combatActorToActorInstance(actor, normalized.actorDefinition.id)
      : normalized.actorInstance,
  });
}

export function recoverCharacterRecord(record, restType = "long_rest", options = {}) {
  const normalized = normalizeCharacterRecord(record);
  if (normalized.status !== "ready" || !normalized.combatActor) return normalized;
  const actor = applyRuntimeStateToCombatActor(normalized.combatActor, normalized.runtime);
  const recovered = recoverCombatActor(actor, restType);
  return normalizeCharacterRecord({
    ...normalized,
    savedAt: options.savedAt || new Date().toISOString(),
    runtime: createCharacterRuntimeState(recovered),
  });
}

export function normalizeCharacterRecord(record) {
  if (!record || typeof record !== "object") throw new Error("CharacterRecord must be an object");
  if (!record.characterDraft) throw new Error("CharacterRecord.characterDraft is required");
  if (!record.resolvedCharacterSheet) throw new Error("CharacterRecord.resolvedCharacterSheet is required");
  const combatActor = record.combatActor ? structuredClone(record.combatActor) : null;
  const actorDefinition = record.actorDefinition
    ? structuredClone(record.actorDefinition)
    : combatActor
      ? resolvedSheetToActorDefinition(record.resolvedCharacterSheet, combatActor, {
          id: `character.${record.id || stableCharacterId(record.characterDraft)}`,
          kind: "player",
        })
      : null;
  const actorInstance = record.actorInstance
    ? structuredClone(record.actorInstance)
    : combatActor && actorDefinition
      ? combatActorToActorInstance(combatActor, actorDefinition.id)
      : null;
  return {
    version: CHARACTER_RECORD_VERSION,
    id: record.id || stableCharacterId(record.characterDraft),
    slot: record.slot || DEFAULT_CHARACTER_SLOT,
    status: record.status === "ready" && record.combatActor ? "ready" : "invalid",
    savedAt: record.savedAt || new Date().toISOString(),
    characterDraft: structuredClone(record.characterDraft),
    resolvedCharacterSheet: structuredClone(record.resolvedCharacterSheet),
    combatActor,
    actorDefinition,
    actorInstance,
    runtime: structuredClone(record.runtime || createCharacterRuntimeState(record.combatActor)),
    validityReport: structuredClone(record.validityReport || null),
    preview: structuredClone(record.preview || null),
  };
}

function applyRuntimeStateToActorInstance(instance, runtime) {
  if (!instance || !runtime) return structuredClone(instance);
  return {
    ...structuredClone(instance),
    state: {
      ...(instance.state || {}),
      hp: runtime.hp,
      maxHp: runtime.maxHp,
      tempHp: runtime.tempHp || 0,
      defeated: runtime.defeated === true,
      spellSlots: structuredClone(runtime.spellSlots || {}),
      resources: structuredClone(runtime.resources || []),
      inventory: structuredClone(runtime.inventory || []),
      conditions: structuredClone(runtime.conditions || []),
      activeEffects: structuredClone(runtime.activeEffects || []),
      marks: structuredClone(runtime.marks || []),
      luck: structuredClone(runtime.luck || null),
    },
  };
}

function characterRecordSummary(record) {
  return {
    id: record.id,
    slot: record.slot,
    status: record.status,
    savedAt: record.savedAt,
    characterName: record.resolvedCharacterSheet?.identity?.characterName || record.characterDraft?.identity?.characterName || "",
    level: record.resolvedCharacterSheet?.identity?.level || record.characterDraft?.identity?.level || null,
    classId: record.resolvedCharacterSheet?.identity?.classId || record.characterDraft?.identity?.classId || null,
  };
}

function stableCharacterId(draft) {
  return slug(draft?.identity?.characterName || "character");
}

function recoverCombatActor(actor, restType) {
  const recovered = structuredClone(actor);
  if (restType === "long_rest") {
    recovered.hp = recovered.maxHp;
    recovered.tempHp = 0;
    recovered.defeated = false;
    recovered.conditions = [];
    recovered.activeEffects = (recovered.activeEffects || []).filter((effect) => effect.persistThroughLongRest);
    recovered.marks = [];
    if (recovered.luck) {
      recovered.luck.points = recovered.luck.max ?? recovered.luck.points;
      recovered.luck.usedThisCombat = false;
    }
  }
  recovered.resources = recoverResources(recovered.resources || [], restType);
  recovered.spellSlots = recoverSpellSlots(recovered.spellSlots || {}, restType);
  return recovered;
}

function recoverResources(resources, restType) {
  return resources.map((resource) => {
    if (resource.recovery !== restType && !(restType === "long_rest" && resource.recovery === "short_rest")) return resource;
    return { ...resource, current: resource.max };
  });
}

function recoverSpellSlots(slots, restType) {
  return Object.fromEntries(Object.entries(slots || {}).map(([level, slot]) => {
    const recovery = slot.recovery || "long_rest";
    if (recovery !== restType && !(restType === "long_rest" && recovery === "short_rest")) return [level, slot];
    return [level, { ...slot, current: slot.max, used: 0 }];
  }));
}

function storageKey(namespace, slot) {
  return `${namespace}${slot || DEFAULT_CHARACTER_SLOT}`;
}

function storageKeys(storage) {
  if (typeof storage.key === "function" && Number.isFinite(storage.length)) {
    return Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(Boolean);
  }
  return Object.keys(storage);
}

function slug(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "character";
}
