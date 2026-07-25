// Centralised, singleton game state store.
// Most code should access this via getState(), but we also export `state`
// for backwards compatibility with older modules that import { state }.

import { getArmorById } from "../data/armor.js";
import { getWeaponById } from "../data/weapons.js";
import { getConsumableById } from "../data/consumables.js";
import { getUniqueById } from "../data/uniques.js";
import { getRingById } from "../data/rings.js";
import { getFootwearById } from "../data/footwear.js";
import { getHeadwearById } from "../data/headwear.js";
import { getSpellcastingFocusById } from "../data/spellcastingFoci.js";
import { SPECIES } from "../data/species.js";
import { setOilCapacityBonus } from "../systems/lanternaSystem.js";

const state = {
  player: {
    isStealthed: false,
    x: 5,
    y: 5,
    inventory: [],
    equipment: {
      armor: null,
      headwear: null,
      shield: null,
      cloak: null,
      necklace: null,
      gloves: null,
      ring1: null,
      ring2: null,
      boots: "standard_boots",
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
  setOilCapacityBonus(derivePlayerStats(state).lanternaOilCapacityBonus);
  return state;
}

function resolveItemById(id) {
  return (
    getConsumableById(id) ||
    getUniqueById(id) ||
    getRingById(id) ||
    getFootwearById(id) ||
    getHeadwearById(id) ||
    getSpellcastingFocusById(id) ||
    getArmorById(id) ||
    getWeaponById(id) ||
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
  if (typeof mods.initiativeBonus === "number") target.initiativeBonus += mods.initiativeBonus;
  if (typeof mods.speedBonusFt === "number") target.speedBonusFt += mods.speedBonusFt;
  if (typeof mods.combatSpeedBonusFt === "number") target.combatSpeedBonusFt += mods.combatSpeedBonusFt;
  if (typeof mods.spellAttackBonus === "number") target.spellAttackBonus += mods.spellAttackBonus;
  if (typeof mods.spellSaveDCBonus === "number") target.spellSaveDCBonus += mods.spellSaveDCBonus;
  if (typeof mods.lanternaOilCapacityBonus === "number") target.lanternaOilCapacityBonus += mods.lanternaOilCapacityBonus;

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

  if (Array.isArray(mods.skillAdvantages)) {
    for (const skill of mods.skillAdvantages) target.skillAdvantages.add(skill);
  }

  if (Array.isArray(mods.saveAdvantages)) {
    for (const save of mods.saveAdvantages) target.saveAdvantages.push(save);
  }

  if (mods.abilityScoreMinimums && typeof mods.abilityScoreMinimums === "object") {
    for (const [ability, score] of Object.entries(mods.abilityScoreMinimums)) {
      if (!Number.isFinite(score)) continue;
      target.abilityScoreMinimums[ability] = Math.max(target.abilityScoreMinimums[ability] || 0, score);
    }
  }
}

function mergeSpeciesModifiers(target, player) {
  const speciesId = player?.speciesId || player?.identity?.speciesId || player?.resolvedSheet?.identity?.speciesId || null;
  const species = speciesId ? SPECIES[speciesId] : null;
  for (const feature of species?.features || []) {
    for (const modifier of feature.effects?.modifiers || []) {
      if (modifier.stat === "lanterna_oil_capacity" && Number.isFinite(modifier.amount)) {
        target.lanternaOilCapacityBonus += modifier.amount;
      }
    }
  }
}

export function derivePlayerStats(inputState = state) {
  const player = inputState?.player || {};
  const eq = player.equipment || {};
  const armorId = eq.armor || eq.armorId || null;
  const mainHandItem = eq.mainHand ? resolveItemById(eq.mainHand) : null;
  const offHandItem = eq.offHand ? resolveItemById(eq.offHand) : null;
  const shieldId = eq.shield || eq.shieldId ||
    (offHandItem?.type === "shield" ? eq.offHand : null) ||
    (mainHandItem?.type === "shield" ? eq.mainHand : null);
  const offHandConflicts = mainHandItem?.exclusiveGroup && mainHandItem.exclusiveGroup === offHandItem?.exclusiveGroup;

  const equipped = {
    armor: armorId ? resolveItemById(armorId) : null,
    headwear: eq.headwear ? resolveItemById(eq.headwear) : null,
    shield: shieldId ? resolveItemById(shieldId) : null,
    cloak: eq.cloak ? resolveItemById(eq.cloak) : null,
    necklace: eq.necklace ? resolveItemById(eq.necklace) : null,
    gloves: eq.gloves ? resolveItemById(eq.gloves) : null,
    ring1: eq.ring1 ? resolveItemById(eq.ring1) : null,
    ring2: eq.ring2 ? resolveItemById(eq.ring2) : null,
    boots: eq.boots ? resolveItemById(eq.boots) : null,
    mainHand: mainHandItem?.type === "shield" ? null : mainHandItem,
    offHand: eq.offHand && eq.offHand !== shieldId && offHandItem?.type !== "shield" && !offHandConflicts ? offHandItem : null
  };

  const agg = {
    acBonus: 0,
    skillBonuses: {},
    damageBonuses: [],
    resistances: new Set(),
    initiativeBonus: 0,
    speedBonusFt: 0,
    combatSpeedBonusFt: 0,
    spellAttackBonus: 0,
    spellSaveDCBonus: 0,
    lanternaOilCapacityBonus: 0,
    skillAdvantages: new Set(),
    saveAdvantages: [],
    abilityScoreMinimums: {},
    equipmentMechanics: []
  };

  // Aggregate modifiers from everything equipped.
  const appliedUniqueEquipment = new Set();
  for (const item of Object.values(equipped)) {
    if (!item) continue;
    if (item.unique && appliedUniqueEquipment.has(item.id)) continue;
    if (item.unique) appliedUniqueEquipment.add(item.id);
    mergeModifiers(agg, item);
    if (item.mechanics) agg.equipmentMechanics.push({ sourceItemId: item.id, ...structuredClone(item.mechanics) });
  }
  mergeSpeciesModifiers(agg, player);

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
    initiativeBonus: agg.initiativeBonus,
    speedBonusFt: agg.speedBonusFt,
    combatSpeedBonusFt: agg.combatSpeedBonusFt,
    spellAttackBonus: agg.spellAttackBonus,
    spellSaveDCBonus: agg.spellSaveDCBonus,
    lanternaOilCapacityBonus: agg.lanternaOilCapacityBonus,
    skillAdvantages: Array.from(agg.skillAdvantages),
    saveAdvantages: agg.saveAdvantages,
    abilityScoreMinimums: agg.abilityScoreMinimums,
    equipmentMechanics: agg.equipmentMechanics,
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
