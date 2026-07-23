// app/character/characterDraft.js
//
// CharacterDraft is creator state only. It records choices the player has made;
// it does not resolve mechanics or mutate combat state.

export const ABILITY_IDS = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];

export function createEmptyCharacterDraft(overrides = {}) {
  return {
    identity: {
      characterName: "",
      level: 1,
      backgroundId: null,
      speciesId: null,
      lineageId: null,
      classId: null,
      subclassId: null,
      pactId: null,
      ...overrides.identity,
    },
    abilities: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
      ...overrides.abilities,
    },
    choices: {
      backgroundAbilityScores: [],
      backgroundOriginFeatChoice: null,
      speciesChoices: {},
      classChoices: {},
      weaponMasteryIds: [],
      featChoices: {},
      proficiencyChoices: {},
      spellChoices: {},
      ...overrides.choices,
    },
    gear: {
      weaponIds: [],
      armorId: null,
      shieldId: null,
      headwearId: null,
      ringIds: [],
      footwearId: null,
      inventory: [],
      attunedItemIds: [],
      ...overrides.gear,
    },
    spells: {
      knownSpellIds: [],
      preparedSpellIds: [],
      ...overrides.spells,
    },
    devices: {
      preparedRecipeIds: [],
      ...overrides.devices,
    },
    presentation: {
      portraitId: null,
      miniatureId: null,
      miniatureBaseId: null,
      miniatureBaseAsset: null,
      ...overrides.presentation,
    },
    metadata: {
      source: "character_creator",
      notes: [],
      ...overrides.metadata,
    },
  };
}

export function validateCharacterDraft(draft, options = {}) {
  const errors = [];
  if (!draft || typeof draft !== "object") return ["draft must be an object"];

  if (!draft.identity || typeof draft.identity !== "object") errors.push("identity is required");
  if (!draft.abilities || typeof draft.abilities !== "object") errors.push("abilities are required");
  if (!draft.choices || typeof draft.choices !== "object") errors.push("choices are required");
  if (!draft.gear || typeof draft.gear !== "object") errors.push("gear is required");
  if (!draft.spells || typeof draft.spells !== "object") errors.push("spells is required");
  if (!draft.devices || typeof draft.devices !== "object") errors.push("devices is required");

  const level = draft.identity?.level;
  if (options.allowNonCreationLevel) {
    if (!Number.isInteger(level) || level < 1 || level > 20) errors.push("identity.level must be an integer from 1 to 20");
  } else if (level !== 1) {
    errors.push("identity.level must be 1 during character creation");
  }

  for (const ability of ABILITY_IDS) {
    const score = draft.abilities?.[ability];
    if (!Number.isFinite(score)) errors.push(`abilities.${ability} must be numeric`);
  }

  if (!Array.isArray(draft.choices?.backgroundAbilityScores)) {
    errors.push("choices.backgroundAbilityScores must be an array");
  }
  if (!Array.isArray(draft.choices?.weaponMasteryIds)) errors.push("choices.weaponMasteryIds must be an array");
  if (!Array.isArray(draft.gear?.weaponIds)) errors.push("gear.weaponIds must be an array");
  if (!Array.isArray(draft.gear?.ringIds)) errors.push("gear.ringIds must be an array");
  if (!Array.isArray(draft.gear?.inventory)) errors.push("gear.inventory must be an array");
  if (!Array.isArray(draft.gear?.attunedItemIds)) errors.push("gear.attunedItemIds must be an array");
  if (!Array.isArray(draft.spells?.knownSpellIds)) errors.push("spells.knownSpellIds must be an array");
  if (!Array.isArray(draft.spells?.preparedSpellIds)) errors.push("spells.preparedSpellIds must be an array");
  if (!Array.isArray(draft.devices?.preparedRecipeIds)) errors.push("devices.preparedRecipeIds must be an array");

  return errors;
}
