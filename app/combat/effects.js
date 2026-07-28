import { conditionRules, getConditionName } from "../data/conditions.js";

export const EFFECT_TRIGGERS = new Set([
  "passive",
  "hit",
  "failed_save",
  "action_resolved",
  "turn_start",
  "turn_end",
  "enter_area",
  "leave_area",
  "damage_taken",
  "area_created",
]);
export const EFFECT_TYPES = new Set([
  "condition", "modifier", "damage", "grant_action", "temp_hp", "forced_movement", "remove_conditions",
  "light_source", "max_hp_bonus", "death_ward", "dispel_magic", "greater_restoration", "aura", "healing_block",
]);
export const EFFECT_TIMINGS = new Set(["turn_start", "turn_end"]);
export const MODIFIER_STATS = new Set([
  "ac",
  "attack_roll",
  "incoming_attack_roll",
  "save",
  "ability_check",
  "d20_test",
  "speed",
  "damage_reduction",
  "ac_formula",
]);

export const CONDITION_RULES = conditionRules;

export function normalizeActionEffects(effects) {
  if (!Array.isArray(effects)) return [];
  return effects.map(normalizeEffect);
}

export function validateActionEffects(effects, actionId = "action") {
  const errors = [];
  if (effects == null) return errors;
  if (!Array.isArray(effects)) return [`${actionId}.effects must be an array`];
  effects.forEach((effect, index) => {
    if (!EFFECT_TYPES.has(effect?.type)) errors.push(`${actionId}.effects[${index}].type must be one of ${Array.from(EFFECT_TYPES).join(", ")}`);
    if (!EFFECT_TRIGGERS.has(effect?.trigger)) errors.push(`${actionId}.effects[${index}].trigger must be one of ${Array.from(EFFECT_TRIGGERS).join(", ")}`);
    if (effect.type === "condition" && !effect.condition) errors.push(`${actionId}.effects[${index}].condition is required`);
    if (effect.type === "modifier" && !MODIFIER_STATS.has(effect.stat)) {
      errors.push(`${actionId}.effects[${index}].stat must be one of ${Array.from(MODIFIER_STATS).join(", ")}`);
    }
    if (effect.type === "damage" && !effect.damage) errors.push(`${actionId}.effects[${index}].damage is required`);
    if (effect.type === "grant_action" && !effect.action) errors.push(`${actionId}.effects[${index}].action is required`);
    if (effect.type === "temp_hp" && !Number.isFinite(effect.amount) && !effect.amountFormula) errors.push(`${actionId}.effects[${index}].amount is required`);
    if (effect.type === "forced_movement" && !Number.isFinite(effect.distanceSquares)) errors.push(`${actionId}.effects[${index}].distanceSquares is required`);
    if (effect.condition && !CONDITION_RULES[effect.condition]) errors.push(`${actionId}.effects[${index}].condition ${effect.condition} is not registered`);
    if (effect.repeatSave && !effect.repeatSave.ability) errors.push(`${actionId}.effects[${index}].repeatSave.ability is required`);
    if (effect.repeatSave?.timing && !EFFECT_TIMINGS.has(effect.repeatSave.timing)) errors.push(`${actionId}.effects[${index}].repeatSave.timing must be one of ${Array.from(EFFECT_TIMINGS).join(", ")}`);
    const durationErrors = validateEffectDuration(effect.duration ?? effect.expires, `${actionId}.effects[${index}].duration`);
    errors.push(...durationErrors);
  });
  return errors;
}

