import { createCombatController } from "./controller.js";
import { getCombatScenarioOptions } from "./scenario.js";
import {
  actionRequiresTarget,
  canPlayerAct,
  canSelectCombatAction,
  getActionById,
  getActionLabel,
  getActorEconomyView,
  getCoverAtSquare,
  getCurrentActor,
  getLivingOccupant,
  getOccupantForDisplay,
  getReachableSquareKeys,
  getReachableSquares,
  getTargetCover,
  getValidTargetKeys,
  getValidTargets,
  hasAnyUsefulOption,
  isValidTarget,
} from "./selectors.js";

export { getCombatScenarioOptions };
export {
  actionRequiresTarget,
  canPlayerAct,
  canSelectCombatAction,
  getActionById,
  getActionLabel,
  getActorEconomyView,
  getCoverAtSquare,
  getCurrentActor,
  getLivingOccupant,
  getOccupantForDisplay,
  getReachableSquareKeys,
  getReachableSquares,
  getTargetCover,
  getValidTargetKeys,
  getValidTargets,
  hasAnyUsefulOption,
  isValidTarget,
};

export function createCombatGame(options = {}) {
  const controller = createCombatController(options);
  return {
    get snapshot() { return controller.snapshot; },
    get initialSnapshot() { return controller.initialSnapshot; },
    get dice() { return controller.dice; },
    get log() { return controller.log; },
    get scenarioId() { return controller.scenarioId; },
    startCombat: controller.reset,
    setScenario: controller.setScenario,
    toggleDeterministic: controller.toggleDeterministic,
    move: controller.move,
    action: controller.action,
    resolveAction: controller.actionResult,
    endTurn: controller.endTurn,
    runEnemyTurnIfNeeded: controller.runEnemyTurnIfNeeded,
    summary: controller.summary,
    query: createQueryApi(controller),
  };
}

function createQueryApi(controller) {
  return {
    currentActor: () => getCurrentActor(controller.snapshot),
    reachableCells: (actorId) => getReachableSquares(controller.snapshot, actorId),
    validTargets: (actorId, actionId) => getValidTargets(controller.snapshot, actorId, actionId),
    actionById: (actorId, actionId) => getActionById(actorById(controller.snapshot, actorId), actionId),
    actionLabel: (actorId, actionId) => getActionLabel(controller.snapshot, actorId, actionId),
    economy: (actorId) => getActorEconomyView(controller.snapshot, actorId),
  };
}

function actorById(snapshot, actorId) {
  return snapshot.actors.find((actor) => actor.id === actorId) || null;
}
