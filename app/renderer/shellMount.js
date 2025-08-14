// app/renderer/shellMount.js
// Provides stable references to shell regions and helpers to mount/unmount scene content.
// Also ensures a #messageLog element exists for existing logging code to keep working.
// Cog system fully removed: if a cog button exists in the DOM, this module deletes it
// and keeps it deleted even if the top bar is rebuilt.

export const shell = {
  top: document.getElementById('topBar'),
  left: document.getElementById('left'),
  center: document.getElementById('center'),
  right: document.getElementById('right'),
  bottom: document.getElementById('bottomLog'),
  log: document.getElementById('messageLog'),
  map: document.getElementById('asciiMap'),
};

function clear(el) { if (!el) return; while (el.firstChild) el.removeChild(el.firstChild); }

export function mountCenter(node) { clear(shell.center); shell.center.appendChild(node); }
export function mountRight(node)  { clear(shell.right);  shell.right.appendChild(node); }
export function mountLeft(node)   { clear(shell.left);   shell.left.appendChild(node); }

// Delete any cog button and keep it gone
function removeCog() {
  const cand = document.getElementById('cogBtn') ||
               (shell.top && shell.top.querySelector?.('.cog, #cog, button[aria-label="Settings"]'));
  if (cand && cand.parentNode) {
    try { cand.remove(); } catch { cand.parentNode.removeChild(cand); }
  }
}

export function setTop(text) {
  if (shell.top) {
    shell.top.textContent = text ?? '';
    removeCog();
  }
}

export function clearRight()  { clear(shell.right); }
export function clearCenter() { clear(shell.center); }
export function clearLeft()   { clear(shell.left); }

// Simple ASCII map render helper
export function renderAsciiMap(text) {
  if (!shell.map || !document.body.contains(shell.map)) { ensureAsciiMapHost(); }
  shell.map.textContent = text || '';
}

// Ensure messageLog exists for existing modules
if (!shell.log) {
  const div = document.createElement('div');
  div.id = 'messageLog';
  div.className = 'log';
  shell.bottom?.appendChild(div);
  shell.log = div;
}

// Immediately remove any existing cog and observe future changes on the top bar
removeCog();
try {
  if (shell.top) {
    const obs = new MutationObserver(() => removeCog());
    obs.observe(shell.top, { childList: true, subtree: true });
  }
} catch {}


function ensureAsciiMapHost() {
  let el = shell.map;
  // If we had captured a node before but it was removed by clearCenter(), drop it
  if (el && !document.body.contains(el)) {
    el = null;
  }
  if (!el) {
    el = document.createElement('pre');
    el.id = 'asciiMap';
    // minimal inline styles in case CSS isn't loaded yet
    el.style.margin = '0';
    el.style.font = '14px/1.05 var(--mono)';
    el.style.color = '#cfd8e6';
    shell.map = el;
  }
  if (shell.center && el.parentNode !== shell.center) {
    try { shell.center.appendChild(el); } catch {}
  }
  return el;
}
/* ===== Presentation Profiles (ultra-thin) ===== */
function setAsciiMapVisible(show) {
  if (!shell.map) return;
  try {
    shell.map.style.display = show ? 'block' : 'none';
  } catch {}
}

function clearAllPanes() {
  clearLeft(); clearCenter(); clearRight();
}

export function SetProfileExplorationMap(opts = {}) {
  clearAllPanes();
  // Ensure the ASCII map host exists and is attached to the center pane
  ensureAsciiMapHost();
  setTop(opts.title || 'Exploration');
  setAsciiMapVisible(true);
}

export function SetProfileCombatMap(opts = {}) {
  clearAllPanes();
  setTop(opts.title || 'Combat');
  setAsciiMapVisible(true);
}

export function SetProfileDialog(opts = {}) {
  clearAllPanes();
  setTop(opts.title || 'Dialogue');
  setAsciiMapVisible(false);
}

export function SetProfileExplorationDialog(opts = {}) {
  clearAllPanes();
  setTop(opts.title || 'Exploration (Interior)');
  setAsciiMapVisible(false);
}

// ---- Lanterna HUD chip (tiny) ----
let lanternaChipEl = null;
export function setLanternaChip(state){
  // state: { lit: boolean, oil: minutes }
  if (!shell.left) return;
  if (!lanternaChipEl){
    lanternaChipEl = document.createElement('div');
    lanternaChipEl.style.display = 'inline-flex';
    lanternaChipEl.style.gap = '6px';
    lanternaChipEl.style.alignItems = 'center';
    lanternaChipEl.style.fontSize = '12px';
    lanternaChipEl.style.border = '1px solid var(--line, #333)';
    lanternaChipEl.style.borderRadius = '999px';
    lanternaChipEl.style.padding = '2px 8px';
    lanternaChipEl.style.marginBottom = '6px';
    shell.left.appendChild(lanternaChipEl);
  }
  const oil = Math.max(0, Math.floor(state?.oil ?? 0));
  const lit = !!(state && state.lit);

  const hrs = Math.floor(oil / 60);
  const mins = oil % 60;
  const oilStr = hrs >= 1
    ? `${hrs}h ${String(mins).padStart(2, '0')}m`
    : `${mins}m`;

  lanternaChipEl.textContent = `Lanterna: ${lit ? 'ON' : 'OFF'} - ${oilStr}`;
}
