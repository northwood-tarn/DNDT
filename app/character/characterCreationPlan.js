import { createEmptyCharacterDraft } from "./characterDraft.js";

export function createCharacterDraftFromPlan(plan = {}) {
  const draft = createEmptyCharacterDraft();
  for (const step of plan.steps || []) applyCreationStep(draft, step);
  return draft;
}

export function applyCreationStep(draft, step) {
  if (!step || typeof step !== "object") return draft;
  if (step.type === "identity") Object.assign(draft.identity, step.value || {});
  if (step.type === "abilities") Object.assign(draft.abilities, step.value || {});
  if (step.type === "choices") mergeObject(draft.choices, step.value || {});
  if (step.type === "gear") Object.assign(draft.gear, structuredClone(step.value || {}));
  if (step.type === "spells") Object.assign(draft.spells, structuredClone(step.value || {}));
  if (step.type === "metadata") Object.assign(draft.metadata, step.value || {});
  return draft;
}

function mergeObject(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      target[key] = { ...(target[key] || {}), ...structuredClone(value) };
    } else {
      target[key] = structuredClone(value);
    }
  }
}
