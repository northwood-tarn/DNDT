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
    visionRange: 10
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
    weaponId: null,
    xpValue: 75,
    description: "A snarling predator that hunts in packs.",
    behavior: "pack",
    vision: "darkvision",
    hostility: "swarm",
    swarmGroup: "stalkers",
    visionRange: 60
  }
  // ... other enemies remain, can be extended similarly
};

export function getEnemyStats(id) {
  return enemies[id] || null;
}
