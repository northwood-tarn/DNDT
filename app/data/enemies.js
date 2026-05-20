// app/data/enemies.js
// Extended with vision + hostility fields for awareness system
// Note: undead need to be ranked: profane, bound, sovereign. This will determine the effects of Turn Undead

export const enemies = {
  goblin: {
    id: "goblin",
    name: "Goblin",
    level: 1,
    hp: 7,
    maxHp: 7,
    ac: 13,
    attackBonus: 4,
    damage: "1d6+2",
    weaponId: "scimitar",
    xpValue: 50,
    description: "A small, vicious creature that attacks in packs.",
    behavior: "aggressive",
    vision: "light_bound",
    hostility: "onsight",
    visionRange: 30,
    savingThrows: {
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
    level: 2,
    hp: 11,
    maxHp: 11,
    ac: 13,
    attackBonus: 4,
    damage: "2d4+2",
    weaponId: "natural",
    xpValue: 75,
    description: "A snarling predator that hunts in packs.",
    behavior: "pack",
    vision: "darkvision",
    hostility: "swarm",
    visionRange: 60,
    savingThrows: {
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
    level: 1,
    hp: 13,
    maxHp: 13,
    ac: 13,
    attackBonus: 4,
    damage: "1d6+2",
    weaponId: "shortsword",
    xpValue: 50,
    description: "A brittle corpse animated by hostile magic.",
    behavior: "guard",
    vision: "darkvision",
    hostility: "onsight",
    visionRange: 60,
    creatureType: "undead",
    undeadRank: "bound",
    savingThrows: {
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
    level: 2,
    hp: 16,
    maxHp: 16,
    ac: 12,
    attackBonus: 4,
    damage: "2d6+2",
    weaponId: "draining_touch",
    xpValue: 100,
    description: "A hungry smear of darkness with a human shape.",
    behavior: "stalker",
    vision: "dark_abhorrent",
    hostility: "onsight",
    visionRange: 60,
    creatureType: "undead",
    undeadRank: "profane",
    savingThrows: {
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
    level: 5,
    hp: 52,
    maxHp: 52,
    ac: 18,
    attackBonus: 5,
    damage: "2d6+3",
    weaponId: "greatsword",
    xpValue: 700,
    description: "A disciplined armored combatant trained to hold ground.",
    behavior: "tactical",
    vision: "lantern",
    hostility: "territorial",
    visionRange: 40,
    creatureType: "humanoid",
    savingThrows: {
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
  // ... other enemies remain, can be extended similarly
};

export function getEnemyStats(id) {
  return enemies[id] || null;
}
