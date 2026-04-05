// engine/tile.js

export function createTile({
  walkable = true,
  blocksLight = false,
  isLit = false,
  lightSource = false,
  lightRadius = 5,
  terrainType = "floor",
  trigger = null,
  visible = false,
  explored = false,
  enemy = null
} = {}) {
  return {
    walkable,
    blocksLight,
    isLit,
    lightSource,
    lightRadius,
    terrainType,
    trigger,
    visible,
    explored,
    enemy
  };
}

// Utility accessors and mutators
export function isWalkable(tile) {
  return tile.walkable;
}

export function blocksVision(tile) {
  return tile.blocksLight;
}

export function setTrigger(tile, triggerData) {
  tile.trigger = triggerData;
}

export function setExplored(tile) {
  tile.explored = true;
}

export function setVisible(tile, value = true) {
  tile.visible = value;
}

export function setEnemy(tile, enemyId) {
  tile.enemy = enemyId;
}

export function clearEnemy(tile) {
  tile.enemy = null;
}

// New fog of war utilities
export function clearVisibility(grid) {
  for (let x = 0; x < grid.length; x++) {
    for (let y = 0; y < grid[0].length; y++) {
      grid[x][y].visible = false;
    }
  }
}
