import { createNickAttackAction, createWeaponAction, indexRecordsById } from "../../app/combat/actionFactory.js";
import { weapons } from "../../app/data/weapons.js";
import { validateCombatAction } from "../../app/combat/actionSchema.js";
import { processOngoingEffects } from "../../app/combat/conditionLifecycle.js";
import { assert, createCombatLog, createEnemyCombatActor, makeHarnessSnapshot, resolveAction } from "./helpers.js";

const WEAPONS = indexRecordsById(weapons);

export async function runWeaponCombatTests() {
  testAllWeaponRecordsBridgeToValidActions();
  testHomebrewWeaponFactoryDamageBonuses();
  testHomebrewWeaponDamageRiderResolution();
  testWeaponMasteryActionMetadata();
  testVexAppliesIncomingAttackAdvantage();
  testVexIsConsumedByNextIncomingAttack();
  testVexExpiresAtSourceTurnEndNotTargetTurnEnd();
  testSapAppliesOutgoingAttackDisadvantage();
  testSapIsConsumedByNextOutgoingAttack();
  testSlowReducesSpeed();
  testPushMovesTargetAway();
  testPushCollisionDealsDamage();
  testToppleForcesConSaveOrProne();
  testGrazeDealsAbilityModifierOnMiss();
  testNickAttackMakesTwoAttacks();
  testCleaveAttacksAdjacentEnemyAfterHit();
  testCleaveTriggersOncePerTurn();
  testEnemyWeaponMasteryRequiresOptIn();
}

function testAllWeaponRecordsBridgeToValidActions() {
  for (const weapon of weapons) {
    const action = createWeaponAction(weapon, { attackBonus: 5 });
    assert.ok(action, `${weapon.id} should produce a combat action`);
    assert.deepEqual(validateCombatAction(action), [], `${weapon.id} combat action should validate`);
    assert.equal(action.weaponMastery, weapon.mastery || undefined, `${weapon.id} should carry mastery metadata from data`);
    if (weapon.damageBonuses?.some((bonus) => bonus.damageType)) {
      assert.ok(Array.isArray(action.damageRiders), `${weapon.id} typed damage modifiers should become riders`);
    }
  }
}

function testHomebrewWeaponFactoryDamageBonuses() {
  const flaming = createWeaponAction(WEAPONS.flaming_longsword, { attackBonus: 5 });
  const accurate = createWeaponAction(WEAPONS.bow_of_accuracy, { attackBonus: 5 });

  assert.equal(flaming.attackBonus, 6, "+1 weapons should add their enhancement bonus to attack rolls");
  assert.equal(flaming.damage, "1d8+1", "+1 weapons should add their enhancement bonus to base damage");
  assert.equal(flaming.damageRiders.length, 1, "typed homebrew damage should become a generic damage rider");
  assert.equal(flaming.damageRiders[0].damage, "1d6", "homebrew weapon rider should carry bonus damage dice");
  assert.equal(flaming.damageRiders[0].damageType, "fire", "homebrew weapon rider should carry bonus damage type");
  assert.deepEqual(validateCombatAction(flaming), [], "homebrew weapon action should validate");

  assert.equal(accurate.attackBonus, 6, "+1 weapons should retain their enhancement bonus alongside existing effects");
  assert.equal(accurate.damage, "1d8+2", "enhancement and existing flat untyped damage should both apply");
  assert.equal(accurate.damageRiders, undefined, "flat untyped homebrew damage should not create a rider");
  assert.deepEqual(validateCombatAction(accurate), [], "flat damage homebrew weapon action should validate");
}

