import assert from "node:assert/strict";
import {
  ayaBlueprintToActorDefinition,
  combatActorToActorInstance,
  enemySourceToActorDefinition,
  resolveActorToCombatActor,
  validateActorDefinition,
  validateActorInstance,
} from "../../app/actors/index.js";
import { createStarterCharacterDraft, createCharacterRecord, loadCombatActorFromCharacter } from "../../app/character/index.js";
import { createEnemyCombatActor } from "../../app/combat/enemyFactory.js";
import { getEnemyStats } from "../../app/data/enemies.js";
import aya from "../../app/data/characters/aya.json" with { type: "json" };

export function runActorContractTests() {
  validatesMigratedEnemyDefinitionsAndInstances();
  resolvesCanonicalActorsIntoCombatActors();
  createsCanonicalCharacterRecords();
  adaptsAyaBlueprint();
}

function validatesMigratedEnemyDefinitionsAndInstances() {
  const definition = enemySourceToActorDefinition(getEnemyStats("goblin"));
  const combatActor = createEnemyCombatActor("goblin", { id: "goblin_contract", position: { x: 2, y: 3 } });
  const instance = combatActorToActorInstance(combatActor, definition.id);

  assert.deepEqual(validateActorDefinition(definition), []);
  assert.deepEqual(validateActorInstance(instance, { definition }), []);
  assert.equal(definition.id, "enemy.goblin");
  assert.equal(instance.definitionId, "enemy.goblin");
}

function resolvesCanonicalActorsIntoCombatActors() {
  const sourceActor = createEnemyCombatActor("goblin", { id: "goblin_resolved", position: { x: 4, y: 2 } });
  const definition = enemySourceToActorDefinition(getEnemyStats("goblin"));
  const instance = combatActorToActorInstance(sourceActor, definition.id);
  const actor = resolveActorToCombatActor(definition, instance, {
    combatActorBase: sourceActor,
    actions: sourceActor.actions,
  });

  assert.equal(actor.id, "goblin_resolved");
  assert.equal(actor.sourceId, "enemy.goblin");
  assert.equal(actor.actorContract.definitionId, "enemy.goblin");
  assert.equal(actor.position.x, 4);
}

function createsCanonicalCharacterRecords() {
  const record = createCharacterRecord(createStarterCharacterDraft("fighter"), { actorOptions: { id: "contract_fighter" } });
  const actor = loadCombatActorFromCharacter({ record });

  assert.equal(record.version, 2);
  assert.equal(record.actorDefinition.kind, "player");
  assert.equal(record.actorInstance.definitionId, record.actorDefinition.id);
  assert.equal(actor.actorContract.definitionId, record.actorDefinition.id);
}

function adaptsAyaBlueprint() {
  const definition = ayaBlueprintToActorDefinition(aya);
  assert.deepEqual(validateActorDefinition(definition), []);
  assert.equal(definition.id, "character.aya");
  assert.equal(definition.kind, "companion");
  assert.equal(definition.mechanics.maxHp, 28);
}
