// app/engine/long_rest.js
// Unified Long Rest engine (usable at Ember or via settlement/dialogue)
//
// Order of operations:
// 1) Narrative hook at START (usually no-op; place for mystical Ember events)
// 2) Food check + hungry-streak via centralized store (settlement feeds you; Ember consumes ration or increments streak)
// 3) HP recovery (fed = full; hungry1 = 30%; hungry2+ = 25%)
// 4) Reset short-rest counter in centralized store
// 5) Spell slot recovery (Vancian tables; Warlock pact slots always refresh)
// 6) Class ability recovery (all longRest features; shortRest features too unless hungry2+)
// 7) Class preparation/customization (e.g., wizard prep, saboteur recipes)
// 8) Return summary

import {
  beginRestAndUpdateHunger,
  resetShortRestsUsed,
  resetHungryStreak,
  getHungryStreak,
} from "../state/rest_counters.js"; // adjust path if needed

import { classes } from "../data/classes.js";
import { subclasses } from "../data/subclasses.js";

export function canLongRest(state, opts = {}) {
  // If you later want to enforce "Ember-only" in map mode, wire it here via opts.mode === "ember".
  // Right now, unified: both Ember and Settlement may long rest.
  return true;
}

/**
 * runLongRest(state, opts)
 * opts:
 *  - key: string         // character/save identifier for the counters store
 *  - mode: "ember" | "settlement"  // settlement auto-feeds (no ration consumed)
 *  - onNarrative: (state) => any    // optional narrative hook at the very beginning
 *  - onPreparation: (state) => any  // optional UI hook for spell prep / saboteur recipes, etc.
 */
export function runLongRest(state, opts = {}) {
  const key = opts.key ?? state?.character?.id ?? "default";
  const mode = opts.mode ?? "ember";
  const next = clone(state);

  if (!canLongRest(next, opts)) {
    return {
      ok: false,
      reason: "LongRestNotAllowed",
      state,
      summary: { message: "You cannot take a long rest right now." }
    };
  }

  // 1) Narrative hook FIRST (usually empty pass-through)
  const narrative = typeof opts.onNarrative === "function" ? opts.onNarrative(next) : null;

  // 2) Food & hungry-streak logic via centralized store
  // Settlement mode: considered fed and resets hungryStreak, without consuming inventory rations.
  let hadRations = false;
  let hungryStreak = 0;

  if (mode === "settlement") {
    resetHungryStreak(key);           // store → 0
    hadRations = true;                // treated as fed
    hungryStreak = getHungryStreak(key); // 0
  } else {
    // Ember/default: consume a ration if available, else increment hungry streak
    const r = beginRestAndUpdateHunger(next, key); // mutates next.resources.rations
    hadRations = r.hadRations;
    hungryStreak = r.hungryStreak;
  }

  // 3) HP Recovery by tier
  const ratios = {
    fed: 1.00,
    hungry1: 0.30,
    hungry2plus: 0.25,
  };
  const ratioUsed = hadRations ? ratios.fed : (hungryStreak === 1 ? ratios.hungry1 : ratios.hungry2plus);
  const hpSummary = applyLongRestHealing(next, ratioUsed);

  // 4) Reset short-rest counter in centralized store
  resetShortRestsUsed(key);

  // 5) Spell slot recovery
  const slotSummary = refillSpellSlots(next);

  // 6) Class ability recovery
  const featureSets = detectRestFeatureNames(next.character);
  const longRestRefreshed = refreshFeatures(next, featureSets.longRest);
  let shortRestRefreshed = [];
  let shortRestSkippedWhenHungry = false;
  if (hadRations || hungryStreak === 1) {
    shortRestRefreshed = refreshFeatures(next, featureSets.shortRest);
  } else {
    shortRestSkippedWhenHungry = true;
  }

  // 7) Class preparation / customization
  const preparation = typeof opts.onPreparation === "function" ? opts.onPreparation(next) : null;

  // 8) Summary
  return {
    ok: true,
    state: next,
    summary: {
      mode,
      narrative,
      hadRations,
      hungryStreak,
      hp: hpSummary,
      slots: slotSummary,
      features: {
        longRestRefreshed,
        shortRestRefreshed,
        shortRestSkippedWhenHungry,
        discovered: featureSets,
      },
      preparation,
      message: mode === "settlement"
        ? "You sleep in safety and wake restored."
        : (hadRations ? "The Ember burns without heat; you rise renewed." : "You pass the night hollow with hunger."),
    }
  };
}

