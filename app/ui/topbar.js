// app/ui/topbar.js
// Modular top bar controller: shows area/title on the left, a functional menu on the right.
// Scenes should call:
//   import { setTopbarFromArea, enableDefaultTopbarMenu } from '../ui/topbar.js';
//   setTopbarFromArea(areaMetaOrPack);
//   enableDefaultTopbarMenu();  // once per scene start (idempotent)
//
// Menu items dispatch CustomEvents: 'menu:map', 'menu:inventory', 'menu:load', 'menu:save', 'menu:exit'.
// Stubs: we also log via logSystem so there's visible feedback.

import { shell } from '../renderer/shellMount.js';
import { logSystem } from '../engine/log.js';

function ensureTopbar() {
  let top = shell.top || document.getElementById('topBar');
  if (!top) {
    // Create a minimal top bar if it doesn't exist
    top = document.createElement('div');
    top.id = 'topBar';
    document.body.prepend(top);
  }
  top.classList.add('topbar');

  // If we previously used plain textContent, replace with structured nodes
  let left = top.querySelector('.topbar-left');
  let right = top.querySelector('.topbar-right');
  if (!left || !right) {
    top.innerHTML = '';
    top.style.display = 'flex';
    top.style.alignItems = 'center';
    top.style.justifyContent = 'space-between';
    top.style.padding = '4px 8px';
    top.style.borderBottom = '1px solid var(--line, #333)';

    left = document.createElement('div');
    left.className = 'topbar-left';
    left.style.fontWeight = '600';
    left.style.whiteSpace = 'nowrap';

    right = document.createElement('div');
    right.className = 'topbar-right';
    right.style.display = 'inline-flex';
    right.style.gap = '10px';
    right.style.alignItems = 'center';

    top.appendChild(left);
    top.appendChild(right);
  }
  return { top, left: top.querySelector('.topbar-left'), right: top.querySelector('.topbar-right') };
}

export function setTopbarTitle(text) {
  const { left } = ensureTopbar();
  left.textContent = text ?? '';
}

export function setTopbarMenu(items) {
  const { right } = ensureTopbar();
  right.innerHTML = '';
  const mkBtn = (id, label, onClick) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.dataset.menuId = id;
    b.style.fontSize = '12px';
    b.style.padding = '2px 8px';
    b.style.border = '1px solid var(--line, #333)';
    b.style.borderRadius = '6px';
    b.style.background = 'transparent';
    b.style.color = 'inherit';
    b.style.cursor = 'pointer';
    b.onclick = (ev)=>{ try { onClick?.(ev); } catch(e) {} };
    return b;
  };

  for (const it of items) {
    right.appendChild(mkBtn(it.id, it.label, it.onClick));
  }
}

export function setTopbarFromArea(areaOrMeta) {
  // The area pack may look like { META: {...} } or export FIELDS_META etc.
  const meta =
    areaOrMeta?.META || // some packs use META
    areaOrMeta?.meta ||
    areaOrMeta;

  const title = meta?.title || meta?.name || 'Unknown Area';
  setTopbarTitle(title);
}

let defaultsEnabled = false;
export function enableDefaultTopbarMenu() {
  if (defaultsEnabled) return;
  defaultsEnabled = true;

  const fire = (name) => {
    const ev = new CustomEvent(`menu:${name}`, { detail: { source: 'topbar' } });
    window.dispatchEvent(ev);
    logSystem(`[MENU] ${name} clicked (stub).`);
  };

  setTopbarMenu([
    { id: 'map',       label: 'Map',        onClick: ()=>fire('map') },
    { id: 'inventory', label: 'Inventory',  onClick: ()=>fire('inventory') },
    { id: 'load',      label: 'Load',       onClick: ()=>fire('load') },
    { id: 'save',      label: 'Save',       onClick: ()=>fire('save') },
    { id: 'exit',      label: 'Exit',       onClick: ()=>fire('exit') },
  ]);
}

// Optional: allow scenes to re-run defaults if the bar was cleared
export function ensureDefaults() {
  defaultsEnabled = false;
  enableDefaultTopbarMenu();
}
