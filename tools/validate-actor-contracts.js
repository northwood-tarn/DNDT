#!/usr/bin/env node

import { validateActorDefinition } from "../app/actors/actorContract.js";
import { actorDefinitions } from "../app/data/actorDefinitions.js";

export function validateActorContracts() {
  const errors = [];
  const ids = new Set();
  for (const [key, definition] of Object.entries(actorDefinitions)) {
    for (const error of validateActorDefinition(definition)) errors.push(`${key}: ${error}`);
    if (definition.id !== key) errors.push(`${key}: registry key must match definition.id (${definition.id})`);
    if (ids.has(definition.id)) errors.push(`${key}: duplicate definition id`);
    ids.add(definition.id);
  }
  return errors;
}

const errors = validateActorContracts();
if (errors.length) {
  console.error(`[actor-contracts] Validation failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exitCode = 1;
} else {
  console.log(`[actor-contracts] Validation OK (${Object.keys(actorDefinitions).length} definitions)`);
}
