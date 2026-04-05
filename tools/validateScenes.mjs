/**
 * validateScenes.mjs
 * Validates app/data/scenes.flow.json against actual modules.
 * - Verifies JSON schema (nodes/edges)
 * - Confirms file existence
 * - Dynamically imports each module
 * - Checks required API for scenes vs overlays
 * - Verifies edges reference known node ids
 * Exits nonzero on failures.
 *
 * Usage:
 *   node tools/validateScenes.mjs [path/to/scenes.flow.json]
 */

import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';

const PROJECT_ROOT = process.cwd();
const jsonRel = process.argv[2] || 'app/data/scenes.flow.json';
const jsonPath = path.resolve(PROJECT_ROOT, jsonRel);

const REQUIRED = {
  scene: ['init','enter','update','render','exit','destroy'],
  overlay: ['open','update','render','close']
};

function fail(msg) {
  console.error('\n❌', msg);
}

function ok(msg) {
  console.log('✅', msg);
}

function warn(msg) {
  console.warn('⚠️', msg);
}

async function fileExists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function main() {
  const errors = [];
  const warnings = [];
  // 1) Load JSON
  let data;
  try {
    const raw = await fs.readFile(jsonPath, 'utf8');
    data = JSON.parse(raw);
    ok(`Loaded ${jsonRel}`);
  } catch (e) {
    fail(`Cannot read or parse ${jsonRel}: ${e.message}`);
    process.exit(1);
  }

  // 2) Basic schema
  if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
    fail('JSON must contain arrays: nodes[], edges[]');
    process.exit(1);
  }

  // 3) Validate nodes
  const idSet = new Set();
  let passedModules = 0;
  let failedModules = 0;

  for (const n of data.nodes) {
    const dot = `node:${n.id}`;
    if (!n.id || !n.type || !n.filePath) {
      errors.push(`${dot} missing id/type/filePath`);
      continue;
    }
    if (idSet.has(n.id)) {
      errors.push(`${dot} duplicate id`);
      continue;
    }
    idSet.add(n.id);

    if (!['scene','overlay'].includes(n.type)) {
      errors.push(`${dot} invalid type=${n.type}`);
      continue;
    }

    const fileAbs = path.resolve(PROJECT_ROOT, n.filePath);
    const exists = await fileExists(fileAbs);
    if (!exists) {
      errors.push(`${dot} file not found: ${n.filePath}`);
      continue;
    }

    // Dynamic import
    let mod;
    try {
      const fileUrl = pathToFileURL(fileAbs).href;
      mod = await import(fileUrl);
    } catch (e) {
      errors.push(`${dot} failed to import ${n.filePath}: ${e.message}`);
      continue;
    }

    const Export = mod?.default;
    if (!Export) {
      errors.push(`${dot} default export missing in ${n.filePath}`);
      continue;
    }

    // Instantiate to check methods on instance (covers class exports)
    let instance;
    try {
      instance = typeof Export === 'function' ? new Export() : Export;
    } catch (e) {
      // fallback to plain object check
      instance = Export;
    }
    const req = REQUIRED[n.type];
    const missing = req.filter(m => typeof instance[m] !== 'function');
    if (missing.length) {
      errors.push(`${dot} missing methods [${missing.join(', ')}]`);
      failedModules++;
    } else {
      passedModules++;
    }
  }

  // 4) Validate edges
  for (const e of data.edges) {
    if (!e.from || !e.to) {
      errors.push(`edge missing from/to: ${JSON.stringify(e)}`);
      continue;
    }
    if (!idSet.has(e.from)) errors.push(`edge.from unknown id: ${e.from}`);
    if (!idSet.has(e.to)) errors.push(`edge.to unknown id: ${e.to}`);
  }

  // 5) Optional reachability (warn only)
  // Warn if nodes are unreachable from Boot (if present)
  if (idSet.has('Boot')) {
    const graph = new Map([...idSet].map(id => [id, []]));
    for (const e of data.edges) {
      const arr = graph.get(e.from);
      if (arr) arr.push(e.to);
    }
    const seen = new Set();
    const stack = ['Boot'];
    while (stack.length) {
      const v = stack.pop();
      if (seen.has(v)) continue;
      seen.add(v);
      for (const nxt of graph.get(v) || []) stack.push(nxt);
    }
    for (const id of idSet) {
      if (!seen.has(id)) warnings.push(`unreachable node from Boot: ${id}`);
    }
  }

  // 6) Report
  console.log('\n— Summary —');
  console.log(`Modules OK: ${passedModules}`);
  console.log(`Modules Failed: ${failedModules}`);
  if (warnings.length) {
    console.log('\nWarnings:');
    for (const w of warnings) warn(w);
  }
  if (errors.length) {
    console.log('\nErrors:');
    for (const m of errors) fail(m);
    process.exit(2);
  } else {
    ok('All validations passed.');
  }
}

main().catch(e => {
  fail(e.stack || e.message);
  process.exit(3);
});
