import assert from "node:assert/strict";
import {
  createCharacterRecord,
  createChoiceRequirementsReport,
  createFeatChoicePools,
  createGearChoicePools,
  createWeaponMasteryChoicePools,
  createSpellChoicePools,
  createEmptyCharacterDraft,
  getCharacterCreationStepContract,
  resolveCharacterSheet,
} from "../../app/character/index.js";

export function runCreationStepTests() {
  exposesOrderedCreationStepContract();
  reportsFixedMissingCreationQuestions();
  reportsBackgroundAbilityRequirement();
  reportsResolverDrivenChoiceQuestions();
  reportsFeatGrantChoiceQuestionsWithHumanLabels();
  reportsAbilityScoreImprovementFeatChoiceQuestions();
  reportsBattlemageArcaneArmamentChoice();
  savesCompleteHarnessAsCombatReadyRecord();
  reportsFutureLevelWarlockChoices();
  exposesAdvancementFeatChoicePoolsAtFeatLevels();
  exposesSpellChoicePools();
  exposesGearChoicePools();
  exposesWeaponMasteryChoicePools();
  supportsRepresentativeHarnessBuildFlows();
}

function supportsRepresentativeHarnessBuildFlows() {
  const cases = [
    ["fighter feat and mastery", completeFighterHarnessDraft()],
    ["wizard spell grant feat", completeWizardHarnessDraft()],
    ["warlock pact and subclass", completeWarlockHarnessDraft()],
    ["rogue skill expertise", completeRogueHarnessDraft()],
    ["cleric prepared spells", completeClericHarnessDraft()],
    ["paladin prepared spells and mastery", completePaladinHarnessDraft()],
  ];
  for (const [label, draft] of cases) {
    const report = createChoiceRequirementsReport(draft, { allowNonCreationLevel: true });
    assert.equal(report.complete, true, `${label}: harness-visible choices should complete the draft`);
  }
}

function reportsFeatGrantChoiceQuestionsWithHumanLabels() {
  const draft = createEmptyCharacterDraft({
    identity: {
      characterName: "Fey Choice",
      level: 4,
      speciesId: "human",
      backgroundId: "soldier",
      classId: "fighter",
    },
    gear: { weaponIds: ["longsword"] },
    choices: {
      backgroundAbilityScores: [{ ability: "strength", bonus: 2 }, { ability: "constitution", bonus: 1 }],
      advancementChoices: {
        "class:fighter:level_4:ability_score_improvement": { kind: "feat", featId: "fey_touched" },
      },
    },
  });
  const report = createChoiceRequirementsReport(draft, { allowNonCreationLevel: true });
  const requirements = report.byStep.class.filter((item) => item.kind === "origin_feat_choice");

  assert.equal(requirements.some((item) => item.label === "Choose 1 ability for Fey Touched."), true);
  assert.equal(requirements.some((item) => item.label === "Choose 1 Misty Step grant for Fey Touched."), true);
  assert.equal(requirements.some((item) => (
    item.label === "Choose 1 spell for Fey Touched." &&
    item.options.some((option) => option.id === "bless")
  )), true);
}

function reportsBattlemageArcaneArmamentChoice() {
  const draft = createEmptyCharacterDraft({
    identity: {
      characterName: "Battlemage Choice",
      level: 3,
      speciesId: "tiefling",
      lineageId: "chthonic",
      backgroundId: "sage",
      classId: "wizard",
      subclassId: "battlemage",
    },
    abilities: {
      strength: 8,
      dexterity: 14,
      constitution: 13,
      intelligence: 12,
      wisdom: 11,
      charisma: 10,
    },
    gear: { weaponIds: ["quarterstaff", "dagger"], armorId: null, shieldId: null, inventory: [], attunedItemIds: [] },
    spells: {
      knownSpellIds: ["fire_bolt", "chill_touch", "acid_splash", "blade_ward", "ray_of_frost"],
      preparedSpellIds: ["magic_missile", "burning_hands", "sleep", "thunderwave", "witch_bolt"],
    },
    choices: {
      backgroundAbilityScores: [{ ability: "intelligence", bonus: 2 }, { ability: "wisdom", bonus: 1 }],
    },
  });
  const report = createChoiceRequirementsReport(draft, { allowNonCreationLevel: true });
  const requirement = report.byStep.class.find((item) => item.source?.choiceId === "arcane_armament_weapon");

  assert.equal(requirement.kind, "weapon");
  assert.deepEqual(requirement.options, ["quarterstaff", "dagger"]);

  draft.choices.classChoices = { arcane_armament_weapon: "quarterstaff" };
  const resolvedReport = createChoiceRequirementsReport(draft, { allowNonCreationLevel: true });
  assert.equal(resolvedReport.complete, true, "Battlemage arcane armament should resolve through class feature choices");
}

