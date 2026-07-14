import {
  assert,
  createCombatLog,
  getItemQuantity,
  makeHarnessSnapshot,
  moveActor,
  resolveAction,
  scriptedDice,
  startTurn,
} from "./helpers.js";
import { syncContextualActions } from "../../app/combat/actor.js";
import { createConsumableAction, indexRecordsById } from "../../app/combat/actionFactory.js";
import { consumables } from "../../app/data/consumables.js";

const CONSUMABLES = indexRecordsById(consumables);

function testConsumableCombatActionsResolveGenerically() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors[0];
  const enemy = snapshot.actors[1];
  const log = createCombatLog();
  hero.position = { x: 0, y: 0 };
  enemy.position = { x: 2, y: 0 };
  hero.inventory.push(
    { id: "acid_vial", quantity: 1 },
    { id: "alchemists_fire", quantity: 1 },
    { id: "fire_granado", quantity: 1 },
    { id: "caltrops", quantity: 1 },
    { id: "hunting_trap", quantity: 1 },
    { id: "lightning_paper", quantity: 1 },
    { id: "basic_poison", quantity: 1 }
  );
  hero.actions.push(
    createConsumableAction(CONSUMABLES.acid_vial, { attackBonus: 5 }),
    createConsumableAction(CONSUMABLES.alchemists_fire, { attackBonus: 5 }),
    createConsumableAction(CONSUMABLES.fire_granado),
    createConsumableAction(CONSUMABLES.caltrops),
    createConsumableAction(CONSUMABLES.hunting_trap),
    createConsumableAction(CONSUMABLES.lightning_paper),
    createConsumableAction(CONSUMABLES.basic_poison)
  );

  assert.equal(resolveAction(snapshot, hero, "acid_vial", "enemy", scriptedDice({ d20: [12], damage: 1 }), log), true);
  assert.equal(getItemQuantity(hero, "acid_vial"), 0, "thrown consumables should spend stock after resolving");
  assert.ok(log.events.some((event) => event.type === "damage.applied" && event.detail.damageType === "acid"), "acid vial should use the generic attack/damage path");

  hero.economy.actionAvailable = true;
  assert.equal(resolveAction(snapshot, hero, "alchemists_fire", "enemy", scriptedDice({ d20: [12], damage: 1 }), log), true);
  assert.equal(getItemQuantity(hero, "alchemists_fire"), 0, "ongoing thrown consumables should spend stock after resolving");
  assert.ok(enemy.conditions.some((condition) => condition.id === "burning" && condition.ongoingEffects?.length), "Alchemist's Fire should attach a generic ongoing condition effect");
  const hpBeforeOngoing = enemy.hp;
  startTurn(snapshot, enemy, log, scriptedDice({ damage: 1 }));
  assert.ok(enemy.hp < hpBeforeOngoing, "generic ongoing condition effects should tick at their configured timing");
  assert.ok(log.events.some((event) => event.type === "ongoing.effect" && event.detail.condition === "burning"), "ongoing effects should log a generic tick event");
  assert.ok(enemy.actions.some((action) => action.id === "context_end_burning_extinguish_action"), "ongoing effects with action end metadata should create contextual actions");
  assert.equal(resolveAction(snapshot, enemy, "context_end_burning_extinguish_action", null, scriptedDice({ damage: 1 }), log), true);
  assert.equal(enemy.conditions.some((condition) => condition.id === "burning"), false, "contextual end actions should remove their source condition");
  assert.equal(enemy.actions.some((action) => action.id === "context_end_burning_extinguish_action"), false, "contextual end actions should disappear after their source effect is removed");

  hero.economy.actionAvailable = true;
  assert.equal(resolveAction(snapshot, hero, "fire_granado", { anchor: { x: 2, y: 0 } }, scriptedDice({ d20: [1], damage: 1 }), log), true);
  assert.equal(getItemQuantity(hero, "fire_granado"), 0, "area consumables should spend stock after resolving");
  assert.ok(log.events.some((event) => event.type === "area.target" && event.detail.actionId === "fire_granado"), "fire granado should use the generic area target path");

  hero.economy.actionAvailable = true;
  assert.equal(resolveAction(snapshot, hero, "caltrops", { anchor: { x: 1, y: 0 } }, scriptedDice({ d20: [1], damage: 1 }), log), true);
  assert.equal(getItemQuantity(hero, "caltrops"), 0, "deployable consumables should spend stock after placement");
  assert.ok(snapshot.combatObjects.some((object) => object.name === "Caltrops"), "caltrops should create a generic combat object");

  hero.economy.actionAvailable = true;
  assert.equal(resolveAction(snapshot, hero, "hunting_trap", { anchor: { x: 2, y: 0 } }, scriptedDice({ d20: [1], damage: 1 }), log), true);
  assert.equal(getItemQuantity(hero, "hunting_trap"), 1, "reusable traps should not be consumed on placement");
  enemy.position = { x: 1, y: 0 };
  enemy.economy.movementUsed = 0;
  assert.equal(moveActor(snapshot, enemy, { x: 2, y: 0 }, log, { dice: scriptedDice({ d20: [1], damage: 1 }) }), true);
  const trapped = enemy.conditions.find((condition) => condition.id === "grappled");
  assert.ok(trapped?.sourceObjectId, "trap-applied conditions should be sourced from the trap object");
  assert.ok(trapped?.end?.check?.ability === "str", "trap-applied conditions should carry generic escape metadata");
  syncContextualActions(enemy);
  assert.ok(enemy.actions.some((action) => action.id === "context_end_grappled_hunting_trap_escape"), "trap escape should appear as a contextual action");
  enemy.economy.actionAvailable = true;
  assert.equal(resolveAction(snapshot, enemy, "context_end_grappled_hunting_trap_escape", null, scriptedDice({ d20: [1], damage: 1 }), log), true);
  assert.ok(enemy.conditions.some((condition) => condition.id === "grappled"), "failed escape checks should leave the trap condition in place");
  enemy.economy.actionAvailable = true;
  assert.equal(resolveAction(snapshot, enemy, "context_end_grappled_hunting_trap_escape", null, scriptedDice({ d20: [20], damage: 1 }), log), true);
  assert.equal(enemy.conditions.some((condition) => condition.id === "grappled"), false, "successful escape checks should remove the trap condition");

  hero.economy.bonusActionAvailable = true;
  assert.equal(resolveAction(snapshot, hero, "lightning_paper", null, scriptedDice({ damage: 1 }), log), true);
  assert.equal(getItemQuantity(hero, "lightning_paper"), 0, "weapon buff consumables should spend stock after use");
  assert.ok(hero.activeEffects.some((effect) => effect.damageRider?.damageType === "lightning"), "weapon buff consumables should attach a generic damage rider");
  hero.activeEffects = [];

  hero.economy.actionAvailable = true;
  assert.equal(resolveAction(snapshot, hero, "basic_poison", null, scriptedDice({ damage: 1 }), log), true);
  assert.equal(getItemQuantity(hero, "basic_poison"), 0, "weapon coating consumables should spend stock when applied");
  assert.ok(hero.activeEffects.some((effect) => effect.damageRider?.damageType === "poison" && effect.remainingHits === 1), "weapon coatings should attach a limited generic damage rider");
  enemy.hp = 8;
  enemy.position = { x: 1, y: 2 };
  enemy.saves = { ...enemy.saves, con: 0 };
  hero.economy.actionAvailable = true;
  assert.equal(resolveAction(snapshot, hero, "bow", "enemy", scriptedDice({ d20: [10, 1], damage: [2, 3] }), log), true);
  assert.equal(enemy.hp, 3, "failed save against coated weapon should apply base weapon damage plus poison damage");
  assert.equal(hero.activeEffects.some((effect) => effect.damageRider?.damageType === "poison"), false, "one-hit weapon coatings should expire after triggering");
  assert.ok(log.events.some((event) => event.type === "effect.charge_spent" && event.detail.label === "Basic Poison"), "limited weapon riders should log spent charges");
}

