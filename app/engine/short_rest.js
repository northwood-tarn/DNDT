// app/engine/short_rest.js (refactored to externalize counters)
// Requires: app/state/rest_counters.js
import RestCounters, {
  getShortRestsUsed, incrementShortRestsUsed,
  beginRestAndUpdateHunger, getHungryStreak
} from "../state/rest_counters.js";

export const MAX_SHORT_RESTS_PER_LONG_REST = 2;
export const SHORT_REST_HEAL_RATIO_FED = 0.50;
export const SHORT_REST_HEAL_RATIO_HUNGRY1 = 0.30;
export const SHORT_REST_HEAL_RATIO_HUNGRY2PLUS = 0.25;
export const STUDY_SUCCESS_CHANCE = 0.20;
export const MAP_STUDY_PROGRESS_PER_SUCCESS = 0.20;

export const ShortRestActivities = Object.freeze({
  RANDOM: "random",
  NONE: "none",
  STUDY_MAPS: "study_maps",
  TINKER_CONSUMABLES: "tinker_consumables",
});

export function canShortRest(state, key) {
  const used = getShortRestsUsed(key);
  return used < MAX_SHORT_RESTS_PER_LONG_REST;
}

export function runShortRest(state, opts = {}) {
  const key = opts.key ?? state?.character?.id ?? "default";
  const next = clone(state);
  if (!canShortRest(next, key)) {
    return { ok: false, reason: "NoShortRestsRemaining", state, summary: { message: "You cannot take another short rest until your next long rest." } };
  }

  // Hunger/rations via centralized store (also mutates rations in state)
  const { hadRations, hungryStreak } = beginRestAndUpdateHunger(next, key);

  // Healing
  const ratio = hadRations
    ? SHORT_REST_HEAL_RATIO_FED
    : (hungryStreak === 1 ? SHORT_REST_HEAL_RATIO_HUNGRY1 : SHORT_REST_HEAL_RATIO_HUNGRY2PLUS);
  const heal = applyShortRestHealing(next, ratio);

  // Increment short-rest count in centralized store
  incrementShortRestsUsed(key, 1);

  // One productive activity only if fed
  let activity = ShortRestActivities.NONE;
  let activityResult = {
    message: hungryStreak >= 2
      ? "It’s difficult even to rest, you’re so hungry."
      : "You push down your hunger and take a moment to breathe.",
    effects: []
  };
  const chosen = opts.activity || ShortRestActivities.RANDOM;
  if (hadRations) {
    activity = chosen === ShortRestActivities.RANDOM ? pickRandomActivity(next) : chosen;
    activityResult = handleActivity(next, activity);
  }

  // Refreshes: warlock always; class abilities only if fed or first hungry
  const warlockRefill = refreshWarlockPactSlots(next);
  const featureNames = detectShortRestFeatureNames(next?.character);
  let abilitiesRefilled = [];
  let abilitiesSkippedWhenHungry = false;
  if (hadRations || (!hadRations && hungryStreak === 1)) {
    abilitiesRefilled = refreshShortRestAbilities(next, featureNames);
  } else {
    abilitiesSkippedWhenHungry = true;
  }

  const vignette = hadRations && typeof opts.onVignette === "function" ? opts.onVignette(next) : null;

  return {
    ok: true,
    state: next,
    summary: {
      healed: heal,
      hadRations,
      hungryStreak,
      shortRestsUsed: getShortRestsUsed(key),
      activityChosen: activity,
      activityResult,
      warlockSlotsRefilled: warlockRefill,
      abilitiesRefilled,
      abilitiesSkippedWhenHungry,
      shortRestFeatureNames: featureNames,
      vignette,
    }
  };
}

// ----- Healing helpers -----
export function applyShortRestHealing(state, ratio) {
  const hp = ensureHP(state);
  const maxHeal = Math.floor(hp.max * (ratio ?? SHORT_REST_HEAL_RATIO_FED));
  const missing = Math.max(0, hp.max - hp.current);
  const healed = Math.min(maxHeal, missing);
  hp.current = Math.min(hp.max, hp.current + healed);
  return { amount: healed, ratioUsed: ratio, hp: { current: hp.current, max: hp.max } };
}

function ensureHP(state) {
  state.hp = state.hp || { current: 1, max: 1 };
  if (typeof state.hp.current !== "number") state.hp.current = Number(state.hp.current) || 0;
  if (typeof state.hp.max !== "number") state.hp.max = Math.max(1, Number(state.hp.max) || 1);
  return state.hp;
}

// ----- Warlock Pact Slots -----
export function refreshWarlockPactSlots(state) {
  const isWarlock = (state?.character?.class === "Warlock");
  if (!isWarlock) return { changed: false };
  const slots = (((state.spells || {}).warlockSlots) || { max: 0, current: 0 });
  if (!state.spells) state.spells = {};
  if (!state.spells.warlockSlots) state.spells.warlockSlots = { max: slots.max || 0, current: 0 };
  const before = state.spells.warlockSlots.current ?? 0;
  state.spells.warlockSlots.current = state.spells.warlockSlots.max ?? before;
  return { changed: true, before, after: state.spells.warlockSlots.current };
}

