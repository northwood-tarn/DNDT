import {
  assert,
  createCombatLog,
  createSnapshotFromScenario,
  endTurnEffects,
  getMovementRemaining,
  makeHarnessSnapshot,
  moveActor,
  resolveAction,
  scriptedDice,
} from "./helpers.js";
import { combatObjectCells } from "../../app/combat/combatObjects.js";
import { createCombatGame, getCombatScenarioOptions } from "../../app/combat/api.js";
import { getEffectiveAc } from "../../app/combat/modifiers.js";
import { getActionTags } from "../../app/combat/actionTags.js";
import { resolveActionResult } from "../../app/combat/actionResult.js";
import { validateCombatAction } from "../../app/combat/actionSchema.js";
import { createConsumableAction, createSpellAction, createWeaponAction, indexRecordsById } from "../../app/combat/actionFactory.js";
import { canSeeActor } from "../../app/combat/perception.js";
import { consumables } from "../../app/data/consumables.js";
import { SPELLS } from "../../app/data/spells.js";
import { weapons } from "../../app/data/weapons.js";

const CONSUMABLES = indexRecordsById(consumables);
const WEAPONS = indexRecordsById(weapons);

function testActionTagInference() {
  assert.deepEqual(
    pickTags(getActionTags({ type: "weapon_attack", range: 1, damage: "1d8", attackBonus: 5 })),
    { attackRoll: true, harmful: true, melee: true, ranged: false, savingThrow: false, spell: false, weapon: true },
    "melee weapon tags should be inferred"
  );
  assert.deepEqual(
    pickTags(getActionTags({ type: "spell_save", saveAbility: "wis", damage: "1d8" })),
    { attackRoll: false, harmful: true, melee: false, ranged: false, savingThrow: true, spell: true, weapon: false },
    "save spell tags should be inferred"
  );
}

function testPerceptionGate() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors[0];
  const enemy = snapshot.actors[1];
  hero.position = { x: 0, y: 0 };
  enemy.position = { x: 1, y: 0 };

  enemy.conditions = [{ id: "invisible", label: "Invisible" }];
  assert.equal(canSeeActor(snapshot, hero, enemy).ok, false, "invisible target should not be seen without a matching sense");
  hero.senses = ["see_invisible"];
  assert.equal(canSeeActor(snapshot, hero, enemy).ok, true, "see_invisible sense should satisfy the perception gate");
}

function testMovementCostGate() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors[0];
  const log = createCombatLog();
  hero.position = { x: 0, y: 0 };
  hero.conditions = [{ id: "prone", label: "Prone" }];

  assert.equal(moveActor(snapshot, hero, { x: 1, y: 0 }, log), true, "prone actor should stand then move");
  assert.equal(getMovementRemaining(hero), 2, "standing spends half movement, then the movement layer charges the normal step cost after prone is removed");
}

function testRequiresSightActionGate() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors[0];
  const enemy = snapshot.actors[1];
  const log = createCombatLog();
  hero.position = { x: 0, y: 0 };
  enemy.position = { x: 1, y: 0 };
  hero.position = { x: 0, y: 0 };
  enemy.position = { x: 1, y: 0 };
  enemy.conditions = [{ id: "invisible", label: "Invisible" }];
  hero.actions.push({
    id: "sight_spell",
    name: "Sight Spell",
    type: "spell_save",
    range: 8,
    requiresSight: true,
    saveAbility: "wis",
    spellSaveDC: 13,
    damage: "1d6",
    damageType: "force",
  });

  assert.equal(resolveAction(snapshot, hero, "sight_spell", "enemy", scriptedDice({ d20: [1], damage: 1 }), log), false);
  assert.ok(log.events.some((event) => event.type === "target.invalid" && event.detail.reason === "Enemy cannot be seen"), "requiresSight actions should use the perception gate");
}

function testStructuredActionFailureResult() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors[0];
  const enemy = snapshot.actors[1];
  const log = createCombatLog();
  snapshot.grid.width = 14;
  hero.position = { x: 0, y: 0 };
  enemy.position = { x: 11, y: 0 };

  const result = resolveActionResult(snapshot, hero, "bow", "enemy", scriptedDice({ d20: [12], damage: 1 }), log);
  assert.equal(result.ok, false, "structured action result should report failure");
  assert.equal(result.code, "target_invalid", "structured action result should carry a stable failure code");
  assert.equal(result.reason, "out of range (11/10)", "structured action result should carry the target legality reason");
}

