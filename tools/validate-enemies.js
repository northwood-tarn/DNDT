#!/usr/bin/env node
// Strict validator for app/data/enemies.js.

import path from "node:path";
import url from "node:url";
import { weapons } from "../app/data/weapons.js";
import { WEAPON_MASTERY_IDS } from "../app/data/weaponMasteries.js";
import { AI_PROFILE_IDS } from "../app/combat/aiProfiles.js";
import { validateCombatAction } from "../app/combat/actionSchema.js";
import { compileEnemyActions, validateEnemyActionRefs } from "../app/combat/enemyActionCompiler.js";

const DEFAULT_ENEMIES_PATH = "app/data/enemies.js";

const VALID_CREATURE_TYPES = new Set(["beast", "humanoid", "undead"]);
const VALID_SIZES = new Set(["tiny", "small", "medium", "large", "huge", "gargantuan"]);
const VALID_UNDEAD_RANKS = new Set(["profane", "bound", "sovereign"]);
const VALID_VISIONS = new Set(["light_bound", "darkvision", "lantern", "dark_abhorrent"]);
const VALID_HOSTILITY = new Set(["onsight", "territorial", "swarm"]);
const VALID_AI_PROFILES = new Set(AI_PROFILE_IDS);
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
const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];
const WEAPON_BY_ID = new Map(weapons.map(weapon => [weapon.id, weapon]));
const WEAPON_IDS = new Set(WEAPON_BY_ID.keys());
const MASTERY_IDS = new Set(WEAPON_MASTERY_IDS);

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

function validateNumber(errors, id, pathName, value) {
  if (typeof value !== "number" || !Number.isFinite(value)) fail(errors, id, `${pathName} must be numeric`);
}

function validatePositiveNumber(errors, id, pathName, value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) fail(errors, id, `${pathName} must be a positive number`);
}

function validateSaves(errors, enemy) {
  const id = enemy?.id || "<unknown>";
  if (!isPlainObject(enemy.saves)) {
    fail(errors, id, "saves must be an object");
    return;
  }
  for (const ability of ABILITIES) {
    validateNumber(errors, id, `saves.${ability}`, enemy.saves[ability]);
  }
}

function validateAwareness(errors, enemy) {
  const id = enemy?.id || "<unknown>";
  const awareness = enemy.awareness;
  if (!isPlainObject(awareness)) {
    fail(errors, id, "awareness must be an object");
    return;
  }
  if (!VALID_VISIONS.has(awareness.vision)) fail(errors, id, `awareness.vision must be one of: ${Array.from(VALID_VISIONS).join(", ")}`);
  if (!VALID_HOSTILITY.has(awareness.hostility)) fail(errors, id, `awareness.hostility must be one of: ${Array.from(VALID_HOSTILITY).join(", ")}`);
  validatePositiveNumber(errors, id, "awareness.visionRange", awareness.visionRange);
  if (awareness.hostility === "swarm") validateString(errors, id, "awareness.swarmGroup", awareness.swarmGroup);
}

function validateLoot(errors, enemy) {
  const id = enemy?.id || "<unknown>";
  const loot = enemy.loot;
  if (!isPlainObject(loot)) {
    fail(errors, id, "loot must be an object");
    return;
  }
  if (!isPlainObject(loot.gold)) {
    fail(errors, id, "loot.gold must be an object");
  } else {
    validateNumber(errors, id, "loot.gold.min", loot.gold.min);
    validateNumber(errors, id, "loot.gold.max", loot.gold.max);
    if (loot.gold.min > loot.gold.max) fail(errors, id, "loot.gold.min must not exceed loot.gold.max");
  }
  validateString(errors, id, "loot.table", loot.table);
  validateString(errors, id, "loot.rarityBias", loot.rarityBias);
}

