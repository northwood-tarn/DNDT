#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { makeMatrixSelections } from "./pc-mini-selection-fixtures.mjs";
import { renderPcMini } from "./pc-mini-renderer.mjs";

const OUT_DIR = path.resolve("app/mini_preview/assets/pc_builder/render_matrix");
fs.mkdirSync(OUT_DIR, { recursive: true });

const results = [];
for (const [name, selection] of makeMatrixSelections()) {
  const stem = safeName(name);
  const outPng = path.join(OUT_DIR, `${stem}.png`);
  const outManifest = path.join(OUT_DIR, `${stem}.layer_plan.json`);
  const result = renderPcMini(selection, { outPng, outManifest });
  const validation = {
    name,
    ok: result.ok,
    errors: result.errors || [],
    png: path.relative(process.cwd(), outPng),
    layerPlan: path.relative(process.cwd(), outManifest),
  };
  fs.writeFileSync(path.join(OUT_DIR, `${stem}.validation.json`), `${JSON.stringify(validation, null, 2)}\n`);
  results.push(validation);
}

const failed = results.filter((item) => !item.ok);
fs.writeFileSync(path.join(OUT_DIR, "render_matrix.results.json"), `${JSON.stringify(results, null, 2)}\n`);
if (failed.length) {
  console.error(failed.map((item) => `${item.name}: ${item.errors.join("; ")}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`[pc-mini-render-matrix] Rendered ${results.length} matrix miniatures to ${path.relative(process.cwd(), OUT_DIR)}`);
}

function safeName(name) {
  return name.replace(/[^a-z0-9_-]+/gi, "_").toLowerCase();
}