function reportsAbilityScoreImprovementFeatChoiceQuestions() {
  const draft = createEmptyCharacterDraft({
    identity: {
      characterName: "ASI Wizard",
      level: 4,
      speciesId: "tiefling",
      lineageId: "chthonic",
      backgroundId: "sage",
      classId: "wizard",
      subclassId: "necromancer",
    },
    abilities: {
      strength: 8,
      dexterity: 14,
      constitution: 13,
      intelligence: 12,
      wisdom: 11,
      charisma: 10,
    },
    gear: { weaponIds: ["quarterstaff"], armorId: null, shieldId: null, inventory: [], attunedItemIds: [] },
    spells: {
      knownSpellIds: ["shocking_grasp", "chill_touch", "fire_bolt", "mage_hand", "ray_of_frost", "acid_splash", "frostbite"],
      preparedSpellIds: ["magic_missile", "mage_armor", "sleep", "burning_hands", "chromatic_orb"],
    },
    choices: {
      backgroundAbilityScores: [{ ability: "intelligence", bonus: 2 }, { ability: "wisdom", bonus: 1 }],
      advancementChoices: {
        "class:wizard:level_4:ability_score_improvement": { kind: "feat", featId: "ability_score_improvement" },
      },
    },
  });
  const report = createChoiceRequirementsReport(draft, { allowNonCreationLevel: true });
  const abilityRequirement = report.byStep.class.find((item) => (
    item.kind === "origin_feat_choice" &&
    item.source?.featId === "ability_score_improvement" &&
    item.source?.choiceId === "abilities" &&
    item.source?.kind === "ability_score"
  ));

  assert.equal(Boolean(abilityRequirement), true, "ASI should expose its two ability choices");
  assert.equal(abilityRequirement.count, 2);
  assert.equal(abilityRequirement.options.some((option) => option.id === "intelligence"), true);

  const partial = structuredClone(draft);
  partial.choices.featChoices = {
    ability_score_improvement: { abilities: ["intelligence"] },
  };
  const partialReport = createChoiceRequirementsReport(partial, { allowNonCreationLevel: true });
  const partialRequirement = partialReport.byStep.class.find((item) => (
    item.kind === "origin_feat_choice" &&
    item.source?.type === "invalid_origin_feat_choice_count" &&
    item.source?.featId === "ability_score_improvement" &&
    item.source?.kind === "ability_score"
  ));
  assert.equal(Boolean(partialRequirement), true, "partial ASI choices should remain editable");
  assert.equal(partialRequirement.count, 2);
  assert.equal(partialRequirement.options.some((option) => option.id === "intelligence"), true);

  const complete = structuredClone(draft);
  complete.choices.featChoices = {
    ability_score_improvement: { abilities: ["intelligence", "intelligence"] },
  };
  const sheet = resolveCharacterSheet(complete, {}, { allowNonCreationLevel: true });
  const completeReport = createChoiceRequirementsReport(complete, { sheet, allowNonCreationLevel: true });

  assert.deepEqual(sheet.metadata.unresolved, []);
  assert.equal(completeReport.complete, true);
  assert.equal(sheet.abilities.intelligence.score, 16);
}

