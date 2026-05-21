import { distance } from "./grid.js";
import { conditionName, getConditionRules } from "./effects.js";
import { collectSaveRollModeDetails } from "./modifiers.js";

export function rollConditionSave(actor, condition, repeatSave, dice) {
  return rollSaveD20(actor, {
    name: conditionName(condition.id),
    saveAbility: repeatSave.ability,
  }, dice);
}

export function rollSaveD20(target, action, dice, snapshot = null, source = null) {
  const reasons = [];
  const autoFail = getAutoFailSaveCondition(target, action.saveAbility);
  if (autoFail) {
    reasons.push(`${conditionName(autoFail)} automatically fails ${String(action.saveAbility).toUpperCase()} saves`);
    return { roll: 0, rolls: [], mode: "auto_fail", reasons, autoFail: true };
  }
  let advantage = 0;
  for (const modifier of collectSaveRollModeDetails(snapshot, target, action.saveAbility, action, source)) {
    if (modifier.mode === "advantage") {
      advantage += 1;
      reasons.push(`ADV: ${modifier.label}`);
    }
    if (modifier.mode === "disadvantage") {
      advantage -= 1;
      reasons.push(`DIS: ${modifier.label}`);
    }
  }
  if (action.saveAbility === "dex") {
    for (const condition of target.conditions || []) {
      const id = conditionId(condition);
      const rules = getConditionRules(id);
      if (!rules.dexSaveDisadvantage) continue;
      advantage -= 1;
      reasons.push(`DIS: ${conditionName(id)} on DEX saves`);
    }
  }
  if (advantage === 0) {
    const d20 = dice.rollD20({ type: "save", label: action.name });
    return { roll: d20.roll, rolls: [d20.roll], mode: "normal", reasons, autoFail: false };
  }
  const first = dice.rollD20({ type: "save", label: action.name });
  const second = dice.rollD20({ type: "save", label: action.name });
  const rolls = [first.roll, second.roll];
  return {
    roll: advantage > 0 ? Math.max(...rolls) : Math.min(...rolls),
    rolls,
    mode: advantage > 0 ? "advantage" : "disadvantage",
    reasons,
    autoFail: false,
  };
}

export function isCriticalHitFromConditions(actor, target, action, attackRoll) {
  if ((target.conditions || []).some((condition) => getConditionRules(conditionId(condition)).suppressIncomingCriticalHits)) return false;
  if (attackRoll.roll === 20) return true;
  if (!isMeleeAttackHit(actor, target, action)) return false;
  return (target.conditions || []).some((condition) => {
    const id = conditionId(condition);
    return Boolean(id && getConditionRules(id).meleeHitWithin5ftCritical);
  });
}

function getAutoFailSaveCondition(actor, ability) {
  const normalizedAbility = String(ability || "").toLowerCase();
  for (const condition of actor.conditions || []) {
    const id = conditionId(condition);
    const rules = getConditionRules(id);
    if (Array.isArray(rules.autoFailSaves) && rules.autoFailSaves.includes(normalizedAbility)) return id;
  }
  return null;
}

function isMeleeAttackHit(actor, target, action) {
  if (distance(actor.position, target.position) > 1) return false;
  return action.melee === true || action.type === "melee_attack" || action.range <= 1;
}

function conditionId(condition) {
  return typeof condition === "string" ? condition : condition?.id;
}
