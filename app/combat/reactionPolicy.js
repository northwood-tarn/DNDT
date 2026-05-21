const REACTION_TRIGGERS = new Set(["would_be_hit_by_attack"]);
const REACTION_MODES = new Set(["prompt", "automatic"]);
const PROMPT_MODES = new Set(["binary"]);
const COST_TYPES = new Set(["spell_slot", "none"]);
const COST_POLICIES = new Set(["lowest_available", "none"]);
const EFFECT_KINDS = new Set(["ac_bonus"]);
const DURATIONS = new Set(["turn_start", "turn_end"]);

export function createHitPreventionAcPolicy({
  id,
  mode = "prompt",
  costType = "spell_slot",
  minimumSlotLevel = 1,
  acBonus = 5,
  priority = 80,
} = {}) {
  return {
    id,
    trigger: "would_be_hit_by_attack",
    reactionMode: mode,
    promptMode: "binary",
    offerOnlyIfEffective: true,
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

export function validateReactionPolicy(policy, path = "reactionPolicy") {
  const errors = [];
  if (policy == null) return errors;
  if (!policy || typeof policy !== "object") return [`${path} must be an object`];
  if (!policy.id) errors.push(`${path}.id is required`);
  if (!REACTION_TRIGGERS.has(policy.trigger)) errors.push(`${path}.trigger must be one of ${[...REACTION_TRIGGERS].join(", ")}`);
  if (!REACTION_MODES.has(policy.reactionMode)) errors.push(`${path}.reactionMode must be one of ${[...REACTION_MODES].join(", ")}`);
  if (policy.reactionMode === "prompt" && !PROMPT_MODES.has(policy.promptMode)) errors.push(`${path}.promptMode must be one of ${[...PROMPT_MODES].join(", ")}`);
  if (!Number.isFinite(policy.priority)) errors.push(`${path}.priority must be numeric`);
  errors.push(...validateCost(policy.cost, `${path}.cost`));
  errors.push(...validateEffect(policy.effect, `${path}.effect`));
  if (policy.offerOnlyIfEffective != null && typeof policy.offerOnlyIfEffective !== "boolean") {
    errors.push(`${path}.offerOnlyIfEffective must be boolean`);
  }
  return errors;
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
