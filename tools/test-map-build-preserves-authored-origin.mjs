import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "dndt-map-origin-"));
const sketchPath = path.join(tempRoot, "authored_origin.grid-sketch.json");
const packageDir = path.join(tempRoot, "package");
const previewDir = path.join(tempRoot, "preview");

const sketch = {
  schemaVersion: 2,
  id: "authored_origin",
  name: "Authored Origin",
  mode: "combat",
  grid: {
    projection: "isometric_square",
    tileWidth: 128,
    tileHeight: 64,
    origin: { x: 321, y: 123 },
    width: 2,
    height: 2,
    coordinateRule: "x increases down-right; y increases down-left",
  },
  cells: [
    cell(0, 0, "."),
    cell(1, 0, "."),
    cell(0, 1, " "),
    cell(1, 1, "."),
  ],
  featureDefinitions: {},
  imageNote: "",
};

fs.writeFileSync(sketchPath, `${JSON.stringify(sketch, null, 2)}\n`);

execFileSync("node", ["tools/build-game-map-package.mjs", sketchPath, packageDir], {
  cwd: path.resolve("."),
  stdio: "pipe",
});
execFileSync("node", ["tools/generate-grid-validation-preview.mjs", sketchPath, previewDir], {
  cwd: path.resolve("."),
  stdio: "pipe",
});

const builtGrid = JSON.parse(fs.readFileSync(path.join(packageDir, "authored_origin.grid.json"), "utf8"));
assert.deepEqual(builtGrid.grid.origin, { x: 321, y: 123 });

const previewGrid = JSON.parse(fs.readFileSync(path.join(previewDir, "authored_origin.grid.json"), "utf8"));
assert.deepEqual(previewGrid.grid.origin, { x: 321, y: 123 });

const previewSvg = fs.readFileSync(path.join(previewDir, "authored_origin.grid_preview.svg"), "utf8");
assert.match(previewSvg, /points="321,91 385,123 321,155 257,123"/);

console.log("map build preserves authored origin: ok");

function cell(x, y, terrainSymbol) {
  return {
    x,
    y,
    display: terrainSymbol,
    terrain: {
      symbol: terrainSymbol,
      state: terrainSymbol === " " ? "blocked" : "walkable",
      label: terrainSymbol === " " ? "blocked" : "walkable",
    },
    altitude: 0,
    markers: [],
  };
}
