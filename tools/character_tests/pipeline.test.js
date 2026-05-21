import assert from "node:assert/strict";
import {
  createEmptyCharacterDraft,
  resolveCharacterSheet,
  resolvedSheetToCombatActor,
  validateResolvedCharacterSheet,
  validateResolvedSheetCombatActor,
} from "../../app/character/index.js";

export function runCharacterPipelineTests() {
  resolvesBackgroundIntoSheet();
  resolvesSpeciesIntoSheet();
  resolvesDeclarativeSpeciesFeatureEffects();
  resolvesSpeciesFeatureChoices();
  reportsMissingLineageChoices();
  resolvesClassIntoSheet();
  resolvesCombatReadySheetFields();
  doesNotRequireLevelOneSubclassChoices();
  rejectsPrematureSubclassChoices();
  resolvesLevelThreeSubclassFeaturesWhenExplicitlyAllowed();
  resolvesDeclarativeClassFeatureEffects();
  resolvesWideImpactClassFeatureEffects();
  resolvesOriginFeatEffects();
  resolvesGeneralFeatEffects();
  resolvesClassSpecificMagicInitiates();
  reportsMissingOriginFeatChoices();
  rejectsInvalidOriginFeatToolChoices();
  resolvesSkillOrToolOriginFeatChoices();
  preservesDraftGearAndSpellsWithoutResolvingMechanics();
}

function resolvesGeneralFeatEffects() {
  const testBackgrounds = {
    resilient_training: {
      id: "resilient_training",
      name: "Resilient Training",
      skillProficiencies: [],
      toolProficiencies: [],
      originFeat: "resilient",
    },
    light_guard: {
      id: "light_guard",
      name: "Light Guard",
      skillProficiencies: [],
      toolProficiencies: [],
      originFeat: "lightly_armored",
    },
    fey_touched: {
      id: "fey_touched",
      name: "Fey Touched",
      skillProficiencies: [],
      toolProficiencies: [],
      originFeat: "fey_touched",
    },
    medium_master: {
      id: "medium_master",
      name: "Medium Master",
      skillProficiencies: [],
      toolProficiencies: [],
      originFeat: "medium_armor_master",
    },
    great_weapon_master: {
      id: "great_weapon_master",
      name: "Great Weapon Master",
      skillProficiencies: [],
      toolProficiencies: [],
      originFeat: "great_weapon_master",
    },
  };
  const resilientDraft = createEmptyCharacterDraft({
    identity: { characterName: "Test Resilient", level: 4, backgroundId: "resilient_training" },
    choices: { featChoices: { resilient: { ability: ["constitution"] } } },
  });
  const armorDraft = createEmptyCharacterDraft({
    identity: { characterName: "Test Armored", level: 4, backgroundId: "light_guard" },
    choices: { featChoices: { lightly_armored: { ability: ["dexterity"] } } },
  });
  const feyDraft = createEmptyCharacterDraft({
    identity: { characterName: "Test Fey", level: 4, backgroundId: "fey_touched" },
    choices: { featChoices: { fey_touched: { ability: ["charisma"], step: ["misty_step"], spell: ["bless"] } } },
  });
  const mediumDraft = createEmptyCharacterDraft({
    identity: { characterName: "Test Medium", level: 4, backgroundId: "medium_master" },
    abilities: {
      strength: 10,
      dexterity: 16,
      constitution: 12,
      intelligence: 8,
      wisdom: 13,
      charisma: 14,
    },
    choices: { featChoices: { medium_armor_master: { ability: ["dexterity"] } } },
    gear: { weaponIds: ["dagger"], armorId: "half_plate", shieldId: null, inventory: [], attunedItemIds: [] },
  });
  const greatWeaponDraft = createEmptyCharacterDraft({
    identity: { characterName: "Test Heavy", level: 4, backgroundId: "great_weapon_master" },
  });

  const resilientSheet = resolveCharacterSheet(resilientDraft, { backgrounds: testBackgrounds }, { allowNonCreationLevel: true });
  assert.equal(resilientSheet.abilities.constitution.score, 11);
  assert.equal(resilientSheet.proficiencies.savingThrows.includes("constitution"), true);
  assert.equal(resilientSheet.combatBasics.saves.constitution, 2);
  assert.deepEqual(resilientSheet.metadata.unresolved, []);

  const armorSheet = resolveCharacterSheet(armorDraft, { backgrounds: testBackgrounds }, { allowNonCreationLevel: true });
  assert.equal(armorSheet.abilities.dexterity.score, 11);
  assert.equal(armorSheet.proficiencies.armor.includes("light"), true);
  assert.equal(armorSheet.proficiencies.armor.includes("shield"), true);
  assert.deepEqual(armorSheet.metadata.unresolved, []);

  const feySheet = resolveCharacterSheet(feyDraft, { backgrounds: testBackgrounds }, { allowNonCreationLevel: true });
  assert.equal(feySheet.abilities.charisma.score, 11);
  assert.equal(feySheet.spellcasting.knownSpellIds.includes("misty_step"), true);
  assert.equal(feySheet.spellcasting.knownSpellIds.includes("bless"), true);
  assert.equal(feySheet.resources.some((item) => item.id === "fey_touched_misty_step"), true);
  assert.equal(feySheet.resources.some((item) => item.id === "fey_touched_bless"), true);
  assert.deepEqual(feySheet.metadata.unresolved, []);

  const mediumSheet = resolveCharacterSheet(mediumDraft, { backgrounds: testBackgrounds }, { allowNonCreationLevel: true });
  assert.equal(mediumSheet.combatBasics.armorClass, 18);
  assert.deepEqual(mediumSheet.metadata.unresolved, []);

  const greatWeaponSheet = resolveCharacterSheet(greatWeaponDraft, { backgrounds: testBackgrounds }, { allowNonCreationLevel: true });
  assert.equal(greatWeaponSheet.abilities.strength.score, 11);
  assert.equal(greatWeaponSheet.featureHooks.some((hook) => hook.id === "great_weapon_master_heavy_damage"), true);
  assert.deepEqual(greatWeaponSheet.metadata.unresolved, []);
}

