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
  try{
    const center = shell.center || document.getElementById('center');
    if (!center) return { cols: (getCamera().w|0)||21, rows: (getCamera().h|0)||13 };
    // Create a hidden probe row with many border glyphs to average width
    const BORDER_GLYPH = "\uE800";
    const wrap = document.createElement('div');
    wrap.style.visibility = 'hidden';
    wrap.style.position = 'absolute';
    wrap.style.left = '-9999px';
    wrap.style.top = '0';
    const span = document.createElement('span');
    span.className = 'cell';
    span.textContent = BORDER_GLYPH.repeat(80);
    wrap.appendChild(span);
    center.appendChild(wrap);
    const rect = span.getBoundingClientRect();
    wrap.remove();

    const cw = Math.max(6, Math.round(rect.width/80)) || 10;
    const ch = Math.max(10, Math.round(rect.height)) || 16;

    const r = center.getBoundingClientRect();
    const SAFETY = 1;
    let cols = Math.floor((r.width  - SAFETY)/cw) - padCols;
    let rows = Math.floor((r.height - SAFETY)/ch) - padRows;
    cols = Math.max(10, cols);
    rows = Math.max(8,  rows);
    return { cols, rows };
  } catch{
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
  try {
    const cam = getCamera();
    const { bright, dim } = recomputeVisibility({ px: state.player.x|0, py: state.player.y|0 });
    renderDOMMap(cam.w|0, cam.h|0, { x: state.player.x|0, y: state.player.y|0 }, {
      world: { width: state.map.width|0, height: state.map.height|0 },
      view: { x: cam.x|0, y: cam.y|0 },
      brightSet: bright, dimSet: dim
    });
    renderMinimap();
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
