import {
  assert,
  createCombatLog,
  createEmptyCharacterDraft,
  createEnemyCombatActor,
  createSnapshotFromScenario,
  fixedDice,
  hasReaction,
  resolveAction,
  resolveCharacterSheet,
  resolvedSheetToCombatActor,
  scriptedDice,
} from "./helpers.js";
import { createHitPreventionAcPolicy } from "../../app/combat/reactionPolicy.js";

export function runHighRiskFeatureCombatTests() {
  testGuidedStrikeConvertsNearMiss();
  testUnyieldingStancePreventsZeroHp();
  testSentinelAtDeathsDoorSuppressesAllyCritical();
  testSurprisedTargetCriticalAndRiders();
  testDefeatTriggerGrantsContextualAttack();
  testPromptedShieldPreventsEffectiveHit();
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
  assert.ok(log.events.some((event) => event.type === "attack.result" && event.detail.critical === false), "suppressed critical should be logged as non-critical");
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
