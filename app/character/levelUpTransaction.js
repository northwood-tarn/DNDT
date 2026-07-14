import { createLevelUpManifest } from "./levelUpManifest.js";
import {
  createCharacterRecord,
  loadCombatActorFromCharacter,
  normalizeCharacterRecord,
} from "./characterRepository.js";

export function createLevelUpPlan(record, options = {}) {
  if (!record?.characterDraft) throw new Error("A character record is required");
  if (record.status !== "ready") throw new Error("Only a ready character can level up");
  const fromLevel = record.characterDraft.identity?.level || 1;
  const toLevel = options.toLevel ?? fromLevel + 1;
  if (toLevel !== fromLevel + 1) throw new Error(`Level-up must advance exactly one level (${fromLevel} to ${fromLevel + 1})`);
  if (toLevel > 20) throw new Error("Character is already at the maximum level");
  return createLevelUpManifest(record.characterDraft, { toLevel, values: options.values || {} });
}

export function validateLevelUpSubmission(manifest, values = {}) {
  const errors = [];
  if (!manifest || typeof manifest !== "object") return { valid: false, errors: ["manifest is required"] };
  if (manifest.toLevel !== manifest.fromLevel + 1) errors.push("manifest must advance exactly one level");
  const knownStepIds = new Set((manifest.steps || []).map((step) => step.id));
  for (const id of Object.keys(values || {})) {
    if (!knownStepIds.has(id)) errors.push(`unknown level-up step: ${id}`);
  }
  for (const step of manifest.steps || []) validateStep(errors, step, values[step.id]);
  return { valid: errors.length === 0, errors };
}

export function applyLevelUpToDraft(draft, manifest, values = {}) {
  const currentLevel = draft?.identity?.level || 1;
  if (manifest?.fromLevel !== currentLevel || manifest?.toLevel !== currentLevel + 1) {
    throw new Error(`Stale level-up manifest: character is level ${currentLevel}`);
  }
  const report = validateLevelUpSubmission(manifest, values);
  if (!report.valid) throw new Error(`Invalid level-up submission:\n${report.errors.join("\n")}`);

  const next = structuredClone(draft);
  for (const step of manifest.steps || []) applyStep(next, step, values[step.id]);
  next.identity.level = manifest.toLevel;
  const hpStep = manifest.steps.find((step) => step.kind === "hp_roll");
  next.choices.levelUpHistory ??= {};
  next.choices.levelUpHistory[String(manifest.toLevel)] = {
    fromLevel: manifest.fromLevel,
    toLevel: manifest.toLevel,
    hpDie: values[hpStep.id].die,
    appliedStepIds: manifest.steps.map((step) => step.id),
  };
  return next;
}

export function levelUpCharacterRecord(record, values = {}, options = {}) {
  const manifest = options.manifest || createLevelUpPlan(record, { ...options, values });
  const nextDraft = applyLevelUpToDraft(record.characterDraft, manifest, values);
  const next = createCharacterRecord(nextDraft, {
    id: record.id,
    slot: record.slot,
    kind: record.actorDefinition?.kind || "player",
    definitionId: record.actorDefinition?.id,
    actorOptions: {
      id: record.actorInstance?.id || record.combatActor?.id,
      name: record.actorInstance?.name || record.combatActor?.name,
      team: record.actorInstance?.team || record.combatActor?.team,
      position: record.actorInstance?.position || record.combatActor?.position,
    },
    resolveOptions: { allowNonCreationLevel: true },
    savedAt: options.savedAt,
  });
  if (next.status !== "ready") {
    const errors = next.validityReport?.errors || next.validityReport?.unresolved || next.validityReport || ["resulting character is invalid"];
    throw new Error(`Level-up did not produce a valid character: ${JSON.stringify(errors)}`);
  }
  return preserveRuntimeAcrossLevelUp(record, next, manifest);
}

export function levelUpCharacterStore(options = {}) {
  const record = options.record || options.store?.load(options.slot || "active");
  if (!record) throw new Error("No character record found for level-up");
  const updated = levelUpCharacterRecord(record, options.values || {}, options);
  options.store?.save(updated);
  return updated;
}

function validateStep(errors, step, value) {
  if (!step.required && value == null) return;
  if (step.kind === "hp_roll") {
    const die = value?.die;
    if (!Number.isInteger(die)) errors.push(`${step.id}: die result is required`);
    else if (die < 1 || die > step.hitDie) errors.push(`${step.id}: die result must be between 1 and ${step.hitDie}`);
    else if ((step.reroll || []).includes(die)) errors.push(`${step.id}: ${die} must be rerolled`);
    return;
  }
  if (step.kind === "feat_or_asi") return validateFeatChoice(errors, step, value);
  const selected = arrayValue(value);
  const expected = step.count || 1;
  if (selected.length !== expected) errors.push(`${step.id}: choose exactly ${expected}`);
  if (new Set(selected).size !== selected.length) errors.push(`${step.id}: duplicate choices are not allowed`);
  const optionIds = new Set((step.options || []).map((option) => option.id));
  for (const id of selected) if (!optionIds.has(id)) errors.push(`${step.id}: invalid option ${id}`);
}

