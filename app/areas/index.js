// app/areas/index.js
// Facade over the registry, exporting both getArea (canonical) and GetArea (compat).
//
// Canonical Area contract extension:
//   area.scale.ftPerTile
//
// Defaults (by area.kind):
//   - exploration_map => 10
//   - combat          => 5
//
// Rendering stays unitless; this value is for gameplay semantics (movement/range/AoE/UI).

import { AREAS, getArea as _getArea } from "./registry.js";

export const DEFAULT_AREA_ID = "dockside";

function applyAreaDefaults(area) {
  if (!area) return area;

  // Ensure nested scale object exists.
  const kind = area.kind;
  const scale = area.scale && typeof area.scale === "object" ? area.scale : {};

  // Default ftPerTile by kind.
  let ftPerTile = scale.ftPerTile;
  if (ftPerTile === undefined || ftPerTile === null || ftPerTile === "") {
    if (kind === "combat") ftPerTile = 5;
    else if (kind === "exploration_map") ftPerTile = 10;
  }

  // Validate if present.
  if (ftPerTile !== undefined) {
    const n = Number(ftPerTile);
    if (!Number.isFinite(n) || n <= 0) {
      console.error("[areas] Invalid scale.ftPerTile for area:", area.id || "(unknown)", "value=", ftPerTile);
    } else {
      ftPerTile = n;
    }
  }

  // Return a shallow copy to avoid mutating the registry source.
  return {
    ...area,
    scale: {
      ...scale,
      ...(ftPerTile !== undefined ? { ftPerTile } : {})
    }
  };
}

export function getArea(id) {
  return applyAreaDefaults(_getArea(id));
}

// Compatibility: some older code imports { GetArea } with a capital G.
export function GetArea(id) {
  return applyAreaDefaults(_getArea(id));
}

// Legacy helper kept for older callers; prefer getArea() directly.
export function loadArea(areaId){
  return applyAreaDefaults(_getArea(areaId) || _getArea(DEFAULT_AREA_ID));
}

export { AREAS };
