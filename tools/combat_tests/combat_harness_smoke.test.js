import { assert } from "./helpers.js";
import { isAreaTargetingAction } from "../../app/combat_test/targetingUi.js";
import {
  isMultiTargetAction,
  multiTargetConfirmState,
  toggleTargetAssignment,
} from "../../app/combat_test/targetAssignmentModel.js";

export function runCombatHarnessSmokeTests() {
  testAreaActionsUseTargetingPanel();
  testBlessStyleUniqueMultiTargetSelection();
  testPerHitRepeatedTargetSelection();
}

function testAreaActionsUseTargetingPanel() {
  const breathWeapon = {
    id: "breath_weapon",
    name: "Breath Weapon",
    type: "feature_action",
    requiresTarget: true,
    targeting: { shape: "cone", lengthSquares: 3, lengthFt: 15 },
  };
  assert.equal(isAreaTargetingAction(breathWeapon), true, "Breath Weapon should use the combat harness area targeting panel");
}

function testBlessStyleUniqueMultiTargetSelection() {
  const bless = {
    id: "bless",
    type: "spell_effect",
    requiresTarget: true,
    maxTargets: 3,
  };
  assert.equal(isMultiTargetAction(bless), true, "Bless should be treated as a multi-target action");
  let selected = [];
  selected = toggleTargetAssignment(selected, "ally_one", bless);
  selected = toggleTargetAssignment(selected, "ally_two", bless);
  assert.deepEqual(selected, ["ally_one", "ally_two"], "unique multi-target selection should accumulate allies");
  assert.equal(multiTargetConfirmState(bless, selected).disabled, false, "Bless can confirm one or more selected targets");
  selected = toggleTargetAssignment(selected, "ally_one", bless);
  assert.deepEqual(selected, ["ally_two"], "clicking a selected unique target should remove it");
}

function testPerHitRepeatedTargetSelection() {
  const magicMissile = {
    id: "magic_missile",
    type: "spell_auto_damage",
    requiresTarget: true,
    maxTargets: 3,
    targetAssignments: "per_hit",
    allowRepeatedTargets: true,
    requireExactTargetCount: true,
  };
  let selected = [];
  selected = toggleTargetAssignment(selected, "enemy", magicMissile);
  selected = toggleTargetAssignment(selected, "enemy", magicMissile);
  assert.deepEqual(selected, ["enemy", "enemy"], "per-hit targeting should allow stacked assignments before the count is full");
  assert.equal(multiTargetConfirmState(magicMissile, selected).disabled, true, "per-hit targeting should require every hit to be assigned");
  selected = toggleTargetAssignment(selected, "second_enemy", magicMissile);
  assert.deepEqual(selected, ["enemy", "enemy", "second_enemy"], "per-hit targeting should preserve assignment order");
  assert.equal(multiTargetConfirmState(magicMissile, selected).disabled, false, "per-hit targeting can confirm when all hits are assigned");
  selected = toggleTargetAssignment(selected, "enemy", magicMissile);
  assert.deepEqual(selected, ["enemy", "second_enemy"], "clicking a repeated target after full assignment should remove one assignment");
}
