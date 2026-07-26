import { validateActionEffects, validateEffectDuration } from "./effects.js";
import { validateReactionPolicy } from "./reactionPolicy.js";

const ACTION_TYPES = new Set([
  "weapon_attack",
  "compound_weapon_attack",
  "melee_attack",
  "spell_attack",
  "spell_save",
  "spell_area_save",
  "spell_auto_damage",
  "spell_object",
  "spell_teleport",
  "spell_effect",
  "spell_post_hit",
  "relic_revivify",
  "self_heal",
  "spell_self_heal",
  "consumable",
  "push",
  "target_test",
  "contextual_end_effect",
  "feature_action",
  "dash",
  "dodge",
]);

export function validateCombatAction(action) {
  const errors = [];
  if (!action || typeof action !== "object") return ["action must be an object"];
  if (!action.id) errors.push("action.id is required");
  if (!action.name) errors.push(`${action.id || "action"}.name is required`);
  if (!ACTION_TYPES.has(action.type)) errors.push(`${action.id || "action"}.type ${action.type || "(missing)"} is not registered`);
  errors.push(...validateActionEffects(action.effects, action.id || "action"));
  errors.push(...validateDamageRiders(action.damageRiders, action.id || "action"));
  errors.push(...validateReactionPolicy(action.reactionPolicy, `${action.id || "action"}.reactionPolicy`));
  errors.push(...validateDamageTypeChoices(action));
  errors.push(...validateEffectModeChoices(action));

  if (["weapon_attack", "melee_attack", "spell_attack"].includes(action.type)) {
    requireNumber(action, "range", errors);
    requireNumber(action, "attackBonus", errors);
    requireString(action, "damage", errors);
    requireString(action, "damageType", errors);
  }
  if (action.type === "spell_post_hit") {
    requireNumber(action, "range", errors);
    requireString(action, "damage", errors);
    requireString(action, "damageType", errors);
  }
  if (action.type === "compound_weapon_attack") {
    if (!Array.isArray(action.attacks) || action.attacks.length < 2) {
      errors.push(`${action.id}.attacks must include at least two weapon attacks`);
    } else {
      action.attacks.forEach((attack, index) => {
        const nested = validateCombatAction(attack).map((error) => `${action.id}.attacks[${index}].${error}`);
        errors.push(...nested);
      });
    }
  }
  if (action.type === "spell_save") {
    requireNumber(action, "range", errors);
    requireString(action, "saveAbility", errors);
    requireNumber(action, "spellSaveDC", errors);
    requireDamageOrEffects(action, errors);
  }
  if (action.type === "spell_area_save") {
    requireString(action, "saveAbility", errors);
    requireNumber(action, "spellSaveDC", errors);
    requireDamageOrEffects(action, errors);
    if (!action.targeting || typeof action.targeting !== "object") errors.push(`${action.id}.targeting is required`);
    errors.push(...validateTargeting(action.targeting, action.id));
  }
  if (action.type === "spell_auto_damage") {
    requireNumber(action, "range", errors);
    requireString(action, "damage", errors);
    requireString(action, "damageType", errors);
    requireNumber(action, "hits", errors);
  }
  if (action.type === "spell_object") {
    requireNumber(action, "range", errors);
    if (!action.targeting || typeof action.targeting !== "object") errors.push(`${action.id}.targeting is required`);
    errors.push(...validateTargeting(action.targeting, action.id));
    errors.push(...validateCombatObject(action.object, action.id));
  }
  if (action.type === "spell_teleport") {
    requireNumber(action, "range", errors);
    if (!action.targeting || typeof action.targeting !== "object") errors.push(`${action.id}.targeting is required`);
  }
  if (action.type === "spell_effect") {
    requireNumber(action, "range", errors);
    requireDamageOrEffects(action, errors);
  }
  if (action.type === "self_heal") {
    requireString(action, "healing", errors);
    if (action.requiresTarget !== false) errors.push(`${action.id}.requiresTarget must be false`);
  }
  if (action.type === "spell_self_heal") {
    requireString(action, "healing", errors);
    if (typeof action.requiresTarget !== "boolean") errors.push(`${action.id}.requiresTarget must be boolean`);
  }
  if (action.type === "consumable") {
    requireString(action, "itemId", errors);
    if (action.requiresTarget !== false) errors.push(`${action.id}.requiresTarget must be false`);
  }
  if (action.type === "push") {
    requireNumber(action, "range", errors);
    requireNumber(action, "distanceSquares", errors);
    requireString(action, "collisionDamage", errors);
    requireString(action, "collisionDamageType", errors);
  }
  if (action.type === "target_test") {
    if (action.requiresTarget !== true) errors.push(`${action.id}.requiresTarget must be true`);
  }
  if (action.type === "contextual_end_effect") {
    if (action.requiresTarget !== false) errors.push(`${action.id}.requiresTarget must be false`);
    if (!action.conditionId && !action.effectId) errors.push(`${action.id}.conditionId or effectId is required`);
  }
  if (action.type === "feature_action") {
    if (action.requiresTarget !== false && action.requiresTarget !== true) errors.push(`${action.id}.requiresTarget must be boolean`);
  }
  if (action.type === "dash" || action.type === "dodge") {
    if (action.requiresTarget !== false) errors.push(`${action.id}.requiresTarget must be false`);
  }
  return errors;
}

