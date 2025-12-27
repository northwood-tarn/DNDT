// app/areas/registry.js
// Paths are relative to the app root (no leading slash).

import GENERATED_AREAS from "./registry.generated.js";

// Hand-authored areas that are NOT generated from Ink
// (e.g. exploration maps, special scenes).
const STATIC_AREAS = {
  fields: {
    id: "fields",
    title: "Fields",
    kind: "exploration_map",
    assets: {
      tmj: "areas/00_fields/fields.tmj.json",
      image: "areas/00_fields/fields.png",
    },
  },
};

// Merge order:
// - Generated dialogue areas first (canonical narrative source)
// - Static areas override or extend if needed
export const AREAS = {
  ...GENERATED_AREAS,
  ...STATIC_AREAS,
};

export function getArea(id) {
  return AREAS[id] || null;
}

export const AREA_KEYS = Object.keys(AREAS);
