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
 * - exploration_map areas MUST define assets.map or assets.image
 * - dialogue areas MUST define assets.ink
 * - This contract is enforced conceptually here and programmatically elsewhere
 */

// No legacy area records are registered here. The old Tiled/compiled-Ink
// dockside prototype has been archived under app/docs/archive for reference.
export const AREAS = {};

export function getArea(id) {
  return AREAS[id] || null;
}

export const AREA_KEYS = Object.keys(AREAS);

export default AREAS;
