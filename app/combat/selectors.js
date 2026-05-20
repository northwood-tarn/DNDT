import { getActionUses, getItemQuantity, getMovementRemaining, syncContextualActions } from "./actor.js";
import { classifyCover, getCoverAt } from "./cover.js";
import { actorAt, findReachable, keyOf } from "./grid.js";
import { currentActor, livingActors } from "./resolver.js";
import { canTargetAction, canUseAction } from "./rules.js";

export function getCurrentActor(snapshot) {
  const actor = currentActor(snapshot);
  syncContextualActions(actor);
  return actor;
}

export function getActionById(actor, actionId) {
  if (!actor || !actionId) return null;
  syncContextualActions(actor);
  return actor.actions.find((action) => action.id === actionId) || null;
}

export function getReachableSquares(snapshot, actorId) {
  const actor = getActorById(snapshot, actorId);
  if (!actor || actor.hp <= 0) return [];
  return findReachable(snapshot, actor, getMovementRemaining(actor)).map(({ pos, steps }) => ({ pos, steps }));
}

export function getReachableSquareKeys(snapshot, actorId) {
  return new Set(getReachableSquares(snapshot, actorId).map(({ pos }) => keyOf(pos)));
}

export function getValidTargets(snapshot, actorId, actionId) {
  const actor = getActorById(snapshot, actorId);
  syncContextualActions(actor);
  const action = getActionById(actor, actionId);
  if (!actor || !action || actor.hp <= 0 || !canSelectCombatAction(snapshot, actorId, actionId)) return [];
  if (action.requiresTarget === false) return [];
  if (action.type === "target_test" || action.type === "spell_area_save" || action.type === "spell_object") return [];

  const candidates = action.allowDefeatedTarget ? (snapshot.actors || []) : livingActors(snapshot);
  return candidates
    .filter((target) => canTargetAction(snapshot, actor, action, target).ok);
}

export function getValidTargetKeys(snapshot, actorId, actionId) {
  return new Set(getValidTargets(snapshot, actorId, actionId).map((target) => keyOf(target.position)));
}

export function getCoverAtSquare(snapshot, pos) {
  return getCoverAt(snapshot.grid, pos);
}

export function getTargetCover(snapshot, actorId, actionId, targetId) {
  const actor = getActorById(snapshot, actorId);
  const action = getActionById(actor, actionId);
  const target = getActorById(snapshot, targetId);
  return classifyCover(snapshot, actor, target, action);
}

export function isValidTarget(snapshot, actorId, actionId, targetId) {
  return getValidTargets(snapshot, actorId, actionId).some((target) => target.id === targetId);
}

export function getActorEconomyView(snapshot, actorId) {
  const actor = getActorById(snapshot, actorId);
  if (!actor) return [];

  const movementMax = actor.economy?.movementMax ?? actor.speed;
  const movementUsed = actor.economy?.movementUsed ?? (actor.speed - getMovementRemaining(actor));
  return [
    {
      id: "movement",
      label: "Move",
      value: `${movementUsed}/${movementMax}`,
      spent: getMovementRemaining(actor) <= 0,
    },
    {
      id: "action",
      label: "Action",
      value: actor.economy?.actionAvailable === false ? "Used" : "Ready",
      spent: actor.economy?.actionAvailable === false,
    },
    {
      id: "bonus",
      label: "Bonus",
      value: actor.economy?.bonusActionAvailable === false ? "Used" : "Ready",
      spent: actor.economy?.bonusActionAvailable === false,
      idle: actor.economy?.bonusActionAvailable !== false,
    },
    {
      id: "reaction",
      label: "Reaction",
      value: actor.economy?.reactionAvailable === false ? "Used" : "Ready",
      spent: actor.economy?.reactionAvailable === false,
      idle: actor.economy?.reactionAvailable !== false,
    },
  ];
}

export function canSelectAction(snapshot, actorId) {
  const actor = getActorById(snapshot, actorId);
  syncContextualActions(actor);
  return !!actor && actor.hp > 0 && actor.actions.some((action) => canSelectCombatAction(snapshot, actor.id, action.id));
}

export function canSelectCombatAction(snapshot, actorId, actionId) {
  const actor = getActorById(snapshot, actorId);
  syncContextualActions(actor);
  const action = getActionById(actor, actionId);
  if (!actor || !action || actor.hp <= 0 || !canUseAction(actor, action).ok) return false;
  if (action.itemId && getItemQuantity(actor, action.itemId) <= 0) return false;
  if (action.type === "consumable" && actor.hp >= actor.maxHp) return false;
  if ((action.type === "self_heal" || action.type === "spell_self_heal") && actor.hp >= actor.maxHp) return false;
  return true;
}

export function getActionLabel(snapshot, actorId, actionId) {
  const actor = getActorById(snapshot, actorId);
  syncContextualActions(actor);
  const action = getActionById(actor, actionId);
  if (!actor || !action) return "";
  if (action.type === "consumable") {
    return `${action.name} (${getItemQuantity(actor, action.itemId)})`;
  }
  if (Number.isFinite(getActionUses(action))) {
    return `${action.name} (${getActionUses(action)})`;
  }
  return action.name;
}

export function actionRequiresTarget(snapshot, actorId, actionId) {
  const actor = getActorById(snapshot, actorId);
  const action = getActionById(actor, actionId);
  return action?.requiresTarget !== false;
}

export function hasAnyUsefulOption(snapshot, actorId) {
  const actor = getActorById(snapshot, actorId);
  syncContextualActions(actor);
  if (!actor || actor.hp <= 0) return false;

  const hasMovement = getMovementRemaining(actor) > 0 && getReachableSquares(snapshot, actor.id).length > 1;
  const hasUsableAction = actor.actions.some((action) => {
    if (!canSelectCombatAction(snapshot, actor.id, action.id)) return false;
    if (action.type === "target_test" || action.type === "spell_area_save" || action.type === "spell_object") return true;
    return action.requiresTarget === false || getValidTargets(snapshot, actor.id, action.id).length > 0;
  });
  return hasMovement || hasUsableAction;
}

export function getOccupantForDisplay(snapshot, pos) {
  return actorAt(snapshot, pos) ||
    snapshot.actors.find((actor) => actor.hp <= 0 && actor.position.x === pos.x && actor.position.y === pos.y) ||
    null;
}

export function getLivingOccupant(snapshot, pos) {
  return actorAt(snapshot, pos);
}

export function canPlayerAct(snapshot, actorId, uiBusy = false) {
  const actor = getActorById(snapshot, actorId);
  return !uiBusy && !snapshot.outcome && actor?.team === "heroes" && actor.hp > 0;
}

function getActorById(snapshot, actorId) {
  return snapshot.actors.find((actor) => actor.id === actorId) || null;
}
