import { createCombatLog, summarizeCombat } from "./combatLog.js";
import { resolveActionResult } from "./actionResult.js";
import { createDiceRoller } from "./diceAdapter.js";
import { createCombatScenario, createSnapshotFromScenario } from "./scenario.js";
import { currentActor, endTurnEffects, getActor, moveActor, startTurn } from "./resolver.js";
import { runAiTurn } from "./ai.js";
import { checkOutcome } from "./combatState.js";

export function createCombatController({ scenarioId = "trial-arena" } = {}) {
  const log = createCombatLog();
  const dice = createDiceRoller({ deterministic: true, seed: "combat-test-001" });
  let currentScenarioId = scenarioId;
  let initialSnapshot = null;
  let snapshot = null;

  function reset() {
    const scenario = createCombatScenario(currentScenarioId);
    log.clear();
    dice.setDeterministic(dice.deterministic, dice.seed);
    snapshot = createSnapshotFromScenario(scenario);
    rollInitiative();
    initialSnapshot = cloneSnapshot(snapshot);
    log.add("reset");
    log.add("combat.start", { round: snapshot.round, seeded: dice.deterministic });
    const actor = currentActor(snapshot);
    if (actor) startTurn(snapshot, actor, log, dice);
    return snapshot;
  }

  function setScenario(nextScenarioId) {
    currentScenarioId = nextScenarioId || "trial-arena";
    return reset();
  }

  function rollInitiative() {
    const rolls = snapshot.actors.map((actor) => {
      const roll = dice.rollD20({ type: "initiative", label: actor.name });
      return {
        actorId: actor.id,
        actorName: actor.name,
        total: roll.roll + actor.initiativeBonus,
        roll: roll.roll,
        bonus: actor.initiativeBonus,
      };
    });
    rolls.sort((a, b) => b.total - a.total);
    snapshot.initiative = rolls.map((item) => item.actorId);
    log.add("initiative.roll", {
      round: snapshot.round,
      rolls,
      order: rolls.map((item) => item.actorName),
    });
  }

  function toggleDeterministic() {
    dice.setDeterministic(!dice.deterministic);
    log.add("dice.mode", {
      seeded: dice.deterministic,
      seed: dice.seed,
    });
  }

  function move(actorId, to) {
    const actor = getActor(snapshot, actorId);
    const resolved = moveActor(snapshot, actor, to, log, { dice });
    advanceIfCurrentActorDefeated(actor);
    return resolved;
  }

  function action(actorId, actionId, targetId) {
    return actionResult(actorId, actionId, targetId).ok;
  }

  function actionResult(actorId, actionId, targetId) {
    const actor = getActor(snapshot, actorId);
    const resolved = resolveActionResult(snapshot, actor, actionId, targetId, dice, log);
    advanceIfCurrentActorDefeated(actor);
    return resolved;
  }

  function endTurn() {
    finishTurn({ skipEndEffects: false });
  }

  function finishTurn({ skipEndEffects = false, reason = null } = {}) {
    const actor = currentActor(snapshot);
    if (actor && !snapshot.outcome && !skipEndEffects) endTurnEffects(snapshot, actor, dice, log);
    if (actor) log.add("turn.end", { round: snapshot.round, actorId: actor.id, actorName: actor.name, reason });
    if (snapshot.outcome) return;

    const next = advanceToNextLivingActor();
    if (next) startTurn(snapshot, next, log, dice);
  }

  function advanceIfCurrentActorDefeated(actor) {
    if (!actor || actor.hp > 0 || snapshot.outcome) return;
    if (currentActor(snapshot)?.id !== actor.id) return;
    checkOutcome(snapshot, log);
    if (snapshot.outcome) return;
    finishTurn({
      skipEndEffects: true,
      reason: "current actor was defeated",
    });
  }

  function advanceToNextLivingActor() {
    for (let attempts = 0; attempts < snapshot.initiative.length; attempts += 1) {
      snapshot.turnIndex += 1;
      if (snapshot.turnIndex >= snapshot.initiative.length) {
        snapshot.turnIndex = 0;
        snapshot.round += 1;
        log.add("round.start", { round: snapshot.round });
      }
      const actor = currentActor(snapshot);
      if (actor?.hp > 0) return actor;
    }
    checkOutcome(snapshot, log);
    return null;
  }

  async function runEnemyTurnIfNeeded(options = {}) {
    const actor = currentActor(snapshot);
    if (!actor || actor.team !== "enemies" || snapshot.outcome) return false;
    await runAiTurn(snapshot, actor, { ...api, afterStep: options.afterStep });
    endTurn();
    if (typeof options.afterStep === "function") await options.afterStep({ kind: "turn.end", actorId: actor.id });
    return true;
  }

  function summary() {
    return summarizeCombat(log.events, snapshot.actors);
  }

  function cloneSnapshot(source) {
    return {
      ...structuredClone({
        ...source,
        grid: {
          ...source.grid,
          blocked: Array.from(source.grid.blocked),
          cover: Array.from(source.grid.cover || []),
        },
      }),
      grid: {
        ...source.grid,
        blocked: new Set(source.grid.blocked),
        cover: new Map(source.grid.cover || []),
      },
    };
  }

  const api = {
    log,
    get snapshot() {
      return snapshot;
    },
    get initialSnapshot() {
      return initialSnapshot;
    },
    get dice() {
      return dice;
    },
    get scenarioId() {
      return currentScenarioId;
    },
    reset,
    setScenario,
    toggleDeterministic,
    move,
    action,
    actionResult,
    endTurn,
    runEnemyTurnIfNeeded,
    summary,
  };

  reset();
  return api;
}
