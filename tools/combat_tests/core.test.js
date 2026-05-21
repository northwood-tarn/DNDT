import {
  assert,
  actorsInFootprint,
  coneFootprint,
  createCombatController,
  createEmptyCharacterDraft,
  createEnemyCombatActor,
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
  resolveCharacterSheet,
  resolveAction,
  resolvedSheetToCombatActor,
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
  snapshot.grid.cover.set("0,1", "half");
  assert.equal(moveActor(snapshot, hero, { x: 0, y: 1 }, log), false, "half-cover terrain should block movement");
  snapshot.grid.cover.delete("0,1");

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
  assert.equal(resolveAction(snapshot, hero, "healing_potion", null, fixedDice({ damage: 6 }), log), true, "potion should resolve without a target");
  assert.equal(hero.hp, 16, "potion should heal");
  assert.equal(hero.economy.bonusActionAvailable, false, "potion should spend bonus action");
  assert.equal(getItemQuantity(hero, "healing_potion"), 1, "potion stock should decrement");
  assert.ok(log.events.some((event) => event.type === "healing.applied"), "healing should be logged");

  hero.economy.bonusActionAvailable = true;
  hero.hp = 10;
  assert.equal(resolveAction(snapshot, hero, "healing_potion", null, fixedDice({ damage: 6 }), log), true, "second potion should resolve");
  assert.equal(getItemQuantity(hero, "healing_potion"), 0, "second potion should exhaust stock");

  hero.economy.bonusActionAvailable = true;
  hero.hp = 10;
  assert.equal(resolveAction(snapshot, hero, "healing_potion", null, fixedDice({ damage: 6 }), log), false, "no-stock potion use should fail");
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

function testClericFeatureActionsAgainstUndead() {
  const clericSheet = resolveCharacterSheet(createEmptyCharacterDraft({
    identity: {
      characterName: "Test Cleric",
      level: 5,
      classId: "cleric",
    },
    abilities: {
      strength: 10,
      dexterity: 10,
      constitution: 12,
      intelligence: 10,
      wisdom: 16,
      charisma: 10,
    },
  }), {}, { allowNonCreationLevel: true });
  const cleric = resolvedSheetToCombatActor(clericSheet, { id: "cleric", position: { x: 1, y: 1 } });
  const skeleton = createEnemyCombatActor("skeleton", { id: "skeleton", position: { x: 3, y: 1 } });
  const goblin = createEnemyCombatActor("goblin", { id: "goblin", position: { x: 4, y: 1 } });
  const snapshot = createSnapshotFromScenario({
    id: "cleric-feature-test",
    grid: { width: 8, height: 5, blocked: [], cover: [] },
    actors: [cleric, skeleton, goblin],
  });
  const log = createCombatLog();
  const actor = snapshot.actors.find((item) => item.id === "cleric");
  const undead = snapshot.actors.find((item) => item.id === "skeleton");
  const living = snapshot.actors.find((item) => item.id === "goblin");

  assert.equal(resolveAction(snapshot, actor, "turn_undead", null, fixedDice({ d20: 1 }), log), true, "Turn Undead should resolve without selecting a target");
  assert.equal(hasCondition(undead, "turned"), true, "undead that fails save should be turned");
  assert.equal(hasCondition(living, "turned"), false, "non-undead should not be affected");
  assert.equal(actor.resources.find((item) => item.id === "channel_divinity").current, 1, "Channel Divinity should be spent");

  actor.economy.actionAvailable = true;
  undead.hp = undead.maxHp;
  assert.equal(resolveAction(snapshot, actor, "sear_undead", null, fixedDice({ d20: 20, damage: 8 }), log), true, "Sear Undead should resolve without selecting a target");
  assert.equal(undead.hp, undead.maxHp - 4, "Sear Undead should deal half damage on a successful save");
  assert.equal(living.hp, living.maxHp, "Sear Undead should not damage non-undead");
}

function testFeatureActionEconomyGrant() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors[0];
  const log = createCombatLog();
  hero.resources = [{ id: "action_surge", name: "Action Surge", max: 1, current: 1, recovery: "short_rest" }];
  hero.actions.push({
    id: "action_surge",
    name: "Action Surge",
    type: "feature_action",
    cost: "free",
    requiresTarget: false,
    resourceId: "action_surge",
    economyGrant: { actions: 1 },
  });
  hero.economy.actionAvailable = false;

  assert.equal(resolveAction(snapshot, hero, "action_surge", null, fixedDice(), log), true, "Action Surge should resolve without a target");
  assert.equal(hero.economy.actionAvailable, true, "Action Surge should restore action availability");
  assert.equal(hero.resources[0].current, 0, "Action Surge should spend its resource");
}