function testPoisonerBypassesPoisonResistance() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors[0];
  const enemy = snapshot.actors[1];
  const log = createCombatLog();
  hero.position = { x: 0, y: 0 };
  enemy.position = { x: 2, y: 0 };
  enemy.hp = 8;
  enemy.resistance = ["poison"];
  enemy.saves = { ...enemy.saves, con: 0 };
  hero.featureHooks = [{
    id: "poisoner_ignore_poison_resistance",
    timing: "damage_resolution",
    damageTypes: ["poison"],
    ignoreResistance: true,
  }];
  hero.inventory.push({ id: "basic_poison", quantity: 1 });
  hero.actions.push(createConsumableAction(CONSUMABLES.basic_poison));

  assert.equal(resolveAction(snapshot, hero, "basic_poison", null, scriptedDice({ damage: 1 }), log), true);
  hero.economy.actionAvailable = true;
  assert.equal(resolveAction(snapshot, hero, "bow", "enemy", scriptedDice({ d20: [10, 1], damage: [2, 3] }), log), true);
  const poisonEvent = log.events.find((event) => event.type === "damage.applied" && event.detail.damageType === "poison");
  assert.equal(poisonEvent.detail.amount, 3, "Poisoner should bypass poison resistance without bypassing the save");
  assert.deepEqual(poisonEvent.detail.damageModifiers.ignoredResistance, ["actor"]);
}

export async function runConsumableCombatTests() {
  testConsumableCombatActionsResolveGenerically();
  testPoisonerBypassesPoisonResistance();
}
