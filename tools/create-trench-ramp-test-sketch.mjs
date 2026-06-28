import fs from "node:fs";
import path from "node:path";

const outputPath = process.argv[2];
if (!outputPath) {
  console.error("Usage: node tools/create-trench-ramp-test-sketch.mjs <output-grid-sketch.json>");
  process.exit(1);
}

const width = 16;
const height = 11;
const playable = new Map();

function setCell(x, y, terrain = ".", altitude = 0, markers = []) {
  playable.set(`${x},${y}`, {
    x,
    y,
    display: markers[0] || terrain,
    terrain: terrainObject(terrain),
    altitude,
    markers: markers.map((symbol) => ({ symbol })),
  });
}

function terrainObject(symbol) {
  const definitions = {
    " ": ["blocked", "blocked / void / trench wall"],
    ".": ["walkable", "walkable floor"],
    R: ["slope", "wide ramp / slope"],
    h: ["half_cover", "low half-cover terrain"],
    C: ["three_quarter_cover", "blocking three-quarter cover"],
  };
  const [state, label] = definitions[symbol] || definitions["."];
  return { symbol, state, label };
}

for (let y = 0; y <= 6; y += 1) {
  const start = [5, 4, 3, 3, 4, 5, 8][y];
  for (let x = start; x < width; x += 1) setCell(x, y, ".", 0);
}

for (let y = 7; y <= 10; y += 1) {
  for (let x = 9; x < width; x += 1) setCell(x, y, ".", 0);
}

for (let x = 0; x <= 6; x += 1) {
  setCell(x, 8, ".", -2);
  setCell(x, 9, ".", -2);
}
for (let x = 0; x <= 5; x += 1) setCell(x, 10, ".", -2);

for (const [x, y, altitude] of [
  [6, 8, -1], [6, 9, -1],
  [7, 7, -1], [7, 8, -1],
  [8, 6, 0], [8, 7, 0],
  [9, 6, 0], [9, 7, 0],
]) {
  setCell(x, y, "R", altitude);
}

for (const [x, y] of [[1, 8], [1, 9], [2, 8]]) playable.get(`${x},${y}`).markers.push({ symbol: "P" });
for (const [x, y] of [[13, 2], [14, 2], [12, 5], [14, 7], [10, 9]]) playable.get(`${x},${y}`).markers.push({ symbol: "M" });

for (const [x, y] of [[3, 8], [4, 9], [10, 4], [12, 6], [14, 8]]) {
  const cell = playable.get(`${x},${y}`);
  cell.terrain = terrainObject("h");
  cell.display = "h";
}

for (const [x, y] of [[11, 2], [13, 4], [15, 6]]) {
  const cell = playable.get(`${x},${y}`);
  cell.terrain = terrainObject("C");
  cell.display = "C";
}

const cells = [];
for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    cells.push(playable.get(`${x},${y}`) || {
      x,
      y,
      display: " ",
      terrain: terrainObject(" "),
      altitude: 0,
      markers: [],
    });
  }
}

const sketch = {
  schemaVersion: 2,
  id: "trench_ramp_test_01",
  name: "Trench Ramp Test 01",
  mode: "combat",
  size: "large_16x11",
  grid: {
    projection: "isometric_square",
    tileWidth: 128,
    tileHeight: 64,
    origin: { x: 960, y: 260 },
    width,
    height,
    coordinateRule: "x increases down-right; y increases down-left",
  },
  cells,
  featureDefinitions: {},
  lighting: [],
  altitude: {
    layer: 3,
    unitFeet: 5,
    connectorRule: "Only R terrain cells connect the -2 trench floor through -1 ramp cells to altitude 0 regular ground. Other adjacent altitude changes are trench walls / ledges and not traversable unless explicitly allowed by combat rules.",
  },
  imageNote: [
    "Large Backlands-adjacent combat plate: a deep, dark trench enters from the lower-left and opens onto regular stony ground through one broad ramp.",
    "The trench floor and ramp must both support two grid-square-wide movement paths.",
    "The upper/right regular ground should be broad and readable enough for a fight with sparse cover.",
    "No visible grid, no actors, no labels, no UI, and no decorative objects that imply unmarked cover or blocked cells.",
  ].join(" "),
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(sketch, null, 2)}\n`);
