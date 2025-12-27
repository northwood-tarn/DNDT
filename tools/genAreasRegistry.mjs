#!/usr/bin/env node
/**
 * tools/genAreasRegistry.mjs
 *
 * Generates:
 *  - app/areas/registry.generated.js     (loadable area registry from compiled Ink JSON)
 *  - app/areas/areas.generated.js        (OPTIONAL: gameplay/profile stubs for new areas)
 *
 * Registry goals:
 *  - Canonical identity is AREA_ID (registry key = id)
 *  - Folder prefixes like `00_` are ordering/chapter metadata only (ignored here)
 *  - Pull minimal metadata from Ink global tags:
 *      AREA_ID <id>
 *      AREA_NAME <title>
 *      DEFAULT_ENTRY <knot>
 *      NEXT_AREAS <id0> <id1> ...
 *
 * Usage:
 *    node tools/genAreasRegistry.mjs
 *    node tools/genAreasRegistry.mjs --strict
 *    node tools/genAreasRegistry.mjs --areasDir ./app/areas --out ./app/areas/registry.generated.js
 *    node tools/genAreasRegistry.mjs --profilesOut ./app/areas/areas.generated.js
 *    node tools/genAreasRegistry.mjs --noPrompt   (never ask; just warn / emit empty profiles file)
 */

import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_AREAS_DIR = "./areas";
const DEFAULT_OUT_FILE = "./app/areas/registry.generated.js";
const DEFAULT_PROFILES_OUT_FILE = "./app/areas/areas.generated.js";
const DEFAULT_MINIMAP_OUT_FILE = "./app/ui/MiniMapLayouts.js";

function parseArgs(argv) {
  const args = {
    areasDir: DEFAULT_AREAS_DIR,
    out: DEFAULT_OUT_FILE,
    strict: false,
    verbose: false,

    // Path 2: generated gameplay/profile stubs
    profilesOut: DEFAULT_PROFILES_OUT_FILE,
    noPrompt: false,

    // Path 3: minimap layout registry (from MAP_EXITS global tag)
    minimapOut: DEFAULT_MINIMAP_OUT_FILE,
    noMinimap: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--strict") args.strict = true;
    else if (a === "--verbose") args.verbose = true;
    else if (a === "--areasDir") args.areasDir = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--profilesOut") args.profilesOut = argv[++i];
    else if (a === "--noPrompt") args.noPrompt = true;
    else if (a === "--noMinimap") args.noMinimap = true;
    else if (a === "--minimapOut") args.minimapOut = argv[++i];
    else if (a === "-h" || a === "--help") {
      printHelpAndExit(0);
    } else {
      console.warn(`[genAreasRegistry] Unknown arg: ${a}`);
      printHelpAndExit(1);
    }
  }

  return args;
}

function printHelpAndExit(code) {
  console.log(`
genAreasRegistry.mjs

Options:
  --areasDir <dir>        Directory containing compiled Ink JSON (default: ${DEFAULT_AREAS_DIR})
  --out <file>            Registry output path (default: ${DEFAULT_OUT_FILE})
  --strict                Treat warnings as errors (exit 1)
  --verbose               Extra logging

  --profilesOut <file>    Generated gameplay/profile stubs output path (default: ${DEFAULT_PROFILES_OUT_FILE})
  --noPrompt              Never prompt for profiles data (just emit)

  --minimapOut <file>     Minimap layouts output path (default: ${DEFAULT_MINIMAP_OUT_FILE})
  --noMinimap             Disable minimap layouts generation
`);
  process.exit(code);
}

async function fileExists(abs) {
  try {
    await fs.access(abs);
    return true;
  } catch {
    return false;
  }
}

async function collectFilesRecursive(rootAbs) {
  const out = [];
  const stack = [rootAbs];

  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try {
      entries = await fs.readdir(cur, { withFileTypes: true });
    } catch (e) {
      console.warn(`[genAreasRegistry] Failed to read directory: ${cur}`, e);
      continue;
    }

    for (const ent of entries) {
      const full = path.join(cur, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === "node_modules" || ent.name === ".git") continue;
        stack.push(full);
      } else if (ent.isFile()) {
        out.push(full);
      }
    }
  }

  return out;
}

function toPosixPath(p) {
  return p.replaceAll(path.sep, "/");
}

function relFromProjectRoot(absPath) {
  const rel = path.relative(process.cwd(), absPath);
  const relPosix = toPosixPath(rel);
  return relPosix.startsWith(".") ? relPosix : `./${relPosix}`;
}

