import {
  createCharacterRecord,
  createEmptyCharacterDraft,
  saveCharacterDraft,
} from "../character/index.js";

export function createStepCreatorCharacterRecord(draft, options = {}) {
  return createCharacterRecord(draft, {
    slot: options.slot || "active",
    actorOptions: {
      id: "generated_pc",
      position: { x: 1, y: 1 },
      ...(options.actorOptions || {}),
    },
    resolveOptions: { allowNonCreationLevel: false, ...(options.resolveOptions || {}) },
    registries: options.registries,
    id: options.id,
    savedAt: options.savedAt,
  });
}

export function saveStepCreatorDraft(draft, options = {}) {
  return saveCharacterDraft(draft, {
    ...options,
    slot: options.slot || "active",
    actorOptions: {
      id: "generated_pc",
      position: { x: 1, y: 1 },
      ...(options.actorOptions || {}),
    },
    resolveOptions: { allowNonCreationLevel: false, ...(options.resolveOptions || {}) },
  });
}

export function createStepCreatorLevelOneSmokeDrafts() {
  return [
    levelOneDraft({
      name: "Step Fighter",
      backgroundId: "soldier",
      speciesId: "tiefling",
      lineageId: "infernal",
      classId: "fighter",
      abilities: martialAbilities("strength"),
      gear: { weaponIds: ["longsword", "warhammer", "greatsword"], armorId: "chain_mail", shieldId: "shield" },
      choices: { weaponMasteryIds: ["longsword", "warhammer", "greatsword"] },
    }),
    levelOneDraft({
      name: "Step Rogue",
      backgroundId: "criminal",
      speciesId: "halfling",
      lineageId: "lightfoot",
      classId: "rogue",
      abilities: martialAbilities("dexterity"),
      gear: { weaponIds: ["rapier", "dagger"], armorId: "studded_leather", shieldId: null },
      choices: { weaponMasteryIds: ["rapier", "dagger"] },
    }),
    levelOneDraft({
      name: "Step Wizard",
      backgroundId: "criminal",
      speciesId: "elf",
      lineageId: "high",
      classId: "wizard",
      abilities: casterAbilities("intelligence"),
      gear: { weaponIds: ["quarterstaff"], armorId: null, shieldId: null },
      spells: { knownSpellIds: ["fire_bolt", "mage_hand", "ray_of_frost"], preparedSpellIds: ["magic_missile", "mage_armor", "sleep", "burning_hands"] },
      choices: { speciesChoices: { keen_senses_skill: "perception" } },
    }),
    levelOneDraft({
      name: "Step Warlock",
      backgroundId: "guide",
      speciesId: "tiefling",
      lineageId: "chthonic",
      classId: "warlock",
      abilities: casterAbilities("charisma"),
      gear: { weaponIds: ["quarterstaff"], armorId: "leather", shieldId: null },
      spells: { knownSpellIds: ["eldritch_grasp", "dread_whisper"], preparedSpellIds: ["hex"] },
    }),
    levelOneDraft({
      name: "Step Cleric",
      backgroundId: "guard",
      speciesId: "dwarf",
      lineageId: null,
      classId: "cleric",
      abilities: casterAbilities("wisdom"),
      gear: { weaponIds: ["mace"], armorId: "scale_mail", shieldId: "shield" },
      spells: { knownSpellIds: ["guidance", "sacred_flame"], preparedSpellIds: ["cure_wounds", "bless"] },
    }),
    levelOneDraft({
      name: "Step Paladin",
      backgroundId: "guard",
      speciesId: "dragonborn",
      lineageId: "red",
      classId: "paladin",
      abilities: paladinAbilities(),
      gear: { weaponIds: ["longsword", "warhammer"], armorId: "chain_mail", shieldId: "shield" },
      choices: { weaponMasteryIds: ["longsword", "warhammer"] },
    }),
  ];
}