// ---- Healing ----
function applyLongRestHealing(state, ratio) {
  const hp = ensureHP(state);
  if (ratio >= 0.999) {
    hp.current = hp.max;
    return { amount: "full", ratioUsed: ratio, hp: { current: hp.current, max: hp.max } };
  }
  const missing = Math.max(0, hp.max - hp.current);
  const heal = Math.min(Math.floor(hp.max * ratio), missing);
  hp.current = Math.min(hp.max, hp.current + heal);
  return { amount: heal, ratioUsed: ratio, hp: { current: hp.current, max: hp.max } };
}

function ensureHP(state) {
  state.hp = state.hp || { current: 1, max: 1 };
  if (typeof state.hp.current !== "number") state.hp.current = Number(state.hp.current) || 0;
  if (typeof state.hp.max !== "number") state.hp.max = Math.max(1, Number(state.hp.max) || 1);
  return state.hp;
}

// ---- Feature discovery & refresh ----
function detectRestFeatureNames(character = {}) {
  const longRest = new Set();
  const shortRest = new Set();
  const cls = classes?.[character.class];
  if (cls?.features) harvestByCadence(cls.features, longRest, shortRest);
  const sub = subclasses?.[character.class]?.[character.subclass];
  if (sub?.features) harvestByCadence(sub.features, longRest, shortRest);
  return {
    longRest: Array.from(longRest),
    shortRest: Array.from(shortRest),
  };
}
function harvestByCadence(featureByLevel, sinkLong, sinkShort) {
  for (const lvl of Object.keys(featureByLevel || {})) {
    for (const feat of (featureByLevel[lvl] || [])) {
      const uses = String(feat?.uses || "");
      if (uses.startsWith("longRest")) sinkLong.add(feat.name);
      if (uses.startsWith("shortRest")) sinkShort.add(feat.name);
    }
  }
}
function refreshFeatures(state, names = []) {
  if (!state.abilities || !Array.isArray(names)) return [];
  const out = [];
  for (const name of names) {
    const a = state.abilities[name] || {};
    a.usesRemaining = a.maxUses ?? 1;
    state.abilities[name] = a;
    out.push(name);
  }
  return out;
}

// ---- Spell Slots ----
function refillSpellSlots(state) {
  const clsName = state.character?.class;
  const cls = classes?.[clsName];
  if (!state.spells) state.spells = {};

  const snapshot = { pactBefore: null, pactAfter: null, vancian: null };

  // Table-based refresh for Vancian casters if present
  if (cls?.slotsByLevel) {
    const newSlots = JSON.parse(JSON.stringify(cls.slotsByLevel?.[state.character.level] || {}));
    state.spells.slots = newSlots;
    snapshot.vancian = newSlots;
  }

  // Warlock pact slots always refresh
  if (state.spells?.warlockSlots) {
    snapshot.pactBefore = state.spells.warlockSlots.current ?? null;
    state.spells.warlockSlots.current = state.spells.warlockSlots.max ?? state.spells.warlockSlots.current;
    snapshot.pactAfter = state.spells.warlockSlots.current;
  }
  return snapshot;
}

// ---- Utils ----
function clone(obj) { return JSON.parse(JSON.stringify(obj ?? {})); }

export default { canLongRest, runLongRest };