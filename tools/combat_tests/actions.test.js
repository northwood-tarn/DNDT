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

function testInitiativeIsLogged() {
  const controller = createCombatController();
  const initiative = controller.log.events.find((event) => event.type === "initiative.roll");
  assert.ok(initiative, "combat reset should log initiative rolls");
  assert.deepEqual(
    initiative.detail.order,
    controller.snapshot.initiative.map((actorId) => controller.snapshot.actors.find((actor) => actor.id === actorId).name),
    "initiative log order should match snapshot initiative"
  );
}

function testOpportunityAttack() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors[0];
  const enemy = snapshot.actors[1];
  const log = createCombatLog();
  hero.position = { x: 3, y: 2 };
  enemy.position = { x: 4, y: 2 };
  hero.hp = 20;

  assert.equal(moveActor(snapshot, hero, { x: 3, y: 1 }, log, { dice: fixedDice({ d20: 10, damage: 3 }) }), true);
  assert.equal(hero.hp, 17, "leaving melee reach should trigger opportunity damage");
  assert.equal(hasReaction(enemy), false, "opportunity attack should spend reaction");
  assert.ok(log.events.some((event) => event.type === "opportunity.attack"), "opportunity event should be logged");
  assert.ok(log.events.some((event) => event.type === "reaction.spend"), "reaction spend should be logged");

  assert.equal(moveActor(snapshot, hero, { x: 3, y: 0 }, log, { dice: fixedDice({ d20: 20, damage: 3 }) }), true);
  assert.equal(hero.hp, 17, "spent reaction should prevent a second opportunity attack before refresh");
}

function testDefeatedCurrentActorAdvancesTurn() {
  const controller = createCombatController();
  const snapshot = controller.snapshot;
  const hero = snapshot.actors.find((actor) => actor.team === "heroes");
  const enemy = snapshot.actors.find((actor) => actor.team === "enemies");
  const ally = structuredClone(hero);
  snapshot.actors.length = 0;
  snapshot.actors.push(hero, enemy, ally);
  snapshot.initiative = [hero.id, enemy.id, ally.id];
  snapshot.turnIndex = 0;
  snapshot.round = 1;
  snapshot.outcome = null;

  hero.name = "Fragile Mover";
  hero.hp = 3;
  hero.maxHp = 20;
  hero.ac = 10;
  hero.position = { x: 1, y: 1 };
  enemy.name = "Opportunity Guard";
  enemy.hp = 20;
  enemy.maxHp = 20;
  enemy.position = { x: 2, y: 1 };
  enemy.actions = [
    {
      id: "blade",
      name: "Blade",
      type: "weapon_attack",
      range: 1,
      attackBonus: 10,
      damage: "1d8",
      damageType: "slashing",
    },
  ];
  ally.id = "backup_hero";
  ally.name = "Backup Hero";
  ally.hp = 20;
  ally.maxHp = 20;
  ally.position = { x: 0, y: 0 };

  controller.dice.rollD20 = () => ({ roll: 20, total: 20, usedLucky: false, secondRoll: null });
  controller.dice.rollDamage = (dice) => ({ total: 8, rolls: [8], modifier: 0, dice });
  const moved = controller.move(hero.id, { x: 1, y: 0 });
  assert.equal(moved, false, "movement should stop when the mover is defeated by the opportunity attack");
  assert.equal(hero.hp, 0, "opportunity attack should defeat the moving current actor");
  assert.equal(snapshot.initiative[snapshot.turnIndex], enemy.id, "initiative should advance past the defeated current actor");
  assert.ok(controller.log.events.some((event) => event.type === "turn.end" && event.detail.reason === "current actor was defeated"), "auto turn end should be logged");
  assert.ok(controller.log.events.some((event) => event.type === "turn.start" && event.detail.actorId === enemy.id), "next living actor should start turn");
}

function testPushMovesTargetWithoutOpportunityAttack() {
  const snapshot = createSnapshotFromScenario({
    id: "push-clean",
    grid: { width: 6, height: 3, blocked: [], cover: [] },
    actors: [
      {
        id: "fighter",
        name: "Fighter",
        team: "heroes",
        role: "fighter",
        token: "F",
        hp: 20,
        maxHp: 20,
        ac: 12,
        initiativeBonus: 0,
        speed: 6,
        position: { x: 1, y: 1 },
        saves: {},
        actions: [
          {
            id: "push",
            name: "Push",
            type: "push",
            range: 1,
            distanceSquares: 2,
            collisionDamage: "1d4",
            collisionDamageType: "bludgeoning",
          },
        ],
      },
      {
        id: "enemy",
        name: "Enemy",
        team: "enemies",
        role: "swordsman",
        token: "E",
        hp: 12,
        maxHp: 12,
        ac: 12,
        initiativeBonus: 0,
        speed: 6,
        position: { x: 2, y: 1 },
        saves: {},
        actions: [
          {
            id: "blade",
            name: "Blade",
            type: "weapon_attack",
            range: 1,
            attackBonus: 10,
            damage: "1d6",
            damageType: "slashing",
          },
        ],
      },
    ],
  });
  const log = createCombatLog();
  const fighter = snapshot.actors[0];
  const enemy = snapshot.actors[1];

  assert.equal(resolveAction(snapshot, fighter, "push", "enemy", fixedDice({ d20: 20, damage: 4 }), log), true);
  assert.deepEqual(enemy.position, { x: 4, y: 1 }, "push should move target directly away by two squares");
  assert.equal(enemy.hp, 12, "clean push should not deal damage");
  assert.equal(log.events.some((event) => event.type === "opportunity.attack"), false, "forced movement should not trigger opportunity attacks");
}

