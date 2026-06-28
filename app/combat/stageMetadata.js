const COMBAT_STAGE_ASSET_BASE = "../visual_spike/assets/";

export const DOCKSIDE_GRIDFIRST_STAGE_V1 = Object.freeze({
  stageId: "dockside_gridfirst_stage_v1",
  status: "draft_grid_validation",
  image: {
    runtimePlate: "dockside_gridfirst_stage_v1_grid_preview.png",
    sourcePlate: "dockside_gridfirst_stage_v1_source.png",
    width: 1920,
    height: 1080,
  },
  grid: {
    projection: "isometric_square",
    tileWidth: 128,
    tileHeight: 64,
    origin: { x: 900, y: 250 },
    width: 11,
    height: 8,
    coordinateRule: "x increases down-right; y increases down-left",
  },
  walkable: {
    bounds: [
      { x: 0, y: 0, w: 11, h: 8 },
    ],
  },
  blocked: [
    { x: 5, y: 0, kind: "shrine_base" },
    { x: 6, y: 0, kind: "shrine_base" },
    { x: 0, y: 1, kind: "rail_or_post" },
    { x: 10, y: 1, kind: "upper_wall" },
    { x: 9, y: 2, kind: "candle_blocker" },
    { x: 0, y: 5, kind: "dock_post" },
    { x: 10, y: 6, kind: "broken_edge" },
  ],
  cover: [
    { x: 2, y: 2, kind: "half", source: "low stone edge" },
    { x: 7, y: 3, kind: "half", source: "rubble" },
    { x: 3, y: 5, kind: "half", source: "dock crates/posts" },
    { x: 8, y: 5, kind: "half", source: "broken stone edge" },
  ],
  spawns: {
    defaultHeroSpawns: [
      { x: 1, y: 6 },
      { x: 2, y: 6 },
      { x: 1, y: 7 },
      { x: 2, y: 7 },
    ],
    defaultEnemySpawns: [
      { x: 8, y: 1 },
      { x: 9, y: 1 },
      { x: 8, y: 3 },
      { x: 9, y: 3 },
    ],
  },
});

const BACKLANDS_FIELD_PLATEAU_01_PACKAGE = Object.freeze({
  schemaVersion: 2,
  id: "backlands_field_plateau_01",
  name: "Backlands Field Plateau",
  mode: "combat",
  image: {
    width: 1920,
    height: 1080,
    litPlate: "greyharbour_empty_field_river_hint_01.png",
  },
  grid: {
    projection: "isometric_square",
    tileWidth: 128,
    tileHeight: 64,
    origin: { x: 960, y: 120 },
    width: 16,
    height: 11,
    coordinateRule: "x increases down-right; y increases down-left",
  },
  finalPassability: {
    cells: cellsFromRows([
      " ############## ",
      " ############## ",
      " ############## ",
      " ############## ",
      " ############## ",
      " ############## ",
      " ############## ",
      " ############## ",
      " ############## ",
      " ############## ",
      " ############## ",
    ]),
  },
  cells: [
    markerCell(4, 0, "M", "enemy_spawn", "enemy spawn"),
    markerCell(6, 0, "M", "enemy_spawn", "enemy spawn"),
    markerCell(13, 0, "M", "enemy_spawn", "enemy spawn"),
    markerCell(3, 10, "P", "hero_spawn", "hero spawn"),
    markerCell(4, 10, "P", "hero_spawn", "hero spawn"),
    markerCell(6, 10, "P", "hero_spawn", "hero spawn"),
  ],
  cover: [],
  placedObjects: [],
});

export const BACKLANDS_FIELD_PLATEAU_01_STAGE = Object.freeze(
  createStageMetadataFromImageFirstGridPackage({
    stageId: "backlands_field_plateau_01",
    status: "image_first_grid_validation",
    packagePath: "generated_map_tests/backlands_field_plateau_01_process_01/",
    packageData: BACKLANDS_FIELD_PLATEAU_01_PACKAGE,
  })
);

const COMBAT_STAGES = Object.freeze({
  [DOCKSIDE_GRIDFIRST_STAGE_V1.stageId]: DOCKSIDE_GRIDFIRST_STAGE_V1,
  [BACKLANDS_FIELD_PLATEAU_01_STAGE.stageId]: BACKLANDS_FIELD_PLATEAU_01_STAGE,
});

