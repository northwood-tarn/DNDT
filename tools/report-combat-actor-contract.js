#!/usr/bin/env node

import { getCombatScenarioOptions, createCombatScenario, createSnapshotFromScenario } from "../app/combat/scenario.js";
import { getEnemySourceRecords, createEnemyCombatActor } from "../app/combat/enemyFactory.js";
import { validateCombatActor } from "../app/combat/actor.js";
import { inBounds, isMovementBlocked, keyOf } from "../app/combat/grid.js";

const errors = [];
const rows = [];

for (const enemy of getEnemySourceRecords()) {
  const actor = createEnemyCombatActor(enemy.id, { id: `${enemy.id}_contract` });
  collectActor("enemy", enemy.id, actor);
}

for (const option of getCombatScenarioOptions()) {
  const snapshot = createSnapshotFromScenario(createCombatScenario(option.id));
  collectScenarioPlacement(option.id, snapshot);
  for (const actor of snapshot.actors) collectActor(`scenario:${option.id}`, actor.id, actor);
}

if (errors.length) {
  console.error(`[combat-actor-contract] ${errors.length} problem(s):`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log("[combat-actor-contract] OK");
for (const row of rows) {
  console.log(`  - ${row.scope} ${row.id}: ${row.actions} action(s), ${row.hooks} hook(s), ${row.resources} resource(s)`);
}

function collectActor(scope, id, actor) {
  const actorErrors = validateCombatActor({ ...actor, economy: actor.economy || {} });
  errors.push(...actorErrors.map((error) => `${scope} ${id}: ${error}`));
  collectDuplicateActionIds(scope, id, actor);
  collectUnsupportedHooks(scope, id, actor);
  rows.push({
    scope,
    id,
    actions: actor?.actions?.length || 0,
    hooks: actor?.featureHooks?.length || 0,
    resources: actor?.resources?.length || 0,
  });
}

function collectDuplicateActionIds(scope, id, actor) {
  const seen = new Set();
  for (const action of actor?.actions || []) {
    if (!action?.id) continue;
    if (seen.has(action.id)) errors.push(`${scope} ${id}: duplicate action id ${action.id}`);
    seen.add(action.id);
  }
}

function collectUnsupportedHooks(scope, id, actor) {
  for (const hook of actor?.featureHooks || []) {
    if (!hook?.id) errors.push(`${scope} ${id}: feature hook is missing id`);
    if (hook?.implemented === false || hook?.unsupported === true) {
      errors.push(`${scope} ${id}: unsupported feature hook ${hook.id || "(missing id)"}`);
    }
  }
}

function collectScenarioPlacement(id, snapshot) {
  const occupied = new Map();
  for (const actor of snapshot.actors || []) {
    if (!inBounds(snapshot.grid, actor.position)) errors.push(`scenario:${id} ${actor.id}: starts out of bounds`);
    if (isMovementBlocked(snapshot.grid, actor.position)) errors.push(`scenario:${id} ${actor.id}: starts on blocked terrain`);
    const key = keyOf(actor.position);
    if (occupied.has(key)) errors.push(`scenario:${id} ${actor.id}: overlaps ${occupied.get(key)} at ${key}`);
    occupied.set(key, actor.id);
  }
}
