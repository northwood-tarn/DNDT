import {
  assert,
  actorsInFootprint,
  coneFootprint,
  createCombatController,
  createCombatLog,
  createSnapshotFromScenario,
  cubeFootprint,
  endTurnEffects,
  fixedDice,
  getActorEconomyView,
  getCondition,
  getItemQuantity,
  getMovementRemaining,
  getValidTargets,
  hasAnyUsefulOption,
  hasCondition,
  hasLineOfSight,
  hasReaction,
  isWalkable,
  lineDirection,
  lineFootprint,
  makeHarnessSnapshot,
  moveActor,
  nextStepToward,
  radiusFootprint,
  resolveAction,
  runAiTurn,
  scriptedDice,
  startTurn,
  validateCombatActor,
} from "./helpers.js";

function testDodgeAndProneActions() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors[0];
  const enemy = snapshot.actors[1];
  const log = createCombatLog();
  hero.position = { x: 3, y: 2 };
  enemy.position = { x: 4, y: 2 };

  assert.equal(resolveAction(snapshot, hero, "dodge", null, fixedDice(), log), true, "dodge should resolve without a target");
  assert.equal(hasCondition(hero, "dodging"), true, "dodge should apply the dodging condition");

  assert.equal(resolveAction(snapshot, enemy, "blade", "hero", scriptedDice({ d20: [18, 2], damage: 1 }), log), true);
  assert.ok(
    log.events.some((event) => event.type === "attack.roll" && event.detail.mode === "disadvantage" && event.detail.roll === 2),
    "attacks against a dodging target should roll with disadvantage"
  );
  startTurn(snapshot, hero, log);
  assert.equal(hasCondition(hero, "dodging"), false, "dodge should expire through the start-turn effect lifecycle");
  assert.ok(log.events.some((event) => event.type === "condition.removed" && event.detail.condition === "dodging" && event.detail.reason === "start of turn"), "dodge expiry should be logged by the lifecycle");

  enemy.economy.actionAvailable = true;
  enemy.actions.unshift({
    id: "strong_first_hit",
    name: "Strong First Hit",
    type: "weapon_attack",
    range: 1,
    attackBonus: 10,
    damage: "1d6",
    damageType: "slashing",
    uses: { max: 1, remaining: 1 },
    effects: [
      {
        type: "condition",
        trigger: "hit",
        condition: "prone",
        label: "Prone",
        noSave: true,
        consumeUseOnApply: true,
      },
    ],
  });
  assert.equal(resolveAction(snapshot, enemy, "strong_first_hit", "hero", scriptedDice({ d20: [20], damage: 1 }), log), true);
  assert.equal(hasCondition(hero, "prone"), true, "Strong First Hit should knock the target prone without a save");
  assert.equal(enemy.actions[0].uses.remaining, 0, "Strong First Hit should be spent after it lands");

  const movementBefore = getMovementRemaining(hero);
  assert.equal(moveActor(snapshot, hero, { x: 3, y: 1 }, log, { dice: fixedDice() }), true, "moving while prone should stand first, then move");
  assert.equal(hasCondition(hero, "prone"), false, "movement should remove prone by standing");
  assert.equal(getMovementRemaining(hero), movementBefore - Math.ceil(hero.speed / 2) - 1, "standing plus moving should spend half movement and one square");
  assert.ok(log.events.some((event) => event.type === "condition.removed" && event.detail.reason === "stood as part of movement"), "standing as movement should be logged");
}

function testTimedEffectLifecycle() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors[0];
  const enemy = snapshot.actors[1];
  const log = createCombatLog();
  hero.position = { x: 0, y: 0 };
  enemy.position = { x: 1, y: 0 };
  hero.actions.find((action) => action.id === "spark").effects = [
    {
      type: "condition",
      trigger: "failed_save",
      condition: "restrained",
      duration: {
        kind: "rounds",
        rounds: 2,
        tick: "turn_end",
      },
    },
  ];

  assert.equal(resolveAction(snapshot, hero, "spark", "enemy", scriptedDice({ d20: [1], damage: 1 }), log), true);
  assert.equal(hasCondition(enemy, "restrained"), true, "timed condition should apply after failed save");

  endTurnEffects(snapshot, enemy, fixedDice(), log);
  assert.equal(hasCondition(enemy, "restrained"), true, "timed condition should remain after one lifecycle tick");

  endTurnEffects(snapshot, enemy, fixedDice(), log);
  assert.equal(hasCondition(enemy, "restrained"), false, "timed condition should expire after its configured round count");
  assert.ok(log.events.some((event) => event.type === "condition.removed" && event.detail.condition === "restrained" && event.detail.reason === "2 rounds elapsed"), "timed expiry should be logged by the lifecycle");
}

