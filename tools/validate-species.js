#!/usr/bin/env node

const DEFAULT_SPECIES_PATH = "app/data/species.js";

const VALID_SOURCES = new Set(["2024_phb_reference", "dndt_homebrew"]);
const VALID_SIZES = new Set(["Small", "Medium"]);
const VALID_EFFECTS = new Set(["feature", "skill_choice", "feat_choice", "hp_bonus_per_level"]);
const VALID_DAMAGE_TYPES = new Set(["acid", "cold", "fire", "lightning", "necrotic", "poison", "radiant", "thunder"]);
const VALID_EFFECT_KEYS = new Set(["resources", "spells", "hitPointBonuses", "choiceRequirements", "actionOptions", "modifiers", "triggeredEffects", "narrativeOnly", "narrativeTags"]);
const VALID_RECOVERY = new Set(["short_rest", "long_rest", "combat", "special"]);

function validateString(errors, id, pathName, value) {
  if (typeof value !== "string" || !value.trim()) errors.push(`${id}: ${pathName} must be a non-empty string`);
}

function validateNumber(errors, id, pathName, value) {
  if (!Number.isFinite(value)) errors.push(`${id}: ${pathName} must be numeric`);
}

function validateStringArray(errors, id, pathName, value, validValues = null) {
  if (!Array.isArray(value)) {
    errors.push(`${id}: ${pathName} must be an array`);
    return;
  }
  const seen = new Set();
  for (const entry of value) {
    validateString(errors, id, `${pathName}[]`, entry);
    if (seen.has(entry)) errors.push(`${id}: ${pathName} contains duplicate "${entry}"`);
    seen.add(entry);
    if (validValues && !validValues.has(entry)) errors.push(`${id}: ${pathName} contains unknown "${entry}"`);
  }
}

function validateSense(errors, ownerId, sense, index) {
  const path = `senses[${index}]`;
  if (!sense || typeof sense !== "object") {
    errors.push(`${ownerId}: ${path} must be an object`);
    return;
  }
  validateString(errors, ownerId, `${path}.type`, sense.type);
  validateNumber(errors, ownerId, `${path}.rangeFt`, sense.rangeFt);
  if (sense.rangeFt <= 0) errors.push(`${ownerId}: ${path}.rangeFt must be positive`);
}

function validateFeature(errors, ownerId, feature, index) {
  const id = `${ownerId}.${feature?.id || `features[${index}]`}`;
  if (!feature || typeof feature !== "object") {
    errors.push(`${ownerId}: features[${index}] must be an object`);
    return;
  }
  validateString(errors, id, "id", feature.id);
  validateString(errors, id, "name", feature.name);
  if (!Number.isInteger(feature.minLevel) || feature.minLevel < 1 || feature.minLevel > 20) {
    errors.push(`${id}: minLevel must be an integer from 1 to 20`);
  }
  validateString(errors, id, "effect", feature.effect);
  if (!VALID_EFFECTS.has(feature.effect)) errors.push(`${id}: effect "${feature.effect}" is not recognized`);
  validateString(errors, id, "description", feature.description);
  if (feature.grantsSpellId !== null && feature.grantsSpellId !== undefined) validateString(errors, id, "grantsSpellId", feature.grantsSpellId);
  validateStringArray(errors, id, "choices", feature.choices || []);
  validateEffects(errors, id, feature.effects);
}

function validateEffects(errors, id, effects) {
  if (effects === undefined) return;
  if (!effects || typeof effects !== "object" || Array.isArray(effects)) {
    errors.push(`${id}: effects must be an object`);
    return;
  }
  for (const key of Object.keys(effects)) {
    if (!VALID_EFFECT_KEYS.has(key)) errors.push(`${id}: unknown effects key "${key}"`);
  }
  validateEffectArray(errors, id, "resources", effects.resources);
  validateEffectArray(errors, id, "spells", effects.spells);
  validateEffectArray(errors, id, "hitPointBonuses", effects.hitPointBonuses);
  validateEffectArray(errors, id, "choiceRequirements", effects.choiceRequirements);
  validateEffectArray(errors, id, "actionOptions", effects.actionOptions);
  validateEffectArray(errors, id, "modifiers", effects.modifiers);
  validateEffectArray(errors, id, "triggeredEffects", effects.triggeredEffects);
  validateEffectArray(errors, id, "narrativeTags", effects.narrativeTags);
  if (effects.narrativeOnly !== undefined && effects.narrativeOnly !== true) {
    errors.push(`${id}: effects.narrativeOnly must be true when present`);
  }
  if (effects.narrativeTags) validateStringArray(errors, id, "effects.narrativeTags", effects.narrativeTags);

  for (const [index, resource] of (effects.resources || []).entries()) {
    const pathName = `${id}.effects.resources[${index}]`;
    validateString(errors, pathName, "id", resource.id);
    validateString(errors, pathName, "name", resource.name);
    if (resource.max !== "proficiency_bonus" && (!Number.isFinite(resource.max) || resource.max <= 0)) {
      errors.push(`${pathName}: max must be positive numeric or "proficiency_bonus"`);
    }
    validateString(errors, pathName, "recovery", resource.recovery);
    if (!VALID_RECOVERY.has(resource.recovery)) errors.push(`${pathName}: unknown recovery "${resource.recovery}"`);
  }
  for (const [index, spell] of (effects.spells || []).entries()) {
    const pathName = `${id}.effects.spells[${index}]`;
    validateString(errors, pathName, "id", spell.id);
    validateString(errors, pathName, "mode", spell.mode);
  }
  for (const [index, bonus] of (effects.hitPointBonuses || []).entries()) {
    const pathName = `${id}.effects.hitPointBonuses[${index}]`;
    if (!Number.isFinite(bonus.perLevel) && !Number.isFinite(bonus.total)) {
      errors.push(`${pathName}: perLevel or total is required`);
    }
  }
  for (const [index, choice] of (effects.choiceRequirements || []).entries()) {
    const pathName = `${id}.effects.choiceRequirements[${index}]`;
    validateString(errors, pathName, "id", choice.id);
    validateString(errors, pathName, "kind", choice.kind);
    if (!Number.isFinite(choice.count) || choice.count <= 0) errors.push(`${pathName}: count must be positive numeric`);
    if (choice.options !== undefined) validateStringArray(errors, pathName, "options", choice.options);
  }
  for (const [index, action] of (effects.actionOptions || []).entries()) {
    const pathName = `${id}.effects.actionOptions[${index}]`;
    validateString(errors, pathName, "id", action.id);
    validateString(errors, pathName, "actionType", action.actionType);
  }
  for (const [index, modifier] of (effects.modifiers || []).entries()) {
    const pathName = `${id}.effects.modifiers[${index}]`;
    validateString(errors, pathName, "id", modifier.id);
    validateString(errors, pathName, "target", modifier.target);
  }
  for (const [index, triggered] of (effects.triggeredEffects || []).entries()) {
    const pathName = `${id}.effects.triggeredEffects[${index}]`;
    validateString(errors, pathName, "id", triggered.id);
    validateString(errors, pathName, "trigger", triggered.trigger);
  }
}

