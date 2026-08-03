import { createCharacterRecord } from "../../character/characterRepository.js";
import { createEmptyCharacterDraft } from "../../character/characterDraft.js";

export const DANICA_COMPANION_PROFILE_VERSION = 1;

export function createDanicaProfile(options = {}) {
  const authoredLevels = options.authoredLevels || Array.from({ length: 13 }, (_, index) => index + 1);
  return {
    schemaVersion: DANICA_COMPANION_PROFILE_VERSION,
    id: "danica",
    name: "Danica",
    currentAuthoredLevel: Math.max(...authoredLevels),
    spellPreparation: {
      policy: "preserve_player_loadout_on_level_change",
      defaultPreparedSpellIds: ["bless", "shield_of_faith"],
    },
    levelSheets: Object.fromEntries(authoredLevels.map((level) => [level, createDanicaRecord(level, options)])),
  };
}

function createDanicaRecord(level, options = {}) {
  const draft = createEmptyCharacterDraft({
    identity: {
      characterName: "Danica",
      level,
      backgroundId: "soldier",
      speciesId: "human",
      classId: "paladin",
      subclassId: level >= 3 ? "oath_of_vengeance" : null,
    },
    abilities: {
      strength: 15,
      dexterity: 8,
      constitution: 13,
      intelligence: 10,
      wisdom: 12,
      charisma: 14,
    },
    choices: {
      backgroundAbilityScores: [
        { ability: "strength", bonus: 2 },
        { ability: "constitution", bonus: 1 },
      ],
      speciesChoices: {
        skillful_skill: "perception",
        versatile_feat: "alert",
      },
      weaponMasteryIds: ["greatsword", "javelin"],
      proficiencyChoices: {
        paladin_skills: ["insight", "investigation"],
      },
      advancementChoices: {
        ...(level >= 4 ? {
          "class:paladin:level_4:ability_score_improvement": { featId: "great_weapon_master" },
        } : {}),
        ...(level >= 8 ? {
          "class:paladin:level_8:ability_score_improvement": { featId: "ability_score_improvement" },
        } : {}),
        ...(level >= 12 ? {
          "class:paladin:level_12:ability_score_improvement": { featId: "heavy_armor_master" },
        } : {}),
      },
      featChoices: {
        ...(level >= 4 ? { great_weapon_master: { ability: "strength" } } : {}),
        ...(level >= 8 ? { ability_score_improvement: { abilities: ["strength", "charisma"] } } : {}),
        ...(level >= 12 ? { heavy_armor_master: { ability: "strength" } } : {}),
      },
    },
    gear: {
      weaponIds: ["greatsword", "clerics_holy_symbol"],
      armorId: level >= 12 ? "plate_armor" : "half_plate",
      inventory: [{ id: "javelin", quantity: 1 }],
    },
    spells: {
      preparedSpellIds: [
        "bless",
        "shield_of_faith",
        ...(level >= 4 ? ["protection_from_evil_and_good"] : []),
        ...(level >= 8 ? ["aid", "magic_weapon", "lesser_restoration"] : []),
        ...(level >= 10 ? ["crusaders_mantle"] : []),
        ...(level >= 12 ? ["revivify"] : []),
      ],
    },
    presentation: {
      portraitId: "assets/images/companions/portraits/danica.png",
      miniatureId: "mini_preview/assets/danica_v4_locked.png",
    },
    metadata: {
      source: "authored_companion",
      notes: [
        `Danica level ${level} authored companion sheet.`,
        "Danica is definitively black-haired.",
        ...(level >= 12 ? ["Plate armour is an authored story upgrade tied to Danica's growth into guardianship."] : []),
      ],
    },
  });

  const record = createCharacterRecord(draft, {
    id: "danica",
    slot: "danica",
    kind: "companion",
    definitionId: `companion.danica.level_${level}`,
    actorOptions: { id: "danica", position: { x: 1, y: 1 } },
    resolveOptions: { allowNonCreationLevel: true },
    savedAt: options.savedAt || "2026-08-01T00:00:00.000Z",
  });
  applyAuthoredPaladinSkills(record);
  applyFathersGuard(record);
  return record;
}

function applyAuthoredPaladinSkills(record) {
  if (!record.combatActor) {
    throw new Error(`Danica base sheet is invalid: ${JSON.stringify(record.validityReport)}`);
  }
  const sheet = record.resolvedCharacterSheet;
  for (const [skill, ability] of [["insight", "wisdom"], ["investigation", "intelligence"]]) {
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

function applyFathersGuard(record) {
  const feature = {
    id: "companion:danica:fathers_guard",
    name: "Father’s Guard",
    source: "companion",
    sourceId: "duncan",
    kind: "passive",
    iconId: "fathers_guard",
    iconSrc: "assets/images/companions/abilities/fathers_guard.png",
    description: "Duncan’s lessons remain in Danica’s stance. While wearing armor, she gains +1 AC.",
    effects: {
      featureHooks: [{
        id: "fathers_guard_ac_while_armored",
        timing: "armor_class",
        amount: 1,
        condition: "wearing_armor",
      }],
    },
    implemented: true,
  };
  const hook = structuredClone(feature.effects.featureHooks[0]);
  record.resolvedCharacterSheet.features.push(structuredClone(feature));
  record.resolvedCharacterSheet.featureHooks.push(hook);
  if (record.resolvedCharacterSheet.equipment.armorId) {
    record.resolvedCharacterSheet.combatBasics.armorClass += 1;
    record.combatActor.ac += 1;
    record.combatActor.armorClassSources.push({ id: "fathers_guard", label: "Father’s Guard", amount: 1 });
  }
  record.combatActor.features.push(structuredClone(feature));
  record.combatActor.featureHooks.push(structuredClone(hook));
  record.actorDefinition.extensions.resolvedCharacterSheet = structuredClone(record.resolvedCharacterSheet);
  record.actorDefinition.extensions.combatActorBase = structuredClone(record.combatActor);
}

export const DANICA_COMPANION_PROFILE = createDanicaProfile();

export function createDanicaRecruitmentRecord(level = 1) {
  const record = DANICA_COMPANION_PROFILE.levelSheets[level];
  if (!record) throw new Error(`Danica does not yet have an authored level ${level} sheet`);
  return {
    id: "danica",
    definition: structuredClone(record.actorDefinition),
    instance: structuredClone(record.actorInstance),
  };
}

export default DANICA_COMPANION_PROFILE;
