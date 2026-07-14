import {
  assert,
  createCombatLog,
  createSnapshotFromScenario,
  endTurnEffects,
  getValidTargets,
  getMovementRemaining,
  makeHarnessSnapshot,
  moveActor,
  resolveAction,
  scriptedDice,
} from "./helpers.js";
import { combatObjectCells } from "../../app/combat/combatObjects.js";
import { createCombatGame, getCombatScenarioOptions } from "../../app/combat/api.js";
import { formatEvent } from "../../app/combat/combatLog.js";
import { getEffectiveAc } from "../../app/combat/modifiers.js";
import { getActionTags } from "../../app/combat/actionTags.js";
import { createSpellAction } from "../../app/combat/actionFactory.js";
import { resolveActionResult } from "../../app/combat/actionResult.js";
import { canSeeActor } from "../../app/combat/perception.js";
import { createStarterCharacterDraft, resolveCharacterSheet, resolvedSheetToCombatActor } from "../../app/character/index.js";
import { SPELLS } from "../../app/data/spells.js";
import { checkOutcome } from "../../app/combat/combatState.js";

function testDefeatedCompanionRevivesWhenCombatEnds() {
  const snapshot = {
    round: 3,
    outcome: null,
    actors: [
      { id: "pc", name: "PC", kind: "player", team: "heroes", hp: 8 },
      { id: "tara", name: "Tara", kind: "companion", team: "heroes", hp: 0, defeated: true },
      { id: "enemy", name: "Enemy", kind: "enemy", team: "enemies", hp: 0, defeated: true },
    ],
  };
  const log = createCombatLog();

  assert.equal(checkOutcome(snapshot, log), "victory");
  assert.equal(snapshot.actors[1].hp, 1);
  assert.equal(snapshot.actors[1].defeated, false);
  assert.ok(log.events.some((event) => event.type === "actor.revive" && event.detail.actorId === "tara"));
}

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
  assert.deepEqual(getCombatScenarioOptions().map((scenario) => scenario.id), [
    "generated-empty-arena",
    "dockside-stage-grid",
    "backlands-field-plateau-01",
    "trench-ramp-live-test",
    "generated-character-arena",
    "generated-wizard-shield-arena",
    "generated-encounter-goblin-skirmish",
    "generated-encounter-bone-guard",
    "generated-encounter-shadow-hounds",
    "generated-encounter-level-7-team-trial",
    "generated-encounter-level-7-caster-trial",
  ], "public API should expose canonical generated scenario options");
  assert.ok(Array.isArray(game.query.reachableCells(actor.id)), "public API should expose reachable-cell queries");
  assert.equal(game.resolveAction(actor.id, "missing_action", null).ok, false, "public API resolveAction should return structured results");
  assert.equal(typeof game.action(actor.id, "missing_action", null), "boolean", "legacy boolean action command should remain available");
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
  const bladeWardAttack = log.events.find((event) => event.type === "attack.roll" && event.detail.actorId === "enemy");
  assert.ok(
    formatEvent(bladeWardAttack).includes("Blade Ward -3"),
    "Blade Ward should be visible in the formatted attack log"
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

function testResourcefulAutoTriggersOnAttackNearMiss() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors[0];
  const enemy = snapshot.actors[1];
  const log = createCombatLog();
  hero.position = { x: 0, y: 0 };
  enemy.position = { x: 1, y: 0 };
  hero.resources = [{ id: "resourceful", name: "Resourceful", max: 1, current: 1, recovery: "long_rest" }];

  assert.equal(resolveAction(snapshot, hero, "bow", "enemy", scriptedDice({ d20: [4, 15], damage: 2 }), log), true);
  assert.ok(
    log.events.some((event) => event.type === "resourceful.roll" && event.detail.actorId === "hero"),
    "Resourceful should automatically trigger when an attack misses by 4 or less"
  );
  assert.equal(hero.resources.find((item) => item.id === "resourceful").current, 0, "Resourceful should spend its resource");
  assert.ok(enemy.hp < enemy.maxHp, "Resourceful's replacement roll should be used for hit resolution");
}

