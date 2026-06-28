import fs from "node:fs";
import path from "node:path";

const packageDir = "app/visual_spike/assets/trench_ramp_test_01";
const gridPath = path.join(packageDir, "trench_ramp_test_01.grid.json");
const promptPath = path.join(packageDir, "trench_ramp_test_01.art_prompt.txt");
const basePromptPath = path.join(packageDir, "trench_ramp_test_01.base_terrain_prompt.txt");

const grid = JSON.parse(fs.readFileSync(gridPath, "utf8"));
grid.image.darkPlate = "trench_ramp_test_01.dark.png";
grid.image.dangerLitPlate = "trench_ramp_test_01.lit.png";
grid.image.litPlate = "trench_ramp_test_01.lit.png";
grid.image.runtimePlate = "trench_ramp_test_01.lit.png";
grid.image.combatRuntimePrimaryLayer = 1;
const blocked = new Set();
for (const item of grid.placedItems || []) {
  if (!item.blocksMovement) continue;
  for (const cell of item.cells || []) blocked.add(`${cell.x},${cell.y}`);
}
grid.finalPassability = {
  rule: "walkable cells minus blocking placed item footprints",
  cells: (grid.walkable?.cells || []).filter((cell) => !blocked.has(`${cell.x},${cell.y}`)),
};
grid.spawns.namedZones = {
  trench_floor: (grid.walkable?.cells || []).filter((cell) => cell.altitude === -2),
  ramp: (grid.slopes || []),
  regular_ground: (grid.walkable?.cells || []).filter((cell) => cell.altitude === 0),
};
grid.validationNotes = [
  "Trench/ramp test package. The image-first plate should show a deep two-square-wide trench opening onto regular ground through one two-square-wide ramp.",
  "Altitude contract: trench floor -2, ramp -1 to 0, regular ground 0.",
  "Only R cells are ramp connectors. Other altitude boundaries are ledges/trench walls.",
];
fs.writeFileSync(gridPath, `${JSON.stringify(grid, null, 2)}\n`);

for (const filePath of [promptPath, basePromptPath]) {
  if (!fs.existsSync(filePath)) continue;
  const text = fs.readFileSync(filePath, "utf8")
    .replaceAll("The +4 area is the high plateau. R cells are the sloped paths. Blank/blocked cells between low ground and plateau are the sheer cliff face and must not read as floor.", "The -2 area is the deep trench floor. R cells are the broad ramp out of the trench. Altitude 0 cells are regular ground. Blank/blocked cells around the trench edge are sheer trench walls or non-walkable dark mass and must not read as floor.")
    .replaceAll("Low ground occupies the left side and must read lower than the plateau.", "The trench floor occupies the lower-left and must read substantially lower than the regular ground.")
    .replaceAll("The right side is the +4 upper plateau and must read as one broad upper fighting surface.", "The upper/right side is altitude 0 regular ground and must read as one broad open fighting surface.")
    .replaceAll("The central blank band is the sheer rocky front face of the plateau, not traversable ground.", "The blank band around the trench edge is sheer rocky trench wall or dark non-walkable mass, not traversable ground.")
    .replaceAll("The top and bottom R-cell bands are the only traversable slope routes up.", "The R-cell band is the only traversable ramp route out of the trench.")
    .replaceAll("the central cliff face reads as walkable floor", "the trench wall or non-walkable dark mass reads as walkable floor")
    .replaceAll("the slopes are hidden or visually disconnected from the plateau", "the two-cell-wide ramp is hidden, too narrow, or visually disconnected from the trench floor and regular ground")
    .replaceAll("the burning tree is not contained to its marked feature footprint\n", "")
    .replaceAll("the broken-column cover is not on the marked cover cells\n", "");
  fs.writeFileSync(filePath, text);
}