function normalizeAreaId(raw) {
  if (!raw) return raw;
  const s = String(raw).trim();
  const m = s.match(/^\d+_(.+)$/);
  return m ? m[1] : s;
}

function findTagValue(globalTags, prefix) {
  if (!Array.isArray(globalTags)) return null;
  const t = globalTags.find((s) => typeof s === "string" && s.startsWith(prefix));
  if (!t) return null;
  return t.substring(prefix.length).trim() || null;
}

function findTagList(globalTags, prefix) {
  const v = findTagValue(globalTags, prefix);
  if (!v) return [];
  return v
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(normalizeAreaId);
}

function dirToVec(dirRaw) {
  const dir = String(dirRaw || "").trim().toUpperCase();
  switch (dir) {
    case "N": return [0, -1];
    case "E": return [1, 0];
    case "S": return [0, 1];
    case "W": return [-1, 0];
    default: return null;
  }
}

function parseMapExits(globalTags) {
  const v = findTagValue(globalTags, "MAP_EXITS ");
  if (!v) return null;

  // Format: "boathouse:N longhouse:E"
  const out = {};
  for (const tok of v.split(/\s+/).map((s) => s.trim()).filter(Boolean)) {
    const [rawId, rawDir] = tok.split(":");
    const id = normalizeAreaId(rawId);
    const vec = dirToVec(rawDir);
    if (!id || !vec) continue;
    out[id] = vec;
  }
  return Object.keys(out).length ? out : null;
}

function buildRegistryEntry({ id, title, scriptPath, defaultEntry, nextAreas }) {
  const entry = {
    id,
    title: title || id,
    kind: "dialogue",
    script: scriptPath,
  };
  if (defaultEntry) entry.defaultEntry = defaultEntry;
  if (Array.isArray(nextAreas) && nextAreas.length) entry.nextAreas = nextAreas;
  return entry;
}

function stableSortObjectKeys(obj) {
  const keys = Object.keys(obj).sort((a, b) => a.localeCompare(b));
  const out = {};
  for (const k of keys) out[k] = obj[k];
  return out;
}

function emitGeneratedRegistryFile(areasMap) {
  const banner = `// AUTO-GENERATED FILE. DO NOT EDIT BY HAND.
// Generated by: tools/genAreasRegistry.mjs
// Generated at: ${new Date().toISOString()}
//
// This file is intentionally boring: it is pure data + exports.
`;

  const stable = stableSortObjectKeys(areasMap);
  const json = JSON.stringify(stable, null, 2);

  return `${banner}

export const GENERATED_AREAS = ${json};

export function getArea(id) {
  return GENERATED_AREAS[id] || null;
}

export function listAreas() {
  return Object.keys(GENERATED_AREAS);
}

export default GENERATED_AREAS;
`;
}

function emitMiniMapLayoutsFile(layoutsMap) {
  const banner = `// AUTO-GENERATED FILE. DO NOT EDIT BY HAND.
// Generated by: tools/genAreasRegistry.mjs
// Generated at: ${new Date().toISOString()}
//
// Source of truth: Ink global tag "MAP_EXITS" (Option 1B).
//
// Coordinates are logical grid positions (not pixels). The renderer scales/centers.
// Convention:
//   [0,0] = current area
//   +x = east, -x = west
//   +y = south, -y = north
`;

  const stableTop = stableSortObjectKeys(layoutsMap || {});
  const stable = {};
  for (const areaId of Object.keys(stableTop)) {
    stable[areaId] = stableSortObjectKeys(stableTop[areaId]);
  }

  const json = JSON.stringify(stable, null, 2);
  return `${banner}

export const MINI_MAP_LAYOUTS = ${json};

export function getMiniMapLayout(areaId) {
  if (!areaId) return null;
  return MINI_MAP_LAYOUTS[areaId] || null;
}

export default MINI_MAP_LAYOUTS;
`;
}

async function loadInkjsStoryCtor() {
  // Local project convention: app/lib/inkjs.mjs exports Story
  const inkjsUrl = pathToFileURL(path.resolve(process.cwd(), "app/lib/inkjs.mjs")).href;
  return import(inkjsUrl).then((mod) => mod.Story);
}

async function tryLoadStoryGlobalTags(StoryCtor, compiledInkJson) {
  try {
    const story = new StoryCtor(compiledInkJson);
    const tags = story.globalTags;
    return Array.isArray(tags) ? tags : [];
  } catch {
    return null;
  }
}

