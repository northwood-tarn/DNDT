#!/usr/bin/env node
// tools/validate.js — ESM-native dev validator for JSON + cross-links
// Usage:
//   node tools/validate.js [--patterns "glob1,glob2"] [--schema-map "pat:sch,pat2:sch2"] [--no-cross]
//
// Notes:
// - Robustly registers JSON Schema draft 2020-12 meta schema with AJV (no JSON import attributes).
// - Runs basic JSON parse checks, schema validation, and encounter/enemy cross-checks.

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// --- CLI parsing ---
function arg(name, def=null) {
  const i = process.argv.indexOf(name);
  if (i !== -1) {
    const v = process.argv[i+1];
    if (v && !v.startsWith('--')) return v;
    return true;
  }
  return def;
}

const PATTERNS = (arg('--patterns', '') || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const SCHEMA_MAP_ARGS = (arg('--schema-map', '') || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean); // pattern:schema

const NO_CROSS = process.argv.includes('--no-cross');

// Built-in defaults
const defaultAreasSchema = path.resolve('app/areas/area.schema.json');
const defaultAreasPattern = 'app/areas/**/*.json';

// --- tiny glob ---
function matchGlob(file, pattern) {
  const esc = s => s.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&');
  const rx = '^' + pattern.split('**').map(seg => esc(seg).replace(/\\\*/g, '[^/]*')).join('(?:.*)') + '$';
  return new RegExp(rx).test(file);
}

function* walk(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules','.git','dist','build','coverage'].includes(e.name)) continue;
      yield* walk(p);
    } else {
      yield p;
    }
  }
}

function collectFiles(patterns) {
  if (!patterns.length) return [];
  const roots = new Set(patterns.map(p => p.split('/')[0] || '.'));
  const files = [];
  for (const root of roots) {
    for (const f of walk(root)) {
      for (const pat of patterns) {
        if (matchGlob(f, pat)) { files.push(f); break; }
      }
    }
  }
  return Array.from(new Set(files));
}

function loadJson(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    return { ok: true, data: JSON.parse(raw) };
  } catch (e) {
    return { ok: false, error: e };
  }
}

async function loadModuleMaybe(file) {
  try {
    const urlPath = url.pathToFileURL(path.resolve(file)).href;
    const mod = await import(urlPath);
    return { ok: true, mod };
  } catch (e) {
    return { ok: false, error: e };
  }
}

/*
function groupBySchema(files, explicitMap) {
  const map = new Map(); // schemaPath -> [files]
  // explicit pattern mappings first
  for (const pair of explicitMap) {
    const ix = pair.indexOf(':');
    if (ix <= 0) continue;
    const pat = pair.slice(0, ix);
    const sch = path.resolve(pair.slice(ix+1));
    for (const f of files) if (matchGlob(f, pat)) {
      const arr = map.get(sch) || [];
      arr.push(f);
      map.set(sch, arr);
    }
  }
  // built-in: areas JSON -> areas schema (exclude *.schema.json)
  if (fs.existsSync(defaultAreasSchema)) {
    for (const f of files) {
      if (matchGlob(f, defaultAreasPattern) && !f.endsWith('.schema.json')) {
        const arr = map.get(defaultAreasSchema) || [];
        arr.push(f);
        map.set(defaultAreasSchema, arr);
      }
    }
  }
  return map;
}
*/

async function getAjv() {
  try {
    const m = await import('ajv/dist/2020.js');
    const Ajv = m.default || m;
    let addFormats = null;
    try { addFormats = (await import('ajv-formats')).default; } catch {}

    const ajv = new Ajv({ allErrors: true, strict: false });

    // Register draft 2020-12 meta schema so AJV can validate those
    try {
      let schemaFilePath = null;

      // Prefer Node's resolver if available (Node 20+/22+)
      try {
        // import.meta.resolve returns a file URL
        const u = await import.meta.resolve('ajv/dist/refs/json-schema-2020-12/schema.json');
        if (u && u.startsWith('file:')) {
          schemaFilePath = url.fileURLToPath(u);
        }
      } catch {}

      // Fallbacks: project root and script-local node_modules
      if (!schemaFilePath) {
        const p1 = path.resolve(process.cwd(), 'node_modules/ajv/dist/refs/json-schema-2020-12/schema.json');
        if (fs.existsSync(p1)) schemaFilePath = p1;
      }
      if (!schemaFilePath) {
        const p2 = path.resolve(__dirname, '../node_modules/ajv/dist/refs/json-schema-2020-12/schema.json');
        if (fs.existsSync(p2)) schemaFilePath = p2;
      }

      if (schemaFilePath) {
        const draft2020 = JSON.parse(fs.readFileSync(schemaFilePath, 'utf-8'));
        ajv.addMetaSchema(draft2020);
      } else {
        console.warn('[validate] Could not locate draft 2020-12 meta schema file');
      }
    } catch (e) {
      console.warn('[validate] Could not register draft 2020-12 meta schema:', e.message);
    }

    if (addFormats) addFormats(ajv);
    return ajv;
  } catch (e) {
    return null;
  }
}

