import { createEncounterCombatScenario } from "../encounterScenario.js";
import { getGeneratedEncounterScenarioConfig } from "./generatedEncounterScenarioConfigs.js";

export function createGeneratedEncounterArenaScenario(idOrOptions = {}, maybeOptions = {}) {
  const requestedId = typeof idOrOptions === "string" ? idOrOptions : idOrOptions.id;
  const options = typeof idOrOptions === "string" ? maybeOptions : idOrOptions;
  const config = getGeneratedEncounterScenarioConfig(requestedId) || getGeneratedEncounterScenarioConfig("generated-encounter-goblin-skirmish");
  const variantId = options.variantId || config.variantId;
  const encounterId = options.encounterId || config.encounterId;
  const scenario = createEncounterCombatScenario(encounterId, {
    id: config.id,
    ...options,
    fallbackVariantId: variantId,
    heroPositions: [options.heroPosition || config.heroPosition],
  });
  const hero = scenario.actors.find((actor) => actor.id === "generated_pc" || actor.team === "heroes");
  return {
    ...scenario,
    metadata: {
      ...scenario.metadata,
      generatedHeroVariantId: variantId,
      generatedHeroActorId: hero?.id || null,
      diceSeed: options.diceSeed || config.diceSeed,
    },
  };
}
