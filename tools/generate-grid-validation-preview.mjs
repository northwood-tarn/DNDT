import fs from "node:fs";
import path from "node:path";

const [inputPath, outputDirArg] = process.argv.slice(2);
if (!inputPath || !outputDirArg) {
  console.error("Usage: node tools/generate-grid-validation-preview.mjs <grid-sketch.json> <output-dir>");
  process.exit(1);
}

const sketch = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const outputDir = path.resolve(outputDirArg);
fs.mkdirSync(outputDir, { recursive: true });

const stageId = sketch.id || "untitled_stage";
const width = sketch.grid?.width || 16;
const height = sketch.grid?.height || 11;
const tileWidth = sketch.grid?.tileWidth || 128;
const tileHeight = sketch.grid?.tileHeight || 64;
const origin = normalizeOrigin(sketch.grid?.origin) || { x: 760, y: 170 };
const cells = sketch.cells || [];
const cellByKey = new Map(cells.map((cell) => [`${cell.x},${cell.y}`, cell]));

const featureDefinitions = sketch.featureDefinitions || {};
const notes = String(sketch.imageNote || "").trim();

const walkable = [];
const blocked = [];
const cover = [];
const slopes = [];
const stairs = [];
const hazards = [];
const interactables = [];
const transitions = [];
const heroSpawns = [];
const enemySpawns = [];

for (const cell of cells) {
  const markerSymbols = (cell.markers || []).map((marker) => marker.symbol || marker);
  const terrainSymbol = cell.terrain?.symbol || cell.terrain || " ";
  const featureMarker = markerSymbols.find((symbol) => /^[1-9]$/.test(symbol));
  const isBlank = terrainSymbol === " ";

  if (featureMarker) {
    blocked.push({ x: cell.x, y: cell.y, kind: "feature", feature: featureMarker });
    interactables.push({
      id: `feature_${featureMarker}_${cell.x}_${cell.y}`,
      cell: { x: cell.x, y: cell.y },
      feature: featureMarker,
      label: featureDefinitions[featureMarker] || `custom feature ${featureMarker}`,
      blocksMovement: true,
    });
  } else if (terrainSymbol === "C") {
    blocked.push({ x: cell.x, y: cell.y, kind: "three_quarter_cover" });
    cover.push({ x: cell.x, y: cell.y, kind: "three_quarter", blocksMovement: true, source: "3/4 cover terrain" });
  } else if (isBlank) {
    blocked.push({ x: cell.x, y: cell.y, kind: "blocked_or_void" });
  } else {
    walkable.push({ x: cell.x, y: cell.y, altitude: cell.altitude || 0 });
  }

  if (terrainSymbol === "h") {
    cover.push({ x: cell.x, y: cell.y, kind: "half", blocksMovement: false, source: "half cover terrain" });
  }
  if (terrainSymbol === "R") {
    slopes.push({ x: cell.x, y: cell.y, altitude: cell.altitude || 0 });
  }
  if (terrainSymbol === "S") {
    stairs.push({ x: cell.x, y: cell.y, altitude: cell.altitude || 0 });
  }
  if (terrainSymbol === "H") {
    hazards.push({ x: cell.x, y: cell.y, altitude: cell.altitude || 0 });
  }

  if (markerSymbols.includes("P")) heroSpawns.push({ x: cell.x, y: cell.y, altitude: cell.altitude || 0 });
  if (markerSymbols.includes("M")) enemySpawns.push({ x: cell.x, y: cell.y, altitude: cell.altitude || 0 });
  if (markerSymbols.includes("T")) transitions.push({ x: cell.x, y: cell.y, altitude: cell.altitude || 0 });
}

