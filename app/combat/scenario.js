import { normalizeCombatActor, validateCombatActor } from "./actor.js";
import { normalizeCombatObjects } from "./combatObjects.js";
import { createGeneratedCharacterArenaScenario } from "./scenarios/generatedCharacterArena.js";

export { createGeneratedCharacterArenaScenario } from "./scenarios/generatedCharacterArena.js";

export const DEFAULT_COMBAT_SCENARIO_ID = "generated-character-arena";

export function getCombatScenarioOptions() {
  return [
    { id: "generated-character-arena", name: "Generated Character Arena" },
    { id: "generated-wizard-shield-arena", name: "Generated Wizard Shield Arena" },
  ];
}

export function createCombatScenario(id = DEFAULT_COMBAT_SCENARIO_ID, options = {}) {
  if (id === "generated-character-arena") return createGeneratedCharacterArenaScenario(options);
  if (id === "generated-wizard-shield-arena") return createGeneratedCharacterArenaScenario({ ...options, variantId: "wizard", enemyAttackBonus: 4, enemyPosition: { x: 3, y: 1 }, diceSeed: "shield-2" });
  throw new Error(`Unknown combat scenario: ${id}`);
}

export function createSnapshotFromScenario(scenario) {
  const actors = scenario.actors.map((actor) => normalizeCombatActor(structuredClone(actor)));
  const actorErrors = actors.flatMap((actor) => {
    const errors = validateCombatActor(actor);
    return errors.map((error) => `${actor.id || "(unknown)"}: ${error}`);
  });
  if (actorErrors.length) {
    throw new Error(`Invalid CombatActor records:\n${actorErrors.join("\n")}`);
  }

  return {
    id: scenario.id,
    round: 1,
    turnIndex: 0,
    outcome: null,
    grid: {
      width: scenario.grid.width,
      height: scenario.grid.height,
      blocked: new Set(scenario.grid.blocked.map((pos) => `${pos.x},${pos.y}`)),
      cover: new Map((scenario.grid.cover || []).map((pos) => [`${pos.x},${pos.y}`, pos.kind])),
    },
    actors,
    combatObjects: normalizeCombatObjects(scenario.combatObjects),
    initiative: [],
  };
}
