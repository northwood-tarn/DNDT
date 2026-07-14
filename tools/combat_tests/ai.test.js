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
import { AI_PROFILE_IDS, getAiProfile } from "../../app/combat/aiProfiles.js";
import { enemies } from "../../app/data/enemies.js";

async function testAiStepEvents() {
  const controller = createCombatController();
  while (controller.snapshot.actors.find((actor) => actor.id === controller.snapshot.initiative[controller.snapshot.turnIndex])?.team !== "enemies") {
    controller.endTurn();
  }

  const steps = [];
  await controller.runEnemyTurnIfNeeded({
    afterStep: async (step) => steps.push(step.kind),
  });

  assert.ok(steps.length > 0, "AI should emit animation step callbacks");
  assert.ok(steps.includes("move") || steps.includes("attack") || steps.includes("intent"), "AI should expose observable turn phases");
}

async function testAiUsesDashWhenTooFar() {
  const snapshot = createSnapshotFromScenario({
    id: "ai-dash",
    grid: { width: 18, height: 3, blocked: [] },
    actors: [
      {
        id: "hero",
        name: "Hero",
        team: "heroes",
        role: "fighter",
        token: "H",
        hp: 20,
        maxHp: 20,
        ac: 12,
        initiativeBonus: 0,
        speed: 6,
        position: { x: 0, y: 1 },
        saves: {},
        actions: [],
      },
      {
        id: "enemy",
        name: "Enemy",
        team: "enemies",
        role: "swordsman",
        token: "E",
        hp: 20,
        maxHp: 20,
        ac: 12,
        initiativeBonus: 0,
        speed: 6,
        position: { x: 15, y: 1 },
        saves: {},
        actions: [
          {
            id: "blade",
            name: "Blade",
            type: "weapon_attack",
            range: 1,
            attackBonus: 5,
            damage: "1d6",
            damageType: "slashing",
          },
        ],
      },
    ],
  });
  const log = createCombatLog();
  const steps = [];
  const controller = {
    log,
    move: (actorId, pos) => moveActor(snapshot, snapshot.actors.find((actor) => actor.id === actorId), pos, log, { dice: fixedDice() }),
    action: (actorId, actionId, targetId) => resolveAction(snapshot, snapshot.actors.find((actor) => actor.id === actorId), actionId, targetId, fixedDice(), log),
    afterStep: async (step) => steps.push(step.kind),
  };

  await runAiTurn(snapshot, snapshot.actors[1], controller);
  assert.ok(log.events.some((event) => event.type === "dash"), "distant melee AI should dash");
  assert.ok(steps.includes("dash"), "AI dash should be visible as a step");
  assert.equal(log.events.some((event) => event.type === "attack.roll"), false, "AI should not attack after spending its action on Dash");
}

async function testAiDodgesWhenNoAttackAvailable() {
  const snapshot = createSnapshotFromScenario({
    id: "ai-dodge",
    grid: { width: 4, height: 2, blocked: [], cover: [] },
    actors: [
      {
        id: "hero",
        name: "Hero",
        team: "heroes",
        role: "fighter",
        token: "H",
        hp: 20,
        maxHp: 20,
        ac: 12,
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
        hp: 20,
        maxHp: 20,
        ac: 12,
        initiativeBonus: 0,
        speed: 6,
        position: { x: 1, y: 0 },
        saves: {},
        actions: [],
      },
    ],
  });
  const log = createCombatLog();
  const steps = [];
  const controller = {
    log,
    move: (actorId, pos) => moveActor(snapshot, snapshot.actors.find((actor) => actor.id === actorId), pos, log, { dice: fixedDice() }),
    action: (actorId, actionId, targetId) => resolveAction(snapshot, snapshot.actors.find((actor) => actor.id === actorId), actionId, targetId, fixedDice(), log),
    afterStep: async (step) => steps.push(step.kind),
  };

  await runAiTurn(snapshot, snapshot.actors[1], controller);
  assert.equal(hasCondition(snapshot.actors[1], "dodging"), true, "AI with no attack should dodge");
  assert.ok(steps.includes("dodge"), "AI dodge should be visible as a step");
}

