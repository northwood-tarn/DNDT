#!/usr/bin/env node
// Strict validator for app/data/encounters.js.

import path from "node:path";
import url from "node:url";
import { enemies } from "../app/data/enemies.js";

const DEFAULT_ENCOUNTERS_PATH = "app/data/encounters.js";
const VALID_DIFFICULTIES = new Set(["trivial", "easy", "medium", "hard", "deadly", "boss"]);
const ENEMY_DEFINITION_IDS = new Set(Object.keys(enemies).map((id) => `enemy.${id}`));

function fail(errors, id, message) {
  errors.push(`${id}: ${message}`);
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function validateString(errors, id, pathName, value) {
  if (typeof value !== "string" || value.trim().length === 0) fail(errors, id, `${pathName} must be a non-empty string`);
}

function validateEnemyGroup(errors, encounterId, group, index) {
  const pathName = `enemies[${index}]`;
  if (!isPlainObject(group)) {
    fail(errors, encounterId, `${pathName} must be an object`);
    return;
  }
  validateString(errors, encounterId, `${pathName}.actorDefinitionId`, group.actorDefinitionId);
  if (group.actorDefinitionId && !ENEMY_DEFINITION_IDS.has(group.actorDefinitionId)) {
    fail(errors, encounterId, `${pathName}.actorDefinitionId references unknown actor definition: ${group.actorDefinitionId}`);
  }
  if (!Number.isInteger(group.count) || group.count <= 0) fail(errors, encounterId, `${pathName}.count must be a positive integer`);
  validateInstanceOverrides(errors, encounterId, group.defaults, `${pathName}.defaults`);
  if (group.instances != null) {
    if (!Array.isArray(group.instances)) {
      fail(errors, encounterId, `${pathName}.instances must be an array`);
    } else {
      if (group.instances.length > group.count) fail(errors, encounterId, `${pathName}.instances must not exceed count`);
      group.instances.forEach((instance, instanceIndex) => validateInstanceOverrides(errors, encounterId, instance, `${pathName}.instances[${instanceIndex}]`));
    }
  }
}

function validateInstanceOverrides(errors, encounterId, override, pathName) {
  if (override == null) return;
  if (!isPlainObject(override)) {
    fail(errors, encounterId, `${pathName} must be an object`);
    return;
  }
  if (override.id != null) validateString(errors, encounterId, `${pathName}.id`, override.id);
  if (override.name != null) validateString(errors, encounterId, `${pathName}.name`, override.name);
  for (const field of ["hp", "maxHp", "ac", "speed", "attackBonus", "initiativeBonus"]) {
    if (override[field] != null && !Number.isFinite(override[field])) fail(errors, encounterId, `${pathName}.${field} must be numeric`);
  }
  if (override.position != null) {
    if (!isPlainObject(override.position) || !Number.isInteger(override.position.x) || !Number.isInteger(override.position.y)) {
      fail(errors, encounterId, `${pathName}.position must have integer x and y`);
    }
  }
  if (override.masteredWeaponIds != null && !Array.isArray(override.masteredWeaponIds)) {
    fail(errors, encounterId, `${pathName}.masteredWeaponIds must be an array`);
  }
}

function validateEncounterRecord(errors, encounter, key) {
  const id = encounter?.id || key || "<unknown>";
  if (!isPlainObject(encounter)) {
    fail(errors, id, "record must be an object");
    return;
  }
  validateString(errors, id, "id", encounter.id);
  if (encounter.id !== key) fail(errors, id, `object key must match id (${key})`);
  if (typeof encounter.id === "string" && !/^[a-z0-9_]+$/.test(encounter.id)) fail(errors, id, "id must be snake_case");
  validateString(errors, id, "name", encounter.name);
  if (!VALID_DIFFICULTIES.has(encounter.difficulty)) fail(errors, id, `difficulty must be one of: ${Array.from(VALID_DIFFICULTIES).join(", ")}`);
  if (!Array.isArray(encounter.enemies) || encounter.enemies.length === 0) {
    fail(errors, id, "enemies must be a non-empty array");
  } else {
    encounter.enemies.forEach((group, index) => validateEnemyGroup(errors, id, group, index));
  }
  validateBattlefield(errors, id, encounter.battlefield);
}

function validateBattlefield(errors, encounterId, battlefield) {
  if (battlefield == null) return;
  if (!isPlainObject(battlefield)) return fail(errors, encounterId, "battlefield must be an object");
  if (battlefield.grid != null) validateGrid(errors, encounterId, battlefield.grid, "battlefield.grid");
  if (battlefield.heroPositions != null) validatePositions(errors, encounterId, battlefield.heroPositions, "battlefield.heroPositions", battlefield.grid);
  if (battlefield.combatObjects != null && !Array.isArray(battlefield.combatObjects)) {
    fail(errors, encounterId, "battlefield.combatObjects must be an array");
  }
}

function validateGrid(errors, encounterId, grid, pathName) {
  if (!isPlainObject(grid)) return fail(errors, encounterId, `${pathName} must be an object`);
  if (!Number.isInteger(grid.width) || grid.width <= 0) fail(errors, encounterId, `${pathName}.width must be a positive integer`);
  if (!Number.isInteger(grid.height) || grid.height <= 0) fail(errors, encounterId, `${pathName}.height must be a positive integer`);
  validatePositions(errors, encounterId, grid.blocked || [], `${pathName}.blocked`, grid);
  validatePositions(errors, encounterId, grid.cover || [], `${pathName}.cover`, grid);
  for (const [index, cover] of (grid.cover || []).entries()) {
    if (!["half", "three_quarters", "full"].includes(cover.kind)) {
      fail(errors, encounterId, `${pathName}.cover[${index}].kind must be half, three_quarters, or full`);
    }
  }
}

function validatePositions(errors, encounterId, positions, pathName, grid = null) {
  if (!Array.isArray(positions)) return fail(errors, encounterId, `${pathName} must be an array`);
  for (const [index, position] of positions.entries()) {
    if (!isPlainObject(position) || !Number.isInteger(position.x) || !Number.isInteger(position.y)) {
      fail(errors, encounterId, `${pathName}[${index}] must have integer x and y`);
      continue;
    }
    if (grid && (position.x < 0 || position.x >= grid.width || position.y < 0 || position.y >= grid.height)) {
      fail(errors, encounterId, `${pathName}[${index}] is out of grid bounds`);
    }
  }
}

export async function validateEncounters(encountersPath = DEFAULT_ENCOUNTERS_PATH) {
  const errors = [];
  const resolved = path.resolve(encountersPath);
  const mod = await import(url.pathToFileURL(resolved).href);
  const records = mod.encounters;
  if (!isPlainObject(records)) return [`${encountersPath}: encounters export must be an object keyed by id`];

  const ids = new Set();
  for (const [key, encounter] of Object.entries(records)) {
    validateEncounterRecord(errors, encounter, key);
    if (!encounter?.id) continue;
    if (ids.has(encounter.id)) fail(errors, encounter.id, "duplicate id");
    ids.add(encounter.id);
  }
  return errors;
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  const errors = await validateEncounters(process.argv[2] || DEFAULT_ENCOUNTERS_PATH);
  if (errors.length) {
    console.error(`[encounters] Validation failed with ${errors.length} error(s):`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  console.log("[encounters] Validation OK");
}
