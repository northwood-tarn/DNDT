import { createEmptyCharacterDraft } from "./characterDraft.js";
import { createCharacterRecord } from "./characterRepository.js";

const TEST_CHARACTER_IDS = ["battlemage", "saboteur", "lantern_cleric"];

export function createCombatUiTestCharacterDraft(id) {
  const builder = BUILDERS[id];
  if (!builder) throw new Error(`Unknown combat UI test character: ${id}`);
  return builder();
}

export function createCombatUiTestCharacterRecord(id, options = {}) {
  return createCharacterRecord(createCombatUiTestCharacterDraft(id), {
    id: `combat_ui_${id}_level_13`,
    slot: `combat_ui_${id}`,
    savedAt: "2026-07-19T00:00:00.000Z",
    resolveOptions: { allowNonCreationLevel: true },
    ...options,
  });
}

export function listCombatUiTestCharacters() {
  return TEST_CHARACTER_IDS.map((id) => {
    const record = createCombatUiTestCharacterRecord(id);
    return {
      id,
      name: record.resolvedCharacterSheet.identity.characterName,
      classId: record.resolvedCharacterSheet.identity.classId,
      subclassId: record.resolvedCharacterSheet.identity.subclassId,
      level: record.resolvedCharacterSheet.identity.level,
    };
  });
}

const BUILDERS = {
  battlemage: () => createEmptyCharacterDraft({
    identity: {
      characterName: "Mara Vey, Battlemage",
      level: 13,
      backgroundId: "sage",
      speciesId: "dwarf",
      classId: "wizard",
      subclassId: "battlemage",
    },
    abilities: {
      strength: 10,
      dexterity: 14,
      constitution: 15,
      intelligence: 17,
      wisdom: 12,
      charisma: 8,
    },
    choices: {
      backgroundAbilityScores: ["intelligence", "constitution"],
      classChoices: {
        arcane_armament_weapon: "longsword",
        jesters_book_spell: "magic_missile",
      },
    },
    gear: {
      weaponIds: ["wizards_staff", "longsword"],
      armorId: null,
      shieldId: null,
      inventory: [{ id: "healing_potion", quantity: 2 }],
      attunedItemIds: [],
    },
    spells: {
      knownSpellIds: ["fire_bolt", "mage_hand", "ray_of_frost", "shocking_grasp", "minor_magic"],
      preparedSpellIds: [
        "magic_missile", "shield", "mage_armor", "burning_hands",
        "misty_step", "hold_person", "shatter",
        "counterspell", "fireball", "hypnotic_pattern",
        "banishment", "greater_invisibility",
        "wall_of_force", "cone_of_cold",
        "chain_lightning", "forcecage",
      ],
    },
    presentation: {
      portraitId: "character_creator/assets/player_portraits/dwarf_feminine_01.png",
    },
    metadata: {
      source: "combat_ui_test_character",
      notes: ["Balanced level-13 Battlemage used to stress-test mixed spell and weapon combat UI."],
    },
  }),

  saboteur: () => createEmptyCharacterDraft({
    identity: {
      characterName: "Nix Calder, Saboteur",
      level: 13,
      backgroundId: "criminal",
      speciesId: "halfling",
      lineageId: "lightfoot",
      classId: "rogue",
      subclassId: "saboteur",
    },
    abilities: {
      strength: 8,
      dexterity: 17,
      constitution: 14,
      intelligence: 16,
      wisdom: 12,
      charisma: 10,
    },
    choices: {
      backgroundAbilityScores: ["dexterity", "intelligence"],
      weaponMasteryIds: ["rapier", "dagger"],
      classChoices: {
        rogue_expertise_skills: ["stealth", "investigation"],
        origin_device: "fire_paper",
        saboteur_cookbook_recipes: ["smoke_vial", "thunder_wire"],
        saboteur_advanced_recipes: ["makeshift_fan", "frost_grenado"],
      },
    },
    gear: {
      weaponIds: ["rapier", "dagger"],
      armorId: "studded_leather",
      shieldId: null,
      inventory: [{ id: "healing_potion", quantity: 2 }],
      attunedItemIds: [],
    },
    devices: {
      preparedRecipeIds: ["fire_paper", "smoke_vial", "thunder_wire", "makeshift_fan", "frost_grenado"],
    },
    presentation: {
      portraitId: "character_creator/assets/player_portraits/halfling_masculine_01.png",
    },
    metadata: {
      source: "combat_ui_test_character",
      notes: ["Balanced level-13 Saboteur with damage, control, buff, line, and reaction devices."],
    },
  }),

  lantern_cleric: () => createEmptyCharacterDraft({
    identity: {
      characterName: "Sister Elian, Lantern Cleric",
      level: 13,
      backgroundId: "acolyte",
      speciesId: "aasimar",
      classId: "cleric",
      subclassId: "lantern_domain",
    },
    abilities: {
      strength: 12,
      dexterity: 10,
      constitution: 15,
      intelligence: 10,
      wisdom: 17,
      charisma: 12,
    },
    choices: {
      backgroundAbilityScores: ["wisdom", "constitution"],
    },
    gear: {
      weaponIds: ["mace", "clerics_holy_symbol"],
      armorId: "half_plate",
      shieldId: "shield",
      inventory: [{ id: "healing_potion", quantity: 2 }],
      attunedItemIds: [],
    },
    spells: {
      knownSpellIds: ["guidance", "sacred_flame", "light", "toll_the_dead", "word_of_radiance"],
      preparedSpellIds: [
        "bless", "cure_wounds", "guiding_bolt", "shield_of_faith",
        "aid", "spiritual_weapon", "lesser_restoration",
        "spirit_guardians", "dispel_magic", "mass_healing_word",
        "banishment", "death_ward",
        "dawn", "greater_restoration",
        "heal", "fire_storm",
      ],
    },
    presentation: {
      portraitId: "character_creator/assets/player_portraits/aasimar_feminine_02.png",
      combatSpellLevelStyle: "slot_pips",
    },
    metadata: {
      source: "combat_ui_test_character",
      notes: ["Balanced level-13 Lantern Domain Cleric with healing, support, control, damage, and aura play."],
    },
  }),
};
