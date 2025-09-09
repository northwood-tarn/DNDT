// app/data/enemies.js (augmented with goblin_intern and goblin_archer)

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
    behavior: "aggressive"
  },
  skeleton: {
    id: "skeleton",
    name: "Skeleton",
    level: 2,
    hp: 13,
    maxHp: 13,
    ac: 13,
    attackBonus: 4,
    damage: "1d6+2",
    weaponId: "shortsword",
    xpValue: 75,
    description: "A reanimated warrior, brittle but relentless.",
    behavior: "aggressive"
  },
  bandit: {
    id: "bandit",
    name: "Bandit",
    level: 2,
    hp: 12,
    maxHp: 12,
    ac: 12,
    attackBonus: 3,
    damage: "1d8+1",
    weaponId: "handaxe",
    xpValue: 75,
    description: "A human raider with a crude weapon and bad intentions.",
    behavior: "tactical"
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
    behavior: "pack"
  },
  cultist: {
    id: "cultist",
    name: "Cultist",
    level: 3,
    hp: 18,
    maxHp: 18,
    ac: 12,
    attackBonus: 5,
    damage: "1d6+3",
    weaponId: "dagger",
    xpValue: 100,
    description: "A dark zealot empowered by sinister magic.",
    behavior: "aggressive"
  },
  orc: {
    id: "orc",
    name: "Orc",
    level: 3,
    hp: 30,
    maxHp: 30,
    ac: 13,
    attackBonus: 5,
    damage: "1d12+3",
    weaponId: "battleaxe",
    xpValue: 125,
    description: "A brutal warrior with raw strength and a mean axe.",
    behavior: "aggressive"
  },
  shadow: {
    id: "shadow",
    name: "Shadow",
    level: 4,
    hp: 16,
    maxHp: 16,
    ac: 12,
    attackBonus: 4,
    damage: "2d6",
    weaponId: null,
    xpValue: 150,
    description: "An undead wraith that drains the strength of its victims.",
    behavior: "evasive"
  },
  knight: {
    id: "knight",
    name: "Knight",
    level: 4,
    hp: 45,
    maxHp: 45,
    ac: 18,
    attackBonus: 6,
    damage: "1d10+4",
    weaponId: "longsword",
    xpValue: 200,
    description: "A heavily armored warrior with disciplined strikes.",
    behavior: "guard"
  },
  ogre: {
    id: "ogre",
    name: "Ogre",
    level: 5,
    hp: 59,
    maxHp: 59,
    ac: 11,
    attackBonus: 6,
    damage: "2d8+4",
    weaponId: "club",
    xpValue: 250,
    description: "A hulking brute that smashes anything in its path.",
    behavior: "aggressive"
  },
  goblin_hexcaller: {
    id: "goblin_hexcaller",
    name: "Goblin Hexcaller",
    level: 2,
    hp: 10,
    maxHp: 10,
    ac: 12,
    attackBonus: 4,
    damage: "1d10+2",
    weaponId: "arcane_blast",
    xpValue: 100,
    description: "A goblin dabbler in shadowy pacts, whispering hexes.",
    behavior: "aggressive",
    spells: ["hex", "eldritch_blast", "mage_armor"]
  },
  wight: {
    id: "wight",
    name: "Wight",
    level: 5,
    hp: 45,
    maxHp: 45,
    ac: 14,
    attackBonus: 6,
    damage: "2d6+3",
    weaponId: "rapier",
    xpValue: 300,
    description: "A malevolent undead that commands the dead.",
    behavior: "commanding"
  },

  // ---- New entries ----
  goblin_intern: {
    id: "goblin_intern",
    name: "Goblin Intern",
    level: 1,
    hp: 2,
    maxHp: 2,
    ac: 10,
    attackBonus: 2,
    damage: "1d4",
    weaponId: "shortbow",
    xpValue: 10,
    description: "A trembling apprentice with a shortbow and big dreams.",
    behavior: "cowardly"
  },

  goblin_archer: {
    id: "goblin_archer",
    name: "Goblin Archer",
    level: 1,
    hp: 7,
    maxHp: 7,
    ac: 13,
    attackBonus: 4,
    damage: "1d6+2",
    weaponId: "shortbow",
    xpValue: 50,
    description: "A goblin who prefers arrows to knives; it hangs back at range.",
    behavior: "skirmish"
  }
};

export function getEnemyStats(id) {
  return enemies[id] || null;
}
