import {
  assert,
  createCombatLog,
  createEmptyCharacterDraft,
  createEnemyCombatActor,
  createSnapshotFromScenario,
  fixedDice,
  hasCondition,
  hasReaction,
  resolveAction,
  resolveCharacterSheet,
  resolvedSheetToCombatActor,
  scriptedDice,
  startTurn,
} from "./helpers.js";
import { createHitPreventionAcPolicy } from "../../app/combat/reactionPolicy.js";
import { canUseAction } from "../../app/combat/rules.js";

export function runHighRiskFeatureCombatTests() {
  testWarlockAutomaticReactionConflictUsesOneReaction();
  testWarlockAutomaticReactionUsesOnlyLiveEffect();
  testWarpriestResolvesWeaponAttack();
  testHarnessDivinePowerRestoresSpellSlot();
  testSaboteurDoubleRigUnlocksFollowupDevice();
  testBladeChannelAddsWeaponDamage();
  testGrimoireRecallRestoresWarlockSlot();
  testTokenOfPassageTeleportsAndSpendsResource();
  testFormOfDreadAppliesTempHpAndFearRider();
  testBorrowedFlameRetaliatesWhileTempHpRemain();
  testDoorInTheFloorTeleportsAndLeavesAfterglow();
  testCataclysmicDebtMarksAndLinksDamage();
  testForbiddenTranscriptionRepeatsWarlockSpellWithRetargeting();
  testLastLightFieldBenefitsRevealsAndCollapses();
  testLastLightOverloadsAtEightDice();
  testGuidedStrikeConvertsNearMiss();
  testUnyieldingStancePreventsZeroHp();
  testIndomitabilityPreventsZeroHpAndRestoresHighestEligibleSlot();
  testSentinelAtDeathsDoorSuppressesAllyCritical();
  testSentinelAtDeathsDoorIgnoresNormalAllyHit();
  testSurprisedTargetCriticalAndRiders();
  testRogueSteadyAimAndUncannyDodge();
  testDefeatTriggerGrantsContextualAttack();
  testPromptedShieldPreventsEffectiveHit();
}

function testBladeChannelAddsWeaponDamage() {
  const warlock = warlockActor({ pactId: "pact_of_the_blade", level: 7, id: "blade_warlock" });
  const target = createEnemyCombatActor("goblin", { id: "target", hp: 20, maxHp: 20, ac: 12, position: { x: 2, y: 1 } });
  const snapshot = createSnapshotFromScenario(testScenario("blade-channel-test", [warlock, target]));
  const actor = snapshot.actors.find((item) => item.id === "blade_warlock");
  actor.actions.push(meleeAttack({ id: "test_blade", attackBonus: 20, damage: "1d6", tags: { harmful: true, attackRoll: true, weapon: true, melee: true } }));
  actor.resources.find((item) => item.id === "fiend_patrons_spear").current = 0;

  assert.equal(resolveAction(snapshot, actor, "blade_channel", { choices: { damageType: "fire" } }, fixedDice(), createCombatLog()), true);
  actor.economy.actionAvailable = true;
  assert.equal(resolveAction(snapshot, actor, "test_blade", "target", scriptedDice({ d20: [10], damage: [4, 3] }), createCombatLog()), true);
  assert.equal(snapshot.actors.find((item) => item.id === "target").hp, 13, "Blade Channel should add its weapon damage rider");
  assert.equal(actor.resources.find((item) => item.id === "blade_channel").current, 0, "Blade Channel should spend its resource");
}

function testGrimoireRecallRestoresWarlockSlot() {
  const warlock = warlockActor({ pactId: "pact_of_the_tome", level: 11, id: "tome_warlock" });
  warlock.spellSlots[5].current = 0;
  const snapshot = createSnapshotFromScenario(testScenario("grimoire-recall-test", [warlock]));
  const actor = snapshot.actors.find((item) => item.id === "tome_warlock");

  assert.equal(resolveAction(snapshot, actor, "grimoire_recall", null, fixedDice(), createCombatLog()), true);
  assert.equal(actor.spellSlots[5].current, 1, "Grimoire Recall should restore an expended pact slot");
  assert.equal(actor.resources.find((item) => item.id === "grimoire_recall").current, 0, "Grimoire Recall should spend its resource");
}

function testTokenOfPassageTeleportsAndSpendsResource() {
  const warlock = warlockActor({ pactId: "pact_of_the_tessera", level: 7, id: "tessera_warlock" });
  const snapshot = createSnapshotFromScenario(testScenario("token-of-passage-test", [warlock]));
  const actor = snapshot.actors.find((item) => item.id === "tessera_warlock");

  assert.equal(resolveAction(snapshot, actor, "token_of_passage", { x: 4, y: 1 }, fixedDice(), createCombatLog()), true);
  assert.deepEqual(actor.position, { x: 4, y: 1 }, "Token of Passage should teleport the warlock");
  assert.equal(actor.resources.find((item) => item.id === "token_of_passage").current, 0, "Token of Passage should spend its resource");
}

function testFormOfDreadAppliesTempHpAndFearRider() {
  const warlock = warlockActor({ subclassId: "the_undead", level: 3, id: "undead_warlock" });
  const target = createEnemyCombatActor("goblin", { id: "target", hp: 20, maxHp: 20, ac: 12, position: { x: 2, y: 1 } });
  const snapshot = createSnapshotFromScenario(testScenario("form-of-dread-test", [warlock, target]));
  const actor = snapshot.actors.find((item) => item.id === "undead_warlock");
  actor.actions.push(meleeAttack({ id: "test_claw", attackBonus: 20, damage: "1d6" }));

  assert.equal(resolveAction(snapshot, actor, "form_of_dread", null, scriptedDice({ damage: [8] }), createCombatLog()), true);
  assert.equal(actor.tempHp, 8, "Form of Dread should apply temporary HP");
  assert.equal(hasCondition(actor, "form_of_dread_active"), true, "Form of Dread should mark the active form");
  actor.economy.actionAvailable = true;
  assert.equal(resolveAction(snapshot, actor, "test_claw", "target", scriptedDice({ d20: [10, 1], damage: [4] }), createCombatLog()), true);
  assert.equal(hasCondition(snapshot.actors.find((item) => item.id === "target"), "frightened"), true, "Form of Dread hit rider should frighten on failed save");
}