async function loadGameplayProfilesMaybe() {
  const candidates = [
    path.resolve(process.cwd(), "app/areas/areas.js"),
    path.resolve(process.cwd(), "app/areas/areas.mjs"),
  ];

  for (const abs of candidates) {
    if (!(await fileExists(abs))) continue;

    try {
      const mod = await import(pathToFileURL(abs).href);
      // Expect either export const AREA_DATA, AREAS or default export.
      const areasObj = mod.AREA_DATA || mod.AREAS || mod.default || null;
      if (areasObj && typeof areasObj === "object") {
        return { path: abs, areas: areasObj };
      }
    } catch (e) {
      console.warn(`[genAreasRegistry] Failed to import gameplay profiles from ${abs}`, e);
      return null;
    }
  }
  return null;
}

function reportProblems({ generated, gameplayProfiles, strict }) {
  const report = {
    hasProblems: false,
  };

  // Validate NEXT_AREAS references
  const genIds = new Set(Object.keys(generated));
  for (const [id, entry] of Object.entries(generated)) {
    const next = entry.nextAreas || [];
    for (const n of next) {
      if (!genIds.has(n)) {
        const msg = `[genAreasRegistry] WARNING: AREA_ID '${id}' references unknown NEXT_AREAS id '${n}'`;
        console.warn(msg);
        if (strict) report.hasProblems = true;
      }
    }
  }

  // Drift detection: compare against gameplay profile ids if present
  if (gameplayProfiles?.areas) {
    const profileIds = new Set(Object.keys(gameplayProfiles.areas));
    for (const id of Object.keys(generated)) {
      if (!profileIds.has(id)) {
        const msg = `[genAreasRegistry] NOTE: gameplay profile missing for AREA_ID '${id}' (will be stubbed in areas.generated.js)`;
        if (strict) console.warn(msg);
      }
    }
  }

  return report;
}

