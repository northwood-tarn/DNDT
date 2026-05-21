export function getActorFeatureHooks(actor, timing = null) {
  const hooks = [];
  if (Array.isArray(actor?.featureHooks)) hooks.push(...actor.featureHooks);
  for (const feature of actor?.features || []) {
    if (Array.isArray(feature.featureHooks)) hooks.push(...feature.featureHooks);
    if (Array.isArray(feature.grants?.featureHooks)) hooks.push(...feature.grants.featureHooks);
  }
  return timing ? hooks.filter((hook) => hook.timing === timing) : hooks;
}

export function hasFeatureHook(actor, hookId) {
  return getActorFeatureHooks(actor).some((hook) => hook.id === hookId);
}

export function getSavageAttackerHook(actor, action) {
  if (!isWeaponAction(action)) return null;
  if (actor?.turnFlags?.savageAttackerUsed) return null;
  return getActorFeatureHooks(actor, "weapon_damage_roll")
    .find((hook) => hook.id === "savage_attacker_weapon_damage") || null;
}

export function hasAlertInitiativeAdvantage(actor) {
  return hasFeatureHook(actor, "alert_initiative_advantage");
}

export function alertFriendlyInitiativeBonus(actor, actors) {
  const allies = (actors || []).filter((item) =>
    item.id !== actor.id &&
    item.team === actor.team &&
    item.hp > 0 &&
    hasFeatureHook(item, "alert_friendly_initiative_bonus")
  );
  return allies.length ? 1 : 0;
}

function isWeaponAction(action) {
  return action?.tags?.weapon === true || action?.type === "weapon_attack";
}