function testConditionDataDrivesMechanics() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors[0];
  const enemy = snapshot.actors[1];
  const log = createCombatLog();
  hero.position = { x: 0, y: 0 };
  enemy.position = { x: 1, y: 0 };

  assert.equal(getCondition("paralyzed")?.mechanics.blocksActions, true, "condition data should expose action-blocking mechanics");

  hero.conditions = [{ id: "paralyzed", label: "Paralyzed" }];
  assert.equal(getMovementRemaining(hero), 0, "speed-zero condition data should drive movement remaining");
  assert.equal(resolveAction(snapshot, hero, "bow", "enemy", fixedDice(), log), false, "action-blocking condition data should prevent actions");

  hero.conditions = [{ id: "invisible", label: "Invisible" }];
  enemy.conditions = [];
  hero.economy.actionAvailable = true;
  assert.equal(resolveAction(snapshot, hero, "bow", "enemy", scriptedDice({ d20: [4, 17], damage: 1 }), log), true);
  assert.ok(
    log.events.some((event) => event.type === "attack.roll" && event.detail.actorId === "hero" && event.detail.mode === "advantage" && event.detail.roll === 17),
    "outgoing advantage should come from condition data"
  );
}

function testSourceAwareConditionRules() {
  const snapshot = createSnapshotFromScenario({
    id: "source-aware-conditions",
    grid: { width: 6, height: 3, blocked: [], cover: [] },
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
        position: { x: 0, y: 1 },
        saves: {},
        actions: [
          {
            id: "bow",
            name: "Bow",
            type: "weapon_attack",
            range: 10,
            attackBonus: 5,
            damage: "1d6",
            damageType: "piercing",
          },
        ],
      },
      {
        id: "charmer",
        name: "Charmer",
        team: "enemies",
        role: "wizard",
        token: "C",
        hp: 12,
        maxHp: 12,
        ac: 12,
        initiativeBonus: 0,
        speed: 6,
        position: { x: 3, y: 1 },
        saves: {},
        actions: [],
      },
      {
        id: "other",
        name: "Other Enemy",
        team: "enemies",
        role: "swordsman",
        token: "O",
        hp: 12,
        maxHp: 12,
        ac: 12,
        initiativeBonus: 0,
        speed: 6,
        position: { x: 0, y: 2 },
        saves: {},
        actions: [],
      },
    ],
  });
  const hero = snapshot.actors[0];
  const log = createCombatLog();

  hero.conditions = [{ id: "charmed", label: "Charmed", sourceActorId: "charmer" }];
  assert.equal(resolveAction(snapshot, hero, "bow", "charmer", fixedDice(), log), false, "charmed actor should not target the source with harmful actions");
  assert.ok(log.events.some((event) => event.type === "target.invalid" && event.detail.reason.includes("Charmed prevents targeting Charmer")), "charmed targeting block should be logged by the rules gate");

  hero.economy.actionAvailable = true;
  assert.equal(resolveAction(snapshot, hero, "bow", "other", scriptedDice({ d20: [12], damage: 1 }), log), true, "charmed actor can still target other enemies");

  hero.conditions = [{ id: "frightened", label: "Frightened", sourceActorId: "charmer" }];
  hero.position = { x: 0, y: 1 };
  hero.economy.movementUsed = 0;
  assert.equal(moveActor(snapshot, hero, { x: 1, y: 1 }, log, { dice: fixedDice() }), false, "frightened actor should not move closer to visible source");
  assert.ok(log.events.some((event) => event.type === "move.blocked" && event.detail.reason.includes("Frightened prevents moving closer to Charmer")), "frightened movement block should be logged by the rules gate");
  assert.equal(moveActor(snapshot, hero, { x: 0, y: 0 }, log, { dice: fixedDice() }), true, "frightened actor can move without getting closer to the source");
}

