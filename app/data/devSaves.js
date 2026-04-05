export const DEV_AYA_SLOT_ID = 99;

export const AYA_PLAYER = {
  name: "Aya",

  class: "Fighter",
  level: 1,
  species: "Human",
  background: "Soldier",

  proficiencyBonus: 2,

  abilities: {
    str: 16,
    dex: 13,
    con: 14,
    int: 12,
    wis: 12,
    cha: 8
  },

  abilityMods: {
    str: 3,
    dex: 1,
    con: 2,
    int: 1,
    wis: 1,
    cha: -1
  },

  savingThrows: {
    str: { proficient: true, mod: 5 },
    dex: { proficient: false, mod: 1 },
    con: { proficient: true, mod: 4 },
    int: { proficient: false, mod: 1 },
    wis: { proficient: false, mod: 1 },
    cha: { proficient: false, mod: -1 }
  },

  skills: {
    athletics: 5,
    perception: 3,

    // testing overrides
    investigation: 2,
    history: 2,

    acrobatics: 1,
    animal_handling: 1,
    insight: 1,
    intimidation: -1,
    survival: 1,
    stealth: 1
  },

  hp: {
    max: 12,
    current: 12,
    temp: 0
  },

  hitDie: "d10",

  classFeatures: {
    fightingStyle: "Defense",
    secondWind: {
      usesMax: 1,
      usesRemaining: 1,
      resetOn: "short_or_long_rest"
    }
  },

  inventory: {
    gold: 0,
    items: [
      { id: "chain_mail", qty: 1 },
      { id: "shield", qty: 1 },
      { id: "longsword", qty: 1 },
      { id: "light_crossbow", qty: 1 },
      { id: "crossbow_bolt", qty: 20 },

      // dungeoneer's pack contents
      { id: "backpack", qty: 1 },
      { id: "crowbar", qty: 1 },
      { id: "hammer", qty: 1 },
      { id: "piton", qty: 10 },
      { id: "torch", qty: 10 },
      { id: "tinderbox", qty: 1 },
      { id: "ration", qty: 10 },
      { id: "waterskin", qty: 1 },
      { id: "hempen_rope_50ft", qty: 1 }
    ]
  },

  combat: {
    armorClass: 18,
    initiative: 1,
    speed: 30,
    conditions: []
  },

  position: {
    x: 0,
    y: 0,
    isStealthed: false
  }
};

export const DEV_AYA_START_PAYLOAD = {
  // Canonical start-of-game snapshot pieces.
  // (We keep it minimal; systems can extend later.)
  player: AYA_PLAYER,
  flags: {},
  location: {
    areaId: "dockside",
    entryKnot: "start"
  }
};

/**
 * Ensure dev slot 99 exists (Aya at Dockside start) and return the save entry.
 *
 * This does NOT load/apply the save into runtime state — it only persists the slot.
 * Callers should hydrate state from `save.payload`.
 */
export function ensureDevAyaSlot99(saveManager) {
  if (!saveManager) throw new Error("[devSaves] ensureDevAyaSlot99 requires saveManager");

  // If already created, return it.
  const existing = typeof saveManager.getSlot === "function" ? saveManager.getSlot(DEV_AYA_SLOT_ID) : null;
  if (existing) return existing;

  const createdAt = new Date().toISOString();

  if (typeof saveManager.saveSlot !== "function") {
    throw new Error("[devSaves] saveManager.saveSlot is required (did SaveManager.js get updated?)");
  }

  return saveManager.saveSlot({
    slotId: DEV_AYA_SLOT_ID,
    runId: `dev_slot_${DEV_AYA_SLOT_ID}`,
    metadata: {
      appVersion: "0.4",
      slotId: DEV_AYA_SLOT_ID,
      label: "Dev Aya Start",
      createdAt
    },
    payload: DEV_AYA_START_PAYLOAD
  });
}