function testHomebrewWeaponDamageRiderResolution() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors.find((actor) => actor.id === "hero");
  const enemy = snapshot.actors.find((actor) => actor.id === "enemy");
  enemy.position = { x: 1, y: 2 };
  hero.actions = [createWeaponAction(WEAPONS.flaming_longsword, { id: "flame", attackBonus: 20 })];

  const dice = {
    rollD20: () => ({ roll: 10, total: 10, usedLucky: false, secondRoll: null }),
    rollDamage: (diceText) => {
      if (diceText === "1d8+1") return { total: 6, rolls: [5], modifier: 1, dice: diceText };
      if (diceText === "1d6") return { total: 3, rolls: [3], modifier: 0, dice: diceText };
      return { total: 0, rolls: [], modifier: 0, dice: diceText };
    },
  };

  resolveAction(snapshot, hero, "flame", enemy.id, dice, createCombatLog());

  assert.equal(enemy.hp, 0, "homebrew weapon rider damage should be applied after the base hit");
}

function testWeaponMasteryActionMetadata() {
  const rapier = createWeaponAction(WEAPONS.rapier, { attackBonus: 5 });
  const dagger = createWeaponAction(WEAPONS.dagger, { attackBonus: 5 });

  assert.equal(rapier.weaponMastery, "vex", "weapon action should expose canonical mastery id");
  assert.equal(rapier.tags.mastery_vex, true, "weapon mastery should be queryable from action tags");
  assert.equal(rapier.effects.length, 1, "automatic weapon mastery should create reusable action effects");
  assert.equal(dagger.weaponMastery, "nick", "future masteries should still be visible in action metadata");
  assert.equal(dagger.weaponMasteryImplementation, "automatic", "Nick should be implemented as a generated compound attack");
  assert.equal(dagger.effects, undefined, "Nick should not create a normal hit effect on the base attack");
}

function testVexAppliesIncomingAttackAdvantage() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors.find((actor) => actor.id === "hero");
  const enemy = snapshot.actors.find((actor) => actor.id === "enemy");
  enemy.position = { x: 1, y: 2 };
  hero.actions = [createWeaponAction(WEAPONS.rapier, { id: "rapier", attackBonus: 20 })];

  resolveAction(snapshot, hero, "rapier", enemy.id, fixedWeaponDice(), createCombatLog());

  const vex = enemy.activeEffects.find((effect) => effect.label === "Rapier Vex");
  assert.equal(vex.stat, "incoming_attack_roll", "Vex should affect incoming attacks against the target");
  assert.equal(vex.mode, "advantage", "Vex should grant advantage");
  assert.equal(vex.sourceActorOnly, true, "Vex advantage should be scoped to the attacking source");
}

function testVexIsConsumedByNextIncomingAttack() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors.find((actor) => actor.id === "hero");
  const enemy = snapshot.actors.find((actor) => actor.id === "enemy");
  enemy.position = { x: 1, y: 2 };
  hero.actions = [
    createWeaponAction(WEAPONS.rapier, { id: "rapier", attackBonus: 20 }),
    createWeaponAction(WEAPONS.warhammer, { id: "hammer", attackBonus: 20, enableWeaponMastery: false }),
  ];

  resolveAction(snapshot, hero, "rapier", enemy.id, fixedWeaponDice(), createCombatLog());
  assert.ok(enemy.activeEffects.some((effect) => effect.label === "Rapier Vex"), "Vex should be present before the next attack");
  hero.economy.actionAvailable = true;
  resolveAction(snapshot, hero, "hammer", enemy.id, fixedWeaponDice(), createCombatLog());

  assert.equal(enemy.activeEffects.some((effect) => effect.label === "Rapier Vex"), false, "Vex should be consumed by the next incoming attack");
}