function testSourceCleanupConditionRules() {
  const snapshot = createSnapshotFromScenario({
    id: "source-cleanup-conditions",
    grid: { width: 5, height: 3, blocked: [], cover: [] },
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
        position: { x: 1, y: 1 },
        saves: {},
        conditions: [
          { id: "grappled", label: "Grappled", sourceActorId: "enemy", sourceReach: 1 },
        ],
        actions: [],
      },
      {
        id: "enemy",
        name: "Enemy",
        team: "enemies",
        role: "swordsman",
        token: "E",
        hp: 10,
        maxHp: 10,
        ac: 12,
        initiativeBonus: 0,
        speed: 6,
        position: { x: 2, y: 1 },
        saves: {},
        actions: [],
      },
    ],
  });
  const hero = snapshot.actors[0];
  const enemy = snapshot.actors[1];
  const log = createCombatLog();

  assert.equal(hasCondition(hero, "grappled"), true, "setup should begin grappled");
  enemy.conditions = [{ id: "incapacitated", label: "Incapacitated" }];
  startTurn(snapshot, hero, log);
  assert.equal(hasCondition(hero, "grappled"), false, "grapple should end if the source is incapacitated");
  assert.ok(log.events.some((event) => event.type === "condition.removed" && event.detail.condition === "grappled" && event.detail.reason === "Enemy is incapacitated"), "source incapacitation cleanup should be logged");

  hero.conditions = [{ id: "grappled", label: "Grappled", sourceActorId: "enemy", sourceReach: 1 }];
  enemy.conditions = [];
  enemy.position = { x: 4, y: 1 };
  startTurn(snapshot, hero, log);
  assert.equal(hasCondition(hero, "grappled"), false, "grapple should end if source reach is broken");
  assert.ok(log.events.some((event) => event.type === "condition.removed" && event.detail.condition === "grappled" && event.detail.reason === "Enemy is out of reach"), "source reach cleanup should be logged");
}

function testConditionAutoFailSaves() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors[0];
  const enemy = snapshot.actors[1];
  const log = createCombatLog();
  hero.position = { x: 0, y: 0 };
  enemy.position = { x: 1, y: 0 };
  enemy.conditions = [{ id: "stunned", label: "Stunned" }];

  assert.equal(resolveAction(snapshot, hero, "dex_blast", "enemy", scriptedDice({ d20: [20], damage: 2 }), log), true);
  assert.equal(enemy.hp, 6, "auto-failed DEX save should apply failed-save damage");
  assert.ok(log.events.some((event) => event.type === "save.roll" && event.detail.mode === "auto_fail"), "auto-failed save should be logged without rolling");
  assert.ok(log.events.some((event) => event.type === "save.result" && event.detail.success === false), "auto-failed save should fail regardless of d20 script");
}

function testConditionCriticalHits() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors[0];
  const enemy = snapshot.actors[1];
  const log = createCombatLog();
  hero.position = { x: 0, y: 0 };
  enemy.position = { x: 1, y: 0 };
  hero.actions.unshift({
    id: "sword",
    name: "Sword",
    type: "weapon_attack",
    range: 1,
    attackBonus: 5,
    damage: "1d8",
    damageType: "slashing",
  });
  enemy.conditions = [{ id: "unconscious", label: "Unconscious" }];

  assert.equal(resolveAction(snapshot, hero, "sword", "enemy", scriptedDice({ d20: [12], damage: 3 }), log), true);
  assert.equal(enemy.hp, 2, "melee hit against unconscious target should roll critical damage dice");
  assert.ok(log.events.some((event) => event.type === "attack.result" && event.detail.critical === true), "condition-driven critical hit should be logged");
  assert.ok(log.events.some((event) => event.type === "damage.roll" && event.detail.critical === true && event.detail.total === 6), "critical damage should include extra dice");
}

function testConditionApplySideEffects() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors[0];
  const enemy = snapshot.actors[1];
  const log = createCombatLog();
  hero.position = { x: 0, y: 0 };
  enemy.position = { x: 1, y: 0 };
  hero.actions.find((action) => action.id === "spark").effects = [
    {
      type: "condition",
      trigger: "failed_save",
      condition: "unconscious",
    },
  ];

  assert.equal(resolveAction(snapshot, hero, "spark", "enemy", scriptedDice({ d20: [1], damage: 1 }), log), true);
  assert.equal(hasCondition(enemy, "unconscious"), true, "failed save should apply unconscious");
  assert.equal(hasCondition(enemy, "prone"), true, "fallsProneOnApply should apply prone through the generic side-effect path");
  assert.ok(log.events.some((event) => event.type === "condition.applied" && event.detail.condition === "prone" && event.detail.reason === "Unconscious side effect"), "condition side effect should be logged");
}

