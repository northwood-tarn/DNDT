import {
  assert,
  createSnapshotFromScenario,
  validateCombatActor,
} from "./helpers.js";
import {
  createCombatScenario,
  getCombatScenarioOptions,
} from "../../app/combat/scenario.js";
import { combatObjectCells } from "../../app/combat/combatObjects.js";
import { inBounds, isMovementBlocked, keyOf } from "../../app/combat/grid.js";

export async function runScenarioCombatTests() {
  for (const option of getCombatScenarioOptions()) {
    validateScenarioBaseline(createCombatScenario(option.id), option.id);
  }
  testDefaultScenarioContract();
  testGeneratedCharacterArenaContract();
  testScenarioRegistryIsCanonical();
}

export function validateScenarioBaseline(scenario, label = scenario?.id || "scenario") {
  assert.ok(scenario?.id, `${label}: scenario id is required`);
  assert.ok(scenario.grid, `${label}: grid is required`);
  assert.ok(Number.isFinite(scenario.grid.width) && scenario.grid.width > 0, `${label}: grid width must be positive`);
  assert.ok(Number.isFinite(scenario.grid.height) && scenario.grid.height > 0, `${label}: grid height must be positive`);
  assert.ok(Array.isArray(scenario.actors) && scenario.actors.length > 0, `${label}: actors are required`);
  assert.equal(new Set(scenario.actors.map((actor) => actor.id)).size, scenario.actors.length, `${label}: actor ids must be unique`);

  const snapshot = createSnapshotFromScenario(scenario);
  assert.ok(snapshot.actors.some((actor) => actor.team === "heroes"), `${label}: at least one hero is required`);
  assert.ok(snapshot.actors.some((actor) => actor.team === "enemies"), `${label}: at least one enemy is required`);

  validateTerrain(snapshot, label);
  validateActors(snapshot, label);
  validateCombatObjects(snapshot, label);
}

function validateTerrain(snapshot, label) {
  for (const key of snapshot.grid.blocked) {
    const pos = posFromKey(key);
    assert.ok(inBounds(snapshot.grid, pos), `${label}: blocked cell ${key} must be in bounds`);
  }
  for (const [key, kind] of snapshot.grid.cover) {
    const pos = posFromKey(key);
    assert.ok(inBounds(snapshot.grid, pos), `${label}: cover cell ${key} must be in bounds`);
    assert.ok(["half", "three_quarters", "full"].includes(kind), `${label}: cover kind ${kind} must be supported`);
  }
}

function validateActors(snapshot, label) {
  const occupied = new Map();
  for (const actor of snapshot.actors) {
    assert.deepEqual(validateCombatActor(actor), [], `${label}: ${actor.id} must satisfy CombatActor contract`);
    assert.ok(inBounds(snapshot.grid, actor.position), `${label}: ${actor.id} starts out of bounds`);
    assert.equal(isMovementBlocked(snapshot.grid, actor.position), false, `${label}: ${actor.id} starts on blocked terrain`);
    const key = keyOf(actor.position);
    assert.equal(occupied.has(key), false, `${label}: ${actor.id} overlaps ${occupied.get(key)} at ${key}`);
    occupied.set(key, actor.id);
  }
}

function validateCombatObjects(snapshot, label) {
  for (const object of snapshot.combatObjects || []) {
    const cells = combatObjectCells(snapshot, object);
    assert.ok(cells.length > 0, `${label}: combat object ${object.id} must occupy at least one cell`);
    for (const cell of cells) {
      assert.ok(inBounds(snapshot.grid, cell), `${label}: combat object ${object.id} has out-of-bounds cell ${keyOf(cell)}`);
    }
  }
}

function testDefaultScenarioContract() {
  const scenario = createCombatScenario();
  assert.equal(scenario.id, "generated-character-arena", "generated character arena should be the default combat scenario");
  validateScenarioBaseline(scenario, "default scenario contract");
}

function testGeneratedCharacterArenaContract() {
  const scenario = createCombatScenario("generated-character-arena");
  validateScenarioBaseline(scenario, "generated-character-arena contract");
  const snapshot = createSnapshotFromScenario(scenario);
  const hero = snapshot.actors.find((actor) => actor.id === "generated_pc");

  assert.ok(scenario.metadata?.generatedHeroSheet, "generated arena should retain the source resolved sheet for inspection");
  assert.equal(hero.name, "Generated Fighter");
  assert.equal(hero.ac, 18, "generated actor should carry resolved armor and shield AC");
  assert.equal(hero.hp, 12, "generated actor should carry resolved level-1 HP");
  assert.equal(hero.actions.some((action) => action.id === "longsword"), true, "generated actor should expose equipped weapon action");
  assert.equal(hero.actions.some((action) => action.id === "second_wind"), true, "generated actor should expose class feature action");
  assert.equal(hero.actions.some((action) => action.id === "healing_potion"), true, "generated actor should expose inventory consumable action");
  assert.equal(hero.featureHooks.some((hook) => hook.id === "savage_attacker_weapon_damage"), true, "generated actor should carry origin feat combat hooks");
  assert.equal(hero.resistances.includes("fire"), true, "generated actor should carry species and lineage resistance data");
}

function testScenarioRegistryIsCanonical() {
  assert.deepEqual(
    getCombatScenarioOptions().map((scenario) => scenario.id),
    ["generated-character-arena", "generated-wizard-shield-arena"],
    "only generated-character arenas should be exposed through the combat scenario registry"
  );
  assert.throws(
    () => createCombatScenario("trial-arena"),
    /Unknown combat scenario/,
    "old hardwired arenas should not remain addressable through the scenario factory"
  );
}

function posFromKey(key) {
  const [x, y] = key.split(",").map(Number);
  return { x, y };
}
