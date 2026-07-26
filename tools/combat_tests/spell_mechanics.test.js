import {
  assert,
  createCombatLog,
  endTurnEffects,
  makeHarnessSnapshot,
  moveActor,
  resolveAction,
  startTurn,
  scriptedDice,
} from "./helpers.js";
import { combatObjectCells } from "../../app/combat/combatObjects.js";
import { canMoveTo } from "../../app/combat/rules.js";
import { createSpellAction } from "../../app/combat/actionFactory.js";
import { formatEvent } from "../../app/combat/combatLog.js";
import { canSeeActor } from "../../app/combat/perception.js";
import { SPELLS } from "../../app/data/spells.js";
import { getLanterna, initLanterna } from "../../app/systems/lanternaSystem.js";

function testHexAddsDamageRiderToCasterAttackHits() {
  const { snapshot, hero, enemy, log } = spellHarness();
  hero.actions.push(createSpellAction(SPELLS.hex, { spellSaveDC: 13 }));

  assert.equal(resolveAction(snapshot, hero, "hex", enemy.id, scriptedDice(), log), true);
  assert.ok(enemy.conditions.some((condition) => condition.id === "hexed"), "Hex should mark the target through a condition");

  hero.economy.actionAvailable = true;
  assert.equal(resolveAction(snapshot, hero, "bow", enemy.id, scriptedDice({ d20: [15], damage: 4 }), log), true);
  assert.equal(enemy.hp, 12, "Hex should add a generic damage rider when the caster hits with an attack roll");
}

function testChromaticOrbUsesSelectedDamageType() {
  const { snapshot, hero, enemy, log } = spellHarness();
  hero.actions.push(createSpellAction(SPELLS.chromatic_orb, { attackBonus: 5 }));

  assert.equal(resolveAction(snapshot, hero, "chromatic_orb", {
    targetId: enemy.id,
    choices: { damageType: "thunder" },
  }, scriptedDice({ d20: [15], damage: 7 }), log), true);
  const damageEvent = log.events.find((event) => event.type === "damage.applied" && event.detail.sourceId === hero.id);
  const attackEvent = log.events.find((event) => event.type === "attack.roll" && event.detail.actionId === "chromatic_orb");
  assert.equal(damageEvent.detail.damageType, "thunder", "Chromatic Orb should use the selected damage type at resolution");
  assert.ok(formatEvent(attackEvent).includes("casts Chromatic Orb on"), "spell attack logs should describe spell casting rather than generic attacking");
}

function testArmorOfAgathysTempHpAndRetaliation() {
  const { snapshot, hero, enemy, log } = spellHarness();
  hero.actions.push(createSpellAction(SPELLS.armor_of_agathys));
  enemy.position = { x: 1, y: 0 };

  assert.equal(resolveAction(snapshot, hero, "armor_of_agathys", null, scriptedDice(), log), true);
  assert.equal(hero.tempHp, 5, "Armor of Agathys should grant temporary hit points");
  assert.ok(hero.conditions.some((condition) => condition.id === "armor_of_agathys"), "Armor of Agathys should attach its retaliation state");

  enemy.economy.actionAvailable = true;
  assert.equal(resolveAction(snapshot, enemy, "blade", hero.id, scriptedDice({ d20: [15], damage: 5 }), log), true);
  assert.equal(hero.hp, 20, "incoming damage should be absorbed by temp HP first");
  assert.equal(hero.tempHp, 0, "temp HP should diminish as it absorbs damage");
  assert.equal(enemy.hp, 15, "melee attacker should take generic retaliation damage");
}

function testSanctuaryCanWasteIncomingAttack() {
  const { snapshot, hero, enemy, log } = spellHarness();
  hero.actions.push(createSpellAction(SPELLS.sanctuary, { spellSaveDC: 13 }));
  enemy.position = { x: 1, y: 0 };

  assert.equal(resolveAction(snapshot, hero, "sanctuary", null, scriptedDice(), log), true);
  enemy.economy.actionAvailable = true;
  assert.equal(resolveAction(snapshot, enemy, "blade", hero.id, scriptedDice({ d20: [1, 20], damage: 6 }), log), false);
  assert.equal(hero.hp, 20, "failed Sanctuary gate should waste the attack before damage");
  assert.equal(enemy.economy.actionAvailable, false, "a wasted gated attack should still spend its action");
}

function testSleepEscalatesOnFailedRepeatSave() {
  const { snapshot, hero, enemy, log } = spellHarness();
  hero.actions.push(createSpellAction(SPELLS.sleep, { spellSaveDC: 13 }));
  enemy.position = { x: 3, y: 0 };

  assert.equal(resolveAction(snapshot, hero, "sleep", { anchor: { x: 3, y: 0 } }, scriptedDice({ d20: [1] }), log), true);
  assert.ok(enemy.conditions.some((condition) => condition.id === "incapacitated"), "Sleep should apply first failed save condition");

  endTurnEffects(snapshot, enemy, scriptedDice({ d20: [1] }), log);
  assert.ok(enemy.conditions.some((condition) => condition.id === "unconscious"), "Sleep should escalate after a failed repeat save");
}

