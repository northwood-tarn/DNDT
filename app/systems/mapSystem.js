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

// -----------------------------------------------------------------------------
// Factory (used by explorationSystem)
// -----------------------------------------------------------------------------
// This keeps the explorationSystem call-site stable. It wraps the existing
// map normalization + trigger indexing in a small instance-style API.
//
// Expected inputs:
// - map: a normalized ExplorationMap-like object (from mapLoader.fromJSON)
// - You can also call setMap(map) later.
//
// Collision support is best-effort:
// - map.collisionGrid: 2D array of truthy/falsey
// - map.blocked: array of {x,y} or strings "x,y"
// - map.solids: array of {x,y}
export function createMapSystem(initialMap = null) {
  let _map = null;
  let _blocked = null; // Set<string> of "x,y"

  function _rebuildBlockedIndex() {
    _blocked = new Set();
    if (!_map) return;

    // 1) collisionGrid[y][x]
    if (Array.isArray(_map.collisionGrid)) {
      for (let y = 0; y < _map.collisionGrid.length; y++) {
        const row = _map.collisionGrid[y];
        if (!Array.isArray(row)) continue;
        for (let x = 0; x < row.length; x++) {
          if (row[x]) _blocked.add(`${x},${y}`);
        }
      }
    }

    // 2) blocked list
    const list = _map.blocked || _map.solids || null;
    if (Array.isArray(list)) {
      for (const it of list) {
        if (!it) continue;
        if (typeof it === "string") {
          _blocked.add(it);
        } else if (typeof it.x === "number" && typeof it.y === "number") {
          _blocked.add(`${it.x|0},${it.y|0}`);
        }
      }
    }
  }

  function setMap(map) {
    if (!map) {
      _map = null;
      _blocked = null;
      return;
    }

    // Normalize via existing helper so triggers get indexed.
    applyMap(map);
    _map = state.map;
    _rebuildBlockedIndex();
  }

  function getMap() {
    return _map || state.map || null;
  }

  function inBounds(x, y) {
    const m = getMap();
    const W = m?.width | 0;
    const H = m?.height | 0;
    return x >= 0 && y >= 0 && x < W && y < H;
  }

  function isBlocked(x, y) {
    if (!inBounds(x, y)) return true;
    if (!_blocked) return false;
    return _blocked.has(`${x},${y}`);
  }

  // Directional step. `pos` is {x,y}, `dir` is {dx,dy}
  function step(pos, dir) {
    const x0 = pos?.x | 0;
    const y0 = pos?.y | 0;
    const dx = dir?.dx | 0;
    const dy = dir?.dy | 0;

    const x1 = x0 + dx;
    const y1 = y0 + dy;

    if (isBlocked(x1, y1)) {
      return { blocked: true, from: { x: x0, y: y0 }, to: { x: x1, y: y1 } };
    }

    const trig = checkTrigger(x1, y1);
    return {
      blocked: false,
      from: { x: x0, y: y0 },
      to: { x: x1, y: y1 },
      trigger: trig,
    };
  }

  // Interpret trigger payloads in a tolerant way.
  function processTileEnter(stepResult) {
    const t = stepResult?.trigger;
    if (!t) return { exit: null, encounter: null, trigger: null };

    // Common shapes we’ve used across the project.
    const kind = (t.kind || t.type || t.trigger || t.name || "").toString();
    const upper = kind.toUpperCase();

    const exit = (upper.includes("EXIT") && (t.exit || t.payload || t.target || t.data)) ? (t.exit || t.payload || t.target || t.data) : null;
    const encounter = (upper.includes("ENCOUNTER") && (t.encounter || t.payload || t.data)) ? (t.encounter || t.payload || t.data) : null;

    return { exit, encounter, trigger: t };
  }

  // Initialize immediately if provided.
  if (initialMap) setMap(initialMap);

  return {
    setMap,
    getMap,
    inBounds,
    isBlocked,
    step,
    processTileEnter,
    checkTrigger,
  };
}
