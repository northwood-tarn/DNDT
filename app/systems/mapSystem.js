// app/systems/mapSystem.js — text-mode (wired to mapLoader)
// Surgical enhancement: validate/normalize maps via mapLoader.fromJSON and index triggers for O(1) lookup.

import { state } from '../state/stateStore.js';
import { logSystem } from '../engine/log.js';
import { fromJSON as mapFromJSON } from './mapLoader.js';

let triggers = [];
let triggersByKey = Object.create(null);

/**
 * Load a map by id using a provided loader that returns either:
 *  - raw JSON in the ExplorationMap shape, or
 *  - an already-normalized ExplorationMap object.
 * We validate/normalize via mapLoader.fromJSON in all cases.
 */
export async function loadMap(mapId, loader) {
  try {
    const raw = loader ? await loader(mapId) : null;
    if (!raw) {
      logSystem("No loader provided for loadMap; using empty map.");
      triggers = [];
      triggersByKey = Object.create(null);
      state.map = { id: mapId, width: 0, height: 0, profile: 'ExplorationMap', start: { x:0, y:0 }, labels: [] };
      return;
    }
    const map = mapFromJSON(raw);
    applyMap(map);
    logSystem(`Map loaded: ${mapId} (${state.map.width}x${state.map.height}) with ${triggers.length} triggers.`);
  } catch(e) {
    logSystem("Failed to load map: " + (e?.message || e));
  }
}

/**
 * Load a map directly from a JSON object (or normalized object).
 */
export function loadMapFromData(data) {
  try {
    const map = mapFromJSON(data);
    applyMap(map);
    logSystem(`Map loaded from data: ${state.map.id} (${state.map.width}x${state.map.height})`);
  } catch(e) {
    logSystem("Failed to load map from data: " + (e?.message || e));
  }
}

/**
 * Return the trigger object at coordinate (x,y) or null.
 * Uses O(1) lookup via internal index.
 */
export function checkTrigger(x, y) {
  const t = triggersByKey[`${x},${y}`];
  return t || null;
}

// --- exploration bootstrap (additive) ---
import { createEmptyTileGrid } from '../systems/mapBuilder.js';

/**
 * Initialize a minimal exploration grid for the current map size.
 */
export function initExploreForMap({ width, height, env='dim' } = {}) {
  try {
    const W = width|0, H = height|0;
    const grid = createEmptyTileGrid(W, H);
    state.explore = state.explore || {};
    state.explore.tileGrid = grid;
    state.explore.env = env;
    const cam = state.explore.camera || { x:0, y:0, w:21, h:13 };
    cam.x = Math.min(Math.max(0, cam.x|0), Math.max(0, W - cam.w));
    cam.y = Math.min(Math.max(0, cam.y|0), Math.max(0, H - cam.h));
    cam.w = cam.w|0; cam.h = cam.h|0;
    state.explore.camera = cam;
  } catch(e) {}
}

export function setEnv(env){
  state.explore = state.explore || {};
  state.explore.env = String(env||'dim').toLowerCase();
}

// ---- internal helpers ----
function applyMap(map){
  // Persist the whole normalized map on state for other systems.
  state.map = map;
  triggers = Array.isArray(map.triggers) ? map.triggers.slice() : [];
  // Build O(1) index.
  triggersByKey = Object.create(null);
  for (const t of triggers){
    triggersByKey[`${t.x},${t.y}`] = t;
  }
}
