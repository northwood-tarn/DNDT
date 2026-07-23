import { addActiveEffect, getEffectiveAc } from "./modifiers.js";

export function applyModifierEffect(snapshot, actor, target, action, effect, log) {
  const receiver = effect.target === "self" ? actor : target;
  const id = `${action.id}_${effect.stat}_${receiver.id}`;
  const duration = effect.duration?.anchor === "source" && snapshot.initiative?.[snapshot.turnIndex] === actor.id
    ? { ...effect.duration, skipNextTick: true }
    : effect.duration;
  const added = addActiveEffect(receiver, {
    ...effect,
    duration,
    id,
    label: effect.label || action.name,
    trigger: "passive",
    sourceActionId: action.id,
    sourceSpellLevel: action.spellLevel ?? null,
    sourceActorId: actor.id,
  });
  log.add("effect.applied", {
    round: snapshot.round,
    sourceId: actor.id,
    sourceName: actor.name,
    targetId: receiver.id,
    targetName: receiver.name,
    actionName: action.name,
    effectId: id,
    stat: effect.stat,
    amount: effect.amount,
    die: effect.die,
    currentAc: effect.stat === "ac" ? getEffectiveAc(snapshot, receiver, { source: actor, action }) : null,
    alreadyPresent: !added,
  });
}

export function applyGrantActionEffect(snapshot, actor, target, action, effect, log) {
  const receiver = effect.target === "self" ? actor : target;
  if (!Array.isArray(receiver.actions)) receiver.actions = [];
  const grantedAction = {
    ...structuredClone(effect.action),
    grantedByActionId: action.id,
    duration: structuredClone(effect.duration),
  };
  const existing = receiver.actions.findIndex((item) => item.id === grantedAction.id);
  if (existing >= 0) receiver.actions[existing] = grantedAction;
  else receiver.actions.push(grantedAction);
  log.add("action.granted", {
    round: snapshot.round,
    sourceId: actor.id,
    sourceName: actor.name,
    targetId: receiver.id,
    targetName: receiver.name,
    actionId: grantedAction.id,
    actionName: grantedAction.name,
    sourceActionId: action.id,
  });
}

export function applyTempHpEffect(snapshot, actor, target, action, effect, log) {
  const receiver = effect.target === "self" ? actor : target;
  const before = receiver.tempHp || 0;
  receiver.tempHp = Math.max(before, effect.amount || 0);
  log.add("temp_hp.applied", {
    round: snapshot.round,
    sourceId: actor.id,
    sourceName: actor.name,
    targetId: receiver.id,
    targetName: receiver.name,
    actionName: action.name,
    amount: receiver.tempHp,
    before,
  });
}

export function applyLightSourceEffect(snapshot, actor, target, action, effect, log) {
  const receiver = effect.target === "self" ? actor : target;
  receiver.lightSource = { sourceActionId: action.id, brightFt: effect.brightFt, dimFt: effect.dimFt, duration: structuredClone(effect.duration) };
  logEffect(log, snapshot, actor, receiver, action, `${action.id}_light_${receiver.id}`, "light", effect.brightFt);
}

export function applyMaxHpBonusEffect(snapshot, actor, target, action, effect, log) {
  const receiver = effect.target === "self" ? actor : target;
  const id = `${action.sourceSpellId || action.id}_max_hp_${receiver.id}`;
  receiver.activeEffects ??= [];
  const previous = receiver.activeEffects.find((item) => item.id === id);
  const previousAmount = Number(previous?.amount) || 0;
  const amount = Math.max(0, Number(effect.amount) || 0);
  receiver.maxHp = Math.max(1, receiver.maxHp - previousAmount + amount);
  receiver.hp = Math.min(receiver.maxHp, receiver.hp - previousAmount + amount);
  const record = { id, type: "max_hp_bonus", label: action.name, amount, sourceActionId: action.id, sourceSpellLevel: action.spellLevel, duration: structuredClone(effect.duration) };
  if (previous) Object.assign(previous, record);
  else receiver.activeEffects.push(record);
  logEffect(log, snapshot, actor, receiver, action, id, "max_hp", amount, Boolean(previous));
}

