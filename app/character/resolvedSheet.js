// app/character/resolvedSheet.js
//
// ResolvedCharacterSheet is the authoritative output of character creation.
// Combat, publishing, and UI preview layers consume this shape instead of
// reaching back into raw data files or creator draft state.

import { ABILITY_IDS } from "./characterDraft.js";

export function createEmptyResolvedCharacterSheet(overrides = {}) {
  return {
    identity: {
      characterName: "",
      level: 1,
      backgroundId: null,
      backgroundName: null,
      speciesId: null,
      speciesName: null,
      classId: null,
      className: null,
      subclassId: null,
      subclassName: null,
      pactId: null,
      pactName: null,
      ...overrides.identity,
    },
    abilities: Object.fromEntries(ABILITY_IDS.map((ability) => [
      ability,
      { score: 10, modifier: 0, sources: [] },
    ])),
    proficiencyBonus: 2,
    proficiencies: {
      skills: [],
      tools: [],
      expertise: [],
      armor: [],
      weapons: [],
      savingThrows: [],
      ...overrides.proficiencies,
    },
    combatBasics: {
      armorClass: null,
      initiativeBonus: null,
      speed: null,
      senses: [],
      passivePerception: null,
      saves: {},
      attackActionAttacks: 1,
      ...overrides.combatBasics,
    },
    durability: {
      maxHp: null,
      hitDice: null,
      resistances: [],
      immunities: [],
      conditionImmunities: [],
      hitPointBonuses: [],
      ...overrides.durability,
    },
    attacks: [],
    resources: [],
    features: [],
    featureHooks: [],
    advancement: {
      abilityScoreImprovements: [],
      ...overrides.advancement,
    },
    narrative: {
      tags: [],
      ...overrides.narrative,
    },
    spellcasting: {
      canCast: false,
      source: null,
      classId: null,
      ability: null,
      preparation: null,
      pactMagic: false,
      ritualCasting: false,
      startsAtLevel: null,
      spellSaveDc: null,
      spellAttackBonus: null,
      slots: {},
      knownSpellIds: [],
      preparedSpellIds: [],
      ...overrides.spellcasting,
    },
    equipment: {
      weaponIds: [],
      armorId: null,
      shieldId: null,
      inventory: [],
      attunedItemIds: [],
      ...overrides.equipment,
    },
    metadata: {
      resolverVersion: 1,
      unresolved: [],
      notes: [],
      classChoices: {},
      ...overrides.metadata,
    },
  };
}

export function validateResolvedCharacterSheet(sheet) {
  const errors = [];
  if (!sheet || typeof sheet !== "object") return ["sheet must be an object"];

  for (const section of [
    "identity",
    "abilities",
    "proficiencies",
    "combatBasics",
    "durability",
    "narrative",
    "spellcasting",
    "equipment",
    "metadata",
  ]) {
    if (!sheet[section] || typeof sheet[section] !== "object") errors.push(`${section} is required`);
  }

  if (!Number.isInteger(sheet.identity?.level) || sheet.identity.level < 1 || sheet.identity.level > 20) {
    errors.push("identity.level must be an integer from 1 to 20");
  }
  if (!Number.isFinite(sheet.proficiencyBonus)) errors.push("proficiencyBonus must be numeric");
  if (!Array.isArray(sheet.narrative?.tags)) errors.push("narrative.tags must be an array");

  for (const ability of ABILITY_IDS) {
    const entry = sheet.abilities?.[ability];
    if (!entry || typeof entry !== "object") {
      errors.push(`abilities.${ability} is required`);
      continue;
    }
    if (!Number.isFinite(entry.score)) errors.push(`abilities.${ability}.score must be numeric`);
    if (!Number.isFinite(entry.modifier)) errors.push(`abilities.${ability}.modifier must be numeric`);
    if (!Array.isArray(entry.sources)) errors.push(`abilities.${ability}.sources must be an array`);
  }

  for (const path of [
    "proficiencies.skills",
    "proficiencies.tools",
    "proficiencies.expertise",
    "proficiencies.armor",
    "proficiencies.weapons",
    "proficiencies.savingThrows",
    "attacks",
    "resources",
    "features",
    "featureHooks",
    "advancement.abilityScoreImprovements",
    "equipment.weaponIds",
    "equipment.inventory",
    "equipment.attunedItemIds",
    "metadata.unresolved",
    "metadata.notes",
    "metadata.classChoices",
    "durability.hitPointBonuses",
  ]) {
    const value = path.split(".").reduce((node, key) => node?.[key], sheet);
    if (path === "metadata.classChoices") {
      if (!value || typeof value !== "object" || Array.isArray(value)) errors.push(`${path} must be an object`);
    } else if (!Array.isArray(value)) errors.push(`${path} must be an array`);
  }

  if (sheet.combatBasics?.armorClass !== null && !Number.isFinite(sheet.combatBasics.armorClass)) {
    errors.push("combatBasics.armorClass must be numeric or null");
  }
  if (sheet.combatBasics?.initiativeBonus !== null && !Number.isFinite(sheet.combatBasics.initiativeBonus)) {
    errors.push("combatBasics.initiativeBonus must be numeric or null");
  }
  if (sheet.combatBasics?.passivePerception !== null && !Number.isFinite(sheet.combatBasics.passivePerception)) {
    errors.push("combatBasics.passivePerception must be numeric or null");
  }
  if (!sheet.combatBasics?.saves || typeof sheet.combatBasics.saves !== "object" || Array.isArray(sheet.combatBasics.saves)) {
    errors.push("combatBasics.saves must be an object");
  }
  if (!Number.isFinite(sheet.combatBasics?.attackActionAttacks)) {
    errors.push("combatBasics.attackActionAttacks must be numeric");
  }

  return errors;
}
