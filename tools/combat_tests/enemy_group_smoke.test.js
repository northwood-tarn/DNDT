import {
  assert,
  createCombatLog,
  createSnapshotFromScenario,
  moveActor,
  resolveAction,
  runAiTurn,
  scriptedDice,
  startTurn,
  endTurnEffects,
} from "./helpers.js";
import { createSpellAction } from "../../app/combat/actionFactory.js";
import { createEncounterCombatScenario } from "../../app/combat/scenario.js";
import { SPELLS } from "../../app/data/spells.js";

const GROUP_ENCOUNTERS = [
  "combat_pc_ability_raiders",
  "combat_pc_ability_crypt",
  "combat_pc_ability_vanguard",
];

export async function runEnemyGroupSmokeTests() {
  testEnemyBorrowedAbilitiesResolve();
  for (const encounterId of GROUP_ENCOUNTERS) {
    await testNpcTeamRunsAgainstEnemyGroup(encounterId);
  }
}

function testEnemyBorrowedAbilitiesResolve() {
  assertEnemyActionResolves("combat_pc_ability_raiders", "raider_cutter", "nimble_escape_dash", null);
  assertEnemyActionResolves("combat_pc_ability_raiders", "raider_hound", "predatory_rush", null);
  assertEnemyActionResolves("combat_pc_ability_crypt", "grave_spark_left", "grave_spark", "generated_pc");
  assertEnemyActionResolves("combat_pc_ability_crypt", "marked_shadow", "shadow_mark", "generated_pc");
  assertEnemyActionResolves("combat_pc_ability_vanguard", "second_wind_knight", "knightly_second_wind", null, (actor) => {
    actor.hp = Math.max(1, actor.hp - 10);
  });
}

async function testNpcTeamRunsAgainstEnemyGroup(encounterId) {
  const scenario = createEncounterCombatScenario(encounterId, { heroes: npcTeam() });
  const snapshot = createSnapshotFromScenario(scenario);
  const log = createCombatLog();

  for (let round = 1; round <= 3; round += 1) {
    snapshot.round = round;
    for (const actor of livingActors(snapshot)) {
      const beforeEvents = log.events.length;
      const dice = scriptedDice({ d20: Array(80).fill(actor.team === "heroes" ? 14 : 11), damage: 3 });
      startTurn(snapshot, actor, log, dice);
      await runAiTurn(snapshot, actor, aiController(snapshot, log, dice));
      endTurnEffects(snapshot, actor, dice, log);
      assert.ok(
        log.events.length > beforeEvents || actor.hp <= 0 || snapshot.outcome,
        `${encounterId}: ${actor.id} produced no combat progress in round ${round}`,
      );
      if (snapshot.outcome) return;
    }
  }

  assert.ok(log.events.some((event) => event.type === "attack.roll" || event.type === "save.roll"), `${encounterId}: group smoke should resolve attacks or saves`);
}

function assertEnemyActionResolves(encounterId, actorId, actionId, targetId, prepare = null) {
  const snapshot = createSnapshotFromScenario(createEncounterCombatScenario(encounterId, { heroes: npcTeam() }));
  const actor = snapshot.actors.find((item) => item.id === actorId);
  const target = targetId ? snapshot.actors.find((item) => item.id === targetId) : null;
  const action = actor?.actions.find((item) => item.id === actionId);
  const log = createCombatLog();
  const dice = scriptedDice({ d20: Array(20).fill(15), damage: 4 });

  assert.ok(action, `${actorId} should expose ${actionId}`);
  if (prepare) prepare(actor);
  startTurn(snapshot, actor, log, dice);
  assert.equal(resolveAction(snapshot, actor, actionId, target?.id || null, dice, log), true, `${actorId}.${actionId} should resolve`);
}

function npcTeam() {
  return [
    npcActor({
      id: "hero_defender",
      name: "NPC Defender",
      role: "melee",
      position: { x: 1, y: 2 },
      actions: [weaponAttack("longsword", "Longsword", 5, "1d8+3", "slashing")],
    }),
    npcActor({
      id: "hero_acolyte",
      name: "NPC Acolyte",
      role: "archer",
      position: { x: 1, y: 3 },
      actions: [createSpellAction(SPELLS.sacred_flame, { spellSaveDC: 13, casterLevel: 5 })],
    }),
    npcActor({
      id: "hero_arcanist",
      name: "NPC Arcanist",
      role: "archer",
      position: { x: 1, y: 4 },
      actions: [createSpellAction(SPELLS.fire_bolt, { attackBonus: 5, casterLevel: 5 })],
    }),
  ];
}

function npcActor(overrides = {}) {
  return {
    id: "npc",
    name: "NPC",
    team: "heroes",
    role: "melee",
    token: "N",
    hp: 24,
    maxHp: 24,
    ac: 14,
    speed: 6,
    position: { x: 1, y: 1 },
    saves: { dex: 1, wis: 1, cha: 0 },
    actions: [],
    ...overrides,
  };
}

function weaponAttack(id, name, attackBonus, damage, damageType) {
  return {
    id,
    name,
    type: "weapon_attack",
    range: 1,
    attackBonus,
    damage,
    damageType,
    tags: { harmful: true, attackRoll: true, weapon: true, melee: true },
  };
}

function livingActors(snapshot) {
  return snapshot.actors.filter((actor) => actor.hp > 0 && !actor.defeated);
}

function aiController(snapshot, log, dice) {
  return {
    log,
    action(actorId, actionId, targetPayload) {
      const actor = snapshot.actors.find((item) => item.id === actorId);
      return resolveAction(snapshot, actor, actionId, targetPayload, dice, log);
    },
    move(actorId, to) {
      const actor = snapshot.actors.find((item) => item.id === actorId);
      return moveActor(snapshot, actor, to, log, { dice });
    },
    async afterStep() {},
  };
}
