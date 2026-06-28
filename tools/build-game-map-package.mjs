import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const [inputPath, outputDirArg] = process.argv.slice(2);
if (!inputPath || !outputDirArg) {
  console.error("Usage: node tools/build-game-map-package.mjs <grid-sketch.json> <output-dir>");
  process.exit(1);
}

const sketch = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const outputDir = path.resolve(outputDirArg);
fs.mkdirSync(outputDir, { recursive: true });

const stageId = sketch.id || "untitled_stage";
const stageName = sketch.name || stageId;
const width = sketch.grid?.width || 16;
const height = sketch.grid?.height || 11;
const tileWidth = sketch.grid?.tileWidth || 128;
const tileHeight = sketch.grid?.tileHeight || 64;
const origin = normalizeOrigin(sketch.grid?.origin) || fitOrigin(width, height, tileWidth, tileHeight);
const cells = sketch.cells || [];
const cellByKey = new Map(cells.map((cell) => [`${cell.x},${cell.y}`, normalizeSketchCell(cell)]));
const featureDefinitions = sketch.featureDefinitions || {};
const imageNote = String(sketch.imageNote || "").trim();

const packagePaths = {
  grid: `${stageId}.grid.json`,
  placementControlPng: `${stageId}.placement_control.png`,
  baseTerrainControlPng: `${stageId}.base_terrain_control.png`,
  altitudeControlPng: `${stageId}.altitude_control.png`,
  combinedControlSvg: `${stageId}.combined_control.svg`,
  gridLockedArtPng: `${stageId}.art_grid_locked_v1.png`,
  artPrompt: `${stageId}.art_prompt.txt`,
  baseTerrainPrompt: `${stageId}.base_terrain_prompt.txt`,
  placedItems: `${stageId}.placed_items.json`,
  composition: `${stageId}.composition.json`,
  layeredReadme: `${stageId}.layered_pipeline.md`,
  assetPromptsDir: "placed_asset_prompts",
  placedAssetsDir: "placed_assets",
  validationChecklist: `${stageId}.validation_checklist.md`,
  manifest: `${stageId}.generation_manifest.json`,
};

let metadata;

