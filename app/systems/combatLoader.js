// text-mode systems/combatLoader.js
import { sceneManager } from '../engine/sceneManager.js';
import CombatScene from '../scenes/CombatScene.js';
import { encounters } from '../data/encounters.js';
import { state } from '../state/stateStore.js';
import { createTile } from '../engine/tile.js';
import { rollInitiative } from './combatInitiative.js';
import { logSystem } from '../engine/log.js';

function createEmptyTileGrid(w, h) {
  const grid = Array.from({ length: h }, () => Array.from({ length: w }, () => createTile({ walkable: true })));
  return grid;
}

export function startCombat(encounterId) {
  const gridSize = 30;
  const grid = createEmptyTileGrid(gridSize, gridSize);
  const midY = Math.floor(gridSize / 2);

  const encounter = encounters[encounterId];
  if (!encounter) {
    logSystem("Unknown encounter: " + encounterId);
    return;
  }

  // Initialize combat state
  state.combat = {
    tileGrid: grid,
    player: { ...state.player, x: 1, y: midY, movementRemaining: 6 },
    enemies: []
  };

  // Place enemies
  const enemyStartX = gridSize - 2;
  const usedOffsets = new Set();
  for (let i = 0; i < encounter.enemies.length; i++) {
    let dx = 0, dy = 0;
    while (true) {
      dx = (Math.floor(Math.random() * 5) - 2) * 2;  // -4..+4 step 2
      dy = (Math.floor(Math.random() * 5) - 2) * 2;
      const key = dx + "," + dy;
      if (!usedOffsets.has(key)) { usedOffsets.add(key); break; }
    }
    state.combat.enemies.push({
      id: encounter.enemies[i],
      x: enemyStartX + dx,
      y: midY + dy,
      hp: 10 // placeholder if enemy stats not applied yet
    });
  }

  rollInitiative(state);
  sceneManager.replace(CombatScene);
}
