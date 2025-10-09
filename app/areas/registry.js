// app/areas/registry.js
// Paths are relative to the app root (no leading slash).

export const AREAS = {
  "00_fields": {
    id: "00_fields",
    title: "Fields",
    kind: "exploration_map",
    assets: {
      tmj: "areas/00_fields/fields.tmj.json",
      image: "areas/00_fields/fields.png"
    }
  },
  "00_dockside": {
    id: "dockside",
    title: "Dockside (Night Rain)",
    kind: "dialogue_area",
    profile: "DialogExplore",
    script: "./areas/00_dockside/dockside.json"
  }
};

export function getArea(id) {
  if (AREAS[id]) return AREAS[id];
  const hit = Object.values(AREAS).find(a => a.id === id);
  return hit || null;
}

export const AREA_KEYS = Object.keys(AREAS);