function testPublicCombatApiBoundary() {
  const game = createCombatGame();
  const actor = game.query.currentActor();
  assert.ok(actor, "public API should expose the current actor query");
  assert.deepEqual(getCombatScenarioOptions().map((scenario) => scenario.id), ["generated-character-arena"], "public API should expose the canonical scenario option");
  assert.ok(Array.isArray(game.query.reachableCells(actor.id)), "public API should expose reachable-cell queries");
  assert.equal(game.resolveAction(actor.id, "missing_action", null).ok, false, "public API resolveAction should return structured results");
  assert.equal(typeof game.action(actor.id, "missing_action", null), "boolean", "legacy boolean action command should remain available");
}

function testActionFactoryWeaponOutput() {
  const action = createWeaponAction(WEAPONS.longsword, {
    id: "sword",
    name: "Sword",
    attackBonus: 5,
    damageBonus: 3,
  });

  assert.equal(action.type, "weapon_attack", "weapon factory should produce a weapon attack");
  assert.equal(action.damage, "1d8+3", "weapon factory should apply actor damage bonus");
  assert.equal(action.damageType, "slashing", "weapon factory should infer longsword damage type");
  assert.deepEqual(validateCombatAction(action), [], "weapon factory output should validate as a combat action");
}

function testActionFactorySpellOutput() {
  const action = createSpellAction(SPELLS.fire_bolt, { attackBonus: 5 });

  assert.equal(action.type, "spell_attack", "spell factory should map Fire Bolt to spell attack");
  assert.equal(action.range, 24, "spell factory should convert 120 ft to 24 grid squares");
  assert.equal(action.damage, "1d10", "spell factory should carry spell damage dice");
  assert.equal(action.damageType, "fire", "spell factory should carry spell damage type");
  assert.equal(action.requiresSight, true, "spell factory should carry target sight requirement");
  assert.deepEqual(validateCombatAction(action), [], "spell factory output should validate as a combat action");
}

function testActionFactorySpellEffects() {
  const mockery = createSpellAction(SPELLS.vicious_mockery, { spellSaveDC: 13 });
  const hold = createSpellAction(SPELLS.hold_person, { spellSaveDC: 13 });
  const fireball = createSpellAction(SPELLS.fireball, { spellSaveDC: 15 });
  const fogCloud = createSpellAction(SPELLS.fog_cloud, { spellSaveDC: 13 });
  const darkness = createSpellAction(SPELLS.darkness, { spellSaveDC: 13 });
  const spikeGrowth = createSpellAction(SPELLS.spike_growth, { spellSaveDC: 13 });
  const bless = createSpellAction(SPELLS.bless, { spellSaveDC: 13 });
  const bane = createSpellAction(SPELLS.bane, { spellSaveDC: 13 });
  const bladeWard = createSpellAction(SPELLS.blade_ward, { spellSaveDC: 13 });
  const shieldOfFaith = createSpellAction(SPELLS.shield_of_faith, { spellSaveDC: 13 });
  const resistance = createSpellAction(SPELLS.resistance, { spellSaveDC: 13 });
  const mageArmor = createSpellAction(SPELLS.mage_armor, { spellSaveDC: 13 });
  const guidance = createSpellAction(SPELLS.guidance, { spellSaveDC: 13 });

  assert.equal(mockery.effects[0].condition, "next_attack_disadvantage", "Vicious Mockery should translate its debuff effect");
  assert.deepEqual(validateCombatAction(mockery), [], "Vicious Mockery action should validate");
  assert.equal(hold.damage, undefined, "Hold Person should not invent fake damage");
  assert.equal(hold.effects[0].condition, "paralyzed", "Hold Person should translate to Paralyzed");
  assert.equal(hold.effects[0].repeatSave.ability, "wis", "Hold Person should preserve repeat save ability");
  assert.deepEqual(validateCombatAction(hold), [], "effect-only save spells should validate");
  assert.equal(fireball.type, "spell_area_save", "Fireball should become an area save spell");
  assert.equal(fireball.targeting.shape, "radius", "Fireball sphere should use radius targeting");
  assert.deepEqual(validateCombatAction(fireball), [], "area save spell should validate");
  assert.equal(fogCloud.type, "spell_object", "Fog Cloud should create a combat object");
  assert.equal(fogCloud.object.blocksLineOfSight, true, "Fog Cloud should block line of sight");
  assert.equal(darkness.type, "spell_object", "Darkness should create a combat object");
  assert.equal(spikeGrowth.type, "spell_object", "Spike Growth should create a combat object");
  assert.equal(spikeGrowth.object.difficultTerrain, true, "Spike Growth should be difficult terrain");
  assert.deepEqual(validateCombatAction(fogCloud), [], "Fog Cloud action should validate");
  assert.deepEqual(validateCombatAction(darkness), [], "Darkness action should validate");
  assert.deepEqual(validateCombatAction(spikeGrowth), [], "Spike Growth action should validate");
  assert.equal(bless.type, "spell_effect", "Bless should become a generic effect spell");
  assert.deepEqual(bless.effects.map((effect) => effect.stat), ["attack_roll", "save"], "Bless should produce attack and save modifiers");
  assert.equal(bane.type, "spell_save", "Bane should become a save-gated effect spell");
  assert.deepEqual(bane.effects.map((effect) => effect.stat), ["attack_roll", "save"], "Bane should produce attack and save penalties");
  assert.equal(bane.effects[0].multiplier, -1, "Bane attack penalty should subtract its die");
  assert.equal(bladeWard.effects[0].stat, "incoming_attack_roll", "Blade Ward should produce incoming attack roll penalty");
  assert.equal(shieldOfFaith.effects[0].stat, "ac", "Shield of Faith should produce AC modifier");
  assert.equal(resistance.effects[0].stat, "damage_reduction", "Resistance should produce damage reduction modifier");
  assert.equal(mageArmor.effects[0].stat, "ac_formula", "Mage Armor should produce AC formula modifier");
  assert.equal(guidance.effects[0].stat, "ability_check", "Guidance should produce ability check modifier");
  for (const action of [bless, bladeWard, shieldOfFaith, resistance, mageArmor, guidance]) {
    assert.deepEqual(validateCombatAction(action), [], `${action.name} effect action should validate`);
  }
}