function resolvesBackgroundIntoSheet() {
  const draft = createEmptyCharacterDraft({
    identity: {
      characterName: "Test Acolyte",
      level: 1,
      backgroundId: "acolyte",
    },
    abilities: {
      strength: 8,
      dexterity: 14,
      constitution: 13,
      intelligence: 12,
      wisdom: 15,
      charisma: 10,
    },
  });

  const sheet = resolveCharacterSheet(draft);
  assert.equal(sheet.identity.backgroundName, "Acolyte");
  assert.equal(sheet.proficiencyBonus, 2);
  assert.equal(sheet.abilities.wisdom.modifier, 2);
  assert.deepEqual(sheet.proficiencies.skills, ["insight", "religion"]);
  assert.deepEqual(sheet.proficiencies.tools, ["calligraphers_supplies"]);
  assert.equal(sheet.features[0].grants.featId, "magic_initiate_cleric");
  assert.equal(sheet.features[0].implemented, true);
  assert.equal(sheet.spellcasting.knownSpellIds.includes("guidance"), true);
  assert.equal(sheet.spellcasting.knownSpellIds.includes("sacred_flame"), true);
  assert.equal(sheet.spellcasting.knownSpellIds.includes("cure_wounds"), true);
  assert.equal(sheet.resources.some((item) => item.id === "magic_initiate_cleric_cure_wounds" && item.max === 1), true);
  assert.deepEqual(validateResolvedCharacterSheet(sheet), []);
}

function resolvesSpeciesIntoSheet() {
  const draft = createEmptyCharacterDraft({
    identity: {
      characterName: "Test Infernal Tiefling",
      level: 1,
      backgroundId: "soldier",
      speciesId: "tiefling",
      lineageId: "infernal",
    },
  });

  const sheet = resolveCharacterSheet(draft);
  assert.equal(sheet.identity.speciesName, "Tiefling");
  assert.equal(sheet.identity.lineageName, "Infernal");
  assert.equal(sheet.identity.size, "Medium");
  assert.equal(sheet.combatBasics.speed, 30);
  assert.deepEqual(sheet.combatBasics.senses, [{ type: "darkvision", rangeFt: 60 }]);
  assert.deepEqual(sheet.durability.resistances, ["fire"]);
  assert.equal(sheet.features.some((item) => item.id === "species:tiefling:otherworldly_presence" && item.grants.spellId === "thaumaturgy"), true);
  assert.equal(sheet.features.some((item) => item.id === "species:tiefling.infernal:infernal_legacy_1" && item.grants.spellId === "fire_bolt"), true);
}