function testBorrowedFlameRetaliatesWhileTempHpRemain() {
  const warlock = warlockActor({ subclassId: "the_lantern", level: 3, id: "lantern_warlock" });
  const attacker = createEnemyCombatActor("goblin", { id: "attacker", hp: 12, maxHp: 12, ac: 12, position: { x: 2, y: 1 } });
  attacker.actions = [meleeAttack({ id: "club", attackBonus: 20, damage: "1d6" })];
  const snapshot = createSnapshotFromScenario(testScenario("borrowed-flame-test", [warlock, attacker]));
  const actor = snapshot.actors.find((item) => item.id === "lantern_warlock");

  assert.equal(resolveAction(snapshot, actor, "borrowed_flame", null, scriptedDice({ damage: [6] }), createCombatLog()), true);
  assert.equal(actor.tempHp, 6, "Borrowed Flame should apply temporary HP");
  assert.equal(resolveAction(snapshot, snapshot.actors.find((item) => item.id === "attacker"), "club", "lantern_warlock", scriptedDice({ d20: [10], damage: [2, 3] }), createCombatLog()), true);
  assert.equal(snapshot.actors.find((item) => item.id === "attacker").hp, 9, "Borrowed Flame should retaliate with radiant damage while temp HP remain");
}

function testDoorInTheFloorTeleportsAndLeavesAfterglow() {
  const warlock = warlockActor({ subclassId: "the_lantern", level: 11, id: "lantern_warlock" });
  const snapshot = createSnapshotFromScenario(testScenario("door-in-floor-test", [warlock]));
  const actor = snapshot.actors.find((item) => item.id === "lantern_warlock");

  assert.equal(resolveAction(snapshot, actor, "door_in_the_floor", { x: 4, y: 1 }, fixedDice(), createCombatLog()), true);
  assert.deepEqual(actor.position, { x: 4, y: 1 }, "Door in the Floor should teleport the warlock");
  assert.equal((snapshot.combatObjects || []).some((object) => object.sourceActionId === "door_in_the_floor"), true, "Door in the Floor should create its afterglow object");
  assert.equal(actor.resources.find((item) => item.id === "door_in_the_floor").current, 0, "Door in the Floor should spend its resource");
}

function testCataclysmicDebtMarksAndLinksDamage() {
  const warlock = warlockActor({ subclassId: "the_lantern", pactId: "pact_of_the_tessera", level: 13, id: "tessera_warlock" });
  const first = createEnemyCombatActor("goblin", { id: "first", hp: 20, maxHp: 20, ac: 12, position: { x: 2, y: 1 } });
  const second = createEnemyCombatActor("goblin", { id: "second", hp: 20, maxHp: 20, ac: 12, position: { x: 3, y: 1 } });
  const saved = createEnemyCombatActor("goblin", { id: "saved", hp: 20, maxHp: 20, ac: 12, position: { x: 4, y: 1 }, saves: { cha: 20 } });
  const snapshot = createSnapshotFromScenario(testScenario("cataclysmic-debt-test", [warlock, first, second, saved]));
  const actor = snapshot.actors.find((item) => item.id === "tessera_warlock");
  actor.actions.push(meleeAttack({ id: "test_knife", attackBonus: 20, damage: "1d6" }));

  assert.equal(resolveAction(snapshot, actor, "cataclysmic_debt", null, fixedDice(), createCombatLog()), true);
  assert.equal(hasCondition(snapshot.actors.find((item) => item.id === "first"), "cataclysmic_debt"), true, "Cataclysmic Debt should mark nearby enemies");
  assert.equal(hasCondition(snapshot.actors.find((item) => item.id === "saved"), "cataclysmic_debt"), false, "A successful Charisma save should avoid the Cataclysmic Debt brand");
  actor.economy.actionAvailable = true;
  assert.equal(resolveAction(snapshot, actor, "test_knife", "first", scriptedDice({ d20: [10], damage: [4, 3] }), createCombatLog()), true);
  assert.equal(snapshot.actors.find((item) => item.id === "first").hp, 13, "Cataclysmic Debt should damage the hit branded target");
  assert.equal(snapshot.actors.find((item) => item.id === "second").hp, 17, "Cataclysmic Debt should echo damage to other branded targets");
  startTurn(snapshot, actor, createCombatLog(), fixedDice());
  assert.equal(resolveAction(snapshot, actor, "test_knife", "first", scriptedDice({ d20: [10], damage: [4] }), createCombatLog()), true);
  assert.equal(snapshot.actors.find((item) => item.id === "first").hp, 9, "A second hit in the same round should deal only normal weapon damage");
  assert.equal(snapshot.actors.find((item) => item.id === "second").hp, 17, "A second hit in the same round should not repeat linked damage to another branded creature");
  snapshot.round += 1;
  startTurn(snapshot, actor, createCombatLog(), fixedDice());
  assert.equal(resolveAction(snapshot, actor, "test_knife", "first", scriptedDice({ d20: [10], damage: [4, 3] }), createCombatLog()), true);
  assert.equal(snapshot.actors.find((item) => item.id === "first").hp, 2, "The hit target should take normal and linked damage again in a new round");
  assert.equal(snapshot.actors.find((item) => item.id === "second").hp, 14, "Linked damage should become available again for every branded creature in a new round");
}

