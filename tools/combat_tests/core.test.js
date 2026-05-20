import {
  assert,
  actorsInFootprint,
  coneFootprint,
  createCombatController,
  createCombatLog,
  createSnapshotFromScenario,
  cubeFootprint,
  endTurnEffects,
  fixedDice,
  getActorEconomyView,
  getCondition,
  getItemQuantity,
  getMovementRemaining,
  getValidTargets,
  hasAnyUsefulOption,
  hasCondition,
  hasLineOfSight,
  hasReaction,
  isWalkable,
  lineDirection,
  lineFootprint,
  makeHarnessSnapshot,
  moveActor,
  nextStepToward,
  radiusFootprint,
  resolveAction,
  runAiTurn,
  scriptedDice,
  startTurn,
  validateCombatActor,
} from "./helpers.js";

function testMovementAndPathing() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors[0];
  const log = createCombatLog();

  assert.equal(moveActor(snapshot, hero, { x: 1, y: 2 }, log), true, "orthogonal walkable movement should succeed");
  assert.equal(hero.movementRemaining, 5, "movement should decrement");
  assert.equal(moveActor(snapshot, hero, { x: 2, y: 2 }, log), false, "pillar movement should fail");

  hero.position = { x: 0, y: 2 };
  const step = nextStepToward(snapshot, hero, { x: 4, y: 2 });
  assert.notDeepEqual(step, { x: 1, y: 2 }, "pathing should not walk into a dead-end against the pillar wall");
}

function testLineOfSight() {
  const snapshot = makeHarnessSnapshot();
  assert.equal(
    hasLineOfSight(snapshot.grid, { x: 0, y: 2 }, { x: 4, y: 2 }),
    false,
    "pillar should block direct line of sight"
  );
  assert.equal(
    hasLineOfSight(snapshot.grid, { x: 0, y: 0 }, { x: 4, y: 0 }),
    true,
    "clear row should have line of sight"
  );
}

function testResolutionAndStructuredLog() {
  const snapshot = makeHarnessSnapshot();
  snapshot.actors[0].position = { x: 0, y: 0 };
  snapshot.actors[1].position = { x: 4, y: 0 };
  const log = createCombatLog();

  assert.equal(resolveAction(snapshot, snapshot.actors[0], "bow", "enemy", fixedDice({ d20: 10, damage: 4 }), log), true);
  assert.equal(snapshot.actors[1].hp, 4, "attack damage should apply");
  assert.ok(log.events.some((event) => event.type === "attack.roll"), "attack roll event should be structured");
  assert.ok(log.events.some((event) => event.type === "damage.applied"), "damage event should be structured");

  snapshot.actors[0].economy.actionAvailable = true;
  snapshot.actors[0].actionUsed = false;
  assert.equal(resolveAction(snapshot, snapshot.actors[0], "spark", "enemy", fixedDice({ d20: 1, damage: 4 }), log), true);
  assert.ok(log.events.some((event) => event.type === "save.roll"), "save spell should emit save roll event");
}

function testCoverRules() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors[0];
  const enemy = snapshot.actors[1];
  const log = createCombatLog();
  hero.position = { x: 0, y: 0 };
  enemy.position = { x: 1, y: 0 };

  hero.position = { x: 0, y: 0 };
  enemy.position = { x: 4, y: 0 };
  enemy.ac = 12;
  assert.equal(resolveAction(snapshot, hero, "bow", "enemy", fixedDice({ d20: 7, damage: 4 }), log), true);
  assert.ok(log.events.some((event) => event.type === "attack.result" && event.detail.hit === false), "half cover should turn AC 12 into effective AC 14");

  hero.economy.actionAvailable = true;
  snapshot.grid.cover.set("3,0", "three_quarters");
  assert.equal(resolveAction(snapshot, hero, "bow", "enemy", fixedDice({ d20: 12, damage: 4 }), log), true);
  assert.ok(log.events.some((event) => event.type === "attack.roll" && event.detail.cover?.kind === "three_quarters" && event.detail.effectiveAc === 17), "three-quarters cover should add +5 AC");

  hero.economy.actionAvailable = true;
  snapshot.grid.cover.delete("4,0");
  hero.position = { x: 4, y: 2 };
  assert.equal(resolveAction(snapshot, hero, "bow", "enemy", fixedDice({ d20: 12, damage: 4 }), log), true);
  assert.ok(log.events.some((event) => event.type === "attack.roll" && event.detail.cover?.kind === "none" && event.detail.effectiveAc === 12), "side angle should ignore non-interposing cover");

  hero.economy.actionAvailable = true;
  snapshot.outcome = null;
  snapshot.grid.cover.set("4,0", "half");
  hero.position = { x: 0, y: 0 };
  enemy.position = { x: 4, y: 0 };
  enemy.hp = 8;
  enemy.defeated = false;
  assert.equal(resolveAction(snapshot, hero, "dex_blast", "enemy", fixedDice({ d20: 11, damage: 4 }), log), true);
  assert.ok(log.events.some((event) => event.type === "save.result" && event.detail.spellName === "Dex Blast" && event.detail.success === true), "half cover should add +2 to DEX saves");

  hero.economy.actionAvailable = true;
  snapshot.outcome = null;
  hero.position = { x: 0, y: 2 };
  enemy.position = { x: 4, y: 2 };
  enemy.hp = 8;
  enemy.defeated = false;
  assert.equal(resolveAction(snapshot, hero, "bow", "enemy", fixedDice({ d20: 20, damage: 4 }), log), false, "full cover from blocked LOS should prevent targeting");
}

