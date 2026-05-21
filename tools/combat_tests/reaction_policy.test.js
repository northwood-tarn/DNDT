import { assert } from "./helpers.js";
import { validateCombatAction } from "../../app/combat/actionSchema.js";
import { createSpellAction } from "../../app/combat/actionFactory.js";
import { createReactionPolicyReport } from "../../app/combat/reactionPolicyReport.js";
import { SPELLS } from "../../app/data/spells.js";

export function runReactionPolicyCombatTests() {
  testShieldCreatesCanonicalReactionPolicy();
  testReactionPolicyValidation();
  testReactionPolicyReport();
}

function testShieldCreatesCanonicalReactionPolicy() {
  const shield = createSpellAction(SPELLS.shield, { spellSaveDC: 13 });

  assert.equal(shield.type, "spell_effect", "Shield should become a reaction effect spell");
  assert.equal(shield.reactionPolicy.trigger, "would_be_hit_by_attack", "Shield should use the prompted hit reaction trigger");
  assert.equal(shield.reactionPolicy.cost.policy, "lowest_available", "Shield should spend the lowest available spell slot");
  assert.equal(shield.reactionPolicy.effect.kind, "ac_bonus", "Shield should express its reaction as an AC bonus");
  assert.equal(shield.reactionPolicy.effect.amount, 5, "Shield should carry its +5 AC value");
  assert.deepEqual(validateCombatAction(shield), [], "Shield reaction policy should validate");
}

function testReactionPolicyValidation() {
  const shield = createSpellAction(SPELLS.shield, { spellSaveDC: 13 });
  const invalid = {
    ...shield,
    id: "invalid_shield",
    reactionPolicy: {
      ...shield.reactionPolicy,
      cost: { ...shield.reactionPolicy.cost, minimumLevel: 0 },
    },
  };

  assert.ok(
    validateCombatAction(invalid).some((error) => error.includes("minimumLevel")),
    "reaction policies should reject invalid spell slot costs"
  );
}

function testReactionPolicyReport() {
  const report = createReactionPolicyReport();

  assert.equal(report.totals.errors, 0, "reaction policy report should not find invalid policies");
  assert.equal(report.policies.some((policy) => policy.id === "shield"), true, "Shield should be reported as a reaction policy");
  assert.equal(report.policies.every((policy) => policy.reactionMode === "prompt"), true, "current action-level reaction policies should be prompted");
}
