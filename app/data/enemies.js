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
  }
};

const _enemiesById = new Map(Object.values(enemies).map(enemy => [enemy.id, enemy]));

export function getEnemyStats(id) {
  if (!id) return null;
  return _enemiesById.get(id) || null;
}