function validateAttackSource(errors, enemy) {
  const id = enemy?.id || "<unknown>";
  const hasWeapon = typeof enemy.weaponId === "string";
  const hasNatural = isPlainObject(enemy.naturalAttack);
  if (hasWeapon === hasNatural) fail(errors, id, "must define exactly one of weaponId or naturalAttack");
  if (!hasWeapon && enemy.masteredWeaponIds != null) fail(errors, id, "masteredWeaponIds requires weaponId");
  if (!hasWeapon && enemy.enableWeaponMastery != null) fail(errors, id, "enableWeaponMastery requires weaponId");

  if (hasWeapon) {
    if (!WEAPON_IDS.has(enemy.weaponId)) fail(errors, id, `weaponId references unknown weapon: ${enemy.weaponId}`);
    if (!isDiceExpression(enemy.damage)) fail(errors, id, "damage must be a dice expression when weaponId is used");
    if (!VALID_DAMAGE_TYPES.has(enemy.damageType)) fail(errors, id, "damageType must be valid when weaponId is used");
    validateMasteredWeaponIds(errors, enemy);
  }

  if (hasNatural) {
    validateString(errors, id, "naturalAttack.id", enemy.naturalAttack.id);
    validateString(errors, id, "naturalAttack.name", enemy.naturalAttack.name);
    if (enemy.naturalAttack.range != null) validatePositiveNumber(errors, id, "naturalAttack.range", enemy.naturalAttack.range);
    if (!isDiceExpression(enemy.naturalAttack.damage)) fail(errors, id, "naturalAttack.damage must be a dice expression");
    if (!VALID_DAMAGE_TYPES.has(enemy.naturalAttack.damageType)) fail(errors, id, "naturalAttack.damageType must be valid");
  }
}

function validateMasteredWeaponIds(errors, enemy) {
  const id = enemy?.id || "<unknown>";
  if (enemy.enableWeaponMastery != null && typeof enemy.enableWeaponMastery !== "boolean") {
    fail(errors, id, "enableWeaponMastery must be boolean when present");
  }
  if (enemy.masteredWeaponIds == null) return;
  if (!Array.isArray(enemy.masteredWeaponIds)) {
    fail(errors, id, "masteredWeaponIds must be an array");
    return;
  }
  for (const weaponId of enemy.masteredWeaponIds) {
    const weapon = WEAPON_BY_ID.get(weaponId);
    if (!weapon) {
      fail(errors, id, `masteredWeaponIds references unknown weapon: ${weaponId}`);
      continue;
    }
    if (!MASTERY_IDS.has(weapon.mastery)) fail(errors, id, `mastered weapon ${weaponId} has invalid mastery: ${weapon.mastery || "(missing)"}`);
  }
}

function validateEnemyRecord(errors, enemy, key) {
  const id = enemy?.id || key || "<unknown>";
  if (!isPlainObject(enemy)) {
    fail(errors, id, "record must be an object");
    return;
  }
  validateString(errors, id, "id", enemy.id);
  if (enemy.id !== key) fail(errors, id, `object key must match id (${key})`);
  if (typeof enemy.id === "string" && !/^[a-z0-9_]+$/.test(enemy.id)) fail(errors, id, "id must be snake_case");
  validateString(errors, id, "name", enemy.name);
  validateString(errors, id, "role", enemy.role);
  if (!VALID_CREATURE_TYPES.has(enemy.creatureType)) fail(errors, id, `creatureType must be one of: ${Array.from(VALID_CREATURE_TYPES).join(", ")}`);
  if (!VALID_SIZES.has(enemy.size)) fail(errors, id, `size must be one of: ${Array.from(VALID_SIZES).join(", ")}`);
  if (enemy.creatureType === "undead" && !VALID_UNDEAD_RANKS.has(enemy.undeadRank)) fail(errors, id, "undead enemies require valid undeadRank");
  if (enemy.creatureType !== "undead" && enemy.undeadRank !== undefined) fail(errors, id, "only undead enemies may define undeadRank");
  validatePositiveNumber(errors, id, "level", enemy.level);
  validatePositiveNumber(errors, id, "hp", enemy.hp);
  validatePositiveNumber(errors, id, "maxHp", enemy.maxHp);
  if (enemy.hp > enemy.maxHp) fail(errors, id, "hp must not exceed maxHp");
  validatePositiveNumber(errors, id, "ac", enemy.ac);
  validatePositiveNumber(errors, id, "speed", enemy.speed);
  validateNumber(errors, id, "attackBonus", enemy.attackBonus);
  validatePositiveNumber(errors, id, "xpValue", enemy.xpValue);
  validateString(errors, id, "description", enemy.description);
  validateString(errors, id, "aiProfile", enemy.aiProfile);
  if (enemy.aiProfile && !VALID_AI_PROFILES.has(enemy.aiProfile)) fail(errors, id, `aiProfile must be one of: ${Array.from(VALID_AI_PROFILES).join(", ")}`);
  validateAttackSource(errors, enemy);
  validateOptionalArrays(errors, enemy, ["tags", "resources", "features", "featureHooks", "activeEffects", "auras", "marks", "resistances", "immunities", "conditionImmunities", "actionRefs"]);
  validateEnemyFeatureSurfaces(errors, enemy);
  validateEnemyActionSurface(errors, enemy);
  validateAwareness(errors, enemy);
  validateSaves(errors, enemy);
  validateLoot(errors, enemy);
}

