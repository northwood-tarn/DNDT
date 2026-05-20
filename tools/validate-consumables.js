#!/usr/bin/env node
// Strict validator for app/data/consumables.js.

import path from "node:path";
import url from "node:url";

const DEFAULT_CONSUMABLES_PATH = "app/data/consumables.js";

const VALID_USE_TIMES = new Set(["free", "bonus", "bonus_action", "action", "reaction", "exploration"]);
const VALID_USES = new Set(["infinite", "per_quantity"]);
const VALID_COMBAT_KINDS = new Set([
  "area_damage",
  "condition_defense",
  "deployable_hazard",
  "deployable_trap",
  "flammable_oil",
  "healing",
  "obscuring_area",
  "stabilize",
  "thrown_damage",
  "thrown_ongoing_damage",
  "utility",
  "weapon_coating",
  "weapon_damage_buff"
]);
const VALID_AREA_SHAPES = new Set(["radius", "square", "cube", "line", "cone"]);
const VALID_SAVE_ABILITIES = new Set(["str", "dex", "con", "int", "wis", "cha"]);

const REQUIRED_TOP_LEVEL = [
  "id",
  "name",
  "type",
  "uses",
  "useTime",
  "consumeOnUse",
  "description",
  "combat"
];

function fail(errors, id, message) {
  errors.push(`${id}: ${message}`);
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isDiceExpression(value) {
  return typeof value === "string" && /^\d*d\d+(?:[+-]\d+)?$/i.test(value.replace(/\s+/g, ""));
}

function validateString(errors, id, pathName, value) {
  if (typeof value !== "string" || value.trim().length === 0) fail(errors, id, `${pathName} must be a non-empty string`);
}

function validatePositiveNumber(errors, id, pathName, value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) fail(errors, id, `${pathName} must be a positive number`);
}

function validateUses(errors, id, value) {
  if (typeof value === "number") {
    validatePositiveNumber(errors, id, "uses", value);
    return;
  }
  if (!VALID_USES.has(value)) fail(errors, id, `uses must be a positive number or one of: ${Array.from(VALID_USES).join(", ")}`);
}

function validateSave(errors, id, save) {
  if (save === undefined) return;
  if (!isPlainObject(save)) {
    fail(errors, id, "combat.save must be an object");
    return;
  }
  if (!VALID_SAVE_ABILITIES.has(save.ability)) fail(errors, id, "combat.save.ability must be str, dex, con, int, wis, or cha");
  if (save.dc !== undefined) validatePositiveNumber(errors, id, "combat.save.dc", save.dc);
  if (save.onSave !== undefined) validateString(errors, id, "combat.save.onSave", save.onSave);
}

function validateArea(errors, id, area) {
  if (area === undefined) return;
  if (!isPlainObject(area)) {
    fail(errors, id, "combat.area must be an object");
    return;
  }
  if (!VALID_AREA_SHAPES.has(area.shape)) fail(errors, id, `combat.area.shape must be one of: ${Array.from(VALID_AREA_SHAPES).join(", ")}`);
  const sizeKeys = ["sizeFt", "radiusFt", "lengthFt", "widthFt"];
  if (!sizeKeys.some((key) => typeof area[key] === "number" && area[key] > 0)) {
    fail(errors, id, "combat.area must include at least one positive *Ft size field");
  }
}

function validateCombat(errors, item) {
  const id = item?.id || "<unknown>";
  const combat = item.combat;
  if (!isPlainObject(combat)) {
    fail(errors, id, "combat must be an object");
    return;
  }
  if (!VALID_COMBAT_KINDS.has(combat.kind)) {
    fail(errors, id, `combat.kind must be one of: ${Array.from(VALID_COMBAT_KINDS).join(", ")}`);
  }
  if (combat.rangeFt !== undefined) validatePositiveNumber(errors, id, "combat.rangeFt", combat.rangeFt);
  if (combat.durationRounds !== undefined) validatePositiveNumber(errors, id, "combat.durationRounds", combat.durationRounds);
  if (combat.maxHits !== undefined) validatePositiveNumber(errors, id, "combat.maxHits", combat.maxHits);
  if (combat.healing !== undefined && !isDiceExpression(combat.healing)) fail(errors, id, "combat.healing must be a dice expression");
  if (combat.damage !== undefined && !isDiceExpression(combat.damage) && !/^\d+$/.test(String(combat.damage))) {
    fail(errors, id, "combat.damage must be a dice expression or flat number string");
  }
  if (combat.bonusDamage !== undefined && !isDiceExpression(combat.bonusDamage)) fail(errors, id, "combat.bonusDamage must be a dice expression");
  if (combat.damage !== undefined && !combat.damageType) fail(errors, id, "combat.damageType is required when combat.damage is present");
  if (combat.bonusDamage !== undefined && !combat.damageType) fail(errors, id, "combat.damageType is required when combat.bonusDamage is present");
  validateSave(errors, id, combat.save);
  validateArea(errors, id, combat.area);
}

function validateConsumableRecord(errors, item) {
  const id = item?.id || "<unknown>";
  if (!isPlainObject(item)) {
    fail(errors, id, "record must be an object");
    return;
  }
  for (const field of REQUIRED_TOP_LEVEL) {
    if (!(field in item)) fail(errors, id, `missing required field ${field}`);
  }
  validateString(errors, id, "id", item.id);
  if (typeof item.id === "string" && !/^[a-z0-9_]+$/.test(item.id)) fail(errors, id, "id must be snake_case");
  validateString(errors, id, "name", item.name);
  validateString(errors, id, "type", item.type);
  validateUses(errors, id, item.uses);
  if (!VALID_USE_TIMES.has(item.useTime)) fail(errors, id, `useTime must be one of: ${Array.from(VALID_USE_TIMES).join(", ")}`);
  if (typeof item.consumeOnUse !== "boolean") fail(errors, id, "consumeOnUse must be boolean");
  if (item.value !== undefined) validatePositiveNumber(errors, id, "value", item.value);
  if (item.effect !== undefined) validateString(errors, id, "effect", item.effect);
  validateString(errors, id, "description", item.description);
  validateCombat(errors, item);
  if (item.combat?.kind === "healing" && item.effect && !/\d+d\d+\s*(?:[+-]\s*\d+)?\s*HP/i.test(item.effect)) {
    fail(errors, id, "healing effect text must include parseable HP dice for legacy compatibility");
  }
}

export async function validateConsumables(consumablesPath = DEFAULT_CONSUMABLES_PATH) {
  const errors = [];
  const resolved = path.resolve(consumablesPath);
  const mod = await import(url.pathToFileURL(resolved).href);
  const records = mod.consumables;
  if (!Array.isArray(records)) return [`${consumablesPath}: consumables export must be an array`];

  const ids = new Set();
  for (const item of records) {
    validateConsumableRecord(errors, item);
    if (!item?.id) continue;
    if (ids.has(item.id)) fail(errors, item.id, "duplicate id");
    ids.add(item.id);
  }
  return errors;
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  const errors = await validateConsumables(process.argv[2] || DEFAULT_CONSUMABLES_PATH);
  if (errors.length) {
    console.error(`[consumables] Validation failed with ${errors.length} error(s):`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  console.log("[consumables] Validation OK");
}
