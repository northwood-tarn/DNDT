#!/usr/bin/env node

import { CLASSES } from "../app/data/classes.js";
import { listFeats } from "../app/data/feats.js";
import { SPELLS, listSpellsByClass } from "../app/data/spells.js";
import {
  createDeviceRecipeChoicePools,
  createFeatChoicePools,
  createSpellChoicePools,
  createWeaponMasteryChoicePools,
} from "../app/character/choicePools.js";

const TARGET_LEVELS = parseTargetLevels();
const FRAMEWORK_WARNINGS = [];
const MIN_NEW_SPELL_LEVEL_OPTIONS = 2;
const FEATURE_CHOICE_KINDS_WITH_GENERIC_POOLS = new Set(["device_recipe"]);
const FEATURE_CHOICE_KINDS_WITH_SPECIAL_HANDLERS = new Set(["skill", "spell", "weapon"]);
const KNOWN_UI_CHOICE_KINDS = new Set([
  "ability_score",
  "damage_type",
  "saving_throw_ability",
  "skill",
  "skill_expertise",
  "skill_or_tool",
  "spell",
  "spell_list",
  "tool",
]);

const issues = [];
const notes = [];

function main() {
  auditFeatPool();
  auditSpellTags();
  auditFrameworkSurface();

  for (const classRecord of Object.values(CLASSES)) {
    auditClass(classRecord);
  }

  printReport();
  if (issues.length) process.exitCode = 1;
}

function auditClass(classRecord) {
  notes.push(`\n${classRecord.name}`);
  notes.push(`  subclasses: ${Object.keys(classRecord.subclasses || {}).join(", ") || "none"}`);

  auditSubclassChoices(classRecord);
  auditNonSubclassClassChoices(classRecord);
  auditClassLevelPath(classRecord);

  for (const [subclassName, subclass] of Object.entries(classRecord.subclasses || {})) {
    auditSubclassPath(classRecord, subclassName, subclass);
  }
}

function auditFeatPool() {
  const allFeats = listFeats();
  const generalFeats = allFeats.filter((feat) => feat.type === "general");
  const forbiddenAdvancementFeats = allFeats.filter((feat) => feat.type !== "general");
  notes.push(`Advancement feat pool: ${generalFeats.length} general feats`);

  if (!generalFeats.length) addIssue("feat_pool", "No general feats are available for ASI advancement.");
  for (const feat of forbiddenAdvancementFeats) {
    if (feat.type === "fighting_style" || feat.type === "origin") continue;
    addIssue("feat_pool", `${feat.name} has unexpected non-general type "${feat.type}".`);
  }

  for (const feat of generalFeats) {
    for (const choice of feat.choices || []) {
      if (!KNOWN_UI_CHOICE_KINDS.has(choice.kind)) {
        addIssue("feat_choices", `${feat.name} has unsupported choice kind "${choice.kind}" (${choice.id}).`);
      }
      if (!choice.id) addIssue("feat_choices", `${feat.name} has a feat choice without an id.`);
      if (Number.isFinite(choice.count) && choice.count < 1) {
        addIssue("feat_choices", `${feat.name} choice "${choice.id}" has invalid count ${choice.count}.`);
      }
    }
  }
}

function auditSpellTags() {
  for (const [id, spell] of Object.entries(SPELLS)) {
    if (spell.active === false) continue;
    if (!Array.isArray(spell.classes)) {
      addIssue("spell_tags", `${id} has no classes array.`);
      continue;
    }
  }

  assertSpellNotOnClass("toll_the_dead", "Wizard");
  assertSpellNotOnClass("conjure_vermin", "Wizard");
  assertSpellNotOnClass("lesser_restoration", "Wizard");
}

function auditSubclassChoices(classRecord) {
  const subclassChoice = (classRecord.choices || []).find((choice) => choice.kind === "subclass");
  if (Object.keys(classRecord.subclasses || {}).length && !subclassChoice) {
    addIssue(classRecord.id, "Class has subclasses but no required subclass choice.");
  }
  if (subclassChoice && subclassChoice.level !== 3) {
    addIssue(classRecord.id, `Subclass choice is at level ${subclassChoice.level}; expected level 3 for current UI path.`);
  }
}

function auditNonSubclassClassChoices(classRecord) {
  for (const choice of classRecord.choices || []) {
    if (choice.kind === "subclass") continue;
    if (choice.kind === "pact" && classRecord.id === "warlock") continue;
    addIssue(classRecord.id, `Class-level choice "${choice.id}" has no known generic level-up handling.`);
  }
}