const stageGrid = {
  stageId,
  name: sketch.name || stageId,
  status: "draft_grid_validation",
  image: {
    runtimePlate: `${stageId}.grid_preview.svg`,
    collisionPreview: `${stageId}.collision_preview.svg`,
    sourcePlate: null,
    width: 1920,
    height: 1080,
  },
  grid: {
    projection: "isometric_square",
    tileWidth,
    tileHeight,
    origin,
    width,
    height,
    coordinateRule: sketch.grid?.coordinateRule || "x increases down-right; y increases down-left",
  },
  walkable: {
    cells: walkable,
    notes: "Draft converted from map sketcher export. Cover/hazard cells may still need runtime movement confirmation.",
  },
  blocked,
  cover,
  slopes,
  stairs,
  hazards,
  interactables,
  transitions,
  spawns: {
    defaultHeroSpawns: heroSpawns.map((cell, index) => ({
      ...cell,
      order: index + 1,
      role: ["player_character", "chosen_npc_1", "chosen_npc_2"][index] || "extra_hero_spawn",
    })),
    defaultEnemySpawns: enemySpawns,
    namedZones: {
      low_ground: walkable.filter((cell) => cell.altitude === 0),
      upper_plateau: walkable.filter((cell) => cell.altitude >= 4),
      slope_routes: slopes,
    },
  },
  altitude: {
    unitFeet: 5,
    connectorRule: sketch.altitude?.connectorRule || "Adjacent height changes are treated as slope/ramp unless layout terrain marks S stairs or a blocking/non-walkable cell.",
    cells: cells.map((cell) => ({ x: cell.x, y: cell.y, height: cell.altitude || 0 })),
  },
  lighting: sketch.lighting || [],
  artDirection: {
    imageNote: notes,
    prompt: [
      "Combat plate for a dark fantasy underground battlefield.",
      "Left side is lower ground with broken-column cover.",
      "Right side is a high rocky plateau reached by thin uneven side paths.",
      "Central blank cells are the sheer front face of the rocky outcrop, not empty traversable space.",
      "A large dry burning tree on the plateau is a blocking light feature.",
      "Do not bake grid labels, tokens, or UI into final art.",
    ],
  },
  validation: {
    gridPreview: `${stageId}.grid_preview.svg`,
    collisionPreview: `${stageId}.collision_preview.svg`,
    artValidationOverlay: `${stageId}.art_validation_overlay.png`,
  },
  validationNotes: [
    "Generated from 0_plateau_assault.grid-sketch.json.",
    "This is a grid-validation pass before art generation.",
    "Review whether the two slope routes read as traversable without altitude labels.",
    "Review whether the central cliff face is unambiguously blocked.",
    "Review whether ranged enemy positions on the plateau have enough approach counterplay.",
  ],
};

fs.writeFileSync(path.join(outputDir, `${stageId}.grid.json`), `${JSON.stringify(stageGrid, null, 2)}\n`);
fs.writeFileSync(path.join(outputDir, `${stageId}.grid_preview.svg`), renderSvg("grid", stageGrid));
fs.writeFileSync(path.join(outputDir, `${stageId}.collision_preview.svg`), renderSvg("collision", stageGrid));
fs.writeFileSync(path.join(outputDir, `${stageId}.next_step_notes.md`), renderNotes(stageGrid));
fs.writeFileSync(path.join(outputDir, `${stageId}.art_prompt.txt`), renderArtPrompt(stageGrid));