function testVexExpiresAtSourceTurnEndNotTargetTurnEnd() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors.find((actor) => actor.id === "hero");
  const enemy = snapshot.actors.find((actor) => actor.id === "enemy");
  snapshot.initiative = [hero.id, enemy.id];
  snapshot.turnIndex = 0;
  enemy.position = { x: 1, y: 2 };
  hero.actions = [createWeaponAction(WEAPONS.rapier, { id: "rapier", attackBonus: 20 })];
  const log = createCombatLog();

  resolveAction(snapshot, hero, "rapier", enemy.id, fixedWeaponDice(), log);
  processOngoingEffects(snapshot, enemy, "turn_end", fixedWeaponDice(), log);
  assert.ok(enemy.activeEffects.some((effect) => effect.label === "Rapier Vex"), "Vex should survive the target's turn end");

  processOngoingEffects(snapshot, hero, "turn_end", fixedWeaponDice(), log);
  assert.ok(enemy.activeEffects.some((effect) => effect.label === "Rapier Vex"), "Vex should survive the end of the turn in which it was applied");

  processOngoingEffects(snapshot, hero, "turn_end", fixedWeaponDice(), log);
  assert.equal(enemy.activeEffects.some((effect) => effect.label === "Rapier Vex"), false, "Vex should expire at the source actor's turn end");
}

function testSapAppliesOutgoingAttackDisadvantage() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors.find((actor) => actor.id === "hero");
  const enemy = snapshot.actors.find((actor) => actor.id === "enemy");
  enemy.position = { x: 1, y: 2 };
  hero.actions = [createWeaponAction(WEAPONS.longsword, { id: "longsword", attackBonus: 20 })];

  resolveAction(snapshot, hero, "longsword", enemy.id, fixedWeaponDice(), createCombatLog());

  const sap = enemy.activeEffects.find((effect) => effect.label === "Longsword Sap");
  assert.equal(sap.stat, "attack_roll", "Sap should affect the target's outgoing attacks");
  assert.equal(sap.mode, "disadvantage", "Sap should impose disadvantage");
  assert.equal(sap.consumeOn, "outgoing_attack", "Sap should be consumed by the next outgoing attack");
}

function testSapIsConsumedByNextOutgoingAttack() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors.find((actor) => actor.id === "hero");
  const enemy = snapshot.actors.find((actor) => actor.id === "enemy");
  enemy.position = { x: 1, y: 2 };
  hero.actions = [createWeaponAction(WEAPONS.longsword, { id: "longsword", attackBonus: 20 })];

  resolveAction(snapshot, hero, "longsword", enemy.id, fixedWeaponDice(), createCombatLog());
  assert.ok(enemy.activeEffects.some((effect) => effect.label === "Longsword Sap"), "Sap should be present before the target attacks");
  resolveAction(snapshot, enemy, "blade", hero.id, fixedWeaponDice(), createCombatLog());

  assert.equal(enemy.activeEffects.some((effect) => effect.label === "Longsword Sap"), false, "Sap should be consumed by the target's next outgoing attack");
}

function testSlowReducesSpeed() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors.find((actor) => actor.id === "hero");
  const enemy = snapshot.actors.find((actor) => actor.id === "enemy");
  hero.position = { x: 0, y: 0 };
  enemy.position = { x: 4, y: 0 };
  hero.actions = [createWeaponAction(WEAPONS.longbow, { id: "longbow", attackBonus: 20 })];

  resolveAction(snapshot, hero, "longbow", enemy.id, fixedWeaponDice(), createCombatLog());

  const slow = enemy.activeEffects.find((effect) => effect.label === "Longbow Slow");
  assert.equal(slow.stat, "speed", "Slow should affect speed");
  assert.equal(slow.amount, -2, "Slow should reduce speed by 10 feet");
}

function testPushMovesTargetAway() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors.find((actor) => actor.id === "hero");
  const enemy = snapshot.actors.find((actor) => actor.id === "enemy");
  hero.position = { x: 0, y: 0 };
  enemy.position = { x: 1, y: 0 };
  hero.actions = [createWeaponAction(WEAPONS.warhammer, { id: "warhammer", attackBonus: 20 })];

  resolveAction(snapshot, hero, "warhammer", enemy.id, fixedWeaponDice(), createCombatLog());

  assert.deepEqual(enemy.position, { x: 3, y: 0 }, "Push should move the target 10 feet directly away when space is clear");
}

