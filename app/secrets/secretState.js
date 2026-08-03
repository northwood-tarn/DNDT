import { normalizeSaveGameState } from "../state/saveGameState.js";
import { createSecretDefinition, getSecretClue, validateSecretDefinition } from "./secretDefinition.js";

export function getSecretRecord(saveGame, secretId) {
  return structuredClone(normalizeSaveGameState(saveGame).world.secrets[secretId] || emptyRecord(secretId));
}

export function getEffectiveClueCount(saveGame, definition, options = {}) {
  const record = getSecretRecord(saveGame, definition.id);
  return record.clueIds.length + (hasTesseraBonus(saveGame, options) ? 1 : 0);
}

export function acquireSecretClue(saveGame, definitionInput, clueId, options = {}) {
  const definition = requireDefinition(definitionInput);
  const clue = getSecretClue(definition, clueId);
  if (!clue) throw new Error(`Unknown clue ${clueId} for ${definition.id}`);
  let save = normalizeSaveGameState(saveGame);
  const previous = getSecretRecord(save, definition.id);
  if (previous.stage !== "hidden" && previous.stage !== "searching") return result(save, previous, false);
  if (previous.clueIds.includes(clueId)) return result(save, previous, false);
  const at = options.occurredAt || new Date().toISOString();
  let record = { ...previous, stage: "searching", clueIds: [...previous.clueIds, clueId], updatedAt: at, events: [...previous.events, { type: "clue.acquired", clueId, at }] };
  save = write(save, record);
  save = addUniqueInventoryItem(save, clueId);
  if (getEffectiveClueCount(save, definition, options) >= definition.clueThreshold) return uncoverSecret(save, definition, options);
  return result(save, record, true, [{ type: "secret.clue.acquired", secretId: definition.id, clueId }]);
}

export function uncoverSecret(saveGame, definitionInput, options = {}) {
  const definition = requireDefinition(definitionInput);
  let save = normalizeSaveGameState(saveGame);
  const previous = getSecretRecord(save, definition.id);
  if (["uncovered", "unlocked", "completed"].includes(previous.stage)) return result(save, previous, false);
  if (options.force !== true && getEffectiveClueCount(save, definition, options) < definition.clueThreshold) throw new Error(`${definition.id} does not have enough clues`);
  const at = options.occurredAt || new Date().toISOString();
  const record = { ...previous, stage: "uncovered", clueIds: [], disabledClueIds: definition.clues.map((clue) => clue.id), uncoveredAt: at, updatedAt: at, events: [...previous.events, { type: "secret.uncovered", at }] };
  save = write(save, record);
  save = replaceCluesWithRewards(save, definition);
  const applied = applySecretEffects(save, definition.effects.uncovered, options);
  return result(applied.saveGame, record, true, [
    { type: "secret.uncovered", secretId: definition.id, message: `You have uncovered a secret at ${definition.target.label}` },
    ...applied.events,
  ]);
}

export function unlockSecret(saveGame, definitionInput, options = {}) {
  const definition = requireDefinition(definitionInput);
  let save = normalizeSaveGameState(saveGame);
  const previous = getSecretRecord(save, definition.id);
  if (["unlocked", "completed"].includes(previous.stage)) return result(save, previous, false);
  if (previous.stage !== "uncovered") throw new Error(`${definition.id} must be uncovered before it can be unlocked`);
  const missing = definition.unlockRequirements.filter((requirement) => !requirementMet(save, requirement, options));
  if (missing.length) throw new Error(`Unlock requirements not met for ${definition.id}`);
  const at = options.occurredAt || new Date().toISOString();
  const record = { ...previous, stage: "unlocked", unlockedAt: at, updatedAt: at, events: [...previous.events, { type: "secret.unlocked", at }] };
  save = write(save, record);
  const applied = applySecretEffects(save, definition.effects.unlocked, options);
  return result(applied.saveGame, record, true, [{ type: "secret.unlocked", secretId: definition.id }, ...applied.events]);
}

export function completeSecret(saveGame, definitionInput, options = {}) {
  const definition = requireDefinition(definitionInput);
  let save = normalizeSaveGameState(saveGame);
  const previous = getSecretRecord(save, definition.id);
  if (previous.stage === "completed") return result(save, previous, false);
  if (previous.stage !== "unlocked") throw new Error(`${definition.id} must be unlocked before it can be completed`);
  const at = options.occurredAt || new Date().toISOString();
  const record = { ...previous, stage: "completed", completedAt: at, updatedAt: at, events: [...previous.events, { type: "secret.completed", at }] };
  save = write(save, record);
  const applied = applySecretEffects(save, definition.effects.completed, options);
  return result(applied.saveGame, record, true, [{ type: "secret.completed", secretId: definition.id }, ...applied.events]);
}

