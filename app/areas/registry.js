// app/areas/registry.js
// Canonical area registry — KEYS MATCH FOLDER NAMES (with numeric prefixes).
// Use these IDs everywhere: start.js, encounters, returnAreaId, scene args, etc.

export const AREAS = {
  "00_fields": {
    tmj: "/app/areas/00_fields/fields.tmj.json",
    image: "/app/areas/00_fields/fields.png"
  },
  "00_dockside": {
    tmj: "/app/areas/00_dockside/dockside.tmj.json",
    image: "/app/areas/00_dockside/dockside.png"
  }
};

// Simple accessor; returns null if missing (callers should handle the null).
export function getArea(id) {
  return AREAS[id] || null;
}

// Optional export if anyone needs to inspect valid keys.
export const AREA_KEYS = Object.keys(AREAS);