function testDamageModifierLayer() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors[0];
  const enemy = snapshot.actors[1];
  const log = createCombatLog();
  hero.position = { x: 0, y: 0 };
  enemy.position = { x: 1, y: 0 };

  enemy.conditions = [{ id: "petrified", label: "Petrified" }];
  assert.equal(resolveAction(snapshot, hero, "spark", "enemy", scriptedDice({ d20: [1], damage: 5 }), log), true);
  assert.equal(enemy.hp, 6, "petrified resistance to all damage should halve post-roll damage");
  assert.ok(log.events.some((event) => event.type === "damage.applied" && event.detail.originalAmount === 5 && event.detail.amount === 2 && event.detail.damageModifiers.resistant.includes("petrified")), "resistance adjustment should be logged");

  hero.economy.actionAvailable = true;
  enemy.hp = 8;
  enemy.conditions = [];
  enemy.immune = ["poison"];
  hero.actions.push({
    id: "poison_test",
    name: "Poison Test",
    type: "spell_save",
    range: 8,
    saveAbility: "con",
    spellSaveDC: 13,
    damage: "1d6",
    damageType: "poison",
  });
  assert.equal(resolveAction(snapshot, hero, "poison_test", "enemy", scriptedDice({ d20: [1], damage: 5 }), log), true);
  assert.equal(enemy.hp, 8, "poison immunity should reduce damage to zero");
  assert.ok(log.events.some((event) => event.type === "damage.applied" && event.detail.damageType === "poison" && event.detail.amount === 0 && event.detail.damageModifiers.immune.includes("actor")), "immunity adjustment should be logged");

  hero.economy.actionAvailable = true;
  enemy.vulnerability = ["psychic"];
  delete enemy.immune;
  assert.equal(resolveAction(snapshot, hero, "spark", "enemy", scriptedDice({ d20: [1], damage: 4 }), log), true);
  assert.equal(enemy.hp, 0, "psychic vulnerability should double damage");
  assert.ok(log.events.some((event) => event.type === "damage.applied" && event.detail.damageType === "psychic" && event.detail.originalAmount === 4 && event.detail.amount === 8 && event.detail.damageModifiers.vulnerable.includes("actor")), "vulnerability adjustment should be logged");
}

function testAttackRiderConditionEffects() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors[0];
  const enemy = snapshot.actors[1];
  const log = createCombatLog();
  hero.position = { x: 0, y: 0 };
  enemy.position = { x: 1, y: 0 };
  hero.actions.find((action) => action.id === "spark").effects = [
    {
      type: "condition",
      trigger: "failed_save",
      condition: "next_attack_disadvantage",
    },
    {
      type: "condition",
      trigger: "failed_save",
      condition: "next_incoming_attack_advantage",
    },
  ];

  assert.equal(resolveAction(snapshot, hero, "spark", "enemy", scriptedDice({ d20: [1], damage: 1 }), log), true);
  assert.equal(hasCondition(enemy, "next_attack_disadvantage"), true, "Vicious Mockery/Guiding Bolt fixture should shake the target's next attack on failed save");
  assert.equal(hasCondition(enemy, "next_incoming_attack_advantage"), true, "Vicious Mockery/Guiding Bolt fixture should grant advantage on the next incoming attack on failed save");

  assert.equal(resolveAction(snapshot, enemy, "blade", "hero", scriptedDice({ d20: [18, 3], damage: 1 }), log), true);
  assert.equal(hasCondition(enemy, "next_attack_disadvantage"), false, "next-attack disadvantage should be consumed by the target's attack");
  assert.ok(
    log.events.some((event) => event.type === "attack.roll" && event.detail.actorId === "enemy" && event.detail.mode === "disadvantage" && event.detail.roll === 3),
    "Vicious Mockery/Guiding Bolt fixture target should roll its next attack with disadvantage"
  );

  hero.economy.actionAvailable = true;
  assert.equal(resolveAction(snapshot, hero, "bow", "enemy", scriptedDice({ d20: [4, 16], damage: 1 }), log), true);
  assert.equal(hasCondition(enemy, "next_incoming_attack_advantage"), false, "next incoming attack advantage should be consumed by the next attack against the target");
  assert.ok(
    log.events.some((event) => event.type === "attack.roll" && event.detail.actorId === "hero" && event.detail.mode === "advantage" && event.detail.roll === 16),
    "next attack against the Vicious Mockery/Guiding Bolt fixture target should roll with advantage"
  );
}


export async function runConditionCombatTests() {
  testDodgeAndProneActions();
  testTimedEffectLifecycle();
  testConditionDataDrivesMechanics();
  testSourceAwareConditionRules();
  testSourceCleanupConditionRules();
  testConditionAutoFailSaves();
  testConditionCriticalHits();
  testConditionApplySideEffects();
  testDamageModifierLayer();
  testAttackRiderConditionEffects();
}