function resolvesDeclarativeSpeciesFeatureEffects() {
  const dwarfDraft = createEmptyCharacterDraft({
    identity: {
      characterName: "Test Dwarf",
      level: 1,
      speciesId: "dwarf",
    },
  });
  const orcDraft = createEmptyCharacterDraft({
    identity: {
      characterName: "Test Orc",
      level: 1,
      speciesId: "orc",
    },
  });
  const aasimarDraft = createEmptyCharacterDraft({
    identity: {
      characterName: "Test Aasimar",
      level: 1,
      speciesId: "aasimar",
    },
  });

  const dwarfSheet = resolveCharacterSheet(dwarfDraft);
  assert.deepEqual(dwarfSheet.durability.hitPointBonuses, [{ source: "species:dwarf:dwarven_toughness", perLevel: 1, total: 1 }]);

  const orcSheet = resolveCharacterSheet(orcDraft);
  assert.equal(orcSheet.resources.some((item) => item.id === "adrenaline_rush" && item.max === 2), true);
  assert.equal(orcSheet.features.some((item) => item.effects?.triggeredEffects?.[0]?.id === "relentless_endurance"), true);

  const aasimarSheet = resolveCharacterSheet(aasimarDraft);
  assert.equal(aasimarSheet.resources.some((item) => item.id === "healing_hands" && item.recovery === "long_rest"), true);
  assert.equal(aasimarSheet.spellcasting.knownSpellIds.includes("light"), true);
}

function resolvesSpeciesFeatureChoices() {
  const draft = createEmptyCharacterDraft({
    identity: {
      characterName: "Test Keen Elf",
      level: 1,
      speciesId: "elf",
      lineageId: "high",
    },
    choices: {
      speciesChoices: {
        keen_senses_skill: "perception",
      },
    },
  });

  const sheet = resolveCharacterSheet(draft);
  assert.equal(sheet.proficiencies.skills.includes("perception"), true);
  assert.equal(sheet.spellcasting.knownSpellIds.includes("prestidigitation"), true);
  assert.equal(sheet.metadata.unresolved.some((item) => item.type === "missing_species_feature_choice"), false);
}


function reportsMissingLineageChoices() {
  const draft = createEmptyCharacterDraft({
    identity: {
      characterName: "Test Elf",
      level: 1,
      speciesId: "elf",
    },
  });

  const sheet = resolveCharacterSheet(draft);
  assert.deepEqual(sheet.metadata.unresolved, [
    { type: "missing_lineage_choice", speciesId: "elf", options: ["high", "wood", "drow"] },
    {
      type: "missing_species_feature_choice",
      featureId: "species:elf:keen_senses",
      choiceId: "keen_senses_skill",
      kind: "skill",
      count: 1,
      options: ["insight", "perception", "survival"],
    },
  ]);
  assert.equal(sheet.features.find((feature) => feature.id === "species:elf:fey_ancestry")?.implemented, true);
  assert.equal(sheet.features.find((feature) => feature.id === "species:elf:trance")?.implemented, true);
}

function resolvesClassIntoSheet() {
  const draft = createEmptyCharacterDraft({
    identity: {
      characterName: "Test Fighter",
      level: 1,
      classId: "fighter",
    },
    abilities: {
      strength: 16,
      dexterity: 12,
      constitution: 14,
      intelligence: 10,
      wisdom: 10,
      charisma: 8,
    },
  });

  const sheet = resolveCharacterSheet(draft);
  assert.equal(sheet.identity.className, "Fighter");
  assert.equal(sheet.durability.hitDice, "d10");
  assert.equal(sheet.durability.maxHp, 12);
  assert.deepEqual(sheet.proficiencies.savingThrows, ["strength", "constitution"]);
  assert.equal(sheet.proficiencies.armor.includes("All armor"), true);
  assert.equal(sheet.features.some((item) => item.id === "class:fighter:second_wind"), true);
  assert.deepEqual(validateResolvedCharacterSheet(sheet), []);
}

function resolvesCombatReadySheetFields() {
  const draft = createEmptyCharacterDraft({
    identity: {
      characterName: "Test Combat Fighter",
      level: 1,
      backgroundId: "soldier",
      classId: "fighter",
    },
    abilities: {
      strength: 16,
      dexterity: 12,
      constitution: 14,
      intelligence: 10,
      wisdom: 10,
      charisma: 8,
    },
    gear: {
      weaponIds: ["longsword"],
      armorId: "chain_mail",
      shieldId: "shield",
      inventory: [],
      attunedItemIds: [],
    },
  });

  const sheet = resolveCharacterSheet(draft);
  assert.equal(sheet.combatBasics.armorClass, 18);
  assert.equal(sheet.combatBasics.initiativeBonus, 1);
  assert.equal(sheet.combatBasics.passivePerception, 10);
  assert.equal(sheet.combatBasics.saves.strength, 5);
  assert.equal(sheet.combatBasics.saves.constitution, 4);
  assert.equal(sheet.featureHooks.some((hook) => hook.id === "savage_attacker_weapon_damage"), true);
  assert.deepEqual(validateResolvedCharacterSheet(sheet), []);
}

