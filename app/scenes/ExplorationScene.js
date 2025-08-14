// app/scenes/ExplorationScene.js
// Free-roam exploration that plays nice with menu/dialog scenes.
// Guarded listeners, no JSON asserts/imports, no digit-key handling.

import { sceneManager } from '../engine/sceneManager.js';
import { shell } from '../renderer/shellMount.js';
import { state } from '../state/stateStore.js';
import { initExploreForMap, setEnv } from '../systems/mapSystem.js';
import { renderDOMMap } from '../renderer/domMapRenderer.js';
import { recomputeVisibility } from '../systems/visibilitySystem.js';
import { getCamera, centerOn } from '../engine/camera.js';
// Optional setters (one may not exist in older builds)
import { setViewportSize, setCamera } from '../engine/camera.js';
import { renderMinimap } from '../renderer/minimapRenderer.js';
import { logSystem } from '../engine/log.js';
import { setTopbarFromArea, enableDefaultTopbarMenu, ensureDefaults } from '../ui/topbar.js';
import { loadArea } from '../areas/index.js';

let keyHandler = null;
let hoverHandler = null;
let active = false;

// Measure how many columns/rows fit in the center pane using the same glyph width.


function __measureViewportCells(padCols=1, padRows=1){
  try {
    const center = shell.center || document.getElementById('center');
    if (!center) return { cols: (getCamera().w|0)||21, rows: (getCamera().h|0)||13 };

    // Build a probe that matches the real renderer structure exactly.
    const BORDER_GLYPH = "\uE800";
    const probeHost = document.createElement('div');
    probeHost.style.position = 'absolute';
    probeHost.style.left = '-9999px';
    probeHost.style.top = '0';
    probeHost.style.visibility = 'hidden';

    const row = document.createElement('div');
    row.className = 'row';
    row.style.whiteSpace = 'nowrap';

    const cell = document.createElement('span');
    cell.className = 'cell';
    cell.textContent = BORDER_GLYPH;

    row.appendChild(cell);
    probeHost.appendChild(row);
    center.appendChild(probeHost);

    // Measure the actual row and cell sizes the browser will use.
    const rowH = Math.max(1, row.offsetHeight);
    const cellW = Math.max(1, cell.getBoundingClientRect().width);

    // Clean up probe.
    probeHost.remove();

    // Compute how many rows/cols fit in the visible center pane.
    // clientWidth/Height include padding but exclude borders & scrollbars — good enough here.
    const SAFETY = 2; // shave tiny buffer to avoid accidental overflow
    let cols = Math.floor((center.clientWidth  - SAFETY) / cellW) - (padCols|0);
    let rows = Math.floor((center.clientHeight - SAFETY) / rowH ) - (padRows|0);

    cols = Math.max(10, cols|0);
    rows = Math.max(8,  rows|0);
    return { cols, rows };
  } catch {
    const cam = getCamera();
    return { cols: cam.w|0 || 21, rows: cam.h|0 || 13 };
  }
}

function __lockTopbarToArea() {
  try {
    const area = loadArea(state.map?.id || 'fields');
    setTopbarFromArea(area?.meta || area?.META || area);
    enableDefaultTopbarMenu(); // idempotent
  } catch {}
  // Guard: if someone clears the topbar nodes, re-apply defaults once.
  try {
    const top = document.getElementById('topBar') || (shell.top);
    if (!top) return;
    const mo = new MutationObserver(() => {
      // if menu vanished, restore defaults
      const right = top.querySelector('.topbar-right');
      if (!right || right.children.length === 0) {
        try { ensureDefaults(); } catch {}
      }
    });
    mo.observe(top, { childList: true, subtree: true });
    // store to state so we can disconnect on cleanup if desired
    state.__topbarObserver = mo;
  } catch {}
}

