// app/areas/index.js
// Facade over the registry, exporting both getArea (canonical) and GetArea (compat).

import { AREAS, getArea as _getArea } from "./registry.js";

export const DEFAULT_AREA_ID = "dockside";

export function getArea(id) {
  return _getArea(id);
}

// Compatibility: some older code imports { GetArea } with a capital G.
export function GetArea(id) {
  return _getArea(id);
}

// Legacy helper kept for older callers; prefer getArea() directly.
export function loadArea(areaId){
  return _getArea(areaId) || _getArea(DEFAULT_AREA_ID);
}

export { AREAS };