function testForbiddenTranscriptionRepeatsWarlockSpellWithRetargeting() {
  const warlock = warlockActor({ pactId: "pact_of_the_tome", level: 13, id: "tome_warlock" });
  warlock.actions.push(testSpellAttack());
  const first = createEnemyCombatActor("goblin", { id: "first", hp: 20, maxHp: 20, ac: 12, position: { x: 2, y: 1 } });
  const second = createEnemyCombatActor("goblin", { id: "second", hp: 20, maxHp: 20, ac: 12, position: { x: 3, y: 1 } });
  const snapshot = createSnapshotFromScenario(testScenario("forbidden-transcription-test", [warlock, first, second]));
  const actor = snapshot.actors.find((item) => item.id === "tome_warlock");
  actor.resources.find((item) => item.id === "fiend_patrons_spear").current = 0;
  const log = createCombatLog();

  assert.equal(resolveAction(snapshot, actor, "test_warlock_spell", "first", scriptedDice({ d20: [10], damage: [4] }), log), true);
  assert.equal(actor.actions.some((action) => action.id === "forbidden_transcription_test_warlock_spell"), true, "Forbidden Transcription should grant an immediate repeat action");
  actor.economy.actionAvailable = true;
  assert.equal(resolveAction(snapshot, actor, "forbidden_transcription_test_warlock_spell", "second", scriptedDice({ d20: [10], damage: [5] }), log), true);
  assert.equal(snapshot.actors.find((item) => item.id === "first").hp, 16, "original spell should hit its first target");
  assert.equal(snapshot.actors.find((item) => item.id === "second").hp, 15, "repeat spell should allow retargeting");
  assert.equal(actor.resources.find((item) => item.id === "forbidden_transcription").current, 0, "repeat should spend Forbidden Transcription");
  assert.equal(actor.actions.some((action) => action.id === "forbidden_transcription_test_warlock_spell"), false, "repeat action should disappear after use");
}

function testLastLightFieldBenefitsRevealsAndCollapses() {
  const warlock = warlockActor({ subclassId: "the_lantern", level: 13, id: "lantern_warlock" });
  const ally = heroActor({ id: "ally", team: "heroes", hp: 20, maxHp: 20, position: { x: 2, y: 1 } });
  ally.conditions = [{ id: "frightened", label: "Frightened" }];
  const enemy = createEnemyCombatActor("goblin", { id: "enemy", hp: 30, maxHp: 30, ac: 12, position: { x: 3, y: 1 } });
  enemy.conditions = [{ id: "hidden", label: "Hidden" }];
  const snapshot = createSnapshotFromScenario(testScenario("last-light-test", [warlock, ally, enemy]));
  const actor = snapshot.actors.find((item) => item.id === "lantern_warlock");
  const activeAlly = snapshot.actors.find((item) => item.id === "ally");
  const activeEnemy = snapshot.actors.find((item) => item.id === "enemy");
  const log = createCombatLog();

  assert.equal(resolveAction(snapshot, actor, "last_light", { x: 2, y: 1 }, scriptedDice(), log), true);
  assert.equal(snapshot.combatObjects.length, 1, "Last Light should create a field");

  startTurn(snapshot, actor, log, scriptedDice());
  assert.equal(snapshot.combatObjects[0].timers.manual.currentDice, 5, "Last Light manual charge should escalate at the start of the caster turn");
  assert.equal(snapshot.combatObjects[0].timers.overload.currentDice, 5, "Last Light overload should escalate at the start of the caster turn");
  const collapse = actor.actions.find((action) => action.actionKind === "collapse_combat_object");
  assert.ok(collapse, "Last Light should grant a collapse action while the field exists");

  startTurn(snapshot, activeAlly, log, scriptedDice());
  assert.equal(activeAlly.tempHp, 3, "Last Light should grant ally temporary HP");
  assert.equal(hasCondition(activeAlly, "frightened"), false, "Last Light should clear frightened from allies inside");

  startTurn(snapshot, activeEnemy, log, scriptedDice());
  assert.equal(hasCondition(activeEnemy, "hidden"), false, "Last Light should reveal enemies inside");

  actor.economy.bonusActionAvailable = true;
  assert.equal(resolveAction(snapshot, actor, collapse.id, null, scriptedDice({ d20: [1], damage: [10] }), log), true);
  assert.equal(activeEnemy.hp, 20, "Collapsing Last Light should damage enemies inside");
  assert.equal(snapshot.combatObjects.length, 0, "Collapsed Last Light should remove the field");
}

function testLastLightOverloadsAtEightDice() {
  const warlock = warlockActor({ subclassId: "the_lantern", level: 13, id: "lantern_warlock" });
  const enemy = createEnemyCombatActor("goblin", { id: "enemy", hp: 30, maxHp: 30, ac: 12, position: { x: 3, y: 1 } });
  const snapshot = createSnapshotFromScenario(testScenario("last-light-overload-test", [warlock, enemy]));
  const actor = snapshot.actors.find((item) => item.id === "lantern_warlock");
  const activeEnemy = snapshot.actors.find((item) => item.id === "enemy");
  const log = createCombatLog();

  assert.equal(resolveAction(snapshot, actor, "last_light", { x: 2, y: 1 }, scriptedDice(), log), true);
  startTurn(snapshot, actor, log, scriptedDice());
  startTurn(snapshot, actor, log, scriptedDice());
  startTurn(snapshot, actor, log, scriptedDice());
  assert.equal(snapshot.combatObjects[0].timers.manual.currentDice, 7, "Last Light should remain available below 8d8");

  startTurn(snapshot, actor, log, scriptedDice({ d20: [1, 1], damage: [16, 16] }));
  assert.equal(activeEnemy.hp, 14, "Last Light overload should damage creatures inside at 8d8");
  assert.equal(snapshot.combatObjects.length, 0, "Last Light overload should remove the field");
  assert.equal(actor.actions.some((action) => action.actionKind === "collapse_combat_object"), false, "Last Light collapse action should disappear after overload");
}