function auditClassLevelPath(classRecord) {
  let previousMaxSpellLevel = 0;
  for (const level of TARGET_LEVELS) {
    const draft = draftFor(classRecord, level);
    const spellPools = createSpellChoicePools(draft).pools || [];
    const featPools = createFeatChoicePools(draft).pools || [];
    const masteryPools = createWeaponMasteryChoicePools(draft).pools || [];

    auditSpellPools(classRecord, level, spellPools, previousMaxSpellLevel);
    previousMaxSpellLevel = Math.max(previousMaxSpellLevel, maxSpellLevelFromPools(spellPools));

    for (const pool of featPools) {
      const badFeat = pool.options.find((feat) => feat.type !== "general");
      if (badFeat) addIssue(`${classRecord.id}:level_${level}`, `ASI pool includes non-general feat "${badFeat.name}".`);
    }

    for (const pool of masteryPools) {
      if (pool.count?.min > pool.options.length) {
        addIssue(`${classRecord.id}:level_${level}`, `Weapon mastery needs ${pool.count.min} choices but only has ${pool.options.length} options.`);
      }
    }

    const choices = featureChoiceRequirements(classRecord.features?.[level] || []);
    for (const choice of choices) auditFeatureChoice(classRecord, level, choice, `${classRecord.name} level ${level}`);
  }
}

function auditSubclassPath(classRecord, subclassName, subclass) {
  notes.push(`  ${subclassName}: features at ${Object.keys(subclass.features || {}).join(", ") || "none"}`);
  for (const level of TARGET_LEVELS) {
    const draft = draftFor(classRecord, level, subclass.id);
    const devicePools = createDeviceRecipeChoicePools(draft).pools || [];
    for (const pool of devicePools) {
      if (pool.count?.min > pool.options.length) {
        addIssue(`${classRecord.id}:${subclass.id}:level_${level}`, `Device pool "${pool.label}" needs ${pool.count.min} choices but only has ${pool.options.length} options.`);
      }
    }

    const choices = featureChoiceRequirements(subclass.features?.[level] || []);
    for (const choice of choices) auditFeatureChoice(classRecord, level, choice, `${subclassName} level ${level}`);
  }
}

function auditSpellPools(classRecord, level, pools, previousMaxSpellLevel) {
  if (!classRecord.spellcasting) return;
  if (!pools.length) {
    addIssue(`${classRecord.id}:level_${level}`, "Spellcasting class produced no spell choice pools.");
    return;
  }

  for (const pool of pools) {
    const required = Number.isFinite(pool.count) ? pool.count : pool.count?.min;
    if (required > 0 && pool.options.length < required) {
      addIssue(`${classRecord.id}:level_${level}`, `${pool.label} needs ${required} choices but only has ${pool.options.length} options.`);
    }
    for (const option of pool.options) {
      const spell = SPELLS[option.id];
      if (!spell?.classes?.includes(classRecord.name)) {
        addIssue(`${classRecord.id}:level_${level}`, `${option.name} appears in ${pool.label} but is not tagged for ${classRecord.name}.`);
      }
    }
  }

  const maxSpellLevel = maxSpellLevelForClass(classRecord.id, level);
  if (maxSpellLevel > previousMaxSpellLevel) {
    const optionsAtNewLevel = listSpellsByClass(classRecord.name)
      .filter((spell) => spell.active !== false)
      .filter((spell) => !spell.hiddenUntilUnlocked && !spell.featureGate)
      .filter((spell) => spell.level === maxSpellLevel);
    if (maxSpellLevel > 0 && optionsAtNewLevel.length < MIN_NEW_SPELL_LEVEL_OPTIONS) {
      addIssue(
        `${classRecord.id}:level_${level}`,
        `New spell level ${maxSpellLevel} has only ${optionsAtNewLevel.length} ${classRecord.name} options.`
      );
    }
  }
}

function auditFeatureChoice(classRecord, level, choice, ownerLabel) {
  if (!choice.id) addIssue(`${classRecord.id}:level_${level}`, `${ownerLabel} has a choice requirement without an id.`);
  if (!choice.kind) addIssue(`${classRecord.id}:level_${level}`, `${ownerLabel} has choice "${choice.id}" without a kind.`);
  if (!Number.isFinite(choice.count) || choice.count < 1) {
    addIssue(`${classRecord.id}:level_${level}`, `${ownerLabel} choice "${choice.id}" has invalid count.`);
  }
  if (choice.kind === "spell") auditSpellFeatureChoice(classRecord, level, choice, ownerLabel);
  if (choice.kind === "weapon") auditWeaponFeatureChoice(classRecord, choice, ownerLabel);
  if (!FEATURE_CHOICE_KINDS_WITH_GENERIC_POOLS.has(choice.kind) && !FEATURE_CHOICE_KINDS_WITH_SPECIAL_HANDLERS.has(choice.kind)) {
    addIssue(`${classRecord.id}:level_${level}`, `${ownerLabel} choice "${choice.id}" uses unsupported level-up choice kind "${choice.kind}".`);
  }
}

function auditSpellFeatureChoice(classRecord, level, choice, ownerLabel) {
  let options = [];
  if (choice.id === "mystic_arcanum_spell") {
    options = listSpellsByClass(classRecord.name).filter((spell) => spell.level === mysticArcanumSpellLevel(level));
  } else if (choice.id === "book_of_shadows_cantrips") {
    options = Object.values(SPELLS).filter((spell) => spell.active !== false && spell.level === 0);
  } else {
    options = listSpellsByClass(classRecord.name).filter((spell) => spell.level <= maxSpellLevelForClass(classRecord.id, level));
  }
  if (options.length < choice.count) {
    addIssue(`${classRecord.id}:level_${level}`, `${ownerLabel} spell choice "${choice.id}" needs ${choice.count} choices but only has ${options.length} options.`);
  }
}