function testWallOfForceCreatesBlockingObject() {
  const { snapshot, hero, enemy, log } = spellHarness();
  hero.actions.push(createSpellAction(SPELLS.wall_of_force, { spellSaveDC: 13 }));
  enemy.position = { x: 3, y: 0 };

  assert.equal(resolveAction(snapshot, hero, "wall_of_force", {
    anchor: { x: 1, y: 0 },
    cells: [{ x: 1, y: 0 }, { x: 2, y: 0 }],
  }, scriptedDice(), log), true);
  assert.ok(snapshot.combatObjects[0].blocksMovement, "Wall of Force should create a movement-blocking object");
  assert.deepEqual(snapshot.combatObjects[0].cells, [{ x: 1, y: 0 }, { x: 2, y: 0 }], "Wall of Force should preserve explicitly placed cells");
  assert.ok(combatObjectCells(snapshot, snapshot.combatObjects[0]).some((cell) => cell.x === 2 && cell.y === 0), "wall line should occupy projected cells");
  assert.equal(moveActor(snapshot, enemy, { x: 2, y: 0 }, log), false, "actors should not move through a blocking spell object");
}

function testEvardsMawTurnStartSaveUsesDice() {
  const { snapshot, hero, enemy, log } = spellHarness();
  hero.actions.push(createSpellAction(SPELLS.evards_maw, { spellSaveDC: 13 }));
  enemy.position = { x: 2, y: 0 };

  assert.equal(resolveAction(snapshot, hero, "evards_maw", { anchor: { x: 2, y: 0 } }, scriptedDice(), log), true);
  startTurn(snapshot, enemy, log, scriptedDice({ d20: [1] }));
  assert.ok(enemy.conditions.some((condition) => condition.id === "restrained"), "Evard's Maw should resolve its turn-start save and apply Restrained on failure");
  assert.ok(log.events.some((event) => event.type === "save.roll" && event.detail.spellName === "Evard's Maw"), "Evard's Maw turn-start save should be logged");
}

function testCastingNewConcentrationSpellDropsOldConcentrationEvenOnSaveSuccess() {
  const { snapshot, hero, enemy, log } = spellHarness();
  snapshot.grid.width = 20;
  snapshot.grid.height = 12;
  snapshot.grid.blocked = new Set();
  snapshot.grid.cover = new Map();
  hero.position = { x: 0, y: 0 };
  enemy.position = { x: 10, y: 0 };
  hero.actions.push(
    createSpellAction(SPELLS.fog_cloud, { spellSaveDC: 13 }),
    createSpellAction(SPELLS.banishment, { spellSaveDC: 13 })
  );

  assert.equal(resolveAction(snapshot, hero, "fog_cloud", { anchor: { x: 0, y: 9 } }, scriptedDice(), log), true);
  assert.equal(snapshot.combatObjects.length, 1, "Fog Cloud should create a concentration object");
  assert.equal(hero.concentration?.actionId, "fog_cloud", "caster should be concentrating on Fog Cloud");

  hero.economy.actionAvailable = true;
  assert.equal(resolveAction(snapshot, hero, "banishment", enemy.id, scriptedDice({ d20: [20] }), log), true);
  assert.equal(snapshot.combatObjects.length, 0, "casting another concentration spell should drop the old concentration object even if the new save succeeds");
  assert.equal(hero.concentration?.actionId, "banishment", "the newly cast concentration spell should become the active concentration record");
}

function testBanishmentLastsTenTargetTurnEnds() {
  const { snapshot, hero, enemy, log } = spellHarness();
  enemy.saves.cha = 0;
  hero.actions.push(createSpellAction(SPELLS.banishment, { spellSaveDC: 13 }));

  assert.equal(resolveAction(snapshot, hero, "banishment", enemy.id, scriptedDice({ d20: [1] }), log), true);
  assert.ok(enemy.conditions.some((condition) => condition.id === "banished"), "Banishment should apply Banished on a failed save");
  assert.equal(hero.concentration?.actionId, "banishment", "caster should be concentrating on Banishment");

  for (let i = 0; i < 9; i++) endTurnEffects(snapshot, enemy, scriptedDice(), log);
  assert.ok(enemy.conditions.some((condition) => condition.id === "banished"), "Banishment should still be active before 10 target turn ends");

  endTurnEffects(snapshot, enemy, scriptedDice(), log);
  assert.equal(enemy.conditions.some((condition) => condition.id === "banished"), false, "Banishment should end after 10 target turn ends");
  assert.equal(hero.concentration, null, "concentration should clear when Banishment expires");
}

function testConcentrationCombatObjectExpiresAfterSourceDuration() {
  const { snapshot, hero, log } = spellHarness();
  hero.actions.push(createSpellAction(SPELLS.wall_of_force, { spellSaveDC: 13 }));

  assert.equal(resolveAction(snapshot, hero, "wall_of_force", {
    anchor: { x: 1, y: 0 },
    cells: [{ x: 1, y: 0 }, { x: 2, y: 0 }],
  }, scriptedDice(), log), true);
  assert.equal(snapshot.combatObjects.length, 1, "Wall of Force should create a concentration object");
  assert.equal(hero.concentration?.actionId, "wall_of_force", "caster should be concentrating on Wall of Force");

  for (let i = 0; i < 9; i++) endTurnEffects(snapshot, hero, scriptedDice(), log);
  assert.equal(snapshot.combatObjects.length, 1, "Wall of Force should still be active before 10 source turn ends");

  endTurnEffects(snapshot, hero, scriptedDice(), log);
  assert.equal(snapshot.combatObjects.length, 0, "Wall of Force should expire after 10 source turn ends");
  assert.equal(hero.concentration, null, "concentration should clear when the concentration object expires");
}

