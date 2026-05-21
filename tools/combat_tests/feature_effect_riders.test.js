import {
  assert,
  createCombatLog,
  createEmptyCharacterDraft,
  createEnemyCombatActor,
  createSnapshotFromScenario,
  fixedDice,
  hasCondition,
  resolveAction,
  resolveCharacterSheet,
  resolvedSheetToCombatActor,
} from "./helpers.js";

export function runFeatureEffectRiderCombatTests() {
  testDuelistFlourishModifierRider();
  testBattlemageMartialSigilsConditionRider();
  testLanternPulseConditionAction();
  testPrimalRoarConditionAction();
}

function testDuelistFlourishModifierRider() {
  const sheet = resolveCharacterSheet(createEmptyCharacterDraft({
    identity: { characterName: "Duelist Fighter", level: 3, classId: "fighter", subclassId: "duelist" },
    abilities: { strength: 12, dexterity: 16, constitution: 14, intelligence: 10, wisdom: 10, charisma: 8 },
  }), {}, { allowNonCreationLevel: true });
  const duelist = resolvedSheetToCombatActor(sheet, { id: "duelist", position: { x: 1, y: 1 } });
  duelist.actions.push(testMeleeAttack("rapier"));
  const target = createEnemyCombatActor("goblin", { id: "flourish_target", hp: 20, maxHp: 20, position: { x: 2, y: 1 } });
  const snapshot = createSnapshotFromScenario(testScenario("duelist-flourish-test", [duelist, target]));
  const actor = snapshot.actors.find((item) => item.id === "duelist");

  assert.equal(resolveAction(snapshot, actor, "rapier", "flourish_target", fixedDice({ d20: 10, damage: 4 }), createCombatLog()), true);
  assert.ok(actor.activeEffects.some((effect) => effect.id === "duelist_flourish_duelist" && effect.stat === "ac" && effect.amount === 2), "Flourish should add a generic AC modifier rider");
}

function testBattlemageMartialSigilsConditionRider() {
  const sheet = resolveCharacterSheet(createEmptyCharacterDraft({
    identity: { characterName: "Battlemage", level: 11, classId: "wizard", subclassId: "battlemage" },
    abilities: { strength: 12, dexterity: 14, constitution: 12, intelligence: 16, wisdom: 10, charisma: 10 },
  }), {}, { allowNonCreationLevel: true });
  const wizard = resolvedSheetToCombatActor(sheet, { id: "battlemage", position: { x: 1, y: 1 } });
  wizard.actions.push(testMeleeAttack("arcane_blade"));
  const target = createEnemyCombatActor("goblin", { id: "sigil_target", hp: 20, maxHp: 20, position: { x: 2, y: 1 } });
  const snapshot = createSnapshotFromScenario(testScenario("martial-sigils-test", [wizard, target]));
  const actor = snapshot.actors.find((item) => item.id === "battlemage");
  const enemy = snapshot.actors.find((item) => item.id === "sigil_target");

  assert.ok(actor.activeEffects.some((effect) => effect.id === "martial_sigils_ac" && effect.stat === "ac" && effect.amount === 1), "Martial Sigils passive AC should become a combat modifier");
  assert.equal(resolveAction(snapshot, actor, "arcane_blade", "sigil_target", fixedDice({ d20: 10, damage: 4 }), createCombatLog()), true);
  assert.equal(hasCondition(enemy, "next_attack_disadvantage"), true, "Martial Sigils should apply its generic condition rider on melee hit");
}

function testLanternPulseConditionAction() {
  const sheet = resolveCharacterSheet(createEmptyCharacterDraft({
    identity: { characterName: "Lantern Cleric", level: 7, classId: "cleric", subclassId: "lantern_domain" },
    abilities: { strength: 10, dexterity: 10, constitution: 12, intelligence: 10, wisdom: 16, charisma: 10 },
  }), {}, { allowNonCreationLevel: true });
  const cleric = resolvedSheetToCombatActor(sheet, { id: "lantern", position: { x: 1, y: 1 } });
  const target = createEnemyCombatActor("goblin", { id: "pulse_target", hp: 20, maxHp: 20, position: { x: 2, y: 1 }, saves: { con: 0 } });
  const snapshot = createSnapshotFromScenario(testScenario("lantern-pulse-test", [cleric, target]));
  const actor = snapshot.actors.find((item) => item.id === "lantern");
  const enemy = snapshot.actors.find((item) => item.id === "pulse_target");

  assert.equal(resolveAction(snapshot, actor, "lantern_pulse", null, fixedDice({ d20: 1 }), createCombatLog()), true);
  assert.equal(hasCondition(enemy, "blinded"), true, "Lantern's Pulse should blind nearby failed-save enemies");
  assert.equal(actor.resources.find((item) => item.id === "lantern_pulse").current, 0, "Lantern's Pulse should spend its resource");
}

function testPrimalRoarConditionAction() {
  const sheet = resolveCharacterSheet(createEmptyCharacterDraft({
    identity: { characterName: "Berserker", level: 7, classId: "fighter", subclassId: "berserker" },
    abilities: { strength: 16, dexterity: 12, constitution: 14, intelligence: 8, wisdom: 10, charisma: 10 },
  }), {}, { allowNonCreationLevel: true });
  const fighter = resolvedSheetToCombatActor(sheet, { id: "berserker", position: { x: 1, y: 1 } });
  const target = createEnemyCombatActor("goblin", { id: "roar_target", hp: 20, maxHp: 20, position: { x: 2, y: 1 }, saves: { wis: 0 } });
  const snapshot = createSnapshotFromScenario(testScenario("primal-roar-test", [fighter, target]));
  const actor = snapshot.actors.find((item) => item.id === "berserker");
  const enemy = snapshot.actors.find((item) => item.id === "roar_target");

  assert.equal(resolveAction(snapshot, actor, "primal_roar", null, fixedDice({ d20: 1 }), createCombatLog()), true);
  assert.equal(hasCondition(enemy, "frightened"), true, "Primal Roar should frighten nearby failed-save enemies");
  assert.equal(actor.resources.find((item) => item.id === "primal_roar").current, 0, "Primal Roar should spend its resource");
}

function testMeleeAttack(id) {
  return {
    id,
    name: id,
    type: "weapon_attack",
    range: 1,
    attackBonus: 20,
    damage: "1d6",
    damageType: "slashing",
    tags: { harmful: true, attackRoll: true, weapon: true, melee: true },
  };
}

function testScenario(id, actors) {
  return {
    id,
    grid: { width: 5, height: 5, blocked: [], cover: [] },
    actors,
  };
}
