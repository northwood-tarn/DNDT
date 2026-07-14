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
  for (const field of ["id", "name", "type", "inspectText", "stackable", "maxStackSize"]) {
    if (!(field in item)) fail(errors, id, `missing required field ${field}`);
  }
  validateString(errors, id, "id", item.id);
  if (typeof item.id === "string" && !/^[a-z0-9_]+$/.test(item.id)) fail(errors, id, "id must be snake_case");
  validateString(errors, id, "name", item.name);
  if (!["usable", "tool", "quest"].includes(item.type)) fail(errors, id, "type must be usable, tool, or quest");
  validateString(errors, id, "inspectText", item.inspectText);
  if (typeof item.stackable !== "boolean") fail(errors, id, "stackable must be boolean");
  if (!Number.isInteger(item.maxStackSize) || item.maxStackSize < 1) fail(errors, id, "maxStackSize must be a positive integer");
  if (item.stackable === false && item.maxStackSize !== 1) fail(errors, id, "non-stackable items must have maxStackSize 1");
  if (item.value !== undefined) validatePositiveNumber(errors, id, "value", item.value);
  if (item.type === "usable") validateCanonicalUsable(errors, item);
  if (item.type === "tool") {
    validateString(errors, id, "useHookId", item.useHookId);
    if (item.consumedOnUse !== undefined || item.effects !== undefined || item.delivery !== undefined) fail(errors, id, "tools cannot declare consumable behavior");
  }
  if (item.type === "quest" && item.keyComponent !== undefined) validateString(errors, id, "keyComponent.keyId", item.keyComponent?.keyId);
}

function validateCanonicalUsable(errors, item) {
  const id = item.id;
  if (!["combat", "exploration", "narrative", "noncombat", "anywhere"].includes(item.availability)) fail(errors, id, "availability is invalid");
  if (!Array.isArray(item.targets) || item.targets.length === 0) fail(errors, id, "targets must be a non-empty array");
  if (typeof item.consumedOnUse !== "boolean") fail(errors, id, "consumedOnUse must be boolean");
  if (["combat", "anywhere"].includes(item.availability) && !["action", "bonus-action", "reaction"].includes(item.combatCost)) fail(errors, id, "combat-capable items require a valid combatCost");
  if (!Array.isArray(item.effects)) fail(errors, id, "effects must be an array");
  for (const [index, effect] of (item.effects || []).entries()) {
    const pathName = `effects[${index}]`;
    if (effect.type === "change-resource") validateFixedOrFormula(errors, id, effect, "amount", "amountFormula", pathName);
    if (effect.type === "damage") validateFixedOrFormula(errors, id, effect, "damage", "damageFormula", pathName);
    if (effect.amountFormula !== undefined && !isDiceExpression(effect.amountFormula)) fail(errors, id, `${pathName}.amountFormula must be a dice expression`);
    if (effect.damageFormula !== undefined && !isDiceExpression(effect.damageFormula)) fail(errors, id, `${pathName}.damageFormula must be a dice expression`);
  }
  if (item.delivery !== undefined) validateDelivery(errors, item);
}

function validateFixedOrFormula(errors, id, effect, fixedKey, formulaKey, pathName) {
  const count = Number(effect[fixedKey] !== undefined) + Number(effect[formulaKey] !== undefined);
  if (count !== 1) fail(errors, id, `${pathName} must declare exactly one of ${fixedKey} or ${formulaKey}`);
}

function validateDelivery(errors, item) {
  const id = item.id;
  const delivery = item.delivery;
  if (!isPlainObject(delivery) || delivery.kind !== "thrown") return fail(errors, id, "delivery must be a thrown delivery object");
  if (!Number.isInteger(delivery.range) || delivery.range < 1) fail(errors, id, "delivery.range must be a positive grid-square integer");
  const resolution = delivery.resolution;
  if (!isPlainObject(resolution) || !["attack", "save"].includes(resolution.type)) return fail(errors, id, "delivery.resolution must be attack or save");
  if (!["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"].includes(resolution.ability)) fail(errors, id, "delivery.resolution.ability is invalid");
  if (resolution.type === "attack" && typeof resolution.addProficiency !== "boolean") fail(errors, id, "thrown attacks require addProficiency");
  if (resolution.type === "save") {
    validatePositiveNumber(errors, id, "delivery.resolution.dc", resolution.dc);
    if (!["none", "half"].includes(resolution.onSuccess)) fail(errors, id, "save onSuccess must be none or half");
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
