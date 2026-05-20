import {
  addCondition,
  getItemQuantity,
  getMovementRemaining,
  hasBonusAction,
  hasConditionRule,
  increaseMovementMax,
  removeCondition,
  spendActionCost,
  spendBonusAction,
  spendItem,
  syncContextualActions,
} from "./actor.js";
import { conditionName, getConditionRules, normalizeEffectDuration } from "./effects.js";
import { removeActiveEffect } from "./modifiers.js";
import { getConsumableById } from "../data/consumables.js";

export function resolveDash(snapshot, actor, action, log) {
  const before = getMovementRemaining(actor);
  increaseMovementMax(actor, actor.speed);
  if (action.cost === "action" && !actor.economy?.actionAvailable && hasConditionRule(actor, "grantsBonusDash") && hasBonusAction(actor)) {
    spendBonusAction(actor);
  } else {
    spendActionCost(actor, action.cost);
  }
  log.add("dash", {
    round: snapshot.round,
    actorId: actor.id,
    actorName: actor.name,
    addedMovement: actor.speed,
    movementBefore: before,
    movementAfter: getMovementRemaining(actor),
  });
  return true;
}

export function resolveDodge(snapshot, actor, action, log) {
  addCondition(actor, {
    id: "dodging",
    label: conditionName("dodging"),
    duration: normalizeEffectDuration(getConditionRules("dodging").duration),
  });
  spendActionCost(actor, action.cost);
  log.add("dodge", {
    round: snapshot.round,
    actorId: actor.id,
    actorName: actor.name,
    expires: "start of next turn",
  });
  return true;
}

export function resolveContextualEndEffect(snapshot, actor, action, dice, log) {
  if (action.check && !resolveContextualCheck(snapshot, actor, action, dice, log)) {
    spendActionCost(actor, action.cost);
    return true;
  }

  let removed = false;
  if (action.conditionId) {
    removed = removeCondition(actor, action.conditionId) || removed;
    if (removed) {
      log.add("condition.removed", {
        round: snapshot.round,
        actorId: actor.id,
        actorName: actor.name,
        condition: action.conditionId,
        reason: action.name,
        endId: action.endId || null,
      });
    }
  }
  if (action.effectId) {
    removed = removeActiveEffect(actor, action.effectId) || removed;
    if (removed) {
      log.add("effect.removed", {
        round: snapshot.round,
        actorId: actor.id,
        actorName: actor.name,
        effectId: action.effectId,
        label: action.name,
        reason: action.name,
        endId: action.endId || null,
      });
    }
  }
  if (!removed) {
    log.add("target.invalid", {
      round: snapshot.round,
      actorId: actor.id,
      actorName: actor.name,
      targetName: action.name,
      reason: "effect is no longer present",
    });
    syncContextualActions(actor);
    return false;
  }
  spendActionCost(actor, action.cost);
  syncContextualActions(actor);
  return true;
}

export function resolveConsumable(snapshot, actor, action, dice, log) {
  const itemId = action.itemId;
  const item = getConsumableById(itemId);
  if (!item) {
    log.add("target.invalid", {
      round: snapshot.round,
      actorId: actor.id,
      actorName: actor.name,
      targetName: actor.name,
      reason: `missing consumable data for ${itemId}`,
    });
    return false;
  }
  if (getItemQuantity(actor, itemId) <= 0) {
    log.add("target.invalid", {
      round: snapshot.round,
      actorId: actor.id,
      actorName: actor.name,
      targetName: actor.name,
      reason: `${item.name || itemId} is not in stock`,
    });
    return false;
  }
  if (actor.hp >= actor.maxHp) {
    log.add("target.invalid", {
      round: snapshot.round,
      actorId: actor.id,
      actorName: actor.name,
      targetName: actor.name,
      reason: "already at full health",
    });
    return false;
  }
  const healingDice = action.healing || item.combat?.healing || parseHealingDice(item.effect);
  if (!healingDice) {
    log.add("target.invalid", {
      round: snapshot.round,
      actorId: actor.id,
      actorName: actor.name,
      targetName: actor.name,
      reason: `${item.name || itemId} has no combat resolver yet`,
    });
    return false;
  }
  const rolled = dice.rollDamage(healingDice);
  const hpBefore = actor.hp;
  actor.hp = Math.min(actor.maxHp, actor.hp + Math.max(0, rolled.total));
  if (item.consumeOnUse !== false) spendItem(actor, itemId, 1);
  spendActionCost(actor, action.cost);
  log.add("healing.roll", {
    round: snapshot.round,
    actorId: actor.id,
    actorName: actor.name,
    label: item.name || action.name,
    dice: healingDice,
    rolls: rolled.rolls,
    modifier: rolled.modifier,
    total: rolled.total,
  });
  log.add("healing.applied", {
    round: snapshot.round,
    actorId: actor.id,
    actorName: actor.name,
    amount: actor.hp - hpBefore,
    hpBefore,
    hpAfter: actor.hp,
    itemId,
    remaining: getItemQuantity(actor, itemId),
  });
  return true;
}

export function resolveSelfHeal(snapshot, actor, action, dice, log) {
  if (actor.hp >= actor.maxHp) {
    log.add("target.invalid", {
      round: snapshot.round,
      actorId: actor.id,
      actorName: actor.name,
      targetName: actor.name,
      reason: "already at full health",
    });
    return false;
  }
  const healingDice = action.healing || "1d6";
  const rolled = dice.rollDamage(healingDice);
  const hpBefore = actor.hp;
  actor.hp = Math.min(actor.maxHp, actor.hp + Math.max(0, rolled.total));
  spendActionCost(actor, action.cost);
  log.add("healing.roll", {
    round: snapshot.round,
    actorId: actor.id,
    actorName: actor.name,
    label: action.name,
    dice: healingDice,
    rolls: rolled.rolls,
    modifier: rolled.modifier,
    total: rolled.total,
  });
  log.add("healing.applied", {
    round: snapshot.round,
    actorId: actor.id,
    actorName: actor.name,
    amount: actor.hp - hpBefore,
    hpBefore,
    hpAfter: actor.hp,
    remaining: null,
  });
  return true;
}

function resolveContextualCheck(snapshot, actor, action, dice, log) {
  if (!dice?.rollD20) return false;
  const ability = String(action.check.ability || "").toLowerCase();
  const roll = dice.rollD20({ type: "ability_check", label: action.name });
  const bonus = abilityModifier(actor, ability);
  const total = roll.roll + bonus;
  const success = total >= action.check.dc;
  log.add("ability_check.roll", {
    round: snapshot.round,
    actorId: actor.id,
    actorName: actor.name,
    actionId: action.id,
    actionName: action.name,
    ability,
    roll: roll.roll,
    bonus,
    total,
    dc: action.check.dc,
  });
  log.add("ability_check.result", {
    round: snapshot.round,
    actorId: actor.id,
    actorName: actor.name,
    actionId: action.id,
    actionName: action.name,
    success,
  });
  return success;
}

function abilityModifier(actor, ability) {
  if (Number.isFinite(actor?.abilityMods?.[ability])) return actor.abilityMods[ability];
  if (Number.isFinite(actor?.abilities?.[ability])) return Math.floor((actor.abilities[ability] - 10) / 2);
  if (Number.isFinite(actor?.saves?.[ability])) return actor.saves[ability];
  return 0;
}

function parseHealingDice(effect) {
  const match = String(effect || "").match(/(\d*d\d+\s*(?:[+-]\s*\d+)?)/i);
  return match ? match[1].replace(/\s+/g, "") : null;
}