function testCanonicalForcedMovementSpellFamilies() {
  const { snapshot, hero, enemy, log } = spellHarness();
  hero.position = { x: 0, y: 0 };
  enemy.position = { x: 3, y: 0 };
  hero.actions.push(createSpellAction(SPELLS.eldritch_grasp, { attackBonus: 5 }));

  assert.equal(resolveAction(snapshot, hero, "eldritch_grasp", enemy.id, scriptedDice({ d20: [15], damage: 1 }), log), true);
  assert.deepEqual(enemy.position, { x: 2, y: 0 }, "Eldritch Grasp should pull the target 5 feet toward the caster on hit");

  hero.economy.actionAvailable = true;
  enemy.position = { x: 1, y: 0 };
  hero.actions.push(createSpellAction(SPELLS.thunderwave, { spellSaveDC: 13 }));
  assert.equal(resolveAction(snapshot, hero, "thunderwave", { anchor: { x: 0, y: 0 } }, scriptedDice({ d20: [1], damage: 1 }), log), true);
  assert.deepEqual(enemy.position, { x: 3, y: 0 }, "Thunderwave should push failed-save targets 10 feet away from the caster");
}

function testCanonicalNoOpportunityAndTeleportFamilies() {
  const { snapshot, hero, enemy, log } = spellHarness();
  hero.position = { x: 1, y: 1 };
  enemy.position = { x: 2, y: 1 };
  hero.actions.push(
    createSpellAction(SPELLS.shocking_grasp, { attackBonus: 5 }),
    createSpellAction(SPELLS.misty_step, { spellSaveDC: 13 })
  );

  assert.equal(resolveAction(snapshot, hero, "shocking_grasp", enemy.id, scriptedDice({ d20: [15], damage: 1 }), log), true);
  assert.ok(enemy.conditions.some((condition) => condition.id === "opportunity_attacks_blocked"), "Shocking Grasp should block Opportunity Attacks on hit");

  hero.economy.actionAvailable = true;
  assert.equal(moveActor(snapshot, hero, { x: 0, y: 1 }, log, { dice: scriptedDice({ d20: [20], damage: 20 }) }), true);
  assert.equal(hero.hp, 20, "moving away after Shocking Grasp should not trigger an Opportunity Attack");

  assert.equal(resolveAction(snapshot, hero, "misty_step", { anchor: { x: 0, y: 4 } }, scriptedDice(), log), true);
  assert.deepEqual(hero.position, { x: 0, y: 4 }, "Misty Step should teleport to a valid visible destination");
}

function testCantripRidersAndConditionalDamageResolve() {
  const { snapshot, hero, enemy, log } = spellHarness();
  enemy.position = { x: 1, y: 0 };
  enemy.saves.int = 0;
  enemy.saves.wis = 0;
  hero.actions.push(
    createSpellAction(SPELLS.chill_touch, { attackBonus: 5, casterLevel: 11 }),
    createSpellAction(SPELLS.mind_sliver, { spellSaveDC: 13, casterLevel: 11 }),
    createSpellAction(SPELLS.toll_the_dead, { spellSaveDC: 13, casterLevel: 11 })
  );

  assert.equal(resolveAction(snapshot, hero, "chill_touch", enemy.id, scriptedDice({ d20: [15], damage: 1 }), log), true);
  assert.ok(enemy.conditions.some((condition) => condition.id === "healing_blocked"), "Chill Touch should apply the generic healing-blocked condition on hit");

  hero.economy.actionAvailable = true;
  assert.equal(resolveAction(snapshot, hero, "mind_sliver", enemy.id, scriptedDice({ d20: [1], damage: 1 }), log), true);
  assert.ok(enemy.activeEffects.some((effect) => effect.stat === "save" && effect.die === "1d4"), "Mind Sliver should create a next-save penalty effect");

  hero.economy.actionAvailable = true;
  assert.equal(resolveAction(snapshot, hero, "spark", enemy.id, scriptedDice({ d20: [20], damage: [4, 1] }), log), true);
  assert.equal(enemy.activeEffects.some((effect) => effect.stat === "save"), false, "next-save penalty effects should be consumed by the next saving throw");

  hero.economy.actionAvailable = true;
  enemy.hp = 19;
  assert.equal(resolveAction(snapshot, hero, "toll_the_dead", enemy.id, scriptedDice({ d20: [1], damage: 12 }), log), true);
  const tollDamage = log.events.findLast((event) => event.type === "damage.roll" && event.detail.label === "Toll the Dead");
  assert.equal(tollDamage.detail.dice, "3d12", "Toll the Dead should use its scaled alternate die against damaged targets");
}

function testMultiBeamAndGrantedSpellActionsResolve() {
  const { snapshot, hero, enemy, log } = spellHarness();
  enemy.hp = 50;
  enemy.maxHp = 50;
  hero.actions.push(
    createSpellAction(SPELLS.eldritch_blast, { attackBonus: 5, casterLevel: 11 }),
    createSpellAction(SPELLS.leech, { attackBonus: 5, casterLevel: 11 }),
    createSpellAction(SPELLS.flame_blade, { attackBonus: 5 }),
    createSpellAction(SPELLS.far_step, { spellSaveDC: 13 })
  );

  assert.equal(resolveAction(snapshot, hero, "eldritch_blast", enemy.id, scriptedDice({ d20: [15, 15, 15], damage: [2, 2, 2] }), log), true);
  assert.equal(log.events.filter((event) => event.type === "attack.roll" && event.detail.actionId.startsWith("eldritch_blast_")).length, 3, "multi-beam spell attacks should resolve one attack roll per beam");

  hero.economy.actionAvailable = true;
  assert.equal(resolveAction(snapshot, hero, "leech", enemy.id, scriptedDice({ d20: [15, 15, 15], damage: [3, 3, 3] }), log), true);
  assert.equal(hero.tempHp, 3, "Leech should grant party temporary HP from total damage dealt by its beams");

  hero.economy.actionAvailable = true;
  assert.equal(resolveAction(snapshot, hero, "flame_blade", null, scriptedDice(), log), true);
  assert.ok(hero.actions.some((action) => action.id === "flame_blade_attack" && action.cost === "bonus"), "Flame Blade should grant a reusable bonus-action spell attack");

  hero.economy.bonusActionAvailable = true;
  assert.equal(resolveAction(snapshot, hero, "far_step", null, scriptedDice(), log), true);
  assert.ok(hero.actions.some((action) => action.id === "far_step_teleport" && action.type === "spell_teleport"), "Far Step should grant its later-turn teleport action");
}

