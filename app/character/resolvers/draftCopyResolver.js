export function copyDraftEquipment(sheet, draft) {
  sheet.equipment = {
    ...sheet.equipment,
    weaponIds: [...draft.gear.weaponIds],
    armorId: draft.gear.armorId,
    shieldId: draft.gear.shieldId,
    headwearId: draft.gear.headwearId || null,
    ringIds: [...(draft.gear.ringIds || [])].slice(0, 2),
    footwearId: draft.gear.footwearId || null,
    inventory: structuredClone(draft.gear.inventory),
    attunedItemIds: [...draft.gear.attunedItemIds],
  };
}

export function copyDraftSpells(sheet, draft) {
  sheet.spellcasting.knownSpellIds = [...draft.spells.knownSpellIds];
  sheet.spellcasting.preparedSpellIds = [...draft.spells.preparedSpellIds];
}