function doesNotRequireLevelOneSubclassChoices() {
  const draft = createEmptyCharacterDraft({
    identity: {
      characterName: "Test Level One Rogue",
      level: 1,
      classId: "rogue",
    },
  });

  const sheet = resolveCharacterSheet(draft);
  assert.equal(sheet.identity.className, "Rogue");
  assert.equal(sheet.proficiencies.tools.includes("thieves_tools"), true);
  assert.equal(sheet.metadata.unresolved.some((item) => item.type === "missing_class_choice" && item.choiceId === "subclass"), false);
  assert.deepEqual(validateResolvedCharacterSheet(sheet), []);
}

function rejectsPrematureSubclassChoices() {
  const draft = createEmptyCharacterDraft({
    identity: {
      characterName: "Test Premature Assassin",
      level: 1,
      classId: "rogue",
      subclassId: "assassin",
    },
  });

  const sheet = resolveCharacterSheet(draft);
  assert.equal(sheet.identity.subclassName, null);
  assert.equal(sheet.features.some((item) => item.id.startsWith("subclass:rogue:assassin")), false);
  assert.equal(sheet.metadata.unresolved.some((item) => (
    item.type === "premature_class_choice" &&
    item.classId === "rogue" &&
    item.choiceId === "subclass" &&
    item.requiredLevel === 3
  )), true);
}

function resolvesLevelThreeSubclassFeaturesWhenExplicitlyAllowed() {
  const draft = createEmptyCharacterDraft({
    identity: {
      characterName: "Test Future Lantern",
      level: 3,
      classId: "warlock",
      subclassId: "the_lantern",
    },
    abilities: {
      strength: 8,
      dexterity: 14,
      constitution: 12,
      intelligence: 10,
      wisdom: 10,
      charisma: 16,
    },
  });

  const strictSheet = resolveCharacterSheet(draft);
  assert.equal(
    strictSheet.metadata.unresolved.some((item) => item.type === "invalid_draft" && item.message === "identity.level must be 1 during character creation"),
    true,
    "normal character creation should still reject non-level-1 drafts"
  );

  const sheet = resolveCharacterSheet(draft, {}, { allowNonCreationLevel: true });
  assert.equal(sheet.identity.subclassId, "the_lantern");
  assert.equal(sheet.identity.subclassName, "The Lantern");
  assert.equal(sheet.features.some((item) => item.id === "subclass:warlock:the_lantern:wicklight"), true);
  assert.equal(sheet.features.some((item) => item.effects?.triggeredEffects?.[0]?.id === "wicklight_mark"), true);
  assert.deepEqual(validateResolvedCharacterSheet(sheet), []);
}

function resolvesDeclarativeClassFeatureEffects() {
  const fighterDraft = createEmptyCharacterDraft({
    identity: {
      characterName: "Test Second Wind",
      level: 1,
      classId: "fighter",
    },
  });
  const rogueDraft = createEmptyCharacterDraft({
    identity: {
      characterName: "Test Tools",
      level: 1,
      classId: "rogue",
    },
  });

  const fighterSheet = resolveCharacterSheet(fighterDraft);
  assert.equal(fighterSheet.resources.some((item) => (
    item.id === "second_wind" && item.max === 1 && item.recovery === "short_rest"
  )), true);
  assert.equal(fighterSheet.features.some((item) => item.effects?.actionOptions?.[0]?.id === "second_wind"), true);

  const rogueSheet = resolveCharacterSheet(rogueDraft);
  assert.equal(rogueSheet.proficiencies.expertise.some((item) => (
    item.kind === "tool" && item.id === "thieves_tools"
  )), true);
}