function savesCompleteHarnessAsCombatReadyRecord() {
  const draft = createEmptyCharacterDraft({
    identity: {
      characterName: "ASI Wizard",
      level: 4,
      speciesId: "tiefling",
      lineageId: "chthonic",
      backgroundId: "sage",
      classId: "wizard",
      subclassId: "necromancer",
    },
    abilities: {
      strength: 8,
      dexterity: 14,
      constitution: 13,
      intelligence: 12,
      wisdom: 11,
      charisma: 10,
    },
    gear: { weaponIds: ["quarterstaff", "dagger"], armorId: null, shieldId: null, inventory: [], attunedItemIds: [] },
    spells: {
      knownSpellIds: ["shocking_grasp", "chill_touch", "fire_bolt", "mage_hand", "ray_of_frost", "acid_splash", "frostbite"],
      preparedSpellIds: ["magic_missile", "mage_armor", "sleep", "burning_hands", "chromatic_orb"],
    },
    choices: {
      backgroundAbilityScores: [{ ability: "intelligence", bonus: 2 }, { ability: "wisdom", bonus: 1 }],
      advancementChoices: {
        "class:wizard:level_4:ability_score_improvement": { kind: "feat", featId: "ability_score_improvement" },
      },
      featChoices: {
        ability_score_improvement: { abilities: ["intelligence", "intelligence"] },
      },
    },
  });
  const record = createCharacterRecord(draft, {
    actorOptions: { id: "saved_player_character", position: { x: 1, y: 1 } },
    resolveOptions: { allowNonCreationLevel: true },
  });

  assert.equal(record.status, "ready");
  assert.deepEqual(record.resolvedCharacterSheet.metadata.unresolved, []);
  assert.equal(record.combatActor.id, "saved_player_character");
}

function exposesAdvancementFeatChoicePoolsAtFeatLevels() {
  const levelOne = createFeatChoicePools(createEmptyCharacterDraft({
    identity: { characterName: "No Feat Yet", level: 1, classId: "fighter" },
  }));
  assert.equal(levelOne.pools.length, 0, "level 1 creator drafts should not expose general feat pools");

  const levelFour = createFeatChoicePools(createEmptyCharacterDraft({
    identity: { characterName: "Feat Level", level: 4, classId: "fighter" },
  }));
  assert.equal(levelFour.pools.length, 1, "level 4 fighter should expose one advancement feat pool");
  assert.equal(levelFour.pools[0].options.some((feat) => feat.id === "charger"), true);
  assert.equal(levelFour.pools[0].options.some((feat) => feat.id === "alert"), false, "origin feats should not appear in general feat advancement pools");
}

function exposesOrderedCreationStepContract() {
  const steps = getCharacterCreationStepContract();
  assert.deepEqual(
    steps.map((step) => step.id),
    ["identity", "species", "background", "class", "abilities", "spells", "gear", "review"]
  );
  assert.deepEqual(steps.find((step) => step.id === "class").writes, [
    "identity.classId",
    "identity.subclassId",
    "identity.pactId",
    "choices.classChoices",
  ]);
  assert.equal(steps.find((step) => step.id === "review").warnings.includes("invalid_draft"), true);
}

function reportsFixedMissingCreationQuestions() {
  const report = createChoiceRequirementsReport(createEmptyCharacterDraft());

  assert.equal(report.complete, false);
  assert.equal(report.byStep.identity.some((item) => item.path === "identity.characterName"), true);
  assert.equal(report.byStep.species.some((item) => item.path === "identity.speciesId"), true);
  assert.equal(report.byStep.background.some((item) => item.path === "identity.backgroundId"), true);
  assert.equal(report.byStep.class.some((item) => item.path === "identity.classId"), true);
  assert.equal(report.byStep.gear.some((item) => item.path === "gear.weaponIds"), true);
}

function reportsBackgroundAbilityRequirement() {
  const draft = createEmptyCharacterDraft({
    identity: {
      characterName: "Ability Choice",
      level: 1,
      speciesId: "dwarf",
      backgroundId: "sage",
      classId: "fighter",
    },
    gear: { weaponIds: ["longsword"] },
  });
  const report = createChoiceRequirementsReport(draft);
  assert.equal(report.byStep.abilities.some((item) => item.kind === "background_ability_scores"), true);

  draft.choices.backgroundAbilityScores = [{ ability: "intelligence", bonus: 2 }, { ability: "wisdom", bonus: 1 }];
  const resolved = createChoiceRequirementsReport(draft);
  assert.equal(resolved.byStep.abilities.some((item) => item.kind === "background_ability_scores"), false);
}

function reportsResolverDrivenChoiceQuestions() {
  const draft = createEmptyCharacterDraft({
    identity: {
      characterName: "Choice Test",
      level: 1,
      speciesId: "elf",
      backgroundId: "artisan",
      classId: "wizard",
    },
    gear: { weaponIds: ["quarterstaff"] },
  });
  const report = createChoiceRequirementsReport(draft);

  assert.equal(report.byStep.species.some((item) => item.kind === "lineage" && item.path === "identity.lineageId"), true);
  assert.equal(report.byStep.species.some((item) => item.id === "keen_senses_skill"), true);
  assert.equal(report.byStep.background.some((item) => item.path === "choices.featChoices.skilled.proficiencies"), true);
  assert.equal(report.byStep.class.some((item) => item.path === "identity.subclassId"), false, "level 1 should not ask subclass questions");
}

