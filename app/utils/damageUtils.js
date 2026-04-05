// utils/damageUtils.js — text-mode
import { isDueling, isUsingTwoHandedWeapon } from "./combatUtils.js";
import { rollWithDetail } from "./dice.js";

function parseDieString(s) {
  const m = String(s || "1d6").match(/^(\d*)d(\d+)$/i);
  if (!m) return { count: 1, size: 6 };
  const count = parseInt(m[1] || "1", 10);
  const size = parseInt(m[2], 10);
  return { count, size };
}

function rollDie(size) {
  const { total } = rollWithDetail(`1d${size}`);
  return total;
}

/**
 * Roll weapon damage, including class-based modifiers like Dueling or GWF.
 * Assumes actor.equipped.weapon is present with a `damage` field like "1d8".
 */
export function rollWeaponDamage(actor) {
  const weapon = actor?.equipped?.weapon;
  if (!weapon) return 0;

  const { count, size } = parseDieString(weapon.damage || "1d6");
  const rolls = [];

  for (let i = 0; i < count; i++) {
    let roll = rollDie(size);
    // Great Weapon Fighting: reroll 1s and 2s once
    if (
      actor.fightingStyle === "Great Weapon Fighting" &&
      isUsingTwoHandedWeapon(actor) &&
      (roll === 1 || roll === 2)
    ) {
      roll = rollDie(size); // reroll once
    }
    rolls.push(roll);
  }

  let total = rolls.reduce((a, b) => a + b, 0);

  // Dueling: +2 bonus if wielding a one-handed weapon alone
  if (actor.fightingStyle === "Dueling" && isDueling(actor)) {
    total += 2;
  }

  return total;
}
