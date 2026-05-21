import { applyLuckyNearMissD20, rollWithDetail, rollD20 } from "../utils/dice.js";

function hashSeed(seed) {
  let h = 2166136261;
  const text = String(seed || "combat-seed");
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  function random() {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  random.getState = () => a >>> 0;
  random.setState = (next) => { a = next >>> 0; };
  return random;
}

export function createDiceRoller({ deterministic = true, seed = "combat-test-001" } = {}) {
  let seeded = deterministic;
  let seedText = seed;
  let rng = mulberry32(hashSeed(seedText));

  function withRandom(fn) {
    if (!seeded) return fn();
    const previous = Math.random;
    Math.random = rng;
    try {
      return fn();
    } finally {
      Math.random = previous;
    }
  }

  return {
    get deterministic() {
      return seeded;
    },
    get seed() {
      return seedText;
    },
    setDeterministic(next, nextSeed = seedText) {
      seeded = !!next;
      seedText = nextSeed || seedText;
      rng = mulberry32(hashSeed(seedText));
    },
    getState() {
      return { deterministic: seeded, seed: seedText, rngState: rng.getState?.() ?? null };
    },
    setState(state = {}) {
      seeded = state.deterministic ?? seeded;
      seedText = state.seed || seedText;
      rng = mulberry32(hashSeed(seedText));
      if (Number.isFinite(state.rngState)) rng.setState(state.rngState);
    },
    rollD20(context = {}) {
      return withRandom(() => rollD20({ context, allowLucky: false }));
    },
    applyLuckyD20(options = {}) {
      return withRandom(() => applyLuckyNearMissD20(options));
    },
    rollDamage(dice) {
      return withRandom(() => rollWithDetail(dice));
    },
  };
}
