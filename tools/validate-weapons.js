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
  if (item.modifiers.enhancementBonus !== undefined) validatePositiveNumber(errors, id, "modifiers.enhancementBonus", item.modifiers.enhancementBonus);
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
  validateString(errors, id, "inspectText", item.inspectText);
  if (item.type !== "equipment" || item.equipmentKind !== "weapon") fail(errors, id, "type/equipmentKind must identify equipment weapon");
  if (item.stackable !== false || item.maxStackSize !== 1) fail(errors, id, "weapons must be non-stackable with maxStackSize 1");
  if (!Array.isArray(item.allowedSlots) || !["weapon-1", "weapon-2"].every((slot) => item.allowedSlots.includes(slot))) fail(errors, id, "allowedSlots must include both weapon slots");
  if (!Array.isArray(item.proficiencies) || item.proficiencies.length !== 1 || !["simple_weapons", "martial_weapons"].includes(item.proficiencies[0])) fail(errors, id, "weapon must declare one canonical proficiency category");
  if (!VALID_TYPES.has(item.weaponType)) fail(errors, id, `weaponType must be one of: ${Array.from(VALID_TYPES).join(", ")}`);
  if (!["strength", "dexterity"].includes(item.attackAbility)) fail(errors, id, "attackAbility must be strength or dexterity");
  if (!isDiceExpression(item.damageFormula)) fail(errors, id, "damageFormula must be a dice expression");
  if (!VALID_DAMAGE_TYPES.has(item.damageType)) fail(errors, id, "damageType must be valid");
  if (!Number.isInteger(item.range) || item.range < 1) fail(errors, id, "range must be a positive grid-square integer");
  if (![1, 2].includes(item.hands)) fail(errors, id, "hands must be 1 or 2");
  if (!Array.isArray(item.properties)) fail(errors, id, "properties must be an array");
  if (item.mastery !== undefined && !VALID_MASTERIES.has(item.mastery)) {
    fail(errors, id, `mastery must be one of: ${Array.from(VALID_MASTERIES).join(", ")}`);
  }
  if (item.value !== undefined) validatePositiveNumber(errors, id, "value", item.value);
  if (typeof item.magical !== "boolean") fail(errors, id, "magical must be boolean");
  if (!Number.isInteger(item.enhancementBonus) || item.enhancementBonus < 0) fail(errors, id, "enhancementBonus must be a non-negative integer");
  if (!Array.isArray(item.effects)) fail(errors, id, "effects must be an array");
  if (!Array.isArray(item.damageBonuses)) fail(errors, id, "damageBonuses must be an array");
  for (const [index, bonus] of (item.damageBonuses || []).entries()) {
    const count = Number(bonus.damage !== undefined) + Number(bonus.damageFormula !== undefined);
    if (count !== 1) fail(errors, id, `damageBonuses[${index}] must declare exactly one fixed damage or damageFormula`);
    if (bonus.damage !== undefined && !Number.isFinite(bonus.damage)) fail(errors, id, `damageBonuses[${index}].damage must be numeric`);
    if (bonus.damageFormula !== undefined && !isDiceExpression(bonus.damageFormula)) fail(errors, id, `damageBonuses[${index}].damageFormula must be a dice expression`);
    if (bonus.damageType !== null && !VALID_DAMAGE_TYPES.has(bonus.damageType)) fail(errors, id, `damageBonuses[${index}].damageType must be valid or null`);
  }
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
