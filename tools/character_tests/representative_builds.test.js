import assert from "node:assert/strict";
import {
  createEmptyCharacterDraft,
  resolveCharacterSheet,
  resolvedSheetToCombatActor,
  validateResolvedCharacterSheet,
  validateResolvedSheetCombatActor,
} from "../../app/character/index.js";

const CLASS_BUILDS = [
  {
    classId: "fighter",
    levelOne: buildDraft("fighter_l1", { backgroundId: "soldier", speciesId: "tiefling", lineageId: "infernal", classId: "fighter" }, martialAbilities("strength"), {
      weaponIds: ["longsword"], armorId: "chain_mail", shieldId: "shield", inventory: [{ id: "healing_potion", quantity: 1 }], attunedItemIds: [],
    }),
    advanced: buildDraft("fighter_l11", { backgroundId: "soldier", speciesId: "goliath", lineageId: "stone", classId: "fighter", subclassId: "champion", level: 11 }, martialAbilities("strength"), {
      weaponIds: ["longsword"], armorId: "chain_mail", shieldId: "shield", inventory: [], attunedItemIds: [],
    }),
    expectedAdvanced: { featureIds: ["subclass:fighter:champion:unyielding_stance"], resourceIds: ["unyielding_stance"] },
  },
  {
    classId: "rogue",
    levelOne: buildDraft("rogue_l1", { backgroundId: "criminal", speciesId: "orc", classId: "rogue" }, martialAbilities("dexterity"), {
      weaponIds: ["rapier"], armorId: "studded_leather", shieldId: null, inventory: [{ id: "healing_potion", quantity: 1 }], attunedItemIds: [],
    }),
    advanced: buildDraft("rogue_l11", { backgroundId: "criminal", speciesId: "halfling", lineageId: "lightfoot", classId: "rogue", subclassId: "assassin", level: 11 }, martialAbilities("dexterity"), {
      weaponIds: ["rapier", "dagger"], armorId: "studded_leather", shieldId: null, inventory: [], attunedItemIds: [],
    }),
    expectedAdvanced: { featureIds: ["subclass:rogue:assassin:assassinate_upgrade"], actionIds: ["rapier"] },
  },
  {
    classId: "wizard",
    levelOne: spellDraft("wizard_l1", { backgroundId: "sage", speciesId: "elf", lineageId: "high", classId: "wizard" }, casterAbilities("intelligence"), ["fire_bolt", "mage_hand", "ray_of_frost"], ["magic_missile", "mage_armor", "sleep", "burning_hands"]),
    advanced: spellDraft("wizard_l11", { backgroundId: "sage", speciesId: "gnome", lineageId: "forest", classId: "wizard", subclassId: "necromancer", level: 11 }, casterAbilities("intelligence"), ["fire_bolt", "mage_hand", "chill_touch"], ["magic_missile", "mage_armor", "sleep", "false_life"]),
    expectedAdvanced: { featureIds: ["subclass:wizard:necromancer:mortmain_the_dead_hand"], resourceIds: [] },
  },
  {
    classId: "warlock",
    levelOne: spellDraft("warlock_l1", { backgroundId: "guide", speciesId: "tiefling", lineageId: "chthonic", classId: "warlock" }, casterAbilities("charisma"), ["eldritch_grasp", "dread_whisper"], ["hex"]),
    advanced: spellDraft("warlock_l11", { backgroundId: "guide", speciesId: "goliath", lineageId: "storm", classId: "warlock", subclassId: "the_fiend", level: 11 }, casterAbilities("charisma"), ["eldritch_grasp", "dread_whisper"], ["hex", "hellish_rebuke"]),
    expectedAdvanced: { featureIds: ["subclass:warlock:the_fiend:hurl_through_hell"], resourceIds: ["hurl_through_hell"] },
  },
  {
    classId: "cleric",
    levelOne: spellDraft("cleric_l1", { backgroundId: "acolyte", speciesId: "aasimar", classId: "cleric" }, casterAbilities("wisdom"), ["guidance", "sacred_flame"], ["cure_wounds", "bless"]),
    advanced: spellDraft("cleric_l7", { backgroundId: "acolyte", speciesId: "dwarf", classId: "cleric", subclassId: "war_domain", level: 7 }, casterAbilities("wisdom"), ["guidance", "sacred_flame"], ["cure_wounds", "bless", "shield_of_faith"]),
    expectedAdvanced: { featureIds: ["subclass:cleric:war_domain:guided_strike"], resourceIds: ["guided_strike"] },
  },
  {
    classId: "paladin",
    levelOne: spellDraft("paladin_l1", { backgroundId: "guard", speciesId: "dragonborn", lineageId: "red", classId: "paladin" }, paladinAbilities(), [], ["bless", "shield_of_faith"]),
    advanced: spellDraft("paladin_l7", { backgroundId: "guard", speciesId: "dragonborn", lineageId: "red", classId: "paladin", subclassId: "oath_of_glory", level: 7 }, paladinAbilities(), [], ["bless", "shield_of_faith", "cure_wounds"]),
    expectedAdvanced: { featureIds: ["subclass:paladin:oath_of_glory:aura_of_alacrity"], auraIds: ["aura_of_alacrity_self"] },
  },
];