function testIndividualSpellAssignmentsResolve() {
  const { snapshot, hero, enemy, log } = spellHarness();
  const secondEnemy = {
    ...structuredClone(enemy),
    id: "enemy_two",
    name: "Enemy Two",
    hp: 20,
    maxHp: 20,
    position: { x: 0, y: 3 },
  };
  snapshot.actors.push(secondEnemy);
  hero.actions.push(
    createSpellAction(SPELLS.eldritch_blast, { attackBonus: 5, casterLevel: 7 }),
    createSpellAction(SPELLS.magic_missile, { spellSaveDC: 13 })
  );

  assert.equal(resolveAction(snapshot, hero, "eldritch_blast", {
    targetIds: [enemy.id, secondEnemy.id],
  }, scriptedDice({ d20: [15, 15], damage: [3, 4] }), log), true);
  assert.equal(log.events.filter((event) => event.type === "attack.roll" && event.detail.actionId.startsWith("eldritch_blast_")).length, 2, "Eldritch Blast beams should resolve against individually assigned targets");
  assert.equal(enemy.hp, 17, "first beam should damage the first chosen target");
  assert.equal(secondEnemy.hp, 16, "second beam should damage the second chosen target");

  hero.economy.actionAvailable = true;
  assert.equal(resolveAction(snapshot, hero, "magic_missile", {
    targetIds: [enemy.id, secondEnemy.id, secondEnemy.id],
  }, scriptedDice({ damage: [2, 3, 4] }), log), true);
  assert.equal(enemy.hp, 15, "first dart should damage its assigned target");
  assert.equal(secondEnemy.hp, 9, "two darts should be able to stack on one target");
}

function testDarknessBlocksSightAndImposesAttackDisadvantage() {
  const { snapshot, hero, enemy, log } = spellHarness();
  hero.actions.push(createSpellAction(SPELLS.darkness, { spellSaveDC: 13 }));
  hero.actions.push({
    id: "blade",
    name: "Blade",
    type: "weapon_attack",
    range: 1,
    attackBonus: 5,
    damage: "1d6",
    damageType: "slashing",
    tags: { harmful: true, attackRoll: true, weapon: true, melee: true },
  });
  enemy.position = { x: 1, y: 0 };

  assert.equal(resolveAction(snapshot, hero, "darkness", { anchor: { x: 1, y: 0 } }, scriptedDice(), log), true);
  assert.equal(canSeeActor(snapshot, hero, enemy).ok, false, "Darkness should block sight to creatures inside it");

  hero.economy.actionAvailable = true;
  assert.equal(resolveAction(snapshot, hero, "blade", enemy.id, scriptedDice({ d20: [15, 5], damage: 1 }), log), true);
  const attack = log.events.findLast((event) => event.type === "attack.roll" && event.detail.actionId === "blade");
  assert.equal(attack.detail.mode, "disadvantage", "attacks into Darkness should roll with disadvantage");
}

function testLeveledSpellSlotOncePerTurn() {
  const { snapshot, hero, enemy, log } = spellHarness();
  hero.spellSlots = { 1: { max: 2, current: 2 }, 2: { max: 1, current: 1 } };
  hero.actions.push(
    createSpellAction(SPELLS.shield_of_faith, { spellSaveDC: 13 }),
    createSpellAction(SPELLS.magic_missile, { spellSaveDC: 13 }),
    createSpellAction(SPELLS.fire_bolt, { attackBonus: 5, casterLevel: 7 })
  );

  assert.equal(resolveAction(snapshot, hero, "shield_of_faith", hero.id, scriptedDice(), log), true);
  assert.equal(hero.spellSlots[1].current, 1, "the first leveled spell should spend a slot");
  hero.economy.actionAvailable = true;
  assert.equal(resolveAction(snapshot, hero, "magic_missile", enemy.id, scriptedDice({ damage: 2 }), log), false, "a second spell-slot spell should be blocked on the same turn");
  assert.equal(resolveAction(snapshot, hero, "fire_bolt", enemy.id, scriptedDice({ d20: [15], damage: 3 }), log), true, "a cantrip should remain legal after spending one spell slot");
}

function testSelfCenteredAreaSpellsFilterTargets() {
  const { snapshot, hero, enemy, log } = spellHarness();
  const ally = {
    ...structuredClone(enemy),
    id: "ally",
    name: "Ally",
    team: "heroes",
    hp: 20,
    maxHp: 20,
    position: { x: 0, y: 1 },
  };
  enemy.position = { x: 1, y: 0 };
  snapshot.actors.push(ally);
  hero.actions.push(createSpellAction(SPELLS.word_of_radiance, { spellSaveDC: 13, casterLevel: 11 }));

  assert.equal(resolveAction(snapshot, hero, "word_of_radiance", null, scriptedDice({ d20: [1], damage: 6 }), log), true);
  assert.equal(enemy.hp, 14, "self-centered enemy-only area spells should damage nearby enemies");
  assert.equal(ally.hp, 20, "self-centered enemy-only area spells should not damage nearby allies");
}

