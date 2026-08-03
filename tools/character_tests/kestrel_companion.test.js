import assert from "node:assert/strict";
import { resolveActorToCombatActor, validateActorDefinition, validateActorInstance } from "../../app/actors/actorContract.js";
import { createKestrelRecruitmentRecord, KESTREL_COMPANION_PROFILE } from "../../app/data/companions/kestrel.js";

const record = KESTREL_COMPANION_PROFILE.levelSheets[1];
const sheet = record.resolvedCharacterSheet;

assert.equal(record.status, "ready");
assert.equal(sheet.identity.classId, "warlock");
assert.equal(sheet.identity.backgroundId, "noble");
assert.equal(sheet.identity.speciesId, "tiefling");
assert.equal(sheet.identity.lineageId, "chthonic");
assert.equal(sheet.abilities.charisma.score, 17);
assert.equal(sheet.abilities.wisdom.score, 14);
assert.deepEqual(sheet.proficiencies.skills.sort(), ["arcana", "history", "insight", "investigation", "medicine", "perception", "persuasion"].sort());
assert.deepEqual(sheet.equipment.weaponIds, ["warlocks_gloves", "dagger"]);
assert.deepEqual(sheet.equipment.weaponSetIds, [["warlocks_gloves", "warlocks_gloves"], ["dagger", null]]);
assert.equal(sheet.equipment.armorId, "leather_armor");
assert.deepEqual(sheet.equipment.inventory, []);
for (const spellId of ["minor_magic", "chill_touch", "eldritch_blast", "blade_ward", "armor_of_agathys", "hellish_rebuke"]) {
  assert.ok(sheet.spellcasting.knownSpellIds.includes(spellId));
}
assert.deepEqual(validateActorDefinition(record.actorDefinition), []);
assert.deepEqual(validateActorInstance(record.actorInstance, { definition: record.actorDefinition }), []);

const recruited = createKestrelRecruitmentRecord();
const combatActor = resolveActorToCombatActor(recruited.definition, recruited.instance);
assert.equal(combatActor.miniatureId, "mini_preview/assets/kestrel_locked.png");
assert.equal(combatActor.portraitId, "assets/images/companions/portraits/kestrel.png");

const levelTwo = KESTREL_COMPANION_PROFILE.levelSheets[2];
assert.equal(levelTwo.status, "ready");
assert.deepEqual(levelTwo.resolvedCharacterSheet.spellcasting.knownSpellIds, sheet.spellcasting.knownSpellIds);
assert.equal(levelTwo.actorDefinition.presentation.miniatureId, record.actorDefinition.presentation.miniatureId);
assert.equal(levelTwo.actorDefinition.presentation.portraitId, record.actorDefinition.presentation.portraitId);

const levelThree = KESTREL_COMPANION_PROFILE.levelSheets[3];
assert.equal(levelThree.status, "ready");
assert.equal(levelThree.resolvedCharacterSheet.identity.subclassId, "the_lantern");
assert.equal(levelThree.resolvedCharacterSheet.identity.pactId, "pact_of_the_tessera");
assert.ok(levelThree.resolvedCharacterSheet.features.some((feature) => feature.name === "Wicklight"));
assert.equal(
  levelThree.resolvedCharacterSheet.features
    .find((feature) => feature.name === "Wicklight")
    .effects.triggeredEffects[0].duration.until,
  "end_of_source_next_turn",
);
assert.ok(levelThree.resolvedCharacterSheet.features.some((feature) => feature.name === "Missing Piece"));
assert.deepEqual(levelThree.resolvedCharacterSheet.equipment.weaponSetIds, [["warlocks_gloves", "warlocks_gloves"], ["dagger", null]]);
assert.equal(levelThree.actorDefinition.presentation.miniatureId, record.actorDefinition.presentation.miniatureId);
assert.equal(levelThree.actorDefinition.presentation.portraitId, record.actorDefinition.presentation.portraitId);

