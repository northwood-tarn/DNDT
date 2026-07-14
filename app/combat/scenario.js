import { normalizeCombatActor, validateCombatActor } from "./actor.js";
import { combatActorToActorDefinition, combatActorToActorInstance } from "../actors/actorAdapters.js";
import { normalizeCombatObjects } from "./combatObjects.js";
import { createGeneratedEncounterArenaScenario } from "./scenarios/generatedEncounterArena.js";
import { createBacklandsFieldPlateauScenario, createDocksideStageGridScenario, createGeneratedCharacterArenaScenario, createGeneratedEmptyArenaScenario } from "./scenarios/generatedCharacterArena.js";
import { GENERATED_ENCOUNTER_SCENARIOS, getGeneratedEncounterScenarioConfig } from "./scenarios/generatedEncounterScenarioConfigs.js";
import { createTrenchRampLiveScenario } from "./scenarios/trenchRampLiveScenario.js";

export { createGeneratedCharacterArenaScenario } from "./scenarios/generatedCharacterArena.js";
export { createGeneratedEncounterArenaScenario } from "./scenarios/generatedEncounterArena.js";
export { createEncounterCombatScenario, validateEncounterCombatScenario } from "./encounterScenario.js";

export const DEFAULT_COMBAT_SCENARIO_ID = "generated-character-arena";

export function getCombatScenarioOptions() {
  return [
    { id: "generated-empty-arena", name: "Empty Base Arena", group: "Generated Character Tests" },
    { id: "dockside-stage-grid", name: "Dockside Stage Grid", group: "Stage Geometry Tests" },
    { id: "backlands-field-plateau-01", name: "Backlands Field Plateau 01", group: "Stage Geometry Tests" },
    { id: "trench-ramp-live-test", name: "Trench Ramp Live Test", group: "Stage Geometry Tests" },
    { id: "generated-character-arena", name: "Generated Character Arena", group: "Generated Character Tests" },
    { id: "generated-wizard-shield-arena", name: "Generated Wizard Shield Arena", group: "Reaction Tests" },
    ...GENERATED_ENCOUNTER_SCENARIOS.map((scenario) => ({ id: scenario.id, name: scenario.name, group: "Encounter Templates" })),
  ];
}

export function createCombatScenario(id = DEFAULT_COMBAT_SCENARIO_ID, options = {}) {
  if (id === "generated-empty-arena") return createGeneratedEmptyArenaScenario(options);
  if (id === "dockside-stage-grid") return createDocksideStageGridScenario(options);
  if (id === "backlands-field-plateau-01") return createBacklandsFieldPlateauScenario(options);
  if (id === "trench-ramp-live-test") return createTrenchRampLiveScenario(options);
  if (id === "generated-character-arena") return createGeneratedCharacterArenaScenario(options);
  if (id === "generated-wizard-shield-arena") return createGeneratedCharacterArenaScenario({ ...options, variantId: "wizard", enemyAttackBonus: 4, enemyPosition: { x: 3, y: 1 }, diceSeed: "shield-2" });
  if (getGeneratedEncounterScenarioConfig(id)) return createGeneratedEncounterArenaScenario(id, options);
  throw new Error(`Unknown combat scenario: ${id}`);
}

export function createSnapshotFromScenario(scenario) {
  const actors = scenario.actors.map((actor) => normalizeCombatActor(structuredClone(actor)));
  const actorDefinitions = {};
  const actorInstances = {};
  for (const actor of actors) {
    const definitionId = actor.actorContract?.definitionId || `actor.${actor.sourceId || actor.id}`;
    const definition = scenario.actorDefinitions?.[definitionId]
      || combatActorToActorDefinition(actor, {
        id: definitionId,
        kind: actor.kind || (actor.team === "enemies" ? "enemy" : actor.id === "generated_pc" ? "player" : "npc"),
      });
    const instance = combatActorToActorInstance(actor, definition.id);
    actor.actorContract = {
      definitionVersion: definition.schemaVersion,
      instanceVersion: instance.schemaVersion,
      definitionId: definition.id,
      kind: definition.kind,
    };
    actorDefinitions[definition.id] = definition;
    actorInstances[instance.id] = instance;
  }
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
      terrain: new Map((scenario.grid.terrain || []).map((pos) => [`${pos.x},${pos.y}`, pos.kind || "normal"])),
      elevation: new Map((scenario.grid.elevation || []).map((pos) => [`${pos.x},${pos.y}`, Number(pos.level) || 0])),
      hazards: new Map((scenario.grid.hazards || []).map((pos) => [`${pos.x},${pos.y}`, structuredClone(pos.hazards || [pos.hazard].filter(Boolean))])),
    },
    actors,
    actorDefinitions,
    actorInstances,
    combatObjects: normalizeCombatObjects(scenario.combatObjects),
    initiative: [],
    metadata: structuredClone(scenario.metadata || {}),
  };
}