function testActorContract() {
  const snapshot = makeHarnessSnapshot();
  for (const actor of snapshot.actors) {
    assert.deepEqual(validateCombatActor(actor), [], `${actor.id} should satisfy CombatActor contract`);
    assert.ok(actor.economy, `${actor.id} should have explicit economy`);
  }
}

function testCombatSelectors() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors[0];
  const enemy = snapshot.actors[1];
  hero.position = { x: 0, y: 0 };
  enemy.position = { x: 4, y: 0 };

  assert.deepEqual(getValidTargets(snapshot, "hero", "bow").map((actor) => actor.id), ["enemy"], "selector should expose valid targets");
  assert.equal(hasAnyUsefulOption(snapshot, "hero"), true, "selector should report useful options");
  const economy = getActorEconomyView(snapshot, "hero");
  assert.equal(economy.find((item) => item.id === "movement")?.value, "0/6", "selector should expose economy display");
}

function testCorpseWalkability() {
  const snapshot = makeHarnessSnapshot();
  const dead = snapshot.actors[1];
  dead.hp = 0;
  dead.defeated = true;
  assert.equal(isWalkable(snapshot, dead.position, "hero"), true, "dead actors should not block movement");
}

function testActionEconomy() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors[0];
  const log = createCombatLog();
  hero.economy.movementUsed = hero.speed;
  hero.economy.actionAvailable = false;
  hero.economy.reactionAvailable = false;
  startTurn(snapshot, hero, log);
  assert.equal(getMovementRemaining(hero), hero.speed, "startTurn should refresh movement");
  assert.equal(hero.economy.actionAvailable, true, "startTurn should refresh action");
  assert.equal(hero.economy.bonusActionAvailable, true, "startTurn should refresh bonus action");
  assert.equal(hero.economy.reactionAvailable, true, "startTurn should refresh reaction");
}

function testDashAndPotionActions() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors[0];
  const log = createCombatLog();

  hero.economy.movementUsed = hero.speed;
  assert.equal(getMovementRemaining(hero), 0, "setup should exhaust movement");
  assert.equal(resolveAction(snapshot, hero, "dash", null, fixedDice(), log), true, "dash should resolve without a target");
  assert.equal(getMovementRemaining(hero), hero.speed, "dash should add a full move");
  assert.equal(hero.economy.actionAvailable, false, "dash should spend action");
  assert.ok(log.events.some((event) => event.type === "dash"), "dash should be logged");

  hero.hp = 10;
  assert.equal(resolveAction(snapshot, hero, "health_potion", null, fixedDice({ damage: 6 }), log), true, "potion should resolve without a target");
  assert.equal(hero.hp, 16, "potion should heal");
  assert.equal(hero.economy.bonusActionAvailable, false, "potion should spend bonus action");
  assert.equal(getItemQuantity(hero, "healing_potion"), 1, "potion stock should decrement");
  assert.ok(log.events.some((event) => event.type === "healing.applied"), "healing should be logged");

  hero.economy.bonusActionAvailable = true;
  hero.hp = 10;
  assert.equal(resolveAction(snapshot, hero, "health_potion", null, fixedDice({ damage: 6 }), log), true, "second potion should resolve");
  assert.equal(getItemQuantity(hero, "healing_potion"), 0, "second potion should exhaust stock");

  hero.economy.bonusActionAvailable = true;
  hero.hp = 10;
  assert.equal(resolveAction(snapshot, hero, "health_potion", null, fixedDice({ damage: 6 }), log), false, "no-stock potion use should fail");
}

function testBonusActionSelfHeal() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors[0];
  const log = createCombatLog();
  hero.actions.push({
    id: "second_wind",
    name: "Second Wind",
    type: "self_heal",
    cost: "bonus",
    requiresTarget: false,
    healing: "1d10+1",
  });

  hero.hp = 9;
  assert.equal(resolveAction(snapshot, hero, "second_wind", null, fixedDice({ damage: 7 }), log), true, "self-heal bonus action should resolve without a target");
  assert.equal(hero.hp, 16, "self-heal should restore HP");
  assert.equal(hero.economy.bonusActionAvailable, false, "self-heal should spend bonus action");

  hero.economy.bonusActionAvailable = true;
  hero.hp = hero.maxHp;
  assert.equal(resolveAction(snapshot, hero, "second_wind", null, fixedDice({ damage: 7 }), log), false, "self-heal should fail at full HP");

}


export async function runCoreCombatTests() {
  testMovementAndPathing();
  testLineOfSight();
  testResolutionAndStructuredLog();
  testCoverRules();
  testActorContract();
  testCombatSelectors();
  testCorpseWalkability();
  testActionEconomy();
  testDashAndPotionActions();
  testBonusActionSelfHeal();
}
