// app/engine/viewportSizer.js
// Measure the center panel, fit camera.w/h to it, and clamp to the world.

import { shell } from '../renderer/shellMount.js';
import { state } from '../state/stateStore.js';

function measureCell() {
  // Use the SAME glyph the renderer uses for borders, not a space.
  const BORDER_GLYPH = "\uE800";

  const probeRow = document.createElement('div');
  const probe = document.createElement('span');
  probeRow.style.visibility = 'hidden';
  probeRow.style.position = 'absolute';
  probeRow.style.pointerEvents = 'none';

  probe.className = 'cell';
  probe.textContent = BORDER_GLYPH;

  probeRow.appendChild(probe);
  (shell.center || document.body).appendChild(probeRow);

  const rect = probe.getBoundingClientRect();
  probeRow.remove();

  // Guard rails: never return zero; round to integers
  const w = Math.max(6, Math.round(rect.width))  || 10;
  const h = Math.max(10, Math.round(rect.height)) || 16;
  return { w, h };
}

export function computeViewportSize(paddingCells = 2) {
  const center = shell.center || document.getElementById('center');
  if (!center) return { w: 21, h: 13 };
  const { w: cw, h: ch } = measureCell();
  const rect = center.getBoundingClientRect();
  const cols = Math.max(10, Math.floor(rect.width / cw) - paddingCells);
  const rows = Math.max(8, Math.floor(rect.height / ch) - paddingCells);
  return { w: cols, h: rows };
}

/**
 * Fit camera.w/h to the center panel, then CLAMP to world size,
 * and clamp camera.x/y into the valid range [0..W-w],[0..H-h].
 * This guarantees non-negative ranges so follow logic works.
 */
export function syncCameraToCenter(paddingCells = 2) {
  const sz = computeViewportSize(paddingCells);

  // Ensure we have world dims
  const W = (state?.map?.width  | 0) || 1;
  const H = (state?.map?.height | 0) || 1;

  // Clamp viewport to world
  const vw = Math.max(10, Math.min(sz.w | 0, W));
  const vh = Math.max(8, Math.min(sz.h | 0, H));

  // Merge into camera + clamp position
  state.explore = state.explore || {};
  const prev = state.explore.camera || { x: 0, y: 0, w: 21, h: 13 };
  const maxX = Math.max(0, W - vw);
  const maxY = Math.max(0, H - vh);

  const x = Math.max(0, Math.min(maxX, prev.x | 0));
  const y = Math.max(0, Math.min(maxY, prev.y | 0));

  state.explore.camera = { x, y, w: vw, h: vh };
  return state.explore.camera;
}

/** Debounced resize; caller can re-render after this updates camera.w/h */
export function attachResizeSync(handler) {
  let raf = 0;
  const onResize = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => handler && handler());
  };
  window.addEventListener('resize', onResize);
  return () => window.removeEventListener('resize', onResize);
}