function testPushCollisionDamage() {
  const snapshot = createSnapshotFromScenario({
    id: "push-collision",
    grid: {
      width: 5,
      height: 3,
      blocked: [{ x: 3, y: 1 }],
      cover: [],
    },
    actors: [
      {
        id: "fighter",
        name: "Fighter",
        team: "heroes",
        role: "fighter",
        token: "F",
        hp: 20,
        maxHp: 20,
        ac: 12,
        initiativeBonus: 0,
        speed: 6,
        position: { x: 1, y: 1 },
        saves: {},
        actions: [
          {
            id: "push",
            name: "Push",
            type: "push",
            range: 1,
            distanceSquares: 2,
            collisionDamage: "1d4",
            collisionDamageType: "bludgeoning",
          },
        ],
      },
      {
        id: "enemy",
        name: "Enemy",
        team: "enemies",
        role: "swordsman",
        token: "E",
        hp: 12,
        maxHp: 12,
        ac: 12,
        initiativeBonus: 0,
        speed: 6,
        position: { x: 2, y: 1 },
        saves: {},
        actions: [],
      },
    ],
  });
  const log = createCombatLog();
  const fighter = snapshot.actors[0];
  const enemy = snapshot.actors[1];

  assert.equal(resolveAction(snapshot, fighter, "push", "enemy", fixedDice({ damage: 3 }), log), true);
  assert.deepEqual(enemy.position, { x: 2, y: 1 }, "collision on first square should leave target in place");
  assert.equal(enemy.hp, 6, "two prevented squares should deal 2d4 collision damage with fixed 3 rolls");
  assert.ok(log.events.some((event) => event.type === "collision.damage" && event.detail.collisionSquares === 2), "collision damage should log prevented 5ft increments");
}

function testPushIntoActorDoesNotDealCollisionDamage() {
  const snapshot = createSnapshotFromScenario({
    id: "push-actor-collision",
    grid: { width: 5, height: 3, blocked: [], cover: [] },
    actors: [
      {
        id: "fighter",
        name: "Fighter",
        team: "heroes",
        role: "fighter",
        token: "F",
        hp: 20,
        maxHp: 20,
        ac: 12,
        initiativeBonus: 0,
        speed: 6,
        position: { x: 0, y: 1 },
        saves: {},
        actions: [{ id: "push", name: "Push", type: "push", range: 1, distanceSquares: 2, collisionDamage: "1d4", collisionDamageType: "bludgeoning" }],
      },
      { id: "enemy", name: "Enemy", team: "enemies", role: "swordsman", token: "E", hp: 12, maxHp: 12, ac: 12, initiativeBonus: 0, speed: 6, position: { x: 1, y: 1 }, saves: {}, actions: [] },
      { id: "blocker", name: "Blocker", team: "enemies", role: "swordsman", token: "B", hp: 12, maxHp: 12, ac: 12, initiativeBonus: 0, speed: 6, position: { x: 2, y: 1 }, saves: {}, actions: [] },
    ],
  });
  const log = createCombatLog();
  const fighter = snapshot.actors[0];
  const enemy = snapshot.actors[1];

  assert.equal(resolveAction(snapshot, fighter, "push", "enemy", fixedDice({ damage: 3 }), log), true);
  assert.deepEqual(enemy.position, { x: 1, y: 1 }, "actor-blocked push should leave target in place");
  assert.equal(enemy.hp, 12, "actor-blocked push should not use environmental collision damage");
  assert.equal(log.events.some((event) => event.type === "collision.damage"), false, "actor collision should not log environmental collision damage");
}


export async function runActionCombatTests() {
  testInitiativeIsLogged();
  testOpportunityAttack();
  testDefeatedCurrentActorAdvancesTurn();
  testPushMovesTargetWithoutOpportunityAttack();
  testPushCollisionDamage();
  testPushIntoActorDoesNotDealCollisionDamage();
}