export function normalizeEffect(effect) {
  const type = EFFECT_TYPES.has(effect?.type) ? effect.type : "condition";
  const trigger = EFFECT_TRIGGERS.has(effect?.trigger) ? effect.trigger : "hit";
  const duration = effect.duration ?? effect.expires ?? CONDITION_RULES[effect.condition]?.duration ?? null;
  return {
    type,
    trigger,
    label: effect.label || null,
    condition: effect.condition || null,
    conditionChoices: effect.conditionChoices ? structuredClone(effect.conditionChoices) : null,
    effectModeChoiceKey: effect.effectModeChoiceKey || null,
    conditions: Array.isArray(effect.conditions) ? [...effect.conditions] : [],
    stat: effect.stat || null,
    amount: Number.isFinite(effect.amount) ? effect.amount : 0,
    amountFormula: effect.amountFormula || null,
    multiplier: Number.isFinite(effect.multiplier) ? effect.multiplier : 1,
    mode: effect.mode || null,
    die: effect.die || null,
    ability: effect.ability ? String(effect.ability).toLowerCase() : null,
    tags: Array.isArray(effect.tags) ? [...effect.tags] : [],
    conditionIds: Array.isArray(effect.conditionIds) ? [...effect.conditionIds] : [],
    damageTypes: Array.isArray(effect.damageTypes) ? [...effect.damageTypes] : [],
    damageTypeChoices: Array.isArray(effect.damageTypeChoices) ? [...effect.damageTypeChoices] : [],
    damageType: effect.damageType || null,
    frequency: effect.frequency || null,
    target: effect.target || "target",
    damage: effect.damage || null,
    action: effect.action ? structuredClone(effect.action) : null,
    aura: effect.aura ? structuredClone(effect.aura) : null,
    damageRider: effect.damageRider ? structuredClone(effect.damageRider) : null,
    remainingHits: Number.isFinite(effect.remainingHits) ? effect.remainingHits : null,
    removeWhenSpent: effect.removeWhenSpent === true,
    damageRetaliation: effect.damageRetaliation ? structuredClone(effect.damageRetaliation) : null,
    ongoingEffects: Array.isArray(effect.ongoingEffects) ? structuredClone(effect.ongoingEffects) : [],
    end: effect.end ? structuredClone(effect.end) : null,
    direction: effect.direction || null,
    distanceSquares: Number.isFinite(effect.distanceSquares) ? effect.distanceSquares : 0,
    collisionDamage: effect.collisionDamage || null,
    collisionDamageType: effect.collisionDamageType || null,
    brightFt: Number(effect.brightFt) || 0,
    dimFt: Number(effect.dimFt) || 0,
    maxRemoved: Number(effect.maxRemoved) || null,
    removeExhaustion: Number(effect.removeExhaustion) || 0,
    removeAbilityOrMaxHpReduction: effect.removeAbilityOrMaxHpReduction === true,
    maximumAutomaticSpellLevel: Number(effect.maximumAutomaticSpellLevel) || 0,
    save: effect.save ? structuredClone(effect.save) : null,
    sourceActorOnly: effect.sourceActorOnly === true,
    targetSourceActorOnly: effect.targetSourceActorOnly === true,
    consumeOn: effect.consumeOn || null,
    duration: normalizeEffectDuration(duration),
    repeatSave: normalizeRepeatSave(effect.repeatSave),
    noSave: effect.noSave === true,
    consumeUseOnApply: effect.consumeUseOnApply === true,
    skipDefeated: effect.skipDefeated !== false,
  };
}

export function createConditionInstance(effect, source, action) {
  return {
    id: effect.condition,
    label: conditionName(effect.condition),
    sourceActionId: action.id,
    sourceSpellLevel: action.spellLevel ?? null,
    sourceActorId: source.id,
    sourceReach: effect.sourceReach ?? action.sourceReach ?? action.range ?? null,
    spellSaveDC: action.spellSaveDC ?? null,
    damageRider: effect.damageRider ? structuredClone(effect.damageRider) : null,
    damageRetaliation: effect.damageRetaliation ? structuredClone(effect.damageRetaliation) : null,
    ongoingEffects: Array.isArray(effect.ongoingEffects) ? structuredClone(effect.ongoingEffects) : [],
    end: effect.end ? structuredClone(effect.end) : null,
    duration: cloneDuration(effect.duration),
    repeatSave: effect.repeatSave
      ? {
          timing: effect.repeatSave.timing,
          ability: effect.repeatSave.ability || action.saveAbility,
          dc: effect.repeatSave.dc ?? action.spellSaveDC,
          removeOnSuccess: effect.repeatSave.removeOnSuccess,
          onFailureCondition: effect.repeatSave.onFailureCondition || null,
        }
      : null,
  };
}

export function shouldRepeatSaveAt(condition, timing) {
  return Boolean(condition?.repeatSave && condition.repeatSave.timing === timing);
}

