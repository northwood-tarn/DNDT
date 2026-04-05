// app/systems/emberSystem.js
// Discovery + menu for Embers: named fast-travel beacons + long rest/save/inventory.
// Minimal UI implemented with the existing shell + logSystem; key handling inside caller scene.
import { logSystem } from "../engine/log.js";
import { state } from "../state/stateStore.js";

function key(x,y){ return `${x},${y}`; }

export function ensureArea(areaId){
  if (!state.embers) state.embers = {};
  if (!state.embers[areaId]) state.embers[areaId] = new Map();
  return state.embers[areaId];
}

export function discoverEmber(areaId, ember){
  // ember: { id, name, x, y }
  const m = ensureArea(areaId);
  m.set(ember.id, { name: ember.name, x: ember.x, y: ember.y });
  logSystem(`An ember marks this place: ${ember.name}.`);
}

export function listDiscovered(areaId){
  const m = ensureArea(areaId);
  return Array.from(m.entries()).map(([id, e]) => ({ id, ...e }));
}

export function findEmber(areaId, id){
  const m = ensureArea(areaId);
  return m.get(id) || null;
}

// Choose an adjacent landing tile next to an ember; prefers south, then east, west, north.
export function pickLanding(ember, W=40, H=18){
  const candidates = [
    { x: ember.x, y: ember.y+1 },
    { x: ember.x+1, y: ember.y },
    { x: ember.x-1, y: ember.y },
    { x: ember.x, y: ember.y-1 }
  ];
  // Clamp to bounds; we don't have collision here, so caller can refine later.
  for (const c of candidates){
    c.x = Math.max(1, Math.min(W-2, c.x));
    c.y = Math.max(1, Math.min(H-2, c.y));
  }
  return candidates[0];
}

// Build a numbered list menu model; caller renders and handles keys.
export function buildEmberMenu(areaId, currentId){
  const entries = listDiscovered(areaId);
  const here = entries.find(e => e.id === currentId);
  const others = entries.filter(e => e.id !== currentId);
  const items = [];
  items.push({ id: "rest", label: "Take a long rest" });
  items.push({ id: "inventory", label: "Use items from your inventory" });
  items.push({ id: "save", label: "Save game" });
  items.push({ id: "load", label: "Load game" });
  if (others.length){
    items.push({ id: "travel", label: "Fast travel to another ember" });
  }
  items.push({ id: "leave", label: "Leave the ember" });
  return { here, others, items };
}
