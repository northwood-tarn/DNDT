import { enemies, getEnemyStats } from "../../app/data/enemies.js";
import { expandEncounterEnemyIds, getEncounterById } from "../../app/data/encounters.js";
import { createEncounterEnemyActors, createEnemyCombatActor, createEnemyCombatActors } from "../../app/combat/enemyFactory.js";
import { checkEnemyAwareness } from "../../app/systems/enemyAwareness.js";
import { assert, createSnapshotFromScenario, validateCombatActor } from "./helpers.js";

export async function runEnemyCombatTests() {
  testEnemyLookupAndShape();
  testEnemyAwarenessReadsNestedAwareness();
  testEnemyCombatActorFactory();
  testEnemyCombatActorFactoryNaturalAttack();
  testEnemyCombatActorBatchFactory();
  testEncounterDataExpansion();
  testEncounterEnemyActorFactory();
}

function testEnemyLookupAndShape() {
  const goblin = getEnemyStats("goblin");
  const wolf = getEnemyStats("wolf");

  assert.equal(goblin.id, "goblin", "enemy lookup should return records by id");
  assert.equal(goblin.saves.dex, 2, "enemy saves should use resolver-facing saves key");
  assert.equal(goblin.awareness.hostility, "onsight", "enemy awareness should be nested under awareness");
  assert.equal(wolf.naturalAttack.damageType, "piercing", "natural attacks should carry explicit damage type");
  assert.equal(Object.keys(enemies).length, new Set(Object.values(enemies).map((enemy) => enemy.id)).size, "enemy ids should be unique");
}

function testEnemyAwarenessReadsNestedAwareness() {
  const goblin = { ...getEnemyStats("goblin"), x: 5, y: 0 };
  const aware = checkEnemyAwareness({ x: 0, y: 0 }, [goblin], null, null);

  assert.equal(aware.length, 1, "enemy awareness should read normalized nested awareness data");
  assert.equal(aware[0].id, "goblin", "aware enemy should be returned unchanged");
}

function testEnemyCombatActorFactory() {
  const actor = createEnemyCombatActor("goblin", { id: "goblin_a", position: { x: 3, y: 2 } });

  assert.equal(actor.id, "goblin_a", "enemy factory should create instance ids");
  assert.equal(actor.sourceId, "goblin", "enemy factory should preserve source id");
  assert.equal(actor.team, "enemies", "enemy factory should create enemy-team actors");
  assert.equal(actor.position.x, 3, "enemy factory should apply requested position");
  assert.equal(actor.actions[0].damage, "1d6+2", "enemy factory should use enemy damage expression");
  assert.equal(actor.actions[0].damageType, "slashing", "enemy factory should use enemy damage type");
  assert.deepEqual(validateCombatActor({ ...actor, economy: {} }), [], "enemy factory output should satisfy combat actor validation after economy exists");

  const snapshot = createSnapshotFromScenario({
    id: "enemy-factory-test",
    grid: { width: 5, height: 5, blocked: [], cover: [] },
    actors: [
      {
        id: "hero",
        name: "Hero",
        team: "heroes",
        hp: 10,
        maxHp: 10,
        ac: 12,
        position: { x: 0, y: 0 },
        actions: [],
      },
      actor,
    ],
  });

  assert.equal(snapshot.actors.find((item) => item.id === "goblin_a").actions[0].type, "weapon_attack", "enemy factory actor should normalize into snapshots");
}

function testEnemyCombatActorFactoryNaturalAttack() {
  const actor = createEnemyCombatActor("wolf", { id: "wolf_a" });

  assert.equal(actor.actions[0].id, "bite", "natural attackers should get natural attack actions");
  assert.equal(actor.actions[0].damageType, "piercing", "natural attack damage type should be explicit");
  assert.equal(actor.actions[0].tags.natural, true, "natural attack actions should be tagged as natural");
}

function testEnemyCombatActorBatchFactory() {
  const actors = createEnemyCombatActors(["wolf", "wolf", "skeleton"], {
    instances: [
      { position: { x: 1, y: 1 } },
      { position: { x: 2, y: 1 } },
      { position: { x: 3, y: 1 } },
    ],
  });

  assert.deepEqual(actors.map((actor) => actor.id), ["wolf_1", "wolf_2", "skeleton_3"], "batch factory should create stable instance ids");
  assert.equal(actors[2].actions[0].id, "shortsword", "batch factory should create weapon actions");
}

function testEncounterEnemyActorFactory() {
  const actors = createEncounterEnemyActors("combat_goblins_2", {
    instances: [
      { position: { x: 1, y: 1 } },
      { position: { x: 2, y: 1 } },
    ],
  });

  assert.equal(actors.length, 2, "encounter bridge should create an actor for each enemy id");
  assert.deepEqual(actors.map((actor) => actor.sourceId), ["goblin", "goblin"], "encounter bridge should preserve source ids");
}

function testEncounterDataExpansion() {
  const encounter = getEncounterById("combat_wolves_1");
  assert.equal(encounter.name, "Wolf Pack", "encounter lookup should return structured records");
  assert.deepEqual(expandEncounterEnemyIds(encounter), ["wolf", "wolf", "wolf"], "encounter enemy groups should expand into enemy ids");
}
