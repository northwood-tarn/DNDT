import {
  assert,
  createCombatLog,
  makeHarnessSnapshot,
  resolveAction,
  scriptedDice,
} from "./helpers.js";
import { rollInitiativeOrder } from "../../app/combat/initiative.js";

function testSavageAttackerUsesHigherWeaponDamageOncePerTurn() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors[0];
  const enemy = snapshot.actors[1];
  const log = createCombatLog();
  hero.position = { x: 0, y: 0 };
  enemy.position = { x: 1, y: 0 };
  hero.featureHooks = [{
    id: "savage_attacker_weapon_damage",
    timing: "weapon_damage_roll",
    trigger: { actionTags: ["weapon"], frequency: "once_per_turn" },
    roll: { repetitions: 2, keep: "highest" },
  }];

  assert.equal(resolveAction(snapshot, hero, "bow", "enemy", scriptedDice({ d20: [10], damage: [1, 6] }), log), true);
  const firstDamage = log.events.find((event) => event.type === "damage.roll" && event.detail.sourceId === "hero");
  assert.equal(firstDamage.detail.total, 6, "Savage Attacker should keep the higher damage result");
  assert.equal(firstDamage.detail.savageAttacker.kept, "second", "Savage Attacker should log which roll was kept");

  hero.economy.actionAvailable = true;
  assert.equal(resolveAction(snapshot, hero, "bow", "enemy", scriptedDice({ d20: [10], damage: [1, 6] }), log), true);
  const damageRolls = log.events.filter((event) => event.type === "damage.roll" && event.detail.sourceId === "hero");
  assert.equal(damageRolls[1].detail.savageAttacker, null, "Savage Attacker should not apply twice in one turn");
}

function testAlertInitiativeAdvantageAndFriendlyBonus() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors[0];
  const enemy = snapshot.actors[1];
  const ally = structuredClone(hero);
  ally.id = "ally";
  ally.name = "Ally";
  ally.featureHooks = [];
  snapshot.actors.push(ally);
  hero.featureHooks = [
    { id: "alert_initiative_advantage", timing: "initiative_roll", roll: { mode: "advantage" } },
    { id: "alert_friendly_initiative_bonus", timing: "initiative_roll", target: "friendly_combatants", bonus: 1 },
  ];
  enemy.featureHooks = [];

  const rolls = [4, 17, 10, 10];
  const dice = {
    rollD20: () => {
      const roll = rolls.shift();
      return { roll, total: roll, usedLucky: false, secondRoll: null };
    },
  };
  const results = rollInitiativeOrder(snapshot, dice);
  const heroRoll = results.find((item) => item.actorId === "hero");
  const allyRoll = results.find((item) => item.actorId === "ally");

  assert.deepEqual(heroRoll.rolls, [4, 17], "Alert actor should roll initiative with advantage");
  assert.equal(heroRoll.roll, 17, "Alert actor should use the higher initiative roll");
  assert.equal(allyRoll.alertAllyBonus, 1, "Alert should add +1 to friendly combatants");
}

