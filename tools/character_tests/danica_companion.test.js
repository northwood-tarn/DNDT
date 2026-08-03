import assert from "node:assert/strict";
import { resolveActorToCombatActor, validateActorDefinition, validateActorInstance } from "../../app/actors/actorContract.js";
import { createCombatLog } from "../../app/combat/combatLog.js";
import { createEnemyCombatActor } from "../../app/combat/enemyFactory.js";
import { moveActor } from "../../app/combat/resolver.js";
import { createDanicaRecruitmentRecord, DANICA_COMPANION_PROFILE } from "../../app/data/companions/danica.js";

const record = DANICA_COMPANION_PROFILE.levelSheets[1];
const sheet = record.resolvedCharacterSheet;

assert.ok(sheet.features.some((feature) => feature.name === "Father’s Guard"));
assert.ok(sheet.featureHooks.some((hook) => hook.id === "fathers_guard_ac_while_armored"));
assert.equal(sheet.combatBasics.armorClass, 15);
assert.equal(record.combatActor.ac, 15);

assert.equal(record.status, "ready");
assert.equal(sheet.identity.classId, "paladin");
assert.equal(sheet.identity.backgroundId, "soldier");
assert.equal(sheet.identity.speciesId, "human");
assert.equal(sheet.abilities.strength.score, 17);
assert.equal(sheet.abilities.charisma.score, 14);
assert.equal(sheet.abilities.constitution.score, 14);
assert.deepEqual(sheet.proficiencies.skills.sort(), ["athletics", "insight", "intimidation", "investigation", "perception"].sort());
assert.deepEqual(sheet.equipment.masteredWeaponIds, ["greatsword", "javelin"]);
assert.deepEqual(sheet.equipment.weaponIds, ["greatsword", "clerics_holy_symbol"]);
assert.deepEqual(sheet.equipment.inventory, [{ id: "javelin", quantity: 1 }]);
assert.equal(sheet.equipment.armorId, "half_plate");
assert.equal(sheet.combatBasics.armorClass, 15);
assert.deepEqual(sheet.spellcasting.preparedSpellIds, ["bless", "shield_of_faith"]);
assert.equal(DANICA_COMPANION_PROFILE.spellPreparation.policy, "preserve_player_loadout_on_level_change");
assert.deepEqual(validateActorDefinition(record.actorDefinition), []);
assert.deepEqual(validateActorInstance(record.actorInstance, { definition: record.actorDefinition }), []);

const recruited = createDanicaRecruitmentRecord();
const combatActor = resolveActorToCombatActor(recruited.definition, recruited.instance);
assert.equal(combatActor.miniatureId, "mini_preview/assets/danica_v4_locked.png");
assert.equal(combatActor.portraitId, "assets/images/companions/portraits/danica.png");

const levelTwo = DANICA_COMPANION_PROFILE.levelSheets[2];
assert.equal(levelTwo.status, "ready");
assert.ok(levelTwo.resolvedCharacterSheet.features.some((feature) => feature.name === "Paladin's Smite"));
assert.deepEqual(levelTwo.resolvedCharacterSheet.spellcasting.preparedSpellIds.slice(0, 2), sheet.spellcasting.preparedSpellIds);

const levelThree = DANICA_COMPANION_PROFILE.levelSheets[3];
assert.equal(levelThree.status, "ready");
assert.equal(levelThree.resolvedCharacterSheet.identity.subclassId, "oath_of_vengeance");
assert.ok(levelThree.resolvedCharacterSheet.features.some((feature) => feature.name === "Vow of Enmity"));
assert.equal(levelThree.actorDefinition.presentation.miniatureId, record.actorDefinition.presentation.miniatureId);
assert.equal(levelThree.actorDefinition.presentation.portraitId, record.actorDefinition.presentation.portraitId);

const levelFour = DANICA_COMPANION_PROFILE.levelSheets[4];
assert.equal(levelFour.status, "ready");
assert.equal(levelFour.resolvedCharacterSheet.abilities.strength.score, 18);
assert.ok(levelFour.resolvedCharacterSheet.features.some((feature) => feature.name === "Advancement Feat: great_weapon_master"));
assert.deepEqual(levelFour.resolvedCharacterSheet.spellcasting.preparedSpellIds, [
  ...sheet.spellcasting.preparedSpellIds,
  "protection_from_evil_and_good",
  "divine_smite",
]);

const levelFive = DANICA_COMPANION_PROFILE.levelSheets[5];
assert.equal(levelFive.status, "ready");
assert.equal(levelFive.resolvedCharacterSheet.combatBasics.attackActionAttacks, 2);

const levelSeven = DANICA_COMPANION_PROFILE.levelSheets[7];
assert.equal(levelSeven.status, "ready");
assert.ok(levelSeven.resolvedCharacterSheet.features.some((feature) => feature.name === "Chains of Vengeance"));
assert.equal(levelSeven.actorDefinition.presentation.miniatureId, record.actorDefinition.presentation.miniatureId);
assert.equal(levelSeven.actorDefinition.presentation.portraitId, record.actorDefinition.presentation.portraitId);

