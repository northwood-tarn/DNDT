import { normalizeCombatActor, validateCombatActor } from "./actor.js";
import { normalizeCombatObjects } from "./combatObjects.js";
import { createTestScenario } from "./scenarios/tightCombatTest.js";
import { createTrialArenaScenario } from "./scenarios/trialArena.js";
import { createSpellMechanicsArenaScenario } from "./scenarios/spellMechanicsArena.js";

export { createTestScenario } from "./scenarios/tightCombatTest.js";
export { createTrialArenaScenario } from "./scenarios/trialArena.js";
export { createSpellMechanicsArenaScenario } from "./scenarios/spellMechanicsArena.js";

export function getCombatScenarioOptions() {
  return [
    { id: "trial-arena", name: "Trial Arena" },
    { id: "spell-mechanics-arena", name: "Spell Mechanics Arena" },
    { id: "tight-combat-test", name: "Tight Combat Test" },
  ];
}

export function createCombatScenario(id = "trial-arena") {
  if (id === "trial-arena") return createTrialArenaScenario();
  if (id === "spell-mechanics-arena") return createSpellMechanicsArenaScenario();
  return createTestScenario();
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
