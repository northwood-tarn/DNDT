import {
  assert,
  createCombatLog,
  createEmptyCharacterDraft,
  createEnemyCombatActor,
  createSnapshotFromScenario,
  fixedDice,
  resolveAction,
  resolveCharacterSheet,
  resolvedSheetToCombatActor,
} from "./helpers.js";

export function runFeatureDamageRiderCombatTests() {
  testChampionExecute();
  testWarDomainDivineStrike();
  testLanternJudgingFlame();
}

function testChampionExecute() {
  const sheet = resolveCharacterSheet(createEmptyCharacterDraft({
    identity: { characterName: "Champion Fighter", level: 3, classId: "fighter", subclassId: "champion" },
    abilities: { strength: 16, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 10, charisma: 8 },
  }), {}, { allowNonCreationLevel: true });
  const champion = resolvedSheetToCombatActor(sheet, { id: "champion", position: { x: 1, y: 1 } });
  champion.actions.push(testAttack({ id: "test_sword", name: "Test Sword", damage: "1d8", damageType: "slashing" }));
  const target = createEnemyCombatActor("goblin", { id: "weak_target", hp: 5, maxHp: 20, position: { x: 2, y: 1 } });
  const snapshot = createSnapshotFromScenario(testScenario("champion-rider-test", [champion, target]));
  const actor = snapshot.actors.find((item) => item.id === "champion");
  const weakTarget = snapshot.actors.find((item) => item.id === "weak_target");

  assert.equal(resolveAction(snapshot, actor, "test_sword", "weak_target", fixedDice({ d20: 10, damage: 4 }), createCombatLog()), true);
  assert.equal(weakTarget.hp, 0, "Execute should add damage against a wounded target");
  assert.equal(actor.resources.find((item) => item.id === "champion_execute").current, 0, "Execute should spend its linked resource");

  const healthyChampion = resolvedSheetToCombatActor(sheet, { id: "healthy_champion", position: { x: 1, y: 1 } });
  healthyChampion.actions.push(testAttack({ id: "healthy_sword", name: "Healthy Sword", damage: "1d8", damageType: "slashing" }));
  const healthyTarget = createEnemyCombatActor("goblin", { id: "healthy_target", hp: 6, maxHp: 20, position: { x: 2, y: 1 } });
  const healthySnapshot = createSnapshotFromScenario(testScenario("champion-threshold-test", [healthyChampion, healthyTarget]));
  const healthyActor = healthySnapshot.actors.find((item) => item.id === "healthy_champion");
  const aboveThresholdTarget = healthySnapshot.actors.find((item) => item.id === "healthy_target");

  assert.equal(resolveAction(healthySnapshot, healthyActor, "healthy_sword", "healthy_target", fixedDice({ d20: 10, damage: 4 }), createCombatLog()), true);
  assert.equal(aboveThresholdTarget.hp, 2, "Execute should not trigger when the target was above threshold before the hit");
  assert.equal(healthyActor.resources.find((item) => item.id === "champion_execute").current, 1, "Execute should retain its use when threshold fails");
}

function testWarDomainDivineStrike() {
  const sheet = resolveCharacterSheet(createEmptyCharacterDraft({
    identity: { characterName: "War Cleric", level: 11, classId: "cleric", subclassId: "war_domain" },
    abilities: { strength: 16, dexterity: 10, constitution: 12, intelligence: 10, wisdom: 16, charisma: 10 },
  }), {}, { allowNonCreationLevel: true });
  const cleric = resolvedSheetToCombatActor(sheet, { id: "war_cleric", position: { x: 1, y: 1 } });
  cleric.actions.push(testAttack({ id: "war_mace", name: "War Mace", damage: "1d6", damageType: "bludgeoning" }));
  const target = createEnemyCombatActor("goblin", { id: "war_target", hp: 30, maxHp: 30, position: { x: 2, y: 1 } });
  const snapshot = createSnapshotFromScenario(testScenario("war-rider-test", [cleric, target]));
  const actor = snapshot.actors.find((item) => item.id === "war_cleric");
  const divineTarget = snapshot.actors.find((item) => item.id === "war_target");

  assert.equal(resolveAction(snapshot, actor, "war_mace", "war_target", fixedDice({ d20: 10, damage: 4 }), createCombatLog()), true);
  assert.equal(divineTarget.hp, 22, "Divine Strike should add one weapon-hit rider per turn");
  actor.economy.actionAvailable = true;
  assert.equal(resolveAction(snapshot, actor, "war_mace", "war_target", fixedDice({ d20: 10, damage: 4 }), createCombatLog()), true);
  assert.equal(divineTarget.hp, 18, "Divine Strike should not apply twice in the same turn");
}

function testLanternJudgingFlame() {
  const sheet = resolveCharacterSheet(createEmptyCharacterDraft({
    identity: { characterName: "Lantern Cleric", level: 11, classId: "cleric", subclassId: "lantern_domain" },
    abilities: { strength: 10, dexterity: 10, constitution: 12, intelligence: 10, wisdom: 16, charisma: 10 },
  }), {}, { allowNonCreationLevel: true });
  const cleric = resolvedSheetToCombatActor(sheet, { id: "judging_cleric", position: { x: 1, y: 1 } });
  cleric.actions.push(testAttack({
    id: "radiant_spell",
    name: "Radiant Spell",
    type: "spell_attack",
    range: 6,
    damage: "1d6",
    damageType: "radiant",
    tags: { harmful: true, attackRoll: true, spell: true, ranged: true },
  }));
  const target = createEnemyCombatActor("goblin", { id: "judged_target", hp: 30, maxHp: 30, position: { x: 3, y: 1 } });
  const snapshot = createSnapshotFromScenario(testScenario("lantern-rider-test", [cleric, target]));
  const actor = snapshot.actors.find((item) => item.id === "judging_cleric");
  const judgedTarget = snapshot.actors.find((item) => item.id === "judged_target");

  assert.equal(resolveAction(snapshot, actor, "radiant_spell", "judged_target", fixedDice({ d20: 10, damage: 4 }), createCombatLog()), true);
  assert.equal(judgedTarget.hp, 23, "Judging Flame should add Wisdom modifier to first radiant spell damage each turn");
}

function testAttack(overrides = {}) {
  return {
    type: "weapon_attack",
    range: 1,
    attackBonus: 20,
    tags: { harmful: true, attackRoll: true, weapon: true, melee: true },
    ...overrides,
  };
}

function testScenario(id, actors) {
  return {
    id,
    grid: { width: 5, height: 5, blocked: [], cover: [] },
    actors,
  };
}
