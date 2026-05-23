import { getEncounterById } from "../../data/encounters.js";

export const GENERATED_ENCOUNTER_SCENARIOS = [
  {
    id: "generated-encounter-goblin-skirmish",
    name: "Encounter: Goblin Skirmish",
    encounterId: "combat_goblin_skirmish",
    variantId: "fighter",
    diceSeed: "encounter-goblin-skirmish-001",
    heroPosition: { x: 1, y: 3 },
  },
  {
    id: "generated-encounter-bone-guard",
    name: "Encounter: Bone Guard",
    encounterId: "combat_bone_guard",
    variantId: "fighter",
    diceSeed: "encounter-bone-guard-001",
    heroPosition: { x: 1, y: 2 },
  },
  {
    id: "generated-encounter-shadow-hounds",
    name: "Encounter: Shadow Hounds",
    encounterId: "combat_shadow_hounds",
    variantId: "fighter",
    diceSeed: "encounter-shadow-hounds-001",
    heroPosition: { x: 1, y: 2 },
  },
];

export function getGeneratedEncounterScenarioConfig(id) {
  return GENERATED_ENCOUNTER_SCENARIOS.find((scenario) => scenario.id === id) || null;
}

export function validateGeneratedEncounterScenarioConfigs(configs = GENERATED_ENCOUNTER_SCENARIOS) {
  const errors = [];
  const ids = new Set();
  for (const [index, config] of configs.entries()) {
    const label = config?.id || `generated encounter config ${index}`;
    if (!config || typeof config !== "object") {
      errors.push(`${label}: config must be an object`);
      continue;
    }
    if (!isNonEmptyString(config.id)) errors.push(`${label}: id is required`);
    if (!isNonEmptyString(config.name)) errors.push(`${label}: name is required`);
    if (!isNonEmptyString(config.encounterId)) {
      errors.push(`${label}: encounterId is required`);
    } else if (!getEncounterById(config.encounterId)) {
      errors.push(`${label}: encounterId references unknown encounter ${config.encounterId}`);
    }
    if (!isNonEmptyString(config.variantId)) errors.push(`${label}: variantId is required`);
    if (!isNonEmptyString(config.diceSeed)) errors.push(`${label}: diceSeed is required`);
    if (!isGridPosition(config.heroPosition)) errors.push(`${label}: heroPosition must have integer x and y`);
    if (ids.has(config.id)) errors.push(`${label}: duplicate generated scenario id`);
    ids.add(config.id);
  }
  return errors;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isGridPosition(value) {
  return value && Number.isInteger(value.x) && Number.isInteger(value.y);
}
