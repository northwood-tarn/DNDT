import { getEncounterById } from "../data/encounters.js";
import { createEncounterEnemyActors } from "./enemyFactory.js";
import { createHeroActorsForScenario } from "./heroParty.js";

export function createEncounterCombatScenario(encounterId, options = {}) {
  const encounter = getEncounterById(encounterId);
  if (!encounter) throw new Error(`Unknown encounter: ${encounterId}`);

  const grid = options.grid || encounter.battlefield?.grid || defaultGrid();
  const heroes = createHeroActorsForScenario({
    ...options,
    heroPositions: options.heroPositions || encounter.battlefield?.heroPositions,
  });
  const enemyRefs = createEnemyInstanceOptions(encounter, { ...options, grid });
  const enemies = createEncounterEnemyActors(encounterId, { instances: enemyRefs });
  const scenario = {
    id: options.id || `encounter-${encounterId}`,
    encounterId,
    grid,
    actors: [...heroes, ...enemies],
    combatObjects: structuredClone(options.combatObjects || encounter.battlefield?.combatObjects || []),
    metadata: {
      encounterName: encounter.name,
      difficulty: encounter.difficulty,
      source: "encounter",
      storyFlags: structuredClone(encounter.storyFlags || []),
    },
  };
  const errors = validateEncounterCombatScenario(scenario);
  if (errors.length) throw new Error(`Invalid encounter scenario:\n${errors.join("\n")}`);
  return scenario;
}

export function validateEncounterCombatScenario(scenario) {
  const errors = [];
  if (!scenario?.grid) return ["grid is required"];
  if (!Number.isInteger(scenario.grid.width) || scenario.grid.width <= 0) errors.push("grid.width must be a positive integer");
  if (!Number.isInteger(scenario.grid.height) || scenario.grid.height <= 0) errors.push("grid.height must be a positive integer");
  const occupied = new Map();
  const blocked = new Set((scenario.grid.blocked || []).map((pos) => `${pos.x},${pos.y}`));
  const cover = new Map();
  validateTerrainPositions(errors, scenario.grid, scenario.grid.blocked || [], "blocked");
  for (const item of scenario.grid.cover || []) {
    const key = `${item.x},${item.y}`;
    if (!["half", "three_quarters", "full"].includes(item.kind)) errors.push(`cover at ${key} has unsupported kind ${item.kind}`);
    if (cover.has(key)) errors.push(`cover has duplicate cell ${key}`);
    cover.set(key, item.kind);
    if (blocked.has(key)) errors.push(`cover cell ${key} overlaps blocked terrain`);
  }
  validateTerrainPositions(errors, scenario.grid, scenario.grid.cover || [], "cover");
  for (const actor of scenario.actors || []) {
    if (!actor?.id) errors.push("actor id is required");
    if (!actor?.position) {
      errors.push(`${actor?.id || "actor"} position is required`);
      continue;
    }
    if (!inBounds(scenario.grid, actor.position)) errors.push(`${actor.id} starts out of bounds`);
    const key = `${actor.position.x},${actor.position.y}`;
    if (blocked.has(key)) errors.push(`${actor.id} starts on blocked terrain at ${key}`);
    if (cover.has(key)) errors.push(`${actor.id} starts on cover terrain at ${key}`);
    if (occupied.has(key)) errors.push(`${actor.id} overlaps ${occupied.get(key)} at ${key}`);
    occupied.set(key, actor.id);
  }
  return errors;
}

function validateTerrainPositions(errors, grid, positions, label) {
  const seen = new Set();
  for (const pos of positions) {
    const key = `${pos?.x},${pos?.y}`;
    if (!Number.isInteger(pos?.x) || !Number.isInteger(pos?.y)) {
      errors.push(`${label} terrain position must have integer x and y`);
      continue;
    }
    if (!inBounds(grid, pos)) errors.push(`${label} terrain cell ${key} is out of bounds`);
    if (seen.has(key)) errors.push(`${label} terrain has duplicate cell ${key}`);
    seen.add(key);
  }
}

function createEnemyInstanceOptions(encounter, options) {
  const positions = options.enemyPositions || [];
  const expanded = [];
  for (const group of encounter.enemies || []) {
    const count = group.count || group.instances?.length || 1;
    for (let index = 0; index < count; index += 1) {
      expanded.push({
        ...(group.defaults || {}),
        ...(group.instances?.[index] || {}),
      });
    }
  }
  return expanded.map((instance, index) => ({
    ...instance,
    ...(options.enemyInstances?.[index] || {}),
    position: instance.position || positions[index] || defaultEnemyPosition(index, options.grid),
  }));
}

function defaultGrid() {
  return {
    width: 10,
    height: 10,
    blocked: [],
    cover: [],
  };
}

function defaultEnemyPosition(index, grid = defaultGrid()) {
  const width = grid?.width || 10;
  const height = grid?.height || 10;
  return {
    x: Math.max(0, width - 2),
    y: Math.min(height - 2, 1 + index),
  };
}

function inBounds(grid, position) {
  return position.x >= 0 && position.x < grid.width && position.y >= 0 && position.y < grid.height;
}
