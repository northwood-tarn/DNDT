import { spendResourceUse } from "./actor.js";
import { getActionTags } from "./actionTags.js";
import { targetHasRequiredMark } from "./marks.js";

const ABILITY_TOKEN_TO_MOD = {
  strength_modifier: "str",
  dexterity_modifier: "dex",
  constitution_modifier: "con",
  intelligence_modifier: "int",
  wisdom_modifier: "wis",
  charisma_modifier: "cha",
};

export function collectFeatureDamageRiders(source, target, action, options = {}) {
  const trigger = options.trigger || "source_hits_with_attack_roll";
  return (source?.features || [])
    .flatMap((feature) =>
      (feature.effects?.damageRiders || []).map((rider) => ({
        ...rider,
        id: rider.id || `${feature.id}_damage_rider`,
        name: rider.name || feature.name,
        featureId: feature.id,
        featureName: feature.name,
        featureDamageRider: true,
      }))
    )
    .filter((rider) => damageRiderMatches(source, target, action, rider, { ...options, trigger }));
}

export function markFeatureDamageRiderUsed(source, rider) {
  if (!source || !rider?.featureDamageRider) return;
  if (rider.oncePerTurn) {
    source.turnFlags ??= {};
    source.turnFlags.damageRiders ??= {};
    source.turnFlags.damageRiders[rider.id] = true;
  }
  if (rider.oncePerCombat) {
    source.combatFlags ??= {};
    source.combatFlags.damageRiders ??= {};
    source.combatFlags.damageRiders[rider.id] = true;
  }
  if (rider.resourceId) spendResourceUse(source, rider.resourceId);
}

export function resolveRiderDamageFormula(source, damage) {
  if (typeof damage === "number") return damage;
  const formula = String(damage || "");
  const exact = resolveFormulaToken(source, formula);
  if (exact !== null) return exact;
  return formula.replace(/\b(proficiency_bonus|level|strength_modifier|dexterity_modifier|constitution_modifier|intelligence_modifier|wisdom_modifier|charisma_modifier)\b/g, (token) =>
    String(resolveFormulaToken(source, token) ?? 0)
  );
}

export function resolveRiderDamageType(action, rider) {
  if (["same_as_action", "weapon"].includes(rider?.damageType)) return action?.damageType || "untyped";
  return rider?.damageType || action?.damageType || "untyped";
}

function damageRiderMatches(source, target, action, rider, options) {
  if (!rider || rider.trigger !== options.trigger) return false;
  if (rider.criticalOnly && !options.critical) return false;
  if (rider.oncePerTurn && source?.turnFlags?.damageRiders?.[rider.id]) return false;
  if (rider.oncePerCombat && source?.combatFlags?.damageRiders?.[rider.id]) return false;
  if (rider.resourceId && getResourceUses(source, rider.resourceId) <= 0) return false;
  if (rider.targetHpBelowFraction != null && !targetHpBelowFraction(target, rider.targetHpBelowFraction, options.trigger)) return false;
  if (rider.onlyRound != null && options.snapshot?.round !== rider.onlyRound) return false;
  if (rider.requiresConditionOnTarget && !(target?.conditions || []).some((condition) => condition.id === rider.requiresConditionOnTarget)) return false;
  if (rider.requiresMark && !targetHasRequiredMark(source, target, rider.requiresMark)) return false;
  if (Array.isArray(rider.actionTypes) && !rider.actionTypes.includes(action?.type)) return false;
  if (Array.isArray(rider.actionTags) && !matchesActionTags(action, rider.actionTags)) return false;
  if (Array.isArray(rider.damageTypes) && !rider.damageTypes.includes(action?.damageType)) return false;
  return true;
}

function matchesActionTags(action, requiredTags) {
  const tags = getActionTags(action);
  return requiredTags.every((tag) => tags[tag] === true);
}

function targetHpBelowFraction(target, fraction, trigger) {
  if (!target || !Number.isFinite(target.hp) || !Number.isFinite(target.maxHp) || target.maxHp <= 0) return false;
  const hp = trigger === "source_hits_with_attack_roll" && Number.isFinite(target._hpBeforeLastDamage)
    ? target._hpBeforeLastDamage
    : target.hp;
  return hp / target.maxHp <= fraction;
}

function getResourceUses(actor, resourceId) {
  const resource = (actor?.resources || []).find((item) => item.id === resourceId);
  return resource?.current ?? resource?.max ?? 0;
}

function resolveFormulaToken(source, token) {
  if (token === "proficiency_bonus") return source?.proficiencyBonus || 0;
  if (token === "level") return source?.level || 1;
  const ability = ABILITY_TOKEN_TO_MOD[token];
  if (!ability) return null;
  return Math.max(0, source?.abilityMods?.[ability] || 0);
}