function testEyebiteModesAndPersistentGaze() {
  const { snapshot, hero, enemy, log } = spellHarness();
  hero.actions.push(createSpellAction(SPELLS.eyebite, { spellSaveDC: 13 }));

  assert.equal(resolveAction(snapshot, hero, "eyebite", {
    targetId: enemy.id,
    choices: { effectMode: "panic" },
  }, scriptedDice({ d20: [1] }), log), true);
  assert.ok(enemy.conditions.some((condition) => condition.id === "frightened"), "Eyebite: Panic should apply Frightened on a failed save");

  const gaze = hero.actions.find((action) => action.id === "eyebite_gaze");
  assert.ok(gaze, "Eyebite should grant its persistent gaze action");
  assert.equal(gaze.usesExactSpellSlot, false, "the persistent gaze must not spend another spell slot");
  assert.equal(gaze.cost, "free", "the persistent gaze must not spend an action");
  assert.deepEqual(gaze.effectModeChoices.map((choice) => choice.id), ["sleep", "panic", "sickness"]);

  hero.economy.actionAvailable = true;
  assert.equal(resolveAction(snapshot, hero, "eyebite_gaze", {
    targetId: enemy.id,
    choices: { effectMode: "sickness" },
  }, scriptedDice({ d20: [1] }), log), true);
  assert.ok(enemy.conditions.some((condition) => condition.id === "poisoned"), "Eyebite's later gaze should be able to change to Sickness");
  assert.equal(resolveAction(snapshot, hero, "eyebite_gaze", {
    targetId: enemy.id,
    choices: { effectMode: "sleep" },
  }, scriptedDice({ d20: [1] }), log), false, "Eyebite's free gaze should still be limited to once per turn");
}

function testYolandesRegalPresenceResolvesAura() {
  const { snapshot, hero, enemy, log } = spellHarness();
  enemy.position = { x: 1, y: 0 };
  hero.actions.push(createSpellAction(SPELLS.yolandes_regal_presence, { spellSaveDC: 13 }));

  assert.equal(resolveAction(snapshot, hero, "yolandes_regal_presence", { anchor: hero.position }, scriptedDice({ d20: [1], damage: 5 }), log), true);
  const aura = snapshot.combatObjects.find((object) => object.sourceActionId === "yolandes_regal_presence");
  assert.ok(aura?.followsSource, "Yolande's aura should be attached to and follow its caster");
  assert.ok(aura.effects.some((effect) => effect.trigger === "turn_end" && effect.conditionOnFail === "prone" && effect.pushOnFailFt === 10), "Yolande's aura should damage, knock prone, and push on a failed save");
}

function testCleansingSpellRemovesRegisteredCondition() {
  const { snapshot, hero, log } = spellHarness();
  hero.conditions = [{ id: "poisoned", label: "Poisoned" }];
  hero.actions.push(createSpellAction(SPELLS.lesser_restoration, { spellSaveDC: 13 }));

  assert.equal(resolveAction(snapshot, hero, "lesser_restoration", hero.id, scriptedDice(), log), true);
  assert.equal(hero.conditions.some((condition) => condition.id === "poisoned"), false, "Lesser Restoration should remove one supported condition through the generic effect schema");
}

function testCureWoundsTargetsChosenAlly() {
  const { snapshot, hero, enemy, log } = spellHarness();
  const ally = {
    ...structuredClone(enemy),
    id: "ally",
    name: "Ally",
    team: "heroes",
    hp: 8,
    maxHp: 20,
    position: { x: 1, y: 0 },
  };
  snapshot.actors.push(ally);
  hero.actions.push(createSpellAction(SPELLS.cure_wounds, { spellSaveDC: 13 }));

  const cureWounds = hero.actions.find((action) => action.id === "cure_wounds");
  assert.equal(cureWounds.requiresTarget, true, "Cure Wounds should ask the player to choose a friendly target");
  assert.equal(resolveAction(snapshot, hero, "cure_wounds", ally.id, scriptedDice({ damage: 7 }), log), true);
  assert.equal(hero.hp, 20, "Cure Wounds should not auto-target the caster");
  assert.equal(ally.hp, 15, "Cure Wounds should heal the selected ally");
}

function testHealingWordIsFullyWired() {
  const { snapshot, hero, enemy, log } = spellHarness();
  const ally = {
    ...structuredClone(enemy),
    id: "ally",
    name: "Ally",
    team: "heroes",
    hp: 5,
    maxHp: 20,
    position: { x: 8, y: 0 },
  };
  snapshot.actors.push(ally);
  const healingWord = createSpellAction(SPELLS.healing_word, { spellcastingModifier: 3 });
  const upcastHealingWord = createSpellAction(SPELLS.healing_word, { spellcastingModifier: 3, slotLevel: 2 });
  hero.actions.push(healingWord);

  assert.ok(SPELLS.healing_word.classes.includes("Cleric"), "Healing Word should appear on the Cleric spell list");
  assert.equal(healingWord.cost, "bonus", "Healing Word should use a bonus action");
  assert.equal(healingWord.range, 12, "Healing Word should have a 60-foot range");
  assert.equal(healingWord.requiresTarget, true, "Healing Word should require a chosen target");
  assert.equal(healingWord.requiresSight, true, "Healing Word should require sight of its target");
  assert.equal(healingWord.requiresSpeech, true, "Healing Word should require its verbal component");
  assert.equal(healingWord.requiresHands, false, "Healing Word should not require a somatic component");
  assert.equal(healingWord.healing, "2d4+3", "Healing Word should compile its 2024 healing formula");
  assert.equal(upcastHealingWord.healing, "4d4+3", "Healing Word should add 2d4 per higher slot level");

  assert.equal(resolveAction(snapshot, hero, "healing_word", ally.id, scriptedDice({ damage: 8 }), log), true);
  assert.equal(ally.hp, 13, "Healing Word should heal the selected ally at range");
  assert.equal(hero.economy.bonusActionAvailable, false, "Healing Word should spend the caster's bonus action");
  assert.equal(hero.economy.actionAvailable, true, "Healing Word should leave the caster's action available");
}