function testWarpriestResolvesWeaponAttack() {
  const sheet = resolveCharacterSheet(createEmptyCharacterDraft({
    identity: { characterName: "War Cleric", level: 3, classId: "cleric", subclassId: "war_domain" },
    abilities: { strength: 14, dexterity: 10, constitution: 12, intelligence: 10, wisdom: 16, charisma: 8 },
  }), {}, { allowNonCreationLevel: true });
  const cleric = resolvedSheetToCombatActor(sheet, { id: "war_cleric", position: { x: 1, y: 1 } });
  cleric.actions.push(meleeAttack({ id: "test_mace", attackBonus: 20, damage: "1d6" }));
  const target = createEnemyCombatActor("goblin", { id: "target", hp: 12, maxHp: 12, ac: 12, position: { x: 2, y: 1 } });
  const snapshot = createSnapshotFromScenario(testScenario("warpriest-test", [cleric, target]));
  const actor = snapshot.actors.find((item) => item.id === "war_cleric");
  const enemy = snapshot.actors.find((item) => item.id === "target");

  assert.equal(resolveAction(snapshot, actor, "warpriest", "target", fixedDice({ d20: 10, damage: 4 }), createCombatLog()), true);
  assert.equal(enemy.hp, 8, "Warpriest should resolve a weapon attack against the selected enemy");
  assert.equal(actor.resources.find((item) => item.id === "channel_divinity").current, 1, "Warpriest should spend Channel Divinity");
  assert.equal(actor.economy.bonusActionAvailable, false, "Warpriest should spend the bonus action");
}

function testHarnessDivinePowerRestoresSpellSlot() {
  const sheet = resolveCharacterSheet(createEmptyCharacterDraft({
    identity: { characterName: "Cleric", level: 3, classId: "cleric" },
    abilities: { strength: 10, dexterity: 10, constitution: 12, intelligence: 10, wisdom: 16, charisma: 8 },
  }), {}, { allowNonCreationLevel: true });
  const cleric = resolvedSheetToCombatActor(sheet, { id: "cleric", position: { x: 1, y: 1 } });
  cleric.spellSlots[1].current = 0;
  cleric.spellSlots[2].current = 0;
  const snapshot = createSnapshotFromScenario(testScenario("harness-divine-power-test", [cleric]));
  const actor = snapshot.actors.find((item) => item.id === "cleric");

  assert.equal(resolveAction(snapshot, actor, "harness_divine_power", null, fixedDice(), createCombatLog()), true);
  assert.equal(actor.spellSlots[1].current, 1, "Harness Divine Power should restore the highest expended eligible spell slot");
  assert.equal(actor.spellSlots[2].current, 0, "Harness Divine Power should not exceed its maximum eligible slot level");
  assert.equal(actor.resources.find((item) => item.id === "channel_divinity").current, 1, "Harness Divine Power should spend Channel Divinity");
}

function testSaboteurDoubleRigUnlocksFollowupDevice() {
  const sheet = resolveCharacterSheet(createEmptyCharacterDraft({
    identity: { characterName: "Saboteur", level: 11, classId: "rogue", subclassId: "saboteur", backgroundId: "criminal", speciesId: "halfling", lineageId: "lightfoot" },
    abilities: { strength: 8, dexterity: 16, constitution: 14, intelligence: 14, wisdom: 10, charisma: 10 },
    choices: {
      backgroundAbilityScores: [{ ability: "dexterity", bonus: 2 }, { ability: "charisma", bonus: 1 }],
      weaponMasteryIds: ["rapier", "dagger"],
      classChoices: {
        origin_device: "fire_paper",
        saboteur_cookbook_recipes: ["poison_vial", "smoke_vial"],
        saboteur_grenado_recipe: "lightning_grenado",
        saboteur_free_recipe: "tar_vial",
        saboteur_advanced_recipes: ["fire_grenado", "makeshift_fan"],
      },
    },
    gear: { weaponIds: ["rapier", "dagger"], armorId: "studded_leather", inventory: [], attunedItemIds: [] },
    devices: { preparedRecipeIds: ["fire_paper", "poison_vial", "smoke_vial", "fire_grenado"] },
  }), {}, { allowNonCreationLevel: true });
  const saboteur = resolvedSheetToCombatActor(sheet, { id: "saboteur", position: { x: 1, y: 1 } });
  const snapshot = createSnapshotFromScenario(testScenario("saboteur-double-rig-test", [saboteur]));
  const actor = snapshot.actors.find((item) => item.id === "saboteur");
  const followup = actor.actions.find((action) => action.id === "double_rig_followup_fire_paper");

  assert.equal(canUseAction(actor, followup).ok, false, "Double Rig follow-up should be locked before the opener resolves");
  assert.equal(resolveAction(snapshot, actor, "double_rig_fire_paper", null, fixedDice(), createCombatLog()), true);
  assert.equal(canUseAction(actor, followup).ok, true, "Double Rig opener should unlock a free follow-up device");
  assert.equal(actor.resources.find((item) => item.id === "prepared_devices").current, 10, "Double Rig opener should spend one prepared device");
  assert.equal(actor.resources.find((item) => item.id === "quick_rigging").current, 1, "Double Rig opener should spend Quick Rigging");
  assert.equal(actor.resources.find((item) => item.id === "double_rig").current, 0, "Double Rig opener should spend Double Rig");
}

