// Centralised, singleton game state store.
// Most code should access this via getState(), but we also export `state`
// for backwards compatibility with older modules that import { state }.

import { getArmorById } from "../data/armor.js";
import { getWeaponById } from "../data/weapons.js";
import { getConsumableById } from "../data/consumables.js";
import { getUniqueById } from "../data/uniques.js";

const state = {
  player: {
    isStealthed: false,
    x: 5,
    y: 5,
    inventory: [],
    equipment: {
      armor: null,
      cloak: null,
      necklace: null,
      gloves: null,
      ring1: null,
      ring2: null,
      mainHand: null,
      offHand: null
    }
  },
  map: {
    id: null,
    width: 0,
    height: 0
  },
  combat: null,
  explore: {
    tileGrid: null,
    env: "dim",          // 'daylight' | 'bright' | 'dim' | 'dark' | 'obscured' (future)
    lights: [],          // external static lights (e.g., embers, torches)
    camera: { x: 0, y: 0, w: 21, h: 13 },
    hover: { x: null, y: null },
    minimap: { enabled: true }
  }
};

export function getState() {
  return state;
}

// Shallow patch helper used by routing/save hydration and other systems.
// Intentionally minimal: callers should replace whole subtrees (e.g., `player`, `flags`).
export function setState(patch = {}) {
  if (!patch || typeof patch !== "object") return state;
  Object.assign(state, patch);
  return state;
}

function resolveItemById(id) {
  return (
    getConsumableById(id) ||
    getUniqueById(id) ||
    getWeaponById(id) ||
    getArmorById(id) ||
    null
  );
}

function getAbilityScore(player, key) {
  // Accept a few common shapes without guessing beyond that.
  if (!player) return null;
  if (player.abilities && typeof player.abilities[key] === "number") return player.abilities[key];
  if (player.abilityScores && typeof player.abilityScores[key] === "number") return player.abilityScores[key];
  if (player.stats && typeof player.stats[key] === "number") return player.stats[key];
  return null;
}

function abilityMod(score) {
  if (typeof score !== "number") return 0;
  return Math.floor((score - 10) / 2);
}

function mergeModifiers(target, item) {
  const mods = item?.modifiers;
  if (!mods) return;

  if (typeof mods.acBonus === "number") target.acBonus += mods.acBonus;

  if (mods.skillBonuses && typeof mods.skillBonuses === "object") {
    for (const [skillId, bonus] of Object.entries(mods.skillBonuses)) {
      if (typeof bonus !== "number") continue;
      target.skillBonuses[skillId] = (target.skillBonuses[skillId] || 0) + bonus;
    }
  }

  if (Array.isArray(mods.damageBonuses)) {
    for (const b of mods.damageBonuses) target.damageBonuses.push(b);
  }

  if (Array.isArray(mods.resistances)) {
    for (const r of mods.resistances) target.resistances.add(r);
  }
}

export function derivePlayerStats(inputState = state) {
  const player = inputState?.player || {};
  const eq = player.equipment || {};

  const equipped = {
    armor: eq.armor ? resolveItemById(eq.armor) : null,
    cloak: eq.cloak ? resolveItemById(eq.cloak) : null,
    necklace: eq.necklace ? resolveItemById(eq.necklace) : null,
    gloves: eq.gloves ? resolveItemById(eq.gloves) : null,
    ring1: eq.ring1 ? resolveItemById(eq.ring1) : null,
    ring2: eq.ring2 ? resolveItemById(eq.ring2) : null,
    mainHand: eq.mainHand ? resolveItemById(eq.mainHand) : null,
    offHand: eq.offHand ? resolveItemById(eq.offHand) : null
  };

  const agg = {
    acBonus: 0,
    skillBonuses: {},
    damageBonuses: [],
    resistances: new Set()
  };

  // Aggregate modifiers from everything equipped.
  for (const item of Object.values(equipped)) mergeModifiers(agg, item);

  // Armor Class
  const dex = getAbilityScore(player, "dex");
  const dexMod = abilityMod(dex);

  let baseAc = 10;
  let dexContribution = dexMod;
  let stealthDisadvantage = false;

  const armor = equipped.armor;
  if (armor && typeof armor.ac === "number") {
    baseAc = armor.ac;
    if (armor.dexCap === null) dexContribution = dexMod;
    else if (typeof armor.dexCap === "number") dexContribution = Math.min(dexMod, armor.dexCap);
    else dexContribution = 0;

    stealthDisadvantage = !!armor.stealthDisadvantage;
  }

  const derived = {
    equipped,
    ac: baseAc + dexContribution + agg.acBonus,
    dexMod,
    resistances: Array.from(agg.resistances),
    skillBonuses: agg.skillBonuses,
    damageBonuses: agg.damageBonuses,
    stealthDisadvantage
  };

  return derived;
}

export function getDerivedPlayer() {
  // Convenience accessor: does not mutate state.
  return {
    ...state.player,
    derived: derivePlayerStats(state)
  };
}

// Legacy export: modules that still import { state } will receive
// the same singleton object returned by getState().
export { state };