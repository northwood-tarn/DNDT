import {
  assert,
  createCombatLog,
  createEmptyCharacterDraft,
  createEnemyCombatActor,
  createSnapshotFromScenario,
  resolveAction,
  resolveCharacterSheet,
  resolvedSheetToCombatActor,
  scriptedDice,
} from "./helpers.js";

export function runMarkCombatTests() {
  testVowOfEnmityMarkGrantsAttackAdvantage();
}

function testVowOfEnmityMarkGrantsAttackAdvantage() {
  const sheet = resolveCharacterSheet(createEmptyCharacterDraft({
    identity: {
      characterName: "Vengeance Paladin",
      level: 3,
      classId: "paladin",
      subclassId: "oath_of_vengeance",
    },
    abilities: {
      strength: 16,
      dexterity: 10,
      constitution: 14,
      intelligence: 8,
      wisdom: 10,
      charisma: 14,
    },
  }), {}, { allowNonCreationLevel: true });
  const paladin = resolvedSheetToCombatActor(sheet, { id: "paladin", position: { x: 1, y: 1 } });
  paladin.actions.push(testSword());
  const sworn = createEnemyCombatActor("goblin", { id: "sworn", hp: 20, maxHp: 20, ac: 13, position: { x: 2, y: 1 } });
  const other = createEnemyCombatActor("goblin", { id: "other", hp: 20, maxHp: 20, ac: 13, position: { x: 1, y: 2 } });
  const snapshot = createSnapshotFromScenario({
    id: "vow-mark-test",
    grid: { width: 5, height: 5, blocked: [], cover: [] },
    actors: [paladin, sworn, other],
  });
  const actor = snapshot.actors.find((item) => item.id === "paladin");
  const target = snapshot.actors.find((item) => item.id === "sworn");
  const log = createCombatLog();

  assert.equal(resolveAction(snapshot, actor, "vow_of_enmity", "sworn", scriptedDice(), log), true);
  assert.ok(target.marks.some((mark) => mark.id === "vow_of_enmity" && mark.sourceActorId === "paladin"), "Vow of Enmity should mark the target");
  assert.equal(actor.resources.find((item) => item.id === "vow_of_enmity").current, 0, "Vow of Enmity should spend its resource");

  assert.equal(resolveAction(snapshot, actor, "test_sword", "sworn", scriptedDice({ d20: [3, 17], damage: 4 }), log), true);
  assert.ok(log.events.some((event) =>
    event.type === "attack.roll" &&
    event.detail.targetId === "sworn" &&
    event.detail.mode === "advantage" &&
    event.detail.roll === 17
  ), "attacks against the marked target should roll with advantage");

  actor.economy.actionAvailable = true;
  assert.equal(resolveAction(snapshot, actor, "test_sword", "other", scriptedDice({ d20: [17, 3], damage: 4 }), log), true);
  assert.ok(log.events.some((event) =>
    event.type === "attack.roll" &&
    event.detail.targetId === "other" &&
    event.detail.mode === "normal" &&
    event.detail.roll === 17
  ), "attacks against unmarked targets should not receive mark advantage");
}

function testSword() {
  return {
    id: "test_sword",
    name: "Test Sword",
    type: "weapon_attack",
    range: 1,
    attackBonus: 0,
    damage: "1d8",
    damageType: "slashing",
    tags: { harmful: true, attackRoll: true, weapon: true, melee: true },
  };
}
