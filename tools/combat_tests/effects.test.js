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

function testRestrainedConditionRules() {
  const snapshot = makeHarnessSnapshot();
  const hero = snapshot.actors[0];
  const enemy = snapshot.actors[1];
  const log = createCombatLog();
  hero.position = { x: 0, y: 0 };
  enemy.position = { x: 1, y: 0 };
  hero.actions.push({
    id: "bind",
    name: "Bind",
    type: "spell_save",
    range: 10,
    saveAbility: "wis",
    spellSaveDC: 13,
    damage: "1d4",
    damageType: "force",
    concentration: true,
    effects: [
      {
        type: "condition",
        trigger: "failed_save",
        condition: "restrained",
      },
    ],
  });

  assert.equal(resolveAction(snapshot, hero, "bind", "enemy", scriptedDice({ d20: [1], damage: 1 }), log), true);
  assert.equal(hasCondition(enemy, "restrained"), true, "failed bind save should apply restrained");
  assert.equal(getMovementRemaining(enemy), 0, "restrained speed should be 0");
  assert.equal(moveActor(snapshot, enemy, { x: 1, y: 1 }, log, { dice: fixedDice() }), false, "restrained actor should not move");

  enemy.economy.actionAvailable = true;
  assert.equal(resolveAction(snapshot, enemy, "blade", "hero", scriptedDice({ d20: [18, 3], damage: 1 }), log), true);
  assert.ok(
    log.events.some((event) => event.type === "attack.roll" && event.detail.actorId === "enemy" && event.detail.mode === "disadvantage" && event.detail.roll === 3),
    "restrained actor should attack with disadvantage"
  );

  hero.economy.actionAvailable = true;
  assert.equal(resolveAction(snapshot, hero, "bow", "enemy", scriptedDice({ d20: [4, 16], damage: 1 }), log), true);
  assert.ok(
    log.events.some((event) => event.type === "attack.roll" && event.detail.actorId === "hero" && event.detail.mode === "advantage" && event.detail.roll === 16),
    "attacks against restrained targets should have advantage"
  );

  hero.economy.actionAvailable = true;
  enemy.hp = enemy.maxHp;
  assert.equal(resolveAction(snapshot, hero, "dex_blast", "enemy", scriptedDice({ d20: [18, 2], damage: 1 }), log), true);
  assert.ok(
    log.events.some((event) => event.type === "save.roll" && event.detail.spellName === "Dex Blast" && event.detail.mode === "disadvantage" && event.detail.roll === 2),
    "restrained targets should make DEX saves with disadvantage"
  );
}

function testRestrainingFixtureIsBonusAction() {
  const snapshot = createSnapshotFromScenario({
    id: "binding-hex-cost",
    grid: { width: 4, height: 2, blocked: [], cover: [] },
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
        position: { x: 0, y: 0 },
        saves: {},
        actions: [
          {
            id: "restraining_fixture",
            name: "Restraining Fixture",
            type: "spell_save",
            cost: "bonus",
            range: 8,
            saveAbility: "wis",
            spellSaveDC: 13,
            damage: "1d4",
            damageType: "force",
            concentration: true,
            effects: [
              {
                type: "condition",
                trigger: "failed_save",
                condition: "restrained",
                repeatSave: {
                  timing: "turn_end",
                  ability: "wis",
                  dc: 13,
                  removeOnSuccess: true,
                },
              },
            ],
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
        position: { x: 1, y: 0 },
        saves: { wis: 0 },
        actions: [],
      },
    ],
  });
  const log = createCombatLog();
  const wizard = snapshot.actors[0];
  const enemy = snapshot.actors[1];

  assert.equal(resolveAction(snapshot, wizard, "restraining_fixture", "enemy", scriptedDice({ d20: [1], damage: 1 }), log), true, "Restraining Fixture should resolve as a bonus-action spell");
  assert.equal(wizard.economy.actionAvailable, true, "Restraining Fixture should not spend the action");
  assert.equal(wizard.economy.bonusActionAvailable, false, "Restraining Fixture should spend the bonus action");
  assert.equal(hasCondition(enemy, "restrained"), true, "Restraining Fixture should apply restrained on failed save");
}