function validateEnemyActionSurface(errors, enemy) {
  const id = enemy?.id || "<unknown>";
  for (const error of validateEnemyActionRefs(enemy)) fail(errors, id, error);
  const actions = compileEnemyActions(enemy);
  if (!actions.length) fail(errors, id, "action compiler must emit at least one action");
  const resourceIds = new Set((enemy.resources || []).map(resource => resource.id));
  for (const action of actions) {
    for (const error of validateCombatAction(action)) fail(errors, id, `compiled action ${action.id}: ${error}`);
    for (const resourceId of [action.resourceId, ...(action.additionalResourceIds || [])].filter(Boolean)) {
      if (!resourceIds.has(resourceId)) fail(errors, id, `compiled action ${action.id} references missing resource: ${resourceId}`);
    }
  }
}

function validateOptionalArrays(errors, enemy, fields) {
  const id = enemy?.id || "<unknown>";
  for (const field of fields) {
    if (enemy[field] != null && !Array.isArray(enemy[field])) fail(errors, id, `${field} must be an array when present`);
  }
}

function validateEnemyFeatureSurfaces(errors, enemy) {
  const id = enemy?.id || "<unknown>";
  for (const [index, hook] of (enemy.featureHooks || []).entries()) {
    const pathName = `featureHooks[${index}]`;
    if (!isPlainObject(hook)) {
      fail(errors, id, `${pathName} must be an object`);
      continue;
    }
    validateString(errors, id, `${pathName}.id`, hook.id);
    if (hook.implemented === false || hook.unsupported === true) fail(errors, id, `${pathName} is marked unsupported`);
  }
  for (const [index, feature] of (enemy.features || []).entries()) {
    const pathName = `features[${index}]`;
    if (!isPlainObject(feature)) {
      fail(errors, id, `${pathName} must be an object`);
      continue;
    }
    validateString(errors, id, `${pathName}.id`, feature.id);
    validateString(errors, id, `${pathName}.name`, feature.name);
    validateActionOptions(errors, id, feature.effects?.actionOptions, `${pathName}.effects.actionOptions`);
    validateActionOptions(errors, id, feature.grants?.actionOptions, `${pathName}.grants.actionOptions`);
  }
  for (const [index, resource] of (enemy.resources || []).entries()) {
    const pathName = `resources[${index}]`;
    if (!isPlainObject(resource)) {
      fail(errors, id, `${pathName} must be an object`);
      continue;
    }
    validateString(errors, id, `${pathName}.id`, resource.id);
    validateString(errors, id, `${pathName}.name`, resource.name);
    validateNumber(errors, id, `${pathName}.max`, resource.max);
    validateNumber(errors, id, `${pathName}.current`, resource.current);
  }
}

function validateActionOptions(errors, enemyId, actionOptions, pathName) {
  if (actionOptions == null) return;
  if (!Array.isArray(actionOptions)) {
    fail(errors, enemyId, `${pathName} must be an array`);
    return;
  }
  const ids = new Set();
  for (const [index, option] of actionOptions.entries()) {
    if (!isPlainObject(option)) {
      fail(errors, enemyId, `${pathName}[${index}] must be an object`);
      continue;
    }
    validateString(errors, enemyId, `${pathName}[${index}].id`, option.id);
    if (ids.has(option.id)) fail(errors, enemyId, `${pathName}[${index}].id duplicates ${option.id}`);
    ids.add(option.id);
  }
}

export async function validateEnemies(enemiesPath = DEFAULT_ENEMIES_PATH) {
  const errors = [];
  const resolved = path.resolve(enemiesPath);
  const mod = await import(url.pathToFileURL(resolved).href);
  const records = mod.enemies;
  if (!isPlainObject(records)) return [`${enemiesPath}: enemies export must be an object keyed by id`];

  const ids = new Set();
  for (const [key, enemy] of Object.entries(records)) {
    validateEnemyRecord(errors, enemy, key);
    if (!enemy?.id) continue;
    if (ids.has(enemy.id)) fail(errors, enemy.id, "duplicate id");
    ids.add(enemy.id);
  }
  return errors;
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  const errors = await validateEnemies(process.argv[2] || DEFAULT_ENEMIES_PATH);
  if (errors.length) {
    console.error(`[enemies] Validation failed with ${errors.length} error(s):`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  console.log("[enemies] Validation OK");
}
