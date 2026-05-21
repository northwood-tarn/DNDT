// app/data/encounters.js
// Encounter source records. These define enemy composition, not full combat scenarios.

export const encounters = {
  combat_skeleton_1: {
    id: "combat_skeleton_1",
    name: "Lone Skeleton",
    difficulty: "easy",
    enemies: [
      { enemyId: "skeleton", count: 1 }
    ],
  },

  combat_wolves_1: {
    id: "combat_wolves_1",
    name: "Wolf Pack",
    difficulty: "medium",
    enemies: [
      { enemyId: "wolf", count: 3 }
    ],
  },

  combat_wolves_2: {
    id: "combat_wolves_2",
    name: "Wolf Pack",
    difficulty: "medium",
    enemies: [
      { enemyId: "wolf", count: 3 }
    ],
  },

  combat_wolves_3: {
    id: "combat_wolves_3",
    name: "Wolf Pack",
    difficulty: "medium",
    enemies: [
      { enemyId: "wolf", count: 3 }
    ],
  },

  combat_shadow_random: {
    id: "combat_shadow_random",
    name: "Hungry Shadow",
    difficulty: "hard",
    enemies: [
      { enemyId: "shadow", count: 1 }
    ],
  },

  combat_boss_knight: {
    id: "combat_boss_knight",
    name: "Armored Knight",
    difficulty: "hard",
    enemies: [
      { enemyId: "knight", count: 1 }
    ],
  },

  combat_goblins_2: {
    id: "combat_goblins_2",
    name: "Goblin Pair",
    difficulty: "easy",
    enemies: [
      { enemyId: "goblin", count: 2 }
    ],
  },
};

const _encountersById = new Map(Object.values(encounters).map(encounter => [encounter.id, encounter]));

export function getEncounterById(id) {
  if (!id) return null;
  return _encountersById.get(id) || null;
}

export function expandEncounterEnemyIds(encounter) {
  if (!encounter?.enemies) return [];
  return encounter.enemies.flatMap(group => Array.from({ length: group.count || 1 }, () => group.enemyId));
}