function renderSvg(kind, gridData) {
  const title = kind === "grid" ? "Grid Preview" : "Collision Preview";
  const defs = `
    <style>
      text { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
      .label { fill: #dfe8df; font-size: 18px; font-weight: 700; }
      .small { fill: #dfe8df; font-size: 14px; font-weight: 700; }
      .coord { fill: #0b0d0e; font-size: 14px; font-weight: 900; text-anchor: middle; dominant-baseline: middle; }
      .height { fill: #f8f2df; font-size: 16px; font-weight: 900; text-anchor: middle; dominant-baseline: middle; paint-order: stroke; stroke: #111; stroke-width: 3px; }
    </style>`;
  const body = cells.map((cell) => renderCell(cell, kind)).join("\n");
  const legend = kind === "grid" ? gridLegend() : collisionLegend();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  ${defs}
  <rect width="1920" height="1080" fill="#090c0d"/>
  <rect x="70" y="50" width="1780" height="980" fill="#101517" stroke="#41505a" stroke-width="2"/>
  <text x="96" y="92" class="label">${escapeXml(sketch.name || stageId)} - ${title}</text>
  <text x="96" y="120" class="small">128x64 isometric grid, ${width}x${height}. Generated from grid-sketch export.</text>
  ${body}
  ${legend}
</svg>
`;
}

function normalizeOrigin(value) {
  const x = Number(value?.x);
  const y = Number(value?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function renderCell(cell, kind) {
  const points = diamondPoints(cell.x, cell.y);
  const center = cellCenter(cell.x, cell.y);
  const markerSymbols = (cell.markers || []).map((marker) => marker.symbol || marker);
  const terrainSymbol = cell.terrain?.symbol || cell.terrain || " ";
  const featureMarker = markerSymbols.find((symbol) => /^[1-9]$/.test(symbol));
  const fill = kind === "grid" ? gridFill(cell, terrainSymbol, featureMarker) : collisionFill(cell, terrainSymbol, featureMarker);
  const stroke = terrainSymbol === "R" ? "#d7d084" : "#38464f";
  const label = markerSymbols.includes("P") ? "P"
    : markerSymbols.includes("M") ? "M"
      : featureMarker || (terrainSymbol === " " ? "" : terrainSymbol === "." ? "" : terrainSymbol);
  const height = cell.altitude ? `${cell.altitude > 0 ? "+" : ""}${cell.altitude}` : "";
  return `
    <polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${terrainSymbol === "R" ? 3 : 1.5}" opacity="0.92"/>
    ${height && kind === "grid" ? `<text x="${center.x}" y="${center.y - 10}" class="height">${height}</text>` : ""}
    ${label ? `<circle cx="${center.x}" cy="${center.y + 10}" r="17" fill="${markerColor(label)}" stroke="#101517" stroke-width="3"/><text x="${center.x}" y="${center.y + 11}" class="coord">${escapeXml(label)}</text>` : ""}
  `;
}

function gridFill(cell, terrainSymbol, featureMarker) {
  if (featureMarker) return "#c06d37";
  if (terrainSymbol === " ") return "#1a1d20";
  if (terrainSymbol === "C") return "#b4984d";
  if (terrainSymbol === "h") return "#c6b371";
  if (terrainSymbol === "R") return "#6c8e66";
  if (terrainSymbol === "H") return "#9a4a3d";
  if ((cell.altitude || 0) >= 4) return "#9f8650";
  if ((cell.altitude || 0) > 0) return "#7d7954";
  return "#b8c7b2";
}

function collisionFill(cell, terrainSymbol, featureMarker) {
  if (featureMarker || terrainSymbol === " " || terrainSymbol === "C") return "rgba(190,55,55,0.78)";
  if (terrainSymbol === "R") return "rgba(90,160,220,0.78)";
  if (terrainSymbol === "H") return "rgba(220,125,35,0.78)";
  return "rgba(80,180,95,0.72)";
}

function markerColor(label) {
  if (label === "P") return "#6da0d7";
  if (label === "M") return "#bd6b65";
  if (/^[1-9]$/.test(label)) return "#d9a84f";
  if (label === "C" || label === "h") return "#e0c56b";
  if (label === "R") return "#9bc276";
  return "#d9ded7";
}

function cellCenter(x, y) {
  return {
    x: origin.x + (x - y) * tileWidth / 2,
    y: origin.y + (x + y) * tileHeight / 2,
  };
}

function diamondPoints(x, y) {
  const center = cellCenter(x, y);
  const halfW = tileWidth / 2;
  const halfH = tileHeight / 2;
  return [
    `${center.x},${center.y - halfH}`,
    `${center.x + halfW},${center.y}`,
    `${center.x},${center.y + halfH}`,
    `${center.x - halfW},${center.y}`,
  ].join(" ");
}

function gridLegend() {
  return `
    <g transform="translate(1380 90)">
      <text class="label">Grid legend</text>
      ${legendRow(0, "#b8c7b2", "walkable low ground")}
      ${legendRow(34, "#9f8650", "upper plateau (+4)")}
      ${legendRow(68, "#6c8e66", "slope / ramp route")}
      ${legendRow(102, "#1a1d20", "blocked cliff / void")}
      ${legendRow(136, "#b4984d", "3/4 cover blocks")}
      ${legendRow(170, "#c06d37", "burning tree feature")}
    </g>`;
}

function collisionLegend() {
  return `
    <g transform="translate(1380 90)">
      <text class="label">Collision legend</text>
      ${legendRow(0, "rgba(80,180,95,0.72)", "walkable")}
      ${legendRow(34, "rgba(90,160,220,0.78)", "traversable slope")}
      ${legendRow(68, "rgba(190,55,55,0.78)", "blocked")}
      ${legendRow(102, "rgba(220,125,35,0.78)", "hazard")}
    </g>`;
}

function legendRow(y, color, label) {
  return `<rect x="0" y="${y + 24}" width="24" height="24" fill="${color}" stroke="#dfe8df"/><text x="36" y="${y + 43}" class="small">${escapeXml(label)}</text>`;
}

function renderNotes(gridData) {
  return `# ${gridData.name} Next Step Notes

## Process Reminder

1. Sketch the tactical intent in the map sketcher.
2. Convert the sketch into runtime-style grid metadata.
3. Generate grid and collision previews from that same metadata.
4. Review whether the map is readable before art exists.
5. Only then generate the clean combat art.
6. Generate an art validation overlay from the same metadata.
7. Revise art or grid until they agree.

## Generated Files

- \`${stageId}.grid.json\`
- \`${stageId}.grid_preview.svg\`
- \`${stageId}.collision_preview.svg\`

## Readability Questions

- Do the top and bottom slope routes read as the only ways onto the plateau?
- Does the central cliff face read as blocked rather than empty playable space?
- Does the burning tree feature read as a blocking light source on the upper level?
- Does the approach give the heroes enough cover against enemies on high ground?
- Can the altitude be understood when height labels are hidden?
`;
}

