#!/usr/bin/env node
// Validates authored map JSON records against the map contract.
// Missing: there are not yet authored records under app/data/maps.

import fs from "node:fs";
import path from "node:path";
import url from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  ENGAGED_MAP_KINDS,
  MAP_KIND_DEFINITIONS,
  MAP_KIND_VALUES,
  NAVIGATION_MAP_KINDS,
  isEngagedMapKind,
  isMapKind,
  isNavigationMapKind,
} from "../app/data/mapKinds.js";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const DEFAULT_MAP_DIR = path.join(ROOT, "app/data/maps");
const SCHEMA_FILE = path.join(ROOT, "app/schemas/mapContract.schema.json");

function printOk(message) {
  console.log(`\x1b[32m${message}\x1b[0m`);
}

function printWarn(message) {
  console.warn(`\x1b[33m${message}\x1b[0m`);
}

function printErr(message) {
  console.error(`\x1b[31m${message}\x1b[0m`);
}

function loadJson(file) {
  try {
    return {
      ok: true,
      data: JSON.parse(fs.readFileSync(file, "utf8")),
    };
  } catch (error) {
    return { ok: false, error };
  }
}

function walkJson(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const next = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkJson(next, files);
    } else if (entry.isFile() && entry.name.endsWith(".json") && !entry.name.endsWith(".schema.json")) {
      files.push(next);
    }
  }
  return files;
}

function collectTargets(args) {
  if (!args.length) return walkJson(DEFAULT_MAP_DIR);

  const files = [];
  for (const arg of args) {
    const target = path.resolve(ROOT, arg);
    if (!fs.existsSync(target)) {
      printWarn(`[maps] Target does not exist: ${arg}`);
      continue;
    }
    const stat = fs.statSync(target);
    if (stat.isDirectory()) {
      walkJson(target, files);
    } else if (stat.isFile() && target.endsWith(".json") && !target.endsWith(".schema.json")) {
      files.push(target);
    }
  }
  return Array.from(new Set(files));
}

function validateKindRegistry(schema) {
  const errors = [];
  const schemaKinds = schema?.properties?.kind?.enum || [];
  const schemaKindSet = new Set(schemaKinds);

  for (const kind of MAP_KIND_VALUES) {
    if (!schemaKindSet.has(kind)) {
      errors.push(`Schema is missing kind enum: ${kind}`);
    }
    const definition = MAP_KIND_DEFINITIONS[kind];
    if (!definition) {
      errors.push(`Map kind has no definition: ${kind}`);
    }
  }

  for (const kind of schemaKinds) {
    if (!isMapKind(kind)) {
      errors.push(`Schema includes unknown kind enum: ${kind}`);
    }
  }

  for (const kind of NAVIGATION_MAP_KINDS) {
    if (!isNavigationMapKind(kind) || isEngagedMapKind(kind)) {
      errors.push(`Navigation kind is misclassified: ${kind}`);
    }
  }

  for (const kind of ENGAGED_MAP_KINDS) {
    if (!isEngagedMapKind(kind) || isNavigationMapKind(kind)) {
      errors.push(`Engaged kind is misclassified: ${kind}`);
    }
  }

  return errors;
}

function validateGraph(map) {
  const errors = [];
  const nodeIds = new Set((map.nodes || []).map((node) => node.id));
  const regionIds = new Set((map.regions || []).map((region) => region.id));

  if (nodeIds.size !== (map.nodes || []).length) {
    errors.push("Duplicate node ids");
  }
  if (regionIds.size !== (map.regions || []).length) {
    errors.push("Duplicate region ids");
  }

  for (const route of map.routes || []) {
    if (!nodeIds.has(route.from)) errors.push(`Route references missing from node: ${route.from}`);
    if (!nodeIds.has(route.to)) errors.push(`Route references missing to node: ${route.to}`);
  }

  for (const entry of map.entryPoints || []) {
    if (!nodeIds.has(entry.nodeId)) errors.push(`Entry point references missing node: ${entry.nodeId}`);
  }

  for (const exit of map.exits || []) {
    if (!nodeIds.has(exit.nodeId)) errors.push(`Exit references missing node: ${exit.nodeId}`);
  }

  if (map.savePosition?.nodeId && !nodeIds.has(map.savePosition.nodeId)) {
    errors.push(`Save position references missing node: ${map.savePosition.nodeId}`);
  }

  return errors;
}

function main() {
  const schemaLoad = loadJson(SCHEMA_FILE);
  if (!schemaLoad.ok) {
    printErr(`[maps] Could not load schema: ${schemaLoad.error.message}`);
    process.exit(1);
  }

  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schemaLoad.data);

  let errors = 0;
  const registryErrors = validateKindRegistry(schemaLoad.data);
  if (registryErrors.length) {
    errors += registryErrors.length;
    printErr(`[maps] Kind registry failed with ${registryErrors.length} error(s):`);
    for (const error of registryErrors) console.error(`  - ${error}`);
  } else {
    printOk("[maps] Kind registry OK");
  }

  const files = collectTargets(process.argv.slice(2));
  if (!files.length) {
    printWarn("[maps] No authored map JSON records found. Expected future records under app/data/maps/**/*.json");
  }

  for (const file of files) {
    const rel = path.relative(ROOT, file);
    const loaded = loadJson(file);
    if (!loaded.ok) {
      errors += 1;
      printErr(`[maps] Parse error in ${rel}: ${loaded.error.message}`);
      continue;
    }

    if (!validate(loaded.data)) {
      errors += validate.errors?.length || 1;
      printErr(`[maps] Schema errors in ${rel}:`);
      for (const error of validate.errors || []) {
        const at = error.instancePath || "/";
        console.error(`  - ${at} ${error.message}`);
      }
      continue;
    }

    const graphErrors = validateGraph(loaded.data);
    if (graphErrors.length) {
      errors += graphErrors.length;
      printErr(`[maps] Graph errors in ${rel}:`);
      for (const error of graphErrors) console.error(`  - ${error}`);
      continue;
    }

    printOk(`[maps] ${rel} OK`);
  }

  if (errors > 0) {
    printErr(`[maps] Completed with ${errors} error(s)`);
    process.exit(1);
  }

  printOk(`[maps] Validation OK (${files.length} map record(s))`);
}

main();
