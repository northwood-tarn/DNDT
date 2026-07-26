import {
  assert,
  createCombatController,
  createCombatLog,
  createEnemyCombatActor,
  createSnapshotFromScenario,
  fixedDice,
  resolveAction,
  resolveCharacterSheet,
  resolvedSheetToCombatActor,
  scriptedDice,
  startTurn,
  validateCombatActor,
} from "./helpers.js";
import { preflightAction } from "../../app/combat/actionResult.js";
import { createSpellAction } from "../../app/combat/actionFactory.js";
import { SPELLS } from "../../app/data/spells.js";
import { buildSpecs, draftFor } from "./build_matrix_smoke.test.js";

const COVERAGE_LEVELS = [1, 3, 5, 7, 9, 11, 13];

export function runGeneratedActionCoverageTests() {
  runTargetedActionCategoryTests();
  const coverage = new Map();
  for (const spec of buildSpecs(COVERAGE_LEVELS)) {
    assertGeneratedActionsResolve(spec, coverage);
  }
  assert.ok(coverage.size > 0, "generated action coverage did not observe any action categories");
}

function runTargetedActionCategoryTests() {
  testSelfTargetActionResolves();
  testEnemyTargetActionResolves();
  testAreaAnchorActionResolves();
  testObjectPlacementActionResolves();
  testReactionPromptActionResolves();
  testResourceGatedActionAndDepletion();
}

function testSelfTargetActionResolves() {
  const { snapshot, actor, log } = targetedHarness();
  actor.actions = [createSpellAction(SPELLS.armor_of_agathys, { spellSaveDC: 13 })];

  assert.equal(preflightAction(snapshot, actor, "armor_of_agathys", null).ok, true, "self action should preflight without a target");
  assert.equal(resolveAction(snapshot, actor, "armor_of_agathys", null, scriptedDice(), log), true, "self action should resolve");
  assert.equal(actor.tempHp, 5, "self action should apply its self effect");
}

function testEnemyTargetActionResolves() {
  const { snapshot, actor, enemy, log } = targetedHarness();
  actor.actions = [createSpellAction(SPELLS.fire_bolt, { attackBonus: 5, casterLevel: 5 })];

  assert.equal(preflightAction(snapshot, actor, "fire_bolt", enemy.id).ok, true, "enemy action should preflight against an enemy target");
  assert.equal(resolveAction(snapshot, actor, "fire_bolt", enemy.id, scriptedDice({ d20: [15], damage: 6 }), log), true, "enemy action should resolve");
  assert.equal(enemy.hp, 14, "enemy action should affect the enemy target");
}

function testAreaAnchorActionResolves() {
  const { snapshot, actor, enemy, log } = targetedHarness();
  actor.actions = [createSpellAction(SPELLS.sleep, { spellSaveDC: 13 })];

  const payload = { anchor: { ...enemy.position } };
  assert.equal(preflightAction(snapshot, actor, "sleep", payload).ok, true, "area action should preflight with an anchor");
  assert.equal(resolveAction(snapshot, actor, "sleep", payload, scriptedDice({ d20: [1] }), log), true, "area action should resolve");
  assert.ok(enemy.conditions.some((condition) => condition.id === "incapacitated"), "area action should affect targets in the footprint");
}

function testObjectPlacementActionResolves() {
  const { snapshot, actor, log } = targetedHarness();
  actor.actions = [createSpellAction(SPELLS.wall_of_force, { spellSaveDC: 13 })];
  const payload = {
    anchor: { x: 2, y: 1 },
    cells: [{ x: 2, y: 1 }, { x: 3, y: 1 }],
  };

  assert.equal(preflightAction(snapshot, actor, "wall_of_force", payload).ok, true, "object action should preflight with placed cells");
  assert.equal(resolveAction(snapshot, actor, "wall_of_force", payload, scriptedDice(), log), true, "object action should resolve");
  assert.equal(snapshot.combatObjects.length, 1, "object action should create a combat object");
  assert.deepEqual(snapshot.combatObjects[0].cells, payload.cells, "object action should preserve placement cells");
}