function testBlessCanAffectMultipleSelectedAllies() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors[0];
  const ally = {
    ...structuredClone(hero),
    id: "ally",
    name: "Ally",
    hp: 20,
    maxHp: 20,
    position: { x: 1, y: 2 },
    actions: [],
  };
  snapshot.actors.push(ally);
  hero.actions.push(createSpellAction(SPELLS.bless, { spellSaveDC: 13 }));
  const log = createCombatLog();

  assert.equal(resolveAction(snapshot, hero, "bless", { targetIds: ["hero", "ally"] }, scriptedDice(), log), true);
  assert.ok(hero.activeEffects.some((effect) => effect.label === "Bless"), "Bless should apply to the first selected ally");
  assert.ok(ally.activeEffects.some((effect) => effect.label === "Bless"), "Bless should apply to another selected ally");
  assert.equal(hero.economy.actionAvailable, false, "multi-target Bless should spend the action once");
}

function testBlessMultiTargetPassesControllerPreflight() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors[0];
  const ally = {
    ...structuredClone(hero),
    id: "ally",
    name: "Ally",
    hp: 20,
    maxHp: 20,
    position: { x: 1, y: 2 },
    actions: [],
  };
  snapshot.actors.push(ally);
  hero.actions.push(createSpellAction(SPELLS.bless, { spellSaveDC: 13 }));
  const log = createCombatLog();

  const result = resolveActionResult(snapshot, hero, "bless", { targetIds: ["hero", "ally"] }, scriptedDice(), log);
  assert.equal(result.ok, true, "controller preflight should accept individual multi-target spell payloads");
  assert.ok(ally.activeEffects.some((effect) => effect.label === "Bless"), "Bless should resolve through controller preflight");
}

function testBlessTargetsAlliesWithoutLineOfSightRequirement() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors[0];
  const ally = {
    ...structuredClone(hero),
    id: "ally",
    name: "Ally",
    hp: 20,
    maxHp: 20,
    position: { x: 3, y: 2 },
    actions: [],
  };
  snapshot.actors.push(ally);
  hero.actions.push(createSpellAction(SPELLS.bless, { spellSaveDC: 13 }));

  assert.equal(hero.actions.find((action) => action.id === "bless").requiresSight, false, "Bless should not require sight");
  assert.ok(
    getValidTargets(snapshot, hero.id, "bless").some((target) => target.id === "ally"),
    "Bless should target an ally within range even if a wall blocks line of sight"
  );
}

function testFlankingGrantsMeleeWeaponAdvantage() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors[0];
  const enemy = snapshot.actors[1];
  const ally = {
    ...structuredClone(hero),
    id: "ally",
    name: "Ally",
    position: { x: 2, y: 1 },
    actions: [],
  };
  hero.position = { x: 0, y: 1 };
  enemy.position = { x: 1, y: 1 };
  snapshot.actors.push(ally);
  hero.actions.push({
    id: "blade",
    name: "Blade",
    type: "weapon_attack",
    range: 1,
    attackBonus: 0,
    damage: "1d6",
    damageType: "slashing",
    tags: { weapon: true, melee: true, attackRoll: true, harmful: true },
  });
  const log = createCombatLog();

  assert.equal(resolveAction(snapshot, hero, "blade", "enemy", scriptedDice({ d20: [3, 15], damage: 2 }), log), true);
  assert.ok(
    log.events.some((event) =>
      event.type === "attack.roll" &&
      event.detail.actionId === "blade" &&
      event.detail.mode === "advantage" &&
      event.detail.reasons.includes("ADV: flanking")
    ),
    "opposite allied melee engagement should grant flanking advantage"
  );
}

function testFlankingDoesNotRequireOppositeSquares() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors[0];
  const enemy = snapshot.actors[1];
  const ally = {
    ...structuredClone(hero),
    id: "ally",
    name: "Ally",
    position: { x: 1, y: 2 },
    actions: [],
  };
  hero.position = { x: 0, y: 1 };
  enemy.position = { x: 1, y: 1 };
  snapshot.actors.push(ally);
  hero.actions.push({
    id: "blade",
    name: "Blade",
    type: "weapon_attack",
    range: 1,
    attackBonus: 0,
    damage: "1d6",
    damageType: "slashing",
    tags: { weapon: true, melee: true, attackRoll: true, harmful: true },
  });
  const log = createCombatLog();

  assert.equal(resolveAction(snapshot, hero, "blade", "enemy", scriptedDice({ d20: [3, 15], damage: 2 }), log), true);
  assert.ok(
    log.events.some((event) =>
      event.type === "attack.roll" &&
      event.detail.actionId === "blade" &&
      event.detail.mode === "advantage" &&
      event.detail.reasons.includes("ADV: flanking")
    ),
    "any allied adjacent melee threat should grant flanking advantage"
  );
}

