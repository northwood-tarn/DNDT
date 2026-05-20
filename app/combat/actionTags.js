export function getActionTags(action) {
  const inferred = inferActionTags(action);
  return {
    ...inferred,
    ...(action?.tags || {}),
  };
}

export function hasActionTag(action, tag) {
  return getActionTags(action)[tag] === true;
}

function inferActionTags(action) {
  const type = action?.type || "";
  const isWeapon = type === "weapon_attack" || type === "melee_attack";
  const isSpell = type.startsWith("spell_");
  const attackRoll = type === "weapon_attack" || type === "melee_attack" || type === "spell_attack";
  const savingThrow = type === "spell_save" || type === "spell_area_save";
  const melee = type === "melee_attack" || (isWeapon && action?.range <= 1);
  const ranged = attackRoll && !melee;
  const harmful = Boolean(
    action?.harmful === true ||
    action?.damage ||
    action?.damageType ||
    action?.attackBonus != null ||
    action?.saveAbility ||
    type === "push" ||
    type === "spell_area_save"
  );

  return {
    attackRoll,
    harmful,
    melee,
    ranged,
    requiresHands: isWeapon || action?.requiresHands === true,
    requiresSight: action?.requiresSight === true,
    requiresSpeech: action?.requiresSpeech === true,
    savingThrow,
    spell: isSpell,
    weapon: isWeapon,
  };
}