export function isSecretClueAvailable(saveGame, definition, clueId) {
  const record = getSecretRecord(saveGame, definition.id);
  return ["hidden", "searching"].includes(record.stage) && !record.clueIds.includes(clueId) && !record.disabledClueIds.includes(clueId) && Boolean(getSecretClue(definition, clueId));
}

export function getSecretInventoryGroups(saveGame, definitions, options = {}) {
  return definitions.flatMap((input) => {
    const definition = createSecretDefinition(input), record = getSecretRecord(saveGame, definition.id);
    if (record.stage !== "searching") return [];
    return [{ secretId: definition.id, category: "clues", label: `Clues (${getEffectiveClueCount(saveGame, definition, options)}): ${definition.inventory.searchingText}`, clueIds: [...record.clueIds] }];
  });
}

export function getSecretJournalEntries(saveGame, definitions, options = {}) {
  return definitions.flatMap((input) => {
    const definition = createSecretDefinition(input), record = getSecretRecord(saveGame, definition.id);
    if (record.stage === "hidden") return [];
    const count = getEffectiveClueCount(saveGame, definition, options);
    const milestone = [...definition.journal.milestones].filter((entry) => entry.count <= count).sort((a, b) => b.count - a.count)[0];
    const text = record.stage === "searching" ? milestone?.text || definition.journal.searching : definition.journal[record.stage] || definition.journal.uncovered;
    return [{ id: definition.id, title: definition.title, stage: record.stage, text }];
  });
}

function replaceCluesWithRewards(save, definition) {
  const clueIds = new Set(definition.clues.map((clue) => clue.id));
  const shared = save.inventory.shared.filter((entry) => !clueIds.has(entry.id || entry.itemId));
  for (const id of definition.rewardItems) if (!shared.some((entry) => (entry.id || entry.itemId) === id)) shared.push({ id, quantity: 1 });
  return normalizeSaveGameState({ ...save, inventory: { ...save.inventory, shared } });
}

function addUniqueInventoryItem(saveGame, id) {
  const save = normalizeSaveGameState(saveGame);
  if (save.inventory.shared.some((entry) => (entry.id || entry.itemId) === id)) return save;
  return normalizeSaveGameState({ ...save, inventory: { ...save.inventory, shared: [...save.inventory.shared, { id, quantity: 1 }] } });
}

function applySecretEffects(saveGame, effects, options) {
  let save = saveGame; const events = [];
  for (const effect of effects) {
    if (typeof options.applyEffect !== "function") { events.push({ type: effect.type, id: effect.id, pending: true }); continue; }
    save = options.applyEffect(save, effect) || save;
    events.push({ type: effect.type, id: effect.id });
  }
  return { saveGame: save, events };
}

function requirementMet(save, requirement, options) {
  if (requirement.type === "item") return save.inventory.shared.some((entry) => (entry.id || entry.itemId) === requirement.id && (Number(entry.quantity) || 1) >= (requirement.quantity || 1));
  if (requirement.type === "secret") return getSecretRecord(save, requirement.id).stage === (requirement.stage || "unlocked");
  return typeof options.requirementMet === "function" && options.requirementMet(save, requirement) === true;
}

function hasTesseraBonus(save, options) {
  if (typeof options.hasTesseraBonus === "function") return options.hasTesseraBonus(save) === true;
  const slot = save.party.activeSlot, record = save.party.characterRecords[slot];
  if (record?.resolvedSheet?.identity?.pactId === "pact_of_the_tessera" || record?.identity?.pactId === "pact_of_the_tessera") return true;
  const ids = [...(record?.choices?.featureIds || []), ...(record?.actorInstance?.features || [])].map((entry) => typeof entry === "string" ? entry : entry?.id);
  return ids.includes("pact_of_the_tessera") || ids.includes("pact:tessera");
}

function emptyRecord(id) { return { id, stage: "hidden", clueIds: [], disabledClueIds: [], uncoveredAt: null, unlockedAt: null, completedAt: null, updatedAt: null, events: [] }; }
function write(saveGame, record) { const save = normalizeSaveGameState(saveGame); return normalizeSaveGameState({ ...save, world: { ...save.world, secrets: { ...save.world.secrets, [record.id]: structuredClone(record) } } }); }
function result(saveGame, record, changed, events = []) { return { saveGame, secret: structuredClone(record), changed, events }; }
function requireDefinition(input) { const definition = createSecretDefinition(input), errors = validateSecretDefinition(definition); if (errors.length) throw new Error(`Invalid secret: ${errors.join("; ")}`); return definition; }
