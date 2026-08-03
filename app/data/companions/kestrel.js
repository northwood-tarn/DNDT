import { createCharacterRecord } from "../../character/characterRepository.js";
import { createEmptyCharacterDraft } from "../../character/characterDraft.js";

export const KESTREL_COMPANION_PROFILE_VERSION = 1;

export function createKestrelProfile(options = {}) {
  const authoredLevels = options.authoredLevels || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
  return {
    schemaVersion: KESTREL_COMPANION_PROFILE_VERSION,
    id: "kestrel",
    name: "Kestrel",
    pronouns: "they/them",
    currentAuthoredLevel: Math.max(...authoredLevels),
    mysticArcanumByLevel: {
      11: "mental_prison",
      13: "forcecage",
    },
    presentationVariants: {
      default: "court_transformed",
      court_transformed: "mini_preview/assets/kestrel_locked.png",
    },
    levelSheets: Object.fromEntries(authoredLevels.map((level) => [level, createKestrelRecord(level, options)])),
  };
}

function createKestrelRecord(level, options = {}) {
  const draft = createEmptyCharacterDraft({
    identity: {
      characterName: "Kestrel",
      level,
      backgroundId: "noble",
      speciesId: "tiefling",
      lineageId: "chthonic",
      classId: "warlock",
      subclassId: level >= 3 ? "the_lantern" : null,
      pactId: level >= 3 ? "pact_of_the_tessera" : null,
    },
    abilities: {
      strength: 8,
      dexterity: 14,
      constitution: 10,
      intelligence: 12,
      wisdom: 13,
      charisma: 15,
    },
    choices: {
      backgroundAbilityScores: [
        { ability: "charisma", bonus: 2 },
        { ability: "wisdom", bonus: 1 },
      ],
      proficiencyChoices: {
        warlock_skills: ["arcana", "investigation"],
      },
      classChoices: level >= 11 ? {
        mystic_arcanum_spell: "mental_prison",
      } : {},
      advancementChoices: level >= 4 ? {
        "class:warlock:level_4:ability_score_improvement": { featId: "war_caster" },
        ...(level >= 8 ? { "class:warlock:level_8:ability_score_improvement": { featId: "ability_score_improvement" } } : {}),
        ...(level >= 12 ? { "class:warlock:level_12:ability_score_improvement": { featId: "ability_score_improvement" } } : {}),
      } : {},
      advancementFeatChoices: {
        ...(level >= 8 ? {
          "class:warlock:level_8:ability_score_improvement": { abilities: ["charisma", "charisma"] },
        } : {}),
        ...(level >= 12 ? {
          "class:warlock:level_12:ability_score_improvement": { abilities: ["constitution", "constitution"] },
        } : {}),
      },
      featChoices: {
        skilled: {
          proficiencies: ["skill:insight", "skill:perception", "skill:medicine"],
        },
        ...(level >= 4 ? { war_caster: { ability: "charisma" } } : {}),
      },
    },
    gear: {
      weaponIds: ["warlocks_gloves", "dagger"],
      armorId: "leather_armor",
    },
    spells: {
      knownSpellIds: [
        "eldritch_blast", "blade_ward", "armor_of_agathys", "hellish_rebuke",
        ...(level >= 4 ? ["leech", "shatter"] : []),
        ...(level >= 8 ? ["counterspell", "banishment", "fireball", "blight"] : []),
        ...(level >= 10 ? ["mind_sliver", "wall_of_force", "arms_of_hadar", "synaptic_static"] : []),
        ...(level >= 12 ? ["fear"] : []),
        ...(level >= 13 ? ["forcecage"] : []),
      ],
    },
    presentation: {
      portraitId: "assets/images/companions/portraits/kestrel.png",
      miniatureId: "mini_preview/assets/kestrel_locked.png",
    },
    metadata: {
      source: "authored_companion",
      notes: [
        `Kestrel level ${level} authored companion sheet.`,
        "Kestrel uses they/them pronouns.",
        "Kestrel was born a Chthonic Tiefling with horns, a tail, and chthonic skin markings. Court enhancement and abuse provoked a survival transformation into their present Aasimar-adjacent appearance.",
      ],
    },
  });

  const record = createCharacterRecord(draft, {
    id: "kestrel",
    slot: "kestrel",
    kind: "companion",
    definitionId: `companion.kestrel.level_${level}`,
    actorOptions: { id: "kestrel", position: { x: 1, y: 1 } },
    resolveOptions: { allowNonCreationLevel: true },
    savedAt: options.savedAt || "2026-08-01T00:00:00.000Z",
  });
  applyAuthoredWarlockSkills(record);
  applyAuthoredWeaponSets(record);
  return record;
}

function applyAuthoredWarlockSkills(record) {
  if (!record.combatActor) {
    throw new Error(`Kestrel base sheet is invalid: ${JSON.stringify(record.validityReport)}`);
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

function applyAuthoredWeaponSets(record) {
  const weaponSetIds = [["warlocks_gloves", "warlocks_gloves"], ["dagger", null]];
  record.resolvedCharacterSheet.equipment.weaponSetIds = structuredClone(weaponSetIds);
  record.combatActor.equipment.weaponSetIds = structuredClone(weaponSetIds);
  record.actorDefinition.extensions.resolvedCharacterSheet = structuredClone(record.resolvedCharacterSheet);
  record.actorDefinition.extensions.combatActorBase = structuredClone(record.combatActor);
}

export const KESTREL_COMPANION_PROFILE = createKestrelProfile();

export function createKestrelRecruitmentRecord(level = 1) {
  const record = KESTREL_COMPANION_PROFILE.levelSheets[level];
  if (!record) throw new Error(`Kestrel does not yet have an authored level ${level} sheet`);
  return {
    id: "kestrel",
    definition: structuredClone(record.actorDefinition),
    instance: structuredClone(record.actorInstance),
  };
}

export default KESTREL_COMPANION_PROFILE;
