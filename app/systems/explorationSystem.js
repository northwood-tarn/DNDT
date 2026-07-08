// app/systems/explorationSystem.js
//
// Exploration domain system.
// Owns exploration state, movement rules, visibility hooks, and encounter triggers.
// Consumes exploration intent events and emits domain outcomes.
//
// This module has NO rendering code and NO direct DOM access.

import { on, off, emit } from "../engine/events.js";
import { getState } from "../state/stateStore.js";
import { loadMapFromArea } from "./mapLoader.js";
import { createMapSystem } from "./mapSystem.js";
import { createVisibilitySystem } from "./visibilitySystem.js";
import { createEnemyAwarenessSystem } from "./enemyAwareness.js";

// -----------------------------------------------------------------------------
// Internal state
// -----------------------------------------------------------------------------

let active = false;
let area = null;
let map = null;

let mapSystem = null;
let visibilitySystem = null;
let awarenessSystem = null;

// Player position adapter: prefer canonical stateStore methods, but provide a
// safe fallback so exploration can run even while the store is evolving.
let _fallbackPlayerPos = null;

function getPlayerPos(state) {
  return state?.getPlayerPosition?.() || _fallbackPlayerPos;
}

function setPlayerPos(state, x, y) {
  if (state?.setPlayerPosition) {
    state.setPlayerPosition(x, y);
    return;
  }
  _fallbackPlayerPos = { x, y };
}

function normalizeDir(dir) {
  if (!dir) return null;

  // Already a vector
  if (typeof dir === "object" && ("dx" in dir || "dy" in dir)) {
    return { dx: dir.dx | 0, dy: dir.dy | 0, ...(dir.name ? { name: dir.name } : {}) };
  }

  // Accept common string forms
  if (typeof dir === "string") {
    const s = dir.toLowerCase();
    if (s === "up" || s === "north" || s === "n" || s === "arrowup" || s === "w") return { dx: 0, dy: -1, name: "up" };
    if (s === "down" || s === "south" || s === "s" || s === "arrowdown") return { dx: 0, dy: 1, name: "down" };
    if (s === "left" || s === "west" || s === "a" || s === "arrowleft") return { dx: -1, dy: 0, name: "left" };
    if (s === "right" || s === "east" || s === "d" || s === "arrowright") return { dx: 1, dy: 0, name: "right" };
  }

  return null;
}

// -----------------------------------------------------------------------------
// Event handlers
// -----------------------------------------------------------------------------

async function onEnterExploration({ areaId, area: areaDef, tmj } = {}) {
  if (active) teardown();
  console.info("[explorationSystem] onEnterExploration", { areaId, tmj, areaIdFromDef: areaDef?.id });

  area = areaDef;
  active = true;

  map = await loadMapFromArea({ areaId, area });

  // Build systems
  mapSystem = createMapSystem({ map, stateStore: getState() });
  visibilitySystem = createVisibilitySystem({ map, stateStore: getState() });
  awarenessSystem = createEnemyAwarenessSystem({ map, stateStore: getState() });

  // Ensure we have a valid player spawn before first visibility pass.
  const state = getState();
  const existing = getPlayerPos(state);
  const spawn = map?.start || { x: 0, y: 0 };
  const shouldSpawn =
    !existing ||
    typeof existing.x !== "number" ||
    typeof existing.y !== "number";

  if (shouldSpawn) {
    setPlayerPos(state, spawn.x, spawn.y);
  }

  // Initial visibility computation
  const recompute =
    visibilitySystem?.recomputeFromPlayer ||
    visibilitySystem?.recomputeForPlayer ||
    visibilitySystem?.recomputeForActor;
  if (typeof recompute === "function") recompute();

  // Tell renderers where to place the sprite immediately.
  const spawnedAt = getPlayerPos(state) || spawn;
  emit("exploration:spawned", {
    areaId,
    pos: { x: spawnedAt.x, y: spawnedAt.y }
  });

  emit("exploration:ready", {
    areaId,
    map,
    tmj
  });
}

function onExitExploration() {
  if (!active) return;
  teardown();
}

