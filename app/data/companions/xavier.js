import { createCharacterRecord } from "../../character/characterRepository.js";
import { createEmptyCharacterDraft } from "../../character/characterDraft.js";

export const XAVIER_COMPANION_PROFILE_VERSION = 1;

export function createXavierProfile(options = {}) {
  const authoredLevels = options.authoredLevels || Array.from({ length: 13 }, (_, index) => index + 1);
  return {
    schemaVersion: XAVIER_COMPANION_PROFILE_VERSION,
    id: "xavier",
    name: "Xavier",
    currentAuthoredLevel: Math.max(...authoredLevels),
    levelSheets: Object.fromEntries(authoredLevels.map((level) => [level, createXavierRecord(level, options)])),
  };
}

function createXavierRecord(level, options = {}) {
  const draft = createEmptyCharacterDraft({
    identity: {
      characterName: "Xavier",
      level,
      backgroundId: "charlatan",
      speciesId: "elf",
      lineageId: "high",
      classId: "rogue",
      subclassId: level >= 3 ? "assassin" : null,
    },
    abilities: {
      strength: 8,
      dexterity: 15,
      constitution: 10,
      intelligence: 13,
      wisdom: 14,
      charisma: 12,
    },
    choices: {
      backgroundAbilityScores: [
        { ability: "dexterity", bonus: 2 },
        { ability: "intelligence", bonus: 1 },
      ],
      speciesChoices: {
        keen_senses_skill: "insight",
      },
      weaponMasteryIds: ["dagger", "shortbow"],
      proficiencyChoices: {
        rogue_skills: ["acrobatics", "investigation", "perception", "stealth"],
      },
      classChoices: level >= 6 ? {
        rogue_expertise_skills: ["stealth", "investigation"],
      } : {},
      featChoices: {
        skilled: {
          proficiencies: ["skill:history", "skill:persuasion", "skill:performance"],
        },
        ...(level >= 4 ? { skulker: { ability: "dexterity" } } : {}),
        ...(level >= 8 ? { mage_slayer: { ability: "dexterity" } } : {}),
        ...(level >= 12 ? { sharpshooter: { ability: "dexterity" } } : {}),
      },
      advancementChoices: {
        ...(level >= 4 ? {
          "class:rogue:level_4:ability_score_improvement": { featId: "skulker" },
        } : {}),
        ...(level >= 8 ? {
          "class:rogue:level_8:ability_score_improvement": { featId: "mage_slayer" },
        } : {}),
        ...(level >= 12 ? {
          "class:rogue:level_12:ability_score_improvement": { featId: "sharpshooter" },
        } : {}),
      },
    },
    gear: {
      weaponIds: ["dagger", "shortbow"],
      armorId: "leather_armor",
    },
    presentation: {
      portraitId: "assets/images/companions/portraits/xavier.png",
      miniatureId: "mini_preview/assets/xavier_v7.png",
    },
    metadata: {
      source: "authored_companion",
      notes: [`Xavier level ${level} authored companion sheet.`],
    },
  });

  const record = createCharacterRecord(draft, {
    id: "xavier",
    slot: "xavier",
    kind: "companion",
    definitionId: `companion.xavier.level_${level}`,
    actorOptions: { id: "xavier", position: { x: 1, y: 1 } },
    resolveOptions: { allowNonCreationLevel: true },
    savedAt: options.savedAt || "2026-08-01T00:00:00.000Z",
  });
  applyAuthoredRogueSkills(record);
  return record;
}

function applyAuthoredRogueSkills(record) {
  const sheet = record.resolvedCharacterSheet;
  for (const skill of ["acrobatics", "investigation", "perception", "stealth"]) {
    if (!sheet.proficiencies.skills.includes(skill)) sheet.proficiencies.skills.push(skill);
    record.combatActor.characterSheet.skills[skill] = skillEntry(sheet, skill, skillAbility(skill));
  }
  record.actorDefinition.extensions.resolvedCharacterSheet = structuredClone(sheet);
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

function skillAbility(skill) {
  return {
    acrobatics: "dexterity",
    investigation: "intelligence",
    perception: "wisdom",
    stealth: "dexterity",
  }[skill];
}

export const XAVIER_COMPANION_PROFILE = createXavierProfile();

export function createXavierRecruitmentRecord(level = 1) {
  const record = XAVIER_COMPANION_PROFILE.levelSheets[level];
  if (!record) throw new Error(`Xavier does not yet have an authored level ${level} sheet`);
  return {
    id: "xavier",
    definition: structuredClone(record.actorDefinition),
    instance: structuredClone(record.actorInstance),
  };
}

export default XAVIER_COMPANION_PROFILE;