function testActionFactoryConsumableOutput() {
  const action = createConsumableAction(CONSUMABLES.healing_potion, {
    id: "healing_potion",
    name: "Healing Potion",
  });
  const greaterPotion = createConsumableAction(CONSUMABLES.greater_healing_potion);

  assert.equal(action.type, "consumable", "consumable factory should produce a consumable action");
  assert.equal(action.itemId, "healing_potion", "consumable action should keep source item id");
  assert.equal(action.healing, "2d4+2", "consumable factory should parse healing dice from item data");
  assert.deepEqual(validateCombatAction(action), [], "consumable factory output should validate as a combat action");
  assert.equal(greaterPotion.healing, "4d4+4", "consumable factory should prefer structured healing data");
  assert.deepEqual(validateCombatAction(greaterPotion), [], "structured healing consumables should validate as combat actions");
}

function testActorModifiersAffectCoreRolls() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors[0];
  const enemy = snapshot.actors[1];
  const log = createCombatLog();
  hero.position = { x: 0, y: 0 };
  enemy.position = { x: 1, y: 0 };

  enemy.activeEffects.push({ id: "shielded", type: "modifier", stat: "ac", amount: 2, label: "Shielded" });
  assert.equal(getEffectiveAc(snapshot, enemy), 14, "AC modifiers should be collected from active effects");

  hero.activeEffects.push({ id: "blessed_attack", type: "modifier", stat: "attack_roll", amount: 2, label: "Blessed Attack" });
  assert.equal(resolveAction(snapshot, hero, "bow", "enemy", scriptedDice({ d20: [7], damage: 1 }), log), true);
  assert.ok(
    log.events.some((event) =>
      event.type === "attack.roll" &&
      event.detail.bonus === 7 &&
      event.detail.effectiveAc === 14
    ),
    "attack resolution should include attack and AC modifiers"
  );
}