function reportsFutureLevelWarlockChoices() {
  const draft = createEmptyCharacterDraft({
    identity: {
      characterName: "Future Warlock",
      level: 3,
      speciesId: "tiefling",
      lineageId: "infernal",
      backgroundId: "soldier",
      classId: "warlock",
    },
    gear: { weaponIds: ["quarterstaff"] },
  });
  const sheet = resolveCharacterSheet(draft, {}, { allowNonCreationLevel: true });
  const report = createChoiceRequirementsReport(draft, { sheet, allowNonCreationLevel: true });

  assert.equal(report.byStep.class.some((item) => item.kind === "subclass" && item.path === "identity.subclassId"), true);
  assert.equal(report.byStep.class.some((item) => item.kind === "pact" && item.path === "identity.pactId"), true);
  assert.equal(report.byStep.class.some((item) => item.label === "Choose a Warlock subclass."), true);
  assert.equal(report.byStep.class.some((item) => item.label === "Choose a Warlock pact."), true);
}

function exposesSpellChoicePools() {
  const wizardDraft = createEmptyCharacterDraft({
    identity: { characterName: "Spell Test", level: 1, classId: "wizard" },
  });
  const wizardPools = createSpellChoicePools(wizardDraft);
  const cantripPool = wizardPools.pools.find((pool) => pool.id === "known_cantrips");
  const preparedPool = wizardPools.pools.find((pool) => pool.id === "prepared_spells");

  assert.equal(wizardPools.required, true);
  assert.equal(cantripPool.count, 3);
  assert.equal(cantripPool.options.some((spell) => spell.id === "fire_bolt"), true);
  assert.equal(cantripPool.options.some((spell) => spell.level > 0), false);
  assert.equal(preparedPool.count, 4);
  assert.equal(preparedPool.options.some((spell) => spell.id === "magic_missile"), true);
  assert.equal(preparedPool.options.some((spell) => spell.id === "flame_blade"), false, "level 2 spells should not appear at level 1");

  const report = createChoiceRequirementsReport(wizardDraft);
  assert.equal(report.byStep.spells.some((item) => item.id === "spells.known_cantrips" && item.options.some((spell) => spell.id === "fire_bolt")), true);

  const grantedSpellDraft = createEmptyCharacterDraft({
    identity: { characterName: "Granted Spell Test", level: 1, speciesId: "tiefling", lineageId: "chthonic", backgroundId: "sage", classId: "wizard" },
    spells: {
      knownSpellIds: ["acid_splash", "chill_touch", "mage_hand", "fire_bolt", "ray_of_frost"],
      preparedSpellIds: ["magic_missile", "burning_hands"],
    },
  });
  const grantedPools = createSpellChoicePools(grantedSpellDraft);
  const grantedCantrips = grantedPools.pools.find((pool) => pool.id === "known_cantrips");
  const grantedPrepared = grantedPools.pools.find((pool) => pool.id === "prepared_spells");
  assert.deepEqual(grantedCantrips.selected, ["acid_splash", "ray_of_frost"], "species/background cantrips should not consume class cantrip choices");
  assert.equal(grantedCantrips.grantedSpellIds.includes("fire_bolt"), true);
  assert.equal(grantedCantrips.grantedSpellIds.includes("chill_touch"), true);
  assert.equal(grantedCantrips.grantedSpellDetails.some((detail) => detail.id === "chill_touch" && detail.source), true, "granted class-pool spells should expose source labels");
  assert.deepEqual(grantedPrepared.selected, ["burning_hands"], "free-cast spell grants should not consume prepared spell choices");
  assert.equal(grantedPrepared.grantedSpellIds.includes("magic_missile"), true);

  const levelTenWizard = createSpellChoicePools(createEmptyCharacterDraft({
    identity: { characterName: "Level Ten Wizard", level: 10, classId: "wizard" },
  }));
  const levelTenPrepared = levelTenWizard.pools.find((pool) => pool.id === "prepared_spells");
  assert.equal(levelTenPrepared.count, 14, "level 10 wizard should use one total prepared spell allowance");
  assert.equal(levelTenPrepared.options.some((spell) => spell.id === "magic_missile" && spell.level === 1), true);
  assert.equal(levelTenPrepared.options.some((spell) => spell.id === "fireball" && spell.level === 3), true);
  assert.equal(levelTenPrepared.options.some((spell) => spell.id === "wall_of_force" && spell.level === 5), true);
  assert.equal(levelTenPrepared.options.some((spell) => spell.level > 5), false, "level 10 wizard should not see level 6+ spells");

  const warlockPools = createSpellChoicePools(createEmptyCharacterDraft({
    identity: { characterName: "Known Caster", level: 10, classId: "warlock" },
  }));
  assert.equal(warlockPools.pools.some((pool) => pool.id === "prepared_spells"), false, "warlock should not expose prepared spell pools");
  assert.equal(warlockPools.pools.some((pool) => pool.id === "known_spells"), true, "warlock should expose known spell pools");

  const clericPools = createSpellChoicePools(createEmptyCharacterDraft({
    identity: { characterName: "Prepared Cleric", level: 10, classId: "cleric" },
  }));
  assert.equal(clericPools.pools.some((pool) => pool.id === "prepared_spells"), true, "cleric should expose prepared spell pools");

  const paladinPools = createSpellChoicePools(createEmptyCharacterDraft({
    identity: { characterName: "Prepared Paladin", level: 10, classId: "paladin" },
  }));
  assert.equal(paladinPools.pools.some((pool) => pool.id === "prepared_spells"), true, "paladin should expose prepared spell pools");
}

