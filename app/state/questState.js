import { normalizeSaveGameState } from "./saveGameState.js";

export const QUEST_STATUSES = new Set(["inactive", "active", "completed", "failed"]);
export const OBJECTIVE_STATUSES = new Set(["hidden", "active", "completed", "failed"]);

export function createQuestDefinition(input = {}) {
  return {
    id: input.id || null,
    title: input.title || "",
    summary: input.summary || "",
    objectives: (input.objectives || []).map((objective) => ({
      id: objective.id || null,
      text: objective.text || "",
      optional: objective.optional === true,
      initialStatus: objective.initialStatus || "hidden",
    })),
  };
}

export function validateQuestDefinition(input) {
  const quest = createQuestDefinition(input);
  const errors = [];
  if (!stableId(quest.id, "quest")) errors.push("quest id must use quest:lowercase.words");
  if (!quest.title) errors.push("quest title is required");
  const ids = new Set();
  for (const objective of quest.objectives) {
    if (!stableId(objective.id, "objective")) errors.push(`invalid objective id: ${objective.id}`);
    if (ids.has(objective.id)) errors.push(`duplicate objective id: ${objective.id}`);
    ids.add(objective.id);
    if (!objective.text) errors.push(`objective ${objective.id} requires text`);
    if (!OBJECTIVE_STATUSES.has(objective.initialStatus)) errors.push(`objective ${objective.id} has invalid initial status`);
  }
  return errors;
}

export function startQuest(saveGame, definition) {
  const quest = createQuestDefinition(definition);
  const errors = validateQuestDefinition(quest);
  if (errors.length) throw new Error(`Invalid quest: ${errors.join("; ")}`);
  const save = normalizeSaveGameState(saveGame);
  if (save.quests[quest.id]) return save;
  const objectives = Object.fromEntries(quest.objectives.map((objective) => [objective.id, {
    id: objective.id,
    text: objective.text,
    optional: objective.optional,
    status: objective.initialStatus === "hidden" ? "hidden" : "active",
    updatedAt: null,
  }]));
  return normalizeSaveGameState({ ...save, quests: { ...save.quests, [quest.id]: {
    id: quest.id, title: quest.title, summary: quest.summary, status: "active", objectives,
    startedAt: new Date().toISOString(), resolvedAt: null,
  } } });
}

export function setObjectiveStatus(saveGame, questId, objectiveId, status) {
  if (!OBJECTIVE_STATUSES.has(status)) throw new Error(`Invalid objective status: ${status}`);
  const save = normalizeSaveGameState(saveGame);
  const quest = save.quests[questId];
  if (!quest) throw new Error(`Unknown quest: ${questId}`);
  if (!quest.objectives[objectiveId]) throw new Error(`Unknown objective: ${objectiveId}`);
  const updated = { ...quest.objectives[objectiveId], status, updatedAt: new Date().toISOString() };
  return normalizeSaveGameState({ ...save, quests: { ...save.quests, [questId]: {
    ...quest, objectives: { ...quest.objectives, [objectiveId]: updated },
  } } });
}

export function resolveQuest(saveGame, questId, status) {
  if (!["completed", "failed"].includes(status)) throw new Error("Quest resolution must be completed or failed");
  const save = normalizeSaveGameState(saveGame);
  const quest = save.quests[questId];
  if (!quest) throw new Error(`Unknown quest: ${questId}`);
  return normalizeSaveGameState({ ...save, quests: { ...save.quests, [questId]: {
    ...quest, status, resolvedAt: new Date().toISOString(),
  } } });
}

export function getQuestJournal(saveGame, options = {}) {
  const quests = Object.values(normalizeSaveGameState(saveGame).quests);
  return quests.filter((quest) => !options.status || quest.status === options.status).map((quest) => structuredClone(quest));
}

function stableId(value, prefix) { return typeof value === "string" && new RegExp(`^${prefix}:[a-z0-9]+(?:\\.[a-z0-9]+)*$`).test(value); }
