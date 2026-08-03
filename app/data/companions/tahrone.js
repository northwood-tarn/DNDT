import { createCharacterRecord } from "../../character/characterRepository.js";
import { createEmptyCharacterDraft } from "../../character/characterDraft.js";

export const TAHRONE_COMPANION_PROFILE_VERSION = 1;

const TAHRONE_SPELLBOOK_ADDITIONS = {
  1: ["mage_armor", "shield", "false_life", "ray_of_sickness", "detect_magic", "silent_image"],
  2: ["witch_bolt", "magic_missile"],
  3: ["misty_step", "darkness"],
  4: ["hold_foe", "shatter"],
  5: ["counterspell", "hypnotic_pattern"],
  6: ["remove_curse", "fireball"],
  7: ["blight", "phantasmal_killer"],
  8: ["dimension_door", "fire_shield"],
  9: ["cone_of_cold", "wall_of_force"],
  10: ["cloudkill", "dispel_magic"],
  11: ["circle_of_death", "disintegrate"],
  12: ["chain_lightning", "globe_of_invulnerability"],
  13: ["finger_of_death", "forcecage"],
};

export function createTahroneProfile(options = {}) {
  const authoredLevels = options.authoredLevels || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
  return {
    schemaVersion: TAHRONE_COMPANION_PROFILE_VERSION,
    id: "tahrone",
    name: "Tahrone",
    currentAuthoredLevel: Math.max(...authoredLevels),
    spellPreparation: {
      policy: "preserve_player_loadout_on_level_change",
      defaultPreparedSpellIds: ["mage_armor", "shield", "false_life", "ray_of_sickness"],
      placeholderAdditionsByLevel: {
        5: ["counterspell", "hypnotic_pattern"],
        8: ["fireball", "dimension_door", "fire_shield"],
        10: ["cone_of_cold", "wall_of_force", "cloudkill", "dispel_magic", "blight"],
        12: ["chain_lightning", "globe_of_invulnerability"],
      },
    },
    spellbook: {
      policy: "retain_all_learned_spells_across_level_changes",
      additionsByLevel: structuredClone(TAHRONE_SPELLBOOK_ADDITIONS),
    },
    presentationVariants: {
      default: "masked",
      masked: "mini_preview/assets/tahrone_masked_base.png",
      unmasked: "mini_preview/assets/tahrone_unmasked_wide_curved_mask_on_belt.png",
    },
    levelSheets: Object.fromEntries(authoredLevels.map((level) => [level, createTahroneRecord(level, options)])),
  };
}

function createTahroneRecord(level, options = {}) {
  const draft = createEmptyCharacterDraft({
    identity: {
      characterName: "Tahrone",
      level,
      backgroundId: "noble",
      speciesId: "aasimar",
      classId: "wizard",
      subclassId: level >= 3 ? "necromancer" : null,
    },
    abilities: {
      strength: 8,
      dexterity: 14,
      constitution: 13,
      intelligence: 15,
      wisdom: 12,
      charisma: 10,
    },
    choices: {
      backgroundAbilityScores: [
        { ability: "intelligence", bonus: 2 },
        { ability: "wisdom", bonus: 1 },
      ],
      proficiencyChoices: {
        wizard_skills: ["arcana", "investigation"],
      },
      classChoices: level >= 10 ? {
        jesters_book_spell: "false_life_jester",
      } : {},
      advancementChoices: level >= 4 ? {
        "class:wizard:level_4:ability_score_improvement": { featId: "keen_mind" },
        ...(level >= 8 ? { "class:wizard:level_8:ability_score_improvement": { featId: "war_caster" } } : {}),
        ...(level >= 12 ? { "class:wizard:level_12:ability_score_improvement": { featId: "ability_score_improvement" } } : {}),
      } : {},
      featChoices: {
        skilled: {
          proficiencies: ["skill:medicine", "skill:religion", "skill:insight"],
        },
        ...(level >= 4 ? { keen_mind: { skill: "arcana" } } : {}),
        ...(level >= 8 ? { war_caster: { ability: "intelligence" } } : {}),
        ...(level >= 12 ? { ability_score_improvement: { abilities: ["intelligence", "constitution"] } } : {}),
      },
    },
    gear: {
      weaponIds: ["wizards_staff"],
      inventory: [{ id: "dagger", quantity: 1 }],
    },
    spells: {
      knownSpellIds: [
        "chill_touch", "mind_sliver", "mending",
        ...(level >= 5 ? ["shocking_grasp"] : []),
        ...(level >= 10 ? ["ray_of_frost"] : []),
      ],
      preparedSpellIds: [
        "mage_armor", "shield", "false_life", "ray_of_sickness",
        ...(level >= 5 ? ["counterspell", "hypnotic_pattern"] : []),
        ...(level >= 8 ? ["fireball", "dimension_door", "fire_shield"] : []),
        ...(level >= 10 ? ["cone_of_cold", "wall_of_force", "cloudkill", "dispel_magic", "blight"] : []),
        ...(level >= 12 ? ["chain_lightning", "globe_of_invulnerability"] : []),
      ],
    },
    presentation: {
      portraitId: "assets/images/companions/portraits/tahrone.png",
      miniatureId: "mini_preview/assets/tahrone_masked_base.png",
    },
    metadata: {
      source: "authored_companion",
      notes: [`Tahrone level ${level} authored companion sheet.`],
      spellbookSpellIds: spellbookThroughLevel(level),
    },
  });

  const record = createCharacterRecord(draft, {
    id: "tahrone",
    slot: "tahrone",
    kind: "companion",
    definitionId: `companion.tahrone.level_${level}`,
    actorOptions: { id: "tahrone", position: { x: 1, y: 1 } },
    resolveOptions: { allowNonCreationLevel: true },
    savedAt: options.savedAt || "2026-08-01T00:00:00.000Z",
  });
  applyAuthoredWizardSkills(record);
  return record;
}

function spellbookThroughLevel(level) {
  return Object.entries(TAHRONE_SPELLBOOK_ADDITIONS)
    .filter(([learnedLevel]) => Number(learnedLevel) <= level)
    .flatMap(([, spellIds]) => spellIds);
}

function applyAuthoredWizardSkills(record) {
  if (!record.combatActor) {
    throw new Error(`Tahrone base sheet is invalid: ${JSON.stringify(record.validityReport)}`);
  }
  const sheet = record.resolvedCharacterSheet;
  for (const [skill, ability] of [["arcana", "intelligence"], ["investigation", "intelligence"]]) {
    if (!sheet.proficiencies.skills.includes(skill)) sheet.proficiencies.skills.push(skill);
    record.combatActor.characterSheet.skills[skill] = {
      ability,
      modifier: sheet.abilities[ability].modifier + sheet.proficiencyBonus,
      proficient: true,
      expertise: false,
    };
  }
  record.actorDefinition.extensions.resolvedCharacterSheet = structuredClone(sheet);
  record.actorDefinition.extensions.combatActorBase = structuredClone(record.combatActor);
}

export const TAHRONE_COMPANION_PROFILE = createTahroneProfile();

export function createTahroneRecruitmentRecord(level = 1) {
  const record = TAHRONE_COMPANION_PROFILE.levelSheets[level];
  if (!record) throw new Error(`Tahrone does not yet have an authored level ${level} sheet`);
  return {
    id: "tahrone",
    definition: structuredClone(record.actorDefinition),
    instance: structuredClone(record.actorInstance),
  };
}

export default TAHRONE_COMPANION_PROFILE;
