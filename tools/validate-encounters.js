#!/usr/bin/env node
// Strict validator for app/data/encounters.js.

import path from "node:path";
import url from "node:url";
import { enemies } from "../app/data/enemies.js";

const DEFAULT_ENCOUNTERS_PATH = "app/data/encounters.js";
const VALID_DIFFICULTIES = new Set(["trivial", "easy", "medium", "hard", "deadly", "boss"]);
const ENEMY_IDS = new Set(Object.keys(enemies));

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
  validateString(errors, encounterId, `${pathName}.enemyId`, group.enemyId);
  if (group.enemyId && !ENEMY_IDS.has(group.enemyId)) fail(errors, encounterId, `${pathName}.enemyId references unknown enemy: ${group.enemyId}`);
  if (!Number.isInteger(group.count) || group.count <= 0) fail(errors, encounterId, `${pathName}.count must be a positive integer`);
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
