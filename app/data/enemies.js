// app/data/enemies.js
// Enemy source records for encounter setup and awareness. Combat actors are built from these records later.

export const enemies = {
  goblin: {
    id: "goblin",
    name: "Goblin",
    role: "skirmisher",
    creatureType: "humanoid",
    size: "small",
    level: 1,
    hp: 7,
    maxHp: 7,
    ac: 13,
    speed: 6,
    attackBonus: 4,
    weaponId: "scimitar",
    damage: "1d6+2",
    damageType: "slashing",
    actionRefs: [
      { template: "weapon_attack", weaponId: "scimitar" },
      { template: "bonus_dash", id: "nimble_escape_dash", name: "Nimble Escape", resourceId: "nimble_escape" }
    ],
    resources: [
      { id: "nimble_escape", name: "Nimble Escape", max: 1, current: 1, recovery: "encounter" }
    ],
    features: [
      {
        id: "nimble_escape",
        name: "Nimble Escape",
        description: "The goblin can spend a limited burst of movement to reposition.",
        sourceAbility: "Cunning Action"
      }
    ],
    xpValue: 50,
    description: "A small, vicious creature that attacks in packs.",
    aiProfile: "aggressive",
    awareness: {
      vision: "light_bound",
      hostility: "onsight",
      visionRange: 30
    },
    saves: {
      str: -1,
      dex:  2,
      con:  0,
      int:  0,
      wis: -1,
      cha: -1
    },
    loot: {
      gold: { min: 2, max: 8 },
      table: "goblinkind",
      rarityBias: "common"
    }
  },
  wolf: {
    id: "wolf",
    name: "Wolf",
    role: "striker",
    creatureType: "beast",
    size: "medium",
    level: 2,
    hp: 11,
    maxHp: 11,
    ac: 13,
    speed: 8,
    attackBonus: 4,
    naturalAttack: {
      id: "bite",
      name: "Bite",
      damage: "2d4+2",
      damageType: "piercing"
    },
    actionRefs: [
      { template: "natural_attack", naturalAttackId: "bite", name: "Bite", damage: "2d4+2", damageType: "piercing" },
      { template: "bonus_dash", id: "predatory_rush", name: "Predatory Rush", uses: 1 }
    ],
    features: [
      {
        id: "pack_bite",
        name: "Pack Bite",
        description: "The wolf bites harder when the pack has committed to the attack.",
        effects: {
          damageRiders: [
            { id: "pack_bite_damage", trigger: "source_hits_with_attack_roll", actionTags: ["natural"], damage: "1d4", damageType: "piercing", oncePerTurn: true }
          ]
        }
      }
    ],
    xpValue: 75,
    description: "A snarling predator that hunts in packs.",
    aiProfile: "pack",
    awareness: {
      vision: "darkvision",
      hostility: "swarm",
      visionRange: 60,
      swarmGroup: "wolves"
    },
    saves: {
      str:  1,
      dex:  2,
      con:  1,
      int: -4,
      wis:  1,
      cha: -2
    },
    loot: {
      gold: { min: 0, max: 4 },
      table: "animals",
      rarityBias: "common"
    }
  },
  skeleton: {
    id: "skeleton",
    name: "Skeleton",
    role: "guard",
    creatureType: "undead",
    undeadRank: "bound",
    size: "medium",
    level: 1,
    hp: 13,
    maxHp: 13,
    ac: 13,
    speed: 6,
    attackBonus: 4,
    weaponId: "shortsword",
    damage: "1d6+2",
    damageType: "piercing",
    actionRefs: [
      { template: "weapon_attack", weaponId: "shortsword" },
      { template: "spell_action", spellId: "sacred_flame", id: "grave_spark", name: "Grave Spark", spellSaveDC: 12, casterLevel: 1 }
    ],
    features: [
      {
        id: "rattling_blade",
        name: "Rattling Blade",
        description: "The skeleton's clattering strike leaves the target briefly off-balance.",
        effects: {
          conditionRiders: [
            { id: "rattling_blade_shaken", trigger: "source_hits_with_attack_roll", actionTags: ["weapon"], condition: "next_attack_disadvantage", duration: { type: "turns", remaining: 1 }, oncePerTurn: true }
          ]
        }
      }
    ],
    xpValue: 50,
    description: "A brittle corpse animated by hostile magic.",
    aiProfile: "guard",
    awareness: {
      vision: "darkvision",
      hostility: "onsight",
      visionRange: 60
    },
    saves: {
      str:  0,
      dex:  2,
      con:  2,
      int: -2,
      wis: -1,
      cha: -3
    },
    loot: {
      gold: { min: 0, max: 6 },
      table: "undead",
      rarityBias: "common"
    }
  },
  shadow: {
    id: "shadow",
    name: "Shadow",
    role: "stalker",
    creatureType: "undead",
    undeadRank: "profane",
    size: "medium",
    level: 2,
    hp: 16,
    maxHp: 16,
    ac: 12,
    speed: 8,
    attackBonus: 4,
    naturalAttack: {
      id: "draining_touch",
      name: "Draining Touch",
      damage: "2d6+2",
      damageType: "necrotic"
    },
    actionRefs: [
      { template: "natural_attack", naturalAttackId: "draining_touch", name: "Draining Touch", damage: "2d6+2", damageType: "necrotic" },
      { template: "spell_action", spellId: "hex", id: "shadow_mark", name: "Shadow Mark", spellSaveDC: 12, uses: 1 }
    ],
    activeEffects: [
      { id: "shade_form", label: "Shade Form", type: "modifier", stat: "ac", amount: 1 }
    ],
    xpValue: 100,
    description: "A hungry smear of darkness with a human shape.",
    aiProfile: "stalker",
    awareness: {
      vision: "dark_abhorrent",
      hostility: "onsight",
      visionRange: 60
    },
    saves: {
      str: -2,
      dex:  2,
      con:  0,
      int: -2,
      wis:  0,
      cha: -1
    },
    loot: {
      gold: { min: 0, max: 0 },
      table: "undead",
      rarityBias: "uncommon"
    }
  },
  knight: {
    id: "knight",
    name: "Knight",
    role: "defender",
    creatureType: "humanoid",
    size: "medium",
    level: 5,
    hp: 52,
    maxHp: 52,
    ac: 18,
    speed: 6,
    attackBonus: 5,
    weaponId: "greatsword",
    damage: "2d6+3",
    damageType: "slashing",
    actionRefs: [
      { template: "weapon_attack", weaponId: "greatsword" },
      { template: "self_heal", id: "knightly_second_wind", name: "Knightly Second Wind", healing: "1d10+3", uses: 1 }
    ],
    auras: [
      {
        id: "commanding_presence",
        name: "Commanding Presence",
        radiusSquares: 2,
        affects: "allies",
        effects: [
          { id: "commanding_presence_attack", type: "modifier", stat: "attack_roll", amount: 1, stackKey: "enemy_commanding_presence" }
        ]
      }
    ],
    xpValue: 700,
    description: "A disciplined armored combatant trained to hold ground.",
    aiProfile: "tactical",
    awareness: {
      vision: "lantern",
      hostility: "territorial",
      visionRange: 40
    },
    saves: {
      str:  3,
      dex:  0,
      con:  2,
      int:  0,
      wis:  1,
      cha:  2
    },
    loot: {
      gold: { min: 12, max: 40 },
      table: "martial",
      rarityBias: "uncommon"
    }
  },
  bandit_archer: {
    id: "bandit_archer",
    name: "Bandit Archer",
    role: "archer",
    creatureType: "humanoid",
    size: "medium",
    level: 3,
    hp: 24,
    maxHp: 24,
    ac: 14,
    speed: 6,
    attackBonus: 5,
    weaponId: "shortbow",
    damage: "1d6+3",
    damageType: "piercing",
    actionRefs: [
      { template: "spell_action", spellId: "ray_of_frost", id: "pinning_frost", name: "Pinning Frost", attackBonus: 5, casterLevel: 3, uses: 1 },
      { template: "weapon_attack", weaponId: "shortbow" }
    ],
    xpValue: 125,
    description: "A disciplined bowman with a stolen freezing charm tied around the wrist.",
    aiProfile: "archer",
    awareness: {
      vision: "lantern",
      hostility: "territorial",
      visionRange: 50
    },
    saves: {
      str: 0,
      dex: 3,
      con: 1,
      int: 0,
      wis: 1,
      cha: 0
    },
    loot: {
      gold: { min: 4, max: 14 },
      table: "martial",
      rarityBias: "common"
    }
  },
  cult_hexer: {
    id: "cult_hexer",
    name: "Cult Hexer",
    role: "stalker",
    creatureType: "humanoid",
    size: "medium",
    level: 5,
    hp: 32,
    maxHp: 32,
    ac: 13,
    speed: 6,
    attackBonus: 5,
    weaponId: "dagger",
    damage: "1d4+2",
    damageType: "piercing",
    actionRefs: [
      { template: "spell_action", spellId: "mind_sliver", id: "splinter_thought", name: "Splinter Thought", spellSaveDC: 13, casterLevel: 5, uses: 2 },
      { template: "weapon_attack", weaponId: "dagger" }
    ],
    xpValue: 250,
    description: "A muttering occultist who turns stolen warlock lessons into battlefield curses.",
    aiProfile: "tactical",
    awareness: {
      vision: "darkvision",
      hostility: "onsight",
      visionRange: 60
    },
    saves: {
      str: -1,
      dex: 2,
      con: 1,
      int: 2,
      wis: 1,
      cha: 2
    },
    loot: {
      gold: { min: 8, max: 20 },
      table: "occult",
      rarityBias: "uncommon"
    }
  },
  grave_brute: {
    id: "grave_brute",
    name: "Grave Brute",
    role: "defender",
    creatureType: "undead",
    undeadRank: "bound",
    size: "large",
    level: 8,
    hp: 72,
    maxHp: 72,
    ac: 15,
    speed: 6,
    attackBonus: 7,
    naturalAttack: {
      id: "stone_fist",
      name: "Stone Fist",
      damage: "2d8+4",
      damageType: "bludgeoning"
    },
    actionRefs: [
      { template: "self_heal", id: "stitched_together", name: "Stitched Together", healing: "1d10+4", uses: 1 },
      { template: "natural_attack", naturalAttackId: "stone_fist", name: "Stone Fist", damage: "2d8+4", damageType: "bludgeoning" }
    ],
    xpValue: 900,
    description: "A heavy corpse packed with grave-stone and bad repairs.",
    aiProfile: "guard",
    awareness: {
      vision: "darkvision",
      hostility: "territorial",
      visionRange: 60
    },
    saves: {
      str: 4,
      dex: -1,
      con: 4,
      int: -2,
      wis: 0,
      cha: -2
    },
    loot: {
      gold: { min: 0, max: 12 },
      table: "undead",
      rarityBias: "uncommon"
    }
  }
};

const _enemiesById = new Map(Object.values(enemies).map(enemy => [enemy.id, enemy]));

export function getEnemyStats(id) {
  if (!id) return null;
  return _enemiesById.get(id) || null;
}