function validateFeatChoice(errors, step, value) {
  if (!value?.id) return errors.push(`${step.id}: feat or ASI choice is required`);
  const option = (step.options || []).find((item) => item.id === value.id);
  if (!option) return errors.push(`${step.id}: invalid option ${value.id}`);
  const supplied = value.choices || {};
  for (const nested of option.choices || []) {
    const selected = arrayValue(supplied[nested.id]).filter(Boolean);
    if (selected.length !== nested.count) errors.push(`${step.id}.${nested.id}: choose exactly ${nested.count}`);
    if (!nested.allowDuplicate && new Set(selected).size !== selected.length) errors.push(`${step.id}.${nested.id}: duplicate choices are not allowed`);
    const optionIds = new Set((nested.options || []).map((item) => item.id));
    for (const id of selected) if (!optionIds.has(id)) errors.push(`${step.id}.${nested.id}: invalid option ${id}`);
  }
  const nestedIds = new Set((option.choices || []).map((choice) => choice.id));
  for (const id of Object.keys(supplied)) if (!nestedIds.has(id)) errors.push(`${step.id}: unknown nested choice ${id}`);
}

function applyStep(draft, step, value) {
  if (step.kind === "hp_roll") return;
  if (step.kind === "feat_or_asi") {
    setPath(draft, step.path, value.id);
    if (Object.keys(value.choices || {}).length) draft.choices.featChoices[value.id] = structuredClone(value.choices);
    return;
  }
  const selected = arrayValue(value);
  if (step.path === "spells.knownSpellIds") {
    draft.spells.knownSpellIds = unique([...(draft.spells.knownSpellIds || []), ...selected]);
    return;
  }
  setPath(draft, step.path, selected.length === 1 ? selected[0] : selected);
}

function preserveRuntimeAcrossLevelUp(previous, next, manifest) {
  const oldActor = loadCombatActorFromCharacter({ record: previous });
  const newActor = loadCombatActorFromCharacter({ record: next });
  const hpIncrease = Math.max(0, newActor.maxHp - oldActor.maxHp);
  const runtime = {
    ...next.runtime,
    hp: Math.min(newActor.maxHp, Math.max(0, oldActor.hp + hpIncrease)),
    maxHp: newActor.maxHp,
    tempHp: oldActor.tempHp || 0,
    defeated: oldActor.defeated === true && oldActor.hp + hpIncrease <= 0,
    spellSlots: mergeSlotState(oldActor.spellSlots, newActor.spellSlots),
    resources: mergeResourceState(oldActor.resources, newActor.resources),
    inventory: structuredClone(oldActor.inventory || []),
    conditions: structuredClone(oldActor.conditions || []),
    activeEffects: structuredClone(oldActor.activeEffects || []),
    marks: structuredClone(oldActor.marks || []),
    luck: structuredClone(oldActor.luck || null),
  };
  const normalized = normalizeCharacterRecord({
    ...next,
    runtime,
    actorInstance: {
      ...next.actorInstance,
      state: { ...next.actorInstance.state, ...runtime },
      metadata: {
        ...(next.actorInstance.metadata || {}),
        lastLevelUp: { fromLevel: manifest.fromLevel, toLevel: manifest.toLevel },
      },
    },
  });
  return normalized;
}

function mergeResourceState(previous = [], next = []) {
  const oldById = new Map(previous.map((item) => [item.id, item]));
  return next.map((resource) => {
    const old = oldById.get(resource.id);
    if (!old) return resource;
    return { ...resource, current: Math.min(resource.max, old.current ?? resource.current ?? resource.max) };
  });
}

function mergeSlotState(previous = {}, next = {}) {
  return Object.fromEntries(Object.entries(next).map(([level, slot]) => {
    const old = previous[level];
    if (!old) return [level, slot];
    return [level, { ...slot, current: Math.min(slot.max, old.current ?? slot.current ?? slot.max), used: old.used || 0 }];
  }));
}

function setPath(root, path, value) {
  const keys = path.split(".");
  let target = root;
  for (const key of keys.slice(0, -1)) {
    target[key] ??= {};
    target = target[key];
  }
  target[keys.at(-1)] = structuredClone(value);
}

function arrayValue(value) {
  return Array.isArray(value) ? value : value == null ? [] : [value];
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}