export function getCombatStageMetadata(stageId) {
  const stage = COMBAT_STAGES[stageId];
  return stage ? structuredClone(stage) : null;
}

export function createScenarioGridFromStage(stage) {
  return {
    width: stage.grid.width,
    height: stage.grid.height,
    blocked: structuredClone(stage.blocked || []),
    cover: structuredClone(stage.cover || []),
  };
}

export function createPresentationFromStage(stage, options = {}) {
  const runtimePlate = options.runtimePlate || stage.image.runtimePlate;
  const image = {
    ...stage.image,
    runtimePlate,
    width: Number(stage.image.width),
    height: Number(stage.image.height),
  };
  const grid = {
    ...stage.grid,
    origin: { ...stage.grid.origin },
    tileWidth: Number(stage.grid.tileWidth),
    tileHeight: Number(stage.grid.tileHeight),
    width: Number(stage.grid.width),
    height: Number(stage.grid.height),
  };

  return {
    visualStyle: "miniature_tilt_shift",
    visualGround: "stage_image",
    backgroundImage: `${COMBAT_STAGE_ASSET_BASE}${runtimePlate}`,
    stage: {
      stageId: stage.stageId,
      status: stage.status,
      image,
      grid,
      spawns: structuredClone(stage.spawns || {}),
    },
    gridProjection: createGridProjectionFromStage({ image, grid }),
  };
}

export function createGridProjectionFromStage({ image, grid }) {
  const xAxis = { x: grid.tileWidth / 2, y: grid.tileHeight / 2 };
  const yAxis = { x: -grid.tileWidth / 2, y: grid.tileHeight / 2 };
  return {
    kind: "stage_metadata",
    fixedStage: true,
    viewBox: { width: image.width, height: image.height },
    origin: {
      x: grid.origin.x - (xAxis.x + yAxis.x) / 2,
      y: grid.origin.y - (xAxis.y + yAxis.y) / 2,
    },
    xAxis,
    yAxis,
    tile: { width: grid.tileWidth, height: grid.tileHeight },
  };
}

function createStageMetadataFromImageFirstGridPackage({ stageId, status, packagePath, packageData }) {
  const width = Number(packageData.grid.width);
  const height = Number(packageData.grid.height);
  const passable = new Set((packageData.finalPassability?.cells || []).map(cellKey));
  const blocked = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!passable.has(cellKey({ x, y }))) blocked.push({ x, y, kind: "unpainted_or_nonpassable" });
    }
  }

  return {
    stageId,
    status,
    image: {
      runtimePlate: `${packagePath}${packageData.image.litPlate}`,
      sourcePlate: `${packagePath}${packageData.image.litPlate}`,
      width: packageData.image.width,
      height: packageData.image.height,
    },
    grid: structuredClone(packageData.grid),
    walkable: {
      cells: structuredClone(packageData.finalPassability?.cells || []),
    },
    blocked,
    cover: (packageData.cover || []).map((cell) => ({
      x: cell.x,
      y: cell.y,
      kind: cell.kind || cell.coverKind || "half",
      source: cell.source || cell.label || "image-first grid metadata",
    })),
    placedObjects: structuredClone(packageData.placedObjects || []),
    spawns: extractSpawnsFromImageFirstCells(packageData.cells || []),
  };
}

function extractSpawnsFromImageFirstCells(cells) {
  const defaultHeroSpawns = [];
  const defaultEnemySpawns = [];
  for (const cell of cells) {
    for (const marker of cell.markers || []) {
      if (marker.symbol === "P") defaultHeroSpawns.push({ x: cell.x, y: cell.y });
      if (marker.symbol === "M") defaultEnemySpawns.push({ x: cell.x, y: cell.y });
    }
  }
  return { defaultHeroSpawns, defaultEnemySpawns };
}

function cellsFromRows(rows) {
  return rows.flatMap((row, y) => [...row].flatMap((symbol, x) => (
    symbol === "#" ? [{ x, y }] : []
  )));
}

function markerCell(x, y, symbol, state, label) {
  return {
    x,
    y,
    display: symbol,
    terrain: { symbol: ".", state: "walkable", label: "walkable" },
    altitude: 0,
    markers: [{ symbol, state, label }],
  };
}

function cellKey({ x, y }) {
  return `${x},${y}`;
}