function testWarlockAutomaticReactionConflictUsesOneReaction() {
  for (const level of [5, 10, 13]) {
    const warlock = warlockActor({ level, id: "fiend_warlock" });
    warlock.turnFlags.hitsTakenSinceLastTurn = 3;
    const attacker = createEnemyCombatActor("goblin", { id: "attacker", hp: 30, maxHp: 30, position: { x: 2, y: 1 } });
    attacker.actions = [meleeAttack({ id: "club", attackBonus: 20, damage: "1d6" })];
    const snapshot = createSnapshotFromScenario(testScenario(`warlock-reaction-conflict-level-${level}-test`, [warlock, attacker]));
    const log = createCombatLog();

    assert.equal(resolveAction(snapshot, snapshot.actors.find((item) => item.id === "attacker"), "club", "fiend_warlock", scriptedDice({ d20: [10], damage: [4, 6] }), log), true);
    const defender = snapshot.actors.find((item) => item.id === "fiend_warlock");
    const source = snapshot.actors.find((item) => item.id === "attacker");
    const resolved = log.events.filter((event) => event.type === "reaction.resolve");
    const suppressed = log.events.filter((event) => event.type === "reaction.suppressed");

    assert.equal(resolved.length, 1, `only one automatic reaction should resolve at level ${level}`);
    assert.equal(resolved[0].detail.reactionId, "spiral_of_retribution", `Spiral of Retribution should win at level ${level}`);
    assert.equal(suppressed.length, 1, `the losing reaction should be logged at level ${level}`);
    assert.equal(suppressed[0].detail.reactionId, "hellish_rebuke");
    assert.ok(defender.resources.find((item) => item.id === "hellish_rebuke").current > 0, "suppressed Hellish Rebuke should remain available");
    assert.equal(defender.resources.find((item) => item.id === "spiral_of_retribution").current, 0);
    assert.equal(hasReaction(defender), false);
    assert.equal(source.hp, 24, "the winning retaliation reaction should damage the attacker once");
  }
}

function testWarlockAutomaticReactionUsesOnlyLiveEffect() {
  const warlock = warlockActor({ level: 5, id: "fiend_warlock" });
  warlock.turnFlags.hitsTakenSinceLastTurn = 1;
  const attacker = createEnemyCombatActor("goblin", { id: "attacker", hp: 30, maxHp: 30, position: { x: 2, y: 1 } });
  attacker.actions = [meleeAttack({ id: "club", attackBonus: 20, damage: "1d6" })];
  const snapshot = createSnapshotFromScenario(testScenario("warlock-single-live-reaction-test", [warlock, attacker]));
  const log = createCombatLog();

  assert.equal(resolveAction(snapshot, snapshot.actors.find((item) => item.id === "attacker"), "club", "fiend_warlock", scriptedDice({ d20: [10], damage: [4, 6] }), log), true);
  const defender = snapshot.actors.find((item) => item.id === "fiend_warlock");
  assert.ok(log.events.some((event) => event.type === "reaction.resolve" && event.detail.reactionId === "hellish_rebuke"), "Hellish Rebuke should trigger when Spiral is not live");
  assert.equal(defender.resources.find((item) => item.id === "hellish_rebuke").current, 0);
  assert.equal(defender.resources.find((item) => item.id === "spiral_of_retribution").current, 1);
}

function testGuidedStrikeConvertsNearMiss() {
  const sheet = resolveCharacterSheet(createEmptyCharacterDraft({
    identity: { characterName: "War Cleric", level: 7, classId: "cleric", subclassId: "war_domain" },
    abilities: { strength: 14, dexterity: 10, constitution: 12, intelligence: 10, wisdom: 16, charisma: 8 },
  }), {}, { allowNonCreationLevel: true });
  const cleric = resolvedSheetToCombatActor(sheet, { id: "war_cleric", position: { x: 1, y: 1 } });
  cleric.actions.push(meleeAttack({ id: "test_mace", attackBonus: 0, damage: "1d6" }));
  const target = createEnemyCombatActor("goblin", { id: "target", hp: 12, maxHp: 12, ac: 15, position: { x: 2, y: 1 } });
  const snapshot = createSnapshotFromScenario(testScenario("guided-strike-test", [cleric, target]));
  const actor = snapshot.actors.find((item) => item.id === "war_cleric");
  const enemy = snapshot.actors.find((item) => item.id === "target");
  const log = createCombatLog();

  assert.equal(resolveAction(snapshot, actor, "test_mace", "target", fixedDice({ d20: 10, damage: 4 }), log), true);
  assert.equal(enemy.hp, 8, "Guided Strike should convert a miss within +5 into a hit");
  assert.equal(actor.resources.find((item) => item.id === "guided_strike").current, 0, "Guided Strike should spend its resource");
  assert.equal(hasReaction(actor), false, "Guided Strike should spend the reaction");
  assert.ok(log.events.some((event) => event.type === "reaction.resolve" && event.detail.reactionId === "guided_strike"), "Guided Strike should be logged");
}