function isInteractiveTTY() {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

async function promptProfilesDefaults(toPrompt) {
  const readline = await import("node:readline/promises");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const answers = {};
  for (const id of toPrompt) {
    const mode = (await rl.question(`Area '${id}' mode? (dialogue/exploration) [dialogue]: `)).trim() || "dialogue";
    const minimap = (await rl.question(`Area '${id}' show minimap? (y/n) [y]: `)).trim() || "y";
    answers[id] = {
      mode,
      minimap: minimap.toLowerCase().startsWith("y"),
    };
  }

  rl.close();
  return answers;
}

function emitGeneratedProfilesFile(mergedProfiles) {
  const banner = `// AUTO-GENERATED FILE. DO NOT EDIT BY HAND.
// Generated by: tools/genAreasRegistry.mjs
// Generated at: ${new Date().toISOString()}
//
// This file contains gameplay/profile stubs for areas not present in your hand-authored areas.js.
// It is safe to check into git.
`;

  const stable = stableSortObjectKeys(mergedProfiles || {});
  const json = JSON.stringify(stable, null, 2);

  return `${banner}

export const GENERATED_AREA_PROFILES = ${json};
export default GENERATED_AREA_PROFILES;
`;
}

async function main() {
  const args = parseArgs(process.argv);

  const areasDirAbs = path.resolve(process.cwd(), args.areasDir);
  const outAbs = path.resolve(process.cwd(), args.out);
  const profilesOutAbs = path.resolve(process.cwd(), args.profilesOut);

  if (!(await fileExists(areasDirAbs))) {
    console.error(`[genAreasRegistry] areasDir does not exist: ${areasDirAbs}`);
    process.exit(1);
  }

  const StoryCtor = await loadInkjsStoryCtor();
  const allFiles = await collectFilesRecursive(areasDirAbs);

  // Candidate compiled Ink JSON files (conservative)
  const candidateInkFiles = allFiles.filter((p) => {
    const lower = p.toLowerCase();
    return lower.endsWith(".ink.json") || lower.endsWith(".inkjson");
  });

  if (args.verbose) {
    console.info(`[genAreasRegistry] Scanning ${candidateInkFiles.length} candidate Ink file(s) under ${areasDirAbs}`);
  }

  const generated = {};
  const minimapLayouts = {};

  for (const abs of candidateInkFiles) {
    let raw;
    try {
      raw = await fs.readFile(abs, "utf8");
    } catch (e) {
      console.warn(`[genAreasRegistry] Failed to read file: ${abs}`, e);
      continue;
    }

    let compiled;
    try {
      compiled = JSON.parse(raw);
    } catch {
      console.warn(`[genAreasRegistry] Not valid JSON (skipping): ${abs}`);
      continue;
    }

    const globalTags = await tryLoadStoryGlobalTags(StoryCtor, compiled);
    if (!globalTags) continue;

    const id = findTagValue(globalTags, "AREA_ID ");
    if (!id) {
      console.warn(`[genAreasRegistry] Missing AREA_ID tag in: ${abs}`);
      continue;
    }

    const title = findTagValue(globalTags, "AREA_NAME ");
    const defaultEntry = findTagValue(globalTags, "DEFAULT_ENTRY ");
    const nextAreas = findTagList(globalTags, "NEXT_AREAS ");

    const mapExits = parseMapExits(globalTags);
    if (mapExits) {
      // Layout is expressed relative to the current area as [0,0].
      const layout = { [id]: [0, 0], ...mapExits };
      minimapLayouts[id] = layout;

      // Soft validation: warn if MAP_EXITS references an area not listed in NEXT_AREAS.
      if (Array.isArray(nextAreas) && nextAreas.length) {
        for (const targetId of Object.keys(mapExits)) {
          if (!nextAreas.includes(targetId)) {
            console.warn(
              `[genAreasRegistry] MAP_EXITS references '${targetId}' but NEXT_AREAS does not include it (AREA_ID '${id}', file: ${abs})`
            );
          }
        }
      }
    }

    const scriptPath = relFromProjectRoot(abs);

    if (generated[id]) {
      console.warn(
        `[genAreasRegistry] Duplicate AREA_ID '${id}' from: ${abs} (already defined by ${generated[id].script})`
      );
      continue;
    }

    generated[id] = buildRegistryEntry({ id, title, scriptPath, defaultEntry, nextAreas });
  }

  if (!Object.keys(generated).length) {
    console.warn(
      "[genAreasRegistry] No areas generated. Did you export your compiled Ink JSON into the areas directory and keep the .ink.json suffix?"
    );
  }

  // Drift detection + warnings
  const gameplayProfiles = await loadGameplayProfilesMaybe();
  const report = reportProblems({ generated, gameplayProfiles, strict: args.strict });

  // Write registry output
  const outDir = path.dirname(outAbs);
  await fs.mkdir(outDir, { recursive: true });
  const regText = emitGeneratedRegistryFile(generated);
  await fs.writeFile(outAbs, regText, "utf8");
  console.info(`[genAreasRegistry] Wrote: ${toPosixPath(path.relative(process.cwd(), outAbs))}`);

  // Path 3: write minimap layouts (from MAP_EXITS)
  if (!args.noMinimap) {
    const minimapOutAbs = path.resolve(process.cwd(), args.minimapOut);
    await fs.mkdir(path.dirname(minimapOutAbs), { recursive: true });
    const mmText = emitMiniMapLayoutsFile(minimapLayouts);
    await fs.writeFile(minimapOutAbs, mmText, "utf8");
    console.info(`[genAreasRegistry] Wrote: ${toPosixPath(path.relative(process.cwd(), minimapOutAbs))}`);
  }

  // Path 2: write generated profiles stubs for missing areas
  const genIds = Object.keys(generated);
  const profileIds = new Set(Object.keys(gameplayProfiles?.areas || {}));

  const toPrompt = genIds.filter((id) => !profileIds.has(id));
  let prompted = {};
  if (toPrompt.length && !args.noPrompt && isInteractiveTTY()) {
    prompted = await promptProfilesDefaults(toPrompt);
  }

  const mergedProfiles = { ...(gameplayProfiles?.areas || {}) };

  for (const id of toPrompt) {
    if (!mergedProfiles[id]) {
      mergedProfiles[id] = prompted[id] || { mode: "dialogue", minimap: true };
    }
  }

  const profilesText = emitGeneratedProfilesFile(mergedProfiles);
  await fs.writeFile(profilesOutAbs, profilesText, "utf8");
  if (toPrompt.length && !args.noPrompt && isInteractiveTTY()) {
    console.info(`[genAreasRegistry] Wrote: ${toPosixPath(path.relative(process.cwd(), profilesOutAbs))}`);
  } else if (args.verbose) {
    console.info(`[genAreasRegistry] Wrote: ${toPosixPath(path.relative(process.cwd(), profilesOutAbs))}`);
  }

  // Exit code
  if (report.hasProblems) process.exit(1);
}

main().catch((e) => {
  console.error("[genAreasRegistry] Fatal:", e);
  process.exit(1);
});