export const REACTION_TRIGGERS = new Set([
  "would_be_hit_by_attack",
  "takes_damage",
  "source_misses_attack",
  "ally_would_take_critical_hit",
  "would_drop_to_zero",
  "would_drop_to_0_hp",
]);
export const REACTION_MODES = new Set(["prompt", "automatic", "never"]);
const PROMPT_MODES = new Set(["binary"]);
const COST_TYPES = new Set(["spell_slot", "none"]);
const COST_POLICIES = new Set(["lowest_available", "none"]);
const EFFECT_KINDS = new Set(["ac_bonus"]);
const DURATIONS = new Set(["turn_start", "turn_end"]);
const RELEVANCE_TESTS = new Set([
  "would_change_hit",
  "would_prevent_unconscious",
  "critical_only",
  "always",
]);

export const DEFAULT_REACTION_PROMPT_POLICY = {
  onePromptAtATime: true,
  promptByDefaultForLimitedCosts: true,
  suppressIneffectivePrompts: true,
};

export function createHitPreventionAcPolicy({
  id,
  mode = "prompt",
  costType = "spell_slot",
  minimumSlotLevel = 1,
  acBonus = 5,
  priority = 80,
  relevance = "would_change_hit",
} = {}) {
  return {
    id,
    trigger: "would_be_hit_by_attack",
    reactionMode: mode,
    promptMode: "binary",
    relevance,
    offerOnlyIfEffective: relevance === "would_change_hit",
    cost: {
      type: costType,
      policy: costType === "spell_slot" ? "lowest_available" : "none",
      minimumLevel: minimumSlotLevel,
    },
    effect: {
      kind: "ac_bonus",
      amount: acBonus,
      duration: "turn_start",
      preventsTriggeringHit: true,
    },
    priority,
  };
}

export function normalizeReactionPolicy(policy = {}) {
  if (!policy || typeof policy !== "object") return null;
  const reactionMode = policy.reactionMode || "automatic";
  return {
    id: policy.id,
    trigger: policy.trigger,
    reactionMode,
    promptMode: policy.promptMode || (reactionMode === "prompt" ? "binary" : null),
    relevance: policy.relevance || legacyRelevance(policy),
    offerOnlyIfEffective: policy.offerOnlyIfEffective ?? (policy.relevance === "would_change_hit" || policy.offerOnlyIfEffective === true),
    cost: policy.cost || { type: "none", policy: "none" },
    effect: policy.effect || null,
    priority: policy.priority ?? 0,
  };
}

export function isReactionPolicyRelevant(policy, context = {}) {
  const normalized = normalizeReactionPolicy(policy);
  if (normalized.reactionMode === "never") return false;
  if (normalized.relevance === "always") return true;
  if (normalized.relevance === "critical_only") return context.critical === true;
  if (normalized.relevance === "would_prevent_unconscious") return wouldPreventUnconscious(context);
  if (normalized.relevance === "would_change_hit") return wouldChangeHit(normalized, context);
  return true;
}

export function validateReactionPolicy(policy, path = "reactionPolicy") {
  const errors = [];
  if (policy == null) return errors;
  if (!policy || typeof policy !== "object") return [`${path} must be an object`];
  const normalized = normalizeReactionPolicy(policy);
  if (!policy.id) errors.push(`${path}.id is required`);
  if (!REACTION_TRIGGERS.has(normalized.trigger)) errors.push(`${path}.trigger must be one of ${[...REACTION_TRIGGERS].join(", ")}`);
  if (!REACTION_MODES.has(normalized.reactionMode)) errors.push(`${path}.reactionMode must be one of ${[...REACTION_MODES].join(", ")}`);
  if (normalized.reactionMode === "prompt" && !PROMPT_MODES.has(normalized.promptMode)) errors.push(`${path}.promptMode must be one of ${[...PROMPT_MODES].join(", ")}`);
  if (!Number.isFinite(normalized.priority)) errors.push(`${path}.priority must be numeric`);
  if (!RELEVANCE_TESTS.has(normalized.relevance)) errors.push(`${path}.relevance must be one of ${[...RELEVANCE_TESTS].join(", ")}`);
  errors.push(...validateCost(normalized.cost, `${path}.cost`));
  if (normalized.effect) errors.push(...validateEffect(normalized.effect, `${path}.effect`));
  if (normalized.offerOnlyIfEffective != null && typeof normalized.offerOnlyIfEffective !== "boolean") {
    errors.push(`${path}.offerOnlyIfEffective must be boolean`);
  }
  return errors;
}

function legacyRelevance(policy) {
  if (policy.offerOnlyIfEffective) return "would_change_hit";
  return "always";
}

function wouldChangeHit(policy, context) {
  if (policy.effect?.kind !== "ac_bonus") return true;
  const acBonus = policy.effect.amount || 0;
  if (!Number.isFinite(context.total) || !Number.isFinite(context.effectiveAc)) return true;
  return context.total < context.effectiveAc + acBonus;
}

function wouldPreventUnconscious(context) {
  if (!Number.isFinite(context.hpBefore) || !Number.isFinite(context.amount)) return true;
  const tempHp = context.tempHpBefore || 0;
  return context.hpBefore - Math.max(0, context.amount - tempHp) <= 0;
}

function validateCost(cost, path) {
  const errors = [];
  if (!cost || typeof cost !== "object") return [`${path} is required`];
  if (!COST_TYPES.has(cost.type)) errors.push(`${path}.type must be one of ${[...COST_TYPES].join(", ")}`);
  if (!COST_POLICIES.has(cost.policy)) errors.push(`${path}.policy must be one of ${[...COST_POLICIES].join(", ")}`);
  if (cost.type === "spell_slot" && (!Number.isInteger(cost.minimumLevel) || cost.minimumLevel < 1)) {
    errors.push(`${path}.minimumLevel must be a positive integer for spell_slot costs`);
  }
  return errors;
}

function validateEffect(effect, path) {
  const errors = [];
  if (!effect || typeof effect !== "object") return [`${path} is required`];
  if (!EFFECT_KINDS.has(effect.kind)) errors.push(`${path}.kind must be one of ${[...EFFECT_KINDS].join(", ")}`);
  if (effect.kind === "ac_bonus" && !Number.isFinite(effect.amount)) errors.push(`${path}.amount must be numeric for ac_bonus effects`);
  if (!DURATIONS.has(effect.duration)) errors.push(`${path}.duration must be one of ${[...DURATIONS].join(", ")}`);
  if (effect.preventsTriggeringHit != null && typeof effect.preventsTriggeringHit !== "boolean") {
    errors.push(`${path}.preventsTriggeringHit must be boolean`);
  }
  return errors;
}