export function runRepresentativeBuildTests() {
  for (const spec of CLASS_BUILDS) {
    assertBuildValid(spec.levelOne, `${spec.classId} level 1`, { allowNonCreationLevel: false });
    assertBuildValid(spec.advanced, `${spec.classId} advanced`, { allowNonCreationLevel: true, expected: spec.expectedAdvanced });
  }
}

function assertBuildValid(draft, label, { allowNonCreationLevel, expected = {} }) {
  const sheet = resolveCharacterSheet(draft, {}, { allowNonCreationLevel });
  const actor = resolvedSheetToCombatActor(sheet, { id: `${label.replace(/\W+/g, "_")}_actor` });

  assert.deepEqual(validateResolvedCharacterSheet(sheet), [], `${label}: sheet should validate`);
  assert.deepEqual(validateResolvedSheetCombatActor(sheet), [], `${label}: combat actor should validate`);
  assert.equal(sheet.metadata.unresolved.length, 0, `${label}: should have no unresolved choices`);
  assert.equal(actor.actions.length > 0, true, `${label}: should expose combat actions`);
  assert.equal(Number.isFinite(actor.ac), true, `${label}: should expose numeric AC`);
  assert.equal(Number.isFinite(actor.maxHp), true, `${label}: should expose numeric max HP`);

  for (const featureId of expected.featureIds || []) {
    assert.equal(sheet.features.some((feature) => feature.id === featureId), true, `${label}: should include ${featureId}`);
  }
  for (const resourceId of expected.resourceIds || []) {
    assert.equal(actor.resources.some((resource) => resource.id === resourceId), true, `${label}: should include ${resourceId}`);
  }
  for (const actionId of expected.actionIds || []) {
    assert.equal(actor.actions.some((action) => action.id === actionId), true, `${label}: should include action ${actionId}`);
  }
  for (const auraId of expected.auraIds || []) {
    assert.equal(actor.auras.some((aura) => aura.id === auraId), true, `${label}: should include aura ${auraId}`);
  }
}

function spellDraft(name, identity, abilities, knownSpellIds, preparedSpellIds) {
  return buildDraft(name, identity, abilities, {
    weaponIds: ["quarterstaff"], armorId: null, shieldId: null, inventory: [{ id: "healing_potion", quantity: 1 }], attunedItemIds: [],
  }, { knownSpellIds, preparedSpellIds });
}

function buildDraft(name, identity, abilities, gear, spells = {}) {
  const backgroundId = identity.backgroundId;
  const choices = choicesForBackground(backgroundId, identity);
  return createEmptyCharacterDraft({
    identity: { characterName: name, level: identity.level || 1, ...identity },
    abilities,
    choices,
    gear,
    spells,
  });
}

function choicesForBackground(backgroundId, identity) {
  const choices = { backgroundAbilityScores: ["primary", "secondary"] };
  const masteryIds = defaultWeaponMasteries(identity.classId);
  if (masteryIds.length) choices.weaponMasteryIds = masteryIds;
  if (identity.classId === "rogue" && (identity.level || 1) >= 7) {
    choices.classChoices = { rogue_expertise_skills: ["stealth", "deception"] };
  }
  if (identity.classId === "wizard" && (identity.level || 1) >= 9) {
    choices.classChoices = { ...(choices.classChoices || {}), jesters_book_spell: "magic_missile" };
  }
  if (identity.classId === "warlock" && (identity.level || 1) >= 3) {
    choices.classChoices = { ...(choices.classChoices || {}), pact: "pact_of_the_blade" };
    identity.pactId = "pact_of_the_blade";
  }
  if (identity.classId === "warlock" && (identity.level || 1) >= 11) {
    choices.classChoices = { ...(choices.classChoices || {}), mystic_arcanum_spell: "mental_prison" };
  }
  if (["artisan", "charlatan", "merchant", "noble", "scribe"].includes(backgroundId)) {
    choices.featChoices = { skilled: { proficiencies: ["perception", "stealth", "tool:thieves_tools"] } };
  }
  if (identity.speciesId === "elf") choices.speciesChoices = { keen_senses_skill: "perception" };
  if (identity.speciesId === "human") choices.speciesChoices = { skillful_skill: "perception" };
  return choices;
}

function defaultWeaponMasteries(classId) {
  if (classId === "fighter") return ["longsword", "warhammer", "greatsword"];
  if (classId === "rogue") return ["rapier", "dagger"];
  if (classId === "paladin") return ["longsword", "warhammer"];
  return [];
}

function martialAbilities(primary) {
  return {
    strength: primary === "strength" ? 16 : 10,
    dexterity: primary === "dexterity" ? 16 : 12,
    constitution: 14,
    intelligence: 10,
    wisdom: 12,
    charisma: 8,
  };
}

function casterAbilities(primary) {
  return {
    strength: 8,
    dexterity: 14,
    constitution: 12,
    intelligence: primary === "intelligence" ? 16 : 10,
    wisdom: primary === "wisdom" ? 16 : 10,
    charisma: primary === "charisma" ? 16 : 10,
  };
}

function paladinAbilities() {
  return {
    strength: 16,
    dexterity: 10,
    constitution: 14,
    intelligence: 8,
    wisdom: 10,
    charisma: 14,
  };
}