const levelEight = DANICA_COMPANION_PROFILE.levelSheets[8];
assert.equal(levelEight.status, "ready");
assert.equal(levelEight.resolvedCharacterSheet.abilities.strength.score, 19);
assert.equal(levelEight.resolvedCharacterSheet.abilities.charisma.score, 15);
assert.deepEqual(levelEight.resolvedCharacterSheet.spellcasting.preparedSpellIds.slice(0, 3), levelFour.resolvedCharacterSheet.spellcasting.preparedSpellIds.slice(0, 3));

const levelTen = DANICA_COMPANION_PROFILE.levelSheets[10];
assert.equal(levelTen.status, "ready");
assert.ok(levelTen.resolvedCharacterSheet.spellcasting.preparedSpellIds.includes("crusaders_mantle"));

const levelEleven = DANICA_COMPANION_PROFILE.levelSheets[11];
assert.equal(levelEleven.status, "ready");
assert.ok(levelEleven.resolvedCharacterSheet.features.some((feature) => feature.name === "Relentless Pursuit"));
assert.ok(levelEleven.resolvedCharacterSheet.features.some((feature) => feature.name === "Greater Radiant Smite"));
assert.equal(levelEleven.actorDefinition.presentation.miniatureId, record.actorDefinition.presentation.miniatureId);
assert.equal(levelEleven.actorDefinition.presentation.portraitId, record.actorDefinition.presentation.portraitId);

const levelTwelve = DANICA_COMPANION_PROFILE.levelSheets[12];
assert.equal(levelTwelve.status, "ready");
assert.equal(levelTwelve.resolvedCharacterSheet.abilities.strength.score, 20);
assert.equal(levelTwelve.resolvedCharacterSheet.combatBasics.armorClass, 19);
assert.equal(levelTwelve.combatActor.ac, 19);
assert.equal(levelTwelve.resolvedCharacterSheet.abilities.charisma.score, 15);
assert.equal(levelTwelve.resolvedCharacterSheet.equipment.armorId, "plate_armor");
assert.equal(levelTwelve.resolvedCharacterSheet.combatBasics.armorClass, 19);
assert.ok(levelTwelve.resolvedCharacterSheet.features.some((feature) => feature.name === "Advancement Feat: heavy_armor_master"));
assert.ok(levelTwelve.resolvedCharacterSheet.spellcasting.preparedSpellIds.includes("revivify"));

const levelThirteen = DANICA_COMPANION_PROFILE.levelSheets[13];
assert.equal(levelThirteen.status, "ready");
assert.ok(levelThirteen.resolvedCharacterSheet.features.some((feature) => feature.name === "Executioner’s Verdict"));
assert.equal(levelThirteen.actorDefinition.presentation.miniatureId, record.actorDefinition.presentation.miniatureId);
assert.equal(levelThirteen.actorDefinition.presentation.portraitId, record.actorDefinition.presentation.portraitId);
assert.deepEqual(validateActorDefinition(levelThirteen.actorDefinition), []);
assert.deepEqual(validateActorInstance(levelThirteen.actorInstance, { definition: levelThirteen.actorDefinition }), []);

const chainsDanica = structuredClone(levelSeven.combatActor);
chainsDanica.position = { x: 0, y: 0 };
const chainsTarget = createEnemyCombatActor("goblin", { id: "chains_target", position: { x: 2, y: 1 }, saves: { str: 0 } });
chainsTarget.marks = [{ id: "vow_of_enmity", sourceActorId: chainsDanica.id, label: "Vow of Enmity" }];
chainsTarget.economy = { movementMax: 6, movementUsed: 0, actionAvailable: true, bonusActionAvailable: true, reactionAvailable: true };
const chainsSnapshot = {
  round: 1,
  actors: [chainsDanica, chainsTarget],
  grid: { width: 8, height: 8, blocked: new Set(), cover: new Map() },
  initiative: [chainsDanica.id, chainsTarget.id],
  turnIndex: 1,
};
const lowSaveDice = {
  rollD20: () => ({ roll: 1, total: 1, usedLucky: false, secondRoll: null }),
  rollDamage: () => ({ total: 1, rolls: [1], modifier: 0 }),
};
assert.equal(moveActor(chainsSnapshot, chainsTarget, { x: 3, y: 1 }, createCombatLog(), { dice: lowSaveDice }), true);
assert.ok(chainsTarget.conditions.some((condition) => condition.id === "chained"));
assert.equal(moveActor(chainsSnapshot, chainsTarget, { x: 4, y: 1 }, createCombatLog(), { dice: lowSaveDice }), false);

console.log("Danica companion level 1 sheet passed");