function auditWeaponFeatureChoice(classRecord, choice, ownerLabel) {
  if (classRecord.id === "wizard" && choice.id === "arcane_armament_weapon") {
    const battlemage = Object.values(classRecord.subclasses || {}).find((subclass) => subclass.id === "battlemage");
    const proficiencies = battlemage?.features?.[3]
      ?.flatMap((feature) => feature.effects?.proficiencies?.weapons || [])
      ?.filter(Boolean) || [];
    if (!proficiencies.includes("regular") || !proficiencies.includes("martial")) {
      addIssue("wizard:battlemage", `${ownerLabel} should grant all regular and martial weapons before choosing Arcane Armament.`);
    }
  }
}

function featureChoiceRequirements(features) {
  return features.flatMap((feature) => feature.effects?.choiceRequirements || []);
}

function draftFor(classRecord, level, subclassId = null) {
  return {
    identity: {
      name: `Audit ${classRecord.name}`,
      classId: classRecord.id,
      level,
      speciesId: "human",
      lineageId: "versatile",
      backgroundId: "sage",
      subclassId,
    },
    abilities: {
      strength: 12,
      dexterity: 14,
      constitution: 14,
      intelligence: 14,
      wisdom: 14,
      charisma: 14,
    },
    choices: {
      advancementChoices: {},
      classChoices: {},
      featChoices: {},
      speciesChoices: {},
      weaponMasteryIds: [],
    },
    spells: {
      knownSpellIds: [],
      preparedSpellIds: [],
    },
    gear: {
      weaponIds: [],
      armorId: null,
      shieldId: null,
    },
    devices: {
      preparedRecipeIds: [],
    },
  };
}

function maxSpellLevelFromPools(pools) {
  return Math.max(0, ...pools.flatMap((pool) => pool.options.map((option) => option.level || 0)));
}

function maxSpellLevelForClass(classId, level) {
  if (classId === "paladin") return level >= 17 ? 5 : level >= 13 ? 4 : level >= 9 ? 3 : level >= 5 ? 2 : 1;
  if (classId === "warlock") return level >= 9 ? 5 : level >= 7 ? 4 : level >= 5 ? 3 : level >= 3 ? 2 : 1;
  return level >= 13 ? 7 : level >= 11 ? 6 : level >= 9 ? 5 : level >= 7 ? 4 : level >= 5 ? 3 : level >= 3 ? 2 : 1;
}

function mysticArcanumSpellLevel(level) {
  if (level >= 17) return 9;
  if (level >= 15) return 8;
  if (level >= 13) return 7;
  return 6;
}

function assertSpellNotOnClass(spellId, className) {
  const spell = SPELLS[spellId];
  if (spell?.classes?.includes(className)) {
    addIssue("spell_tags", `${spell.name} must not appear on the ${className} spell list.`);
  }
}

function addIssue(scope, message) {
  issues.push({ scope, message });
}

function addFrameworkWarning(message) {
  FRAMEWORK_WARNINGS.push(message);
}

function auditFrameworkSurface() {
  addFrameworkWarning("The manifest framework emits HP rolls, class choices, known spell/cantrip deltas, exact-level ASI/feat choices, feature choice requirements, and automatic feature grants.");
  addFrameworkWarning("Subclass and Warlock pact selection are emitted as manifest single_choice steps.");
  addFrameworkWarning("Feature choiceRequirements for skill, spell, weapon, and device_recipe are emitted as manifest choice steps.");
  addFrameworkWarning("Prepared spell pools exist in the generic choice framework, but level-up UI should suppress prepared-spell changes and leave them to rest/preparation.");
}

function parseTargetLevels() {
  const arg = process.argv.find((item) => item.startsWith("--levels="));
  if (!arg) return [...Array(13)].map((_, index) => index + 1);
  const raw = arg.slice("--levels=".length).trim();
  const range = raw.match(/^(\d+)-(\d+)$/);
  if (range) {
    const start = Number(range[1]);
    const end = Number(range[2]);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }
  return raw.split(",").map((item) => Number(item.trim())).filter(Number.isInteger);
}

function printReport() {
  console.log("Level-up choice audit");
  console.log("=====================");
  console.log(`Levels: ${TARGET_LEVELS.join(", ")}`);
  for (const note of notes) console.log(note);
  console.log("");

  if (FRAMEWORK_WARNINGS.length) {
    console.log("Framework notes:");
    for (const warning of FRAMEWORK_WARNINGS) console.log(`- ${warning}`);
    console.log("");
  }

  if (!issues.length) {
    console.log("PASS: no level-up choice issues found.");
    return;
  }

  console.log(`FAIL: ${issues.length} issue(s) found.`);
  for (const issue of issues) {
    console.log(`- ${issue.scope}: ${issue.message}`);
  }
}

main();