function exposesGearChoicePools() {
  const fighterDraft = createEmptyCharacterDraft({
    identity: { characterName: "Gear Test", level: 1, classId: "fighter" },
  });
  const fighterPools = createGearChoicePools(fighterDraft);
  const weapons = fighterPools.pools.find((pool) => pool.id === "weapons");
  const armor = fighterPools.pools.find((pool) => pool.id === "armor");
  const shield = fighterPools.pools.find((pool) => pool.id === "shield");

  assert.equal(weapons.options.some((item) => item.id === "longsword"), true);
  assert.equal(armor.options.some((item) => item.id === "chain_mail"), true);
  assert.equal(shield.options.some((item) => item.id === "shield"), true);
  assert.equal(weapons.options.some((item) => item.id === "flaming_longsword"), false);

  const wizardPools = createGearChoicePools(createEmptyCharacterDraft({
    identity: { characterName: "Wizard Gear", level: 1, classId: "wizard" },
  }));
  assert.equal(wizardPools.pools.find((pool) => pool.id === "weapons").options.some((item) => item.id === "quarterstaff"), true);
  assert.equal(wizardPools.pools.find((pool) => pool.id === "armor").options.length, 0);
}

function exposesWeaponMasteryChoicePools() {
  const fighterPools = createWeaponMasteryChoicePools(createEmptyCharacterDraft({
    identity: { characterName: "Mastery Fighter", level: 1, classId: "fighter" },
    gear: { weaponIds: ["longsword"] },
  }));
  const fighterPool = fighterPools.pools.find((pool) => pool.id === "weapon_mastery");
  assert.equal(fighterPool.count.min, 3);
  assert.equal(fighterPool.options[0].id, "longsword", "equipped weapons should be sorted first");
  assert.equal(fighterPool.options.some((item) => item.id === "warhammer" && item.mastery === "push"), true);

  const wizardPools = createWeaponMasteryChoicePools(createEmptyCharacterDraft({
    identity: { characterName: "No Mastery", level: 1, classId: "wizard" },
  }));
  assert.equal(wizardPools.pools.length, 0, "wizard should not receive weapon mastery choices by default");
}

function completeFighterHarnessDraft() {
  return createEmptyCharacterDraft({
    identity: { characterName: "Harness Fighter", level: 4, speciesId: "goliath", lineageId: "stone", backgroundId: "soldier", classId: "fighter", subclassId: "champion" },
    gear: { weaponIds: ["longsword"], armorId: "chain_mail", shieldId: "shield", inventory: [], attunedItemIds: [] },
    spells: { knownSpellIds: [], preparedSpellIds: [] },
    choices: {
      backgroundAbilityScores: [{ ability: "strength", bonus: 2 }, { ability: "constitution", bonus: 1 }],
      weaponMasteryIds: ["longsword", "warhammer", "greatsword"],
      advancementChoices: { "class:fighter:level_4:ability_score_improvement": { kind: "feat", featId: "charger" } },
      featChoices: { charger: { ability: ["strength"] } },
    },
  });
}

