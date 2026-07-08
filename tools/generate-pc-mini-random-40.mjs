#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { composite, createCanvas, readPng, writePng } from "./pc-mini-png.js";
import { makeRandomSelections } from "./pc-mini-selection-fixtures.mjs";
import { renderPcMini } from "./pc-mini-renderer.mjs";

const OUT_DIR = path.resolve("app/mini_preview/assets/pc_builder/stress_40");
const PNG_DIR = path.join(OUT_DIR, "png");
const SELECTION_DIR = path.join(OUT_DIR, "selections");
const PLAN_DIR = path.join(OUT_DIR, "layer_plans");
const VALIDATION_DIR = path.join(OUT_DIR, "validation");

for (const dir of [PNG_DIR, SELECTION_DIR, PLAN_DIR, VALIDATION_DIR]) fs.mkdirSync(dir, { recursive: true });

const selections = makeRandomSelections(40);
const results = [];

for (let index = 0; index < selections.length; index += 1) {
  const n = String(index + 1).padStart(2, "0");
  const selection = selections[index];
  const outPng = path.join(PNG_DIR, `pc_mini_${n}.png`);
  const outManifest = path.join(PLAN_DIR, `pc_mini_${n}.layer_plan.json`);
  const result = renderPcMini(selection, { outPng, outManifest });
  const validation = {
    index: index + 1,
    ok: result.ok,
    errors: result.errors || [],
    png: path.relative(process.cwd(), outPng),
    selection: path.relative(process.cwd(), path.join(SELECTION_DIR, `pc_mini_${n}.selection.json`)),
    layerPlan: path.relative(process.cwd(), outManifest),
  };
  fs.writeFileSync(path.join(SELECTION_DIR, `pc_mini_${n}.selection.json`), `${JSON.stringify(selection, null, 2)}\n`);
  fs.writeFileSync(path.join(VALIDATION_DIR, `pc_mini_${n}.validation.json`), `${JSON.stringify(validation, null, 2)}\n`);
  results.push(validation);
}

const failed = results.filter((item) => !item.ok);
fs.writeFileSync(path.join(OUT_DIR, "stress_40.results.json"), `${JSON.stringify(results, null, 2)}\n`);

if (!failed.length) writeContactSheet(results.map((item) => path.resolve(item.png)), path.join(OUT_DIR, "pc_mini_stress_40_contact_sheet.png"));

if (failed.length) {
  console.error(failed.map((item) => `${item.index}: ${item.errors.join("; ")}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`[pc-mini-random-40] Rendered 40 miniatures to ${path.relative(process.cwd(), OUT_DIR)}`);
  console.log(`[pc-mini-random-40] Contact sheet: ${path.relative(process.cwd(), path.join(OUT_DIR, "pc_mini_stress_40_contact_sheet.png"))}`);
}

function writeContactSheet(files, outPath) {
  const cell = { width: 256, height: 360 };
  const cols = 8;
  const rows = Math.ceil(files.length / cols);
  const sheet = createCanvas(cols * cell.width, rows * cell.height);
  for (let i = 0; i < files.length; i += 1) {
    const png = readPng(files[i]);
    const col = i % cols;
    const row = Math.floor(i / cols);
    composite(sheet, png, col * cell.width + Math.round((cell.width - png.width) / 2), row * cell.height + Math.round((cell.height - png.height) / 2));
  }
  writePng(outPath, sheet);
}
