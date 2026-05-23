import { normalizeCombatActor, validateCombatActor } from "./actor.js";
import { normalizeCombatObjects } from "./combatObjects.js";
import { createGeneratedEncounterArenaScenario } from "./scenarios/generatedEncounterArena.js";
import { createGeneratedCharacterArenaScenario } from "./scenarios/generatedCharacterArena.js";
import { GENERATED_ENCOUNTER_SCENARIOS, getGeneratedEncounterScenarioConfig } from "./scenarios/generatedEncounterScenarioConfigs.js";

export { createGeneratedCharacterArenaScenario } from "./scenarios/generatedCharacterArena.js";
export { createGeneratedEncounterArenaScenario } from "./scenarios/generatedEncounterArena.js";
export { createEncounterCombatScenario, validateEncounterCombatScenario } from "./encounterScenario.js";

export const DEFAULT_COMBAT_SCENARIO_ID = "generated-character-arena";

export function getCombatScenarioOptions() {
  return [
    { id: "generated-character-arena", name: "Generated Character Arena", group: "Generated Character Tests" },
    { id: "generated-wizard-shield-arena", name: "Generated Wizard Shield Arena", group: "Reaction Tests" },
    ...GENERATED_ENCOUNTER_SCENARIOS.map((scenario) => ({ id: scenario.id, name: scenario.name, group: "Encounter Templates" })),
  ];
}

export function createCombatScenario(id = DEFAULT_COMBAT_SCENARIO_ID, options = {}) {
  if (id === "generated-character-arena") return createGeneratedCharacterArenaScenario(options);
  if (id === "generated-wizard-shield-arena") return createGeneratedCharacterArenaScenario({ ...options, variantId: "wizard", enemyAttackBonus: 4, enemyPosition: { x: 3, y: 1 }, diceSeed: "shield-2" });
  if (getGeneratedEncounterScenarioConfig(id)) return createGeneratedEncounterArenaScenario(id, options);
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
    metadata: structuredClone(scenario.metadata || {}),
  };
}