function testAcBuffLogsModifierAndCurrentAc() {
  const { snapshot, hero, log } = spellHarness();
  hero.actions.push(createSpellAction(SPELLS.shield_of_faith, { spellSaveDC: 13 }));

  assert.equal(resolveAction(snapshot, hero, "shield_of_faith", hero.id, scriptedDice(), log), true);
  const applied = log.events.find((event) => event.type === "effect.applied" && event.detail?.stat === "ac");
  assert.ok(applied);
  assert.equal(applied.detail.amount, 2);
  assert.equal(applied.detail.currentAc, 17);
  assert.match(formatEvent(applied), /\+2 AC from Shield of Faith\. Current AC: 17\./);
}

function testAidRaisesCurrentAndMaximumHpForEachChosenTarget() {
  const { snapshot, hero, enemy, log } = spellHarness();
  const ally = { ...structuredClone(enemy), id: "ally", name: "Ally", team: "heroes", hp: 10, maxHp: 10, position: { x: 1, y: 0 } };
  snapshot.actors.push(ally);
  hero.actions.push(createSpellAction(SPELLS.aid, { slotLevel: 4, spellSaveDC: 13 }));

  assert.equal(resolveAction(snapshot, hero, "aid", { targetIds: [hero.id, ally.id] }, scriptedDice(), log), true);
  assert.equal(hero.maxHp, 35, "4th-level Aid should add 15 to maximum HP");
  assert.equal(hero.hp, 35, "4th-level Aid should add the same amount to current HP");
  assert.equal(ally.maxHp, 25);
  assert.equal(ally.hp, 25);
}

function testHealRestoresHpAndCleansesConditions() {
  const { snapshot, hero, log } = spellHarness();
  hero.hp = 1;
  hero.conditions = [{ id: "poisoned", label: "Poisoned" }];
  hero.actions.push(createSpellAction(SPELLS.heal, { slotLevel: 6, spellSaveDC: 13 }));

  assert.equal(resolveAction(snapshot, hero, "heal", hero.id, scriptedDice({ damage: 70 }), log), true);
  assert.equal(hero.hp, hero.maxHp);
  assert.equal(hero.conditions.some((condition) => condition.id === "poisoned"), false);
}

function testDeathWardPreventsOneLethalDamageEventWithoutSpendingReaction() {
  const { snapshot, hero, enemy, log } = spellHarness();
  enemy.position = { x: 1, y: 0 };
  hero.actions.push(createSpellAction(SPELLS.death_ward, { spellSaveDC: 13 }));
  assert.equal(resolveAction(snapshot, hero, "death_ward", hero.id, scriptedDice(), log), true);
  assert.equal(hero.activeEffects.some((effect) => effect.type === "death_ward"), true, "Death Ward should be visible while armed");
  const reactionBefore = hero.economy.reactionAvailable;

  enemy.actions.push({ id: "lethal", name: "Lethal", type: "weapon_attack", cost: "action", range: 1, attackBonus: 100, damage: "50", damageType: "slashing", tags: { harmful: true, melee: true } });
  assert.equal(resolveAction(snapshot, enemy, "lethal", hero.id, scriptedDice({ d20: [10], damage: 50 }), log), true);
  assert.equal(hero.hp, 1);
  assert.equal(hero.economy.reactionAvailable, reactionBefore, "Death Ward is automatic and does not consume a reaction");
  assert.equal(hero.activeEffects.some((effect) => effect.type === "death_ward"), false, "Death Ward should disappear after it triggers");
}

function testPersistentClericSpellFollowupActions() {
  const spiritual = spellHarness();
  spiritual.enemy.position = { x: 1, y: 0 };
  spiritual.hero.actions.push(createSpellAction(SPELLS.spiritual_weapon, { attackBonus: 20, spellcastingModifier: 3, slotLevel: 2 }));
  assert.equal(resolveAction(spiritual.snapshot, spiritual.hero, "spiritual_weapon", spiritual.enemy.id, scriptedDice({ d20: [10], damage: 7 }), spiritual.log), true);
  const strike = spiritual.hero.actions.find((action) => action.id === "spiritual_weapon_persistent_attack");
  assert.ok(strike, "Spiritual Weapon should grant its repeatable strike");
  spiritual.hero.economy.bonusActionAvailable = true;
  assert.equal(resolveAction(spiritual.snapshot, spiritual.hero, strike.id, spiritual.enemy.id, scriptedDice({ d20: [10], damage: 6 }), spiritual.log), true);

  const dawn = spellHarness();
  initLanterna({ startOilMinutes: 60 });
  dawn.hero.actions.push(createSpellAction(SPELLS.dawn, { spellSaveDC: 13, slotLevel: 5 }));
  assert.equal(resolveAction(dawn.snapshot, dawn.hero, "dawn", { anchor: { x: 3, y: 0 }, cells: [{ x: 3, y: 0 }] }, scriptedDice({ d20: [20], damage: 20 }), dawn.log), true);
  assert.equal(getLanterna().oil, 55, "Dawn should consume 5 Lanterna oil after resolving");
  const moveDawn = dawn.hero.actions.find((action) => action.id === "dawn_move_area");
  assert.ok(moveDawn, "Dawn should grant its bonus-action move");
  dawn.hero.economy.bonusActionAvailable = true;
  assert.equal(resolveAction(dawn.snapshot, dawn.hero, moveDawn.id, { anchor: { x: 4, y: 0 } }, scriptedDice(), dawn.log), true);
  assert.deepEqual(dawn.snapshot.combatObjects[0].position, { x: 4, y: 0 });
}

