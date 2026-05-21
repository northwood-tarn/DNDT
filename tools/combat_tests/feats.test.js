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

export async function runFeatCombatTests() {
  testSavageAttackerUsesHigherWeaponDamageOncePerTurn();
  testAlertInitiativeAdvantageAndFriendlyBonus();
}
