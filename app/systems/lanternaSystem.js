// app/systems/lanternaSystem.js
// Lanterna (player's starting lantern) with oil fuel, auto on/off by environment, and manual override.
//
// Design rules per spec:
// - Every PC starts with a Lanterna (not consumable). Resource is lantern oil (minutes of burn).
// - Auto ON when entering DARK if off (log once). Auto OFF when entering BRIGHT if on (log once).
// - Auto triggers only when lighting category changes; player can manually override via UI button.
//   Manual override remains until the NEXT environment lighting change.
// - Visibility when lit: 30 ft bright + 30 ft dim (tile conversion handled in lightingRules).
// - With Lanterna OFF in DARK: player sees self clearly and 1 tile dimly around (very risky).
// - Oil is consumed only by exploration-time minutes (frozen during combat).
//
// Public API:
//   initLanterna({ startOilMinutes=60 }?)
//   getLanterna() -> { lit, oil, autoEnabled, lastEnv }
//   lightLanterna(manual=false), extinguishLanterna(manual=false), toggleLanterna()
//   addOil(minutes), setOil(minutes)
//   onEnvironmentLightChange(env: 'bright'|'dim'|'dark', logger=console.log)
//
import { addListener, removeListener, getTime } from "./timeSystem.js";
function formatHours(mins){ const h = Math.max(0, mins)/60; const r=Math.round(h*10)/10; return (Math.abs(r - Math.round(r))<1e-6)? String(Math.round(r)) : String(r); }
import { logSystem } from "../engine/log.js";

const DEFAULT_OIL = 60; // minutes per fresh fill; tune via initLanterna
let state = {
  lit: false,
  oil: DEFAULT_OIL,
  autoEnabled: true,          // auto on/off active unless manually overridden
  manualOverride: false,
  paused:false,      // set when user toggles; cleared on next env change
  lastEnv: null,              // 'bright' | 'dim' | 'dark'
  subscribed: false
};

function onMinutesAdvanced(minAdded){
  if (!state.lit) return;
  if (state.paused) return;
  // Only exploration minutes call this listener; combat minutes never arrive here.
  state.oil = Math.max(0, state.oil - minAdded);
  if (state.oil === 0 && state.lit){
    state.lit = false;
    const envNow = (state.lastEnv||"bright").toLowerCase();
    if (envNow === "dark"){
      logSystem("The last of the oil in your lanterna is spent. You are plunged into darkness.");
    } else if (envNow === "dim"){
      logSystem("Your lanterna flickers out; your eyes strain to see through the gloom.");
    } else {
      logSystem("Your lanterna gutters out — the oil is spent.");
    }
  }
}

export function initLanterna(opts={}){
  const start = Math.max(0, Math.floor(opts.startOilMinutes ?? DEFAULT_OIL));
  state.oil = start;
  state.lit = false;
  state.autoEnabled = true;
  state.manualOverride = false;
  state.lastEnv = null;
  if (!state.subscribed){
    addListener(onMinutesAdvanced);
    state.subscribed = true;
  }
}

export function getLanterna(){ return { lit: state.lit, oil: state.oil, autoEnabled: state.autoEnabled, lastEnv: state.lastEnv }; }

export function addOil(minutes){ state.oil = Math.max(0, state.oil + Math.max(0, Math.floor(minutes||0))); }
export function setOil(minutes){ state.oil = Math.max(0, Math.floor(minutes||0)); }

export function lightLanterna(manual=false){
  if (state.oil <= 0) { logSystem("The lanterna is dry. You need oil."); return false; }
  if (!state.lit){
    state.lit = true;
    if (manual){ state.manualOverride = true; }
    logSystem("You light your lanterna.");
    return true;
  }
  return false;
}

export function extinguishLanterna(manual=false){
  if (state.lit){
    state.lit = false;
    if (manual){ state.manualOverride = true; }
    logSystem("You extinguish your lanterna.");
    return true;
  }
  return false;
}

export function toggleLanterna(){
  if (state.lit) return extinguishLanterna(true);
  return lightLanterna(true);
}

// Environment bridge — call this when entering a new area or when an area's lighting category changes.
export function onEnvironmentLightChange(env, logger=logSystem){
  const next = (env || 'bright').toLowerCase();
  if (state.lastEnv === next) return; // only fire on category change
  state.lastEnv = next;

  // Clear manual override at lighting transition; auto resumes.
  if (state.manualOverride){
    state.manualOverride = false;
  }

  if (!state.autoEnabled){
    return;
  }

  // Auto behaviors
  if (next === 'dark'){
    if (!state.lit && state.oil > 0){
      state.lit = true;
      logger("Darkness presses in — you light your lanterna.");
    }
  } else if (next === 'bright'){
    if (state.lit){
      state.lit = false;
      logger("The light is no longer needed — you extinguish your lanterna.");
    }
  } else {
    // 'dim' → no forced change; keep current state
  }
}


export function pauseLanternaBurn(){ state.paused = true; }
export function resumeLanternaBurn(){ state.paused = false; }
