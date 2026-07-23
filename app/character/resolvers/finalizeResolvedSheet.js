import { getArmorById } from "../../data/armor.js";
import { getSpellcastingFocusById } from "../../data/spellcastingFoci.js";
import { getWeaponById, isWeaponProficient } from "../../data/weapons.js";
import { getFootwearById } from "../../data/footwear.js";
import { getHeadwearById } from "../../data/headwear.js";
import { getRingById } from "../../data/rings.js";
import { ABILITY_IDS } from "../characterDraft.js";
import { aggregateEquipmentModifiers, resolveEquippedAccessories, resolveEquippedItems } from "../equippedItemRuntime.js";

export function finalizeResolvedSheetFields(sheet) {
  finalizeEquippedWeaponProficiencies(sheet);
  finalizeEquippedAccessories(sheet);
  applyEquipmentAbilityMinimums(sheet);
  normalizeResources(sheet);
  collectFeatureHooks(sheet);
  collectNarrativeTags(sheet);
  finalizeSavingThrows(sheet);
  finalizeInitiative(sheet);
  finalizePassivePerception(sheet);
  finalizeSpellcasting(sheet);
  finalizeDevices(sheet);
  finalizeArmorClass(sheet);
  applyEquipmentDurability(sheet);
}

function finalizeEquippedAccessories(sheet) {
  const headwear = getHeadwearById(sheet.equipment.headwearId);
  const footwear = getFootwearById(sheet.equipment.footwearId);
  if (sheet.equipment.headwearId && !headwear) sheet.metadata.unresolved.push({ type: "unknown_headwear", id: sheet.equipment.headwearId });
  if (sheet.equipment.footwearId && !footwear) sheet.metadata.unresolved.push({ type: "unknown_footwear", id: sheet.equipment.footwearId });
  sheet.equipment.headwearId = headwear?.id || null;
  sheet.equipment.footwearId = footwear?.id || null;
  const seen = new Set();
  sheet.equipment.ringIds = (sheet.equipment.ringIds || []).map(getRingById).filter((ring) => {
    if (!ring || seen.has(ring.id)) return false;
    seen.add(ring.id);
    return true;
  }).slice(0, 2).map((ring) => ring.id);
}

function accessoryModifiers(sheet) {
  return aggregateEquipmentModifiers(resolveEquippedAccessories(sheet));
}

function applyEquipmentAbilityMinimums(sheet) {
  for (const [ability, minimum] of Object.entries(accessoryModifiers(sheet).abilityScoreMinimums)) {
    const entry = sheet.abilities?.[ability];
    if (!entry || entry.score >= minimum) continue;
    entry.score = minimum;
    entry.modifier = Math.floor((minimum - 10) / 2);
  }
}

function applyEquipmentDurability(sheet) {
  const resistances = aggregateEquipmentModifiers(resolveEquippedItems(sheet)).resistances;
  sheet.durability.resistances = [...new Set([...(sheet.durability.resistances || []), ...resistances])];
}

function finalizeEquippedWeaponProficiencies(sheet) {
  const allowed = [];
  const equippedExclusiveGroups = new Set();
  for (const weaponId of sheet.equipment.weaponIds || []) {
    const focus = getSpellcastingFocusById(weaponId);
    const weapon = getWeaponById(weaponId) || focus;
    const classFocus = focus && focus.spellcastingClass === sheet.identity.classId;
    if (classFocus || isWeaponProficient(weapon, sheet.proficiencies.weapons || [])) {
      if (weapon.exclusiveGroup && equippedExclusiveGroups.has(weapon.exclusiveGroup)) {
        sheet.metadata.unresolved.push({ type: "exclusive_equipment_conflict", id: weaponId, group: weapon.exclusiveGroup });
        continue;
      }
      if (weapon.exclusiveGroup) equippedExclusiveGroups.add(weapon.exclusiveGroup);
      allowed.push(weaponId);
      continue;
    }
    sheet.metadata.unresolved.push({ type: "weapon_not_proficient", id: weaponId, classId: sheet.identity.classId });
  }
  sheet.equipment.weaponIds = allowed;
}

