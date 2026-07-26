import { assert } from "./helpers.js";
import { createEnemyCombatActor } from "../../app/combat/enemyFactory.js";
import { resolveSaveSpell } from "../../app/combat/saveResolution.js";
import { resolveInlineSave } from "../../app/combat/combatSaveResolution.js";
import {
  applyLegendaryResistance,
  draftedLegendaryResistanceCount,
  LEGENDARY_RESISTANCE_RESOURCE_ID,
} from "../../app/combat/legendaryResistance.js";

export function runLegendaryResistanceCombatTests() {
  testCampaignDraftingDefaults();
  testEnemyResourceCreationAndOverride();
  testControlSaveSpending();
  testDirectSpellSaveIntegration();
  testInlineSaveIntegration();
  testOrdinarySaveConservation();
  testLethalDamageSpending();
}

function testCampaignDraftingDefaults() {
  assert.equal(draftedLegendaryResistanceCount({ campaignAct: 2, actProgress: 0.49, enemyRank: "major" }), 0);
  assert.equal(draftedLegendaryResistanceCount({ campaignAct: 2, actProgress: 0.5, enemyRank: "major" }), 1);
  assert.equal(draftedLegendaryResistanceCount({ campaignAct: 2, actProgress: 0.8, enemyRank: "major_boss" }), 2);
  assert.equal(draftedLegendaryResistanceCount({ campaignAct: 3, enemyRank: "major" }), 1);
  assert.equal(draftedLegendaryResistanceCount({ campaignAct: 3, enemyRank: "major_boss" }), 2);
  assert.equal(draftedLegendaryResistanceCount({ campaignAct: 3, enemyRank: "endgame_boss" }), 3);
  assert.equal(draftedLegendaryResistanceCount({ campaignAct: 3, enemyRank: "endgame_boss", legendaryResistances: 1 }), 1);
}

function testEnemyResourceCreationAndOverride() {
  const actor = createEnemyCombatActor(enemySource({ campaignAct: 3, enemyRank: "major" }));
  const resource = actor.resources.find((item) => item.id === LEGENDARY_RESISTANCE_RESOURCE_ID);
  assert.equal(resource.max, 1);
  assert.equal(resource.current, 1);

  const overridden = createEnemyCombatActor(enemySource({ legendaryResistances: 3 }));
  assert.equal(overridden.resources.find((item) => item.id === LEGENDARY_RESISTANCE_RESOURCE_ID).max, 3);
}

function testControlSaveSpending() {
  const target = enemyTarget(2);
  const events = [];
  const result = applyLegendaryResistance({
    snapshot: { round: 4 },
    target,
    success: false,
    action: { id: "hold_foe", name: "Hold Foe", effects: [{ trigger: "failed_save", condition: "restrained" }] },
    log: { add: (type, detail) => events.push({ type, detail }) },
    total: 11,
    dc: 15,
  });
  assert.equal(result.success, true);
  assert.equal(result.used, true);
  assert.equal(target.resources[0].current, 1);
  assert.equal(events[0].type, "legendary_resistance.used");
  assert.equal(events[0].detail.remaining, 1);
}

function testOrdinarySaveConservation() {
  const target = enemyTarget(1);
  const result = applyLegendaryResistance({
    target,
    success: false,
    action: { id: "minor_debuff", name: "Minor Debuff" },
  });
  assert.equal(result.success, false);
  assert.equal(result.used, false);
  assert.equal(target.resources[0].current, 1);
}

function testDirectSpellSaveIntegration() {
  const target = { ...enemyTarget(1), position: { x: 2, y: 1 }, saves: { wis: 0 }, conditions: [], activeEffects: [] };
  const source = { id: "cleric", name: "Cleric", team: "heroes", hp: 30, maxHp: 30, position: { x: 1, y: 1 } };
  const snapshot = { round: 1, actors: [source, target], objects: [], grid: { width: 5, height: 5, blocked: new Set(), cover: new Map() } };
  const events = [];
  const log = { add: (type, detail) => events.push({ type, detail }) };
  resolveSaveSpell(snapshot, source, target, {
    id: "hold_foe",
    sourceSpellId: "hold_foe",
    name: "Hold Foe",
    saveAbility: "wis",
    spellSaveDC: 15,
    effects: [{ type: "condition", trigger: "failed_save", condition: "restrained" }],
  }, fixedDice(5), log);
  assert.equal(target.resources[0].current, 0);
  assert.equal(events.find((event) => event.type === "save.result").detail.success, true);
  assert.equal(target.conditions.length, 0);
}

function testInlineSaveIntegration() {
  const target = { ...enemyTarget(1), saves: { wis: 0 }, conditions: [], activeEffects: [] };
  const source = { id: "wizard", name: "Wizard", team: "heroes" };
  const events = [];
  const result = resolveInlineSave(
    { round: 2, actors: [source, target] },
    source,
    target,
    { name: "Binding Field", condition: "restrained", save: { ability: "wis", dc: 15, onSave: "negates" } },
    fixedDice(4),
    { add: (type, detail) => events.push({ type, detail }) },
  );
  assert.equal(result.success, true);
  assert.equal(target.resources[0].current, 0);
  assert.equal(events.some((event) => event.type === "legendary_resistance.used"), true);
}

function testLethalDamageSpending() {
  const target = enemyTarget(1, 12, 60);
  const result = applyLegendaryResistance({
    target,
    success: false,
    action: { id: "disintegrate", name: "Disintegrate", damage: "10d6+40" },
  });
  assert.equal(result.success, true);
  assert.equal(target.resources[0].current, 0);
}

function enemyTarget(count, hp = 50, maxHp = hp) {
  return {
    id: "boss",
    name: "Boss",
    team: "enemies",
    hp,
    maxHp,
    resources: [{ id: LEGENDARY_RESISTANCE_RESOURCE_ID, name: "Legendary Resistance", max: count, current: count }],
    activeEffects: [],
  };
}

function enemySource(overrides = {}) {
  return {
    id: "test_boss",
    name: "Test Boss",
    role: "defender",
    creatureType: "humanoid",
    size: "medium",
    hp: 100,
    maxHp: 100,
    ac: 18,
    speed: 6,
    saves: {},
    actionRefs: [],
    ...overrides,
  };
}

function fixedDice(d20) {
  return {
    rollD20: () => ({ roll: d20, rolls: [d20], mode: "normal", reasons: [], autoFail: false }),
    rollDamage: () => ({ total: 1, rolls: [1], modifier: 0 }),
  };
}