function spellHarness() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors[0];
  const enemy = snapshot.actors[1];
  const log = createCombatLog();
  hero.position = { x: 0, y: 0 };
  enemy.position = { x: 3, y: 0 };
  hero.hp = 20;
  hero.maxHp = 20;
  enemy.hp = 20;
  enemy.maxHp = 20;
  hero.saves.wis = 2;
  enemy.saves.wis = 0;
  return { snapshot, hero, enemy, log };
}

function testMaraHighLevelDamageSpellsResolve() {
  const cone = spellHarness();
  cone.hero.actions.push(createSpellAction(SPELLS.cone_of_cold, { spellSaveDC: 13, slotLevel: 5, usesExactSpellSlot: true }));
  cone.hero.spellSlots = { 5: { max: 1, current: 1, used: 0 } };
  assert.equal(resolveAction(cone.snapshot, cone.hero, "cone_of_cold", {
    anchor: cone.enemy.position,
    cells: [cone.enemy.position],
  }, scriptedDice({ d20: [1], damage: 36 }), cone.log), true);
  assert.equal(cone.enemy.hp, 0, "Cone of Cold should resolve its 60-foot CON-save cone damage");

  const chain = spellHarness();
  const second = structuredClone(chain.enemy);
  second.id = "enemy_two";
  second.name = "Enemy Two";
  second.position = { x: 4, y: 0 };
  second.hp = second.maxHp = 40;
  chain.enemy.hp = chain.enemy.maxHp = 40;
  chain.snapshot.actors.push(second);
  chain.hero.actions.push(createSpellAction(SPELLS.chain_lightning, { spellSaveDC: 13, slotLevel: 6, usesExactSpellSlot: true }));
  chain.hero.spellSlots = { 6: { max: 1, current: 1, used: 0 } };
  assert.equal(resolveAction(chain.snapshot, chain.hero, "chain_lightning", [chain.enemy.id, second.id], scriptedDice({ d20: [20, 1], damage: [40, 40] }), chain.log), true);
  assert.equal(chain.enemy.hp, 20, "Chain Lightning should deal half damage on a successful DEX save");
  assert.equal(second.hp, 0, "Chain Lightning should deal full damage on a failed DEX save");

  const dancing = spellHarness();
  const dancerTwo = { ...structuredClone(dancing.enemy), id: "dancer_two", name: "Dancer Two", position: { x: 4, y: 0 }, hp: 50, maxHp: 50 };
  const dancerThree = { ...structuredClone(dancing.enemy), id: "dancer_three", name: "Dancer Three", position: { x: 5, y: 0 }, hp: 50, maxHp: 50 };
  dancing.enemy.hp = dancing.enemy.maxHp = 50;
  dancing.snapshot.actors.push(dancerTwo, dancerThree);
  dancing.hero.actions.push(createSpellAction(SPELLS.dancing_flames, { spellSaveDC: 13, slotLevel: 7, usesExactSpellSlot: true }));
  dancing.hero.spellSlots = { 7: { max: 1, current: 1, used: 0 } };
  assert.equal(resolveAction(dancing.snapshot, dancing.hero, "dancing_flames", [dancing.enemy.id, dancerTwo.id, dancerThree.id], scriptedDice({ d20: [20, 1, 1], damage: [40, 40, 40] }), dancing.log), true);
  assert.equal(dancing.enemy.hp, 30, "Dancing Flames should deal half damage to a target that succeeds on its DEX save");
  assert.equal(dancerTwo.hp, 10, "Dancing Flames should deal full damage to its second target on a failed save");
  assert.equal(dancerThree.hp, 10, "Dancing Flames should deal full damage to its third target on a failed save");
}

function testForcecageCreatesContainmentBoundary() {
  const { snapshot, hero, enemy, log } = spellHarness();
  hero.actions.push(createSpellAction(SPELLS.forcecage, { spellSaveDC: 13, slotLevel: 7, usesExactSpellSlot: true }));
  hero.spellSlots = { 7: { max: 1, current: 1, used: 0 } };
  assert.equal(resolveAction(snapshot, hero, "forcecage", {
    anchor: enemy.position,
    cells: [enemy.position, { x: 4, y: 0 }, { x: 3, y: 1 }, { x: 4, y: 1 }],
  }, scriptedDice(), log), true);
  const cage = snapshot.combatObjects.find((object) => object.sourceActionId === "forcecage");
  assert.ok(cage, "Forcecage should create a persistent combat object");
  assert.equal(cage.blocksBoundaryMovement, true);
  assert.equal(cage.blocksTeleport, true);
  assert.equal(cage.teleportSaveAbility, "cha");
  assert.equal(cage.duration.rounds, 600, "Forcecage should persist for one hour");
  startTurn(snapshot, enemy, log, scriptedDice());
  assert.equal(canMoveTo(snapshot, enemy, { x: 2, y: 0 }).ok, false, "a trapped creature should not cross the Forcecage boundary");
  const withinCage = canMoveTo(snapshot, enemy, { x: 3, y: 1 });
  assert.equal(withinCage.ok, true, `Forcecage should not falsely prevent movement within the cage: ${withinCage.reason}`);

  enemy.actions.push({
    id: "cage_escape_teleport",
    name: "Escape Teleport",
    type: "spell_teleport",
    cost: "action",
    range: 6,
    requiresTarget: true,
    requiresSight: false,
    targeting: { shape: "radius", radiusSquares: 6, radiusFt: 30 },
  });
  enemy.saves.cha = 0;
  assert.equal(resolveAction(snapshot, enemy, "cage_escape_teleport", { x: 1, y: 0 }, scriptedDice({ d20: [1] }), log), false);
  assert.deepEqual(enemy.position, { x: 3, y: 0 }, "a failed Charisma save should leave the teleporter inside Forcecage");
  assert.equal(enemy.economy.actionAvailable, false, "a failed teleport escape should still spend the attempted action");
}

