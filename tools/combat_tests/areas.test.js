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

function testFootprintRules() {
  const grid = { width: 10, height: 10, blocked: new Set(), cover: new Map() };
  assert.deepEqual(lineDirection({ x: 2, y: 2 }, { x: 9, y: 2 }), { x: 1, y: 0 }, "line direction should quantize to east");
  assert.deepEqual(lineFootprint(grid, { x: 2, y: 2 }, { x: 9, y: 2 }, 3), [
    { x: 3, y: 2 },
    { x: 4, y: 2 },
    { x: 5, y: 2 },
  ], "line footprint should project from origin through aim");
  assert.equal(radiusFootprint(grid, { x: 4, y: 4 }, 2).length, 13, "radius 2 footprint should include center plus circular neighbors");
  assert.equal(cubeFootprint(grid, { x: 4, y: 4 }, 6).length, 36, "cube 6 footprint should cover 36 squares when unclipped");
  assert.ok(coneFootprint(grid, { x: 2, y: 2 }, { x: 7, y: 2 }, 3).some((cell) => cell.x === 5 && cell.y === 4), "cone should widen as it extends");
  assert.equal(coneFootprint(grid, { x: 2, y: 2 }, { x: 2, y: 2 }, 3).length, 0, "cone with no direction should have no footprint");

  const actors = [
    { id: "a", name: "A", hp: 1, position: { x: 4, y: 4 } },
    { id: "b", name: "B", hp: 0, position: { x: 5, y: 4 } },
    { id: "c", name: "C", hp: 1, position: { x: 9, y: 9 } },
  ];
  assert.deepEqual(actorsInFootprint(actors, radiusFootprint(grid, { x: 4, y: 4 }, 2)).map((actor) => actor.id), ["a"], "footprint actor lookup should return living actors only");
}

function testRadiusFireAreaSave() {
  const snapshot = createSnapshotFromScenario({
    id: "radius-fire-area-save",
    grid: { width: 8, height: 4, blocked: [], cover: [] },
    actors: [
      {
        id: "wizard",
        name: "Wizard",
        team: "heroes",
        role: "wizard",
        token: "W",
        hp: 20,
        maxHp: 20,
        ac: 12,
        initiativeBonus: 0,
        speed: 6,
        position: { x: 0, y: 1 },
        saves: { dex: 0 },
        actions: [
          {
            id: "radius_area_fixture",
            name: "Radius Area Fixture",
            type: "spell_area_save",
            requiresTarget: true,
            saveAbility: "dex",
            spellSaveDC: 15,
            damage: "1d6",
            damageType: "fire",
            targeting: { shape: "radius", radiusSquares: 2, radiusFt: 10 },
          },
        ],
      },
      {
        id: "enemy_a",
        name: "Enemy A",
        team: "enemies",
        role: "swordsman",
        token: "A",
        hp: 10,
        maxHp: 10,
        ac: 12,
        initiativeBonus: 0,
        speed: 6,
        position: { x: 3, y: 1 },
        saves: { dex: 0 },
        actions: [],
      },
      {
        id: "enemy_b",
        name: "Enemy B",
        team: "enemies",
        role: "swordsman",
        token: "B",
        hp: 10,
        maxHp: 10,
        ac: 12,
        initiativeBonus: 0,
        speed: 6,
        position: { x: 4, y: 1 },
        saves: { dex: 0 },
        actions: [],
      },
    ],
  });
  const wizard = snapshot.actors[0];
  const enemyA = snapshot.actors[1];
  const enemyB = snapshot.actors[2];
  const log = createCombatLog();

  assert.equal(
    resolveAction(snapshot, wizard, "radius_area_fixture", { anchor: { x: 3, y: 1 } }, scriptedDice({ d20: [1, 20], damage: 6 }), log),
    true,
    "radius fire should resolve from an area anchor"
  );
  assert.equal(enemyA.hp, 4, "failed save should take full damage");
  assert.equal(enemyB.hp, 7, "successful save should take half damage rounded down");
  assert.equal(wizard.economy.actionAvailable, false, "area spell should spend action");
  assert.ok(log.events.some((event) => event.type === "area.target" && event.detail.targets.length === 2), "area spell should log affected targets");
  assert.ok(log.events.some((event) => event.type === "damage.applied" && event.detail.targetId === "enemy_a" && event.detail.amount === 6), "full damage should be logged");
  assert.ok(log.events.some((event) => event.type === "damage.applied" && event.detail.targetId === "enemy_b" && event.detail.amount === 3), "half damage should be logged");
}