function buildMetadata() {
  const walkable = [];
  const blocked = [];
  const cover = [];
  const slopes = [];
  const stairs = [];
  const hazards = [];
  const features = [];
  const lights = [];
  const transitions = [];
  const conversationTriggers = [];
  const npcs = [];
  const heroSpawns = [];
  const enemySpawns = [];

  for (const cell of orderedCells()) {
    const classification = classifyCell(cell);
    if (classification.walkable) walkable.push(cellRef(cell));
    if (classification.blocked) blocked.push({ ...cellRef(cell), kind: classification.blockedKind });
    if (classification.cover) cover.push({ ...cellRef(cell), ...classification.cover });
    if (cell.terrain === "R") slopes.push(cellRef(cell));
    if (cell.terrain === "S") stairs.push(cellRef(cell));
    if (cell.terrain === "H") hazards.push(cellRef(cell));

    for (const marker of cell.markers) {
      if (/^[1-9]$/.test(marker)) {
        features.push({
          ...cellRef(cell),
          feature: marker,
          label: featureDefinitions[marker] || `custom feature ${marker}`,
          blocksMovement: true,
        });
      } else if (marker === "L") {
        lights.push({ ...cellRef(cell), kind: "fixed_light" });
      } else if (marker === "T") {
        transitions.push(cellRef(cell));
      } else if (marker === "V") {
        conversationTriggers.push(cellRef(cell));
      } else if (marker === "N") {
        npcs.push(cellRef(cell));
      } else if (marker === "P") {
        heroSpawns.push(cellRef(cell));
      } else if (marker === "M") {
        enemySpawns.push(cellRef(cell));
      }
    }
  }

  const result = {
    schemaVersion: 3,
    stageId,
    name: stageName,
    status: "draft_layered_grid_validation",
    image: {
      width: 1920,
      height: 1080,
      placementControl: packagePaths.placementControlPng,
      baseTerrainControl: packagePaths.baseTerrainControlPng,
      altitudeControl: packagePaths.altitudeControlPng,
      combinedControl: packagePaths.combinedControlSvg,
      artValidationOverlay: `${stageId}.art_validation_overlay.png`,
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
    walkable: { cells: walkable },
    blocked,
    cover,
    slopes,
    stairs,
    hazards,
    features,
    lights,
    transitions,
    conversationTriggers,
    npcs,
    spawns: {
      defaultHeroSpawns: heroSpawns.map((cell, index) => ({
        ...cell,
        order: index + 1,
        role: ["player_character", "chosen_npc_1", "chosen_npc_2"][index] || "extra_hero_spawn",
      })),
      defaultEnemySpawns: enemySpawns,
    },
    altitude: {
      unitFeet: 5,
      connectorRule: sketch.altitude?.connectorRule || "Adjacent height changes are treated as slope/ramp unless layout terrain marks S stairs or a blocking/non-walkable cell.",
      cells: orderedCells().map((cell) => ({ x: cell.x, y: cell.y, height: cell.altitude })),
    },
    featureDefinitions,
    lighting: sketch.lighting || [],
    artDirection: {
      imageNote,
      styleStatus: "draft; exact grid fidelity outranks style until the visual style is separately locked.",
    },
    validationRules: [
      "Base terrain art must establish altitude, terrain masses, blocked voids, and slopes without drawing placed items.",
      "Placed items are separate assets composed from exact grid footprints.",
      "No placed item may move for composition.",
      "No unlisted cover-like, blocker-like, ramp-like, stair-like, hazard-like, light-source-like, or interactable object may be added to the base terrain.",
      "Walkable cells must look standable.",
      "Blocked cells must look non-standable.",
      "The final composite must be rejected if visual affordances disagree with metadata.",
    ],
  };
  result.placedItems = buildPlacedItems(result);
  return result;
}

function renderPlacementPng() {
  const canvas = new Raster(1920, 1080, [8, 10, 11, 255]);
  canvas.rect(0, 0, 1920, 1080, [8, 10, 11, 255]);
  drawGridCells(canvas, (cell) => placementColor(cell));
  return canvas.toPng();
}

function renderBaseTerrainControlPng() {
  const canvas = new Raster(1920, 1080, [8, 10, 11, 255]);
  canvas.rect(0, 0, 1920, 1080, [8, 10, 11, 255]);
  drawGridCells(canvas, (cell) => baseTerrainColor(cell));
  return canvas.toPng();
}

function renderAltitudePng() {
  const canvas = new Raster(1920, 1080, [8, 10, 11, 255]);
  canvas.rect(0, 0, 1920, 1080, [8, 10, 11, 255]);
  drawGridCells(canvas, (cell) => altitudeColor(cell));
  drawHeightEdges(canvas);
  return canvas.toPng();
}

function renderGridLockedArtPng() {
  const canvas = new Raster(1920, 1080, [5, 7, 8, 255]);
  canvas.rect(0, 0, 1920, 1080, [5, 7, 8, 255]);
  drawArtCells(canvas);
  drawExactCover(canvas);
  drawExactFeatures(canvas);
  return canvas.toPng();
}

function drawArtCells(canvas) {
  for (const cell of orderedCells()) {
    const points = diamondPoints(cell.x, cell.y);
    canvas.polygon(points, artSurfaceColor(cell));
    if (cell.terrain !== " ") addCellTexture(canvas, cell);
  }
}

function artSurfaceColor(cell) {
  if (cell.terrain === " ") return [7, 10, 11, 255];
  if (cell.terrain === "R") return [96, 96, 75, 255];
  if (cell.altitude >= 4) return [89, 74, 52, 255];
  if (cell.altitude > 0) return [72, 70, 54, 255];
  return [54, 64, 53, 255];
}

function addCellTexture(canvas, cell) {
  const center = cellCenter(cell.x, cell.y);
  const seed = (cell.x + 1) * 928371 + (cell.y + 1) * 11299;
  for (let i = 0; i < 7; i += 1) {
    const rx = seeded(seed + i * 17) - 0.5;
    const ry = seeded(seed + i * 37) - 0.5;
    const x = center.x + rx * tileWidth * 0.52;
    const y = center.y + ry * tileHeight * 0.42;
    const color = cell.altitude >= 4 ? [112, 95, 67, 130] : [73, 82, 66, 130];
    canvas.circle(x, y, 1 + Math.floor(seeded(seed + i * 71) * 3), color);
  }
}

function drawExactCover(canvas) {
  for (const cover of metadata.cover) {
    const center = cellCenter(cover.x, cover.y);
    const cell = cellByKey.get(`${cover.x},${cover.y}`);
    if (cover.kind === "three_quarter") {
      canvas.circle(center.x - 15, center.y - 3, 12, [126, 116, 89, 255]);
      canvas.circle(center.x + 4, center.y + 1, 15, [153, 139, 102, 255]);
      canvas.circle(center.x + 21, center.y + 6, 9, [102, 95, 77, 255]);
      canvas.line(center.x - 29, center.y - 9, center.x + 31, center.y + 11, [58, 52, 42, 255], 5);
    } else {
      canvas.circle(center.x - 6, center.y, 8, [126, 116, 89, 255]);
      canvas.circle(center.x + 8, center.y + 3, 7, [152, 139, 101, 255]);
      canvas.line(center.x - 18, center.y - 5, center.x + 18, center.y + 7, [59, 54, 45, 255], 3);
    }
  }
}

function drawExactFeatures(canvas) {
  const grouped = metadata.features.reduce((groups, cell) => {
    groups[cell.feature] ||= [];
    groups[cell.feature].push(cell);
    return groups;
  }, {});
  for (const cellsForFeature of Object.values(grouped)) {
    const centers = cellsForFeature.map((cell) => cellCenter(cell.x, cell.y));
    const cx = centers.reduce((sum, point) => sum + point.x, 0) / centers.length;
    const cy = centers.reduce((sum, point) => sum + point.y, 0) / centers.length;
    for (const cell of cellsForFeature) canvas.polygon(diamondPoints(cell.x, cell.y), [77, 49, 27, 255]);
    canvas.circle(cx, cy + 5, 38, [47, 30, 18, 255]);
    canvas.circle(cx, cy - 8, 25, [98, 54, 21, 255]);
    canvas.line(cx, cy + 18, cx, cy - 70, [45, 26, 15, 255], 12);
    canvas.line(cx, cy - 30, cx - 45, cy - 74, [42, 27, 17, 255], 5);
    canvas.line(cx, cy - 34, cx + 50, cy - 78, [42, 27, 17, 255], 5);
    canvas.line(cx, cy - 55, cx - 22, cy - 104, [42, 27, 17, 255], 4);
    canvas.line(cx, cy - 55, cx + 24, cy - 106, [42, 27, 17, 255], 4);
    canvas.circle(cx - 10, cy - 16, 23, [197, 82, 23, 220]);
    canvas.circle(cx + 12, cy - 20, 19, [244, 137, 35, 220]);
    canvas.circle(cx, cy - 32, 12, [255, 211, 76, 230]);
  }
}

function buildPlacedItems(data) {
  const items = [];
  const featureGroups = groupBy(data.features || [], (cell) => cell.feature);
  for (const [feature, featureCells] of Object.entries(featureGroups)) {
    const label = featureDefinitions[feature] || `custom feature ${feature}`;
    items.push(buildPlacedItem({
      id: `feature_${feature}`,
      kind: "custom_feature",
      assetRole: "blocking_feature",
      label,
      cells: featureCells,
      blocksMovement: true,
      emitsLight: /fire|burn|flame|lamp|lantern|light/i.test(label),
      source: `numbered feature ${feature}`,
    }));
  }

  for (const cover of data.cover || []) {
    items.push(buildPlacedItem({
      id: `cover_${cover.kind}_x${pad(cover.x)}_y${pad(cover.y)}`,
      kind: "cover",
      assetRole: cover.kind === "three_quarter" ? "three_quarter_cover" : "half_cover",
      label: cover.kind === "three_quarter" ? "three-quarter cover object" : "half-cover object",
      cells: [cover],
      blocksMovement: Boolean(cover.blocksMovement),
      emitsLight: false,
      source: `terrain ${cover.kind} cover`,
    }));
  }

  const lightGroups = groupContiguousCells(data.lights || []);
  lightGroups.forEach((cellsForLight, index) => {
    const large = cellsForLight.length >= 4;
    items.push(buildPlacedItem({
      id: `${large ? "large" : "hanging"}_fixed_light_${index + 1}`,
      kind: "fixed_light",
      assetRole: large ? "large_standing_light" : "hanging_light",
      label: large ? "large fixed light source" : "single hanging light source",
      cells: cellsForLight,
      blocksMovement: large,
      emitsLight: true,
      source: "L marker group",
    }));
  });

  for (const npc of data.npcs || []) {
    items.push(buildPlacedItem({
      id: `npc_x${pad(npc.x)}_y${pad(npc.y)}`,
      kind: "npc",
      assetRole: "neutral_actor",
      label: "NPC / neutral actor",
      cells: [npc],
      blocksMovement: true,
      emitsLight: false,
      source: "N marker",
    }));
  }

  return items.sort((a, b) => a.zIndex - b.zIndex || a.id.localeCompare(b.id));
}

function buildPlacedItem({ id, kind, assetRole, label, cells, blocksMovement, emitsLight, source }) {
  const sortedCells = [...cells].sort((a, b) => a.y - b.y || a.x - b.x);
  const bounds = cellBounds(sortedCells);
  const pixelBoundsValue = pixelBounds(sortedCells);
  const anchorPixel = {
    x: Math.round((pixelBoundsValue.minX + pixelBoundsValue.maxX) / 2),
    y: Math.round(pixelBoundsValue.maxY),
  };
  const zIndex = Math.max(...sortedCells.map((cell) => cell.x + cell.y));
  const promptPath = `${packagePaths.assetPromptsDir}/${id}.prompt.txt`;
  return {
    id,
    kind,
    assetRole,
    label,
    source,
    cells: sortedCells.map(cellRef),
    footprint: {
      minX: bounds.minX,
      minY: bounds.minY,
      maxX: bounds.maxX,
      maxY: bounds.maxY,
      widthCells: bounds.maxX - bounds.minX + 1,
      heightCells: bounds.maxY - bounds.minY + 1,
    },
    pixelBounds: pixelBoundsValue,
    anchorPixel,
    assetRegistration: {
      required: true,
      localAnchorPixel: "required in asset source coordinates; this is the asset pixel that must land on anchorPixel",
      localFootprintBounds: "required in asset source coordinates; this is the contact/base footprint to scale against pixelBounds",
      rule: "Do not infer placement from the cropped bitmap bounds. The source asset must declare its own registration.",
    },
    zIndex,
    blocksMovement,
    emitsLight,
    assetPrompt: promptPath,
    assetPath: `${packagePaths.placedAssetsDir}/${id}.png`,
    validation: [
      "Asset base must fit the listed cells exactly.",
      "Asset may visually rise upward, but its gameplay footprint may not expand.",
      "No extra props or ground affordances outside the footprint.",
    ],
  };
}

function drawGridCells(canvas, colorFn) {
  for (const cell of orderedCells()) {
    const points = diamondPoints(cell.x, cell.y);
    canvas.polygon(points, colorFn(cell));
    canvas.polyline([...points, points[0]], [19, 25, 28, 255], 2);
  }
}

function drawTacticalSymbols(canvas) {
  for (const cell of orderedCells()) {
    const center = cellCenter(cell.x, cell.y);
    const symbol = promptCellSymbol(cell);
    if (!symbol || symbol === "." || symbol === "R") continue;
    const color = symbol === "P" ? [64, 140, 230, 255]
      : symbol === "M" ? [205, 70, 70, 255]
        : /^[1-9]$/.test(symbol) ? [255, 150, 30, 255]
          : symbol === "C" || symbol === "h" ? [255, 225, 65, 255]
            : [230, 235, 220, 255];
    canvas.circle(center.x, center.y, 15, color);
    canvas.circle(center.x, center.y, 17, [8, 10, 11, 255], false, 3);
  }
}

function drawHeightEdges(canvas) {
  for (const cell of orderedCells()) {
    const current = cell.altitude;
    for (const next of rightAndDownNeighbors(cell.x, cell.y)) {
      if (next.altitude === current) continue;
      const a = cellCenter(cell.x, cell.y);
      const b = cellCenter(next.x, next.y);
      canvas.line(a.x, a.y, b.x, b.y, [245, 245, 225, 255], 4);
    }
  }
}

function renderCombinedControlSvg() {
  const placement = orderedCells().map((cell) => renderSvgCell(cell, placementHex(cell))).join("\n");
  const altitude = orderedCells().map((cell) => renderSvgCell(cell, altitudeHex(cell), true)).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <style>
    text { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .title { fill: #f0f3e8; font-size: 24px; font-weight: 900; }
    .small { fill: #d8ded1; font-size: 14px; font-weight: 800; }
    .cellText { fill: #081011; font-size: 15px; font-weight: 900; text-anchor: middle; dominant-baseline: middle; paint-order: stroke; stroke: #f1ead4; stroke-width: 2px; }
  </style>
  <rect width="1920" height="1080" fill="#080a0b"/>
  <text x="70" y="50" class="title">${escapeXml(stageName)} Combined Control Audit</text>
  <text x="70" y="76" class="small">Left: placement/collision contract. Right: altitude contract. This SVG is an audit artifact, not final art.</text>
  <g transform="translate(-170 80) scale(0.78)">
    ${placement}
  </g>
  <g transform="translate(735 80) scale(0.78)">
    ${altitude}
  </g>
  ${svgLegend()}
</svg>
`;
}

function renderSvgCell(cell, fill, labelHeight = false) {
  const points = diamondPoints(cell.x, cell.y).map((point) => `${point.x},${point.y}`).join(" ");
  const center = cellCenter(cell.x, cell.y);
  const symbol = labelHeight ? formatHeight(cell.altitude) : promptCellSymbol(cell);
  const label = symbol === "." ? "" : symbol;
  return `<polygon points="${points}" fill="${fill}" stroke="#1c2528" stroke-width="2"/><text x="${center.x}" y="${center.y}" class="cellText">${escapeXml(label)}</text>`;
}

function renderArtPrompt() {
  return `Edit the placement control plate into a 1920 x 1080 combat battlefield PNG for "${stageName}".

EDIT INPUTS

1. EDIT SOURCE IMAGE: ${packagePaths.placementControlPng}
2. SECONDARY CONSTRAINT IMAGE: ${packagePaths.altitudeControlPng}
3. SOURCE METADATA: ${packagePaths.grid}

The placement control plate is the authoritative tactical mask, not a visible-art silhouette target. Preserve every gameplay footprint in metadata and validation. The final art may soften, overpaint, texture across, or visually dress those masks when doing so does not create false affordances.

SOURCE-IMAGE TRANSFORMATION RULES

1. Keep every colored region in the placement control plate in the same tactical position.
2. Repaint the region system into a plausible place; do not expose the control image as permanent grid/tile art.
3. The black regions remain non-walkable cliff/void/blocked mass in rules and must not read as standable floor.
4. The green slope regions remain the only traversable ramp/slope regions.
5. The yellow cover regions remain the only cover footprints.
6. The orange feature region remains the only burning-tree/fire feature footprint.
7. The tan upper plateau and pale green low ground remain the only continuous walkable surface classes.
8. Use the altitude control plate only to decide height, cliff edge, and slope treatment. Do not let it change placement silhouettes.
9. Organic visual dressing may cross a mask boundary only if it reads as texture, shadow, debris, overhang, or atmosphere rather than usable floor/cover/ramp/blocker.

ABSOLUTE GRID OBEDIENCE RULES

1. Preserve every tactical footprint exactly in metadata, collision, and validation overlays.
2. Do not move objects for pictorial balance.
3. Do not resize objects into adjacent cells unless those cells are part of the listed footprint.
4. Do not add cover-like objects outside cover cells.
5. Do not add blocker-like objects outside blocked or feature cells.
6. Do not add ramp-like surfaces outside R cells.
7. Do not add stair-like surfaces unless S cells exist.
8. Do not add light sources outside light or feature-light cells.
9. Plain walkable cells must remain visually plain and standable.
10. Blank cells inside the map are collision facts, not unused art space; they may receive visual atmosphere or non-affordance dressing, but not floor.
11. If the map would look prettier by moving an object, do not move it.

STYLE

Dark fantasy underground combat plate. Open-air cavern field, not a tunnel. Painterly negative-ink direction, dark negative space, readable surfaces, restrained detail, no decorative grit. Combat is globally readable because the Lanterna flares in danger, but the mood remains dark and severe.

PLACEMENT CONTROL LEGEND

Dark/black cells: blocked cliff, void, or non-walkable mass.
Pale green cells: ordinary walkable low ground.
Muted tan cells: upper walkable plateau.
Green route cells: traversable slope/ramp.
Yellow cells: cover, exactly where marked.
Orange cells: blocking feature/light footprint, exactly where marked.
Spawn metadata is in the JSON. The placement control plate deliberately omits spawn symbols so marker shapes cannot contaminate final art.

ALTITUDE CONTROL LEGEND

Dark green/grey: low ground.
Increasing tan/orange: higher ground.
White edge strokes: height-change edges.
The +4 area is the high plateau. R cells are the sloped paths. Blank/blocked cells between low ground and plateau are the sheer cliff face and must not read as floor.

GRID-DERIVED LAYOUT

${renderPromptLayoutRows()}

ALTITUDE

${renderPromptAltitudeRows()}

SCENE-SPECIFIC REQUIREMENTS

${renderCellRequirements()}

IMAGE NOTE FROM SKETCH

${imageNote || "No extra image note supplied."}

Use this note only for terrain mood and material context in the base terrain. If the note mentions placed items such as trees, cover, columns, lamps, NPCs, or fires, do not draw those items into the base terrain. Those objects are handled by separate placed-asset prompts.

REJECTION CONDITIONS

Reject the image if any of these occur:
- any placement-control region silhouette changes
- a feature, cover object, ramp, cliff edge, or light source moves away from its control-plate cells
- the burning tree is not contained to its marked feature footprint
- the broken-column cover is not on the marked cover cells
- the central cliff face reads as walkable floor
- extra rocks, pillars, ruins, fires, ladders, stairs, bridges, rubble, or paths imply gameplay affordances not in the grid
- the slopes are hidden or visually disconnected from the plateau
- the final image contains text, numbers, grid labels, UI, tokens, character figures, bases, or permanent grid lines
`;
}

function renderBaseTerrainPrompt() {
  return `Generate the BASE TERRAIN ONLY for "${stageName}" as a 1920 x 1080 combat battlefield PNG.

INPUTS

1. BASE TERRAIN CONTROL IMAGE: ${packagePaths.baseTerrainControlPng}
2. ALTITUDE CONTROL IMAGE: ${packagePaths.altitudeControlPng}
3. SOURCE METADATA: ${packagePaths.grid}
4. PLACED ITEM CONTRACTS: ${packagePaths.placedItems}

PURPOSE

This image is only the underlying terrain plate. It must establish the battlefield form: low ground, high ground, cliffs, voids, slope routes, and broad walkable surfaces. It must not contain tactical placed items. Placed items are generated separately and composited later. The grid-derived masks are authoritative for rules; the visible terrain should read as a place, not as colored cells repainted one by one.

IMPORTANT IMAGE-GENERATION METHOD

Use the base terrain control image as the source geometry. The final terrain may be painterly, organic, and styled, but the source masks are not optional references. They are the layout contract.

The control image defines exact region ownership: walkable low ground, upper plateau, slopes, blocked void/cliff mass, and reserved placed-item footprints. Repaint these masks; do not redraw, move, widen, shrink, rotate, or reinterpret them. Organic edges, cracks, grime, lighting, and material texture must live inside the authored masks unless the grid metadata itself changes.

CONTROL LEGEND

Dark/black cells: blocked cliff, void, or non-walkable mass.
Pale green cells: ordinary walkable low ground.
Muted tan cells: upper walkable plateau.
Green route cells: traversable slope/ramp.
Purple cells: reserved footprints for later placed assets. Leave these areas visually clear and compatible with their surrounding terrain. Do not draw the asset there.

ALTITUDE RULES

Dark green/grey indicates low ground. Increasing tan/orange indicates higher ground. White strokes indicate height-change edges. The +4 area is the high plateau. R cells are the sloped paths. Blank/blocked cells between low ground and plateau are the sheer cliff face and must not read as floor.

BASE-TERRAIN RULES

1. Draw terrain, altitude, slopes, cliff faces, voids, and ambient darkness only.
2. Do not draw trees, cover columns, lamps, NPCs, doors, chests, traps, bodies, ladders, stairs, bridges, or other placed objects.
3. Reserved footprints must stay open enough for later compositing, but they must not remain visibly purple or rectangular in the final image.
4. Reserved footprints should become ordinary bare ground matching their terrain/altitude context, with no object silhouette.
5. Do not add unmarked props that could imply cover, blockers, interactables, climb routes, lights, or transitions.
6. The terrain must feel like a coherent dark fantasy battlefield rather than a visible grid, but it must still preserve the exact authored masks.
7. Preserve the exact cliff/void locations, slope routes, reserved spaces, and altitude relationships.
8. Favor the organic cliff-and-field language of a painted battlefield through texture, value, silhouette treatment inside masks, and lighting, not by changing the masks.

GRID-DERIVED TERRAIN LAYOUT

${renderBaseTerrainLayoutRows()}

ALTITUDE

${renderPromptAltitudeRows()}

RESERVED PLACED-ITEM FOOTPRINTS

${renderPlacedItemRows()}

IMAGE NOTE FROM SKETCH

${imageNote || "No extra image note supplied."}

REJECTION CONDITIONS

Reject the base terrain if any of these occur:
- a placed item is drawn into the base terrain
- a reserved footprint is filled by a tree, column, lamp, NPC, tactical rock, prop, or cover object
- reserved cells remain visibly purple, rectangular, or diagram-like
- authored masks drift, move, scale, rotate, or become only approximate
- the final image looks like the colored control image with texture added
- the central cliff face reads as walkable floor
- a slope route is added outside R cells
- extra props imply gameplay affordances not in the grid
- the map contains text, numbers, UI, tokens, character figures, bases, or permanent grid lines
`;
}

function renderBaseTerrainLayoutRows() {
  const rows = [];
  rows.push(`y\\x  ${Array.from({ length: width }, (_, x) => pad(x)).join(" ")}`);
  for (let y = 0; y < height; y += 1) {
    const row = [];
    for (let x = 0; x < width; x += 1) {
      const cell = cellByKey.get(`${x},${y}`);
      if (!cell) row.push(" ");
      else if (isReservedPlacedItemCell(cell)) row.push("*");
      else row.push(cell.terrain === " " ? " " : cell.terrain);
    }
    rows.push(`${pad(y)}   ${row.join("  ")}`);
  }
  return rows.join("\n");
}

function renderPlacedItemRows() {
  if (!metadata.placedItems.length) return "No placed-item footprints.";
  return metadata.placedItems.map((item) => {
    const coords = item.cells.map((cell) => `x${pad(cell.x)} y${pad(cell.y)}`).join(", ");
    return `- ${item.id}: ${item.label}; role ${item.assetRole}; cells ${coords}; asset prompt ${item.assetPrompt}.`;
  }).join("\n");
}

function renderAssetPrompt(item) {
  return `Generate one isolated placed asset for "${stageName}".

ASSET CONTRACT

Asset id: ${item.id}
Kind: ${item.kind}
Role: ${item.assetRole}
Label: ${item.label}
Source: ${item.source}
Footprint cells: ${item.cells.map((cell) => `x${pad(cell.x)} y${pad(cell.y)}`).join(", ")}
Footprint size: ${item.footprint.widthCells} x ${item.footprint.heightCells} isometric grid cells
Blocks movement: ${item.blocksMovement ? "yes" : "no"}
Emits light: ${item.emitsLight ? "yes" : "no"}

PRIMARY REQUEST

Create only this object as a separate compositable isometric asset. It will be placed over the base terrain by code, so do not include surrounding map terrain except a minimal contact shadow inside the footprint.

OUTPUT REQUIREMENTS

1. Transparent PNG preferred. If native transparency is unavailable, use a perfectly flat #00ff00 chroma-key background.
2. Isometric camera matching a 128 x 64 diamond grid.
3. The object's base/contact footprint must fit exactly inside the listed cells.
4. The object may visually rise upward, but its base must not expand outside its footprint.
5. No extra props, ground details, labels, UI, grid lines, characters, or duplicate objects.
6. Do not include a rectangular floor tile. The asset should be a cutout object.
7. Include a soft contact shadow only if it remains inside the footprint.
8. Provide or record an explicit localAnchorPixel in the source image: the pixel that must land on the listed final-map anchor.
9. Provide or record explicit localFootprintBounds in the source image: the pixel bounds of the object's contact/base footprint, not the full visible branches/flames/silhouette.
10. Do not rely on the generated bitmap's cropped bounding box for placement. Cropped-image bottom-center is not a valid registration method.

STYLE

DNDT dark fantasy, painterly negative-ink direction, restrained detail, clear silhouette, readable tactical object. Match the gloomy underground battlefield tone.

SKETCH NOTE CONTEXT

${imageNote || "No extra image note supplied."}

Use this note only where it describes this asset's material or identity. Do not create any other object mentioned in the note.

PLACEMENT METADATA

Anchor pixel in final 1920 x 1080 map: x${item.anchorPixel.x}, y${item.anchorPixel.y}
Pixel bounds of footprint: left ${item.pixelBounds.minX}, top ${item.pixelBounds.minY}, right ${item.pixelBounds.maxX}, bottom ${item.pixelBounds.maxY}
Required asset registration: localAnchorPixel and localFootprintBounds must be captured before compositing.
Z index: ${item.zIndex}

REJECTION CONDITIONS

Reject the asset if:
- the base footprint is too wide or shifted for the listed cells
- it includes additional tactical objects
- it contains visible grid, text, UI, or labels
- it includes surrounding terrain that would fight the base terrain image
- it lacks explicit localAnchorPixel or localFootprintBounds registration
- it cannot be cleanly composited over the reserved footprint
`;
}

function buildComposition() {
  return {
    schemaVersion: 1,
    stageId,
    name: stageName,
    image: {
      width: 1920,
      height: 1080,
      baseTerrain: `${stageId}.base_terrain.png`,
      baseTerrainControl: packagePaths.baseTerrainControlPng,
      altitudeControl: packagePaths.altitudeControlPng,
      compositeTarget: `${stageId}.composite.png`,
      debugCompositeTarget: `${stageId}.composite_debug.png`,
    },
    projection: metadata.grid,
    layers: [
      {
        id: "base_terrain",
        kind: "raster",
        path: `${stageId}.base_terrain.png`,
        zIndex: 0,
      },
      ...metadata.placedItems.map((item) => ({
        id: item.id,
        kind: "placed_asset",
        assetRole: item.assetRole,
        path: item.assetPath,
        cells: item.cells,
        footprint: item.footprint,
        anchorPixel: item.anchorPixel,
        assetRegistration: item.assetRegistration,
        pixelBounds: item.pixelBounds,
        zIndex: 100 + item.zIndex,
        blocksMovement: item.blocksMovement,
        emitsLight: item.emitsLight,
      })),
    ],
    validation: [
      "Base terrain contains no placed items.",
      "Each placed asset base footprint aligns to its reserved cells.",
      "Composite contains no extra tactical affordances outside authored cells.",
      "Runtime collision, cover, light, and interaction data come from grid metadata, not from the bitmap.",
    ],
  };
}

function renderLayeredReadme() {
  return `# ${stageName} Layered Map Package

This package supports a layered generation process.

## Files

- \`${packagePaths.baseTerrainControlPng}\`: control image for the base terrain only. Purple cells are reserved placed-item footprints.
- \`${packagePaths.altitudeControlPng}\`: altitude and height-edge control image.
- \`${packagePaths.baseTerrainPrompt}\`: prompt for the base terrain image. It must not draw placed items.
- \`${packagePaths.placedItems}\`: authoritative placed-item contracts.
- \`${packagePaths.assetPromptsDir}/\`: one prompt per placed asset.
- \`${packagePaths.composition}\`: deterministic compositing metadata.
- \`${packagePaths.grid}\`: runtime grid, collision, cover, altitude, marker, and spawn metadata.

## Production Sequence

1. Generate or paint \`${stageId}.base_terrain.png\` from \`${packagePaths.baseTerrainPrompt}\`.
2. Generate each placed asset from its prompt in \`${packagePaths.assetPromptsDir}/\`.
3. Save placed assets to \`${packagePaths.placedAssetsDir}/\` using the filenames in \`${packagePaths.composition}\`.
4. For each placed asset, record source-image \`localAnchorPixel\` and \`localFootprintBounds\` in the asset source map. Do not use cropped-image bottom-center as a placement guess.
5. Composite the base terrain and placed assets using \`${packagePaths.composition}\`.
6. Validate the composite against \`${packagePaths.grid}\`.

## Key Rule

Exact tactical objects are not drawn by the base terrain generator. Trees, cover, lamps, NPCs, and similar items are separate placed assets with authored footprints.
`;
}

function renderCellRequirements() {
  const features = metadata.features.reduce((map, cell) => {
    map[cell.feature] ||= [];
    map[cell.feature].push(cell);
    return map;
  }, {});
  const lines = [
    "- Low ground occupies the left side and must read lower than the plateau.",
    "- The right side is the +4 upper plateau and must read as one broad upper fighting surface.",
    "- The central blank band is the sheer rocky front face of the plateau, not traversable ground.",
    "- The top and bottom R-cell bands are the only traversable slope routes up.",
  ];
  for (const cover of metadata.cover) {
    lines.push(`- ${cover.kind} cover occupies exactly cell x${pad(cover.x)} y${pad(cover.y)}.`);
  }
  for (const [feature, featureCells] of Object.entries(features)) {
    const coords = featureCells.map((cell) => `x${pad(cell.x)} y${pad(cell.y)}`).join(", ");
    lines.push(`- Feature ${feature} (${featureDefinitions[feature] || `custom feature ${feature}`}) occupies exactly: ${coords}.`);
  }
  return lines.join("\n");
}

function renderValidationChecklist() {
  return `# ${stageName} Validation Checklist

Use this after every layered map attempt. The composite is rejected unless every relevant item below passes.

## Base Terrain

- [ ] The base terrain was generated from \`${packagePaths.baseTerrainPrompt}\`.
- [ ] The base terrain contains no placed items from \`${packagePaths.placedItems}\`.
- [ ] Reserved placed-item footprints remain visually open for later compositing.
- [ ] Black blocked/cliff regions retain their exact silhouettes and do not become floor.
- [ ] Green slope regions retain their exact silhouettes and remain the only routes onto changed altitude.
- [ ] Every slope/ramp follows R cells only.
- [ ] The central blocked/cliff cells are not walkable-looking.
- [ ] No unlisted cover-like, blocker-like, light-like, or interactable props were added to the base terrain.
- [ ] No unlisted stairs, ladders, ramps, bridges, or paths were added.

## Placed Assets

- [ ] Every placed item in \`${packagePaths.placedItems}\` has a generated asset or an explicit reuse decision.
- [ ] Every placed asset has explicit source-image \`localAnchorPixel\` and \`localFootprintBounds\` registration.
- [ ] Every placed asset base/contact footprint fits its listed cells after registration-based scaling.
- [ ] No placed asset includes extra tactical objects or surrounding terrain.
- [ ] Cover objects exist only where \`${packagePaths.placedItems}\` says cover exists.
- [ ] Feature objects exist only where \`${packagePaths.placedItems}\` says features exist.
- [ ] Light sources exist only where \`${packagePaths.placedItems}\` or \`${packagePaths.grid}\` allows them.
- [ ] NPC/neutral actor assets exist only where authored.

## Composite

- [ ] The composite was assembled from \`${packagePaths.composition}\`.
- [ ] Placed assets use the listed final-map anchor pixels, source-image local anchors, registered footprint bounds, and z order.
- [ ] Every visible tactical object matches \`${packagePaths.grid}\` and \`${packagePaths.placedItems}\`.
- [ ] No visible object creates false cover, blockers, climb routes, light sources, or interactions.
- [ ] Spawns are visually open enough for medium actors but no spawn markers or actors are drawn.

## Altitude

- [ ] Low ground, slopes, cliff face, and upper plateau are visually distinct.
- [ ] The +4 plateau reads as higher than the left-side low ground.
- [ ] The plateau is reachable only through the marked slope routes.
- [ ] Height is readable without labels.

## Style

- [ ] Dark fantasy underground tone.
- [ ] DNDT negative-ink/painterly direction is present.
- [ ] Detail is restrained enough not to create false tactical affordances.
- [ ] No text, UI, grid labels, tokens, actors, bases, or permanent grid lines.

## Outcome

- [ ] Accepted as layered composite candidate.
- [ ] Rejected for base terrain/grid drift.
- [ ] Rejected for placed asset drift.
- [ ] Rejected for misleading extra content in base terrain or assets.
- [ ] Rejected for style mismatch.
`;
}

function buildManifest() {
  return {
    stageId,
    source: path.resolve(inputPath),
    generatedAt: new Date().toISOString(),
    purpose: "layered grid-locked map generation package",
    sequence: [
      "author sketch",
      "export grid-sketch json and sketch txt",
      "build package with canonical grid metadata",
      "generate base terrain control plate with reserved placed-item footprints",
      "generate altitude control plate as the secondary constraint image",
      "generate placed item contracts",
      "generate base terrain prompt without placed items",
      "generate one isolated asset prompt per placed item",
      "generate deterministic composition metadata",
      "generate or paint the base terrain image",
      "generate placed assets in isolated canvases",
      "composite placed assets over the base terrain by metadata",
      "validate composite against grid and placed item contracts",
    ],
    legacyAllInOneSequence: [
      "generate placement control plate as the edit source image",
      "generate altitude control plate as the secondary constraint image",
      "generate combined SVG audit plate",
      "generate edit prompt",
      "edit the placement control plate into art while preserving region silhouettes",
      "validate against placement control plate, checklist, and grid metadata",
      "reject or approve for runtime validation overlay",
    ],
    files: packagePaths,
  };
}

function normalizeSketchCell(cell) {
  return {
    x: Number(cell.x),
    y: Number(cell.y),
    terrain: cell.terrain?.symbol || cell.terrain || " ",
    altitude: Number(cell.altitude) || 0,
    markers: (cell.markers || []).map((marker) => marker.symbol || marker),
  };
}

function classifyCell(cell) {
  const featureMarker = cell.markers.find((marker) => /^[1-9]$/.test(marker));
  if (featureMarker) return { walkable: false, blocked: true, blockedKind: `feature_${featureMarker}` };
  if (cell.terrain === " ") return { walkable: false, blocked: true, blockedKind: "blocked_or_void" };
  if (cell.terrain === "C") {
    return {
      walkable: false,
      blocked: true,
      blockedKind: "three_quarter_cover",
      cover: { kind: "three_quarter", blocksMovement: true },
    };
  }
  if (cell.terrain === "h") {
    return { walkable: true, blocked: false, cover: { kind: "half", blocksMovement: false } };
  }
  return { walkable: true, blocked: false };
}

function orderedCells() {
  const ordered = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      ordered.push(cellByKey.get(`${x},${y}`) || { x, y, terrain: " ", altitude: 0, markers: [] });
    }
  }
  return ordered;
}

function cellRef(cell) {
  return { x: cell.x, y: cell.y, altitude: cell.altitude };
}

function placementColor(cell) {
  const featureMarker = cell.markers.find((marker) => /^[1-9]$/.test(marker));
  if (featureMarker) return [255, 125, 24, 255];
  if (cell.terrain === " ") return [8, 10, 11, 255];
  if (cell.terrain === "C") return [232, 205, 68, 255];
  if (cell.terrain === "h") return [194, 178, 96, 255];
  if (cell.terrain === "R") return [92, 145, 90, 255];
  if (cell.terrain === "H") return [196, 74, 50, 255];
  if (cell.altitude >= 4) return [166, 135, 76, 255];
  if (cell.altitude > 0) return [126, 121, 79, 255];
  return [180, 200, 175, 255];
}

function baseTerrainColor(cell) {
  if (isReservedPlacedItemCell(cell)) return [119, 89, 170, 255];
  if (cell.terrain === "C" || cell.terrain === "h") return terrainOnlyColor(cell);
  return terrainOnlyColor(cell);
}

function terrainOnlyColor(cell) {
  if (cell.terrain === " ") return [8, 10, 11, 255];
  if (cell.terrain === "R") return [92, 145, 90, 255];
  if (cell.terrain === "H") return [196, 74, 50, 255];
  if (cell.altitude >= 4) return [166, 135, 76, 255];
  if (cell.altitude > 0) return [126, 121, 79, 255];
  return [180, 200, 175, 255];
}

function isReservedPlacedItemCell(cell) {
  if (cell.markers.some((marker) => /^[1-9]$/.test(marker))) return true;
  if (cell.markers.includes("L") || cell.markers.includes("N")) return true;
  if (cell.terrain === "C" || cell.terrain === "h") return true;
  return false;
}

function altitudeColor(cell) {
  if (cell.terrain === " ") return [6, 8, 9, 255];
  const palette = {
    "-2": [37, 51, 67, 255],
    "-1": [51, 68, 81, 255],
    0: [64, 78, 68, 255],
    1: [88, 98, 70, 255],
    2: [117, 109, 72, 255],
    3: [143, 116, 72, 255],
    4: [174, 126, 73, 255],
  };
  return palette[Math.max(-2, Math.min(4, cell.altitude))] || palette[0];
}

function placementHex(cell) {
  return rgbToHex(placementColor(cell));
}

function altitudeHex(cell) {
  return rgbToHex(altitudeColor(cell));
}

function promptCellSymbol(cell) {
  if (!cell) return " ";
  if (cell.markers.includes("P")) return "P";
  if (cell.markers.includes("M")) return "M";
  const featureMarker = cell.markers.find((marker) => /^[1-9]$/.test(marker));
  if (featureMarker) return featureMarker;
  return cell.terrain === " " ? " " : cell.terrain;
}

function renderPromptLayoutRows() {
  const rows = [];
  rows.push(`y\\x  ${Array.from({ length: width }, (_, x) => pad(x)).join(" ")}`);
  for (let y = 0; y < height; y += 1) {
    const row = [];
    for (let x = 0; x < width; x += 1) row.push(promptCellSymbol(cellByKey.get(`${x},${y}`)));
    rows.push(`${pad(y)}   ${row.join("  ")}`);
  }
  return rows.join("\n");
}

function renderPromptAltitudeRows() {
  const rows = [];
  rows.push(`y\\x  ${Array.from({ length: width }, (_, x) => pad(x)).join(" ")}`);
  for (let y = 0; y < height; y += 1) {
    const row = [];
    for (let x = 0; x < width; x += 1) row.push(formatHeight(cellByKey.get(`${x},${y}`)?.altitude || 0).padStart(2, " "));
    rows.push(`${pad(y)}   ${row.join(" ")}`);
  }
  return rows.join("\n");
}

function rightAndDownNeighbors(x, y) {
  return [
    cellByKey.get(`${x + 1},${y}`),
    cellByKey.get(`${x},${y + 1}`),
  ].filter(Boolean);
}

function groupBy(values, keyFn) {
  return values.reduce((groups, value) => {
    const groupKey = keyFn(value);
    groups[groupKey] ||= [];
    groups[groupKey].push(value);
    return groups;
  }, {});
}

function groupContiguousCells(values) {
  const remaining = new Map(values.map((cell) => [`${cell.x},${cell.y}`, cell]));
  const groups = [];
  while (remaining.size) {
    const [startKey, startCell] = remaining.entries().next().value;
    remaining.delete(startKey);
    const group = [startCell];
    const queue = [startCell];
    while (queue.length) {
      const current = queue.shift();
      for (const next of orthogonalNeighbors(current)) {
        const nextKey = `${next.x},${next.y}`;
        const nextCell = remaining.get(nextKey);
        if (!nextCell) continue;
        remaining.delete(nextKey);
        group.push(nextCell);
        queue.push(nextCell);
      }
    }
    groups.push(group);
  }
  return groups;
}

function orthogonalNeighbors(cell) {
  return [
    { x: cell.x + 1, y: cell.y },
    { x: cell.x - 1, y: cell.y },
    { x: cell.x, y: cell.y + 1 },
    { x: cell.x, y: cell.y - 1 },
  ];
}

function cellBounds(values) {
  return {
    minX: Math.min(...values.map((cell) => cell.x)),
    minY: Math.min(...values.map((cell) => cell.y)),
    maxX: Math.max(...values.map((cell) => cell.x)),
    maxY: Math.max(...values.map((cell) => cell.y)),
  };
}

function pixelBounds(values) {
  const points = values.flatMap((cell) => diamondPoints(cell.x, cell.y));
  return {
    minX: Math.round(Math.min(...points.map((point) => point.x))),
    minY: Math.round(Math.min(...points.map((point) => point.y))),
    maxX: Math.round(Math.max(...points.map((point) => point.x))),
    maxY: Math.round(Math.max(...points.map((point) => point.y))),
  };
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
    { x: center.x, y: center.y - halfH },
    { x: center.x + halfW, y: center.y },
    { x: center.x, y: center.y + halfH },
    { x: center.x - halfW, y: center.y },
  ];
}

function fitOrigin(gridWidth, gridHeight, tw, th) {
  const minX = -(gridHeight - 1) * tw / 2;
  const maxX = (gridWidth - 1) * tw / 2;
  const minY = 0;
  const maxY = (gridWidth + gridHeight - 2) * th / 2;
  const gridPixelWidth = maxX - minX + tw;
  const gridPixelHeight = maxY - minY + th;
  return {
    x: Math.round((1920 - gridPixelWidth) / 2 - minX + tw / 2),
    y: Math.round((1080 - gridPixelHeight) / 2 + th / 2),
  };
}

function normalizeOrigin(value) {
  const x = Number(value?.x);
  const y = Number(value?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function svgLegend() {
  return `<g transform="translate(70 905)">
    <text class="small">Placement colors: pale green walkable, tan high plateau, green slopes, yellow cover, orange features, black blocked.</text>
    <text y="24" class="small">Altitude colors: darker low ground to orange high ground; labels show exact 5 ft bands.</text>
  </g>`;
}

function out(fileName) {
  return path.join(outputDir, fileName);
}

function writeJson(fileName, value) {
  fs.writeFileSync(out(fileName), `${JSON.stringify(value, null, 2)}\n`);
}

function writePng(fileName, bytes) {
  fs.writeFileSync(out(fileName), bytes);
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatHeight(height) {
  const value = Number(height) || 0;
  return value > 0 ? `+${value}` : String(value);
}

function rgbToHex([r, g, b]) {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function seeded(seed) {
  const value = Math.sin(seed) * 10000;
  return value - Math.floor(value);
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

class Raster {
  constructor(width, height, color = [0, 0, 0, 255]) {
    this.width = width;
    this.height = height;
    this.data = Buffer.alloc(width * height * 4);
    this.rect(0, 0, width, height, color);
  }

  rect(x, y, w, h, color) {
    for (let yy = Math.max(0, y); yy < Math.min(this.height, y + h); yy += 1) {
      for (let xx = Math.max(0, x); xx < Math.min(this.width, x + w); xx += 1) this.setPixel(xx, yy, color);
    }
  }

  polygon(points, color) {
    const minX = Math.max(0, Math.floor(Math.min(...points.map((p) => p.x))));
    const maxX = Math.min(this.width - 1, Math.ceil(Math.max(...points.map((p) => p.x))));
    const minY = Math.max(0, Math.floor(Math.min(...points.map((p) => p.y))));
    const maxY = Math.min(this.height - 1, Math.ceil(Math.max(...points.map((p) => p.y))));
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        if (pointInPolygon(x + 0.5, y + 0.5, points)) this.setPixel(x, y, color);
      }
    }
  }

  polyline(points, color, width = 1) {
    for (let i = 0; i < points.length - 1; i += 1) this.line(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y, color, width);
  }

  line(x1, y1, x2, y2, color, width = 1) {
    const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
    for (let i = 0; i <= steps; i += 1) {
      const t = steps === 0 ? 0 : i / steps;
      const x = Math.round(x1 + (x2 - x1) * t);
      const y = Math.round(y1 + (y2 - y1) * t);
      this.circle(x, y, Math.max(1, Math.floor(width / 2)), color);
    }
  }

  circle(cx, cy, radius, color, fill = true, strokeWidth = 1) {
    const r2 = radius * radius;
    const inner = Math.max(0, radius - strokeWidth);
    const inner2 = inner * inner;
    for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y += 1) {
      for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x += 1) {
        const d2 = (x - cx) ** 2 + (y - cy) ** 2;
        if ((fill && d2 <= r2) || (!fill && d2 <= r2 && d2 >= inner2)) this.setPixel(x, y, color);
      }
    }
  }

  setPixel(x, y, color) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const index = (Math.floor(y) * this.width + Math.floor(x)) * 4;
    this.data[index] = color[0];
    this.data[index + 1] = color[1];
    this.data[index + 2] = color[2];
    this.data[index + 3] = color[3] ?? 255;
  }

  toPng() {
    const raw = Buffer.alloc((this.width * 4 + 1) * this.height);
    for (let y = 0; y < this.height; y += 1) {
      const rawOffset = y * (this.width * 4 + 1);
      raw[rawOffset] = 0;
      this.data.copy(raw, rawOffset + 1, y * this.width * 4, (y + 1) * this.width * 4);
    }
    return Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      pngChunk("IHDR", Buffer.concat([u32(this.width), u32(this.height), Buffer.from([8, 6, 0, 0, 0])])),
      pngChunk("IDAT", zlib.deflateSync(raw)),
      pngChunk("IEND", Buffer.alloc(0)),
    ]);
  }
}

function pointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const xi = points[i].x;
    const yi = points[i].y;
    const xj = points[j].x;
    const yj = points[j].y;
    const intersect = ((yi > y) !== (yj > y)) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type);
  return Buffer.concat([u32(data.length), typeBuffer, data, u32(crc32(Buffer.concat([typeBuffer, data])))]);
}

function u32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value >>> 0);
  return buffer;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function main() {
  metadata = buildMetadata();
  writeJson(packagePaths.grid, metadata);
  writePng(packagePaths.placementControlPng, renderPlacementPng());
  writePng(packagePaths.baseTerrainControlPng, renderBaseTerrainControlPng());
  writePng(packagePaths.altitudeControlPng, renderAltitudePng());
  writePng(packagePaths.gridLockedArtPng, renderGridLockedArtPng());
  fs.writeFileSync(out(packagePaths.combinedControlSvg), renderCombinedControlSvg());
  fs.writeFileSync(out(packagePaths.artPrompt), renderArtPrompt());
  fs.writeFileSync(out(packagePaths.baseTerrainPrompt), renderBaseTerrainPrompt());
  writeJson(packagePaths.placedItems, metadata.placedItems);
  writeJson(packagePaths.composition, buildComposition());
  fs.mkdirSync(out(packagePaths.assetPromptsDir), { recursive: true });
  fs.mkdirSync(out(packagePaths.placedAssetsDir), { recursive: true });
  for (const item of metadata.placedItems) fs.writeFileSync(out(item.assetPrompt), renderAssetPrompt(item));
  fs.writeFileSync(out(packagePaths.layeredReadme), renderLayeredReadme());
  fs.writeFileSync(out(packagePaths.validationChecklist), renderValidationChecklist());
  writeJson(packagePaths.manifest, buildManifest());
}

main();