function testFinalizedHighLevelSpellAdaptations() {
  const pestilence = spellHarness();
  pestilence.enemy.position = { x: 1, y: 0 };
  pestilence.hero.actions.push(createSpellAction(SPELLS.pestilence, { spellSaveDC: 13 }));
  pestilence.enemy.hp = pestilence.enemy.maxHp = 100;
  assert.equal(resolveAction(pestilence.snapshot, pestilence.hero, "pestilence", {
    targetId: pestilence.enemy.id,
    choices: { saveAbility: "WIS" },
  }, scriptedDice({ d20: [20], damage: 40 }), pestilence.log), true);
  assert.equal(pestilence.enemy.hp, 80, "Pestilence should deal half damage on a successful save");
  assert.equal(pestilence.enemy.conditions.some((condition) => condition.id === "poisoned"), false, "successful Pestilence save should prevent its short debuff");

  const fortify = spellHarness();
  const allyTwo = structuredClone(fortify.hero);
  allyTwo.id = "ally_two";
  allyTwo.name = "Ally Two";
  allyTwo.position = { x: 1, y: 1 };
  allyTwo.tempHp = 0;
  fortify.snapshot.actors.push(allyTwo);
  fortify.hero.actions.push(createSpellAction(SPELLS.power_word_fortify));
  assert.equal(resolveAction(fortify.snapshot, fortify.hero, "power_word_fortify", [fortify.hero.id, allyTwo.id], scriptedDice(), fortify.log), true);
  assert.equal(fortify.hero.tempHp, 60, "Power Word Fortify should evenly divide its pool among selected targets");
  assert.equal(allyTwo.tempHp, 60, "each selected Fortify target should receive the same share");

  const prism = spellHarness();
  prism.enemy.hp = prism.enemy.maxHp = 100;
  prism.hero.actions.push(createSpellAction(SPELLS.prismatic_disarray, { spellSaveDC: 13 }));
  assert.equal(resolveAction(prism.snapshot, prism.hero, "prismatic_disarray", { anchor: prism.enemy.position }, scriptedDice({ d20: [1], damage: [3, 42] }), prism.log), true);
  assert.equal(prism.enemy.hp, 58, "Prismatic Disarray should apply its rolled damage");
  const prismDamage = prism.log.events.find((event) => event.type === "damage.applied" && event.detail.sourceId === prism.hero.id);
  assert.equal(prismDamage.detail.damageType, "lightning", "Prismatic Disarray should select one of its five damage types per target");

  const circleAction = createSpellAction(SPELLS.circle_of_power);
  assert.equal(circleAction.type, "spell_effect");
  assert.equal(circleAction.effects[0].type, "aura", "Circle of Power should compile to a following protective aura");
  const insectAction = createSpellAction(SPELLS.insect_plague, { spellSaveDC: 13 });
  assert.equal(insectAction.type, "spell_object");
  assert.equal(insectAction.object.difficultTerrain, true, "Insect Plague should compile to persistent difficult terrain");
  const waveAction = createSpellAction(SPELLS.destructive_wave, { spellSaveDC: 13 });
  assert.equal(waveAction.selfCenteredArea, true);
  assert.equal(waveAction.targetTeamFilter, "enemies", "Destructive Wave should spare allies");
  const regalAction = createSpellAction(SPELLS.yolandes_regal_presence, { spellSaveDC: 13 });
  assert.equal(regalAction.object.followsSource, true, "Yolande's Regal Presence should follow its caster");
}

export async function runSpellMechanicCombatTests() {
  testHexAddsDamageRiderToCasterAttackHits();
  testChromaticOrbUsesSelectedDamageType();
  testArmorOfAgathysTempHpAndRetaliation();
  testSanctuaryCanWasteIncomingAttack();
  testSleepEscalatesOnFailedRepeatSave();
  testWallOfForceCreatesBlockingObject();
  testEvardsMawTurnStartSaveUsesDice();
  testCastingNewConcentrationSpellDropsOldConcentrationEvenOnSaveSuccess();
  testBanishmentLastsTenTargetTurnEnds();
  testConcentrationCombatObjectExpiresAfterSourceDuration();
  testCanonicalForcedMovementSpellFamilies();
  testCanonicalNoOpportunityAndTeleportFamilies();
  testCantripRidersAndConditionalDamageResolve();
  testMultiBeamAndGrantedSpellActionsResolve();
  testIndividualSpellAssignmentsResolve();
  testDarknessBlocksSightAndImposesAttackDisadvantage();
  testLeveledSpellSlotOncePerTurn();
  testSelfCenteredAreaSpellsFilterTargets();
  testEyebiteModesAndPersistentGaze();
  testYolandesRegalPresenceResolvesAura();
  testCleansingSpellRemovesRegisteredCondition();
  testCureWoundsTargetsChosenAlly();
  testHealingWordIsFullyWired();
  testAcBuffLogsModifierAndCurrentAc();
  testAidRaisesCurrentAndMaximumHpForEachChosenTarget();
  testHealRestoresHpAndCleansesConditions();
  testDeathWardPreventsOneLethalDamageEventWithoutSpendingReaction();
  testPersistentClericSpellFollowupActions();
  testMaraHighLevelDamageSpellsResolve();
  testForcecageCreatesContainmentBoundary();
  testFinalizedHighLevelSpellAdaptations();
}
