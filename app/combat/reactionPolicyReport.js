import { SPELLS } from "../data/spells.js";
import { createSpellAction } from "./actionFactory.js";
import { validateReactionPolicy } from "./reactionPolicy.js";

export function createReactionPolicyReport(spellRegistry = SPELLS) {
  const policies = [];
  const errors = [];

  for (const spell of Object.values(spellRegistry)) {
    const action = createSpellAction(spell, { spellSaveDC: 13, attackBonus: 5 });
    const policy = action?.reactionPolicy;
    if (!policy) continue;
    const validationErrors = validateReactionPolicy(policy, `${action.id}.reactionPolicy`);
    if (validationErrors.length) errors.push(...validationErrors);
    policies.push({
      id: policy.id,
      actionId: action.id,
      actionName: action.name,
      trigger: policy.trigger,
      reactionMode: policy.reactionMode,
      promptMode: policy.promptMode,
      cost: structuredClone(policy.cost),
      effect: structuredClone(policy.effect),
      priority: policy.priority,
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
