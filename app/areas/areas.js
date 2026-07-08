// Legacy generated area data has been retired with the old Tiled workflow.
// Keep the facade so older imports fail gracefully while new area design lands.
export const AREA_DATA = {};

export default AREA_DATA;


// Handy accessor
export function getAreaData(id) {
  return AREA_DATA[id] || null;
}