function resolvesWideImpactClassFeatureEffects() {
  const fighterDraft = createEmptyCharacterDraft({
    identity: {
      characterName: "Test Level Five Fighter",
      level: 5,
      classId: "fighter",
    },
  });
  const rogueDraft = createEmptyCharacterDraft({
    identity: {
      characterName: "Test Level Two Rogue",
      level: 2,
      classId: "rogue",
    },
  });
  const clericDraft = createEmptyCharacterDraft({
    identity: {
      characterName: "Test Level Two Cleric",
      level: 2,
      classId: "cleric",
    },
  });

  const fighterSheet = resolveCharacterSheet(fighterDraft, {}, { allowNonCreationLevel: true });
  assert.equal(fighterSheet.advancement.abilityScoreImprovements.length, 1);
  assert.equal(fighterSheet.combatBasics.attackActionAttacks, 2);
  assert.equal(fighterSheet.resources.some((item) => item.id === "action_surge"), true);
  assert.equal(fighterSheet.features.some((item) => item.effects?.actionOptions?.[0]?.id === "action_surge"), true);
  const fighterActor = resolvedSheetToCombatActor(fighterSheet);
  assert.equal(fighterActor.attackActionAttacks, 2);
  assert.equal(fighterActor.actions.some((item) => item.id === "action_surge" && item.type === "feature_action"), true);
  assert.deepEqual(validateResolvedSheetCombatActor(fighterSheet), []);
  assert.deepEqual(validateResolvedCharacterSheet(fighterSheet), []);

  const rogueSheet = resolveCharacterSheet(rogueDraft, {}, { allowNonCreationLevel: true });
  assert.equal(rogueSheet.features.some((item) => item.effects?.actionOptions?.some((action) => action.id === "cunning_action_dash")), true);
  assert.deepEqual(validateResolvedCharacterSheet(rogueSheet), []);

  const clericSheet = resolveCharacterSheet(clericDraft, {}, { allowNonCreationLevel: true });
  assert.equal(clericSheet.resources.some((item) => item.id === "channel_divinity" && item.max === 2), true);
  assert.equal(clericSheet.features.some((item) => item.effects?.actionOptions?.some((action) => action.id === "turn_undead")), true);
  assert.equal(clericSheet.features.some((item) => item.effects?.actionOptions?.some((action) => action.id === "harness_divine_power")), true);
  assert.deepEqual(validateResolvedCharacterSheet(clericSheet), []);
}

function resolvesOriginFeatEffects() {
  const alertDraft = createEmptyCharacterDraft({
    identity: {
      characterName: "Test Guard",
      level: 1,
      backgroundId: "guard",
    },
  });
  const toughDraft = createEmptyCharacterDraft({
    identity: {
      characterName: "Test Farmer",
      level: 1,
      backgroundId: "farmer",
    },
  });
  const luckyDraft = createEmptyCharacterDraft({
    identity: {
      characterName: "Test Guide",
      level: 1,
      backgroundId: "guide",
    },
  });

  const alertSheet = resolveCharacterSheet(alertDraft);
  assert.equal(alertSheet.features.some((item) => (
    item.grants.featId === "alert" &&
    item.grants.featureHooks?.some((hook) => hook.id === "alert_initiative_advantage") &&
    item.grants.featureHooks?.some((hook) => hook.id === "alert_friendly_initiative_bonus")
  )), true);

  const toughSheet = resolveCharacterSheet(toughDraft);
  assert.deepEqual(toughSheet.durability.hitPointBonuses, [{ source: "origin_feat", perLevel: 2, total: 2 }]);

  const luckySheet = resolveCharacterSheet(luckyDraft);
  assert.equal(luckySheet.resources.some((item) => item.id === "luck_points" && item.max === 2), true);
  assert.equal(luckySheet.features.some((item) => (
    item.grants.featId === "lucky" &&
    item.grants.featureHooks?.some((hook) => hook.id === "lucky_combat_near_miss_reroll") &&
    item.grants.featureHooks?.some((hook) => hook.id === "lucky_dialogue_option")
  )), true);
}