async function testArcherChoosesWeakestVisibleTarget() {
  const snapshot = createSnapshotFromScenario({
    id: "ai-target-choice",
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
        position: { x: 0, y: 0 },
        saves: {},
        actions: [],
      },
      {
        id: "wizard",
        name: "Wizard",
        team: "heroes",
        role: "wizard",
        token: "W",
        hp: 5,
        maxHp: 20,
        ac: 12,
        initiativeBonus: 0,
        speed: 6,
        position: { x: 0, y: 2 },
        saves: {},
        actions: [],
      },
      {
        id: "archer",
        name: "Archer",
        team: "enemies",
        role: "archer",
        token: "A",
        hp: 20,
        maxHp: 20,
        ac: 12,
        initiativeBonus: 0,
        speed: 6,
        position: { x: 5, y: 1 },
        saves: {},
        actions: [
          {
            id: "shortbow",
            name: "Shortbow",
            type: "weapon_attack",
            range: 12,
            attackBonus: 4,
            damage: "1d6",
            damageType: "piercing",
          },
        ],
      },
    ],
  });
  const log = createCombatLog();
  const controller = {
    log,
    move: (actorId, pos) => moveActor(snapshot, snapshot.actors.find((actor) => actor.id === actorId), pos, log, { dice: fixedDice() }),
    action: (actorId, actionId, targetId) => resolveAction(snapshot, snapshot.actors.find((actor) => actor.id === actorId), actionId, targetId, fixedDice(), log),
    afterStep: async () => {},
  };

  await runAiTurn(snapshot, snapshot.actors[2], controller);
  assert.ok(
    log.events.some((event) => event.type === "attack.roll" && event.detail.actorId === "archer" && event.detail.targetId === "wizard"),
    "archer should choose the weakest visible target"
  );
}

async function testAiProfileCanPreferNearestTarget() {
  const snapshot = createSnapshotFromScenario({
    id: "ai-target-profile",
    grid: { width: 8, height: 3, blocked: [], cover: [] },
    actors: [
      {
        id: "near",
        name: "Near Hero",
        team: "heroes",
        role: "fighter",
        token: "H",
        hp: 20,
        maxHp: 20,
        ac: 12,
        initiativeBonus: 0,
        speed: 6,
        position: { x: 4, y: 1 },
        saves: {},
        actions: [],
      },
      {
        id: "weak",
        name: "Weak Hero",
        team: "heroes",
        role: "wizard",
        token: "W",
        hp: 2,
        maxHp: 20,
        ac: 12,
        initiativeBonus: 0,
        speed: 6,
        position: { x: 0, y: 1 },
        saves: {},
        actions: [],
      },
      {
        id: "archer",
        name: "Archer",
        team: "enemies",
        role: "archer",
        ai: { profile: "archer", targetPriority: "nearest", seekCoverAfterAttack: false },
        token: "A",
        hp: 20,
        maxHp: 20,
        ac: 12,
        initiativeBonus: 0,
        speed: 6,
        position: { x: 7, y: 1 },
        saves: {},
        actions: [
          {
            id: "shortbow",
            name: "Shortbow",
            type: "weapon_attack",
            range: 12,
            attackBonus: 4,
            damage: "1d6",
            damageType: "piercing",
          },
        ],
      },
    ],
  });
  const log = createCombatLog();
  const controller = {
    log,
    move: (actorId, pos) => moveActor(snapshot, snapshot.actors.find((actor) => actor.id === actorId), pos, log, { dice: fixedDice() }),
    action: (actorId, actionId, targetId) => resolveAction(snapshot, snapshot.actors.find((actor) => actor.id === actorId), actionId, targetId, fixedDice(), log),
    afterStep: async () => {},
  };

  await runAiTurn(snapshot, snapshot.actors[2], controller);
  assert.ok(
    log.events.some((event) => event.type === "attack.roll" && event.detail.actorId === "archer" && event.detail.targetId === "near"),
    "AI targetPriority nearest should override default archer weakest-visible targeting"
  );
}

async function testArcherPrioritizesBestCoverInRange() {
  const snapshot = createSnapshotFromScenario({
    id: "archer-cover",
    grid: {
      width: 8,
      height: 4,
      blocked: [],
      cover: [
        { x: 4, y: 0, kind: "half" },
        { x: 3, y: 1, kind: "three_quarters" },
      ],
    },
    actors: [
      {
        id: "hero",
        name: "Hero",
        team: "heroes",
        role: "fighter",
        token: "H",
        hp: 20,
        maxHp: 20,
        ac: 12,
        initiativeBonus: 0,
        speed: 6,
        position: { x: 0, y: 1 },
        saves: {},
        actions: [],
      },
      {
        id: "archer",
        name: "Archer",
        team: "enemies",
        role: "archer",
        token: "A",
        hp: 20,
        maxHp: 20,
        ac: 12,
        initiativeBonus: 0,
        speed: 6,
        position: { x: 5, y: 1 },
        saves: {},
        actions: [
          {
            id: "shortbow",
            name: "Shortbow",
            type: "weapon_attack",
            range: 12,
            attackBonus: 4,
            damage: "1d6",
            damageType: "piercing",
          },
        ],
      },
    ],
  });
  const log = createCombatLog();
  const controller = {
    log,
    move: (actorId, pos) => moveActor(snapshot, snapshot.actors.find((actor) => actor.id === actorId), pos, log, { dice: fixedDice() }),
    action: (actorId, actionId, targetId) => resolveAction(snapshot, snapshot.actors.find((actor) => actor.id === actorId), actionId, targetId, fixedDice(), log),
    afterStep: async () => {},
  };

  await runAiTurn(snapshot, snapshot.actors[1], controller);
  assert.deepEqual(snapshot.actors[1].position, { x: 4, y: 1 }, "archer should prefer a square protected by adjacent three-quarters cover over half cover while still in range");
  assert.ok(log.events.some((event) => event.type === "cover.move" && event.detail.cover?.kind === "three_quarters"), "best cover move should be logged");
}