function validateDamageTypeChoices(action) {
  if (action.damageTypeChoices == null) return [];
  if (!Array.isArray(action.damageTypeChoices) || action.damageTypeChoices.some((item) => typeof item !== "string" || !item)) {
    return [`${action.id || "action"}.damageTypeChoices must be an array of damage type strings`];
  }
  if (action.damageType && !action.damageTypeChoices.includes(action.damageType) && !Array.isArray(action.damageParts)) {
    return [`${action.id || "action"}.damageType must be one of damageTypeChoices`];
  }
  return [];
}

function validateEffectModeChoices(action) {
  if (action.effectModeChoices == null) return [];
  if (!Array.isArray(action.effectModeChoices) || action.effectModeChoices.length === 0) {
    return [`${action.id || "action"}.effectModeChoices must be a non-empty array`];
  }
  const invalid = action.effectModeChoices.some((choice) => !choice || typeof choice.id !== "string" || !choice.id || typeof choice.name !== "string" || !choice.name);
  if (invalid) return [`${action.id || "action"}.effectModeChoices must contain id/name objects`];
  if (action.defaultEffectMode && !action.effectModeChoices.some((choice) => choice.id === action.defaultEffectMode)) {
    return [`${action.id || "action"}.defaultEffectMode must identify an effectModeChoices entry`];
  }
  return [];
}

function validateDamageRiders(riders, actionId) {
  const errors = [];
  if (riders == null) return errors;
  if (!Array.isArray(riders)) return [`${actionId}.damageRiders must be an array`];
  riders.forEach((rider, index) => {
    const path = `${actionId}.damageRiders[${index}]`;
    if (!rider || typeof rider !== "object") {
      errors.push(`${path} must be an object`);
      return;
    }
    requireString(rider, "id", errors);
    requireString(rider, "name", errors);
    if (rider.trigger !== "source_hits_with_attack_roll") errors.push(`${path}.trigger must be source_hits_with_attack_roll`);
    if (typeof rider.damage !== "string" && typeof rider.damage !== "number") errors.push(`${path}.damage must be a string or number`);
    requireString(rider, "damageType", errors);
  });
  return errors;
}

function validateCombatObject(object, actionId) {
  const errors = [];
  if (!object || typeof object !== "object") return [`${actionId}.object is required`];
  if (!object.name) errors.push(`${actionId}.object.name is required`);
  if (object.duration) errors.push(...validateEffectDuration(object.duration, `${actionId}.object.duration`));
  if (object.effects != null) errors.push(...validateActionEffects(object.effects, `${actionId}.object`));
  if (object.cells != null && !Array.isArray(object.cells)) errors.push(`${actionId}.object.cells must be an array`);
  for (const field of ["radiusFt", "innerRadiusFt", "outerRadiusFt", "lengthFt", "sizeFt"]) {
    if (object[field] != null && !Number.isFinite(object[field])) errors.push(`${actionId}.object.${field} must be numeric`);
  }
  return errors;
}

function validateTargeting(targeting, actionId) {
  const errors = [];
  if (!targeting || typeof targeting !== "object") return errors;
  const shapes = new Set(["radius", "line", "cone", "cube", "cell_path"]);
  if (!shapes.has(targeting.shape)) errors.push(`${actionId}.targeting.shape must be one of ${Array.from(shapes).join(", ")}`);
  if (targeting.shape === "cell_path") requireNumber(targeting, "maxCells", errors);
  if (targeting.shape === "radius") requireNumber(targeting, "radiusSquares", errors);
  if (targeting.shape === "line" || targeting.shape === "cone") requireNumber(targeting, "lengthSquares", errors);
  if (targeting.shape === "cube") requireNumber(targeting, "sizeSquares", errors);
  return errors;
}

function requireNumber(action, field, errors) {
  if (!Number.isFinite(action[field])) errors.push(`${action.id || "action"}.${field} must be numeric`);
}

function requireString(action, field, errors) {
  if (!action[field] || typeof action[field] !== "string") errors.push(`${action.id || "action"}.${field} must be a string`);
}

function requireDamageOrEffects(action, errors) {
  const hasDamage = Boolean(action.damage || action.damageType);
  const hasEffects = Array.isArray(action.effects) && action.effects.length > 0;
  if (!hasDamage && !hasEffects) {
    errors.push(`${action.id || "action"} must have damage or effects`);
    return;
  }
  if (hasDamage) {
    requireString(action, "damage", errors);
    requireString(action, "damageType", errors);
  }
}