function resolvesClassSpecificMagicInitiates() {
  const testBackgrounds = {
    pact_touched: {
      id: "pact_touched",
      name: "Pact Touched",
      skillProficiencies: [],
      toolProficiencies: [],
      originFeat: "magic_initiate_warlock",
    },
    shrine_guard: {
      id: "shrine_guard",
      name: "Shrine Guard",
      skillProficiencies: [],
      toolProficiencies: [],
      originFeat: "magic_initiate_paladin",
    },
  };
  const warlockDraft = createEmptyCharacterDraft({
    identity: { characterName: "Test Pact", level: 1, backgroundId: "pact_touched" },
  });
  const paladinDraft = createEmptyCharacterDraft({
    identity: { characterName: "Test Shrine", level: 1, backgroundId: "shrine_guard" },
  });

  const warlockSheet = resolveCharacterSheet(warlockDraft, { backgrounds: testBackgrounds });
  assert.equal(warlockSheet.spellcasting.knownSpellIds.includes("eldritch_grasp"), true);
  assert.equal(warlockSheet.spellcasting.knownSpellIds.includes("dread_whisper"), true);
  assert.equal(warlockSheet.spellcasting.knownSpellIds.includes("hex"), true);
  assert.equal(warlockSheet.resources.some((item) => item.id === "magic_initiate_warlock_hex"), true);

  const paladinSheet = resolveCharacterSheet(paladinDraft, { backgrounds: testBackgrounds });
  assert.equal(paladinSheet.spellcasting.knownSpellIds.includes("light"), true);
  assert.equal(paladinSheet.spellcasting.knownSpellIds.includes("guidance"), true);
  assert.equal(paladinSheet.spellcasting.knownSpellIds.includes("shield_of_faith"), true);
  assert.equal(paladinSheet.resources.some((item) => item.id === "magic_initiate_paladin_shield_of_faith"), true);
}

function reportsMissingOriginFeatChoices() {
  const draft = createEmptyCharacterDraft({
    identity: {
      characterName: "Test Artisan",
      level: 1,
      backgroundId: "artisan",
    },
  });

  const sheet = resolveCharacterSheet(draft);
  assert.equal(sheet.features[0].grants.featId, "skilled");
  assert.equal(sheet.features[0].implemented, true);
  assert.deepEqual(sheet.metadata.unresolved, [
    { type: "missing_origin_feat_choice", featId: "skilled", choiceId: "proficiencies", kind: "skill_or_tool", count: 3 },
  ]);
}

function rejectsInvalidOriginFeatToolChoices() {
  const draft = createEmptyCharacterDraft({
    identity: {
      characterName: "Test Artisan",
      level: 1,
      backgroundId: "artisan",
    },
    choices: {
      featChoices: {
        skilled: {
          proficiencies: ["skill:perception", "tool:not_a_tool", "tool:weavers_tools"],
        },
      },
    },
  });

  const sheet = resolveCharacterSheet(draft);
  assert.deepEqual(sheet.metadata.unresolved, [
    { type: "invalid_origin_feat_choice_value", featId: "skilled", choiceId: "proficiencies", values: ["skill:perception", "tool:not_a_tool", "tool:weavers_tools"] },
  ]);
}

function resolvesSkillOrToolOriginFeatChoices() {
  const draft = createEmptyCharacterDraft({
    identity: {
      characterName: "Test Merchant",
      level: 1,
      backgroundId: "merchant",
    },
    choices: {
      featChoices: {
        skilled: {
          proficiencies: ["skill:perception", "tool:forgery_kit", "tool:playing_card_set"],
        },
      },
    },
  });

  const sheet = resolveCharacterSheet(draft);
  assert.equal(sheet.proficiencies.skills.includes("perception"), true);
  assert.equal(sheet.proficiencies.tools.includes("forgery_kit"), true);
  assert.equal(sheet.proficiencies.tools.includes("playing_card_set"), true);
  assert.equal(sheet.metadata.unresolved.length, 0);
}

function preservesDraftGearAndSpellsWithoutResolvingMechanics() {
  const draft = createEmptyCharacterDraft({
    identity: {
      characterName: "Test Scribe",
      level: 1,
      backgroundId: "scribe",
    },
    gear: {
      weaponIds: ["dagger"],
      armorId: "leather_armor",
      shieldId: null,
      inventory: [{ id: "potion_of_healing", qty: 2 }],
      attunedItemIds: ["ember_standard"],
    },
    spells: {
      knownSpellIds: ["fire_bolt"],
      preparedSpellIds: ["detect_magic"],
    },
  });

  const sheet = resolveCharacterSheet(draft);
  assert.equal(sheet.proficiencyBonus, 2);
  assert.deepEqual(sheet.equipment.weaponIds, ["dagger"]);
  assert.deepEqual(sheet.equipment.inventory, [{ id: "potion_of_healing", qty: 2 }]);
  assert.deepEqual(sheet.spellcasting.knownSpellIds, ["fire_bolt"]);
  assert.deepEqual(sheet.spellcasting.preparedSpellIds, ["detect_magic"]);
}
