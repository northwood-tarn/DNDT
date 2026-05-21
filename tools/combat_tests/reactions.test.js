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
} from "./helpers.js";

export function runReactionCombatTests() {
  testEvasiveStepCounterAttack();
  testStormsThunderDamageReaction();
  testStonesEnduranceReductionReaction();
}

function testEvasiveStepCounterAttack() {
  const sheet = resolveCharacterSheet(createEmptyCharacterDraft({
    identity: { characterName: "Duelist Fighter", level: 7, classId: "fighter", subclassId: "duelist" },
    abilities: { strength: 12, dexterity: 16, constitution: 14, intelligence: 10, wisdom: 10, charisma: 8 },
  }), {}, { allowNonCreationLevel: true });
  const duelist = resolvedSheetToCombatActor(sheet, { id: "duelist", position: { x: 1, y: 1 } });
  duelist.actions.push(meleeAttack("rapier", 20));
  const enemy = createEnemyCombatActor("goblin", { id: "attacker", hp: 20, maxHp: 20, position: { x: 2, y: 1 } });
  enemy.actions = [meleeAttack("club", -10)];
  const snapshot = createSnapshotFromScenario(testScenario("evasive-step-test", [duelist, enemy]));
  const log = createCombatLog();
  const attacker = snapshot.actors.find((item) => item.id === "attacker");
  const defender = snapshot.actors.find((item) => item.id === "duelist");

  assert.equal(resolveAction(snapshot, attacker, "club", "duelist", fixedDice({ d20: 5, damage: 4 }), log), true);
  assert.equal(attacker.hp, 16, "Evasive Step should make a basic melee counterattack after a melee miss");
  assert.equal(hasReaction(defender), false, "Evasive Step should spend the defender's reaction");
  assert.ok(log.events.some((event) => event.type === "reaction.resolve" && event.detail.reactionId === "duelist_evasive_step"), "Evasive Step should be logged as a reaction");
}

function testStormsThunderDamageReaction() {
  const defender = reactionActor({
    id: "storm_goliath",
    name: "Storm Goliath",
    feature: {
      id: "species:goliath.storm:storms_thunder",
      name: "Storm's Thunder",
      effects: {
        triggeredEffects: [{
          id: "storms_thunder",
          trigger: "takes_damage_from_creature",
          reaction: true,
          rangeFt: 60,
          damage: "1d8",
          damageType: "thunder",
          target: "damage_source",
        }],
      },
    },
    resource: { id: "storms_thunder", name: "Storm's Thunder", max: 1, current: 1, recovery: "long_rest" },
  });
  const attacker = createEnemyCombatActor("goblin", { id: "attacker", hp: 20, maxHp: 20, position: { x: 2, y: 1 } });
  attacker.actions = [meleeAttack("club", 20)];
  const snapshot = createSnapshotFromScenario(testScenario("storms-thunder-test", [defender, attacker]));
  const actor = snapshot.actors.find((item) => item.id === "attacker");

  assert.equal(resolveAction(snapshot, actor, "club", "storm_goliath", fixedDice({ d20: 10, damage: 4 }), createCombatLog()), true);
  assert.equal(snapshot.actors.find((item) => item.id === "storm_goliath").hp, 16, "base attack damage should apply");
  assert.equal(snapshot.actors.find((item) => item.id === "attacker").hp, 16, "Storm's Thunder should damage the source");
  assert.equal(hasReaction(snapshot.actors.find((item) => item.id === "storm_goliath")), false, "Storm's Thunder should spend reaction");
}

function testStonesEnduranceReductionReaction() {
  const defender = reactionActor({
    id: "stone_goliath",
    name: "Stone Goliath",
    feature: {
      id: "species:goliath.stone:stones_endurance",
      name: "Stone's Endurance",
      effects: {
        triggeredEffects: [{
          id: "stones_endurance",
          trigger: "takes_damage",
          reaction: true,
          damageReduction: "1d12 + constitution_modifier",
        }],
      },
    },
    resource: { id: "stones_endurance", name: "Stone's Endurance", max: 1, current: 1, recovery: "long_rest" },
  });
  defender.abilityMods = { con: 2 };
  const attacker = createEnemyCombatActor("goblin", { id: "attacker", hp: 20, maxHp: 20, position: { x: 2, y: 1 } });
  attacker.actions = [meleeAttack("club", 20)];
  const snapshot = createSnapshotFromScenario(testScenario("stones-endurance-test", [defender, attacker]));
  const actor = snapshot.actors.find((item) => item.id === "attacker");

  assert.equal(resolveAction(snapshot, actor, "club", "stone_goliath", fixedDice({ d20: 10, damage: 4 }), createCombatLog()), true);
  assert.equal(snapshot.actors.find((item) => item.id === "stone_goliath").hp, 20, "Stone's Endurance should reduce incoming damage before HP changes");
  assert.equal(hasReaction(snapshot.actors.find((item) => item.id === "stone_goliath")), false, "Stone's Endurance should spend reaction");
}

function reactionActor({ id, name, feature, resource }) {
  return {
    id,
    name,
    team: "heroes",
    role: "fighter",
    token: "G",
    hp: 20,
    maxHp: 20,
    ac: 12,
    speed: 6,
    position: { x: 1, y: 1 },
    saves: {},
    resources: [resource],
    features: [feature],
    actions: [],
  };
}

function meleeAttack(id, attackBonus) {
  return {
    id,
    name: id,
    type: "weapon_attack",
    range: 1,
    attackBonus,
    damage: "1d6",
    damageType: "bludgeoning",
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
