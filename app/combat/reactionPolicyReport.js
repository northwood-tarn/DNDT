import { SPELLS } from "../data/spells.js";
import { createSpellAction } from "./actionFactory.js";
import { normalizeReactionPolicy, validateReactionPolicy } from "./reactionPolicy.js";

export function createReactionPolicyReport(spellRegistry = SPELLS) {
  const policies = [];
  const errors = [];

  for (const spell of Object.values(spellRegistry)) {
    const action = createSpellAction(spell, { spellSaveDC: 13, attackBonus: 5 });
    const policy = action?.reactionPolicy;
    if (!policy) continue;
    const normalized = normalizeReactionPolicy(policy);
    const validationErrors = validateReactionPolicy(normalized, `${action.id}.reactionPolicy`);
    if (validationErrors.length) errors.push(...validationErrors);
    policies.push({
      id: normalized.id,
      actionId: action.id,
      actionName: action.name,
      trigger: normalized.trigger,
      reactionMode: normalized.reactionMode,
      promptMode: normalized.promptMode,
      relevance: normalized.relevance,
      cost: structuredClone(normalized.cost),
      effect: structuredClone(normalized.effect),
      priority: normalized.priority,
      validationErrors,
    });
  }

  return {
    totals: {
      policies: policies.length,
      errors: errors.length,
    },
    policies,
    errors,
  };
}
