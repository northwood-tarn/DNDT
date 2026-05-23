#!/usr/bin/env node
// Strict validator for app/data/weapons.js.

import path from "node:path";
import url from "node:url";
import { WEAPON_MASTERIES } from "../app/data/weaponMasteries.js";

const DEFAULT_WEAPONS_PATH = "app/data/weapons.js";

const VALID_USE_TIMES = new Set(["action", "bonus", "bonus_action", "reaction", "exploration"]);
const VALID_TYPES = new Set(["melee", "ranged"]);
const VALID_MASTERIES = new Set(Object.keys(WEAPON_MASTERIES));
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

function isDiceExpression(value) {
  return typeof value === "string" && /^\d*d\d+(?:[+-]\d+)?$/i.test(value.replace(/\s+/g, ""));
}

function validateString(errors, id, pathName, value) {
  if (typeof value !== "string" || value.trim().length === 0) fail(errors, id, `${pathName} must be a non-empty string`);
}

function validatePositiveNumber(errors, id, pathName, value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) fail(errors, id, `${pathName} must be a positive number`);
}

function validateDamageBonus(errors, id, bonus, index) {
  const pathName = `modifiers.damageBonuses[${index}]`;
  if (!isPlainObject(bonus)) {
    fail(errors, id, `${pathName} must be an object`);
    return;
  }
  if (typeof bonus.amount !== "number" && !isDiceExpression(bonus.amount)) {
    fail(errors, id, `${pathName}.amount must be a number or dice expression`);
  }
  if (bonus.type !== null && bonus.type !== undefined && !VALID_DAMAGE_TYPES.has(bonus.type)) {
    fail(errors, id, `${pathName}.type must be a valid damage type or null`);
  }
}

function validateModifiers(errors, item) {
  const id = item?.id || "<unknown>";
  if (item.modifiers === undefined) return;
  if (!isPlainObject(item.modifiers)) {
    fail(errors, id, "modifiers must be an object");
    return;
  }
  if (item.modifiers.damageBonuses !== undefined) {
    if (!Array.isArray(item.modifiers.damageBonuses)) {
      fail(errors, id, "modifiers.damageBonuses must be an array");
    } else {
      item.modifiers.damageBonuses.forEach((bonus, index) => validateDamageBonus(errors, id, bonus, index));
    }
  }
  if (item.modifiers.acBonus !== undefined) validatePositiveNumber(errors, id, "modifiers.acBonus", item.modifiers.acBonus);
}

function validateWeaponRecord(errors, item) {
  const id = item?.id || "<unknown>";
  if (!isPlainObject(item)) {
    fail(errors, id, "record must be an object");
    return;
  }
  validateString(errors, id, "id", item.id);
  if (typeof item.id === "string" && !/^[a-z0-9_]+$/.test(item.id)) fail(errors, id, "id must be snake_case");
  validateString(errors, id, "name", item.name);
  validateString(errors, id, "description", item.description);
  if (item.uses !== "infinite") fail(errors, id, "uses must currently be infinite");
  if (typeof item.consumeOnUse !== "boolean") fail(errors, id, "consumeOnUse must be boolean");
  if (!VALID_USE_TIMES.has(item.useTime)) fail(errors, id, `useTime must be one of: ${Array.from(VALID_USE_TIMES).join(", ")}`);
  if (!VALID_TYPES.has(item.type)) fail(errors, id, `type must be one of: ${Array.from(VALID_TYPES).join(", ")}`);
  if (!isDiceExpression(item.damage)) fail(errors, id, "damage must be a dice expression");
  if (!Array.isArray(item.properties)) fail(errors, id, "properties must be an array");
  if (item.mastery !== undefined && !VALID_MASTERIES.has(item.mastery)) {
    fail(errors, id, `mastery must be one of: ${Array.from(VALID_MASTERIES).join(", ")}`);
  }
  if (item.value !== undefined) validatePositiveNumber(errors, id, "value", item.value);
  if (item.effect !== undefined) validateString(errors, id, "effect", item.effect);
  if (item.magical !== undefined && typeof item.magical !== "boolean") fail(errors, id, "magical must be boolean");
  validateModifiers(errors, item);
}

export async function validateWeapons(weaponsPath = DEFAULT_WEAPONS_PATH) {
  const errors = [];
  const resolved = path.resolve(weaponsPath);
  const mod = await import(url.pathToFileURL(resolved).href);
  const records = mod.weapons;
  if (!Array.isArray(records)) return [`${weaponsPath}: weapons export must be an array`];

  const ids = new Set();
  for (const item of records) {
    validateWeaponRecord(errors, item);
    if (!item?.id) continue;
    if (ids.has(item.id)) fail(errors, item.id, "duplicate id");
    ids.add(item.id);
  }
  return errors;
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  const errors = await validateWeapons(process.argv[2] || DEFAULT_WEAPONS_PATH);
  if (errors.length) {
    console.error(`[weapons] Validation failed with ${errors.length} error(s):`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  console.log("[weapons] Validation OK");
}
