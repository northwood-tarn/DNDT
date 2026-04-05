// app/areas/registry.js
// Paths are relative to the app root (no leading slash).

/**
 * CANONICAL AREA CONTRACT
 * -----------------------
 * All Areas in the game MUST conform to this shape.
 * This file is the authoritative registry for runtime Area data.
 *
 * interface Area {
 *   id: string;                         // Stable identifier (used everywhere)
 *   kind: "dialogue" | "exploration_map" | "combat" | "system_cutscene";
 *   title: string;                      // Human-facing title
 *
 *   // Optional narrative / UI metadata
 *   actTitle?: string;
 *   timeLabel?: string;
 *   weatherLabel?: string;
 *
 *   // All external resources live here — no top-level shortcuts.
 *   assets: {
 *     ink?: string;                     // Dialogue scenes
 *     tmj?: string;                     // Tiled exploration maps
 *     map?: string;                     // Future non-Tiled maps
 *     image?: string;                   // Static backgrounds / cutscenes
 *   };
 *
 *   // Optional gameplay hooks
 *   encounters?: string[];
 * }
 *
 * RULES:
 * - Scenes and systems MUST access assets via area.assets.*
 * - No scene may assume a field exists outside this contract
 * - exploration_map areas MUST define assets.tmj
 * - dialogue areas MUST define assets.ink
 * - This contract is enforced conceptually here and programmatically elsewhere
 */

import GENERATED_AREAS from "./registry.generated.js";

// Hand-authored areas that are NOT generated from Ink
// (e.g. exploration maps, special scenes).
const STATIC_AREAS = {
  fields: {
    id: "fields",
    title: "Fields",
    kind: "exploration_map",
    assets: {
      tmj: "areas/00_docks/fields.tmj",
      image: "areas/00_docks/map.png",
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
