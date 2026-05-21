#!/usr/bin/env node
// Strict validator for app/data/uniques.js.

import path from "node:path";
import url from "node:url";

const DEFAULT_UNIQUES_PATH = "app/data/uniques.js";

const VALID_USE_TIMES = new Set(["dialogue", "exploration"]);
const VALID_CONTEXTS = new Set(["dialogue", "exploration"]);

function fail(errors, id, message) {
  errors.push(`${id}: ${message}`);
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function validateString(errors, id, pathName, value) {
  if (typeof value !== "string" || value.trim().length === 0) fail(errors, id, `${pathName} must be a non-empty string`);
}

function validateBoolean(errors, id, pathName, value) {
  if (typeof value !== "boolean") fail(errors, id, `${pathName} must be boolean`);
}

function validateStringArray(errors, id, pathName, value, validValues = null) {
  if (!Array.isArray(value)) {
    fail(errors, id, `${pathName} must be an array`);
    return;
  }
  for (const entry of value) {
    if (typeof entry !== "string" || !entry.trim()) {
      fail(errors, id, `${pathName} entries must be non-empty strings`);
      continue;
    }
    if (validValues && !validValues.has(entry)) fail(errors, id, `${pathName} contains unsupported value: ${entry}`);
  }
}

function validateCombat(errors, item) {
  const id = item?.id || "<unknown>";
  if (!isPlainObject(item.combat)) {
    fail(errors, id, "combat must be an object");
    return;
  }
  if (item.combat.usable !== false) fail(errors, id, "combat.usable must be false for unique narrative items");
}

function validateNarrative(errors, item) {
  const id = item?.id || "<unknown>";
  const narrative = item.narrative;
  if (!isPlainObject(narrative)) {
    fail(errors, id, "narrative must be an object");
    return;
  }
  validateStringArray(errors, id, "narrative.contexts", narrative.contexts, VALID_CONTEXTS);
  validateStringArray(errors, id, "narrative.tags", narrative.tags);
  validateString(errors, id, "narrative.inspectText", narrative.inspectText);
  if (narrative.dialogueKeys !== undefined) validateStringArray(errors, id, "narrative.dialogueKeys", narrative.dialogueKeys);
}

function validateUniqueRecord(errors, item) {
  const id = item?.id || "<unknown>";
  if (!isPlainObject(item)) {
    fail(errors, id, "record must be an object");
    return;
  }
  validateString(errors, id, "id", item.id);
  if (typeof item.id === "string" && !/^[a-z0-9_]+$/.test(item.id)) fail(errors, id, "id must be snake_case");
  validateString(errors, id, "name", item.name);
  if (item.type !== "unique") fail(errors, id, "type must be unique");
  if (item.category !== "narrative") fail(errors, id, "category must be narrative");
  if (item.uses !== "infinite") fail(errors, id, "uses must be infinite");
  if (!VALID_USE_TIMES.has(item.useTime)) fail(errors, id, `useTime must be one of: ${Array.from(VALID_USE_TIMES).join(", ")}`);
  validateBoolean(errors, id, "unique", item.unique);
  if (item.unique !== true) fail(errors, id, "unique must be true");
  validateBoolean(errors, id, "consumeOnUse", item.consumeOnUse);
  if (item.consumeOnUse !== false) fail(errors, id, "consumeOnUse must be false");
  validateBoolean(errors, id, "stackable", item.stackable);
  if (item.stackable !== false) fail(errors, id, "stackable must be false");
  validateString(errors, id, "description", item.description);
  if (item.value !== undefined && (typeof item.value !== "number" || !Number.isFinite(item.value) || item.value < 0)) {
    fail(errors, id, "value must be a non-negative number");
  }
  validateCombat(errors, item);
  validateNarrative(errors, item);
}

export async function validateUniques(uniquesPath = DEFAULT_UNIQUES_PATH) {
  const errors = [];
  const resolved = path.resolve(uniquesPath);
  const mod = await import(url.pathToFileURL(resolved).href);
  const records = mod.uniques;
  if (!Array.isArray(records)) return [`${uniquesPath}: uniques export must be an array`];

  const ids = new Set();
  for (const item of records) {
    validateUniqueRecord(errors, item);
    if (!item?.id) continue;
    if (ids.has(item.id)) fail(errors, item.id, "duplicate id");
    ids.add(item.id);
  }
  return errors;
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  const errors = await validateUniques(process.argv[2] || DEFAULT_UNIQUES_PATH);
  if (errors.length) {
    console.error(`[uniques] Validation failed with ${errors.length} error(s):`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  console.log("[uniques] Validation OK");
}
