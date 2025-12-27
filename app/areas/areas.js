// NOTE: `areas.generated.js` is produced by tools/genAreasRegistry.mjs.
// On a fresh checkout / before the first generator run, it may not exist yet.
// We treat it as optional so the app + tooling can boot in a clean state.
const HAND_AREA_DATA = {};
let GENERATED_AREA_PROFILES = {};
try {
  const mod = await import("./areas.generated.js");
  GENERATED_AREA_PROFILES = mod?.default && typeof mod.default === "object" ? mod.default : {};
} catch {
  GENERATED_AREA_PROFILES = {};
}

// --------------------------------------------------------------------------
// MERGED EXPORT (generated defaults + hand-authored overrides)
// Hand-authored entries win on key collisions.
// --------------------------------------------------------------------------
export const AREA_DATA = {
  ...GENERATED_AREA_PROFILES,
  ...HAND_AREA_DATA,
};

export default AREA_DATA;


// Handy accessor
export function getAreaData(id) {
  return AREA_DATA[id] || null;
}