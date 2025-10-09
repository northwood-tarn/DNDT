#!/usr/bin/env node
// tools/audit-assets.js — scan/optionally rewrite hardcoded asset paths to Assets.path(...) calls.
//
// Usage:
//   node tools/audit-assets.js --root app [--write] [--assume-utils ../utils/Assets.js]
//
// Notes:
// - By default this is REPORT-ONLY. Use --write to perform replacements.
// - We only rewrite known files present in the Assets registry below (safe set).
// - For JS/TS files, we can inject `import { Assets } from "<path>"` if missing when --write is used.
//
// Limitations:
// - Relative import path to Assets.js can vary. Supply --assume-utils to force a specific path
//   relative to each file (e.g. "../utils/Assets.js" or "../../utils/Assets.js").
// - HTML files: we only report; we won't auto-rewrite <img src="..."> by default.
//
// Exit codes: 0 on success. Non-zero on fatal errors.

import { promises as fs } from "node:fs";
import path from "node:path";
import url from "node:url";

const argv = process.argv.slice(2);
function getFlag(name, def=false){ const i=argv.indexOf(name); return i>=0 ? true : def; }
function getOpt(name, def=null){ const i=argv.indexOf(name); return i>=0 && argv[i+1] ? argv[i+1] : def; }

const ROOT = getOpt("--root", "app");
const DO_WRITE = getFlag("--write");
const ASSUME_UTILS = getOpt("--assume-utils", null); // e.g., "../utils/Assets.js"

// Mirror the default aliases we established in app/utils/Assets.js
const REGISTRY = {
  images: {
    "ui.logo":        "assets/images/ui/dndlogo.png",
    "ui.mainscreen":  "assets/images/ui/mainscreen.png",
    "ui.murky":       "assets/images/backgrounds/murky-background.png",
    "fx.sunburst":    "assets/images/sprites/fx/sunburst.png",
    "fx.flame":       "assets/images/sprites/fx/flame.png",
    "fx.fogTexture":  "assets/images/sprites/fx/fog-texture.png",
    "pc.placeholder": "assets/images/sprites/pc/pc_nobody.png",
    "death.screen":   "assets/images/ui/death.png"
  },
  audio: {
    "music.intro":    "assets/audio/music/intro_theme.mp3"
  }
};

// Build inverse map: path -> alias
const PATH_TO_ALIAS = new Map();
for (const ns of Object.values(REGISTRY)){
  for (const [alias, p] of Object.entries(ns)){
    PATH_TO_ALIAS.set(p, alias);
  }
}

const JS_RE = /\.(?:js|mjs|cjs|jsx|ts|tsx)$/i;
const TXT_RE = /\.(?:html|css|json|md)$/i;

async function* walk(dir){
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const d of entries){
    const p = path.join(dir, d.name);
    if (d.isDirectory()) {
      // skip asset directories themselves
      if (/\bassets\b|\bnode_modules\b|\bdist\b|\blib\b/.test(p)) continue;
      yield* walk(p);
    } else {
      yield p;
    }
  }
}

function ensureImport(src, relPathToAssets){
  const importLine = `import { Assets } from "${relPathToAssets}";`;
  if (src.includes(importLine)) return src;
  if (/import\s+\{\s*Assets\s*\}\s+from\s+["'][^"']*Assets\.js["']/.test(src)) return src;
  return `${importLine}\n${src}`;
}

function relImport(fromFile){
  if (ASSUME_UTILS) return ASSUME_UTILS;
  // Guess a relative path to ../utils/Assets.js
  // e.g., app/scenes/TitleScene.js -> ../utils/Assets.js
  const depth = fromFile.split(path.sep).length - ROOT.split(path.sep).length - 1;
  const ups = Array(Math.max(1, depth)).fill("..").join("/");
  return `${ups}/utils/Assets.js`;
}

async function processFile(p, report){
  const text = await fs.readFile(p, "utf8");
  const found = [];
  for (const [filePath, alias] of PATH_TO_ALIAS.entries()){
    // Look for quoted occurrences of the path
    const re = new RegExp(String.raw`(["'\(])${filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(["'\)])`, "g");
    let m;
    while ((m = re.exec(text))){
      found.push({ index: m.index, filePath, alias });
    }
  }
  if (found.length === 0) return false;

  report.push({ file: p, matches: found.map(f => ({ path: f.filePath, alias: f.alias })) });

  if (DO_WRITE && JS_RE.test(p)){
    let out = text;
    for (const { filePath, alias } of found){
      const re2 = new RegExp(filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "g");
      out = out.replace(re2, `\${Assets.path("${alias}")}`);
    }
    // Convert plain strings to template strings if needed
    if (!out.includes("Assets.path(")){
      return false;
    }
    // Heuristic: wrap quotes around replacements that are missing back-ticks
    out = out.replace(/(["'])\$\{Assets\.path\(([^)]+)\)\}(["'])/g, "`\${Assets.path($2)}`");

    out = ensureImport(out, relImport(p));
    await fs.writeFile(p, out, "utf8");
    return true;
  }
  return false;
}

async function main(){
  const report = [];
  let changed = 0;
  for await (const p of walk(ROOT)){
    if (!(JS_RE.test(p) || TXT_RE.test(p))) continue;
    const did = await processFile(p, report);
    if (did) changed++;
  }
  // Print a human-friendly report
  console.log("\n== Asset Audit ==");
  console.log("root:", ROOT);
  console.log("write mode:", DO_WRITE);
  console.log("assume utils import:", ASSUME_UTILS || "(auto-guess)");
  console.log("files with matches:", report.length);
  for (const r of report){
    console.log("\n--", r.file);
    for (const m of r.matches){
      console.log("   ", m.path, "→", m.alias);
    }
  }
  if (DO_WRITE) console.log("\nRewritten files:", changed);
}
main().catch(e => { console.error(e); process.exit(1); });
