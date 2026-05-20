import { createWeaponAction, indexRecordsById } from "../../app/combat/actionFactory.js";
import { weapons } from "../../app/data/weapons.js";
import { validateCombatAction } from "../../app/combat/actionSchema.js";
import { assert, createCombatLog, makeHarnessSnapshot, resolveAction } from "./helpers.js";

const WEAPONS = indexRecordsById(weapons);

export async function runWeaponCombatTests() {
  testHomebrewWeaponFactoryDamageBonuses();
  testHomebrewWeaponDamageRiderResolution();
}

function testHomebrewWeaponFactoryDamageBonuses() {
  const flaming = createWeaponAction(WEAPONS.flaming_longsword, { attackBonus: 5 });
  const accurate = createWeaponAction(WEAPONS.bow_of_accuracy, { attackBonus: 5 });

  assert.equal(flaming.damage, "1d8", "typed homebrew damage should not be folded into base weapon damage");
  assert.equal(flaming.damageRiders.length, 1, "typed homebrew damage should become a generic damage rider");
  assert.equal(flaming.damageRiders[0].damage, "1d6", "homebrew weapon rider should carry bonus damage dice");
  assert.equal(flaming.damageRiders[0].damageType, "fire", "homebrew weapon rider should carry bonus damage type");
  assert.deepEqual(validateCombatAction(flaming), [], "homebrew weapon action should validate");

  assert.equal(accurate.damage, "1d8+1", "flat untyped homebrew damage should fold into base weapon damage");
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
      if (diceText === "1d8") return { total: 5, rolls: [5], modifier: 0, dice: diceText };
      if (diceText === "1d6") return { total: 3, rolls: [3], modifier: 0, dice: diceText };
      return { total: 0, rolls: [], modifier: 0, dice: diceText };
    },
  };

  resolveAction(snapshot, hero, "flame", enemy.id, dice, createCombatLog());

  assert.equal(enemy.hp, 0, "homebrew weapon rider damage should be applied after the base hit");
}
