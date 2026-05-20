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
  testTrialArenaScenarioContract();
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
    assert.ok(["half", "three_quarters"].includes(kind), `${label}: cover kind ${kind} must be supported`);
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

function testTrialArenaScenarioContract() {
  const scenario = createCombatScenario("trial-arena");
  validateScenarioBaseline(scenario, "trial-arena contract");
  const snapshot = createSnapshotFromScenario(scenario);
  const hero = snapshot.actors.find((actor) => actor.id === "trial_pc");
  const enemy = snapshot.actors.find((actor) => actor.id === "trial_enemy");

  assert.equal(snapshot.grid.width, 10, "trial arena should stay a compact 10-column fixture");
  assert.equal(snapshot.grid.height, 10, "trial arena should stay a compact 10-row fixture");
  assert.equal(snapshot.grid.cover.get("6,5"), "three_quarters", "trial arena should include one broken-pillar cover square");
  assert.equal(snapshot.grid.cover.get("2,6"), "half", "trial arena should include one bush cover square");
  assert.ok(hero.actions.some((action) => action.id === "push"), "trial PC should expose Push for forced-movement testing");
  assert.ok(hero.actions.some((action) => action.id === "thunderwave"), "trial PC should expose an area forced-movement spell");
  assert.equal(enemy.ai?.profile, "melee", "trial enemy should use the melee AI profile");
  assert.ok(enemy.actions.some((action) => action.id === "strong_first_hit"), "trial enemy should expose the prone-on-hit fixture");
}

function posFromKey(key) {
  const [x, y] = key.split(",").map(Number);
  return { x, y };
}