function testReactionPromptActionResolves() {
  const controller = createCombatController();
  const mage = targetedActor({
    id: "mage",
    name: "Mage",
    team: "heroes",
    hp: 12,
    maxHp: 12,
    ac: 12,
    position: { x: 1, y: 1 },
    spellSlots: { 1: { max: 1, current: 1 } },
    actions: [createSpellAction(SPELLS.shield, { spellSaveDC: 13 })],
  });
  const attacker = targetedActor({
    id: "attacker",
    name: "Attacker",
    team: "enemies",
    position: { x: 2, y: 1 },
    actions: [weaponAttack("club", 5)],
  });

  controller.snapshot.actors = [mage, attacker];
  controller.snapshot.initiative = ["attacker", "mage"];
  controller.snapshot.turnIndex = 0;
  controller.snapshot.outcome = null;
  controller.dice.rollD20 = () => ({ roll: 10, total: 10, usedLucky: false, secondRoll: null });
  controller.dice.rollDamage = (dice) => ({ total: 4, rolls: [4], modifier: 0, dice });

  const prompted = controller.actionResult("attacker", "club", "mage");
  assert.equal(prompted.code, "reaction_pending", "effective Shield should produce a reaction prompt");
  assert.ok(controller.pendingReaction, "controller should expose the pending reaction prompt");

  const answered = controller.answerReaction(true);
  assert.equal(answered.ok, true, "accepted reaction prompt should resolve the triggering action");
  assert.equal(controller.snapshot.actors.find((actor) => actor.id === "mage").hp, 12, "Shield should prevent the triggering hit");
}

function testResourceGatedActionAndDepletion() {
  const { snapshot, actor, log } = targetedHarness();
  actor.hp = 5;
  actor.resources = [{ id: "second_wind", name: "Second Wind", max: 1, current: 1 }];
  actor.actions = [{
    id: "second_wind",
    name: "Second Wind",
    type: "self_heal",
    cost: "bonus",
    requiresTarget: false,
    healing: "1d10",
    resourceId: "second_wind",
  }];

  assert.equal(preflightAction(snapshot, actor, "second_wind", null).ok, true, "resource-gated action should preflight with resources");
  assert.equal(resolveAction(snapshot, actor, "second_wind", null, fixedDice({ damage: 4 }), log), true, "resource-gated action should resolve");
  assert.equal(actor.resources[0].current, 0, "resource-gated action should spend its resource");
  actor.economy.bonusActionAvailable = true;
  assert.equal(preflightAction(snapshot, actor, "second_wind", null).ok, false, "depleted resource should block the action");
}

function assertGeneratedActionsResolve(spec, coverage) {
  const sheet = resolveCharacterSheet(draftFor(spec), {}, { allowNonCreationLevel: true });
  assert.deepEqual(sheet.metadata.unresolved, [], `${spec.label}: unresolved character choices`);
  const baseActor = resolvedSheetToCombatActor(sheet, { id: spec.id, position: { x: 1, y: 1 } });
  assert.deepEqual(validateCombatActor(baseActor), [], `${spec.label}: invalid combat actor`);

  for (const baseAction of baseActor.actions || []) {
    recordCoverage(coverage, spec, baseAction);
    if (baseAction.postHitOnly && !baseAction.contextual) continue;
    assertActionResolvesInIsolation(spec, baseActor, baseAction);
    assertResourceGateFailsWhenDepleted(spec, baseActor, baseAction);
  }
}

function assertActionResolvesInIsolation(spec, baseActor, baseAction) {
  const actor = structuredClone(baseActor);
  actor.id = spec.id;
  actor.position = { x: 1, y: 1 };
  actor.hp = Math.max(1, Math.floor((actor.maxHp || actor.hp || 1) / 2));
  prepareActorForAction(actor, baseAction);
  const enemy = createCoverageEnemy(actionFixtureEnemyId(baseAction));
  const snapshot = createSnapshotFromScenario({
    id: `${spec.id}_${baseAction.id}_coverage`,
    grid: { width: 10, height: 8, blocked: [], cover: [] },
    actors: [actor, enemy],
  });
  const action = actor.actions.find((item) => item.id === baseAction.id);
  const targetPayload = targetPayloadFor(action, actor, enemy);
  const log = createCombatLog();
  const dice = scriptedDice({ d20: Array(80).fill(15), damage: 4 });

  startTurn(snapshot, actor, log, dice);
  const preflight = preflightAction(snapshot, actor, action.id, targetPayload);
  assert.equal(preflight.ok, true, `${spec.label}: ${action.id} failed coverage preflight (${preflight.code}: ${preflight.reason})`);
  const resolved = resolveAction(snapshot, actor, action.id, targetPayload, dice, log);
  assert.equal(resolved, true, `${spec.label}: ${action.id} did not resolve in coverage scenario: ${summarizeEvents(log.events)}`);
}