function testOtherAreaFireShapes() {
  const snapshot = createSnapshotFromScenario({
    id: "other-area-fire-shapes",
    grid: { width: 12, height: 8, blocked: [], cover: [] },
    actors: [
      {
        id: "wizard",
        name: "Wizard",
        team: "heroes",
        role: "wizard",
        token: "W",
        hp: 20,
        maxHp: 20,
        ac: 12,
        initiativeBonus: 0,
        speed: 6,
        position: { x: 1, y: 3 },
        saves: {},
        actions: [
          {
            id: "line_area_fixture",
            name: "Line Area Fixture",
            type: "spell_area_save",
            requiresTarget: true,
            saveAbility: "dex",
            spellSaveDC: 15,
            damage: "1d6",
            damageType: "fire",
            targeting: { shape: "line", lengthSquares: 6, lengthFt: 30 },
          },
          {
            id: "cone_area_fixture",
            name: "Cone Area Fixture",
            type: "spell_area_save",
            requiresTarget: true,
            saveAbility: "dex",
            spellSaveDC: 15,
            damage: "1d6",
            damageType: "fire",
            targeting: { shape: "cone", lengthSquares: 6, lengthFt: 30 },
          },
          {
            id: "cube_area_fixture",
            name: "Cube Area Fixture",
            type: "spell_area_save",
            requiresTarget: true,
            saveAbility: "dex",
            spellSaveDC: 15,
            damage: "1d6",
            damageType: "fire",
            targeting: { shape: "cube", sizeSquares: 6, sizeFt: 30 },
          },
        ],
      },
      {
        id: "enemy_line",
        name: "Enemy Line",
        team: "enemies",
        role: "swordsman",
        token: "L",
        hp: 10,
        maxHp: 10,
        ac: 12,
        initiativeBonus: 0,
        speed: 6,
        position: { x: 4, y: 3 },
        saves: { dex: 0 },
        actions: [],
      },
      {
        id: "enemy_cone",
        name: "Enemy Cone",
        team: "enemies",
        role: "swordsman",
        token: "C",
        hp: 10,
        maxHp: 10,
        ac: 12,
        initiativeBonus: 0,
        speed: 6,
        position: { x: 4, y: 5 },
        saves: { dex: 0 },
        actions: [],
      },
      {
        id: "enemy_cube",
        name: "Enemy Cube",
        team: "enemies",
        role: "swordsman",
        token: "Q",
        hp: 10,
        maxHp: 10,
        ac: 12,
        initiativeBonus: 0,
        speed: 6,
        position: { x: 8, y: 3 },
        saves: { dex: 0 },
        actions: [],
      },
    ],
  });
  const wizard = snapshot.actors[0];
  const log = createCombatLog();

  assert.equal(resolveAction(snapshot, wizard, "line_area_fixture", { anchor: { x: 8, y: 3 } }, scriptedDice({ d20: [1], damage: 2 }), log), true);
  assert.equal(snapshot.actors.find((actor) => actor.id === "enemy_line").hp, 8, "line fire should hit a target on the line");
  assert.ok(log.events.some((event) => event.type === "area.target" && event.detail.shape === "line"), "line area should log its shape");

  wizard.economy.actionAvailable = true;
  assert.equal(resolveAction(snapshot, wizard, "cone_area_fixture", { anchor: { x: 8, y: 3 } }, scriptedDice({ d20: [1, 1], damage: 2 }), log), true);
  assert.equal(snapshot.actors.find((actor) => actor.id === "enemy_cone").hp, 8, "cone fire should hit a target in the widened cone");
  assert.ok(log.events.some((event) => event.type === "area.target" && event.detail.shape === "cone"), "cone area should log its shape");

  wizard.economy.actionAvailable = true;
  assert.equal(resolveAction(snapshot, wizard, "cube_area_fixture", { anchor: { x: 8, y: 3 } }, scriptedDice({ d20: [1], damage: 2 }), log), true);
  assert.equal(snapshot.actors.find((actor) => actor.id === "enemy_cube").hp, 8, "cube fire should hit a target inside the cube");
  assert.ok(log.events.some((event) => event.type === "area.target" && event.detail.shape === "cube"), "cube area should log its shape");
}


export async function runAreaCombatTests() {
  testFootprintRules();
  testRadiusFireAreaSave();
  testOtherAreaFireShapes();
}
