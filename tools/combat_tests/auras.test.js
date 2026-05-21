import { rollSaveModifier } from "../../app/combat/modifiers.js";
import { getEffectiveSpeed } from "../../app/combat/modifiers.js";
import { combatAuraEffectsAffectingActor, hasAuraConditionPrevention } from "../../app/combat/auras.js";
import {
  assert,
  createEmptyCharacterDraft,
  createCombatLog,
  createEnemyCombatActor,
  createSnapshotFromScenario,
  fixedDice,
  resolveAction,
  resolveCharacterSheet,
  resolvedSheetToCombatActor,
  scriptedDice,
  startTurn,
} from "./helpers.js";

export function runAuraCombatTests() {
  testAuraOfProtectionAppliesToSelfAndNearbyAllies();
  testDuplicateAuraModifiersUseStrongestOnly();
  testDuplicateAuraPreventionsCollapse();
  testAuraOfCouragePreventsFrightened();
  testAuraOfAlacrityAdjustsSpeed();
  testAuraOfTheGraveTriggersAtTurnStart();
  testHaloOfDaybreakCreatesPersistentAura();
}

function testDuplicateAuraModifiersUseStrongestOnly() {
  const strongSheet = resolveCharacterSheet(createEmptyCharacterDraft({
    identity: { characterName: "Strong Aura Paladin", level: 6, classId: "paladin", subclassId: "oath_of_vengeance" },
    abilities: { strength: 14, dexterity: 10, constitution: 14, intelligence: 8, wisdom: 10, charisma: 16 },
  }), {}, { allowNonCreationLevel: true });
  const weakSheet = resolveCharacterSheet(createEmptyCharacterDraft({
    identity: { characterName: "Weak Aura Paladin", level: 6, classId: "paladin", subclassId: "oath_of_vengeance" },
    abilities: { strength: 14, dexterity: 10, constitution: 14, intelligence: 8, wisdom: 10, charisma: 14 },
  }), {}, { allowNonCreationLevel: true });
  const strong = resolvedSheetToCombatActor(strongSheet, { id: "strong_paladin", position: { x: 1, y: 1 } });
  const weak = resolvedSheetToCombatActor(weakSheet, { id: "weak_paladin", position: { x: 2, y: 1 } });
  const target = ally("ally_target", { x: 3, y: 1 });
  const snapshot = createSnapshotFromScenario({
    id: "duplicate-aura-modifier-test",
    grid: { width: 6, height: 4, blocked: [], cover: [] },
    actors: [strong, weak, target],
  });

  assertSaveBonus(snapshot, snapshot.actors.find((item) => item.id === "ally_target"), 3, "overlapping Aura of Protection bonuses should use the strongest only");
}

function testDuplicateAuraPreventionsCollapse() {
  const firstSheet = resolveCharacterSheet(createEmptyCharacterDraft({
    identity: { characterName: "First Courage Paladin", level: 10, classId: "paladin", subclassId: "oath_of_vengeance" },
    abilities: { strength: 14, dexterity: 10, constitution: 14, intelligence: 8, wisdom: 10, charisma: 16 },
  }), {}, { allowNonCreationLevel: true });
  const secondSheet = resolveCharacterSheet(createEmptyCharacterDraft({
    identity: { characterName: "Second Courage Paladin", level: 10, classId: "paladin", subclassId: "oath_of_vengeance" },
    abilities: { strength: 14, dexterity: 10, constitution: 14, intelligence: 8, wisdom: 10, charisma: 14 },
  }), {}, { allowNonCreationLevel: true });
  const first = resolvedSheetToCombatActor(firstSheet, { id: "first_paladin", position: { x: 1, y: 1 } });
  const second = resolvedSheetToCombatActor(secondSheet, { id: "second_paladin", position: { x: 2, y: 1 } });
  const target = ally("ally_target", { x: 3, y: 1 });
  const snapshot = createSnapshotFromScenario({
    id: "duplicate-aura-prevention-test",
    grid: { width: 6, height: 4, blocked: [], cover: [] },
    actors: [first, second, target],
  });
  const affected = snapshot.actors.find((item) => item.id === "ally_target");
  const preventionEffects = combatAuraEffectsAffectingActor(snapshot, affected)
    .filter((effect) => effect.type === "condition_prevention" && effect.conditions.includes("frightened"));

  assert.equal(preventionEffects.length, 1, "duplicate Aura of Courage prevention should collapse to one effect");
  assert.ok(hasAuraConditionPrevention(snapshot, affected, "frightened"), "collapsed prevention should still protect the ally");
}

