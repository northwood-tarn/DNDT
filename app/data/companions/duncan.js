import { createCharacterRecord } from "../../character/characterRepository.js";
import { createEmptyCharacterDraft } from "../../character/characterDraft.js";

export const DUNCAN_COMPANION_PROFILE_VERSION = 1;

export function createDuncanProfile(options = {}) {
  const authoredLevels = options.authoredLevels || Array.from({ length: 13 }, (_, index) => index + 1);
  return {
    schemaVersion: DUNCAN_COMPANION_PROFILE_VERSION,
    id: "duncan",
    name: "Duncan",
    currentAuthoredLevel: Math.max(...authoredLevels),
    spellPreparation: {
      policy: "preserve_player_loadout_on_level_change",
      defaultPreparedSpellIds: ["cure_wounds", "healing_word", "bless", "shield_of_faith"],
    },
    levelSheets: Object.fromEntries(authoredLevels.map((level) => [level, createDuncanRecord(level, options)])),
  };
}

function createDuncanRecord(level, options = {}) {
  const draft = createEmptyCharacterDraft({
    identity: {
      characterName: "Duncan",
      level,
      backgroundId: "acolyte",
      speciesId: "human",
      classId: "cleric",
      subclassId: level >= 3 ? "lantern_domain" : null,
    },
    abilities: {
      strength: 14,
      dexterity: 10,
      constitution: 13,
      intelligence: 12,
      wisdom: 15,
      charisma: 8,
    },
    choices: {
      backgroundAbilityScores: [
        { ability: "wisdom", bonus: 2 },
        { ability: "intelligence", bonus: 1 },
      ],
      speciesChoices: {
        skillful_skill: "survival",
        versatile_feat: "healer",
      },
      proficiencyChoices: {
        cleric_skills: ["medicine", "perception"],
      },
      advancementChoices: {
        ...(level >= 4 ? {
          "class:cleric:level_4:ability_score_improvement": { featId: "inspiring_leader" },
        } : {}),
        ...(level >= 8 ? {
          "class:cleric:level_8:ability_score_improvement": { featId: "resilient" },
        } : {}),
        ...(level >= 12 ? {
          "class:cleric:level_12:ability_score_improvement": { featId: "ability_score_improvement" },
        } : {}),
      },
      featChoices: {
        ...(level >= 4 ? { inspiring_leader: { ability: "wisdom" } } : {}),
        ...(level >= 8 ? { resilient: { ability: "constitution" } } : {}),
        ...(level >= 12 ? { ability_score_improvement: { abilities: ["wisdom", "wisdom"] } } : {}),
      },
    },
    gear: {
      weaponIds: ["mace", "clerics_holy_symbol"],
      armorId: "scale_mail",
      shieldId: "shield",
    },
    spells: {
      knownSpellIds: ["mending", "resistance", "word_of_radiance"],
      preparedSpellIds: [
        "cure_wounds", "healing_word", "bless", "shield_of_faith",
        ...(level >= 5 ? ["aid", "mass_healing_word"] : []),
        ...(level >= 8 ? ["lesser_restoration", "aura_of_vitality", "revivify"] : []),
        ...(level >= 10 ? ["death_ward", "freedom_of_movement", "greater_restoration", "mass_cure_wounds", "circle_of_power"] : []),
        ...(level >= 12 ? ["heal", "heroes_feast"] : []),
      ],
    },
    presentation: {
      portraitId: "assets/images/companions/portraits/duncan.png",
      miniatureId: "mini_preview/assets/duncan_v1_chroma_cutout.png",
    },
    metadata: {
      source: "authored_companion",
      notes: [`Duncan level ${level} authored companion sheet.`],
    },
  });

  const record = createCharacterRecord(draft, {
    id: "duncan",
    slot: "duncan",
    kind: "companion",
    definitionId: `companion.duncan.level_${level}`,
    actorOptions: { id: "duncan", position: { x: 1, y: 1 } },
    resolveOptions: { allowNonCreationLevel: true },
    savedAt: options.savedAt || "2026-08-01T00:00:00.000Z",
  });
  applyAuthoredClericSkills(record);
  return record;
}

function applyAuthoredClericSkills(record) {
  const sheet = record.resolvedCharacterSheet;
  for (const skill of ["medicine", "perception"]) {
    if (!sheet.proficiencies.skills.includes(skill)) sheet.proficiencies.skills.push(skill);
    record.combatActor.characterSheet.skills[skill] = skillEntry(sheet, skill, "wisdom");
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

export const DUNCAN_COMPANION_PROFILE = createDuncanProfile();

export function createDuncanRecruitmentRecord(level = 1) {
  const record = DUNCAN_COMPANION_PROFILE.levelSheets[level];
  if (!record) throw new Error(`Duncan does not yet have an authored level ${level} sheet`);
  return {
    id: "duncan",
    definition: structuredClone(record.actorDefinition),
    instance: structuredClone(record.actorInstance),
  };
}

export default DUNCAN_COMPANION_PROFILE;
