import assert from "node:assert/strict";
import { resolveActorToCombatActor, validateActorDefinition, validateActorInstance } from "../../app/actors/actorContract.js";
import { createTahroneRecruitmentRecord, TAHRONE_COMPANION_PROFILE } from "../../app/data/companions/tahrone.js";

const record = TAHRONE_COMPANION_PROFILE.levelSheets[1];
const sheet = record.resolvedCharacterSheet;

assert.equal(record.status, "ready");
assert.equal(sheet.identity.classId, "wizard");
assert.equal(sheet.identity.backgroundId, "noble");
assert.equal(sheet.identity.speciesId, "aasimar");
assert.equal(sheet.abilities.intelligence.score, 17);
assert.equal(sheet.abilities.wisdom.score, 13);
assert.deepEqual(sheet.proficiencies.skills.sort(), ["arcana", "history", "insight", "investigation", "medicine", "persuasion", "religion"].sort());
assert.deepEqual(sheet.equipment.weaponIds, ["wizards_staff"]);
assert.deepEqual(sheet.equipment.inventory, [{ id: "dagger", quantity: 1 }]);
assert.deepEqual(sheet.spellcasting.knownSpellIds, ["chill_touch", "mind_sliver", "mending"]);
assert.deepEqual(sheet.spellcasting.preparedSpellIds, ["mage_armor", "shield", "false_life", "ray_of_sickness"]);
assert.equal(TAHRONE_COMPANION_PROFILE.spellPreparation.policy, "preserve_player_loadout_on_level_change");
assert.equal(TAHRONE_COMPANION_PROFILE.presentationVariants.default, "masked");
assert.deepEqual(validateActorDefinition(record.actorDefinition), []);
assert.deepEqual(validateActorInstance(record.actorInstance, { definition: record.actorDefinition }), []);

const recruited = createTahroneRecruitmentRecord();
const combatActor = resolveActorToCombatActor(recruited.definition, recruited.instance);
assert.equal(combatActor.miniatureId, "mini_preview/assets/tahrone_masked_base.png");
assert.equal(combatActor.portraitId, "assets/images/companions/portraits/tahrone.png");

const levelTwo = TAHRONE_COMPANION_PROFILE.levelSheets[2];
assert.equal(levelTwo.status, "ready");
assert.deepEqual(levelTwo.resolvedCharacterSheet.spellcasting.preparedSpellIds, sheet.spellcasting.preparedSpellIds);

const levelThree = TAHRONE_COMPANION_PROFILE.levelSheets[3];
assert.equal(levelThree.status, "ready");
assert.equal(levelThree.resolvedCharacterSheet.identity.subclassId, "necromancer");
assert.ok(levelThree.resolvedCharacterSheet.features.some((feature) => feature.name === "Seal of Mortality"));
assert.equal(levelThree.actorDefinition.presentation.miniatureId, record.actorDefinition.presentation.miniatureId);
assert.equal(levelThree.actorDefinition.presentation.portraitId, record.actorDefinition.presentation.portraitId);

const levelFour = TAHRONE_COMPANION_PROFILE.levelSheets[4];
assert.equal(levelFour.status, "ready");
assert.equal(levelFour.resolvedCharacterSheet.abilities.intelligence.score, 18);
assert.ok(levelFour.resolvedCharacterSheet.proficiencies.expertise.some((entry) => entry.kind === "skill" && entry.id === "arcana"));
assert.deepEqual(levelFour.characterDraft.metadata.spellbookSpellIds, [
  "mage_armor", "shield", "false_life", "ray_of_sickness", "detect_magic", "silent_image",
  "witch_bolt", "magic_missile",
  "misty_step", "darkness",
  "hold_foe", "shatter",
]);
assert.deepEqual(levelFour.resolvedCharacterSheet.spellcasting.preparedSpellIds, sheet.spellcasting.preparedSpellIds);
assert.equal(levelFour.actorDefinition.presentation.miniatureId, record.actorDefinition.presentation.miniatureId);
assert.equal(levelFour.actorDefinition.presentation.portraitId, record.actorDefinition.presentation.portraitId);