function safeRender(){
  __clampCameraToWorld();
  try {
    const cam = getCamera();
    const { bright, dim } = recomputeVisibility({ px: state.player.x|0, py: state.player.y|0 });
    renderDOMMap(cam.w|0, cam.h|0, { x: state.player.x|0, y: state.player.y|0 }, {
      world: { width: state.map.width|0, height: state.map.height|0 },
      view: { x: cam.x|0, y: cam.y|0 },
      brightSet: bright, dimSet: dim
    });
    renderMinimap();
    // Post-render fit: shrink rows/cols until host fits center pane (prevents vertical clipping)
    try {
      const center = shell.center || document.getElementById('center');
      const host = shell.map || document.getElementById('asciiMap');
      if (center && host) {
        const camNow = getCamera();
        let guard = 8; // avoid infinite loops
        // Vertical fit
        while (host.scrollHeight > host.clientHeight && (camNow.h|0) > 8 && guard-- > 0) {
          if (typeof setViewportSize === 'function') {
            setViewportSize(camNow.w|0, (camNow.h|0)-1, state.map.width|0, state.map.height|0);
          } else if (typeof setCamera === 'function') {
            camNow.h = (camNow.h|0) - 1;
            setCamera(camNow);
          }
          // re-render with smaller height
          const { bright: _b, dim: _d } = recomputeVisibility({ px: state.player.x|0, py: state.player.y|0 });
          renderDOMMap(camNow.w|0, camNow.h|0, { x: state.player.x|0, y: state.player.y|0 }, {
            world: { width: state.map.width|0, height: state.map.height|0 },
            view: { x: camNow.x|0, y: camNow.y|0 },
            brightSet: _b, dimSet: _d
          });
        }
        // Horizontal fit (rare with hidden overflow, but keep symmetric)
        guard = 8;
        while (host.scrollWidth > host.clientWidth && (camNow.w|0) > 10 && guard-- > 0) {
          if (typeof setViewportSize === 'function') {
            setViewportSize((camNow.w|0)-1, camNow.h|0, state.map.width|0, state.map.height|0);
          } else if (typeof setCamera === 'function') {
            camNow.w = (camNow.w|0) - 1;
            setCamera(camNow);
          }
          const { bright: _b2, dim: _d2 } = recomputeVisibility({ px: state.player.x|0, py: state.player.y|0 });
          renderDOMMap(camNow.w|0, camNow.h|0, { x: state.player.x|0, y: state.player.y|0 }, {
            world: { width: state.map.width|0, height: state.map.height|0 },
            view: { x: camNow.x|0, y: camNow.y|0 },
            brightSet: _b2, dimSet: _d2
          });
        }
      }
    } catch {}

  try { logSystem(`Cam x=${cam.x}, y=${cam.y}, w=${cam.w}, h=${cam.h} | Player x=${state.player.x}, y=${state.player.y} | Map ${state.map.width}x${state.map.height}`); } catch {}

  } catch(err){
    console.error('ExplorationScene render error:', err);
    try { logSystem('Exploration render error: ' + (err?.message||err)); } catch{}
  }
}

function move(dx, dy){
  if (!active) return;
  const W = state.map.width|0, H = state.map.height|0;
  if (W<=0 || H<=0) return;
  const nx = Math.max(1, Math.min(W-2, (state.player.x|0) + dx));
  const ny = Math.max(1, Math.min(H-2, (state.player.y|0) + dy));
  if (nx === state.player.x && ny === state.player.y) return;
  state.player.x = nx; state.player.y = ny;
  centerOn(nx, ny, W, H);
  safeRender();
}

function handleKeys(ev){
  if (!active) return;
  // DO NOT touch digits; only handle movement + F1/F2/F3
  try {
    if (ev.key === 'ArrowLeft' || ev.key === 'a') { move(-1, 0); }
    else if (ev.key === 'ArrowRight' || ev.key === 'd') { move(+1, 0); }
    else if (ev.key === 'ArrowUp' || ev.key === 'w') { move(0, -1); }
    else if (ev.key === 'ArrowDown' || ev.key === 's') { move(0, +1); }
    else if (ev.key === 'F1') { setEnv('dark'); logSystem('Env=dark'); safeRender(); }
    else if (ev.key === 'F2') { setEnv('dim'); logSystem('Env=dim'); safeRender(); }
    else if (ev.key === 'F3') { setEnv('bright'); logSystem('Env=bright'); safeRender(); }
  } catch(err){
    console.error('ExplorationScene key handler error:', err);
  }
}