function testSaveAndDamageReductionModifiers() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors[0];
  const enemy = snapshot.actors[1];
  const log = createCombatLog();
  hero.position = { x: 0, y: 0 };
  enemy.position = { x: 1, y: 0 };
  enemy.activeEffects.push({ id: "wise", type: "modifier", stat: "save", ability: "wis", amount: 3, label: "Wise" });
  enemy.activeEffects.push({ id: "warded", type: "modifier", stat: "damage_reduction", damageType: "psychic", amount: 2, label: "Warded" });

  assert.equal(resolveAction(snapshot, hero, "spark", "enemy", scriptedDice({ d20: [9], damage: 8 }), log), true);
  assert.ok(
    log.events.some((event) => event.type === "save.roll" && event.detail.bonus === 3 && event.detail.total === 12),
    "save resolution should include active save modifiers"
  );
  assert.ok(
    log.events.some((event) => event.type === "damage.applied" && event.detail.amount === 6),
    "damage reduction modifiers should reduce matching damage"
  );
}

function testPersistentCombatObjectTriggers() {
  const snapshot = createSnapshotFromScenario({
    id: "persistent-object-test",
    grid: { width: 4, height: 2, blocked: [], cover: [] },
    combatObjects: [
      {
        id: "embers",
        name: "Embers",
        position: { x: 1, y: 0 },
        shape: "radius",
        radiusSquares: 0,
        effects: [
          { type: "damage", trigger: "enter_area", damage: "1d4", damageType: "fire" },
          { type: "damage", trigger: "turn_end", damage: "1d4", damageType: "fire" },
        ],
      },
    ],
    actors: [
      {
        id: "hero",
        name: "Hero",
        team: "heroes",
        role: "fighter",
        token: "H",
        hp: 20,
        maxHp: 20,
        ac: 15,
        initiativeBonus: 0,
        speed: 6,
        position: { x: 0, y: 0 },
        saves: {},
        actions: [],
      },
      {
        id: "enemy",
        name: "Enemy",
        team: "enemies",
        role: "swordsman",
        token: "E",
        hp: 8,
        maxHp: 8,
        ac: 12,
        initiativeBonus: 0,
        speed: 6,
        position: { x: 3, y: 0 },
        saves: {},
        actions: [],
      },
    ],
  });
  const hero = snapshot.actors[0];
  const log = createCombatLog();

  assert.equal(moveActor(snapshot, hero, { x: 1, y: 0 }, log, { dice: scriptedDice({ damage: 3 }) }), true);
  assert.ok(log.events.some((event) => event.type === "trigger.fired" && event.detail.trigger === "enter_area"), "entering a combat object should fire enter_area triggers");
  assert.equal(hero.hp, 17, "enter_area hazard should apply damage");
}

function testSpellCreatedZonesBlockSightAndAffectMovement() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors[0];
  const enemy = snapshot.actors[1];
  const log = createCombatLog();
  hero.position = { x: 0, y: 0 };
  enemy.position = { x: 3, y: 0 };
  hero.actions.push(
    createSpellAction(SPELLS.fog_cloud, { spellSaveDC: 13 }),
    createSpellAction(SPELLS.spike_growth, { spellSaveDC: 13 })
  );

  assert.equal(resolveAction(snapshot, hero, "fog_cloud", { anchor: { x: 1, y: 0 } }, scriptedDice({ damage: 1 }), log), true);
  assert.equal(snapshot.combatObjects.length, 1, "Fog Cloud should create a persistent object");
  assert.ok(combatObjectCells(snapshot, snapshot.combatObjects[0]).some((cell) => cell.x === 1 && cell.y === 0), "zone footprint should include anchor");
  hero.economy.actionAvailable = true;
  assert.equal(resolveAction(snapshot, hero, "bow", "enemy", scriptedDice({ d20: [20], damage: 1 }), log), false, "Fog Cloud object should block line of sight");

  snapshot.combatObjects = [];
  hero.economy.actionAvailable = true;
  hero.position = { x: 0, y: 0 };
  assert.equal(resolveAction(snapshot, hero, "spike_growth", { anchor: { x: 1, y: 0 } }, scriptedDice({ damage: 1 }), log), true);
  hero.economy.actionAvailable = true;
  const hpBefore = hero.hp;
  assert.equal(moveActor(snapshot, hero, { x: 1, y: 0 }, log, { dice: scriptedDice({ damage: 4 }) }), true);
  assert.equal(getMovementRemaining(hero), 4, "zone difficult terrain should add one square of movement cost");
  assert.equal(hero.hp, hpBefore - 4, "zone enter trigger should apply hazard damage");
}