function renderArtPrompt(gridData) {
  return `Generate a 1920 x 1080 combat map image for "${gridData.name}".

This image must be based on the grid metadata below. Treat the grid as the source of truth. Do not invent new playable areas, extra platforms, extra ramps, extra stairs, extra cover, extra light sources, or extra paths. Do not include text, coordinate labels, numbers, UI, tokens, actors, miniatures, bases, icons, permanent grid lines, or baked player-centered visibility circles in the final art.

STYLE

Dark fantasy underground setting. The world is underground but this battlefield is an open-air cavern field, not a tunnel. Use the established DNDT map style: dark negative space, painterly-but-readable surfaces, restrained detail, clear walkable shapes, and no pointless grit. Combat maps may be globally readable because the Lanterna flares under danger, but keep the mood dark and serious.

SCENE INTENT

The heroes begin on low ground at the left edge. They approach a large rocky outcrop/plateau on the right. The plateau top is high ground at altitude +4. The central dark band is the sheer front face of the rocky outcrop and is not traversable. The only playable routes up are the thin, uneven stony slope paths along the top and bottom edges. The high plateau contains enemy positions and a large dry burning tree that functions as a blocking light source. Broken columns on the lower left provide cover for the approach.

LIGHTING

The burning tree on the upper plateau is the major environmental light source. It casts yellow-orange firelight across the plateau and a little down the rocky face. Keep the firelight local and directional; do not flood the whole battlefield with ambient light. The final art should still read as an underground dark fantasy combat area.

GRID CONTRACT

Grid projection: ${gridData.grid.projection}
Grid size: ${gridData.grid.width} x ${gridData.grid.height}
Tile size: ${gridData.grid.tileWidth} x ${gridData.grid.tileHeight}
Coordinate rule: ${gridData.grid.coordinateRule}

Terrain symbols:
blank = blocked / non-walkable / cliff face / void / dense feature
. = walkable
h = half cover, walkable
C = three-quarter cover, blocking
R = traversable slope / ramp
S = stairs
H = hazard
P = hero spawn marker, still walkable
M = enemy spawn marker, still walkable
1 = custom blocking feature: ${featureDefinitions["1"] || "custom feature 1"}

LAYOUT GRID

${renderPromptLayoutRows()}

ALTITUDE GRID

Altitude values are 5 ft bands. +4 is the upper plateau. Height changes on R cells are sloped approaches unless a cell is blocked.

${renderPromptAltitudeRows()}

REQUIRED SPATIAL READING

- Low ground occupies the left side and stays visually lower.
- The high plateau occupies the right side and must look like a broad upper fighting surface.
- The central blank gap must look like a steep rocky cliff/front face, not playable empty floor.
- Top and bottom R bands must look like narrow uneven stony slope paths that can be walked.
- C cells at x02 y01-y03 are broken column 3/4 cover on the lower approach.
- h cells are smaller half-cover broken stones/column fragments on the lower ground.
- The four "1" cells at x07-y02, x08-y02, x07-y03, x08-y03 are one large burning dry tree feature. It blocks movement and lights the upper plateau.
- P cells on the left edge are default hero start cells and must be open, flat, and readable as low ground.
- M cells on the plateau are enemy starting positions and must be open enough for medium enemies.

IMAGE NOTE FROM SKETCH

${notes || "No extra image note supplied."}

NEGATIVE CONSTRAINTS

- Do not make the central cliff face walkable.
- Do not add a front stairway or direct central route onto the plateau.
- Do not add extra bridges, ladders, ramps, stairs, or scenic paths.
- Do not make lit unreachable areas look like tactical destinations.
- Do not clutter the ground with small growths, cracks, pebbles, or meaningless marks.
- Do not let props occupy normal walkable cells unless they are cover or the burning tree feature.
- Do not hide the slope routes in darkness or decorative texture.
- Do not make the altitude depend on labels; the art itself must show height through shape, edges, slope, and shadow.
`;
}

