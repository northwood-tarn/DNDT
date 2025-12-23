// app/data/enemies.js
// Extended with vision + hostility fields for awareness system

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
  }
  // ... other enemies remain, can be extended similarly
};

export function getEnemyStats(id) {
  return enemies[id] || null;
}