function assertResourceGateFailsWhenDepleted(spec, baseActor, baseAction) {
  const resourceIds = [baseAction.resourceId, ...(baseAction.additionalResourceIds || [])].filter(Boolean);
  if (!resourceIds.length) return;
  const actor = structuredClone(baseActor);
  actor.id = spec.id;
  actor.position = { x: 1, y: 1 };
  for (const resourceId of resourceIds) {
    const resource = (actor.resources || []).find((item) => item.id === resourceId);
    if (resource) resource.current = 0;
  }
  const enemy = createCoverageEnemy(actionFixtureEnemyId(baseAction));
  const snapshot = createSnapshotFromScenario({
    id: `${spec.id}_${baseAction.id}_depleted`,
    grid: { width: 10, height: 8, blocked: [], cover: [] },
    actors: [actor, enemy],
  });
  const action = actor.actions.find((item) => item.id === baseAction.id);
  const result = preflightAction(snapshot, actor, action.id, targetPayloadFor(action, actor, enemy));
  assert.equal(result.ok, false, `${spec.label}: ${action.id} remained available with depleted resources`);
}

function targetPayloadFor(action, actor, enemy) {
  if (action.requiresTarget === false) return null;
  if (action.type === "spell_teleport") return { anchor: { x: actor.position.x + 1, y: actor.position.y + 1 } };
  if (action.targeting?.shape) return { anchor: { x: enemy.position.x, y: enemy.position.y } };
  if (action.tags?.harmful === false) return actor.id;
  return enemy.id;
}

function prepareActorForAction(actor, action) {
  if (action.restoresResource === "spell_slot" || action.restoresResource === "warlock_spell_slot") {
    expendOneSpellSlot(actor);
  }
}

function expendOneSpellSlot(actor) {
  const slots = actor.spellSlots || {};
  const level = Object.keys(slots)
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && slots[item]?.current > 0)
    .sort((a, b) => a - b)[0];
  if (level) slots[level].current -= 1;
}

function createCoverageEnemy(enemyId) {
  return createEnemyCombatActor(enemyId, { id: "target", hp: 80, maxHp: 80, ac: 10, position: { x: 2, y: 1 } });
}

function targetedHarness() {
  const actor = targetedActor({
    id: "hero",
    name: "Hero",
    team: "heroes",
    position: { x: 1, y: 1 },
  });
  const enemy = targetedActor({
    id: "target",
    name: "Target",
    team: "enemies",
    position: { x: 2, y: 1 },
  });
  const snapshot = createSnapshotFromScenario({
    id: "targeted-action-coverage",
    grid: { width: 8, height: 6, blocked: [], cover: [] },
    actors: [actor, enemy],
  });
  return {
    snapshot,
    actor: snapshot.actors.find((item) => item.id === "hero"),
    enemy: snapshot.actors.find((item) => item.id === "target"),
    log: createCombatLog(),
  };
}

function targetedActor(overrides = {}) {
  return {
    id: "actor",
    name: "Actor",
    team: "heroes",
    role: "test",
    token: "T",
    hp: 20,
    maxHp: 20,
    ac: 12,
    speed: 6,
    position: { x: 0, y: 0 },
    saves: { wis: 0 },
    actions: [],
    ...overrides,
  };
}

function weaponAttack(id, attackBonus = 5) {
  return {
    id,
    name: id,
    type: "weapon_attack",
    range: 1,
    attackBonus,
    damage: "1d6",
    damageType: "bludgeoning",
    tags: { harmful: true, attackRoll: true, weapon: true, melee: true },
  };
}

function actionFixtureEnemyId(action) {
  const text = `${action.id || ""} ${action.name || ""} ${action.description || ""}`.toLowerCase();
  if (text.includes("undead")) return "skeleton";
  return "goblin";
}

function recordCoverage(coverage, spec, action) {
  const key = [
    action.type || "unknown",
    action.actionKind || "none",
    action.targeting?.shape || "target",
    action.cost || "action",
  ].join("|");
  const entry = coverage.get(key) || { count: 0, examples: [] };
  entry.count += 1;
  if (entry.examples.length < 3) entry.examples.push(`${spec.label}: ${action.name || action.id}`);
  coverage.set(key, entry);
}

function summarizeEvents(events) {
  return (events || [])
    .slice(-5)
    .map((event) => `${event.type}:${event.detail?.reason || event.detail?.actionName || event.detail?.targetName || ""}`)
    .join(", ");
}
