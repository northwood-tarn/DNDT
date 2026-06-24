import { getArmorById } from "../../data/armor.js";
import { ABILITY_IDS } from "../characterDraft.js";

export function finalizeResolvedSheetFields(sheet) {
  normalizeResources(sheet);
  collectFeatureHooks(sheet);
  collectNarrativeTags(sheet);
  finalizeSavingThrows(sheet);
  finalizeInitiative(sheet);
  finalizePassivePerception(sheet);
  finalizeSpellcasting(sheet);
  finalizeDevices(sheet);
  finalizeArmorClass(sheet);
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
  sheet.combatBasics.initiativeBonus = dexMod + (sheet.combatBasics.initiativeBonus || 0);
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
  sheet.combatBasics.armorClass = armorAc + shieldBonus + featureBonus;
  sheet.combatBasics.armorClassSources = armorClassSources({
    armor,
    shield,
    dexMod,
    effectiveDex,
    shieldBonus,
    featureBonus,
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
