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
  sheet.resources = (sheet.resources || []).map((resource) => ({
    ...resource,
    current: Number.isFinite(resource.current) ? resource.current : resource.max,
  }));
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
}

function finalizeArmorClass(sheet) {
  const dexMod = sheet.abilities.dexterity?.modifier || 0;
  const armor = getArmorById(sheet.equipment.armorId);
  const shield = getArmorById(sheet.equipment.shieldId);
  const armorAc = armor ? armor.ac + cappedDexMod(dexMod, armor.dexCap) : 10 + dexMod;
  const shieldBonus = shield?.type === "shield" ? (shield.modifiers?.acBonus || 0) : 0;
  sheet.combatBasics.armorClass = armorAc + shieldBonus;
}

function cappedDexMod(dexMod, cap) {
  if (cap === null || cap === undefined) return dexMod;
  return Math.min(dexMod, cap);
}