function testUnyieldingStancePreventsZeroHp() {
  const sheet = resolveCharacterSheet(createEmptyCharacterDraft({
    identity: { characterName: "Champion Fighter", level: 11, classId: "fighter", subclassId: "champion" },
    abilities: { strength: 12, dexterity: 16, constitution: 14, intelligence: 10, wisdom: 10, charisma: 8 },
  }), {}, { allowNonCreationLevel: true });
  const fighter = resolvedSheetToCombatActor(sheet, { id: "duelist", position: { x: 1, y: 1 } });
  fighter.hp = 6;
  fighter.maxHp = 30;
  const attacker = createEnemyCombatActor("goblin", { id: "attacker", hp: 12, maxHp: 12, position: { x: 2, y: 1 } });
  attacker.actions = [meleeAttack({ id: "club", attackBonus: 20, damage: "8d10" })];
  const snapshot = createSnapshotFromScenario(testScenario("unyielding-stance-test", [fighter, attacker]));
  const actor = snapshot.actors.find((item) => item.id === "attacker");
  const defender = snapshot.actors.find((item) => item.id === "duelist");

  assert.equal(resolveAction(snapshot, actor, "club", "duelist", fixedDice({ d20: 10, damage: 30 }), createCombatLog()), true);
  assert.equal(defender.hp, 1, "Unyielding Stance should leave the fighter at 1 HP");
  assert.equal(defender.defeated, false, "zero-HP prevention should not mark the fighter defeated");
  assert.equal(defender.resources.find((item) => item.id === "unyielding_stance").current, 0, "Unyielding Stance should spend its resource");

  actor.economy.actionAvailable = true;
  defender.economy.reactionAvailable = true;
  assert.equal(resolveAction(snapshot, actor, "club", "duelist", fixedDice({ d20: 10, damage: 30 }), createCombatLog()), true);
  assert.equal(defender.hp, 0, "zero-HP prevention should not trigger after its resource is spent");
  assert.equal(defender.defeated, true, "the fighter should be defeated once the prevention resource is gone");
}

function testIndomitabilityPreventsZeroHpAndRestoresHighestEligibleSlot() {
  const sheet = resolveCharacterSheet(createEmptyCharacterDraft({
    identity: { characterName: "Dirt Wizard", level: 13, classId: "wizard", subclassId: "dirt_wizard" },
    abilities: { strength: 8, dexterity: 14, constitution: 12, intelligence: 18, wisdom: 10, charisma: 10 },
  }), {}, { allowNonCreationLevel: true });
  const wizard = resolvedSheetToCombatActor(sheet, { id: "dirt_wizard", position: { x: 1, y: 1 } });
  wizard.hp = 5;
  wizard.spellSlots[4].current = 0;
  wizard.spellSlots[5].current -= 1;
  const attacker = createEnemyCombatActor("goblin", { id: "attacker", hp: 12, maxHp: 12, position: { x: 2, y: 1 } });
  attacker.actions = [meleeAttack({ id: "club", attackBonus: 20, damage: "8d10" })];
  const snapshot = createSnapshotFromScenario(testScenario("indomitability-test", [wizard, attacker]));
  const log = createCombatLog();

  assert.equal(resolveAction(snapshot, snapshot.actors.find((item) => item.id === "attacker"), "club", "dirt_wizard", fixedDice({ d20: 10, damage: 30 }), log), true);
  const defender = snapshot.actors.find((item) => item.id === "dirt_wizard");
  assert.equal(defender.hp, 1, "Indomitability should leave the wizard at 1 HP");
  assert.equal(defender.defeated, false);
  assert.equal(defender.spellSlots[5].current, defender.spellSlots[5].max, "Indomitability should restore the highest eligible expended slot");
  assert.equal(defender.spellSlots[4].current, 0, "Indomitability should restore only one slot");
  assert.equal(defender.resources.find((item) => item.id === "dirt_wizard_indomitability").current, 0);
  assert.ok(log.events.some((event) => event.type === "reaction.resolve" && event.detail.restoredSlotLevel === 5));
}

function testSentinelAtDeathsDoorSuppressesAllyCritical() {
  const sheet = resolveCharacterSheet(createEmptyCharacterDraft({
    identity: { characterName: "Grave Cleric", level: 7, classId: "cleric", subclassId: "grave_domain" },
    abilities: { strength: 10, dexterity: 10, constitution: 12, intelligence: 10, wisdom: 16, charisma: 8 },
  }), {}, { allowNonCreationLevel: true });
  const cleric = resolvedSheetToCombatActor(sheet, { id: "grave_cleric", position: { x: 1, y: 1 } });
  const ally = heroActor({ id: "ally", hp: 20, position: { x: 2, y: 1 } });
  const attacker = createEnemyCombatActor("goblin", { id: "attacker", hp: 12, maxHp: 12, position: { x: 3, y: 1 } });
  attacker.actions = [meleeAttack({ id: "club", attackBonus: 20, damage: "1d6" })];
  const snapshot = createSnapshotFromScenario(testScenario("sentinel-critical-test", [cleric, ally, attacker]));
  const log = createCombatLog();

  assert.equal(resolveAction(snapshot, snapshot.actors.find((item) => item.id === "attacker"), "club", "ally", fixedDice({ d20: 20, damage: 4 }), log), true);
  assert.equal(snapshot.actors.find((item) => item.id === "ally").hp, 16, "Sentinel should make the critical a normal hit");
  assert.equal(snapshot.actors.find((item) => item.id === "grave_cleric").resources.find((item) => item.id === "sentinel_at_deaths_door").current, 0, "Sentinel should spend its resource");
  assert.equal(hasReaction(snapshot.actors.find((item) => item.id === "grave_cleric")), false, "Sentinel should spend the cleric's reaction");
  assert.ok(log.events.some((event) => event.type === "attack.result" && event.detail.critical === false), "suppressed critical should be logged as non-critical");
}

