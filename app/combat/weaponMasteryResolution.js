export function weaponMasterySaveDc(actor, action) {
  return 8 + (actor.proficiencyBonus || 0) + weaponAttackAbilityModifier(actor, action);
}

export function weaponAttackAbilityModifier(actor, action) {
  const str = actor.abilityMods?.str || 0;
  const dex = actor.abilityMods?.dex || 0;
  if (action.tags?.finesse) return Math.max(str, dex);
  if (action.tags?.ranged) return dex;
  return str;
}
