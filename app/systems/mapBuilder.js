// systems/mapBuilder.js

import { createTile, setTrigger, setEnemy } from "../engine/tile.js";

export function createEmptyTileGrid(width, height) {
  return Array.from({ length: width }, () =>
    Array.from({ length: height }, () => createTile())
  );
}

export function placeWalls(tileGrid, coords) {
  for (const [x, y] of coords) {
    if (tileGrid[x] && tileGrid[x][y]) {
      tileGrid[x][y] = createTile({
        walkable: false,
        blocksLight: true,
        terrainType: "wall"
      });
    }
  }
}

export function placeTorches(tileGrid, coords) {
  for (const [x, y] of coords) {
    if (tileGrid[x] && tileGrid[x][y]) {
      tileGrid[x][y].lightSource = true;
      tileGrid[x][y].lightRadius = 5;
    }
  }
}

export function placeEnemies(tileGrid, enemies) {
  for (const [x, y, id] of enemies) {
    if (tileGrid[x] && tileGrid[x][y]) {
      setEnemy(tileGrid[x][y], id);
    }
  }
}

export function placeTriggers(tileGrid, triggers) {
  for (const { x, y, ...data } of triggers) {
    if (tileGrid[x] && tileGrid[x][y]) {
      setTrigger(tileGrid[x][y], data);
    }
  }
}

export function applyTerrain(tileGrid, terrain, offsetX = 0, offsetY = 0) {
  if (terrain.walls) {
    placeWalls(tileGrid, terrain.walls.map(([x, y]) => [x + offsetX, y + offsetY]));
  }
  if (terrain.torches) {
    placeTorches(tileGrid, terrain.torches.map(([x, y]) => [x + offsetX, y + offsetY]));
  }
  if (terrain.enemies) {
    placeEnemies(tileGrid, terrain.enemies.map(([x, y, id]) => [x + offsetX, y + offsetY, id]));
  }
  if (terrain.triggers) {
    placeTriggers(tileGrid, terrain.triggers.map(t => ({
      ...t,
      x: t.x + offsetX,
      y: t.y + offsetY
    })));
  }
}
