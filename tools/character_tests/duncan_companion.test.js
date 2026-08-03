import assert from "node:assert/strict";
import { resolveActorToCombatActor, validateActorDefinition, validateActorInstance } from "../../app/actors/actorContract.js";
import { createDuncanRecruitmentRecord, DUNCAN_COMPANION_PROFILE } from "../../app/data/companions/duncan.js";

const record = DUNCAN_COMPANION_PROFILE.levelSheets[1];
const sheet = record.resolvedCharacterSheet;

assert.equal(record.status, "ready");
assert.equal(sheet.identity.classId, "cleric");
assert.equal(sheet.identity.backgroundId, "acolyte");
assert.equal(sheet.identity.speciesId, "human");
assert.equal(sheet.abilities.wisdom.score, 17);
assert.equal(sheet.abilities.constitution.score, 13);
assert.equal(sheet.abilities.intelligence.score, 13);
assert.deepEqual(sheet.proficiencies.skills.sort(), ["insight", "medicine", "perception", "religion", "survival"].sort());
assert.deepEqual(sheet.equipment.weaponIds, ["mace", "clerics_holy_symbol"]);
assert.equal(sheet.equipment.armorId, "scale_mail");
assert.equal(sheet.equipment.shieldId, "shield");
assert.equal(sheet.combatBasics.armorClass, 16);
assert.deepEqual(sheet.spellcasting.preparedSpellIds, ["cure_wounds", "healing_word", "bless", "shield_of_faith"]);
assert.equal(DUNCAN_COMPANION_PROFILE.spellPreparation.policy, "preserve_player_loadout_on_level_change");
assert.deepEqual(validateActorDefinition(record.actorDefinition), []);
assert.deepEqual(validateActorInstance(record.actorInstance, { definition: record.actorDefinition }), []);

const recruited = createDuncanRecruitmentRecord();
const combatActor = resolveActorToCombatActor(recruited.definition, recruited.instance);
assert.equal(combatActor.miniatureId, "mini_preview/assets/duncan_v1_chroma_cutout.png");
assert.equal(combatActor.portraitId, "assets/images/companions/portraits/duncan.png");

const levelTwo = DUNCAN_COMPANION_PROFILE.levelSheets[2];
assert.equal(levelTwo.status, "ready");
assert.ok(levelTwo.resolvedCharacterSheet.features.some((feature) => feature.name === "Turn Undead (Channel Divinity)"));
assert.deepEqual(levelTwo.resolvedCharacterSheet.spellcasting.preparedSpellIds, sheet.spellcasting.preparedSpellIds);

const levelThree = DUNCAN_COMPANION_PROFILE.levelSheets[3];
assert.equal(levelThree.status, "ready");
assert.equal(levelThree.resolvedCharacterSheet.identity.subclassId, "lantern_domain");
assert.deepEqual(levelThree.resolvedCharacterSheet.spellcasting.preparedSpellIds, sheet.spellcasting.preparedSpellIds);
assert.equal(levelThree.actorDefinition.presentation.miniatureId, record.actorDefinition.presentation.miniatureId);
assert.equal(levelThree.actorDefinition.presentation.portraitId, record.actorDefinition.presentation.portraitId);

const levelFour = DUNCAN_COMPANION_PROFILE.levelSheets[4];
assert.equal(levelFour.status, "ready");
assert.equal(levelFour.resolvedCharacterSheet.abilities.wisdom.score, 18);
assert.ok(levelFour.resolvedCharacterSheet.features.some((feature) => feature.name === "Advancement Feat: inspiring_leader"));

const levelFive = DUNCAN_COMPANION_PROFILE.levelSheets[5];
assert.equal(levelFive.status, "ready");
assert.deepEqual(levelFive.resolvedCharacterSheet.spellcasting.preparedSpellIds, [
  ...sheet.spellcasting.preparedSpellIds,
  "aid",
  "mass_healing_word",
]);

const levelSeven = DUNCAN_COMPANION_PROFILE.levelSheets[7];
assert.equal(levelSeven.status, "ready");
assert.equal(levelSeven.actorDefinition.presentation.miniatureId, record.actorDefinition.presentation.miniatureId);
assert.equal(levelSeven.actorDefinition.presentation.portraitId, record.actorDefinition.presentation.portraitId);

const levelEight = DUNCAN_COMPANION_PROFILE.levelSheets[8];
assert.equal(levelEight.status, "ready");
assert.equal(levelEight.resolvedCharacterSheet.abilities.constitution.score, 14);
assert.ok(levelEight.resolvedCharacterSheet.proficiencies.savingThrows.includes("constitution"));
assert.deepEqual(levelEight.resolvedCharacterSheet.spellcasting.preparedSpellIds.slice(0, 6), levelFive.resolvedCharacterSheet.spellcasting.preparedSpellIds);

const levelTen = DUNCAN_COMPANION_PROFILE.levelSheets[10];
assert.equal(levelTen.status, "ready");
assert.equal(levelTen.resolvedCharacterSheet.spellcasting.preparedSpellIds.length, 14);
assert.deepEqual(levelTen.resolvedCharacterSheet.spellcasting.preparedSpellIds.slice(0, 9), levelEight.resolvedCharacterSheet.spellcasting.preparedSpellIds);

const levelEleven = DUNCAN_COMPANION_PROFILE.levelSheets[11];
assert.equal(levelEleven.status, "ready");
assert.ok(levelEleven.resolvedCharacterSheet.features.some((feature) => feature.name === "Judging Flame"));
assert.equal(levelEleven.actorDefinition.presentation.miniatureId, record.actorDefinition.presentation.miniatureId);
assert.equal(levelEleven.actorDefinition.presentation.portraitId, record.actorDefinition.presentation.portraitId);

const levelTwelve = DUNCAN_COMPANION_PROFILE.levelSheets[12];
assert.equal(levelTwelve.status, "ready");
assert.equal(levelTwelve.resolvedCharacterSheet.abilities.wisdom.score, 20);
assert.equal(levelTwelve.resolvedCharacterSheet.spellcasting.preparedSpellIds.length, 16);
assert.deepEqual(levelTwelve.resolvedCharacterSheet.spellcasting.preparedSpellIds.slice(0, 14), levelTen.resolvedCharacterSheet.spellcasting.preparedSpellIds);

const levelThirteen = DUNCAN_COMPANION_PROFILE.levelSheets[13];
assert.equal(levelThirteen.status, "ready");
assert.ok(levelThirteen.resolvedCharacterSheet.features.some((feature) => feature.name === "Halo of Daybreak"));
const halo = levelThirteen.resolvedCharacterSheet.features.find((feature) => feature.name === "Halo of Daybreak");
assert.equal(halo.effects.actionOptions[0].createsCombatObject.radiusFt, 20);
assert.equal(halo.effects.actionOptions[0].createsCombatObject.effects.find((effect) => effect.id === "halo_enemy_start_damage").damage, "wisdom_modifier+proficiency_bonus");
assert.equal(halo.effects.actionOptions[0].createsCombatObject.effects.some((effect) => effect.id === "halo_enemy_attack_advantage_vs_source"), false);
assert.equal(levelThirteen.actorDefinition.presentation.miniatureId, record.actorDefinition.presentation.miniatureId);
assert.equal(levelThirteen.actorDefinition.presentation.portraitId, record.actorDefinition.presentation.portraitId);
assert.deepEqual(validateActorDefinition(levelThirteen.actorDefinition), []);
assert.deepEqual(validateActorInstance(levelThirteen.actorInstance, { definition: levelThirteen.actorDefinition }), []);

console.log("Duncan companion level 1 sheet passed");