function onMoveIntent(payload) {
  if (!active) return;
  console.info("[explorationSystem] onMoveIntent raw payload:", payload);

  // events.js calls handlers as (detail, event).
  // inputManager emits: emit("exploration:moveIntent", dir)
  // So payload may be the dir itself, or an object like { dir }.
  const dir = normalizeDir(payload?.dir ?? payload);
  console.info("[explorationSystem] onMoveIntent normalized dir:", dir);
  if (!dir) return;

  const state = getState();
  const pos = getPlayerPos(state);
  if (!pos) return;

  // Support both step signatures:
  //  - step(pos, dir)
  //  - step(x, y, dir)
  if (typeof mapSystem?.step !== "function") return;

  const stepResult = mapSystem.step.length >= 3
    ? mapSystem.step(pos.x, pos.y, dir)
    : mapSystem.step(pos, dir);
  console.info("[explorationSystem] stepResult:", stepResult);

  // DEBUG: explicit collision diagnostics
  try {
    const nx = (stepResult?.to?.x ?? (pos.x + dir.dx));
    const ny = (stepResult?.to?.y ?? (pos.y + dir.dy));
    const blockedByGrid =
      typeof map?.isBlocked === "function"
        ? map.isBlocked(nx, ny)
        : map?.blocked?.[ny]?.[nx];

    console.info("[explorationSystem] collision check", {
      from: { x: pos.x, y: pos.y },
      dir,
      to: { x: nx, y: ny },
      blockedByGrid
    });
  } catch (e) {
    console.warn("[explorationSystem] collision debug failed", e);
  }

  // If mapSystem is blocking but the canonical grid says the tile is open,
  // allow the move as a temporary safety fallback (we’ll fix mapSystem.step next).
  if (!stepResult || stepResult.blocked) {
    try {
      const nx = (stepResult?.to?.x ?? (pos.x + dir.dx));
      const ny = (stepResult?.to?.y ?? (pos.y + dir.dy));

      const inBounds =
        typeof map?.width === "number" &&
        typeof map?.height === "number" &&
        nx >= 0 && ny >= 0 && nx < map.width && ny < map.height;

      const blockedByGrid =
        typeof map?.isBlocked === "function"
          ? map.isBlocked(nx, ny)
          : map?.blocked?.[ny]?.[nx];

      if (inBounds && blockedByGrid === false) {
        console.warn("[explorationSystem] mapSystem.step blocked but grid open; applying fallback move", {
          from: { x: pos.x, y: pos.y },
          to: { x: nx, y: ny },
          dir
        });

        const next = { x: nx, y: ny };

        // Commit movement
        setPlayerPos(state, next.x, next.y);

        // Tile entry effects (triggers, exits, etc.)
        let tileResult = null;
        if (typeof mapSystem?.processTileEnter === "function") {
          tileResult = mapSystem.processTileEnter.length >= 2
            ? mapSystem.processTileEnter(next.x, next.y)
            : mapSystem.processTileEnter({ to: next });
        }

        // Visibility update (defensive)
        const recompute =
          visibilitySystem?.recomputeFromPlayer ||
          visibilitySystem?.recomputeForPlayer ||
          visibilitySystem?.recomputeForActor;
        if (typeof recompute === "function") recompute();

        emit("exploration:moved", {
          from: pos,
          to: next
        });

        // Area exit
        if (tileResult?.exit) {
          emit("exploration:exitArea", tileResult.exit);
          return;
        }

        // Encounter detection (delegated)
        const encounter = awarenessSystem?.checkForEncounter?.(next.x, next.y);
        if (encounter) {
          emit("exploration:startCombat", encounter);
        }

        return;
      }
    } catch (e) {
      // fall through to blocked behaviour
    }

    emit("exploration:moveBlocked", { dir });
    return;
  }

  const next = stepResult.to || stepResult; // accept plain {x,y}

  // Commit movement
  setPlayerPos(state, next.x, next.y);

  // Tile entry effects (triggers, exits, etc.)
  let tileResult = null;
  if (typeof mapSystem?.processTileEnter === "function") {
    tileResult = mapSystem.processTileEnter.length >= 2
      ? mapSystem.processTileEnter(next.x, next.y)
      : mapSystem.processTileEnter(stepResult);
  }

  // Visibility update (defensive)
  const recompute =
    visibilitySystem?.recomputeFromPlayer ||
    visibilitySystem?.recomputeForPlayer ||
    visibilitySystem?.recomputeForActor;
  if (typeof recompute === "function") recompute();

  emit("exploration:moved", {
    from: pos,
    to: next
  });

  // Area exit
  if (tileResult?.exit) {
    emit("exploration:exitArea", tileResult.exit);
    return;
  }

  // Encounter detection (delegated)
  const encounter = awarenessSystem?.checkForEncounter?.(next.x, next.y);
  if (encounter) {
    emit("exploration:startCombat", encounter);
  }
}

// -----------------------------------------------------------------------------
// Lifecycle
// -----------------------------------------------------------------------------

function teardown() {
  active = false;
  area = null;
  map = null;

  mapSystem = null;
  visibilitySystem = null;
  awarenessSystem = null;

  _fallbackPlayerPos = null;
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

export function startExplorationSystem() {
  console.info("[explorationSystem] startExplorationSystem: registering listeners");
  on("exploration:enter", onEnterExploration);
  on("exploration:exit", onExitExploration);
  on("exploration:moveIntent", onMoveIntent);
}

export function stopExplorationSystem() {
  off("exploration:enter", onEnterExploration);
  off("exploration:exit", onExitExploration);
  off("exploration:moveIntent", onMoveIntent);
  teardown();
}