function renderPromptLayoutRows() {
  const rows = [];
  rows.push(`y\\x  ${Array.from({ length: width }, (_, x) => String(x).padStart(2, "0")).join(" ")}`);
  for (let y = 0; y < height; y += 1) {
    const row = [];
    for (let x = 0; x < width; x += 1) {
      const cell = cellByKey.get(`${x},${y}`);
      row.push(promptCellSymbol(cell));
    }
    rows.push(`${String(y).padStart(2, "0")}   ${row.join("  ")}`);
  }
  return rows.join("\n");
}

function renderPromptAltitudeRows() {
  const rows = [];
  rows.push(`y\\x  ${Array.from({ length: width }, (_, x) => String(x).padStart(2, "0")).join(" ")}`);
  for (let y = 0; y < height; y += 1) {
    const row = [];
    for (let x = 0; x < width; x += 1) {
      const cell = cellByKey.get(`${x},${y}`);
      row.push(formatPromptHeight(cell?.altitude || 0).padStart(2, " "));
    }
    rows.push(`${String(y).padStart(2, "0")}   ${row.join(" ")}`);
  }
  return rows.join("\n");
}

function promptCellSymbol(cell) {
  if (!cell) return " ";
  const markerSymbols = (cell.markers || []).map((marker) => marker.symbol || marker);
  if (markerSymbols.includes("P")) return "P";
  if (markerSymbols.includes("M")) return "M";
  const featureMarker = markerSymbols.find((symbol) => /^[1-9]$/.test(symbol));
  if (featureMarker) return featureMarker;
  const terrainSymbol = cell.terrain?.symbol || cell.terrain || " ";
  return terrainSymbol === " " ? " " : terrainSymbol;
}

function formatPromptHeight(height) {
  const value = Number(height) || 0;
  return value > 0 ? `+${value}` : String(value);
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
