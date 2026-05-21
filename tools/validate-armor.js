#!/usr/bin/env node
// Strict validator for app/data/armor.js.

import path from "node:path";
import url from "node:url";

const DEFAULT_ARMOR_PATH = "app/data/armor.js";

const VALID_USE_TIMES = new Set(["exploration"]);
const VALID_TYPES = new Set(["light", "medium", "heavy", "shield"]);
const VALID_DAMAGE_TYPES = new Set([
  "acid",
  "bludgeoning",
  "cold",
  "fire",
  "force",
  "lightning",
  "necrotic",
  "piercing",
  "poison",
  "psychic",
  "radiant",
  "slashing",
  "thunder",
]);

function fail(errors, id, message) {
  errors.push(`${id}: ${message}`);
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function validateString(errors, id, pathName, value) {
  if (typeof value !== "string" || value.trim().length === 0) fail(errors, id, `${pathName} must be a non-empty string`);
}

function validatePositiveNumber(errors, id, pathName, value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) fail(errors, id, `${pathName} must be a positive number`);
}

function validateModifiers(errors, item) {
  const id = item?.id || "<unknown>";
  const mods = item.modifiers;
  if (mods === undefined) return;
  if (!isPlainObject(mods)) {
    fail(errors, id, "modifiers must be an object");
    return;
  }
  if (mods.acBonus !== undefined) validatePositiveNumber(errors, id, "modifiers.acBonus", mods.acBonus);
  if (mods.skillBonuses !== undefined) {
    if (!isPlainObject(mods.skillBonuses)) {
      fail(errors, id, "modifiers.skillBonuses must be an object");
    } else {
      for (const [skill, bonus] of Object.entries(mods.skillBonuses)) {
        if (!skill || typeof bonus !== "number" || !Number.isFinite(bonus)) fail(errors, id, `modifiers.skillBonuses.${skill || "<empty>"} must be numeric`);
      }
    }
  }
  if (mods.resistances !== undefined) {
    if (!Array.isArray(mods.resistances)) {
      fail(errors, id, "modifiers.resistances must be an array");
    } else {
      for (const type of mods.resistances) {
        if (!VALID_DAMAGE_TYPES.has(type)) fail(errors, id, `modifiers.resistances contains unsupported damage type: ${type}`);
      }
    }
  }
}

function validateArmorRecord(errors, item) {
  const id = item?.id || "<unknown>";
  if (!isPlainObject(item)) {
    fail(errors, id, "record must be an object");
    return;
  }
  validateString(errors, id, "id", item.id);
  if (typeof item.id === "string" && !/^[a-z0-9_]+$/.test(item.id)) fail(errors, id, "id must be snake_case");
  validateString(errors, id, "name", item.name);
  validateString(errors, id, "description", item.description);
  if (item.uses !== "infinite") fail(errors, id, "uses must be infinite");
  if (!VALID_USE_TIMES.has(item.useTime)) fail(errors, id, "useTime must be exploration");
  if (typeof item.consumeOnUse !== "boolean") fail(errors, id, "consumeOnUse must be boolean");
  if (!VALID_TYPES.has(item.type)) fail(errors, id, `type must be one of: ${Array.from(VALID_TYPES).join(", ")}`);
  if (typeof item.magical !== "boolean") fail(errors, id, "magical must be boolean");
  if (!Array.isArray(item.properties)) fail(errors, id, "properties must be an array");
  if (item.value !== undefined) validatePositiveNumber(errors, id, "value", item.value);
  if (item.effect !== undefined) validateString(errors, id, "effect", item.effect);

  if (item.type === "shield") {
    if (item.ac !== undefined) fail(errors, id, "shield records must use modifiers.acBonus, not ac");
    if (item.dexCap !== undefined) fail(errors, id, "shield records must not define dexCap");
    if (item.stealthDisadvantage !== undefined) fail(errors, id, "shield records must not define stealthDisadvantage");
    if (typeof item.modifiers?.acBonus !== "number") fail(errors, id, "shield records require modifiers.acBonus");
  } else {
    validatePositiveNumber(errors, id, "ac", item.ac);
    if (item.dexCap !== null && typeof item.dexCap !== "number") fail(errors, id, "dexCap must be number or null");
    if (typeof item.stealthDisadvantage !== "boolean") fail(errors, id, "stealthDisadvantage must be boolean");
  }

  validateModifiers(errors, item);
}

export async function validateArmor(armorPath = DEFAULT_ARMOR_PATH) {
  const errors = [];
  const resolved = path.resolve(armorPath);
  const mod = await import(url.pathToFileURL(resolved).href);
  const records = mod.armor;
  if (!Array.isArray(records)) return [`${armorPath}: armor export must be an array`];

  const ids = new Set();
  for (const item of records) {
    validateArmorRecord(errors, item);
    if (!item?.id) continue;
    if (ids.has(item.id)) fail(errors, item.id, "duplicate id");
    ids.add(item.id);
  }
  return errors;
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  const errors = await validateArmor(process.argv[2] || DEFAULT_ARMOR_PATH);
  if (errors.length) {
    console.error(`[armor] Validation failed with ${errors.length} error(s):`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  console.log("[armor] Validation OK");
}
