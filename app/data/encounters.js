// app/data/encounters.js
// Encounter source records. These define enemy composition, not full combat scenarios.

const authoredEncounterRecords = {
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

  combat_mixed_patrol: {
    id: "combat_mixed_patrol",
    name: "Mixed Patrol",
    difficulty: "medium",
    enemies: [
      { enemyId: "goblin", count: 1 },
      { enemyId: "wolf", count: 1 }
    ],
  },

  combat_goblin_skirmish: {
    id: "combat_goblin_skirmish",
    name: "Goblin Skirmish",
    difficulty: "medium",
    battlefield: defaultBattlefield({ heroPositions: [{ x: 1, y: 3 }] }),
    enemies: [
      {
        enemyId: "goblin",
        count: 3,
        defaults: { masteredWeaponIds: ["scimitar"] },
        instances: [
          { id: "goblin_cutthroat", name: "Goblin Cutthroat", position: { x: 6, y: 2 }, hp: 9 },
          { id: "goblin_flanker", name: "Goblin Flanker", position: { x: 7, y: 3 } },
          { id: "goblin_runner", name: "Goblin Runner", position: { x: 6, y: 4 }, speed: 7 }
        ]
      }
    ],
  },

  combat_bone_guard: {
    id: "combat_bone_guard",
    name: "Bone Guard",
    difficulty: "hard",
    battlefield: defaultBattlefield({ heroPositions: [{ x: 1, y: 2 }] }),
    enemies: [
      {
        enemyId: "knight",
        count: 1,
        instances: [
          { id: "grave_knight", name: "Grave Knight", position: { x: 7, y: 2 }, masteredWeaponIds: ["greatsword"] }
        ]
      },
      {
        enemyId: "skeleton",
        count: 2,
        instances: [
          { id: "left_skeleton", name: "Left Skeleton", position: { x: 6, y: 1 } },
          { id: "right_skeleton", name: "Right Skeleton", position: { x: 6, y: 3 } }
        ]
      }
    ],
  },

  combat_shadow_hounds: {
    id: "combat_shadow_hounds",
    name: "Shadow and Hounds",
    difficulty: "hard",
    battlefield: defaultBattlefield({ heroPositions: [{ x: 1, y: 2 }] }),
    enemies: [
      { enemyId: "shadow", count: 1, instances: [{ id: "hungry_shadow", name: "Hungry Shadow", position: { x: 7, y: 2 } }] },
      { enemyId: "wolf", count: 2, instances: [
        { id: "left_hound", name: "Left Hound", position: { x: 6, y: 1 } },
        { id: "right_hound", name: "Right Hound", position: { x: 6, y: 3 } }
      ] }
    ],
  },

  combat_pc_ability_raiders: {
    id: "combat_pc_ability_raiders",
    name: "Ability Raiders",
    difficulty: "medium",
    battlefield: defaultBattlefield({
      heroPositions: [{ x: 1, y: 2 }, { x: 1, y: 3 }, { x: 1, y: 4 }],
    }),
    enemies: [
      { enemyId: "goblin", count: 2, instances: [
        { id: "raider_cutter", name: "Raider Cutter", position: { x: 6, y: 2 } },
        { id: "raider_runner", name: "Raider Runner", position: { x: 7, y: 3 } },
      ] },
      { enemyId: "wolf", count: 1, instances: [
        { id: "raider_hound", name: "Raider Hound", position: { x: 6, y: 4 } },
      ] },
    ],
  },

  combat_pc_ability_crypt: {
    id: "combat_pc_ability_crypt",
    name: "Crypt With Borrowed Tricks",
    difficulty: "medium",
    battlefield: defaultBattlefield({
      heroPositions: [{ x: 1, y: 1 }, { x: 1, y: 2 }, { x: 1, y: 3 }],
    }),
    enemies: [
      { enemyId: "skeleton", count: 2, instances: [
        { id: "grave_spark_left", name: "Grave Spark Left", position: { x: 6, y: 1 } },
        { id: "grave_spark_right", name: "Grave Spark Right", position: { x: 6, y: 3 } },
      ] },
      { enemyId: "shadow", count: 1, instances: [
        { id: "marked_shadow", name: "Marked Shadow", position: { x: 7, y: 2 } },
      ] },
    ],
  },

  combat_pc_ability_vanguard: {
    id: "combat_pc_ability_vanguard",
    name: "Vanguard With Borrowed Tricks",
    difficulty: "hard",
    battlefield: defaultBattlefield({
      heroPositions: [{ x: 1, y: 2 }, { x: 1, y: 3 }, { x: 1, y: 4 }],
    }),
    enemies: [
      { enemyId: "knight", count: 1, instances: [
        { id: "second_wind_knight", name: "Second Wind Knight", position: { x: 7, y: 3 } },
      ] },
      { enemyId: "goblin", count: 1, instances: [
        { id: "vanguard_runner", name: "Vanguard Runner", position: { x: 6, y: 2 } },
      ] },
      { enemyId: "skeleton", count: 1, instances: [
        { id: "vanguard_bones", name: "Vanguard Bones", position: { x: 6, y: 4 } },
      ] },
    ],
  },

  combat_full_smoke_low: {
    id: "combat_full_smoke_low",
    name: "Full Smoke Low",
    difficulty: "easy",
    battlefield: defaultBattlefield({
      heroPositions: [{ x: 1, y: 2 }, { x: 1, y: 3 }, { x: 1, y: 4 }],
    }),
    enemies: [
      { enemyId: "goblin", count: 1, instances: [{ id: "low_goblin", position: { x: 6, y: 2 } }] },
      { enemyId: "wolf", count: 1, instances: [{ id: "low_wolf", position: { x: 6, y: 4 } }] },
    ],
  },

  combat_full_smoke_mid: {
    id: "combat_full_smoke_mid",
    name: "Full Smoke Mid",
    difficulty: "medium",
    battlefield: defaultBattlefield({
      heroPositions: [{ x: 1, y: 2 }, { x: 1, y: 3 }, { x: 1, y: 4 }],
    }),
    enemies: [
      { enemyId: "bandit_archer", count: 1, instances: [{ id: "mid_archer", position: { x: 7, y: 2 } }] },
      { enemyId: "skeleton", count: 1, instances: [{ id: "mid_skeleton", position: { x: 6, y: 3 } }] },
      { enemyId: "wolf", count: 1, instances: [{ id: "mid_wolf", position: { x: 6, y: 4 } }] },
    ],
  },

  combat_full_smoke_high: {
    id: "combat_full_smoke_high",
    name: "Full Smoke High",
    difficulty: "hard",
    battlefield: defaultBattlefield({
      heroPositions: [{ x: 1, y: 2 }, { x: 1, y: 3 }, { x: 1, y: 4 }],
    }),
    enemies: [
      { enemyId: "knight", count: 1, instances: [{ id: "high_knight", position: { x: 7, y: 3 } }] },
      { enemyId: "cult_hexer", count: 1, instances: [{ id: "high_hexer", position: { x: 7, y: 2 } }] },
      { enemyId: "bandit_archer", count: 1, instances: [{ id: "high_archer", position: { x: 6, y: 4 } }] },
    ],
  },

  combat_full_smoke_elite: {
    id: "combat_full_smoke_elite",
    name: "Full Smoke Elite",
    difficulty: "hard",
    battlefield: defaultBattlefield({
      heroPositions: [{ x: 1, y: 2 }, { x: 1, y: 3 }, { x: 1, y: 4 }],
    }),
    enemies: [
      { enemyId: "grave_brute", count: 1, instances: [{ id: "elite_brute", position: { x: 7, y: 3 } }] },
      { enemyId: "shadow", count: 1, instances: [{ id: "elite_shadow", position: { x: 6, y: 2 } }] },
      { enemyId: "cult_hexer", count: 1, instances: [{ id: "elite_hexer", position: { x: 7, y: 4 } }] },
    ],
  },
};