function testPiercerDamageHooks() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors[0];
  const enemy = snapshot.actors[1];
  const log = createCombatLog();
  hero.position = { x: 0, y: 0 };
  enemy.position = { x: 1, y: 0 };
  hero.featureHooks = [{
    id: "piercer_damage_reroll",
    timing: "weapon_damage_roll",
    trigger: { damageTypes: ["piercing"], frequency: "once_per_turn" },
    roll: { rerollLowestDie: true, keep: "highest_total" },
  }, {
    id: "piercer_critical_die",
    timing: "weapon_damage_roll",
    trigger: { damageTypes: ["piercing"], criticalOnly: true },
    extraCriticalDice: 1,
  }];

  assert.equal(resolveAction(snapshot, hero, "bow", "enemy", scriptedDice({ d20: [10], damage: [1, 5] }), log), true);
  let damageRoll = log.events.find((event) => event.type === "damage.roll" && event.detail.sourceId === "hero");
  assert.equal(damageRoll.detail.total, 5, "Piercer should reroll the lowest piercing damage die and keep the higher result");
  assert.equal(damageRoll.detail.featureDamageHooks.some((hook) => hook.id === "piercer_damage_reroll"), true);

  enemy.hp = enemy.maxHp;
  hero.economy.actionAvailable = true;
  hero.turnFlags = {};
  assert.equal(resolveAction(snapshot, hero, "bow", "enemy", scriptedDice({ d20: [20], damage: [2, 3, 4, 4] }), log), true);
  damageRoll = log.events.filter((event) => event.type === "damage.roll" && event.detail.sourceId === "hero").at(-1);
  assert.equal(damageRoll.detail.total, 11, "Piercer should add one extra weapon die on piercing critical hits");
  assert.equal(damageRoll.detail.featureDamageHooks.some((hook) => hook.id === "piercer_critical_die"), true);
}

function testHeavyArmorMasterDamageReduction() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors[0];
  const enemy = snapshot.actors[1];
  const log = createCombatLog();
  hero.position = { x: 1, y: 0 };
  enemy.position = { x: 0, y: 0 };
  hero.proficiencyBonus = 2;
  hero.equipment = { armorType: "heavy" };
  hero.featureHooks = [{
    id: "heavy_armor_master_reduction",
    timing: "damage_reduction",
    amount: "proficiency_bonus",
    damageTypes: ["bludgeoning", "piercing", "slashing"],
    condition: { equippedArmorType: "heavy" },
  }];

  assert.equal(resolveAction(snapshot, enemy, "blade", "hero", scriptedDice({ d20: [12], damage: [6] }), log), true);
  const damageRoll = log.events.find((event) => event.type === "damage.roll" && event.detail.targetId === "hero");
  assert.equal(damageRoll.detail.appliedAmount, 4, "Heavy Armor Master should reduce eligible damage by proficiency bonus while heavy armor is equipped");
  assert.equal(damageRoll.detail.damageModifiers.reduced.includes("heavy_armor_master_reduction +2"), true);
}

function testGreatWeaponMasterDamageBonus() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors[0];
  const enemy = snapshot.actors[1];
  const log = createCombatLog();
  hero.position = { x: 0, y: 0 };
  enemy.position = { x: 1, y: 0 };
  hero.proficiencyBonus = 3;
  hero.actions.find((action) => action.id === "bow").tags = { weapon: true, melee: true, heavy: true };
  hero.actions.find((action) => action.id === "bow").damageType = "slashing";
  hero.featureHooks = [{
    id: "great_weapon_master_heavy_damage",
    timing: "weapon_damage_roll",
    amount: "proficiency_bonus",
    amountMultiplierWhen: { turnFlag: "droppedEnemyOnPreviousTurn", multiplier: 2 },
    tags: ["weapon", "melee", "heavy"],
    trigger: { frequency: "first_attack_per_turn" },
  }];

  assert.equal(resolveAction(snapshot, hero, "bow", "enemy", scriptedDice({ d20: [10], damage: [4] }), log), true);
  const damageRoll = log.events.find((event) => event.type === "damage.roll" && event.detail.sourceId === "hero");
  assert.equal(damageRoll.detail.total, 7, "Great Weapon Master should add proficiency bonus to eligible heavy melee weapon damage");
  assert.equal(damageRoll.detail.featureDamageHooks.some((hook) => hook.id === "great_weapon_master_heavy_damage"), true);
}