export function createStepCreatorSaboteurSmokeDrafts() {
  return [
    saboteurDraft({
      name: "Step Saboteur 3",
      level: 3,
      classChoices: {
        origin_device: "fire_paper",
        saboteur_cookbook_recipes: ["poison_vial", "smoke_vial"],
      },
      preparedRecipeIds: ["fire_paper", "poison_vial", "smoke_vial"],
    }),
    saboteurDraft({
      name: "Step Saboteur 4",
      level: 4,
      classChoices: {
        origin_device: "lightning_paper",
        saboteur_cookbook_recipes: ["tar_vial", "grave_paper"],
      },
      preparedRecipeIds: ["lightning_paper", "tar_vial", "grave_paper"],
    }),
  ];
}

function levelOneDraft({ name, backgroundId, speciesId, lineageId, classId, abilities, gear, spells = {}, choices = {} }) {
  return createEmptyCharacterDraft({
    identity: {
      characterName: name,
      level: 1,
      backgroundId,
      speciesId,
      lineageId,
      classId,
      subclassId: null,
      pactId: null,
    },
    abilities,
    choices: {
      backgroundAbilityScores: backgroundAbilityScoresFor(backgroundId, classId),
      ...choices,
    },
    gear: { inventory: [{ id: "healing_potion", quantity: 1 }], attunedItemIds: [], ...gear },
    spells,
  });
}

function saboteurDraft({ name, level, classChoices, preparedRecipeIds }) {
  return createEmptyCharacterDraft({
    identity: {
      characterName: name,
      level,
      backgroundId: "criminal",
      speciesId: "halfling",
      lineageId: "lightfoot",
      classId: "rogue",
      subclassId: "saboteur",
      pactId: null,
    },
    abilities: {
      strength: 8,
      dexterity: 15,
      constitution: 13,
      intelligence: 14,
      wisdom: 10,
      charisma: 11,
    },
    choices: {
      backgroundAbilityScores: backgroundAbilityScoresFor("criminal", "rogue"),
      weaponMasteryIds: ["rapier", "dagger"],
      classChoices,
    },
    gear: {
      weaponIds: ["rapier", "dagger"],
      armorId: "studded_leather",
      shieldId: null,
      inventory: [{ id: "healing_potion", quantity: 1 }],
      attunedItemIds: [],
    },
    devices: { preparedRecipeIds },
  });
}

function backgroundAbilityScoresFor(backgroundId, classId) {
  const preferences = {
    fighter: ["strength", "constitution"],
    rogue: ["dexterity", "charisma"],
    wizard: ["intelligence", "dexterity"],
    warlock: ["charisma", "constitution"],
    cleric: ["wisdom", "constitution"],
    paladin: ["strength", "charisma"],
  };
  const allowed = {
    soldier: ["strength", "constitution", "dexterity"],
    criminal: ["dexterity", "intelligence", "charisma"],
    guide: ["dexterity", "wisdom", "constitution"],
    guard: ["strength", "constitution", "wisdom"],
  };
  const available = allowed[backgroundId] || [];
  const preferred = preferences[classId] || available;
  const first = preferred.find((ability) => available.includes(ability)) || available[0];
  const second = preferred.find((ability) => ability !== first && available.includes(ability)) || available.find((ability) => ability !== first);
  return [
    first ? { ability: first, bonus: 2 } : null,
    second ? { ability: second, bonus: 1 } : null,
  ].filter(Boolean);
}

function martialAbilities(primary) {
  return {
    strength: primary === "strength" ? 15 : 12,
    dexterity: primary === "dexterity" ? 15 : 13,
    constitution: 14,
    intelligence: 8,
    wisdom: 10,
    charisma: 11,
  };
}

function casterAbilities(primary) {
  return {
    strength: 8,
    dexterity: 13,
    constitution: 14,
    intelligence: primary === "intelligence" ? 15 : 10,
    wisdom: primary === "wisdom" ? 15 : 12,
    charisma: primary === "charisma" ? 15 : 11,
  };
}

function paladinAbilities() {
  return {
    strength: 15,
    dexterity: 10,
    constitution: 13,
    intelligence: 8,
    wisdom: 11,
    charisma: 14,
  };
}