function testRestrainingFixtureEndTurnRepeatSave() {
  const snapshot = createSnapshotFromScenario({
    id: "binding-hex-repeat-save",
    grid: { width: 4, height: 2, blocked: [], cover: [] },
    actors: [
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
        position: { x: 1, y: 0 },
        saves: { wis: 1 },
        conditions: [
          {
            id: "restrained",
            label: "Restrained",
            repeatSave: {
              timing: "turn_end",
              ability: "wis",
              dc: 13,
              removeOnSuccess: true,
            },
          },
        ],
        actions: [],
      },
    ],
  });
  const enemy = snapshot.actors[0];
  const log = createCombatLog();

  endTurnEffects(snapshot, enemy, scriptedDice({ d20: [8] }), log);
  assert.equal(hasCondition(enemy, "restrained"), true, "failed end-of-turn save should keep restrained");
  assert.ok(log.events.some((event) => event.type === "condition.save.roll" && event.detail.roll === 8), "end-of-turn save roll should be logged");
  assert.ok(log.events.some((event) => event.type === "condition.save.result" && event.detail.success === false), "failed end-of-turn save result should be logged");

  endTurnEffects(snapshot, enemy, scriptedDice({ d20: [12] }), log);
  assert.equal(hasCondition(enemy, "restrained"), false, "successful end-of-turn save should remove restrained");
  assert.ok(log.events.some((event) => event.type === "condition.save.result" && event.detail.success === true), "successful end-of-turn save result should be logged");
  assert.ok(log.events.some((event) => event.type === "condition.removed" && event.detail.reason === "successful end-of-turn save"), "successful save should log condition removal");
}

function testConcentrationBreaksLinkedConditionOnFailedSave() {
  const snapshot = createSnapshotFromScenario({
    id: "concentration-break",
    grid: { width: 4, height: 2, blocked: [], cover: [] },
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
        position: { x: 0, y: 0 },
        saves: { con: 0 },
        actions: [
          {
            id: "restraining_fixture",
            name: "Restraining Fixture",
            type: "spell_save",
            cost: "bonus",
            range: 8,
            saveAbility: "wis",
            spellSaveDC: 13,
            damage: "1d4",
            damageType: "force",
            concentration: true,
            effects: [
              {
                type: "condition",
                trigger: "failed_save",
                condition: "restrained",
              },
            ],
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
        position: { x: 1, y: 0 },
        saves: { wis: 0 },
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
  const wizard = snapshot.actors[0];
  const enemy = snapshot.actors[1];

  assert.equal(resolveAction(snapshot, wizard, "restraining_fixture", "enemy", scriptedDice({ d20: [1], damage: 1 }), log), true);
  assert.equal(wizard.concentration?.actionId, "restraining_fixture", "Restraining Fixture should start concentration");
  assert.equal(hasCondition(enemy, "restrained"), true, "Restraining Fixture should restrain the target");

  enemy.economy.actionAvailable = true;
  assert.equal(resolveAction(snapshot, enemy, "blade", "wizard", scriptedDice({ d20: [20, 20, 1], damage: 4 }), log), true);
  assert.equal(wizard.concentration, null, "failed concentration save should clear concentration");
  assert.equal(hasCondition(enemy, "restrained"), false, "failed concentration save should remove linked restrained effect");
  assert.ok(log.events.some((event) => event.type === "concentration.save.result" && event.detail.success === false), "failed concentration save should be logged");
}

function testConcentrationSurvivesSuccessfulSave() {
  const snapshot = createSnapshotFromScenario({
    id: "concentration-success",
    grid: { width: 4, height: 2, blocked: [], cover: [] },
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
        position: { x: 0, y: 0 },
        saves: { con: 3 },
        actions: [
          {
            id: "restraining_fixture",
            name: "Restraining Fixture",
            type: "spell_save",
            cost: "bonus",
            range: 8,
            saveAbility: "wis",
            spellSaveDC: 13,
            damage: "1d4",
            damageType: "force",
            concentration: true,
            effects: [
              {
                type: "condition",
                trigger: "failed_save",
                condition: "restrained",
              },
            ],
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
        position: { x: 1, y: 0 },
        saves: { wis: 0 },
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
  const wizard = snapshot.actors[0];
  const enemy = snapshot.actors[1];

  assert.equal(resolveAction(snapshot, wizard, "restraining_fixture", "enemy", scriptedDice({ d20: [1], damage: 1 }), log), true);
  enemy.economy.actionAvailable = true;
  assert.equal(resolveAction(snapshot, enemy, "blade", "wizard", scriptedDice({ d20: [20, 20, 12], damage: 4 }), log), true);
  assert.equal(wizard.concentration?.actionId, "restraining_fixture", "successful concentration save should maintain concentration");
  assert.equal(hasCondition(enemy, "restrained"), true, "successful concentration save should keep linked condition");
  assert.ok(log.events.some((event) => event.type === "concentration.save.result" && event.detail.success === true), "successful concentration save should be logged");
}


export async function runEffectCombatTests() {
  testRestrainedConditionRules();
  testRestrainingFixtureIsBonusAction();
  testRestrainingFixtureEndTurnRepeatSave();
  testConcentrationBreaksLinkedConditionOnFailedSave();
  testConcentrationSurvivesSuccessfulSave();
}