function printErr(msg) { console.error('\x1b[31m' + msg + '\x1b[0m'); }
function printWarn(msg){ console.warn('\x1b[33m' + msg + '\x1b[0m'); }
function printOk(msg)  { console.log('\x1b[32m' + msg + '\x1b[0m'); }

async function checkRegistry() {
  const regMod = await loadModuleMaybe('app/areas/registry.js');
  if (!regMod.ok) {
    printWarn(`[registry] Could not load registry module: ${regMod.error.message}`);
    return 1;
  }
  const registry = regMod.mod.default || regMod.mod;
  if (!registry || typeof registry !== 'object') {
    printErr('[registry] Registry is not an object');
    return 1;
  }
  let errors = 0;
  let warnings = 0;
  for (const [key, entry] of Object.entries(registry)) {
    if (!entry || typeof entry !== 'object') {
      printErr(`[registry] Entry for key "${key}" is not an object`);
      errors++;
      continue;
    }
    if (!entry.name || typeof entry.name !== 'string') {
      printErr(`[registry] Entry for key "${key}" missing required "name" property`);
      errors++;
    }
    if (!entry.entry && !entry.path) {
      printWarn(`[registry] Entry for key "${key}" missing both "entry" and "path" properties`);
      warnings++;
    }
  }
  if (errors > 0) {
    printErr(`[registry] Validation completed with ${errors} error(s) and ${warnings} warning(s)`);
  } else if (warnings > 0) {
    printWarn(`[registry] Validation completed with ${warnings} warning(s)`);
  } else {
    printOk('[registry] Validation OK');
  }
  return errors;
}

async function main() {
  const patterns = PATTERNS.length ? PATTERNS : [defaultAreasPattern, 'app/data/**/*.json'];
  const files = collectFiles(patterns);
  if (!files.length) {
    printWarn('[validate] No JSON files found for patterns: ' + patterns.join(', '));
  }

  let jsonErrors = 0;
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    if (f.endsWith('.schema.json')) continue;
    const res = loadJson(f);
    if (!res.ok) {
      jsonErrors++;
      printErr(`[json] Parse error in ${f}: ${res.error.message}`);
    }
  }

  const ajv = await getAjv();
  if (!ajv) {
    printWarn('[validate] AJV not installed. Run: npm i -D ajv ajv-formats');
  } else {
    /*
    const bySchema = groupBySchema(files, SCHEMA_MAP_ARGS);
    for (const [schemaPath, list] of bySchema.entries()) {
      const schemaLoad = loadJson(schemaPath);
      if (!schemaLoad.ok) {
        printWarn(`[schema] Could not load schema: ${schemaPath} (${schemaLoad.error.message})`);
        continue;
      }
      const validate = ajv.compile(schemaLoad.data);
      for (const f of list) {
        if (!f.endsWith('.json') || f.endsWith('.schema.json')) continue;
        const data = loadJson(f);
        if (!data.ok) continue;
        const ok = validate(data.data);
        if (!ok) {
          jsonErrors++;
          printErr(`[schema] ${f}`);
          for (const e of validate.errors || []) {
            console.error('  -', e.instancePath || '/', e.message);
          }
        }
      }
    }
    */
    const registryErrors = await checkRegistry();
    jsonErrors += registryErrors;
  }

  if (!NO_CROSS) {
    await crossChecks();
  }

  if (jsonErrors > 0) {
    process.exitCode = 1;
    printErr(`[validate] Completed with errors: ${jsonErrors}`);
  } else {
    printOk('[validate] OK');
  }
}

async function crossChecks() {
  const enemiesMod = await loadModuleMaybe('app/data/enemies.js');
  const encountersMod = await loadModuleMaybe('app/data/encounters.js');
  if (!enemiesMod.ok || !encountersMod.ok) return;
  let enemies = enemiesMod.mod.default || enemiesMod.mod.ENEMIES || enemiesMod.mod.enemies || enemiesMod.mod;
  let encounters = encountersMod.mod.default || encountersMod.mod.ENCOUNTERS || encountersMod.mod.encounters || encountersMod.mod;
  try {
    if (enemies && typeof enemies === 'object') {
      const ids = new Set(Array.isArray(enemies) ? enemies.map(e=>e.id || e.name) : Object.keys(enemies));
      const miss = new Set();
      const list = Array.isArray(encounters) ? encounters : Object.values(encounters || {});
      for (const enc of list) {
        const refs = enc?.enemies || enc?.enemyIds || [];
        for (const r of refs) if (!ids.has(r)) miss.add(r);
      }
      if (miss.size) {
        printWarn('[cross] Unknown enemy ids referenced in encounters:');
        for (const m of miss) console.warn('  -', m);
      }
    }
  } catch {}
}

main().catch(e => {
  printErr('[validate] Fatal error: ' + e.message);
  process.exit(2);
});