const levelFour = KESTREL_COMPANION_PROFILE.levelSheets[4];
assert.equal(levelFour.status, "ready");
assert.equal(levelFour.resolvedCharacterSheet.abilities.charisma.score, 18);
assert.ok(levelFour.resolvedCharacterSheet.features.some((feature) => feature.name === "Advancement Feat: war_caster"));
assert.ok(levelFour.resolvedCharacterSheet.features.some((feature) => feature.name === "Spiral of Retribution"));
assert.ok(levelFour.resolvedCharacterSheet.spellcasting.knownSpellIds.includes("leech"));
assert.ok(levelFour.resolvedCharacterSheet.spellcasting.knownSpellIds.includes("shatter"));
assert.deepEqual(levelFour.resolvedCharacterSheet.equipment.weaponSetIds, [["warlocks_gloves", "warlocks_gloves"], ["dagger", null]]);
assert.equal(levelFour.actorDefinition.presentation.miniatureId, record.actorDefinition.presentation.miniatureId);
assert.equal(levelFour.actorDefinition.presentation.portraitId, record.actorDefinition.presentation.portraitId);

for (const level of [5, 6]) {
  const levelRecord = KESTREL_COMPANION_PROFILE.levelSheets[level];
  assert.equal(levelRecord.status, "ready");
  assert.deepEqual(levelRecord.resolvedCharacterSheet.spellcasting.knownSpellIds, levelFour.resolvedCharacterSheet.spellcasting.knownSpellIds);
  assert.equal(levelRecord.actorDefinition.presentation.miniatureId, record.actorDefinition.presentation.miniatureId);
  assert.equal(levelRecord.actorDefinition.presentation.portraitId, record.actorDefinition.presentation.portraitId);
}

const levelSeven = KESTREL_COMPANION_PROFILE.levelSheets[7];
assert.equal(levelSeven.status, "ready");
assert.ok(levelSeven.resolvedCharacterSheet.features.some((feature) => feature.name === "Light Through the Cracks"));
assert.ok(levelSeven.resolvedCharacterSheet.features.some((feature) => feature.name === "Token of Passage"));
assert.deepEqual(levelSeven.resolvedCharacterSheet.spellcasting.knownSpellIds, levelFour.resolvedCharacterSheet.spellcasting.knownSpellIds);
assert.deepEqual(levelSeven.resolvedCharacterSheet.equipment.weaponSetIds, [["warlocks_gloves", "warlocks_gloves"], ["dagger", null]]);
assert.equal(levelSeven.actorDefinition.presentation.miniatureId, record.actorDefinition.presentation.miniatureId);
assert.equal(levelSeven.actorDefinition.presentation.portraitId, record.actorDefinition.presentation.portraitId);

const levelEight = KESTREL_COMPANION_PROFILE.levelSheets[8];
assert.equal(levelEight.status, "ready");
assert.equal(levelEight.resolvedCharacterSheet.abilities.charisma.score, 20);
for (const spellId of ["counterspell", "banishment", "fireball", "blight"]) {
  assert.ok(levelEight.resolvedCharacterSheet.spellcasting.knownSpellIds.includes(spellId));
}
assert.equal(levelEight.resolvedCharacterSheet.spellcasting.knownSpellIds.length, 12);
assert.deepEqual(levelEight.resolvedCharacterSheet.equipment.weaponSetIds, [["warlocks_gloves", "warlocks_gloves"], ["dagger", null]]);
assert.equal(levelEight.actorDefinition.presentation.miniatureId, record.actorDefinition.presentation.miniatureId);
assert.equal(levelEight.actorDefinition.presentation.portraitId, record.actorDefinition.presentation.portraitId);

const levelNine = KESTREL_COMPANION_PROFILE.levelSheets[9];
assert.equal(levelNine.status, "ready");
assert.deepEqual(levelNine.resolvedCharacterSheet.spellcasting.knownSpellIds, levelEight.resolvedCharacterSheet.spellcasting.knownSpellIds);
assert.deepEqual(levelNine.resolvedCharacterSheet.equipment.weaponSetIds, [["warlocks_gloves", "warlocks_gloves"], ["dagger", null]]);
assert.equal(levelNine.actorDefinition.presentation.miniatureId, record.actorDefinition.presentation.miniatureId);
assert.equal(levelNine.actorDefinition.presentation.portraitId, record.actorDefinition.presentation.portraitId);

