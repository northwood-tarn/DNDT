// app/systems/lightingRules.js
// Derives visibility (bright/dim tiles) from environment lighting and lanterna state.
// Also exposes a simple stealth/detection modifier hook.
const FEET_PER_TILE = 5;
const LANTERNA_BRIGHT_FT = 30;
const LANTERNA_DIM_FT = 30;

const LANTERNA_BRIGHT_TILES = Math.floor(LANTERNA_BRIGHT_FT / FEET_PER_TILE); // 6
const LANTERNA_DIM_TILES = Math.floor(LANTERNA_DIM_FT / FEET_PER_TILE);       // +6

function maxVis(a, b){
  return {
    brightTiles: Math.max(a.brightTiles, b.brightTiles),
    dimTiles: Math.max(a.dimTiles, b.dimTiles),
  };
}

export function getVisibility({ env='bright', lanterna={ lit:false, oil:0 } } = {}){
  const e = String(env).toLowerCase();
  const hasLanterna = !!(lanterna && lanterna.lit && lanterna.oil > 0);
  const hasLightSpell = (typeof state !== "undefined" && state?.effects && state.effects.light === true);
  const hasAnyLight = hasLanterna || hasLightSpell;

  let base;
  if (e === 'daylight'){
    base = { brightTiles: 18, dimTiles: 2 }; // 90 ft bright + 10 ft dim
  } else if (e === 'bright'){
    base = { brightTiles: 6, dimTiles: 6 };
  } else if (e === 'dim'){
    base = { brightTiles: 0, dimTiles: 6 };
  } else {
    base = { brightTiles: 0, dimTiles: 1 }; // dark
  }

  const lightVis = hasAnyLight
    ? { brightTiles: LANTERNA_BRIGHT_TILES, dimTiles: LANTERNA_DIM_TILES }
    : { brightTiles: 0, dimTiles: 0 };

  return maxVis(base, lightVis);
}

// Simple detection multiplier: being lit in dim/dark makes you easier to spot.
export function getDetectionMultiplier({ env='bright', lanternaLit=false } = {}){
  const e = String(env).toLowerCase();
  const spellLit = (typeof state !== 'undefined' && state?.effects && state.effects.light === true);
  const lit = lanternaLit || spellLit;
  if (e === 'dark' && lit) return 2.0;
  if (e === 'dim' && lit) return 1.5;
  return 1.0;
}


// Adapter: stable API for scenes
export function getPlayerVisibility(env, lanterna){
  return getVisibility({ env, lanterna });
}