function testSentinelAtDeathsDoorIgnoresNormalAllyHit() {
  const sheet = resolveCharacterSheet(createEmptyCharacterDraft({
    identity: { characterName: "Grave Cleric", level: 7, classId: "cleric", subclassId: "grave_domain" },
    abilities: { strength: 10, dexterity: 10, constitution: 12, intelligence: 10, wisdom: 16, charisma: 8 },
  }), {}, { allowNonCreationLevel: true });
  const cleric = resolvedSheetToCombatActor(sheet, { id: "grave_cleric", position: { x: 1, y: 1 } });
  const ally = heroActor({ id: "ally", hp: 20, position: { x: 2, y: 1 } });
  const attacker = createEnemyCombatActor("goblin", { id: "attacker", hp: 12, maxHp: 12, position: { x: 3, y: 1 } });
  attacker.actions = [meleeAttack({ id: "club", attackBonus: 20, damage: "1d6" })];
  const snapshot = createSnapshotFromScenario(testScenario("sentinel-normal-hit-test", [cleric, ally, attacker]));
  const log = createCombatLog();

  assert.equal(resolveAction(snapshot, snapshot.actors.find((item) => item.id === "attacker"), "club", "ally", fixedDice({ d20: 10, damage: 4 }), log), true);
  assert.equal(snapshot.actors.find((item) => item.id === "ally").hp, 16, "normal hit damage should still apply");
  assert.equal(snapshot.actors.find((item) => item.id === "grave_cleric").resources.find((item) => item.id === "sentinel_at_deaths_door").current, 1, "Sentinel should not spend resource on a non-critical hit");
  assert.equal(hasReaction(snapshot.actors.find((item) => item.id === "grave_cleric")), true, "Sentinel should not spend reaction on a non-critical hit");
  assert.equal(log.events.some((event) => event.type === "reaction.resolve" && event.detail.reactionId === "sentinel_at_deaths_door"), false);
}

function testSurprisedTargetCriticalAndRiders() {
  const sheet = resolveCharacterSheet(createEmptyCharacterDraft({
    identity: { characterName: "Assassin Rogue", level: 11, classId: "rogue", subclassId: "assassin" },
    abilities: { strength: 8, dexterity: 16, constitution: 12, intelligence: 10, wisdom: 10, charisma: 14 },
  }), {}, { allowNonCreationLevel: true });
  const rogue = resolvedSheetToCombatActor(sheet, { id: "assassin", position: { x: 1, y: 1 } });
  rogue.actions.push(meleeAttack({ id: "dagger", attackBonus: 20, damage: "1d6", damageType: "piercing" }));
  const target = createEnemyCombatActor("goblin", { id: "surprised_target", hp: 30, maxHp: 30, position: { x: 2, y: 1 } });
  target.conditions = [{ id: "surprised", label: "Surprised" }];
  const snapshot = createSnapshotFromScenario(testScenario("surprised-rider-test", [rogue, target]));
  const log = createCombatLog();

  assert.equal(resolveAction(snapshot, snapshot.actors.find((item) => item.id === "assassin"), "dagger", "surprised_target", fixedDice({ d20: 10, damage: 3 }), log), true);
  assert.equal(snapshot.actors.find((item) => item.id === "surprised_target").hp, 12, "surprised-target critical and damage riders should all apply");
  assert.ok(log.events.some((event) => event.type === "attack.result" && event.detail.critical === true), "surprised target hit should become critical");
}

function testRogueSteadyAimAndUncannyDodge() {
  const sheet = resolveCharacterSheet(createEmptyCharacterDraft({
    identity: { characterName: "Rogue", level: 5, classId: "rogue", subclassId: "assassin" },
    abilities: { strength: 8, dexterity: 16, constitution: 12, intelligence: 10, wisdom: 10, charisma: 14 },
  }), {}, { allowNonCreationLevel: true });
  const rogue = resolvedSheetToCombatActor(sheet, { id: "rogue", position: { x: 1, y: 1 } });
  rogue.actions.push(meleeAttack({ id: "dagger", attackBonus: 20, damage: "1d6", damageType: "piercing" }));
  const attacker = createEnemyCombatActor("goblin", { id: "attacker", hp: 20, maxHp: 20, position: { x: 2, y: 1 } });
  attacker.actions = [meleeAttack({ id: "club", attackBonus: 20, damage: "1d6" })];
  const snapshot = createSnapshotFromScenario(testScenario("rogue-core-feature-test", [rogue, attacker]));
  const actor = snapshot.actors.find((item) => item.id === "rogue");
  const log = createCombatLog();

  actor.economy.movementUsed = 1;
  assert.equal(canUseAction(actor, actor.actions.find((item) => item.id === "steady_aim")).ok, false, "Steady Aim should be unavailable after movement");
  actor.economy.movementUsed = 0;
  assert.equal(resolveAction(snapshot, actor, "steady_aim", null, fixedDice(), log), true);
  assert.ok(actor.activeEffects.some((effect) => effect.id === "steady_aim_advantage"), "Steady Aim should grant advantage on the next attack");
  assert.equal(hasCondition(actor, "steady_aim_speed_zero"), true, "Steady Aim should set Speed to 0 for the turn");

  const hpBefore = actor.hp;
  assert.equal(resolveAction(snapshot, snapshot.actors.find((item) => item.id === "attacker"), "club", "rogue", fixedDice({ d20: 10, damage: 5 }), log), true);
  assert.equal(actor.hp, hpBefore - 2, "Uncanny Dodge should halve incoming attack damage, rounding down");
  assert.equal(hasReaction(actor), false, "Uncanny Dodge should consume the Rogue's reaction");
  assert.ok(log.events.some((event) => event.type === "reaction.resolve" && event.detail.reactionId === "uncanny_dodge"), "Uncanny Dodge should be logged");
}

