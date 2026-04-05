// app/systems/visibilitySystem.js
// Surgical patch: whitelist ambient/static lights; exclude player/transient lights.
// Added debug logging of all light sources.

import { state } from '../state/stateStore.js';
import { getPlayerVisibility } from './lightingRules.js';
import { buildLightSets } from './lightSources.js';
import { logSystem } from '../engine/log.js';

// Throttled debug state for light-source logging
let __lastLightLogAt = 0;
function __safeLightSummary(list) {
  if (!Array.isArray(list)) return String(list);
  return list.map((s) => {
    if (!s) return null;
    return {
      id: s.id,
      kind: s.kind,
      on: s.on,
      x: s.x,
      y: s.y,
      r: s.r ?? s.radius,
      ambient: s.ambient,
      persistent: s.persistent,
      transient: s.transient,
      follow: s.follow,
      owner: s.owner,
    };
  });
}

/**
 * Recompute visibility sets (bright/dim) for the current frame.
 * @param {{px:number, py:number}} param0
 * @returns {{bright:Set<string>, dim:Set<string>}}
 */
export function recomputeVisibility({ px, py }) {
  const W = state.map?.width  | 0;
  const H = state.map?.height | 0;

  // Player visibility envelope from current environment / lantern etc.
  const playerVis = getPlayerVisibility(state?.explore?.env || 'dim');

  // ---- Patch begins: select only valid, ambient/static extra sources ----
  const raw =
    (state?.explore?.lightSources) ??
    (state?.explore?.sources) ??
    (state?.map?.lights) ??
    [];

  try {
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (now - __lastLightLogAt > 1500) {
      __lastLightLogAt = now;
      logSystem(`LIGHT SOURCES (summary): ${JSON.stringify(__safeLightSummary(raw))}`);
    }
  } catch (_) {
    // Ignore debug logging failures.
  }

  // Allowed kinds are ambient/static fixtures. Anything tagged as player/hover/etc. is excluded.
  const ALLOW_KIND = new Set(['torch', 'lamp', 'lantern_static', 'brazier', 'camp', 'bonfire', 'crystal', 'portal', 'glow', 'ambient', 'sun', 'moon']);
  const filteredSources = (Array.isArray(raw) ? raw : []).filter(s => {
    if (!s) return false;
    if (s.on === false) return false;

    // Exclude transient or player-following lights
    if (s.transient === true) return false;
    if (s.kind === 'player' || s.kind === 'cursor' || s.kind === 'hover' || s.kind === 'preview') return false;
    if (s.follow === 'player' || s.owner === 'player' || s.id === 'player-light') return false;

    // If it explicitly says ambient/persistent, keep it
    if (s.persistent === true || s.ambient === true) return true;

    // Otherwise require an allowed static kind
    if (typeof s.kind === 'string' && ALLOW_KIND.has(s.kind)) return true;

    // Default: reject unknown kinds to avoid ghost bubbles
    return false;
  });
  // ---- Patch ends ----

  // Build light sets for player + allowed ambient/static sources
  const { bright, dim } = buildLightSets({
    width: W,
    height: H,
    player: { x: px, y: py },
    playerVis,
    sources: filteredSources
  });

  return { bright, dim };
}

// -----------------------------------------------------------------------------
// Factory (used by explorationSystem)
// -----------------------------------------------------------------------------
// Keeps the explorationSystem call-site stable. This adapter simply exposes a
// small instance API around the pure recomputeVisibility(...) function.
export function createVisibilitySystem(options = {}) {
  const {
    // Optional hooks for pulling current player position
    getPlayerPos,
    // Optional override for providing state (if you later move off the imported singleton)
    getState,
  } = options;

  function recomputeForPlayer() {
    const st = typeof getState === 'function' ? getState() : state;
    const pos = typeof getPlayerPos === 'function'
      ? getPlayerPos(st)
      : (st?.explore?.playerPos || st?.playerPos || st?.player?.pos || null);

    if (!pos) return { bright: new Set(), dim: new Set() };
    return recomputeVisibility({ px: pos.x | 0, py: pos.y | 0 });
  }

  return {
    recomputeVisibility,
    recomputeForPlayer,
  };
}