function defaultBattlefield(overrides = {}) {
  return {
    grid: {
      width: 10,
      height: 8,
      blocked: [{ x: 4, y: 3 }],
      cover: [
        { x: 5, y: 4, kind: "three_quarters" },
        { x: 2, y: 5, kind: "half" },
      ],
    },
    heroPositions: overrides.heroPositions || [{ x: 1, y: 1 }],
    combatObjects: overrides.combatObjects || [],
  };
}

export const encounters = Object.freeze(Object.fromEntries(Object.entries(authoredEncounterRecords).map(([id, encounter]) => [
  id,
  {
    ...encounter,
    enemies: (encounter.enemies || []).map(({ enemyId, ...group }) => ({
      ...group,
      actorDefinitionId: `enemy.${enemyId}`,
    })),
  },
])));

const _encountersById = new Map(Object.values(encounters).map(encounter => [encounter.id, encounter]));

export function getEncounterById(id) {
  if (!id) return null;
  return _encountersById.get(id) || null;
}

export function expandEncounterEnemyRefs(encounter) {
  if (!encounter?.enemies) return [];
  return encounter.enemies.flatMap((group) => {
    const count = group.count || group.instances?.length || 1;
    return Array.from({ length: count }, (_, index) => ({
      actorDefinitionId: group.actorDefinitionId || (group.enemyId ? `enemy.${group.enemyId}` : null),
      enemyId: String(group.actorDefinitionId || group.enemyId || "").replace(/^enemy\./, ""),
      ...(group.defaults || {}),
      ...(group.instances?.[index] || {}),
    }));
  });
}