export function advanceConditionDuration(condition, timing) {
  const duration = typeof condition?.duration === "object" && condition.duration
    ? condition.duration
    : normalizeEffectDuration(condition?.duration) || normalizeEffectDuration(condition?.expires);
  if (!duration) return { expired: false };

  if (duration.kind === "until_timing") {
    if (duration.timing !== timing) return { expired: false };
    return {
      expired: true,
      reason: timingReason(timing),
    };
  }

  if (duration.kind === "rounds") {
    if (duration.tick !== timing) return { expired: false };
    if (duration.skipNextTick === true) {
      duration.skipNextTick = false;
      return { expired: false };
    }
    duration.remaining = Math.max(0, (duration.remaining ?? duration.rounds ?? 0) - 1);
    if (duration.remaining > 0) return { expired: false };
    return {
      expired: true,
      reason: `${duration.rounds} round${duration.rounds === 1 ? "" : "s"} elapsed`,
    };
  }

  return { expired: false };
}

export function normalizeEffectDuration(duration) {
  if (duration == null) return null;
  if (typeof duration === "number") {
    return normalizeRoundDuration({ rounds: duration });
  }
  if (typeof duration === "string") {
    if (EFFECT_TIMINGS.has(duration)) {
      return {
        kind: "until_timing",
        timing: duration,
      };
    }
    return null;
  }
  if (typeof duration !== "object") return null;
  if (duration.kind === "until_timing" || EFFECT_TIMINGS.has(duration.timing)) {
    const timing = EFFECT_TIMINGS.has(duration.timing) ? duration.timing : "turn_end";
    return {
      kind: "until_timing",
      timing,
    };
  }
  if (duration.kind === "rounds" || Number.isFinite(duration.rounds)) {
    return normalizeRoundDuration(duration);
  }
  return null;
}

function normalizeRepeatSave(repeatSave) {
  if (!repeatSave) return null;
  return {
    timing: EFFECT_TIMINGS.has(repeatSave.timing) ? repeatSave.timing : "turn_end",
    ability: repeatSave.ability || null,
    dc: repeatSave.dc ?? null,
    removeOnSuccess: repeatSave.removeOnSuccess !== false,
    onFailureCondition: repeatSave.onFailureCondition || null,
  };
}

export function getConditionRules(conditionId) {
  return CONDITION_RULES[conditionId] || {};
}

export function conditionName(conditionId) {
  return getConditionName(conditionId);
}

function cloneDuration(duration) {
  return duration ? structuredClone(duration) : null;
}

function normalizeRoundDuration(duration) {
  const rounds = Math.max(1, Math.floor(Number(duration.rounds ?? duration.remaining ?? 1)));
  const tick = EFFECT_TIMINGS.has(duration.tick) ? duration.tick : "turn_end";
  return {
    kind: "rounds",
    rounds,
    remaining: Math.max(1, Math.floor(Number(duration.remaining ?? rounds))),
    tick,
    ...(duration.anchor === "source" ? { anchor: "source" } : {}),
    ...(duration.skipNextTick === true ? { skipNextTick: true } : {}),
  };
}

export function validateEffectDuration(duration, path) {
  if (duration == null) return [];
  if (typeof duration === "number") return Number.isFinite(duration) && duration > 0 ? [] : [`${path}.rounds must be positive`];
  if (typeof duration === "string") return EFFECT_TIMINGS.has(duration) ? [] : [`${path} must be one of ${Array.from(EFFECT_TIMINGS).join(", ")} or a duration object`];
  if (typeof duration !== "object") return [`${path} must be a timing string, number of rounds, or object`];
  if (duration.kind === "rounds" || Number.isFinite(duration.rounds)) {
    const errors = [];
    if (!Number.isFinite(duration.rounds) || duration.rounds <= 0) errors.push(`${path}.rounds must be positive`);
    if (duration.tick && !EFFECT_TIMINGS.has(duration.tick)) errors.push(`${path}.tick must be one of ${Array.from(EFFECT_TIMINGS).join(", ")}`);
    return errors;
  }
  if (duration.kind === "until_timing" || duration.timing) {
    return EFFECT_TIMINGS.has(duration.timing) ? [] : [`${path}.timing must be one of ${Array.from(EFFECT_TIMINGS).join(", ")}`];
  }
  return [`${path} has an unknown duration shape`];
}

function timingReason(timing) {
  if (timing === "turn_start") return "start of turn";
  if (timing === "turn_end") return "end of turn";
  return timing;
}