function validateEffectArray(errors, id, key, value) {
  if (value !== undefined && !Array.isArray(value)) errors.push(`${id}: effects.${key} must be an array`);
}

function validateLineage(errors, speciesId, lineage, key) {
  const id = `${speciesId}.${lineage?.id || key}`;
  if (!lineage || typeof lineage !== "object") {
    errors.push(`${speciesId}: lineage ${key} must be an object`);
    return;
  }
  validateString(errors, id, "id", lineage.id);
  if (lineage.id !== key) errors.push(`${id}: lineage key must match id`);
  validateString(errors, id, "name", lineage.name);
  validateStringArray(errors, id, "resistances", lineage.resistances || [], VALID_DAMAGE_TYPES);
  if (!Array.isArray(lineage.features)) errors.push(`${id}: features must be an array`);
  (lineage.features || []).forEach((item, index) => validateFeature(errors, id, item, index));
}

function validateSpeciesRecord(errors, record, key) {
  const id = record?.id || key || "<unknown>";
  if (!record || typeof record !== "object") {
    errors.push(`${key}: species record must be an object`);
    return;
  }
  validateString(errors, id, "id", record.id);
  if (record.id !== key) errors.push(`${id}: key must match id`);
  validateString(errors, id, "name", record.name);
  validateString(errors, id, "source", record.source);
  if (!VALID_SOURCES.has(record.source)) errors.push(`${id}: source "${record.source}" is not recognized`);
  if (record.category !== "species") errors.push(`${id}: category must be "species"`);
  validateString(errors, id, "size", record.size);
  if (!VALID_SIZES.has(record.size)) errors.push(`${id}: size "${record.size}" is not recognized`);
  validateNumber(errors, id, "speed", record.speed);
  if (record.speed <= 0) errors.push(`${id}: speed must be positive`);

  if (!Array.isArray(record.senses)) errors.push(`${id}: senses must be an array`);
  (record.senses || []).forEach((sense, index) => validateSense(errors, id, sense, index));
  validateStringArray(errors, id, "resistances", record.resistances || [], VALID_DAMAGE_TYPES);
  if (!Array.isArray(record.features)) errors.push(`${id}: features must be an array`);
  (record.features || []).forEach((item, index) => validateFeature(errors, id, item, index));

  if (!record.lineages || typeof record.lineages !== "object" || Array.isArray(record.lineages)) {
    errors.push(`${id}: lineages must be an object`);
  }
  for (const [lineageId, lineage] of Object.entries(record.lineages || {})) {
    validateLineage(errors, id, lineage, lineageId);
  }
}

export async function validateSpecies(speciesPath = DEFAULT_SPECIES_PATH) {
  const errors = [];
  const mod = await import(new URL(`../${speciesPath}`, import.meta.url));
  const spellsMod = await import(new URL("../app/data/spells.js", import.meta.url));
  const species = mod.SPECIES;
  if (!species || typeof species !== "object" || Array.isArray(species)) return ["SPECIES export must be an object registry"];
  for (const [key, record] of Object.entries(species)) validateSpeciesRecord(errors, record, key);
  validateSpellLinks(errors, species, spellsMod.getSpellRecordById || spellsMod.getSpellById);
  return errors;
}

function validateSpellLinks(errors, species, getSpell) {
  if (typeof getSpell !== "function") return;
  for (const record of Object.values(species)) {
    const lineageFeatures = Object.values(record.lineages || {}).flatMap((lineage) => lineage.features || []);
    for (const feature of [...(record.features || []), ...lineageFeatures]) {
      const spellIds = new Set([
        feature.grantsSpellId,
        ...(feature.effects?.spells || []).map((spell) => spell.id),
      ].filter(Boolean));
      for (const spellId of spellIds) {
        if (!getSpell(spellId, { includeInactive: true })) errors.push(`${record.id}.${feature.id}: unknown spell "${spellId}"`);
      }
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const errors = await validateSpecies(process.argv[2] || DEFAULT_SPECIES_PATH);
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("[species] Validation OK");
  }
}
