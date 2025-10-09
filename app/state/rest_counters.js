// app/state/rest_counters.js
// Centralized, swappable store for short-rest counts and hungry-streaks.
// - Keeps rest bookkeeping OUT of the rest engines, per modular design.
// - Default implementation is in-memory; swap the adapter for persistence (e.g., localStorage, DB).
// - All functions accept a `key` (characterId/saveId). If omitted, "default" is used.

const memoryStore = {
  shortRestsUsed: new Map(),   // key -> number
  hungryStreak: new Map(),     // key -> number
};

let adapter = {
  getShortRestsUsed: (key) => memoryStore.shortRestsUsed.get(key) ?? 0,
  setShortRestsUsed: (key, val) => { memoryStore.shortRestsUsed.set(key, Math.max(0, val|0)); },
  getHungryStreak: (key) => memoryStore.hungryStreak.get(key) ?? 0,
  setHungryStreak: (key, val) => { memoryStore.hungryStreak.set(key, Math.max(0, val|0)); },
  resetAll: (key) => {
    memoryStore.shortRestsUsed.set(key, 0);
    memoryStore.hungryStreak.set(key, 0);
  }
};

/** Swap the backing adapter (must implement the same methods). */
export function setRestCountersAdapter(customAdapter) {
  if (!customAdapter) return;
  const required = ["getShortRestsUsed","setShortRestsUsed","getHungryStreak","setHungryStreak","resetAll"];
  for (const k of required) {
    if (typeof customAdapter[k] !== "function") throw new Error(`Adapter missing method: ${k}`);
  }
  adapter = customAdapter;
}

/** Utility to normalize keys */
function k(key) { return key ?? "default"; }

// --- Short Rest Count ---
export function getShortRestsUsed(key) { return adapter.getShortRestsUsed(k(key)); }
export function setShortRestsUsed(key, val) { return adapter.setShortRestsUsed(k(key), val); }
export function incrementShortRestsUsed(key, delta = 1) {
  const cur = getShortRestsUsed(key);
  setShortRestsUsed(key, cur + delta);
  return getShortRestsUsed(key);
}
export function resetShortRestsUsed(key) { return setShortRestsUsed(k(key), 0); }

// --- Hungry Streak ---
export function getHungryStreak(key) { return adapter.getHungryStreak(k(key)); }
export function setHungryStreak(key, val) { return adapter.setHungryStreak(k(key), val); }
export function incrementHungryStreak(key, delta = 1) {
  const cur = getHungryStreak(key);
  setHungryStreak(key, cur + delta);
  return getHungryStreak(key);
}
export function resetHungryStreak(key) { return setHungryStreak(k(key), 0); }

// --- Composite helpers ---
/** Call when starting any rest. Returns { hadRations, hungryStreak }. */
export function beginRestAndUpdateHunger(state, key) {
  const hadRations = (state?.resources?.rations ?? 0) > 0;
  if (hadRations) {
    state.resources.rations -= 1;
    resetHungryStreak(key);
  } else {
    incrementHungryStreak(key);
  }
  return { hadRations, hungryStreak: getHungryStreak(key) };
}

export default {
  setRestCountersAdapter,
  getShortRestsUsed, setShortRestsUsed, incrementShortRestsUsed, resetShortRestsUsed,
  getHungryStreak, setHungryStreak, incrementHungryStreak, resetHungryStreak,
  beginRestAndUpdateHunger,
};