function testAuraOfProtectionAppliesToSelfAndNearbyAllies() {
  const sheet = resolveCharacterSheet(createEmptyCharacterDraft({
    identity: {
      characterName: "Aura Paladin",
      level: 6,
      classId: "paladin",
      subclassId: "oath_of_vengeance",
    },
    abilities: {
      strength: 14,
      dexterity: 10,
      constitution: 14,
      intelligence: 8,
      wisdom: 10,
      charisma: 16,
    },
  }), {}, { allowNonCreationLevel: true });
  const paladin = resolvedSheetToCombatActor(sheet, { id: "paladin", position: { x: 1, y: 1 } });
  const allyNear = ally("ally_near", { x: 3, y: 1 });
  const allyFar = ally("ally_far", { x: 5, y: 1 });
  const enemyNear = createEnemyCombatActor("goblin", { id: "enemy_near", position: { x: 2, y: 1 } });
  const snapshot = createSnapshotFromScenario({
    id: "aura-of-protection-test",
    grid: { width: 8, height: 4, blocked: [], cover: [] },
    actors: [paladin, allyNear, allyFar, enemyNear],
  });
  const actor = snapshot.actors.find((item) => item.id === "paladin");
  const near = snapshot.actors.find((item) => item.id === "ally_near");
  const far = snapshot.actors.find((item) => item.id === "ally_far");
  const enemy = snapshot.actors.find((item) => item.id === "enemy_near");

  assert.equal(actor.auras.length, 1, "level 6 paladin should carry Aura of Protection as an aura");
  assertSaveBonus(snapshot, actor, 3, "paladin should benefit from their own aura");
  assertSaveBonus(snapshot, near, 3, "nearby ally should benefit from Aura of Protection");
  assertSaveBonus(snapshot, far, 0, "ally outside 10 ft should not benefit from Aura of Protection");
  assertSaveBonus(snapshot, enemy, 0, "enemy should not benefit from allied aura");
}

function testAuraOfCouragePreventsFrightened() {
  const sheet = resolveCharacterSheet(createEmptyCharacterDraft({
    identity: { characterName: "Courage Paladin", level: 10, classId: "paladin", subclassId: "oath_of_vengeance" },
    abilities: { strength: 14, dexterity: 10, constitution: 14, intelligence: 8, wisdom: 10, charisma: 16 },
  }), {}, { allowNonCreationLevel: true });
  const paladin = resolvedSheetToCombatActor(sheet, { id: "paladin", position: { x: 1, y: 1 } });
  const allyNear = ally("ally_near", { x: 2, y: 1 });
  const snapshot = createSnapshotFromScenario({
    id: "aura-courage-test",
    grid: { width: 5, height: 5, blocked: [], cover: [] },
    actors: [paladin, allyNear],
  });
  const prevented = snapshot.actors.find((item) => item.id === "ally_near");
  const courage = snapshot.actors.find((item) => item.id === "paladin").auras.find((aura) => aura.id === "aura_of_courage");
  assert.ok(courage, "level 10 paladin should carry Aura of Courage");
  assert.ok(courage.effects.some((effect) => effect.type === "condition_prevention" && effect.conditions.includes("frightened")));
  assert.ok(hasAuraConditionPrevention(snapshot, prevented, "frightened"), "nearby ally should be protected from frightened");
  assert.equal(rollSaveModifier(snapshot, prevented, "wis", { name: "Fear", effectTags: ["fear"] }, scriptedDice()).total, 3);
}

