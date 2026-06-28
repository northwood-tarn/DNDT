import {
  assert,
  createCombatLog,
  createSnapshotFromScenario,
  endTurnEffects,
  moveActor,
  resolveAction,
  resolveCharacterSheet,
  resolvedSheetToCombatActor,
  runAiTurn,
  scriptedDice,
  startTurn,
  validateCombatActor,
} from "./helpers.js";
import { createSpellAction } from "../../app/combat/actionFactory.js";
import { createEncounterCombatScenario } from "../../app/combat/scenario.js";
import { SPELLS } from "../../app/data/spells.js";
import { buildSpecs, draftFor } from "./build_matrix_smoke.test.js";

const FULL_SMOKE_LEVELS = Array.from({ length: 13 }, (_, index) => index + 1);
const FULL_SMOKE_ROUNDS = 5;

export async function runFullEncounterSmokeTests() {
  for (const spec of buildSpecs(FULL_SMOKE_LEVELS)) {
    await runFullEncounterSmoke(spec);
  }
}

async function runFullEncounterSmoke(spec) {
  const sheet = resolveCharacterSheet(draftFor(spec), {}, { allowNonCreationLevel: true });
  assert.deepEqual(sheet.metadata.unresolved, [], `${spec.label}: unresolved character choices`);
  const pc = resolvedSheetToCombatActor(sheet, { id: "generated_pc", position: { x: 1, y: 2 } });
  assert.deepEqual(validateCombatActor({ ...pc, economy: {} }), [], `${spec.label}: invalid generated PC`);

  const encounterId = encounterForLevel(spec.level);
  const scenario = createEncounterCombatScenario(encounterId, {
    heroes: [pc, ...companionActors(spec.level)],
  });
  const snapshot = createSnapshotFromScenario(scenario);
  const log = createCombatLog();

  for (let round = 1; round <= FULL_SMOKE_ROUNDS; round += 1) {
    snapshot.round = round;
    for (const actor of livingActors(snapshot)) {
      const beforeEvents = log.events.length;
      const dice = scriptedDice({ d20: Array(100).fill(actor.team === "heroes" ? 14 : 11), damage: actor.team === "heroes" ? 4 : 3 });
      startTurn(snapshot, actor, log, dice);
      await runAiTurn(snapshot, actor, aiController(snapshot, log, dice));
      endTurnEffects(snapshot, actor, dice, log);
      assert.ok(
        log.events.length > beforeEvents || actor.hp <= 0 || snapshot.outcome,
        `${spec.label} in ${encounterId}: ${actor.id} made no progress in round ${round}`,
      );
      if (snapshot.outcome) return;
    }
  }

  assert.ok(
    log.events.some((event) => event.type === "attack.roll" || event.type === "save.roll"),
    `${spec.label} in ${encounterId}: full encounter should resolve attacks or saves`,
  );
}

function encounterForLevel(level) {
  if (level <= 2) return "combat_full_smoke_low";
  if (level <= 5) return "combat_full_smoke_mid";
  if (level <= 9) return "combat_full_smoke_high";
  return "combat_full_smoke_elite";
}

function companionActors(level) {
  return [
    companion({
      id: "npc_guard",
      name: "NPC Guard",
      role: "melee",
      position: { x: 1, y: 3 },
      hp: 18 + level * 2,
      maxHp: 18 + level * 2,
      attackBonus: 4 + Math.floor(level / 4),
      actions: [weaponAttack("guard_blade", "Guard Blade", 4 + Math.floor(level / 4), "1d8+2", "slashing")],
    }),
    companion({
      id: "npc_adept",
      name: "NPC Adept",
      role: "archer",
      position: { x: 1, y: 4 },
      hp: 14 + level,
      maxHp: 14 + level,
      actions: [createSpellAction(SPELLS.sacred_flame, { spellSaveDC: 12 + Math.floor(level / 4), casterLevel: level })],
    }),
  ];
}

function companion(overrides = {}) {
  return {
    id: "npc",
    name: "NPC",
    team: "heroes",
    role: "melee",
    token: "N",
    hp: 20,
    maxHp: 20,
    ac: 14,
    speed: 6,
    position: { x: 1, y: 1 },
    saves: { str: 1, dex: 1, con: 1, int: 0, wis: 1, cha: 0 },
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
