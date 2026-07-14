#!/usr/bin/env node

import { actorDefinitions } from "../app/data/actorDefinitions.js";
import { encounters } from "../app/data/encounters.js";
import { createCombatScenario, createSnapshotFromScenario, getCombatScenarioOptions } from "../app/combat/scenario.js";
import { validateActorDefinition, validateActorInstance } from "../app/actors/actorContract.js";

const errors = [];
let encounterRefs = 0;
let snapshotInstances = 0;

for (const definition of Object.values(actorDefinitions)) {
  errors.push(...validateActorDefinition(definition).map((error) => `${definition.id}: ${error}`));
}

for (const encounter of Object.values(encounters)) {
  for (const group of encounter.enemies || []) {
    encounterRefs += 1;
    if (!actorDefinitions[group.actorDefinitionId]) errors.push(`${encounter.id}: unknown ${group.actorDefinitionId}`);
  }
}

for (const option of getCombatScenarioOptions()) {
  const snapshot = createSnapshotFromScenario(createCombatScenario(option.id));
  for (const instance of Object.values(snapshot.actorInstances || {})) {
    snapshotInstances += 1;
    const definition = snapshot.actorDefinitions[instance.definitionId];
    errors.push(...validateActorInstance(instance, { definition }).map((error) => `${option.id}/${instance.id}: ${error}`));
  }
}

if (errors.length) {
  console.error(`[actor-migration] ${errors.length} problem(s):`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exitCode = 1;
} else {
  console.log("[actor-migration] OK");
  console.log(`  - ${Object.keys(actorDefinitions).length} registered definitions`);
  console.log(`  - ${encounterRefs} canonical encounter definition references`);
  console.log(`  - ${snapshotInstances} representative scenario instances retrofitted`);
}