export default {
  async start(){
    // Mark active early; if anything fails, we will flip it off in catch.
    active = true;
    try {
      // Prepare shell panels but do not wipe global UI outside center/right.
      shell.left.innerHTML = '<b>Explore</b><br><small>WASD/Arrows. F1/F2/F3 env.</small>';
      __lockTopbarToArea();
      shell.right.innerHTML = ''; // minimap will mount here

      // Ensure map metadata present (Fields should have set this; otherwise fallback tiny map)
      const W = state.map?.width|0, H = state.map?.height|0;
      if (!W || !H) {
        initExploreForMap({ width: 40, height: 24, env: state?.explore?.env || 'dim' });
        state.map = { id: state.map?.id || 'fallback', width: 40, height: 24 };
      } else {
        initExploreForMap({ width: W, height: H, env: state?.explore?.env || 'dim' });
      }

      // Spawn clamp (use existing pos if any)
      state.player.x = Math.min(Math.max(1, state.player?.x|0 || 5), (state.map.width|0)-2);
      state.player.y = Math.min(Math.max(1, state.player?.y|0 || 5), (state.map.height|0)-2);
      
      // Fit camera viewport to actual center pane (cells), then recentre
      try {
        const { cols, rows } = __measureViewportCells(1,1);
        const Ww = state.map.width|0, Hh = state.map.height|0;
        if (typeof setViewportSize === 'function') {
          setViewportSize(cols, rows, Ww, Hh);
        } else if (typeof setCamera === 'function') {
          const camTmp = getCamera();
          camTmp.w = Math.min(cols, Ww); 
          camTmp.h = Math.min(rows, Hh);
          setCamera(camTmp);
        }
        centerOn(state.player.x|0, state.player.y|0, Ww, Hh);
        __clampCameraToWorld();
      } catch {}
      
      // Initial render
      safeRender();

      // Bind handlers (guarded by 'active')
      keyHandler = handleKeys;
      window.addEventListener('keydown', keyHandler, false);

      hoverHandler = (e)=>{
        if (!active) return;
        const d = e?.detail;
        if (!d) return;
        shell.left.innerHTML = `<b>Explore</b><br><small>(${d.x},${d.y}) • Env=${state?.explore?.env}</small>`;
      };
      window.addEventListener('map:hover', hoverHandler, false);

      // Keep viewport sized to center pane on window resize
      window.addEventListener('resize', () => {
        try {
          const { cols, rows } = __measureViewportCells(1,1);
          const Ww = state.map.width|0, Hh = state.map.height|0;
          if (typeof setViewportSize === 'function') {
            setViewportSize(cols, rows, Ww, Hh);
          } else if (typeof setCamera === 'function') {
            const camTmp = getCamera();
            camTmp.w = Math.min(cols, Ww); 
            camTmp.h = Math.min(rows, Hh);
            setCamera(camTmp);
          }
          centerOn(state.player.x|0, state.player.y|0, Ww, Hh);
        __clampCameraToWorld();
          safeRender();
        } catch {}
      }, false);
    } catch (err) {
      active = false;
      console.error('ExplorationScene start failed:', err);
      try { logSystem('Exploration start failed: ' + (err?.message||err)); } catch{}
      // Attempt to exit cleanly to avoid trapping input
      try { window.removeEventListener('keydown', keyHandler); } catch{}
      try { window.removeEventListener('map:hover', hoverHandler); } catch{}
      // Optionally return to previous scene:
      // sceneManager.replace(previousScene);
    }
  },
  cleanup(){
    active = false;
    try { window.removeEventListener('keydown', keyHandler); } catch {}
    try { window.removeEventListener('map:hover', hoverHandler); } catch {}
    try { state.__topbarObserver && state.__topbarObserver.disconnect && state.__topbarObserver.disconnect(); } catch {}
  }
};

function __clampCameraToWorld(){
  try {
    const cam = getCamera();
    const W = state.map?.width|0, H = state.map?.height|0;
    if (!cam || !W || !H) return;
    const maxX = Math.max(0, (W|0) - (cam.w|0));
    const maxY = Math.max(0, (H|0) - (cam.h|0));
    let changed = false;
    if (cam.x < 0) { cam.x = 0; changed = true; }
    if (cam.y < 0) { cam.y = 0; changed = true; }
    if (cam.x > maxX) { cam.x = maxX; changed = true; }
    if (cam.y > maxY) { cam.y = maxY; changed = true; }
    if (changed && typeof setCamera === 'function') setCamera(cam);
  } catch {}
}
