import assert from "node:assert/strict";
import { createTaraRecruitmentRecord, TARA_COMPANION_PROFILE } from "../../app/data/companions/tara.js";
import { resolveActorToCombatActor, validateActorDefinition, validateActorInstance } from "../../app/actors/actorContract.js";

const record = TARA_COMPANION_PROFILE.levelSheets[1];
const sheet = record.resolvedCharacterSheet;

assert.equal(record.status, "ready");
assert.equal(sheet.identity.level, 1);
assert.equal(sheet.identity.classId, "fighter");
assert.equal(sheet.identity.backgroundId, "criminal");
assert.equal(sheet.identity.speciesId, "human");
assert.deepEqual(sheet.abilities.dexterity.score, 17);
assert.deepEqual(sheet.abilities.constitution.score, 14);
assert.deepEqual(sheet.proficiencies.skills.sort(), ["acrobatics", "deception", "perception", "sleight_of_hand", "stealth"].sort());
assert.deepEqual(sheet.equipment.masteredWeaponIds, ["rapier", "shortbow", "dagger"]);
assert.deepEqual(sheet.equipment.weaponIds, ["rapier", "shortbow"]);
assert.deepEqual(sheet.equipment.inventory, [{ id: "dagger", quantity: 1 }]);
assert.deepEqual(sheet.equipment.ringIds, ["ring_of_protection"]);
assert.ok(sheet.features.some((feature) => feature.id === "background:criminal:origin_feat"));
assert.ok(sheet.features.some((feature) => feature.id.includes("origin_feat:lucky")));
assert.ok(sheet.features.some((feature) => feature.id === "fighting_style:dueling"));
assert.equal(sheet.combatBasics.armorClass, 16);
assert.deepEqual(validateActorDefinition(record.actorDefinition), []);
assert.deepEqual(validateActorInstance(record.actorInstance, { definition: record.actorDefinition }), []);
const recruited = createTaraRecruitmentRecord();
const combatActor = resolveActorToCombatActor(recruited.definition, recruited.instance);
assert.equal(combatActor.miniatureId, "mini_preview/assets/tara_human_rapier_v4.png");
assert.equal(combatActor.portraitId, "assets/images/companions/portraits/tara.png");

const levelTwo = TARA_COMPANION_PROFILE.levelSheets[2];
assert.equal(levelTwo.status, "ready");
assert.equal(levelTwo.resolvedCharacterSheet.identity.level, 2);
assert.equal(levelTwo.resolvedCharacterSheet.durability.maxHp, 20);
assert.ok(levelTwo.resolvedCharacterSheet.features.some((feature) => feature.name === "Action Surge"));
assert.equal(levelTwo.actorDefinition.presentation.miniatureId, "mini_preview/assets/tara_human_rapier_v4.png");
assert.equal(levelTwo.actorDefinition.presentation.portraitId, "assets/images/companions/portraits/tara.png");

const levelThree = TARA_COMPANION_PROFILE.levelSheets[3];
assert.equal(levelThree.status, "ready");
assert.equal(levelThree.resolvedCharacterSheet.identity.subclassId, "duelist");
assert.equal(levelThree.actorDefinition.presentation.miniatureId, levelTwo.actorDefinition.presentation.miniatureId);
assert.equal(levelThree.actorDefinition.presentation.portraitId, levelTwo.actorDefinition.presentation.portraitId);

const levelFour = TARA_COMPANION_PROFILE.levelSheets[4];
assert.equal(levelFour.status, "ready");
assert.equal(levelFour.resolvedCharacterSheet.abilities.dexterity.score, 18);
assert.ok(levelFour.resolvedCharacterSheet.features.some((feature) => feature.name === "Advancement Feat: piercer"));

const levelFive = TARA_COMPANION_PROFILE.levelSheets[5];
assert.equal(levelFive.status, "ready");
assert.equal(levelFive.resolvedCharacterSheet.combatBasics.attackActionAttacks, 2);

const levelSeven = TARA_COMPANION_PROFILE.levelSheets[7];
assert.equal(levelSeven.status, "ready");
assert.ok(levelSeven.resolvedCharacterSheet.features.some((feature) => feature.name === "Evasive Step"));
assert.equal(levelSeven.actorDefinition.presentation.miniatureId, levelTwo.actorDefinition.presentation.miniatureId);
assert.equal(levelSeven.actorDefinition.presentation.portraitId, levelTwo.actorDefinition.presentation.portraitId);

const levelEight = TARA_COMPANION_PROFILE.levelSheets[8];
assert.equal(levelEight.status, "ready");
assert.equal(levelEight.resolvedCharacterSheet.abilities.dexterity.score, 19);
assert.ok(levelEight.resolvedCharacterSheet.features.some((feature) => feature.name === "Advancement Feat: speedy"));

const levelEleven = TARA_COMPANION_PROFILE.levelSheets[11];
assert.equal(levelEleven.status, "ready");
assert.equal(levelEleven.resolvedCharacterSheet.combatBasics.attackActionAttacks, 3);
assert.ok(levelEleven.resolvedCharacterSheet.features.some((feature) => feature.name === "Deadly Precision"));
assert.equal(levelEleven.actorDefinition.presentation.miniatureId, levelTwo.actorDefinition.presentation.miniatureId);
assert.equal(levelEleven.actorDefinition.presentation.portraitId, levelTwo.actorDefinition.presentation.portraitId);

const levelTwelve = TARA_COMPANION_PROFILE.levelSheets[12];
assert.equal(levelTwelve.status, "ready");
assert.equal(levelTwelve.resolvedCharacterSheet.abilities.dexterity.score, 20);
assert.ok(levelTwelve.resolvedCharacterSheet.features.some((feature) => feature.name === "Advancement Feat: mage_slayer"));

const levelThirteen = TARA_COMPANION_PROFILE.levelSheets[13];
assert.equal(levelThirteen.status, "ready");
assert.equal(levelThirteen.resolvedCharacterSheet.identity.level, 13);
assert.equal(levelThirteen.actorDefinition.presentation.miniatureId, levelTwo.actorDefinition.presentation.miniatureId);
assert.equal(levelThirteen.actorDefinition.presentation.portraitId, levelTwo.actorDefinition.presentation.portraitId);
assert.deepEqual(validateActorDefinition(levelThirteen.actorDefinition), []);
assert.deepEqual(validateActorInstance(levelThirteen.actorInstance, { definition: levelThirteen.actorDefinition }), []);

console.log("Tara companion level 1 sheet passed");