function testPushCollisionDealsDamage() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors.find((actor) => actor.id === "hero");
  const enemy = snapshot.actors.find((actor) => actor.id === "enemy");
  hero.position = { x: 0, y: 1 };
  enemy.position = { x: 1, y: 1 };
  enemy.hp = 12;
  hero.actions = [createWeaponAction(WEAPONS.warhammer, { id: "warhammer", attackBonus: 20 })];

  resolveAction(snapshot, hero, "warhammer", enemy.id, scriptedWeaponDice({ d20: [10], damage: [2, 3] }), createCombatLog());

  assert.deepEqual(enemy.position, { x: 1, y: 1 }, "Push should stop before blocked terrain");
  assert.equal(enemy.hp, 6, "Push collision should apply homebrew collision damage for the blocked distance");
}

function testToppleForcesConSaveOrProne() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors.find((actor) => actor.id === "hero");
  const enemy = snapshot.actors.find((actor) => actor.id === "enemy");
  enemy.position = { x: 1, y: 2 };
  enemy.saves = { con: 0 };
  hero.proficiencyBonus = 2;
  hero.abilityMods = { str: 3 };
  hero.actions = [createWeaponAction(WEAPONS.battleaxe, { id: "axe", attackBonus: 20 })];
  const dice = scriptedWeaponDice({ d20: [10, 1] });

  resolveAction(snapshot, hero, "axe", enemy.id, dice, createCombatLog());

  assert.ok(enemy.conditions.some((condition) => condition.id === "prone"), "Topple should apply prone when the CON save fails");
}

function testGrazeDealsAbilityModifierOnMiss() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors.find((actor) => actor.id === "hero");
  const enemy = snapshot.actors.find((actor) => actor.id === "enemy");
  enemy.position = { x: 1, y: 2 };
  enemy.hp = 8;
  hero.abilityMods = { str: 3 };
  hero.actions = [createWeaponAction(WEAPONS.greatsword, { id: "greatsword", attackBonus: 0 })];
  const dice = scriptedWeaponDice({ d20: [5] });

  resolveAction(snapshot, hero, "greatsword", enemy.id, dice, createCombatLog());

  assert.equal(enemy.hp, 5, "Graze should deal ability-modifier damage on a miss");
}

function testNickAttackMakesTwoAttacks() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors.find((actor) => actor.id === "hero");
  const enemy = snapshot.actors.find((actor) => actor.id === "enemy");
  enemy.position = { x: 1, y: 2 };
  enemy.hp = 10;
  hero.actions = [
    createNickAttackAction(WEAPONS.dagger, WEAPONS.shortsword, {
      id: "nick",
      attackBonus: 20,
      damageBonus: 0,
    }),
  ];

  resolveAction(snapshot, hero, "nick", enemy.id, scriptedWeaponDice({ d20: [10, 10], damage: 2 }), createCombatLog());

  assert.equal(enemy.hp, 6, "Nick Attack should resolve two separate weapon hits inside one action");
  assert.equal(hero.economy.bonusActionAvailable, true, "Nick Attack should not consume the bonus action");
  assert.equal(hero.economy.actionAvailable, false, "Nick Attack should consume the normal action");
}

function testCleaveAttacksAdjacentEnemyAfterHit() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors.find((actor) => actor.id === "hero");
  const enemy = snapshot.actors.find((actor) => actor.id === "enemy");
  const secondEnemy = {
    ...structuredClone(enemy),
    id: "enemy_2",
    name: "Enemy 2",
    hp: 8,
    maxHp: 8,
    position: { x: 1, y: 3 },
  };
  enemy.position = { x: 1, y: 2 };
  enemy.hp = 8;
  snapshot.actors.push(secondEnemy);
  const greataxe = createWeaponAction({
    id: "greataxe",
    name: "Greataxe",
    description: "A heavy axe.",
    uses: "infinite",
    consumeOnUse: false,
    useTime: "action",
    type: "melee",
    damage: "1d12",
    properties: ["heavy", "two-handed"],
    mastery: "cleave",
  }, { id: "greataxe", attackBonus: 20, damageBonus: 3 });
  hero.actions = [greataxe];

  resolveAction(snapshot, hero, "greataxe", enemy.id, scriptedWeaponDice({ d20: [10, 10], damage: 4 }), createCombatLog());

  assert.equal(greataxe.damage, "1d12+3", "Cleave primary action should include the normal damage bonus");
  assert.equal(enemy.hp, 4, "Cleave primary hit should resolve normally");
  assert.equal(secondEnemy.hp, 4, "Cleave secondary hit should roll weapon dice without ability damage");
}

