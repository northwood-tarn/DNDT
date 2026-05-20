import { addActiveEffect } from "./modifiers.js";

export function applyModifierEffect(snapshot, actor, target, action, effect, log) {
  const receiver = effect.target === "self" ? actor : target;
  const id = `${action.id}_${effect.stat}_${receiver.id}`;
  const added = addActiveEffect(receiver, {
    ...effect,
    id,
    label: effect.label || action.name,
    trigger: "passive",
    sourceActionId: action.id,
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
