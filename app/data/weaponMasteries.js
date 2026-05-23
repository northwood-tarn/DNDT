export const WEAPON_MASTERIES = {
  cleave: {
    id: "cleave",
    name: "Cleave",
    implementation: "automatic",
    description: "After hitting with the weapon, make a second melee attack against another creature within 5 feet of the first.",
  },
  graze: {
    id: "graze",
    name: "Graze",
    implementation: "automatic",
    description: "On a miss, deal damage equal to the ability modifier used for the attack.",
  },
  nick: {
    id: "nick",
    name: "Nick",
    implementation: "automatic",
    description: "Moves the extra Light weapon attack into the Attack action instead of the Bonus Action.",
  },
  push: {
    id: "push",
    name: "Push",
    implementation: "automatic",
    description: "On a hit, push a Large or smaller creature up to 10 feet directly away.",
  },
  sap: {
    id: "sap",
    name: "Sap",
    implementation: "automatic",
    description: "On a hit, the target has disadvantage on its next attack roll before the start of your next turn.",
  },
  slow: {
    id: "slow",
    name: "Slow",
    implementation: "automatic",
    description: "On a damaging hit, reduce the target's Speed by 10 feet until the start of your next turn.",
  },
  topple: {
    id: "topple",
    name: "Topple",
    implementation: "automatic",
    description: "On a hit, the target makes a Constitution save or falls Prone.",
  },
  vex: {
    id: "vex",
    name: "Vex",
    implementation: "automatic",
    description: "On a hit, gain advantage on your next attack roll against the same target.",
  },
};

export const WEAPON_MASTERY_IDS = Object.keys(WEAPON_MASTERIES);

export function getWeaponMastery(id) {
  return WEAPON_MASTERIES[id] || null;
}