async function testAiStopsWhenMovementPathIsBlockedByCombatObject() {
  const snapshot = createSnapshotFromScenario({
    id: "ai-blocked-by-wall",
    grid: { width: 5, height: 1, blocked: [], cover: [] },
    combatObjects: [
      {
        id: "wall",
        name: "Wall",
        position: { x: 2, y: 0 },
        cells: [{ x: 2, y: 0 }],
        blocksMovement: true,
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
        ac: 12,
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
        hp: 20,
        maxHp: 20,
        ac: 12,
        initiativeBonus: 0,
        speed: 6,
        position: { x: 4, y: 0 },
        saves: {},
        actions: [
          {
            id: "blade",
            name: "Blade",
            type: "weapon_attack",
            range: 1,
            attackBonus: 5,
            damage: "1d6",
            damageType: "slashing",
          },
        ],
      },
    ],
  });
  const log = createCombatLog();
  const steps = [];
  const controller = {
    log,
    move: (actorId, pos) => moveActor(snapshot, snapshot.actors.find((actor) => actor.id === actorId), pos, log, { dice: fixedDice() }),
    action: (actorId, actionId, targetId) => resolveAction(snapshot, snapshot.actors.find((actor) => actor.id === actorId), actionId, targetId, fixedDice(), log),
    afterStep: async (step) => steps.push(step.kind),
  };

  await runAiTurn(snapshot, snapshot.actors[1], controller);
  assert.deepEqual(snapshot.actors[1].position, { x: 3, y: 0 }, "AI should stop adjacent to the blocked path instead of looping");
  assert.ok(
    log.events.some((event) => event.type === "ai.intent" && event.detail.intent === "movement path blocked; stopping movement"),
    "blocked movement should be logged as an AI intent"
  );
  assert.ok(steps.includes("intent"), "AI should emit an observable blocked-path step");
}

async function testFightDataCanPrioritizeSpecificEnemyActions() {
  const snapshot = createSnapshotFromScenario({
    id: "ai-action-priority",
    grid: { width: 3, height: 1, blocked: [], cover: [] },
    actors: [
      {
        id: "hero", name: "Hero", team: "heroes", role: "fighter", token: "H",
        hp: 20, maxHp: 20, ac: 12, speed: 6, position: { x: 0, y: 0 }, saves: {}, actions: [],
      },
      {
        id: "enemy", name: "Enemy", team: "enemies", role: "swordsman", token: "E",
        hp: 20, maxHp: 20, ac: 12, speed: 6, position: { x: 1, y: 0 }, saves: {},
        ai: { profile: "melee", actionPriority: ["fight_specific_strike", "basic_strike"] },
        actions: [
          { id: "basic_strike", name: "Basic Strike", type: "weapon_attack", range: 1, attackBonus: 5, damage: "1d6", damageType: "slashing" },
          { id: "fight_specific_strike", name: "Fight-specific Strike", type: "weapon_attack", range: 1, attackBonus: 5, damage: "1d8", damageType: "force" },
        ],
      },
    ],
  });
  const log = createCombatLog();
  const controller = {
    log,
    move: (actorId, pos) => moveActor(snapshot, snapshot.actors.find((actor) => actor.id === actorId), pos, log, { dice: fixedDice() }),
    action: (actorId, actionId, targetId) => resolveAction(snapshot, snapshot.actors.find((actor) => actor.id === actorId), actionId, targetId, fixedDice(), log),
    afterStep: async () => {},
  };

  await runAiTurn(snapshot, snapshot.actors[1], controller);
  assert.ok(
    log.events.some((event) => event.type === "attack.roll" && event.detail.actionId === "fight_specific_strike"),
    "fight data should be able to prioritize a specific legal action without replacing the general AI",
  );
}


export async function runAiCombatTests() {
  testEnemyDataAiProfilesAreRegistered();
  await testAiStepEvents();
  await testAiUsesDashWhenTooFar();
  await testAiDodgesWhenNoAttackAvailable();
  await testArcherChoosesWeakestVisibleTarget();
  await testAiProfileCanPreferNearestTarget();
  await testArcherPrioritizesBestCoverInRange();
  await testAiStopsWhenMovementPathIsBlockedByCombatObject();
  await testFightDataCanPrioritizeSpecificEnemyActions();
}

function testEnemyDataAiProfilesAreRegistered() {
  for (const enemy of Object.values(enemies)) {
    assert.equal(AI_PROFILE_IDS.includes(enemy.aiProfile), true, `${enemy.id} should use a registered AI profile`);
    assert.ok(getAiProfile({ ai: { profile: enemy.aiProfile } }).style, `${enemy.id} AI profile should resolve to behavior`);
  }
}