function collectNarrativeTags(sheet) {
  const tags = new Set(sheet.narrative?.tags || []);
  for (const feature of sheet.features || []) {
    for (const tag of feature.effects?.narrativeTags || []) tags.add(tag);
    for (const tag of feature.grants?.narrativeTags || []) tags.add(tag);
  }
  sheet.narrative = {
    ...(sheet.narrative || {}),
    tags: [...tags].sort(),
  };
}

function normalizeResources(sheet) {
  const merged = new Map();
  for (const resource of sheet.resources || []) {
    const normalized = {
      ...resource,
      current: Number.isFinite(resource.current) ? resource.current : resource.max,
      sources: resource.sources || [resource.source].filter(Boolean),
    };
    if (!merged.has(resource.id)) {
      merged.set(resource.id, normalized);
      continue;
    }
    const existing = merged.get(resource.id);
    existing.max = Math.max(existing.max || 0, normalized.max || 0);
    existing.current = Math.max(existing.current || 0, normalized.current || 0);
    existing.sources = [...new Set([...(existing.sources || []), ...(normalized.sources || [])])];
    existing.source = existing.sources[0] || existing.source;
  }
  sheet.resources = [...merged.values()];
}

function collectFeatureHooks(sheet) {
  const hooks = [];
  for (const feature of sheet.features || []) {
    if (Array.isArray(feature.featureHooks)) hooks.push(...feature.featureHooks);
    if (Array.isArray(feature.grants?.featureHooks)) hooks.push(...feature.grants.featureHooks);
    if (Array.isArray(feature.effects?.featureHooks)) hooks.push(...feature.effects.featureHooks);
  }
  sheet.featureHooks = hooks;
}

function finalizeSavingThrows(sheet) {
  const proficiencies = new Set(sheet.proficiencies.savingThrows || []);
  sheet.combatBasics.saves = Object.fromEntries(ABILITY_IDS.map((ability) => {
    const abilityMod = sheet.abilities[ability]?.modifier || 0;
    const proficient = proficiencies.has(ability);
    return [ability, abilityMod + (proficient ? sheet.proficiencyBonus : 0)];
  }));
}

function finalizeInitiative(sheet) {
  const dexMod = sheet.abilities.dexterity?.modifier || 0;
  sheet.combatBasics.initiativeBonus = dexMod + (sheet.combatBasics.initiativeBonus || 0) + accessoryModifiers(sheet).initiativeBonus;
}

function finalizePassivePerception(sheet) {
  const wisMod = sheet.abilities.wisdom?.modifier || 0;
  const skillBonus = skillProficiencyBonus(sheet, "perception");
  sheet.combatBasics.passivePerception = 10 + wisMod + skillBonus;
}

function skillProficiencyBonus(sheet, skillId) {
  if (!(sheet.proficiencies.skills || []).includes(skillId)) return 0;
  const expertise = (sheet.proficiencies.expertise || []).some((entry) => entry.kind === "skill" && entry.id === skillId);
  return sheet.proficiencyBonus * (expertise ? 2 : 1);
}

function finalizeSpellcasting(sheet) {
  const ability = sheet.spellcasting.ability;
  if (!ability) return;
  const abilityMod = sheet.abilities[ability]?.modifier || 0;
  sheet.spellcasting.spellSaveDc = 8 + sheet.proficiencyBonus + abilityMod;
  sheet.spellcasting.spellAttackBonus = sheet.proficiencyBonus + abilityMod;
  sheet.spellcasting.slots = spellSlotsFor(sheet);
}

function finalizeDevices(sheet) {
  const known = new Set(sheet.devices?.knownRecipeIds || []);
  const prepared = (sheet.devices?.preparedRecipeIds || []).filter((id) => known.has(id));
  sheet.devices = {
    ability: sheet.devices?.ability || (known.size ? "intelligence" : null),
    saveDc: null,
    knownRecipeIds: [...known],
    preparedRecipeIds: [...new Set(prepared)],
    recipeBook: sheet.devices?.recipeBook || [],
  };
  if (!sheet.devices.ability) return;
  const abilityMod = sheet.abilities[sheet.devices.ability]?.modifier || 0;
  sheet.devices.saveDc = 8 + sheet.proficiencyBonus + abilityMod;
}

