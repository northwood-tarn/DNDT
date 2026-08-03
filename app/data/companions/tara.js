import { createCharacterRecord } from "../../character/characterRepository.js";
import { createEmptyCharacterDraft } from "../../character/characterDraft.js";

export const TARA_COMPANION_PROFILE_VERSION = 1;

export function createTaraProfile(options = {}) {
  const authoredLevels = options.authoredLevels || Array.from({ length: 13 }, (_, index) => index + 1);
  return {
    schemaVersion: TARA_COMPANION_PROFILE_VERSION,
    id: "tara",
    name: "Tara",
    currentAuthoredLevel: Math.max(...authoredLevels),
    levelSheets: Object.fromEntries(authoredLevels.map((level) => [level, createTaraRecord(level, options)])),
  };
}

function createTaraRecord(level, options = {}) {
  const draft = createEmptyCharacterDraft({
    identity: {
      characterName: "Tara",
      level,
      backgroundId: "criminal",
      speciesId: "human",
      classId: "fighter",
      subclassId: level >= 3 ? "duelist" : null,
    },
    abilities: {
      strength: 12,
      dexterity: 15,
      constitution: 14,
      intelligence: 10,
      wisdom: 13,
      charisma: 8,
    },
    choices: {
      backgroundAbilityScores: [
        { ability: "dexterity", bonus: 2 },
        { ability: "intelligence", bonus: 1 },
      ],
      speciesChoices: {
        skillful_skill: "sleight_of_hand",
        versatile_feat: "lucky",
      },
      weaponMasteryIds: ["rapier", "shortbow", "dagger"],
      proficiencyChoices: {
        fighter_skills: ["acrobatics", "perception"],
        fighting_style: "dueling",
      },
      advancementChoices: {
        ...(level >= 4 ? {
          "class:fighter:level_4:ability_score_improvement": { featId: "piercer" },
        } : {}),
        ...(level >= 8 ? {
          "class:fighter:level_8:ability_score_improvement": { featId: "speedy" },
        } : {}),
        ...(level >= 12 ? {
          "class:fighter:level_12:ability_score_improvement": { featId: "mage_slayer" },
        } : {}),
      },
      featChoices: {
        ...(level >= 4 ? { piercer: { ability: "dexterity" } } : {}),
        ...(level >= 8 ? { speedy: { ability: "dexterity" } } : {}),
        ...(level >= 12 ? { mage_slayer: { ability: "dexterity" } } : {}),
      },
    },
    gear: {
      weaponIds: ["rapier", "shortbow"],
      armorId: "studded_leather",
      ringIds: ["ring_of_protection"],
      inventory: [{ id: "dagger", quantity: 1 }],
    },
    presentation: {
      portraitId: "assets/images/companions/portraits/tara.png",
      miniatureId: "mini_preview/assets/tara_human_rapier_v4.png",
    },
    metadata: {
      source: "authored_companion",
      notes: [`Tara level ${level} authored companion sheet.`],
    },
  });

  const record = createCharacterRecord(draft, {
    id: "tara",
    slot: "tara",
    kind: "companion",
    definitionId: `companion.tara.level_${level}`,
    actorOptions: { id: "tara", position: { x: 1, y: 1 } },
    resolveOptions: { allowNonCreationLevel: true },
    savedAt: options.savedAt || "2026-08-01T00:00:00.000Z",
  });

  applyAuthoredFighterChoices(record);
  return record;
}

function applyAuthoredFighterChoices(record) {
  const sheet = record.resolvedCharacterSheet;
  for (const skill of ["acrobatics", "perception"]) {
    if (!sheet.proficiencies.skills.includes(skill)) sheet.proficiencies.skills.push(skill);
  }
  sheet.features.push({
    id: "fighting_style:dueling",
    name: "Dueling",
    source: "class",
    sourceId: "fighter",
    kind: "fighting_style",
    description: "Gain +2 melee weapon damage while using one one-handed weapon.",
    implemented: true,
  });
  sheet.featureHooks.push({
    id: "dueling_damage",
    timing: "weapon_damage_roll",
    amount: 2,
    tags: ["weapon", "melee"],
    condition: "one_handed_weapon_only",
  });

  // The generic creator does not yet expose Fighter skill/style choices, so
  // refresh the derived fields that consume Tara's authored selections.
  record.resolvedCharacterSheet = sheet;
  record.actorDefinition.extensions.resolvedCharacterSheet = structuredClone(sheet);
  record.actorDefinition.capabilities.features = structuredClone(sheet.features);
  record.actorDefinition.capabilities.featureHooks = structuredClone(sheet.featureHooks);
  record.combatActor.characterSheet.skills.acrobatics = skillEntry(sheet, "acrobatics", "dexterity");
  record.combatActor.characterSheet.skills.perception = skillEntry(sheet, "perception", "wisdom");
  record.combatActor.features = structuredClone(sheet.features);
  record.combatActor.featureHooks = structuredClone(sheet.featureHooks);
  record.actorDefinition.extensions.combatActorBase = structuredClone(record.combatActor);
}

function skillEntry(sheet, id, ability) {
  return {
    ability,
    modifier: sheet.abilities[ability].modifier + sheet.proficiencyBonus,
    proficient: true,
    expertise: false,
  };
}

export const TARA_COMPANION_PROFILE = createTaraProfile();

export function createTaraRecruitmentRecord(level = 1) {
  const record = TARA_COMPANION_PROFILE.levelSheets[level];
  if (!record) throw new Error(`Tara does not yet have an authored level ${level} sheet`);
  return {
    id: "tara",
    definition: structuredClone(record.actorDefinition),
    instance: structuredClone(record.actorInstance),
  };
}

export default TARA_COMPANION_PROFILE;