export function applyDeathWardEffect(snapshot, actor, target, action, effect, log) {
  const receiver = effect.target === "self" ? actor : target;
  const resourceId = `${action.sourceSpellId || action.id}_ward_${receiver.id}`;
  receiver.resources ??= [];
  const resource = receiver.resources.find((item) => item.id === resourceId);
  if (resource) resource.current = 1;
  else receiver.resources.push({ id: resourceId, name: action.name, max: 1, current: 1, recovery: "none" });
  receiver.features ??= [];
  const featureId = `${resourceId}_feature`;
  const feature = { id: featureId, name: action.name, effects: { triggeredEffects: [{ id: resourceId, name: action.name, trigger: "would_drop_to_zero", reaction: true, reactionMode: "automatic", consumeReaction: false, resourceId, leaveAtHp: 1 }] } };
  const existing = receiver.features.findIndex((item) => item.id === featureId);
  if (existing >= 0) receiver.features[existing] = feature;
  else receiver.features.push(feature);
  addActiveEffect(receiver, {
    id: `${resourceId}_active`,
    type: "death_ward",
    label: action.name,
    trigger: "passive",
    sourceActionId: action.id,
    sourceSpellLevel: action.spellLevel ?? null,
    sourceActorId: actor.id,
    resourceId,
    duration: structuredClone(effect.duration),
  });
  logEffect(log, snapshot, actor, receiver, action, featureId, "death_ward", 1, existing >= 0);
}

export function applyDispelMagicEffect(snapshot, actor, target, action, effect, log) {
  const receiver = effect.target === "self" ? actor : target;
  const maximumLevel = action.spellLevel || action.baseSpellLevel || 3;
  const effects = (receiver.activeEffects || []).filter((item) => item.sourceActionId && Number(item.sourceSpellLevel || 0) <= maximumLevel);
  const conditions = (receiver.conditions || []).filter((item) => item.sourceActionId && Number(item.sourceSpellLevel || 0) <= maximumLevel);
  receiver.activeEffects = (receiver.activeEffects || []).filter((item) => !effects.includes(item));
  receiver.conditions = (receiver.conditions || []).filter((item) => !conditions.includes(item));
  log.add("effect.removed", { round: snapshot.round, sourceId: actor.id, sourceName: actor.name, targetId: receiver.id, targetName: receiver.name, actionName: action.name, effectId: "spell_effects", count: effects.length + conditions.length });
}

export function applyGreaterRestorationEffect(snapshot, actor, target, action, effect, log) {
  const receiver = effect.target === "self" ? actor : target;
  const removable = (effect.conditions || []).find((condition) => (receiver.conditions || []).some((item) => item.id === condition));
  if (removable) receiver.conditions = receiver.conditions.filter((item) => item.id !== removable);
  else if (effect.removeExhaustion > 0 && Number(receiver.exhaustion || 0) > 0) receiver.exhaustion = Math.max(0, receiver.exhaustion - effect.removeExhaustion);
  else if (effect.removeAbilityOrMaxHpReduction) receiver.activeEffects = (receiver.activeEffects || []).filter((item) => !["ability_reduction", "max_hp_reduction"].includes(item.type));
  log.add("effect.removed", { round: snapshot.round, sourceId: actor.id, sourceName: actor.name, targetId: receiver.id, targetName: receiver.name, actionName: action.name, effectId: removable || "debilitating_effect" });
}

function logEffect(log, snapshot, actor, receiver, action, effectId, stat, amount, alreadyPresent = false) {
  log.add("effect.applied", {
    round: snapshot.round,
    sourceId: actor.id,
    sourceName: actor.name,
    targetId: receiver.id,
    targetName: receiver.name,
    actionName: action.name,
    effectId,
    stat,
    amount,
    alreadyPresent,
  });
}