function testAuraOfAlacrityAdjustsSpeed() {
  const sheet = resolveCharacterSheet(createEmptyCharacterDraft({
    identity: { characterName: "Glory Paladin", level: 7, classId: "paladin", subclassId: "oath_of_glory" },
    abilities: { strength: 14, dexterity: 10, constitution: 14, intelligence: 8, wisdom: 10, charisma: 16 },
  }), {}, { allowNonCreationLevel: true });
  const paladin = resolvedSheetToCombatActor(sheet, { id: "paladin", position: { x: 1, y: 1 } });
  const enemyNear = createEnemyCombatActor("goblin", { id: "enemy_near", speed: 6, position: { x: 2, y: 1 } });
  const enemyFar = createEnemyCombatActor("goblin", { id: "enemy_far", speed: 6, position: { x: 5, y: 1 } });
  const snapshot = createSnapshotFromScenario({
    id: "aura-alacrity-test",
    grid: { width: 8, height: 4, blocked: [], cover: [] },
    actors: [paladin, enemyNear, enemyFar],
  });
  const actor = snapshot.actors.find((item) => item.id === "paladin");
  const near = snapshot.actors.find((item) => item.id === "enemy_near");
  const far = snapshot.actors.find((item) => item.id === "enemy_far");
  assert.equal(getEffectiveSpeed(snapshot, actor), 8, "Aura of Alacrity should increase the glory paladin's speed by 10 ft");
  assert.equal(getEffectiveSpeed(snapshot, near), 4, "nearby enemies should lose 10 ft of speed");
  assert.equal(getEffectiveSpeed(snapshot, far), 6, "distant enemies should keep normal speed");
}

function testAuraOfTheGraveTriggersAtTurnStart() {
  const sheet = resolveCharacterSheet(createEmptyCharacterDraft({
    identity: { characterName: "Grave Warlock", level: 11, classId: "warlock", subclassId: "the_undead" },
    abilities: { strength: 8, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 10, charisma: 16 },
  }), {}, { allowNonCreationLevel: true });
  const warlock = resolvedSheetToCombatActor(sheet, { id: "warlock", position: { x: 1, y: 1 } });
  const enemyNear = createEnemyCombatActor("goblin", { id: "enemy_near", hp: 12, maxHp: 12, saves: { wis: 0 }, position: { x: 2, y: 1 } });
  const snapshot = createSnapshotFromScenario({
    id: "aura-grave-test",
    grid: { width: 5, height: 5, blocked: [], cover: [] },
    actors: [warlock, enemyNear],
  });
  const enemy = snapshot.actors.find((item) => item.id === "enemy_near");
  const log = createCombatLog();
  startTurn(snapshot, enemy, log, scriptedDice({ d20: [2], damage: 3 }));
  assert.ok(enemy.conditions.some((condition) => condition.id === "frightened"), "enemy should become frightened on failed Aura of the Grave save");
}

function testHaloOfDaybreakCreatesPersistentAura() {
  const sheet = resolveCharacterSheet(createEmptyCharacterDraft({
    identity: { characterName: "Lantern Cleric", level: 13, classId: "cleric", subclassId: "lantern_domain" },
    abilities: { strength: 8, dexterity: 10, constitution: 14, intelligence: 10, wisdom: 16, charisma: 12 },
  }), {}, { allowNonCreationLevel: true });
  const cleric = resolvedSheetToCombatActor(sheet, { id: "cleric", position: { x: 2, y: 2 } });
  const snapshot = createSnapshotFromScenario({
    id: "halo-daybreak-test",
    grid: { width: 6, height: 6, blocked: [], cover: [] },
    actors: [cleric],
  });
  const actor = snapshot.actors.find((item) => item.id === "cleric");
  const log = createCombatLog();
  assert.equal(resolveAction(snapshot, actor, "halo_of_daybreak", actor.position, fixedDice(), log), true);
  assert.ok(snapshot.combatObjects.some((object) => object.name === "Halo of Daybreak" && object.followsSource), "Halo of Daybreak should create a source-following combat object");
}

function assertSaveBonus(snapshot, actor, expected, message) {
  const modifier = rollSaveModifier(snapshot, actor, "wis", { name: "Test Save" }, scriptedDice());
  assert.equal(modifier.total, expected, message);
  if (expected > 0) {
    assert.ok(modifier.reasons.some((reason) => reason.includes("Aura of Protection")), "aura modifier should name its source");
  }
}

function ally(id, position) {
  return {
    id,
    name: id,
    team: "heroes",
    role: "fighter",
    token: "A",
    hp: 12,
    maxHp: 12,
    ac: 14,
    speed: 6,
    position,
    saves: { wis: 0 },
    actions: [],
  };
}