const levelFive = TAHRONE_COMPANION_PROFILE.levelSheets[5];
assert.equal(levelFive.status, "ready");
assert.ok(levelFive.resolvedCharacterSheet.spellcasting.knownSpellIds.includes("shocking_grasp"));
assert.deepEqual(levelFive.characterDraft.metadata.spellbookSpellIds.slice(-2), ["counterspell", "hypnotic_pattern"]);
assert.deepEqual(levelFive.resolvedCharacterSheet.spellcasting.preparedSpellIds.slice(0, 4), sheet.spellcasting.preparedSpellIds);
assert.deepEqual(levelFive.resolvedCharacterSheet.spellcasting.preparedSpellIds.slice(-2), ["counterspell", "hypnotic_pattern"]);
assert.equal(TAHRONE_COMPANION_PROFILE.spellPreparation.policy, "preserve_player_loadout_on_level_change");

const levelSix = TAHRONE_COMPANION_PROFILE.levelSheets[6];
assert.equal(levelSix.status, "ready");
assert.deepEqual(levelSix.characterDraft.metadata.spellbookSpellIds.slice(-2), ["remove_curse", "fireball"]);
assert.deepEqual(levelSix.resolvedCharacterSheet.spellcasting.preparedSpellIds, levelFive.resolvedCharacterSheet.spellcasting.preparedSpellIds);
assert.ok(levelSix.resolvedCharacterSheet.features.some((feature) => feature.name === "Arcane Focus"));
assert.equal(levelSix.actorDefinition.presentation.miniatureId, record.actorDefinition.presentation.miniatureId);
assert.equal(levelSix.actorDefinition.presentation.portraitId, record.actorDefinition.presentation.portraitId);

const levelSeven = TAHRONE_COMPANION_PROFILE.levelSheets[7];
assert.equal(levelSeven.status, "ready");
assert.deepEqual(levelSeven.characterDraft.metadata.spellbookSpellIds.slice(-2), ["blight", "phantasmal_killer"]);
assert.deepEqual(levelSeven.resolvedCharacterSheet.spellcasting.preparedSpellIds, levelSix.resolvedCharacterSheet.spellcasting.preparedSpellIds);
assert.ok(levelSeven.resolvedCharacterSheet.features.some((feature) => feature.name === "Black Aegis"));
assert.equal(levelSeven.actorDefinition.presentation.miniatureId, record.actorDefinition.presentation.miniatureId);
assert.equal(levelSeven.actorDefinition.presentation.portraitId, record.actorDefinition.presentation.portraitId);

const levelEight = TAHRONE_COMPANION_PROFILE.levelSheets[8];
assert.equal(levelEight.status, "ready");
assert.equal(levelEight.resolvedCharacterSheet.abilities.intelligence.score, 19);
assert.ok(levelEight.resolvedCharacterSheet.features.some((feature) => feature.name === "Advancement Feat: war_caster"));
assert.deepEqual(levelEight.characterDraft.metadata.spellbookSpellIds.slice(-2), ["dimension_door", "fire_shield"]);
assert.deepEqual(levelEight.resolvedCharacterSheet.spellcasting.preparedSpellIds.slice(0, 6), levelSeven.resolvedCharacterSheet.spellcasting.preparedSpellIds);
assert.deepEqual(levelEight.resolvedCharacterSheet.spellcasting.preparedSpellIds.slice(-3), ["fireball", "dimension_door", "fire_shield"]);
assert.equal(levelEight.actorDefinition.presentation.miniatureId, record.actorDefinition.presentation.miniatureId);
assert.equal(levelEight.actorDefinition.presentation.portraitId, record.actorDefinition.presentation.portraitId);

const levelNine = TAHRONE_COMPANION_PROFILE.levelSheets[9];
assert.equal(levelNine.status, "ready");
assert.deepEqual(levelNine.characterDraft.metadata.spellbookSpellIds.slice(-2), ["cone_of_cold", "wall_of_force"]);
assert.deepEqual(levelNine.resolvedCharacterSheet.spellcasting.preparedSpellIds, levelEight.resolvedCharacterSheet.spellcasting.preparedSpellIds);
assert.equal(levelNine.actorDefinition.presentation.miniatureId, record.actorDefinition.presentation.miniatureId);
assert.equal(levelNine.actorDefinition.presentation.portraitId, record.actorDefinition.presentation.portraitId);

