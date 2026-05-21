import { createCombatLog, summarizeCombat } from "./combatLog.js";
import { resolveActionResult } from "./actionResult.js";
import { createDiceRoller } from "./diceAdapter.js";
import { createCombatScenario, createSnapshotFromScenario, DEFAULT_COMBAT_SCENARIO_ID } from "./scenario.js";
import { currentActor, endTurnEffects, getActor, moveActor, startTurn } from "./resolver.js";
import { runAiTurn } from "./ai.js";
import { checkOutcome } from "./combatState.js";
import { rollInitiativeOrder } from "./initiative.js";
import { isPendingReactionPrompt } from "./reactions.js";

export function createCombatController({ scenarioId = DEFAULT_COMBAT_SCENARIO_ID } = {}) {
  const log = createCombatLog();
  const dice = createDiceRoller({ deterministic: true, seed: "combat-test-001" });
  let currentScenarioId = scenarioId;
  let initialSnapshot = null;
  let snapshot = null;
  let pendingReaction = null;

  function reset() {
    const scenario = createCombatScenario(currentScenarioId);
    log.clear();
    dice.setDeterministic(dice.deterministic, scenario.metadata?.diceSeed || dice.seed);
    snapshot = createSnapshotFromScenario(scenario);
    pendingReaction = null;
    rollInitiative();
    initialSnapshot = cloneSnapshot(snapshot);
    log.add("reset");
    log.add("combat.start", { round: snapshot.round, seeded: dice.deterministic });
    const actor = currentActor(snapshot);
    if (actor) startTurn(snapshot, actor, log, dice);
    return snapshot;
  }

  function setScenario(nextScenarioId) {
    currentScenarioId = nextScenarioId || DEFAULT_COMBAT_SCENARIO_ID;
    return reset();
  }

  function rollInitiative() {
    rollInitiativeOrder(snapshot, dice, log);
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
    const baseSnapshot = cloneSnapshot(snapshot);
    const diceState = dice.getState?.();
    let resolved;
    try {
      resolved = resolveActionResult(snapshot, actor, actionId, targetId, dice, log);
    } catch (error) {
      if (!isPendingReactionPrompt(error)) throw error;
      snapshot = cloneSnapshot(baseSnapshot);
      pendingReaction = {
        prompt: error.prompt,
        actorId,
        actionId,
        targetId,
        baseSnapshot,
        diceState,
      };
      snapshot.pendingReaction = error.prompt;
      return {
        ok: false,
        code: "reaction_pending",
        reason: "reaction decision pending",
        pendingReaction: error.prompt,
      };
    }
    advanceIfCurrentActorDefeated(actor);
    return resolved;
  }

  function answerReaction(useReaction) {
    if (!pendingReaction) return { ok: false, code: "no_pending_reaction", reason: "no reaction is pending" };
    const pending = pendingReaction;
    pendingReaction = null;
    snapshot = cloneSnapshot(pending.baseSnapshot);
    snapshot.reactionDecisions = {
      [`${pending.prompt.actorId}:${pending.prompt.id}`]: useReaction === true,
    };
    snapshot.suppressReactionPromptLog = true;
    dice.setState?.(pending.diceState);
    const actor = getActor(snapshot, pending.actorId);
    const resolved = resolveActionResult(snapshot, actor, pending.actionId, pending.targetId, dice, log);
    delete snapshot.reactionDecisions;
    delete snapshot.suppressReactionPromptLog;
    delete snapshot.pendingReaction;
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
    if (!actor || actor.team !== "enemies" || snapshot.outcome || pendingReaction) return false;
    await runAiTurn(snapshot, actor, { ...api, afterStep: options.afterStep });
    if (pendingReaction) return true;
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
    get pendingReaction() {
      return pendingReaction?.prompt || snapshot?.pendingReaction || null;
    },
    reset,
    setScenario,
    toggleDeterministic,
    move,
    action,
    actionResult,
    answerReaction,
    endTurn,
    runEnemyTurnIfNeeded,
    summary,
  };

  reset();
  return api;
}
