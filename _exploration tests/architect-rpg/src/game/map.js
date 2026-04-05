// --- Dimensions / constants ---
export const TILE = 32;
export const VIEW_W = 19;
export const VIEW_H = 18;
export const WORLD_W = 40;
export const WORLD_H = 30;

// Tile types (1x1 cells)
export const T = Object.freeze({
  FLOOR: 0,
  BUILDING: 2,
  RAVINE: 3,
  BRIDGE: 4,
  OBSTACLE: 5
});

// Composite "super tiles"
export const ST = Object.freeze({
  HOMESTEAD: "homestead"
});

const inBounds = (x, y) => x >= 0 && y >= 0 && x < WORLD_W && y < WORLD_H;

export function createMap() {
  const grid = Array.from({ length: WORLD_H }, () => Array(WORLD_W).fill(T.FLOOR));

  // ------------------------------------------------------------
  // Buildings (simple blocks, pulled in from edges)
  placeRect(grid, 6, 4, 6, 5, T.BUILDING);       // NW
  placeRect(grid, 25, 4, 9, 6, T.BUILDING);      // NE
  placeRect(grid, 6, 20, 8, 7, T.BUILDING);      // SW
  placeRect(grid, 26, 19, 9, 8, T.BUILDING);     // SE

  // Ravine: vertical chasm (2 tiles), bridge row visible
  const ravineCols = [19, 20];
  for (let y = 1; y < WORLD_H - 1; y++) for (const x of ravineCols) grid[y][x] = T.RAVINE;
  const bridgeRow = 14;
  for (const x of ravineCols) grid[bridgeRow][x] = T.BRIDGE;

  // Props (collision)
  const props = [
    { x: 12, y: 7 }, { x: 13, y: 7 },
    { x: 10, y: 22 }, { x: 11, y: 22 },
    { x: 31, y: 13 }, { x: 31, y: 14 }
  ];
  for (const p of props) if (inBounds(p.x, p.y)) grid[p.y][p.x] = T.OBSTACLE;

  // ------------------------------------------------------------
  // SPECIALS: Ruined Homestead composite region (~8x8 tiles)
  // Keep a 2-tile safety margin from edges.
  const specials = [];
  const homestead = {
    type: ST.HOMESTEAD,
    x: 12, y: 18,
    w: 8,  h: 8
  };
  specials.push(homestead);

  // Collision mask for the homestead: irregular walls + rubble
  carveHomesteadCollisions(grid, homestead);

  // Decorative plants (non-colliding)
  const plants = [];
  seedPlants(plants, grid, 140);

  return { grid, plants, ravineCols, bridgeRow, specials };
}

function placeRect(grid, x, y, w, h, type) {
  const margin = 2;
  const maxX = WORLD_W - margin;
  const maxY = WORLD_H - margin;
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) {
      if (i >= margin && j >= margin && i < maxX && j < maxY) {
        grid[j][i] = type;
      }
    }
  }
}

function carveHomesteadCollisions(grid, r) {
  // Outline a rough rectangle "footprint"
  for (let i = 0; i < r.w; i++) {
    setObs(grid, r.x + i, r.y);                // top wall (some gaps later)
    setObs(grid, r.x + i, r.y + r.h - 1);      // bottom
  }
  for (let j = 0; j < r.h; j++) {
    setObs(grid, r.x, r.y + j);                // left
    setObs(grid, r.x + r.w - 1, r.y + j);      // right
  }

  // Knock out a doorway gap on south wall
  for (let i = 3; i <= 4; i++) grid[r.y + r.h - 1][r.x + i] = T.FLOOR;

  // Inner collapsed rooms / rubble islands as obstacles
  const rubble = [
    { x: r.x + 2, y: r.y + 2 },
    { x: r.x + 4, y: r.y + 3 },
    { x: r.x + 5, y: r.y + 5 },
    { x: r.x + 2, y: r.y + 5 }
  ];
  rubble.forEach(p => setObs(grid, p.x, p.y));

  // Break some outer walls to look ruined
  grid[r.y][r.x + 1] = T.FLOOR;
  grid[r.y][r.x + r.w - 2] = T.FLOOR;
  grid[r.y + r.h - 2][r.x] = T.FLOOR;
}

function setObs(grid, x, y) {
  if (inBounds(x, y)) grid[y][x] = T.OBSTACLE;
}

function seedPlants(plants, grid, count) {
  let tries = 0;
  while (plants.length < count && tries < count * 20) {
    tries++;
    const x = Math.floor(Math.random() * WORLD_W);
    const y = Math.floor(Math.random() * WORLD_H);
    const t = grid[y][x];
    if (t === T.FLOOR) {
      const jitterX = (Math.random() * (TILE - 8)) + 4;
      const jitterY = (Math.random() * (TILE - 8)) + 4;
      plants.push({ x, y, ox: jitterX, oy: jitterY, r: 1.8 + Math.random() * 2.4 });
    }
  }
}