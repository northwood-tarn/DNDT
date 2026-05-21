#!/usr/bin/env node

const DEFAULT_FEATS_PATH = "app/data/feats.js";

const VALID_TYPES = new Set(["origin", "campaign"]);
const VALID_SOURCES = new Set(["2024_phb_reference", "dndt_homebrew"]);
const VALID_CHOICE_KINDS = new Set(["skill", "tool", "skill_or_tool", "spell", "spell_list"]);
const VALID_RECOVERY = new Set(["short_rest", "long_rest", "special"]);

function validateString(errors, id, pathName, value) {
  if (typeof value !== "string" || !value.trim()) errors.push(`${id}: ${pathName} must be a non-empty string`);
}

function validateNumber(errors, id, pathName, value) {
  if (!Number.isFinite(value)) errors.push(`${id}: ${pathName} must be numeric`);
}

function validateArray(errors, id, pathName, value) {
  if (!Array.isArray(value)) errors.push(`${id}: ${pathName} must be an array`);
}

function validateChoice(errors, featId, choice, index) {
  const id = `${featId}.choices[${index}]`;
  if (!choice || typeof choice !== "object" || Array.isArray(choice)) {
    errors.push(`${id}: must be an object`);
    return;
  }
  validateString(errors, id, "id", choice.id);
  validateString(errors, id, "kind", choice.kind);
  if (!VALID_CHOICE_KINDS.has(choice.kind)) errors.push(`${id}: unknown kind "${choice.kind}"`);
  validateNumber(errors, id, "count", choice.count);
  if (choice.count < 1) errors.push(`${id}: count must be positive`);
  if (!("pool" in choice) && !("pools" in choice) && !choice.listFromChoice) errors.push(`${id}: pool, pools, or listFromChoice is required`);
}

function validateResource(errors, featId, resource, index) {
  const id = `${featId}.effects.resources[${index}]`;
  validateString(errors, id, "id", resource.id);
  validateString(errors, id, "name", resource.name);
  if (typeof resource.max !== "number" && resource.max !== "proficiency_bonus") errors.push(`${id}: max must be numeric or "proficiency_bonus"`);
  validateString(errors, id, "recovery", resource.recovery);
  if (!VALID_RECOVERY.has(resource.recovery)) errors.push(`${id}: unknown recovery "${resource.recovery}"`);
}

function validateFeatRecord(errors, feat, key) {
  const id = feat?.id || key || "<unknown>";
  if (!feat || typeof feat !== "object" || Array.isArray(feat)) {
    errors.push(`${key}: feat must be an object`);
    return;
  }
  validateString(errors, id, "id", feat.id);
  if (feat.id !== key) errors.push(`${id}: key must match id`);
  validateString(errors, id, "name", feat.name);
  validateString(errors, id, "type", feat.type);
  if (!VALID_TYPES.has(feat.type)) errors.push(`${id}: unknown type "${feat.type}"`);
  validateString(errors, id, "source", feat.source);
  if (!VALID_SOURCES.has(feat.source)) errors.push(`${id}: unknown source "${feat.source}"`);
  validateNumber(errors, id, "minLevel", feat.minLevel);
  validateString(errors, id, "description", feat.description);
  if (!feat.effects || typeof feat.effects !== "object" || Array.isArray(feat.effects)) errors.push(`${id}: effects must be an object`);
  validateArray(errors, id, "choices", feat.choices);
  validateArray(errors, id, "tags", feat.tags);
  (feat.choices || []).forEach((choice, index) => validateChoice(errors, id, choice, index));
  (feat.effects?.resources || []).forEach((resource, index) => validateResource(errors, id, resource, index));
}

export async function validateFeats(featsPath = DEFAULT_FEATS_PATH) {
  const errors = [];
  const mod = await import(new URL(`../${featsPath}`, import.meta.url));
  const toolsMod = await import(new URL("../app/data/tools.js", import.meta.url));
  const spellsMod = await import(new URL("../app/data/spells.js", import.meta.url));
  const feats = mod.ORIGIN_FEATS_BY_ID;
  if (!feats || typeof feats !== "object" || Array.isArray(feats)) return ["ORIGIN_FEATS_BY_ID export must be an object registry"];
  for (const [key, feat] of Object.entries(feats)) validateFeatRecord(errors, feat, key);
  validateFeatToolPools(errors, feats, toolsMod.TOOL_POOLS);
  validateFeatSpellLinks(errors, feats, spellsMod.getSpellRecordById || spellsMod.getSpellById);
  return errors;
}

function validateFeatToolPools(errors, feats, toolPools) {
  for (const feat of Object.values(feats)) {
    for (const choice of feat.choices || []) {
      const pools = [...(choice.pool ? [choice.pool] : []), ...(choice.pools || [])];
      for (const pool of pools) {
        if (["skills", "any"].includes(pool)) continue;
        if (!toolPools[pool] && choice.kind.includes("tool")) {
          errors.push(`${feat.id}: choice "${choice.id}" references unknown tool pool "${pool}"`);
        }
      }
    }
  }
}

function validateFeatSpellLinks(errors, feats, getSpell) {
  if (typeof getSpell !== "function") return;
  for (const feat of Object.values(feats)) {
    for (const grant of feat.effects?.spellGrants || []) {
      if (!getSpell(grant.spellId, { includeInactive: true })) {
        errors.push(`${feat.id}: spellGrants references unknown spell "${grant.spellId}"`);
      }
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const errors = await validateFeats(process.argv[2] || DEFAULT_FEATS_PATH);
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("[feats] Validation OK");
  }
}
