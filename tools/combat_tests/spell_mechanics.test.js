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
import { createSpellAction } from "../../app/combat/actionFactory.js";
import { formatEvent } from "../../app/combat/combatLog.js";
import { canSeeActor } from "../../app/combat/perception.js";
import { SPELLS } from "../../app/data/spells.js";

function testProduceFlameGrantsHurlAction() {
  const { snapshot, hero, enemy, log } = spellHarness();
  enemy.position = { x: 1, y: 0 };
  hero.actions.push(createSpellAction(SPELLS.produce_flame, { attackBonus: 5 }));

  assert.equal(resolveAction(snapshot, hero, "produce_flame", null, scriptedDice(), log), true);
  const hurl = hero.actions.find((action) => action.id === "produce_flame_hurl");
  assert.ok(hurl, "Produce Flame should grant a later hurl action");
  assert.equal(hurl.type, "spell_attack", "held spell follow-up should be a regular spell attack action");

  hero.economy.actionAvailable = true;
  assert.equal(resolveAction(snapshot, hero, hurl.id, enemy.id, scriptedDice({ d20: [15], damage: 5 }), log), true);
  assert.equal(enemy.hp, 15, "hurling the granted flame should deal fire damage");
}

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

function testConjureVerminMovingHazardUsesTriggerSave() {
  const { snapshot, hero, enemy, log } = spellHarness();
  hero.position = { x: 1, y: 1 };
  enemy.position = { x: 3, y: 0 };
  enemy.saves.dex = 0;
  hero.actions.push(createSpellAction(SPELLS.conjure_vermin, { spellSaveDC: 13 }));

  assert.equal(resolveAction(snapshot, hero, "conjure_vermin", { anchor: { ...hero.position } }, scriptedDice(), log), true);
  assert.equal(snapshot.combatObjects[0].followsSource, true, "Conjure Vermin should create a source-following combat object");

  const hpBefore = enemy.hp;
  assert.equal(moveActor(snapshot, enemy, { x: 3, y: 1 }, log, { dice: scriptedDice({ d20: [18], damage: 6 }) }), true);
  assert.equal(enemy.hp, hpBefore - 3, "successful moving-hazard save should apply half damage");
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
  hero.actions.push(createSpellAction(SPELLS.thorn_whip, { attackBonus: 5 }));

  assert.equal(resolveAction(snapshot, hero, "thorn_whip", enemy.id, scriptedDice({ d20: [15], damage: 1 }), log), true);
  assert.deepEqual(enemy.position, { x: 1, y: 0 }, "Thorn Whip should pull the target up to 10 feet toward the caster on hit");

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

export async function runSpellMechanicCombatTests() {
  testProduceFlameGrantsHurlAction();
  testHexAddsDamageRiderToCasterAttackHits();
  testChromaticOrbUsesSelectedDamageType();
  testArmorOfAgathysTempHpAndRetaliation();
  testSanctuaryCanWasteIncomingAttack();
  testSleepEscalatesOnFailedRepeatSave();
  testWallOfForceCreatesBlockingObject();
  testConjureVerminMovingHazardUsesTriggerSave();
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
  testCleansingSpellRemovesRegisteredCondition();
  testCureWoundsTargetsChosenAlly();
}