const levelTen = KESTREL_COMPANION_PROFILE.levelSheets[10];
assert.equal(levelTen.status, "ready");
for (const spellId of ["mind_sliver", "wall_of_force", "arms_of_hadar", "synaptic_static"]) {
  assert.ok(levelTen.resolvedCharacterSheet.spellcasting.knownSpellIds.includes(spellId));
}
assert.equal(levelTen.resolvedCharacterSheet.spellcasting.knownSpellIds.length, 16);
assert.deepEqual(levelTen.resolvedCharacterSheet.equipment.weaponSetIds, [["warlocks_gloves", "warlocks_gloves"], ["dagger", null]]);
assert.equal(levelTen.actorDefinition.presentation.miniatureId, record.actorDefinition.presentation.miniatureId);
assert.equal(levelTen.actorDefinition.presentation.portraitId, record.actorDefinition.presentation.portraitId);

const levelEleven = KESTREL_COMPANION_PROFILE.levelSheets[11];
assert.equal(levelEleven.status, "ready");
assert.ok(levelEleven.resolvedCharacterSheet.spellcasting.knownSpellIds.includes("mental_prison"));
assert.ok(levelEleven.resolvedCharacterSheet.features.some((feature) => feature.name === "Mystic Arcanum"));
assert.ok(levelEleven.resolvedCharacterSheet.features.some((feature) => feature.name === "The Door in the Floor"));
assert.ok(levelEleven.resolvedCharacterSheet.features.some((feature) => feature.name === "Mark of Authority"));
assert.deepEqual(levelEleven.resolvedCharacterSheet.equipment.weaponSetIds, [["warlocks_gloves", "warlocks_gloves"], ["dagger", null]]);
assert.equal(levelEleven.actorDefinition.presentation.miniatureId, record.actorDefinition.presentation.miniatureId);
assert.equal(levelEleven.actorDefinition.presentation.portraitId, record.actorDefinition.presentation.portraitId);

const levelTwelve = KESTREL_COMPANION_PROFILE.levelSheets[12];
assert.equal(levelTwelve.status, "ready");
assert.equal(levelTwelve.resolvedCharacterSheet.abilities.constitution.score, 12);
assert.equal(levelTwelve.resolvedCharacterSheet.durability.maxHp, 75);
assert.ok(levelTwelve.resolvedCharacterSheet.spellcasting.knownSpellIds.includes("fear"));
assert.deepEqual(levelTwelve.resolvedCharacterSheet.equipment.weaponSetIds, [["warlocks_gloves", "warlocks_gloves"], ["dagger", null]]);
assert.equal(levelTwelve.actorDefinition.presentation.miniatureId, record.actorDefinition.presentation.miniatureId);
assert.equal(levelTwelve.actorDefinition.presentation.portraitId, record.actorDefinition.presentation.portraitId);

const levelThirteen = KESTREL_COMPANION_PROFILE.levelSheets[13];
assert.equal(levelThirteen.status, "ready");
assert.equal(KESTREL_COMPANION_PROFILE.mysticArcanumByLevel[11], "mental_prison");
assert.equal(KESTREL_COMPANION_PROFILE.mysticArcanumByLevel[13], "forcecage");
assert.ok(levelThirteen.resolvedCharacterSheet.spellcasting.knownSpellIds.includes("mental_prison"));
assert.ok(levelThirteen.resolvedCharacterSheet.spellcasting.knownSpellIds.includes("forcecage"));
assert.ok(levelThirteen.resolvedCharacterSheet.features.some((feature) => feature.name === "Last Light"));
assert.ok(levelThirteen.resolvedCharacterSheet.features.some((feature) => feature.name === "Cataclysmic Debt"));
assert.deepEqual(levelThirteen.resolvedCharacterSheet.equipment.weaponSetIds, [["warlocks_gloves", "warlocks_gloves"], ["dagger", null]]);
assert.equal(levelThirteen.actorDefinition.presentation.miniatureId, record.actorDefinition.presentation.miniatureId);
assert.equal(levelThirteen.actorDefinition.presentation.portraitId, record.actorDefinition.presentation.portraitId);

console.log("Kestrel companion level 1 sheet passed");