function testTriggeredZoneSaveCanNegateDamage() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors[0];
  const log = createCombatLog();
  hero.position = { x: 0, y: 0 };
  hero.saves.dex = 0;
  hero.actions.push(createSpellAction(SPELLS.hunger_of_hadar, { spellSaveDC: 13 }));

  assert.equal(resolveAction(snapshot, hero, "hunger_of_hadar", { anchor: { x: 0, y: 0 } }, scriptedDice({ damage: 1 }), log), true);
  const hpBefore = hero.hp;
  endTurnEffects(snapshot, hero, scriptedDice({ d20: [18], damage: 6 }), log);
  assert.equal(hero.hp, hpBefore, "successful triggered zone save should negate damage");
  assert.ok(log.events.some((event) => event.type === "save.result" && event.detail.success === true), "triggered zone save should be logged");

  endTurnEffects(snapshot, hero, scriptedDice({ d20: [1], damage: 6 }), log);
  assert.equal(hero.hp, hpBefore - 6, "failed triggered zone save should apply damage");
}

function testRollModifierSpellsResolveThroughGenericEffects() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors[0];
  const enemy = snapshot.actors[1];
  const log = createCombatLog();
  hero.position = { x: 0, y: 0 };
  enemy.position = { x: 1, y: 0 };
  hero.abilityMods = { dex: 3 };
  hero.ac = 10;
  hero.actions.push(
    createSpellAction(SPELLS.bless, { spellSaveDC: 13 }),
    createSpellAction(SPELLS.shield_of_faith, { spellSaveDC: 13 }),
    createSpellAction(SPELLS.blade_ward, { spellSaveDC: 13 }),
    createSpellAction(SPELLS.resistance, { spellSaveDC: 13 }),
    createSpellAction(SPELLS.mage_armor, { spellSaveDC: 13 })
  );

  assert.equal(resolveAction(snapshot, hero, "shield_of_faith", "hero", scriptedDice({ damage: 1 }), log), true);
  assert.equal(getEffectiveAc(snapshot, hero), 12, "Shield of Faith should raise AC through the modifier layer");
  hero.economy.bonusActionAvailable = true;
  hero.economy.actionAvailable = true;

  assert.equal(resolveAction(snapshot, hero, "mage_armor", "hero", scriptedDice({ damage: 1 }), log), true);
  assert.equal(getEffectiveAc(snapshot, hero), 16, "Mage Armor should set 13 + Dex, then stack Shield of Faith");
  hero.economy.actionAvailable = true;

  assert.equal(resolveAction(snapshot, hero, "bless", "hero", scriptedDice({ damage: 2 }), log), true);
  hero.economy.actionAvailable = true;
  assert.equal(resolveAction(snapshot, hero, "bow", "enemy", scriptedDice({ d20: [5], damage: 2 }), log), true);
  assert.ok(
    log.events.some((event) => event.type === "attack.roll" && event.detail.actionId === "bow" && event.detail.bonus === 7),
    "Bless should add its d4 to attack rolls through generic modifiers"
  );
  hero.economy.actionAvailable = true;

  assert.equal(resolveAction(snapshot, hero, "blade_ward", null, scriptedDice({ damage: 3 }), log), true);
  enemy.economy.actionAvailable = true;
  assert.equal(resolveAction(snapshot, enemy, "blade", "hero", scriptedDice({ d20: [18], damage: 3 }), log), true);
  assert.ok(
    log.events.some((event) => event.type === "attack.roll" && event.detail.actorId === "enemy" && event.detail.bonus === 2),
    "Blade Ward should subtract its d4 from incoming attack rolls"
  );
  hero.economy.actionAvailable = true;

  assert.equal(resolveAction(snapshot, hero, "resistance", "hero", scriptedDice({ damage: 2 }), log), true);
  enemy.economy.actionAvailable = true;
  const hpBefore = hero.hp;
  assert.equal(resolveAction(snapshot, enemy, "blade", "hero", scriptedDice({ d20: [20], damage: 5 }), log), true);
  assert.ok(hero.hp > 0 && hero.hp <= hpBefore, "Resistance should resolve without bespoke spell logic");
  assert.ok(
    log.events.some((event) => event.type === "damage.applied" && event.detail.damageModifiers.reduced?.length),
    "Resistance should log generic damage reduction"
  );
}