function testDefeatTriggerGrantsContextualAttack() {
  const sheet = resolveCharacterSheet(createEmptyCharacterDraft({
    identity: { characterName: "Berserker Fighter", level: 11, classId: "fighter", subclassId: "berserker" },
    abilities: { strength: 16, dexterity: 12, constitution: 14, intelligence: 8, wisdom: 10, charisma: 10 },
  }), {}, { allowNonCreationLevel: true });
  const berserker = resolvedSheetToCombatActor(sheet, { id: "berserker", position: { x: 1, y: 1 } });
  berserker.actions.push(meleeAttack({ id: "axe", attackBonus: 20, damage: "1d12" }));
  const first = createEnemyCombatActor("goblin", { id: "first_target", hp: 4, maxHp: 10, position: { x: 2, y: 1 } });
  const second = createEnemyCombatActor("goblin", { id: "second_target", hp: 10, maxHp: 10, position: { x: 1, y: 2 } });
  const snapshot = createSnapshotFromScenario(testScenario("defeat-trigger-test", [berserker, first, second]));
  const actor = snapshot.actors.find((item) => item.id === "berserker");

  assert.equal(resolveAction(snapshot, actor, "axe", "first_target", fixedDice({ d20: 10, damage: 4 }), createCombatLog()), true);
  assert.equal(snapshot.actors.find((item) => item.id === "first_target").hp, 0, "setup attack should defeat the target");
  assert.equal(actor.actions.some((action) => action.id === "triggered_savage_momentum" && action.cost === "bonus"), true, "defeat trigger should grant the contextual bonus attack");
  assert.equal(actor.economy.bonusActionAvailable, true, "defeat trigger should leave a bonus action available for the granted attack");
}

function testPromptedShieldPreventsEffectiveHit() {
  const mage = heroActor({
    id: "mage",
    name: "Mage",
    hp: 12,
    maxHp: 12,
    ac: 12,
    spellSlots: { 1: { max: 1, current: 1 } },
    actions: [{
      id: "shield",
      name: "Shield",
      type: "spell_effect",
      cost: "reaction",
      range: 0,
      effects: [{ type: "modifier", stat: "ac", amount: 5, trigger: "action_resolved" }],
      reactionPolicy: createHitPreventionAcPolicy({ id: "shield", minimumSlotLevel: 1, acBonus: 5 }),
    }],
  });
  const attacker = createEnemyCombatActor("goblin", { id: "attacker", hp: 12, maxHp: 12, position: { x: 2, y: 1 } });
  attacker.actions = [meleeAttack({ id: "club", attackBonus: 5, damage: "1d6" })];
  const snapshot = createSnapshotFromScenario(testScenario("shield-reaction-test", [mage, attacker]));
  snapshot.reactionDecisions = { shield: true };
  const log = createCombatLog();

  assert.equal(resolveAction(snapshot, snapshot.actors.find((item) => item.id === "attacker"), "club", "mage", fixedDice({ d20: 10, damage: 4 }), log), true);
  const defender = snapshot.actors.find((item) => item.id === "mage");
  assert.equal(defender.hp, 12, "Shield should prevent an effective incoming hit");
  assert.equal(defender.spellSlots[1].current, 0, "Shield should spend the lowest available spell slot");
  assert.equal(hasReaction(defender), false, "Shield should spend the reaction");
  assert.ok(defender.activeEffects.some((effect) => effect.id === "shield_reaction" && effect.amount === 5), "Shield should add its temporary AC effect");
  assert.ok(log.events.some((event) => event.type === "reaction.prompt" && event.detail.reactionId === "shield"), "Shield prompt should be logged");
}

function heroActor(overrides = {}) {
  return {
    id: "hero",
    name: "Hero",
    team: "heroes",
    role: "fighter",
    token: "H",
    hp: 20,
    maxHp: 20,
    ac: 12,
    speed: 6,
    position: { x: 1, y: 1 },
    saves: {},
    actions: [],
    ...overrides,
  };
}

function warlockActor({ level = 11, subclassId = "the_fiend", pactId = "pact_of_the_blade", id = "warlock" } = {}) {
  const sheet = resolveCharacterSheet(createEmptyCharacterDraft({
    identity: { characterName: "Warlock", level, classId: "warlock", subclassId, pactId },
    abilities: { strength: 8, dexterity: 14, constitution: 12, intelligence: 10, wisdom: 10, charisma: 16 },
    gear: { weaponIds: ["warlocks_gloves"] },
    choices: {
      classChoices: {
        pact: pactId,
        book_of_shadows_cantrips: ["guidance", "sacred_flame"],
        mystic_arcanum_spell: "mental_prison",
      },
    },
  }), {}, { allowNonCreationLevel: true });
  return resolvedSheetToCombatActor(sheet, { id, position: { x: 1, y: 1 } });
}

function testSpellAttack(overrides = {}) {
  return {
    id: "test_warlock_spell",
    name: "Test Warlock Spell",
    type: "spell_attack",
    cost: "action",
    requiresTarget: true,
    range: 12,
    attackBonus: 20,
    damage: "1d10",
    damageType: "force",
    spellLevel: 1,
    sourceSpellId: "test_warlock_spell",
    tags: { spell: true, attackRoll: true, harmful: true, ranged: true },
    ...overrides,
  };
}

function meleeAttack(overrides = {}) {
  return {
    id: "strike",
    name: "Strike",
    type: "weapon_attack",
    range: 1,
    attackBonus: 20,
    damage: "1d6",
    damageType: "bludgeoning",
    tags: { harmful: true, attackRoll: true, weapon: true, melee: true },
    ...overrides,
  };
}

function testScenario(id, actors) {
  return {
    id,
    grid: { width: 6, height: 5, blocked: [], cover: [] },
    actors,
  };
}