function testCleaveTriggersOncePerTurn() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors.find((actor) => actor.id === "hero");
  const enemy = snapshot.actors.find((actor) => actor.id === "enemy");
  const secondEnemy = {
    ...structuredClone(enemy),
    id: "enemy_2",
    name: "Enemy 2",
    hp: 20,
    maxHp: 20,
    position: { x: 1, y: 3 },
  };
  enemy.position = { x: 1, y: 2 };
  enemy.hp = 20;
  snapshot.actors.push(secondEnemy);
  const greataxe = createWeaponAction({
    id: "greataxe",
    name: "Greataxe",
    description: "A heavy axe.",
    uses: "infinite",
    consumeOnUse: false,
    useTime: "action",
    type: "melee",
    damage: "1d12",
    properties: ["heavy", "two-handed"],
    mastery: "cleave",
  }, { id: "greataxe", attackBonus: 20 });
  hero.actions = [greataxe];

  resolveAction(snapshot, hero, "greataxe", enemy.id, scriptedWeaponDice({ d20: [10, 10], damage: 4 }), createCombatLog());
  resolveAction(snapshot, hero, "greataxe", enemy.id, scriptedWeaponDice({ d20: [10, 10], damage: 4 }), createCombatLog());

  assert.equal(secondEnemy.hp, 16, "Cleave should only trigger once per turn");
}

function testEnemyWeaponMasteryRequiresOptIn() {
  const plain = createEnemyCombatActor({ id: "plain_guard", name: "Plain Guard", role: "guard", creatureType: "humanoid", hp: 10, maxHp: 10, ac: 12, speed: 6, attackBonus: 5, weaponId: "warhammer", damage: "1d8+3", damageType: "bludgeoning" });
  const mastered = createEnemyCombatActor({ id: "master_guard", name: "Master Guard", role: "guard", creatureType: "humanoid", hp: 10, maxHp: 10, ac: 12, speed: 6, attackBonus: 5, weaponId: "warhammer", damage: "1d8+3", damageType: "bludgeoning", masteredWeaponIds: ["warhammer"] });

  assert.equal(plain.actions[0].weaponMastery, "push");
  assert.equal(plain.actions[0].weaponMasteryActive, undefined, "enemy weapon mastery should be inactive unless opted in");
  assert.equal(plain.actions[0].effects, undefined);
  assert.equal(mastered.actions[0].weaponMasteryActive, true, "enemy masteredWeaponIds should activate mastery");
  assert.equal(mastered.actions[0].effects.some((effect) => effect.type === "forced_movement"), true);
}

function fixedWeaponDice() {
  return scriptedWeaponDice({ d20: [10] });
}

function scriptedWeaponDice({ d20 = [], damage = 1 } = {}) {
  const rolls = [...d20];
  const damageRolls = Array.isArray(damage) ? [...damage] : null;
  return {
    rollD20: () => {
      const roll = rolls.length ? rolls.shift() : 10;
      return { roll, total: roll, usedLucky: false, secondRoll: null };
    },
    rollDamage: (diceText) => {
      const total = damageRolls ? (damageRolls.length ? damageRolls.shift() : 1) : damage;
      return { total, rolls: [total], modifier: 0, dice: diceText };
    },
  };
}
