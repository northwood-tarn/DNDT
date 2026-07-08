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
import { validateArmor } from './validate-armor.js';
import { validateBackgrounds } from './validate-backgrounds.js';
import { validateClasses } from './validate-classes.js';
import { validateCombatLegacy } from './validate-combat-legacy.js';
import { validateConsumables } from './validate-consumables.js';
import { validateEnemies } from './validate-enemies.js';
import { validateEncounters } from './validate-encounters.js';
import { validateFeats } from './validate-feats.js';
import { validatePcMiniAssets } from './validate-pc-mini-assets.js';
import { validatePcMiniRules } from './validate-pc-mini-selection.js';
import { validateSpells } from './validate-spells.js';
import { validateSpecies } from './validate-species.js';
import { validateTools } from './validate-tools.js';
import { validateUniques } from './validate-uniques.js';
import { validateWeapons } from './validate-weapons.js';

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
      if (!String(e?.message || '').includes('already exists')) {
        console.warn('[validate] Could not register draft 2020-12 meta schema:', e.message);
      }
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
    if (!entry.id || typeof entry.id !== 'string') {
      printErr(`[registry] Entry for key "${key}" missing required "id" property`);
      errors++;
    }
    if (entry.id && entry.id !== key) {
      printWarn(`[registry] Entry for key "${key}" has mismatched id "${entry.id}"`);
      warnings++;
    }
    if (!entry.title || typeof entry.title !== 'string') {
      printErr(`[registry] Entry for key "${key}" missing required "title" property`);
      errors++;
    }
    const validKinds = new Set(['dialogue', 'exploration_map', 'combat', 'system_cutscene']);
    if (!validKinds.has(entry.kind)) {
      printErr(`[registry] Entry for key "${key}" has invalid or missing "kind" property`);
      errors++;
    }
    if (!entry.assets || typeof entry.assets !== 'object') {
      printErr(`[registry] Entry for key "${key}" missing required "assets" object`);
      errors++;
      continue;
    }
    if (entry.kind === 'dialogue' && typeof entry.assets.ink !== 'string') {
      printErr(`[registry] Dialogue area "${key}" missing required "assets.ink" property`);
      errors++;
    }
    if (
      entry.kind === 'exploration_map'
      && typeof entry.assets.tmj !== 'string'
      && typeof entry.assets.map !== 'string'
      && typeof entry.assets.image !== 'string'
    ) {
      printErr(`[registry] Exploration area "${key}" missing required map asset property`);
      errors++;
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

  const spellErrors = await validateSpells();
  if (spellErrors.length) {
    jsonErrors += spellErrors.length;
    printErr(`[spells] Validation failed with ${spellErrors.length} error(s):`);
    for (const err of spellErrors) console.error('  -', err);
  } else {
    printOk('[spells] Validation OK');
  }

  const consumableErrors = await validateConsumables();
  if (consumableErrors.length) {
    jsonErrors += consumableErrors.length;
    printErr(`[consumables] Validation failed with ${consumableErrors.length} error(s):`);
    for (const err of consumableErrors) console.error('  -', err);
  } else {
    printOk('[consumables] Validation OK');
  }

  const weaponErrors = await validateWeapons();
  if (weaponErrors.length) {
    jsonErrors += weaponErrors.length;
    printErr(`[weapons] Validation failed with ${weaponErrors.length} error(s):`);
    for (const err of weaponErrors) console.error('  -', err);
  } else {
    printOk('[weapons] Validation OK');
  }

  const armorErrors = await validateArmor();
  if (armorErrors.length) {
    jsonErrors += armorErrors.length;
    printErr(`[armor] Validation failed with ${armorErrors.length} error(s):`);
    for (const err of armorErrors) console.error('  -', err);
  } else {
    printOk('[armor] Validation OK');
  }

  const backgroundErrors = await validateBackgrounds();
  if (backgroundErrors.length) {
    jsonErrors += backgroundErrors.length;
    printErr(`[backgrounds] Validation failed with ${backgroundErrors.length} error(s):`);
    for (const err of backgroundErrors) console.error('  -', err);
  } else {
    printOk('[backgrounds] Validation OK');
  }

  const classErrors = await validateClasses();
  if (classErrors.length) {
    jsonErrors += classErrors.length;
    printErr(`[classes] Validation failed with ${classErrors.length} error(s):`);
    for (const err of classErrors) console.error('  -', err);
  } else {
    printOk('[classes] Validation OK');
  }

  const toolErrors = await validateTools();
  if (toolErrors.length) {
    jsonErrors += toolErrors.length;
    printErr(`[tools] Validation failed with ${toolErrors.length} error(s):`);
    for (const err of toolErrors) console.error('  -', err);
  } else {
    printOk('[tools] Validation OK');
  }

  const speciesErrors = await validateSpecies();
  if (speciesErrors.length) {
    jsonErrors += speciesErrors.length;
    printErr(`[species] Validation failed with ${speciesErrors.length} error(s):`);
    for (const err of speciesErrors) console.error('  -', err);
  } else {
    printOk('[species] Validation OK');
  }

  const pcMiniErrors = await validatePcMiniRules();
  if (pcMiniErrors.length) {
    jsonErrors += pcMiniErrors.length;
    printErr(`[pc-mini-selection] Validation failed with ${pcMiniErrors.length} error(s):`);
    for (const err of pcMiniErrors) console.error('  -', err);
  } else {
    printOk('[pc-mini-selection] Validation OK');
  }

  const pcMiniAssetErrors = await validatePcMiniAssets();
  if (pcMiniAssetErrors.length) {
    jsonErrors += pcMiniAssetErrors.length;
    printErr(`[pc-mini-assets] Validation failed with ${pcMiniAssetErrors.length} error(s):`);
    for (const err of pcMiniAssetErrors) console.error('  -', err);
  } else {
    printOk('[pc-mini-assets] Validation OK');
  }

  const featErrors = await validateFeats();
  if (featErrors.length) {
    jsonErrors += featErrors.length;
    printErr(`[feats] Validation failed with ${featErrors.length} error(s):`);
    for (const err of featErrors) console.error('  -', err);
  } else {
    printOk('[feats] Validation OK');
  }

  const uniqueErrors = await validateUniques();
  if (uniqueErrors.length) {
    jsonErrors += uniqueErrors.length;
    printErr(`[uniques] Validation failed with ${uniqueErrors.length} error(s):`);
    for (const err of uniqueErrors) console.error('  -', err);
  } else {
    printOk('[uniques] Validation OK');
  }

  const enemyErrors = await validateEnemies();
  if (enemyErrors.length) {
    jsonErrors += enemyErrors.length;
    printErr(`[enemies] Validation failed with ${enemyErrors.length} error(s):`);
    for (const err of enemyErrors) console.error('  -', err);
  } else {
    printOk('[enemies] Validation OK');
  }

  const encounterErrors = await validateEncounters();
  if (encounterErrors.length) {
    jsonErrors += encounterErrors.length;
    printErr(`[encounters] Validation failed with ${encounterErrors.length} error(s):`);
    for (const err of encounterErrors) console.error('  -', err);
  } else {
    printOk('[encounters] Validation OK');
  }

  const combatLegacyErrors = validateCombatLegacy();
  if (combatLegacyErrors.length) {
    jsonErrors += combatLegacyErrors.length;
    printErr(`[combat-legacy] Validation failed with ${combatLegacyErrors.length} error(s):`);
    for (const err of combatLegacyErrors) console.error('  -', err);
  } else {
    printOk('[combat-legacy] Validation OK');
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
        for (const r of refs) {
          const enemyId = typeof r === 'string' ? r : r?.enemyId;
          if (enemyId && !ids.has(enemyId)) miss.add(enemyId);
        }
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
