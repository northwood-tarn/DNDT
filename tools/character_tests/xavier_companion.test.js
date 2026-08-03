import assert from "node:assert/strict";
import { resolveActorToCombatActor, validateActorDefinition, validateActorInstance } from "../../app/actors/actorContract.js";
import { createXavierRecruitmentRecord, XAVIER_COMPANION_PROFILE } from "../../app/data/companions/xavier.js";

const record = XAVIER_COMPANION_PROFILE.levelSheets[1];
const sheet = record.resolvedCharacterSheet;

assert.equal(record.status, "ready");
assert.equal(sheet.identity.level, 1);
assert.equal(sheet.identity.classId, "rogue");
assert.equal(sheet.identity.backgroundId, "charlatan");
assert.equal(sheet.identity.speciesId, "elf");
assert.equal(sheet.identity.lineageId, "high");
assert.equal(sheet.abilities.dexterity.score, 17);
assert.equal(sheet.abilities.constitution.score, 10);
assert.equal(sheet.abilities.charisma.score, 12);
assert.deepEqual(sheet.proficiencies.skills.sort(), [
  "acrobatics", "deception", "history", "insight", "investigation",
  "perception", "performance", "persuasion", "sleight_of_hand", "stealth",
].sort());
assert.deepEqual(sheet.equipment.masteredWeaponIds, ["dagger", "shortbow"]);
assert.deepEqual(sheet.equipment.weaponIds, ["dagger", "shortbow"]);
assert.equal(sheet.equipment.armorId, "leather_armor");
assert.equal(sheet.combatBasics.armorClass, 14);
assert.ok(sheet.spellcasting.knownSpellIds.includes("minor_magic"));
assert.deepEqual(validateActorDefinition(record.actorDefinition), []);
assert.deepEqual(validateActorInstance(record.actorInstance, { definition: record.actorDefinition }), []);

const recruited = createXavierRecruitmentRecord();
const combatActor = resolveActorToCombatActor(recruited.definition, recruited.instance);
assert.equal(combatActor.miniatureId, "mini_preview/assets/xavier_v7.png");
assert.equal(combatActor.portraitId, "assets/images/companions/portraits/xavier.png");

const levelTwo = XAVIER_COMPANION_PROFILE.levelSheets[2];
assert.equal(levelTwo.status, "ready");
assert.ok(levelTwo.resolvedCharacterSheet.features.some((feature) => feature.name === "Cunning Action"));
assert.equal(levelTwo.actorDefinition.presentation.miniatureId, record.actorDefinition.presentation.miniatureId);
assert.equal(levelTwo.actorDefinition.presentation.portraitId, record.actorDefinition.presentation.portraitId);

const levelThree = XAVIER_COMPANION_PROFILE.levelSheets[3];
assert.equal(levelThree.status, "ready");
assert.equal(levelThree.resolvedCharacterSheet.identity.subclassId, "assassin");
assert.ok(levelThree.resolvedCharacterSheet.features.some((feature) => feature.name === "Steady Aim"));
assert.equal(levelThree.actorDefinition.presentation.miniatureId, record.actorDefinition.presentation.miniatureId);
assert.equal(levelThree.actorDefinition.presentation.portraitId, record.actorDefinition.presentation.portraitId);

const levelFour = XAVIER_COMPANION_PROFILE.levelSheets[4];
assert.equal(levelFour.status, "ready");
assert.equal(levelFour.resolvedCharacterSheet.abilities.dexterity.score, 18);
assert.ok(levelFour.resolvedCharacterSheet.features.some((feature) => feature.name === "Advancement Feat: skulker"));

const levelFive = XAVIER_COMPANION_PROFILE.levelSheets[5];
assert.equal(levelFive.status, "ready");
assert.ok(levelFive.resolvedCharacterSheet.features.some((feature) => feature.name === "Uncanny Dodge"));
assert.equal(levelFive.actorDefinition.presentation.miniatureId, record.actorDefinition.presentation.miniatureId);
assert.equal(levelFive.actorDefinition.presentation.portraitId, record.actorDefinition.presentation.portraitId);

const levelSix = XAVIER_COMPANION_PROFILE.levelSheets[6];
assert.equal(levelSix.status, "ready");
assert.ok(levelSix.resolvedCharacterSheet.proficiencies.expertise.some((entry) => entry.kind === "skill" && entry.id === "stealth"));
assert.ok(levelSix.resolvedCharacterSheet.proficiencies.expertise.some((entry) => entry.kind === "skill" && entry.id === "investigation"));

const levelSeven = XAVIER_COMPANION_PROFILE.levelSheets[7];
assert.equal(levelSeven.status, "ready");
assert.ok(levelSeven.resolvedCharacterSheet.features.some((feature) => feature.name === "Evasion"));
assert.equal(levelSeven.actorDefinition.presentation.miniatureId, record.actorDefinition.presentation.miniatureId);
assert.equal(levelSeven.actorDefinition.presentation.portraitId, record.actorDefinition.presentation.portraitId);

const levelEight = XAVIER_COMPANION_PROFILE.levelSheets[8];
assert.equal(levelEight.status, "ready");
assert.equal(levelEight.resolvedCharacterSheet.abilities.dexterity.score, 19);
assert.ok(levelEight.resolvedCharacterSheet.features.some((feature) => feature.name === "Advancement Feat: mage_slayer"));

const levelEleven = XAVIER_COMPANION_PROFILE.levelSheets[11];
assert.equal(levelEleven.status, "ready");
assert.ok(levelEleven.resolvedCharacterSheet.features.some((feature) => feature.name === "Assassinate Upgrade"));
assert.equal(
  levelEleven.resolvedCharacterSheet.features
    .find((feature) => feature.name === "Assassinate Upgrade")
    .effects.damageRiders[0].damage,
  "sneak_attack_dice",
  "Assassinate Upgrade must add Xavier's full level-scaled Sneak Attack dice, not a fixed 2d6"
);
assert.equal(levelEleven.actorDefinition.presentation.miniatureId, record.actorDefinition.presentation.miniatureId);
assert.equal(levelEleven.actorDefinition.presentation.portraitId, record.actorDefinition.presentation.portraitId);

const levelTwelve = XAVIER_COMPANION_PROFILE.levelSheets[12];
assert.equal(levelTwelve.status, "ready");
assert.equal(levelTwelve.resolvedCharacterSheet.abilities.dexterity.score, 20);
assert.ok(levelTwelve.resolvedCharacterSheet.features.some((feature) => feature.name === "Advancement Feat: sharpshooter"));

const levelThirteen = XAVIER_COMPANION_PROFILE.levelSheets[13];
assert.equal(levelThirteen.status, "ready");
assert.ok(levelThirteen.resolvedCharacterSheet.features.some((feature) => feature.name === "Umbral Guise"));
assert.equal(levelThirteen.actorDefinition.presentation.miniatureId, record.actorDefinition.presentation.miniatureId);
assert.equal(levelThirteen.actorDefinition.presentation.portraitId, record.actorDefinition.presentation.portraitId);
assert.deepEqual(validateActorDefinition(levelThirteen.actorDefinition), []);
assert.deepEqual(validateActorInstance(levelThirteen.actorInstance, { definition: levelThirteen.actorDefinition }), []);

console.log("Xavier companion level 1 sheet passed");