function testBaneAppliesGenericAttackAndSavePenalties() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors[0];
  const enemy = snapshot.actors[1];
  const log = createCombatLog();
  hero.position = { x: 0, y: 0 };
  enemy.position = { x: 1, y: 0 };
  enemy.saves.cha = 0;
  hero.actions.push(createSpellAction(SPELLS.bane, { spellSaveDC: 13 }));

  assert.equal(resolveAction(snapshot, hero, "bane", "enemy", scriptedDice({ d20: [1], damage: 2 }), log), true);
  assert.ok(enemy.activeEffects.some((effect) => effect.stat === "attack_roll"), "Bane should attach an attack-roll penalty after failed save");
  assert.ok(enemy.activeEffects.some((effect) => effect.stat === "save"), "Bane should attach a save penalty after failed save");

  enemy.economy.actionAvailable = true;
  assert.equal(resolveAction(snapshot, enemy, "blade", "hero", scriptedDice({ d20: [12], damage: 2 }), log), true);
  assert.ok(
    log.events.some((event) => event.type === "attack.roll" && event.detail.actorId === "enemy" && event.detail.bonus === 3),
    "Bane should subtract its d4 from attack rolls"
  );

  hero.economy.actionAvailable = true;
  assert.equal(resolveAction(snapshot, hero, "spark", "enemy", scriptedDice({ d20: [12], damage: 2 }), log), true);
  assert.ok(
    log.events.some((event) => event.type === "save.roll" && event.detail.targetId === "enemy" && event.detail.bonus === -2),
    "Bane should subtract its d4 from saving throws"
  );
}

function testLuckyUsesNearMissOncePerCombat() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors[0];
  const enemy = snapshot.actors[1];
  const log = createCombatLog();
  hero.position = { x: 0, y: 0 };
  enemy.position = { x: 1, y: 0 };
  hero.luck = { points: 2, max: 2, usedThisCombat: false };

  assert.equal(resolveAction(snapshot, hero, "bow", "enemy", scriptedDice({ d20: [4, 15], damage: 2 }), log), true);
  assert.ok(
    log.events.some((event) =>
      event.type === "lucky.roll" &&
      event.detail.actorId === "hero" &&
      event.detail.originalRoll === 4 &&
      event.detail.secondRoll === 15
    ),
    "Lucky should trigger on attack rolls that miss by less than 5"
  );
  assert.equal(hero.luck.points, 1, "Lucky should spend one Luck Point");
  assert.equal(hero.luck.usedThisCombat, true, "Lucky should mark its once-per-combat use");
  assert.ok(enemy.hp < enemy.maxHp, "Lucky's replacement roll should be used for hit resolution");

  const luckyEventsBefore = log.events.filter((event) => event.type === "lucky.roll").length;
  hero.economy.actionAvailable = true;
  assert.equal(resolveAction(snapshot, hero, "bow", "enemy", scriptedDice({ d20: [4, 18], damage: 2 }), log), true);
  assert.equal(
    log.events.filter((event) => event.type === "lucky.roll").length,
    luckyEventsBefore,
    "Lucky should not trigger twice in the same combat"
  );
}

function pickTags(tags) {
  return {
    attackRoll: tags.attackRoll,
    harmful: tags.harmful,
    melee: tags.melee,
    ranged: tags.ranged,
    savingThrow: tags.savingThrow,
    spell: tags.spell,
    weapon: tags.weapon,
  };
}

export async function runSystemCombatTests() {
  testActionTagInference();
  testPerceptionGate();
  testMovementCostGate();
  testRequiresSightActionGate();
  testStructuredActionFailureResult();
  testPublicCombatApiBoundary();
  testActionFactoryWeaponOutput();
  testActionFactorySpellOutput();
  testActionFactorySpellEffects();
  testActionFactoryConsumableOutput();
  testActorModifiersAffectCoreRolls();
  testSaveAndDamageReductionModifiers();
  testPersistentCombatObjectTriggers();
  testSpellCreatedZonesBlockSightAndAffectMovement();
  testTriggeredZoneSaveCanNegateDamage();
  testRollModifierSpellsResolveThroughGenericEffects();
  testBaneAppliesGenericAttackAndSavePenalties();
  testLuckyUsesNearMissOncePerCombat();
}