// ----- Ability refresh (generic) -----
export function refreshShortRestAbilities(state, names = []) {
  if (!state.abilities) return [];
  const refreshed = [];
  for (const name of names) {
    const a = state.abilities[name];
    if (!a) continue;
    if (a.cadence === "shortRest") {
      a.usesRemaining = typeof a.maxUses === "number" ? a.maxUses : 1;
      refreshed.push(name);
    }
  }
  return refreshed;
}

// ----- Data-driven feature discovery -----
import { classes } from "../data/classes.js";
import { subclasses } from "../data/subclasses.js";

export function detectShortRestFeatureNames(character = {}) {
  const out = new Set();
  const cls = character.class;
  const sub = character.subclass;
  if (classes?.[cls]?.features) harvestShortRest(classes[cls].features, out);
  if (subclasses?.[cls]?.[sub]?.features) harvestShortRest(subclasses[cls][sub].features, out);
  return Array.from(out);
}
function harvestShortRest(featureByLevel, sink) {
  for (const lvl of Object.keys(featureByLevel || {})) {
    const arr = featureByLevel[lvl] || [];
    for (const feat of arr) {
      if (feat?.uses === "shortRest" || String(feat?.uses || "").startsWith("shortRest")) sink.add(feat.name);
    }
  }
}

// ----- Activities (unchanged) -----
export const ShortRestActivityHelpers = {
  pickRandomActivity, handleActivity, studyMaps, tinkerConsumables,
};

export function pickRandomActivity(state) {
  const canStudy = hasUnstudiedFragment(state);
  const canTinker = (state?.inventory?.consumables ?? []).some(c => (c?.qty ?? 0) > 0);
  const candidates = [];
  if (canStudy) candidates.push(ShortRestActivities.STUDY_MAPS);
  if (canTinker) candidates.push(ShortRestActivities.TINKER_CONSUMABLES);
  if (candidates.length === 0) return ShortRestActivities.NONE;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function handleActivity(state, activity) {
  switch (activity) {
    case ShortRestActivities.STUDY_MAPS:
      return studyMaps(state);
    case ShortRestActivities.TINKER_CONSUMABLES:
      return tinkerConsumables(state);
    case ShortRestActivities.NONE:
    default:
      return { message: "You take a quiet moment to breathe.", effects: [] };
  }
}

// Map fragments
function normalizeFragments(exploration) {
  if (!exploration) return [];
  const mf = exploration.mapFragments;
  if (Array.isArray(mf)) return mf;
  const count = Number.isFinite(mf) ? mf : 0;
  const arr = [];
  for (let i = 0; i < count; i++) arr.push({ id: `frag_${i+1}`, studied: false });
  exploration.mapFragments = arr;
  return arr;
}
function hasUnstudiedFragment(state) {
  const exp = state?.exploration || {};
  const arr = normalizeFragments(exp);
  return arr.some(f => !f.studied);
}
function studyMaps(state) {
  const exp = state.exploration = state.exploration || {};
  const fragments = normalizeFragments(exp);
  const target = fragments.find(f => !f.studied);
  if (!target) return { message: "You lay out your fragments again, but there is nothing new to glean.", effects: [] };
  const roll = Math.random();
  const success = roll < 0.20;
  target.studied = true;
  if (success) {
    const before = exp.mapStudyProgress ?? 0;
    const after = Math.min(1, before + 0.20);
    exp.mapStudyProgress = after;
    return { message: "A seam reveals itself—two edges finally align.", effects: [{ key: "fragmentId", value: target.id }, { key: "mapStudyProgress", from: before, to: after }] };
  }
  return { message: "You trace lines and seams, but the joins refuse to settle.", effects: [{ key: "fragmentId", value: target.id }, { key: "attempt", value: "fail" }] };
}

function tinkerConsumables(state) {
  const list = state?.inventory?.consumables ?? [];
  const idx = list.findIndex(c => (c?.qty ?? 0) > 0);
  if (idx === -1) return { message: "Your kit is empty—you make notes for next time.", effects: [] };
  const target = list[idx];
  target.refined = true;
  return { message: `You tweak your ${target.name}, finding a small improvement.`, effects: [{ itemId: target.id, tag: "refined", value: true }] };
}

// utils
function clone(obj) { return JSON.parse(JSON.stringify(obj ?? {})); }

export default {
  MAX_SHORT_RESTS_PER_LONG_REST,
  SHORT_REST_HEAL_RATIO_FED,
  SHORT_REST_HEAL_RATIO_HUNGRY1,
  SHORT_REST_HEAL_RATIO_HUNGRY2PLUS,
  ShortRestActivities,
  canShortRest,
  runShortRest,
};