function completeWizardHarnessDraft() {
  return createEmptyCharacterDraft({
    identity: { characterName: "Harness Wizard", level: 4, speciesId: "elf", lineageId: "high", backgroundId: "sage", classId: "wizard", subclassId: "necromancer" },
    gear: { weaponIds: ["quarterstaff"], armorId: null, shieldId: null, inventory: [], attunedItemIds: [] },
    spells: {
      knownSpellIds: ["fire_bolt", "mage_hand", "minor_magic", "ray_of_frost", "acid_splash", "frostbite"],
      preparedSpellIds: ["magic_missile", "mage_armor", "sleep", "burning_hands", "chromatic_orb"],
    },
    choices: {
      speciesChoices: { keen_senses_skill: "perception" },
      backgroundAbilityScores: [{ ability: "intelligence", bonus: 2 }, { ability: "wisdom", bonus: 1 }],
      advancementChoices: { "class:wizard:level_4:ability_score_improvement": { kind: "feat", featId: "fey_touched" } },
      featChoices: { fey_touched: { ability: ["intelligence"], step: ["misty_step"], spell: ["bless"] } },
    },
  });
}

function completeWarlockHarnessDraft() {
  return createEmptyCharacterDraft({
    identity: { characterName: "Harness Warlock", level: 3, speciesId: "tiefling", lineageId: "infernal", backgroundId: "guide", classId: "warlock", subclassId: "the_fiend", pactId: "pact_of_the_blade" },
    gear: { weaponIds: ["quarterstaff"], armorId: null, shieldId: null, inventory: [], attunedItemIds: [] },
    spells: { knownSpellIds: ["eldritch_grasp", "dread_whisper", "hex", "hellish_rebuke"], preparedSpellIds: [] },
    choices: {
      backgroundAbilityScores: [{ ability: "charisma", bonus: 2 }, { ability: "constitution", bonus: 1 }],
      classChoices: { pact: "pact_of_the_blade" },
    },
  });
}

function completeRogueHarnessDraft() {
  return createEmptyCharacterDraft({
    identity: { characterName: "Harness Rogue", level: 4, speciesId: "halfling", lineageId: "lightfoot", backgroundId: "criminal", classId: "rogue", subclassId: "assassin" },
    gear: { weaponIds: ["rapier", "dagger"], armorId: "studded_leather", shieldId: null, inventory: [], attunedItemIds: [] },
    spells: { knownSpellIds: [], preparedSpellIds: [] },
    choices: {
      backgroundAbilityScores: [{ ability: "dexterity", bonus: 2 }, { ability: "constitution", bonus: 1 }],
      weaponMasteryIds: ["rapier", "dagger"],
      advancementChoices: { "class:rogue:level_4:ability_score_improvement": { kind: "feat", featId: "skill_expert" } },
      featChoices: { skill_expert: { ability: ["dexterity"], skill: ["perception"], expertise: ["stealth"] } },
    },
  });
}

function completeClericHarnessDraft() {
  return createEmptyCharacterDraft({
    identity: { characterName: "Harness Cleric", level: 1, speciesId: "dwarf", backgroundId: "guide", classId: "cleric" },
    gear: { weaponIds: ["quarterstaff"], armorId: "half_plate", shieldId: "shield", inventory: [], attunedItemIds: [] },
    spells: {
      knownSpellIds: ["guidance", "sacred_flame", "minor_magic"],
      preparedSpellIds: ["bless", "cure_wounds", "guiding_bolt", "shield_of_faith"],
    },
    choices: {
      backgroundAbilityScores: [{ ability: "wisdom", bonus: 2 }, { ability: "constitution", bonus: 1 }],
      featChoices: { alert: { ability: ["wisdom"] } },
    },
  });
}

function completePaladinHarnessDraft() {
  return createEmptyCharacterDraft({
    identity: { characterName: "Harness Paladin", level: 1, speciesId: "dwarf", backgroundId: "soldier", classId: "paladin" },
    gear: { weaponIds: ["longsword"], armorId: "chain_mail", shieldId: "shield", inventory: [], attunedItemIds: [] },
    spells: {
      knownSpellIds: [],
      preparedSpellIds: ["bless", "cure_wounds"],
    },
    choices: {
      backgroundAbilityScores: [{ ability: "strength", bonus: 2 }, { ability: "charisma", bonus: 1 }],
      weaponMasteryIds: ["longsword", "warhammer"],
    },
  });
}
