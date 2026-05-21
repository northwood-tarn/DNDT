#!/usr/bin/env node

const DEFAULT_BACKGROUNDS_PATH = "app/data/backgrounds.js";

const VALID_SOURCES = new Set(["2024_phb_reference", "dndt_legacy"]);
const VALID_ABILITIES = new Set(["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"]);
const VALID_SKILLS = new Set([
  "acrobatics",
  "animal_handling",
  "arcana",
  "athletics",
  "deception",
  "history",
  "insight",
  "intimidation",
  "investigation",
  "medicine",
  "nature",
  "perception",
  "performance",
  "persuasion",
  "religion",
  "sleight_of_hand",
  "stealth",
  "survival"
]);
function validateString(errors, id, pathName, value) {
  if (typeof value !== "string" || !value.trim()) errors.push(`${id}: ${pathName} must be a non-empty string`);
}

function validateStringArray(errors, id, pathName, value, validValues = null, { min = 0 } = {}) {
  if (!Array.isArray(value)) {
    errors.push(`${id}: ${pathName} must be an array`);
    return;
  }
  if (value.length < min) errors.push(`${id}: ${pathName} must contain at least ${min} value(s)`);
  const seen = new Set();
  for (const entry of value) {
    validateString(errors, id, `${pathName}[]`, entry);
    if (seen.has(entry)) errors.push(`${id}: ${pathName} contains duplicate "${entry}"`);
    seen.add(entry);
    if (validValues && !validValues.has(entry)) errors.push(`${id}: ${pathName} contains unknown value "${entry}"`);
  }
}

function validateBackgroundRecord(errors, record, key, validTools, validFeats) {
  const id = record?.id || key || "<unknown>";
  if (!record || typeof record !== "object") {
    errors.push(`${key}: background record must be an object`);
    return;
  }

  validateString(errors, id, "id", record.id);
  if (record.id !== key) errors.push(`${id}: key must match id`);
  validateString(errors, id, "name", record.name);
  validateString(errors, id, "source", record.source);
  if (!VALID_SOURCES.has(record.source)) errors.push(`${id}: source "${record.source}" is not recognized`);
  if (record.category !== "background") errors.push(`${id}: category must be "background"`);

  validateStringArray(errors, id, "abilityScoreOptions", record.abilityScoreOptions, VALID_ABILITIES, { min: 3 });
  if (record.abilityScoreOptions?.length !== 3) errors.push(`${id}: abilityScoreOptions should contain exactly 3 values`);
  validateStringArray(errors, id, "skillProficiencies", record.skillProficiencies, VALID_SKILLS, { min: 2 });
  if (record.skillProficiencies?.length !== 2) errors.push(`${id}: skillProficiencies should contain exactly 2 values`);
  validateStringArray(errors, id, "toolProficiencies", record.toolProficiencies || [], validTools);
  validateString(errors, id, "originFeat", record.originFeat);
  if (record.originFeat && !validFeats.has(record.originFeat)) errors.push(`${id}: originFeat references unknown feat "${record.originFeat}"`);

  if (record.legacyFeatId !== null && record.legacyFeatId !== undefined) {
    validateString(errors, id, "legacyFeatId", record.legacyFeatId);
    if (!validFeats.has(record.legacyFeatId)) errors.push(`${id}: legacyFeatId references unknown feat "${record.legacyFeatId}"`);
  }
  if (!Array.isArray(record.equipment)) errors.push(`${id}: equipment must be an array`);
  if (record.gold !== null && record.gold !== undefined && (typeof record.gold !== "number" || record.gold < 0)) {
    errors.push(`${id}: gold must be null or a non-negative number`);
  }
  validateString(errors, id, "summary", record.summary);
  validateString(errors, id, "description", record.description);
  validateStringArray(errors, id, "tags", record.tags || []);
}

export async function validateBackgrounds(backgroundsPath = DEFAULT_BACKGROUNDS_PATH) {
  const errors = [];
  const mod = await import(new URL(`../${backgroundsPath}`, import.meta.url));
  const toolsMod = await import(new URL("../app/data/tools.js", import.meta.url));
  const featsMod = await import(new URL("../app/data/feats.js", import.meta.url));
  const backgrounds = mod.BACKGROUNDS;
  const validTools = new Set(Object.keys(toolsMod.TOOLS));
  const validFeats = new Set(Object.keys(featsMod.ORIGIN_FEATS_BY_ID || {}));
  if (!backgrounds || typeof backgrounds !== "object" || Array.isArray(backgrounds)) {
    return ["BACKGROUNDS export must be an object registry"];
  }

  for (const [key, record] of Object.entries(backgrounds)) {
    validateBackgroundRecord(errors, record, key, validTools, validFeats);
  }

  return errors;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const errors = await validateBackgrounds(process.argv[2] || DEFAULT_BACKGROUNDS_PATH);
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("[backgrounds] Validation OK");
  }
}