const levelTen = TAHRONE_COMPANION_PROFILE.levelSheets[10];
assert.equal(levelTen.status, "ready");
assert.ok(levelTen.resolvedCharacterSheet.features.some((feature) => feature.name === "Jester’s Book of Shortcuts"));
assert.ok(levelTen.resolvedCharacterSheet.spellcasting.knownSpellIds.includes("ray_of_frost"));
assert.ok(levelTen.resolvedCharacterSheet.spellcasting.knownSpellIds.includes("false_life_jester"));
assert.deepEqual(levelTen.characterDraft.metadata.spellbookSpellIds.slice(-2), ["cloudkill", "dispel_magic"]);
assert.deepEqual(levelTen.resolvedCharacterSheet.spellcasting.preparedSpellIds.slice(0, 9), levelNine.resolvedCharacterSheet.spellcasting.preparedSpellIds);
assert.deepEqual(levelTen.resolvedCharacterSheet.spellcasting.preparedSpellIds.slice(-5), ["cone_of_cold", "wall_of_force", "cloudkill", "dispel_magic", "blight"]);
assert.equal(levelTen.actorDefinition.presentation.miniatureId, record.actorDefinition.presentation.miniatureId);
assert.equal(levelTen.actorDefinition.presentation.portraitId, record.actorDefinition.presentation.portraitId);

const levelEleven = TAHRONE_COMPANION_PROFILE.levelSheets[11];
assert.equal(levelEleven.status, "ready");
assert.deepEqual(levelEleven.characterDraft.metadata.spellbookSpellIds.slice(-2), ["circle_of_death", "disintegrate"]);
assert.deepEqual(levelEleven.resolvedCharacterSheet.spellcasting.preparedSpellIds, levelTen.resolvedCharacterSheet.spellcasting.preparedSpellIds);
assert.equal(levelEleven.actorDefinition.presentation.miniatureId, record.actorDefinition.presentation.miniatureId);
assert.equal(levelEleven.actorDefinition.presentation.portraitId, record.actorDefinition.presentation.portraitId);

const levelTwelve = TAHRONE_COMPANION_PROFILE.levelSheets[12];
assert.equal(levelTwelve.status, "ready");
assert.equal(levelTwelve.resolvedCharacterSheet.abilities.intelligence.score, 20);
assert.equal(levelTwelve.resolvedCharacterSheet.abilities.constitution.score, 14);
assert.deepEqual(levelTwelve.characterDraft.metadata.spellbookSpellIds.slice(-2), ["chain_lightning", "globe_of_invulnerability"]);
assert.deepEqual(levelTwelve.resolvedCharacterSheet.spellcasting.preparedSpellIds.slice(0, 14), levelEleven.resolvedCharacterSheet.spellcasting.preparedSpellIds);
assert.deepEqual(levelTwelve.resolvedCharacterSheet.spellcasting.preparedSpellIds.slice(-2), ["chain_lightning", "globe_of_invulnerability"]);
assert.equal(levelTwelve.actorDefinition.presentation.miniatureId, record.actorDefinition.presentation.miniatureId);
assert.equal(levelTwelve.actorDefinition.presentation.portraitId, record.actorDefinition.presentation.portraitId);

const levelThirteen = TAHRONE_COMPANION_PROFILE.levelSheets[13];
assert.equal(levelThirteen.status, "ready");
assert.deepEqual(levelThirteen.characterDraft.metadata.spellbookSpellIds.slice(-2), ["finger_of_death", "forcecage"]);
assert.deepEqual(levelThirteen.resolvedCharacterSheet.spellcasting.preparedSpellIds, levelTwelve.resolvedCharacterSheet.spellcasting.preparedSpellIds);
assert.equal(levelThirteen.actorDefinition.presentation.miniatureId, record.actorDefinition.presentation.miniatureId);
assert.equal(levelThirteen.actorDefinition.presentation.portraitId, record.actorDefinition.presentation.portraitId);

console.log("Tahrone companion level 1 sheet passed");
