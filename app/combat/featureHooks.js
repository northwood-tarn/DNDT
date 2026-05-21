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

export function getDamageRollHooks(actor, action, { critical = false } = {}) {
  return getActorFeatureHooks(actor, "weapon_damage_roll")
    .filter((hook) => hook.id !== "savage_attacker_weapon_damage")
    .filter((hook) => isWeaponAction(action) || hook.appliesTo === "all_damage")
    .filter((hook) => !hook.trigger?.criticalOnly || critical)
    .filter((hook) => matchesDamageType(hook.trigger?.damageTypes, action?.damageType))
    .filter((hook) => matchesHookTags(hook, action))
    .filter((hook) => matchesHookCondition(hook, action))
    .filter((hook) => preparedForFirstAttack(actor, hook))
    .filter((hook) => !usedFrequency(actor, hook));
}

export function markDamageRollHookUsed(actor, hook) {
  if (!hook?.trigger?.frequency) return;
  actor.turnFlags ??= {};
  actor.turnFlags.damageRollHooks ??= {};
  actor.combatFlags ??= {};
  actor.combatFlags.damageRollHooks ??= {};
  if (hook.trigger.frequency === "once_per_turn") actor.turnFlags.damageRollHooks[hook.id] = true;
  if (hook.trigger.frequency === "first_attack_per_turn") actor.turnFlags.damageRollHooks[hook.id] = true;
  if (hook.trigger.frequency === "once_per_combat") actor.combatFlags.damageRollHooks[hook.id] = true;
}

export function prepareDamageRollHooksForAttack(actor, action) {
  actor.turnFlags ??= {};
  actor.turnFlags.currentDamageRollHooks = {};
  for (const hook of getActorFeatureHooks(actor, "weapon_damage_roll")) {
    if (hook.trigger?.frequency !== "first_attack_per_turn") continue;
    if (usedFrequency(actor, hook)) continue;
    if (!isWeaponAction(action) && hook.appliesTo !== "all_damage") continue;
    if (!matchesDamageType(hook.trigger?.damageTypes, action?.damageType)) continue;
    if (!matchesHookTags(hook, action)) continue;
    if (!matchesHookCondition(hook, action)) continue;
    actor.turnFlags.currentDamageRollHooks[hook.id] = true;
    markDamageRollHookUsed(actor, hook);
  }
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

function matchesDamageType(types, damageType) {
  if (!Array.isArray(types) || !types.length) return true;
  return types.includes(damageType);
}

function matchesHookTags(hook, action = {}) {
  if (!Array.isArray(hook.tags) || !hook.tags.length) return true;
  const actionTags = new Set([
    ...(Array.isArray(action.tags) ? action.tags : []),
    ...Object.entries(action.tags || {}).filter(([, value]) => value === true).map(([key]) => key),
  ]);
  return hook.tags.every((tag) => actionTags.has(tag));
}

function matchesHookCondition(hook, action = {}) {
  if (!hook.condition) return true;
  if (hook.condition === "one_handed_weapon_only") {
    return action?.tags?.two_handed !== true && action?.tags?.heavy !== true;
  }
  if (typeof hook.condition === "object") {
    if (hook.condition.actionTag && action?.tags?.[hook.condition.actionTag] !== true) return false;
  }
  return true;
}

function usedFrequency(actor, hook) {
  if (hook.trigger?.frequency === "once_per_turn") return actor?.turnFlags?.damageRollHooks?.[hook.id] === true;
  if (hook.trigger?.frequency === "first_attack_per_turn") return actor?.turnFlags?.damageRollHooks?.[hook.id] === true && actor?.turnFlags?.currentDamageRollHooks?.[hook.id] !== true;
  if (hook.trigger?.frequency === "once_per_combat") return actor?.combatFlags?.damageRollHooks?.[hook.id] === true;
  return false;
}

function preparedForFirstAttack(actor, hook) {
  if (hook.trigger?.frequency !== "first_attack_per_turn") return true;
  return actor?.turnFlags?.currentDamageRollHooks?.[hook.id] === true;
}
