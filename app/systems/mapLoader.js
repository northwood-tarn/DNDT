// app/systems/mapLoader.js
// Minimal, schema-faithful loader for ExplorationMap JSON -> runtime-friendly structures.
// Non-destructive: does not mutate input JSON. No file IO here—pass the parsed JSON in.
//
// Usage (example):
//   import { fromJSON } from './mapLoader.js';
//   const map = fromJSON(shore1Json); // throws on invalid
//   // map.triggersByKey['20,9'] -> { x:20, y:9, type:'room', areaId:'dockside', entry:'end_of_pier' }

/** @typedef {{ x:number, y:number, text?:string }} Label */
/** @typedef {{ x:number, y:number, type:string, [k:string]: any }} Trigger */
/** @typedef {{
 *   id:string, title?:string, profile:'ExplorationMap',
 *   width:number, height:number,
 *   start:{x:number, y:number},
 *   minimap?: boolean,
 *   labels: Label[],
 *   triggers: Trigger[],
 *   triggersByKey: Record<string, Trigger>
 * }} ExplorationMap
 */

const REQUIRED_KEYS = ['id','profile','width','height','start'];
const PROFILE = 'ExplorationMap';

export function validateExplorationMap(json){
  const issues = [];

  if (!json || typeof json !== 'object'){
    issues.push('Input is not an object.');
    return { ok:false, issues };
  }

  // Required keys
  for (const k of REQUIRED_KEYS){
    if (!(k in json)) issues.push(`Missing key: ${k}`);
  }

  // Profile
  if (json.profile !== PROFILE){
    issues.push(`profile must be "${PROFILE}", got "${json.profile}"`);
  }

  // Dimensions
  const w = Number(json.width), h = Number(json.height);
  if (!Number.isInteger(w) || w <= 0) issues.push('width must be a positive integer.');
  if (!Number.isInteger(h) || h <= 0) issues.push('height must be a positive integer.');

  // Start
  const sx = Number(json?.start?.x), sy = Number(json?.start?.y);
  if (!Number.isInteger(sx) || !Number.isInteger(sy)) {
    issues.push('start.x/start.y must be integers.');
  } else {
    if (sx < 0 || sy < 0 || sx >= w || sy >= h){
      issues.push(`start (${sx},${sy}) is out of bounds 0..${w-1},0..${h-1}.`);
    }
  }

  // Labels
  if (json.labels !== undefined){
    if (!Array.isArray(json.labels)) issues.push('labels must be an array if present.');
  }

  // Triggers
  if (json.triggers !== undefined){
    if (!Array.isArray(json.triggers)) {
      issues.push('triggers must be an array if present.');
    } else {
      for (let i=0;i<json.triggers.length;i++){
        const t = json.triggers[i];
        if (typeof t !== 'object') { issues.push(`trigger[${i}] is not an object`); continue; }
        if (!Number.isInteger(t.x) || !Number.isInteger(t.y)) issues.push(`trigger[${i}] x/y must be integers.`);
        if (typeof t.type !== 'string' || !t.type) issues.push(`trigger[${i}] missing/invalid "type"`);
      }
    }
  }

  return { ok: issues.length === 0, issues };
}

export function indexTriggers(triggers = []){
  /** @type {Record<string, Trigger>} */
  const map = Object.create(null);
  for (const t of triggers){
    const key = `${t.x},${t.y}`;
    // Last write wins if duplicates
    map[key] = { ...t };
  }
  return map;
}

export function normalizeLabels(labels = []){
  const out = [];
  if (!Array.isArray(labels)) return out;
  for (const l of labels){
    if (!l) continue;
    const x = Number(l.x), y = Number(l.y);
    if (!Number.isInteger(x) || !Number.isInteger(y)) continue;
    const text = typeof l.text === 'string' ? l.text : undefined;
    out.push({ x, y, ...(text ? { text } : {}) });
  }
  return out;
}

export function normalizeTriggers(triggers = []){
  const out = [];
  if (!Array.isArray(triggers)) return out;
  for (const t of triggers){
    if (!t) continue;
    const x = Number(t.x), y = Number(t.y);
    const type = typeof t.type === 'string' ? t.type : null;
    if (!Number.isInteger(x) || !Number.isInteger(y) || !type) continue;
    // Preserve any extra fields (areaId, entry, treeId, etc.)
    const { x: _x, y: _y, type: _t, ...rest } = t;
    out.push({ x, y, type, ...rest });
  }
  return out;
}

/**
 * Convert validated JSON into an ExplorationMap runtime object.
 * Throws if validation fails.
 * @param {any} json
 * @returns {ExplorationMap}
 */
export function fromJSON(json){
  const v = validateExplorationMap(json);
  if (!v.ok){
    const msg = 'ExplorationMap validation failed:\\n - ' + v.issues.join('\\n - ');
    throw new Error(msg);
  }

  const width  = Number(json.width);
  const height = Number(json.height);
  const id     = String(json.id);
  const title  = json.title ? String(json.title) : undefined;
  const minimap = typeof json.minimap === 'boolean' ? json.minimap : undefined;
  const start = { x: Number(json.start.x), y: Number(json.start.y) };

  const labels   = normalizeLabels(json.labels || []);
  const triggers = normalizeTriggers(json.triggers || []);
  const triggersByKey = indexTriggers(triggers);

  return {
    id,
    title,
    profile: PROFILE,
    width,
    height,
    start,
    ...(minimap !== undefined ? { minimap } : {}),
    labels,
    triggers,
    triggersByKey
  };
}

// Optional helper: supply a dictionary of raw JSON blobs keyed by id
// and get a loader function you can hand to mapSystem.loadMap.
export function makeInMemoryLoader(rawById){
  return function loadMapById(id){
    const json = rawById[id];
    if (!json) throw new Error(`Map "${id}" not found in provided dictionary.`);
    return fromJSON(json);
  };
}

export default {
  validateExplorationMap,
  fromJSON,
  indexTriggers,
  normalizeLabels,
  normalizeTriggers,
  makeInMemoryLoader
};
