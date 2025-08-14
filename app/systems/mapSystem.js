// systems/mapSystem.js — text-mode
import { state } from '../state/stateStore.js';
import { logSystem } from '../engine/log.js';

let triggers = [];

export async function loadMap(mapId, loader) {
  // In text mode, prefer a provided loader that returns JSON.
  try {
    const data = loader ? await loader(mapId) : null;
    if (!data) { logSystem("No loader provided for loadMap; using empty map."); triggers = []; state.map = { id: mapId, width: 0, height: 0 }; return; }
    triggers = data.triggers || [];
    state.map = { id: mapId, width: data.width || 0, height: data.height || 0 };
    logSystem(`Map loaded: ${mapId} (${state.map.width}x${state.map.height}) with ${triggers.length} triggers.`);
  } catch(e) {
    logSystem("Failed to load map: " + (e?.message || e));
  }
}

export function loadMapFromData(data) {
  triggers = data?.triggers || [];
  state.map = { id: data?.id || null, width: data?.width || 0, height: data?.height || 0 };
  logSystem(`Map loaded from data: ${state.map.id} (${state.map.width}x${state.map.height})`);
}

export function checkTrigger(x, y) {
  return triggers.find(t => t.x === x && t.y === y) || null;
}


// --- exploration bootstrap (additive) ---
import { createEmptyTileGrid } from '../systems/mapBuilder.js';

export function initExploreForMap({ width, height, env='dim' } = {}) {
  try {
    const grid = createEmptyTileGrid(width|0, height|0);
    state.explore = state.explore || {};
    state.explore.tileGrid = grid;
    state.explore.env = env;
    const cam = state.explore.camera || { x:0, y:0, w:21, h:13 };
    cam.x = Math.min(Math.max(0, cam.x|0), Math.max(0, width - cam.w));
    cam.y = Math.min(Math.max(0, cam.y|0), Math.max(0, height - cam.h));
    cam.w = cam.w|0; cam.h = cam.h|0;
    state.explore.camera = cam;
  } catch(e) {}
}

export function setEnv(env){
  state.explore = state.explore || {};
  state.explore.env = String(env||'dim').toLowerCase();
}
