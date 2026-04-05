#!/usr/bin/env node
// verify-events.js (ESM-native) — fixed: only strips comments, keeps string literals
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function arg(name, def=null) {
  const i = process.argv.indexOf(name);
  if (i !== -1 && process.argv[i+1] && !process.argv[i+1].startsWith('--')) return process.argv[i+1];
  return def;
}
const ROOT = path.resolve(arg('--root', 'app'));
const REG_PATH = path.resolve(arg('--registry', path.join('docs','EVENTS_REGISTRY.md')));
const exts = (arg('--ext','js,mjs,ts,tsx,jsx')).split(',').map(s=>s.trim().toLowerCase());
const NO_FAIL = process.argv.includes('--no-fail');
const OUT_JSON = process.argv.includes('--json');

function* walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules','.git','dist','build','coverage'].includes(e.name)) continue;
      yield* walk(p);
    } else {
      const ext = path.extname(e.name).slice(1).toLowerCase();
      if (exts.includes(ext)) yield p;
    }
  }
}

function readFileSafe(f) {
  try { return fs.readFileSync(f,'utf8'); } catch { return ''; }
}

function parseRegistry(file) {
  const md = readFileSafe(file);
  const events = new Set();
  const codePattern = /`([a-z][\w-]*:[\w:-]+)`/g;
  let m;
  while ((m = codePattern.exec(md)) !== null) events.add(m[1]);
  return Array.from(events).sort();
}

// Only strip comments; KEEP strings so we can read event names.
function stripComments(src) {
  let out = src;
  out = out.replace(/\/\*[\s\S]*?\*\//g, '');   // block comments
  out = out.replace(/(^|\s)\/\/.*$/gm, '$1');     // line comments
  return out;
}

function scanFile(file) {
  const src = readFileSafe(file);
  const code = stripComments(src);
  const listenRe = /\b(?:window|document|globalThis)?\.?\s*addEventListener\s*\(\s*['"]([^'"]+)['"]/g;
  const customEventRe = /\bnew\s+CustomEvent\s*\(\s*['"]([^'"]+)['"]/g;
  const dispatchRe = /\bdispatchEvent\s*\(\s*['"]([^'"]+)['"]/g;

  const found = new Set();
  let m;
  for (const re of [listenRe, customEventRe, dispatchRe]) {
    while ((m = re.exec(code)) !== null) {
      const name = m[1];
      if (name && /^[a-z][\w-]*:[\w:-]+$/.test(name)) found.add(name);
    }
  }
  return Array.from(found).sort();
}

function scan(root) {
  const usage = {};
  function tryWalk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const file of walk(dir)) {
      const list = scanFile(file);
      if (list.length) usage[file] = list;
    }
  }
  // If root is ".", scan common source dirs; else scan the given root.
  if (path.basename(ROOT) === '.') {
    for (const dir of ['.', 'app', 'engine', 'systems', 'scenes', 'renderer', 'ui', 'state', 'flow']) {
      tryWalk(path.resolve(dir));
    }
  } else {
    tryWalk(ROOT);
  }
  return usage;
}

function invertUsage(usage) {
  const byEvent = {};
  for (const [file, events] of Object.entries(usage)) {
    for (const ev of events) {
      (byEvent[ev] ||= []).push(file);
    }
  }
  return byEvent;
}

function main() {
  if (!fs.existsSync(REG_PATH)) {
    console.error(`[verify-events] Registry not found: ${REG_PATH}`);
    process.exit(2);
  }
  const registry = new Set(parseRegistry(REG_PATH));
  const usage = scan(ROOT);
  const byEvent = invertUsage(usage);

  const usedEvents = Object.keys(byEvent).sort();
  const unknown = usedEvents.filter(e => !registry.has(e));
  const unused = Array.from(registry).filter(e => !byEvent[e]);

  const report = {
    root: ROOT,
    registry: REG_PATH,
    totals: {
      filesWithEvents: Object.keys(usage).length,
      eventsInRegistry: registry.size,
      eventsUsed: usedEvents.length,
      unknownCount: unknown.length,
      unusedCount: unused.length
    },
    unknownEvents: unknown.map(e => ({ event: e, files: byEvent[e] || [] })),
    unusedRegistryEvents: unused,
    usageByEvent: Object.fromEntries(Object.entries(byEvent).map(([k,v]) => [k, v.sort()]))
  };

  if (OUT_JSON) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`\n== Verify Events Report ==`);
    console.log(`root: ${report.root}`);
    console.log(`registry: ${report.registry}`);
    console.log(`files with events: ${report.totals.filesWithEvents}`);
    console.log(`events in registry: ${report.totals.eventsInRegistry}`);
    console.log(`events used: ${report.totals.eventsUsed}`);
    console.log(`unknown events: ${report.totals.unknownCount}`);
    console.log(`unused registry events: ${report.totals.unusedCount}\n`);

    if (unknown.length) {
      console.log(`-- Unknown (not in registry) --`);
      for (const row of report.unknownEvents) {
        console.log(`  ${row.event}`);
        for (const f of row.files) console.log(`    ↳ ${path.relative(process.cwd(), f)}`);
      }
      console.log();
    }
    if (unused.length) {
      console.log(`-- Unused (in registry but not found in code) --`);
      for (const e of report.unusedRegistryEvents) console.log(`  ${e}`);
      console.log();
    }
    console.log(`-- Usage by Event --`);
    for (const ev of Object.keys(report.usageByEvent).sort()) {
      console.log(`  ${ev}`);
      for (const f of report.usageByEvent[ev]) console.log(`    ↳ ${path.relative(process.cwd(), f)}`);
    }
    console.log();
  }

  if (unknown.length && !NO_FAIL) process.exit(1);
}

if (import.meta.url === `file://${__filename}`) {
  main();
}
