import { getArmorById } from "../data/armor.js";
import { getFootwearById } from "../data/footwear.js";
import { getHeadwearById } from "../data/headwear.js";
import { getRingById } from "../data/rings.js";
import { getSpellcastingFocusById } from "../data/spellcastingFoci.js";
import { getWeaponById } from "../data/weapons.js";

export function resolveEquippedItems(sheet) {
  const equipment = sheet?.equipment || {};
  const items = [
    getArmorById(equipment.armorId),
    getArmorById(equipment.shieldId),
    getHeadwearById(equipment.headwearId),
    ...(equipment.ringIds || []).map(getRingById),
    getFootwearById(equipment.footwearId),
    ...(equipment.weaponIds || []).map((id) => getSpellcastingFocusById(id) || getWeaponById(id)),
  ].filter(Boolean);
  const seen = new Set();
  return items.filter((item) => {
    const key = item.unique || item.worldUnique ? item.id : `${item.equipmentKind || item.type}:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function resolveEquippedAccessories(sheet) {
  return resolveEquippedItems(sheet).filter((item) => ["ring", "headwear", "footwear"].includes(item.equipmentKind));
}

export function aggregateEquipmentModifiers(items = []) {
  const result = {
    acBonus: 0,
    initiativeBonus: 0,
    speedBonusFt: 0,
    combatSpeedBonusFt: 0,
    resistances: new Set(),
    skillAdvantages: new Set(),
    skillBonuses: {},
    saveAdvantages: [],
    abilityScoreMinimums: {},
  };
  for (const item of items) {
    const modifiers = item.modifiers || {};
    result.acBonus += Number(modifiers.acBonus) || 0;
    result.initiativeBonus += Number(modifiers.initiativeBonus) || 0;
    result.speedBonusFt += Number(modifiers.speedBonusFt) || 0;
    result.combatSpeedBonusFt += Number(modifiers.combatSpeedBonusFt) || 0;
    for (const type of modifiers.resistances || []) result.resistances.add(type);
    for (const skill of modifiers.skillAdvantages || []) result.skillAdvantages.add(skill);
    for (const entry of modifiers.saveAdvantages || []) result.saveAdvantages.push(structuredClone(entry));
    for (const [skill, amount] of Object.entries(modifiers.skillBonuses || {})) {
      result.skillBonuses[skill] = (result.skillBonuses[skill] || 0) + (Number(amount) || 0);
    }
    for (const [ability, score] of Object.entries(modifiers.abilityScoreMinimums || {})) {
      result.abilityScoreMinimums[ability] = Math.max(result.abilityScoreMinimums[ability] || 0, Number(score) || 0);
    }
  }
  return result;
}