function spellSlotsFor(sheet) {
  if (!sheet.spellcasting.canCast) return {};
  const level = sheet.identity.level || 1;
  if (sheet.spellcasting.pactMagic) {
    if (level < 1) return {};
    return { [warlockSlotLevel(level)]: { max: warlockSlotCount(level), current: warlockSlotCount(level), recovery: "short_rest" } };
  }
  const classId = sheet.identity.classId;
  if (classId === "paladin") return standardSlots(halfCasterSlotRow(level));
  return standardSlots(fullCasterSlotRow(level));
}

function standardSlots(row = []) {
  return Object.fromEntries(row.map((max, index) => [index + 1, { max, current: max, recovery: "long_rest" }]).filter(([, slot]) => slot.max > 0));
}

function fullCasterSlotRow(level) {
  const table = [
    [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1],
    [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2],
    [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1],
    [4, 3, 3, 3, 2, 1, 1],
  ];
  return table[Math.max(1, Math.min(level, table.length)) - 1];
}

function halfCasterSlotRow(level) {
  const table = [
    [2], [2], [3], [3], [4, 2], [4, 2], [4, 3], [4, 3],
    [4, 3, 2], [4, 3, 2], [4, 3, 3], [4, 3, 3], [4, 3, 3, 1],
  ];
  return table[Math.max(1, Math.min(level, table.length)) - 1];
}

function warlockSlotCount(level) {
  if (level >= 11) return 3;
  if (level >= 2) return 2;
  return 1;
}

function warlockSlotLevel(level) {
  if (level >= 9) return 5;
  if (level >= 7) return 4;
  if (level >= 5) return 3;
  if (level >= 3) return 2;
  return 1;
}

function finalizeArmorClass(sheet) {
  const dexMod = sheet.abilities.dexterity?.modifier || 0;
  const armor = getArmorById(sheet.equipment.armorId);
  const shield = getArmorById(sheet.equipment.shieldId);
  const armorDexCap = resolveArmorDexCap(sheet, armor);
  const effectiveDex = cappedDexMod(dexMod, armorDexCap);
  const armorAc = armor ? armor.ac + effectiveDex : 10 + dexMod;
  const shieldBonus = shield?.type === "shield" ? (shield.modifiers?.acBonus || 0) : 0;
  const featureBonus = armorClassFeatureBonus(sheet, armor);
  const accessoryBonus = accessoryModifiers(sheet).acBonus;
  sheet.combatBasics.armorClass = armorAc + shieldBonus + featureBonus + accessoryBonus;
  sheet.combatBasics.armorClassSources = armorClassSources({
    armor,
    shield,
    dexMod,
    effectiveDex,
    shieldBonus,
    featureBonus: featureBonus + accessoryBonus,
  });
}

function armorClassSources({ armor, shield, dexMod, effectiveDex, shieldBonus, featureBonus }) {
  const sources = [];
  if (armor) {
    sources.push({ label: armor.name, amount: armor.ac, detail: "armor base" });
    sources.push({ label: "Dexterity", amount: effectiveDex, detail: dexMod === effectiveDex ? "modifier" : "capped modifier" });
  } else {
    sources.push({ label: "Unarmored base", amount: 10 });
    sources.push({ label: "Dexterity", amount: dexMod, detail: "modifier" });
  }
  if (shieldBonus) sources.push({ label: shield?.name || "Shield", amount: shieldBonus });
  if (featureBonus) sources.push({ label: "Features", amount: featureBonus });
  return sources;
}

function cappedDexMod(dexMod, cap) {
  if (cap === null || cap === undefined) return dexMod;
  return Math.min(dexMod, cap);
}

function resolveArmorDexCap(sheet, armor) {
  if (!armor) return null;
  return (sheet.featureHooks || [])
    .filter((hook) => hook.timing === "armor_class")
    .filter((hook) => !hook.armorType || hook.armorType === armor.type)
    .reduce((cap, hook) => (
      Number.isFinite(hook.dexCapOverride) ? Math.max(cap ?? hook.dexCapOverride, hook.dexCapOverride) : cap
    ), armor.dexCap);
}

function armorClassFeatureBonus(sheet, armor) {
  return (sheet.featureHooks || [])
    .filter((hook) => hook.timing === "armor_class")
    .filter((hook) => hook.condition !== "wearing_armor" || Boolean(armor))
    .filter((hook) => !hook.armorType || hook.armorType === armor?.type)
    .reduce((total, hook) => total + (Number(hook.amount) || 0), 0);
}