function testRogueSneakAttackTriggersFromFlanking() {
  const draft = createStarterCharacterDraft("rogue");
  draft.identity.level = 2;
  const rogue = {
    ...resolvedSheetToCombatActor(resolveCharacterSheet(draft, {}, { allowNonCreationLevel: true })),
    id: "rogue",
    position: { x: 0, y: 1 },
  };
  const ally = {
    ...structuredClone(makeHarnessSnapshot().actors[0]),
    id: "ally",
    name: "Ally",
    position: { x: 1, y: 2 },
    actions: [],
  };
  const enemy = {
    ...structuredClone(makeHarnessSnapshot().actors[1]),
    id: "enemy",
    name: "Enemy",
    hp: 30,
    maxHp: 30,
    ac: 10,
    position: { x: 1, y: 1 },
  };
  const snapshot = createSnapshotFromScenario({
    id: "rogue-sneak-attack-flanking",
    grid: { width: 5, height: 5, blocked: [], cover: [] },
    actors: [rogue, ally, enemy],
  });
  const actor = snapshot.actors.find((item) => item.id === "rogue");
  const target = snapshot.actors.find((item) => item.id === "enemy");
  const log = createCombatLog();

  assert.equal(resolveAction(snapshot, actor, "rapier", "enemy", scriptedDice({ d20: [4, 16], damage: [5, 4] }), log), true);
  assert.equal(target.hp, 21, "level-2 rogue should add 1d6 Sneak Attack damage while flanking");
  assert.ok(
    log.events.some((event) => event.type === "damage.roll" && event.detail.label === "Sneak Attack" && event.detail.dice === "1d6"),
    "Sneak Attack should be logged as a damage rider"
  );
}

function testRogueSneakAttackScalesWithLevel() {
  const draft = createStarterCharacterDraft("rogue");
  draft.identity.level = 5;
  const rogue = {
    ...resolvedSheetToCombatActor(resolveCharacterSheet(draft, {}, { allowNonCreationLevel: true })),
    id: "rogue",
    position: { x: 0, y: 1 },
  };
  const ally = {
    ...structuredClone(makeHarnessSnapshot().actors[0]),
    id: "ally",
    name: "Ally",
    position: { x: 1, y: 2 },
    actions: [],
  };
  const enemy = {
    ...structuredClone(makeHarnessSnapshot().actors[1]),
    id: "enemy",
    name: "Enemy",
    hp: 30,
    maxHp: 30,
    ac: 10,
    position: { x: 1, y: 1 },
  };
  const snapshot = createSnapshotFromScenario({
    id: "rogue-sneak-attack-scaling",
    grid: { width: 5, height: 5, blocked: [], cover: [] },
    actors: [rogue, ally, enemy],
  });
  const actor = snapshot.actors.find((item) => item.id === "rogue");
  const target = snapshot.actors.find((item) => item.id === "enemy");
  const log = createCombatLog();

  assert.equal(resolveAction(snapshot, actor, "rapier", "enemy", scriptedDice({ d20: [4, 16], damage: [5, 9] }), log), true);
  assert.equal(target.hp, 16, "level-5 rogue should add 3d6 Sneak Attack damage while flanking");
  assert.ok(
    log.events.some((event) => event.type === "damage.roll" && event.detail.label === "Sneak Attack" && event.detail.dice === "3d6"),
    "Sneak Attack dice should scale by rogue level"
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
  testDefeatedCompanionRevivesWhenCombatEnds();
  testActionTagInference();
  testPerceptionGate();
  testMovementCostGate();
  testRequiresSightActionGate();
  testStructuredActionFailureResult();
  testPublicCombatApiBoundary();
  testActorModifiersAffectCoreRolls();
  testSaveAndDamageReductionModifiers();
  testPersistentCombatObjectTriggers();
  testSpellCreatedZonesBlockSightAndAffectMovement();
  testTriggeredZoneSaveCanNegateDamage();
  testRollModifierSpellsResolveThroughGenericEffects();
  testBaneAppliesGenericAttackAndSavePenalties();
  testLuckyUsesNearMissOncePerCombat();
  testResourcefulAutoTriggersOnAttackNearMiss();
  testBlessCanAffectMultipleSelectedAllies();
  testBlessMultiTargetPassesControllerPreflight();
  testBlessTargetsAlliesWithoutLineOfSightRequirement();
  testFlankingGrantsMeleeWeaponAdvantage();
  testFlankingDoesNotRequireOppositeSquares();
  testRogueSneakAttackTriggersFromFlanking();
  testRogueSneakAttackScalesWithLevel();
}