function testGreatWeaponMasterFirstAttackMissConsumesBonus() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors[0];
  const enemy = snapshot.actors[1];
  const log = createCombatLog();
  hero.position = { x: 0, y: 0 };
  enemy.position = { x: 1, y: 0 };
  hero.proficiencyBonus = 3;
  const action = hero.actions.find((item) => item.id === "bow");
  action.tags = { weapon: true, melee: true, heavy: true };
  action.damageType = "slashing";
  hero.featureHooks = [{
    id: "great_weapon_master_heavy_damage",
    timing: "weapon_damage_roll",
    amount: "proficiency_bonus",
    tags: ["weapon", "melee", "heavy"],
    trigger: { frequency: "first_attack_per_turn" },
  }];

  assert.equal(resolveAction(snapshot, hero, "bow", "enemy", scriptedDice({ d20: [1], damage: [4] }), log), true);
  hero.economy.actionAvailable = true;
  assert.equal(resolveAction(snapshot, hero, "bow", "enemy", scriptedDice({ d20: [10], damage: [4] }), log), true);
  const damageRoll = log.events.find((event) => event.type === "damage.roll" && event.detail.sourceId === "hero");
  assert.equal(damageRoll.detail.total, 4, "Great Weapon Master should be spent by a missed first attack");
  assert.equal(damageRoll.detail.featureDamageHooks.length, 0);
}

function testGreatWeaponMasterDoublesAfterPreviousTurnDrop() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors[0];
  const enemy = snapshot.actors[1];
  const log = createCombatLog();
  hero.position = { x: 0, y: 0 };
  enemy.position = { x: 1, y: 0 };
  hero.proficiencyBonus = 3;
  hero.turnFlags.droppedEnemyOnPreviousTurn = true;
  const action = hero.actions.find((item) => item.id === "bow");
  action.tags = { weapon: true, melee: true, heavy: true };
  action.damageType = "slashing";
  hero.featureHooks = [{
    id: "great_weapon_master_heavy_damage",
    timing: "weapon_damage_roll",
    amount: "proficiency_bonus",
    amountMultiplierWhen: { turnFlag: "droppedEnemyOnPreviousTurn", multiplier: 2 },
    tags: ["weapon", "melee", "heavy"],
    trigger: { frequency: "first_attack_per_turn" },
  }];

  assert.equal(resolveAction(snapshot, hero, "bow", "enemy", scriptedDice({ d20: [10], damage: [4] }), log), true);
  const damageRoll = log.events.find((event) => event.type === "damage.roll" && event.detail.sourceId === "hero");
  assert.equal(damageRoll.detail.total, 10, "Great Weapon Master should add double proficiency after dropping an enemy on the previous turn");
}

function testDuelingDoesNotApplyToHeavyTwoHandedWeapons() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors[0];
  const enemy = snapshot.actors[1];
  const log = createCombatLog();
  hero.position = { x: 0, y: 0 };
  enemy.position = { x: 1, y: 0 };
  const attack = hero.actions.find((action) => action.id === "bow");
  attack.tags = { weapon: true, melee: true, heavy: true, two_handed: true };
  hero.featureHooks = [{
    id: "dueling_damage",
    timing: "weapon_damage_roll",
    amount: 2,
    tags: ["weapon", "melee"],
    condition: "one_handed_weapon_only",
  }];

  assert.equal(resolveAction(snapshot, hero, "bow", "enemy", scriptedDice({ d20: [10], damage: [4] }), log), true);
  const damageRoll = log.events.find((event) => event.type === "damage.roll" && event.detail.sourceId === "hero");
  assert.equal(damageRoll.detail.total, 4, "Dueling must not apply to heavy two-handed weapons");
}

export async function runFeatCombatTests() {
  testSavageAttackerUsesHigherWeaponDamageOncePerTurn();
  testAlertInitiativeAdvantageAndFriendlyBonus();
  testPiercerDamageHooks();
  testHeavyArmorMasterDamageReduction();
  testGreatWeaponMasterDamageBonus();
  testGreatWeaponMasterFirstAttackMissConsumesBonus();
  testGreatWeaponMasterDoublesAfterPreviousTurnDrop();
  testDuelingDoesNotApplyToHeavyTwoHandedWeapons();
}