function testSubclassChannelDivinityActions() {
  const graveSheet = resolveCharacterSheet(createEmptyCharacterDraft({
    identity: {
      characterName: "Grave Cleric",
      level: 3,
      classId: "cleric",
      subclassId: "grave_domain",
    },
    abilities: {
      strength: 10,
      dexterity: 10,
      constitution: 12,
      intelligence: 10,
      wisdom: 16,
      charisma: 10,
    },
  }), {}, { allowNonCreationLevel: true });
  const graveCleric = resolvedSheetToCombatActor(graveSheet, { id: "grave_cleric", position: { x: 1, y: 1 } });
  graveCleric.actions.push({
    id: "test_mace",
    name: "Test Mace",
    type: "weapon_attack",
    range: 1,
    attackBonus: 20,
    damage: "1d6",
    damageType: "bludgeoning",
    tags: { harmful: true, attackRoll: true, weapon: true, melee: true },
  });
  const graveTarget = createEnemyCombatActor("goblin", { id: "grave_target", hp: 20, maxHp: 20, position: { x: 2, y: 1 }, saves: { con: 0 } });
  const graveSnapshot = createSnapshotFromScenario({
    id: "grave-channel-test",
    grid: { width: 8, height: 5, blocked: [], cover: [] },
    actors: [graveCleric, graveTarget],
  });
  const graveLog = createCombatLog();
  const graveActor = graveSnapshot.actors.find((item) => item.id === "grave_cleric");
  const target = graveSnapshot.actors.find((item) => item.id === "grave_target");

  assert.equal(resolveAction(graveSnapshot, graveActor, "graves_rebuke", "grave_target", fixedDice({ d20: 1, damage: 8 }), graveLog), true, "Grave's Rebuke should resolve against one target");
  assert.equal(hasCondition(target, "grave_rebuked"), true, "Grave's Rebuke should apply its failed-save rider");
  graveActor.economy.actionAvailable = true;
  assert.equal(resolveAction(graveSnapshot, graveActor, "test_mace", "grave_target", fixedDice({ d20: 20, damage: 4 }), graveLog), true, "critical-suppressed target should still be hittable");
  assert.ok(graveLog.events.some((event) => event.type === "attack.result" && event.detail.targetId === "grave_target" && event.detail.hit === true && event.detail.critical === false), "Grave Rebuked should suppress critical hits");

  const lanternSheet = resolveCharacterSheet(createEmptyCharacterDraft({
    identity: {
      characterName: "Lantern Cleric",
      level: 3,
      classId: "cleric",
      subclassId: "lantern_domain",
    },
    abilities: {
      strength: 10,
      dexterity: 10,
      constitution: 12,
      intelligence: 10,
      wisdom: 16,
      charisma: 10,
    },
  }), {}, { allowNonCreationLevel: true });
  const lanternCleric = resolvedSheetToCombatActor(lanternSheet, { id: "lantern_cleric", position: { x: 1, y: 1 } });
  const goblin = createEnemyCombatActor("goblin", { id: "radiance_goblin", position: { x: 3, y: 1 }, saves: { con: 0 } });
  const skeleton = createEnemyCombatActor("skeleton", { id: "radiance_skeleton", position: { x: 4, y: 1 }, saves: { con: 0 } });
  const lanternSnapshot = createSnapshotFromScenario({
    id: "lantern-channel-test",
    grid: { width: 8, height: 5, blocked: [], cover: [] },
    actors: [lanternCleric, goblin, skeleton],
  });
  const lanternLog = createCombatLog();
  const lanternActor = lanternSnapshot.actors.find((item) => item.id === "lantern_cleric");
  const radianceGoblin = lanternSnapshot.actors.find((item) => item.id === "radiance_goblin");
  const radianceSkeleton = lanternSnapshot.actors.find((item) => item.id === "radiance_skeleton");

  assert.equal(resolveAction(lanternSnapshot, lanternActor, "radiance_of_the_dawn", null, fixedDice({ d20: 1, damage: 9 }), lanternLog), true, "Radiance of the Dawn should resolve against nearby enemies");
  assert.equal(radianceGoblin.hp, Math.max(0, radianceGoblin.maxHp - 9), "Radiance should damage non-undead enemies");
  assert.equal(radianceSkeleton.hp, radianceSkeleton.maxHp - 9, "Radiance should damage undead enemies too");
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
  testClericFeatureActionsAgainstUndead();
  testFeatureActionEconomyGrant();
  testSubclassChannelDivinityActions();
}
