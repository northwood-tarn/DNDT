import assert from "node:assert/strict";
import { chooseDialogueOption, describeDialogueCheck, getDialogueOptions, getDialoguePackagePath, loadDialoguePackage, startDialogueSession } from "../../app/dialogue/runtime.js";
import { completeDiscovery, getDiscoveryJournal, getDiscoveryState, revealDiscovery, visitDiscovery } from "../../app/state/discoveryState.js";
import { applyLootToSaveGame } from "../../app/state/loot.js";
import { createQuestDefinition, getQuestJournal, resolveQuest, setObjectiveStatus, startQuest, validateQuestDefinition } from "../../app/state/questState.js";
import { createEmptySaveGameState, hasStoryFlag } from "../../app/state/saveGameState.js";
import { footwear, getFootwearById } from "../../app/data/footwear.js";
import { derivePlayerStats } from "../../app/state/stateStore.js";
import { headwear, getHeadwearById } from "../../app/data/headwear.js";
import { getSpellcastingFocusById } from "../../app/data/spellcastingFoci.js";
import { createEmptyCharacterDraft } from "../../app/character/characterDraft.js";
import { resolveCharacterSheet } from "../../app/character/resolveCharacterSheet.js";

export async function runGameplayFoundationTests() {
  await loadsAndExecutesCompiledDialogue();
  resolvesDialogueChecksAndConsequences();
  tracksQuestObjectivesAndResolution();
  persistsDiscoveryAndJournalEvents();
  transfersCanonicalLootIntoSharedInventory();
  resolvesCanonicalFootwear();
  resolvesCanonicalHeadwearAndShields();
  resolvesClericHolySymbols();
}

function resolvesClericHolySymbols() {
  const sacral = getSpellcastingFocusById("sacral_holy_symbol");
  assert.equal(sacral.modifiers.spellAttackBonus, 1);
  assert.equal(sacral.modifiers.spellSaveDCBonus, 1);
  assert.equal(sacral.mechanics.onSpellCast.amountFrom, "spell_level");
  assert.equal(sacral.functionsAsWeapon, "club");
  assert.equal(sacral.damageFormula, "1d6");
  assert.equal(sacral.damageType, "bludgeoning");
  assert.equal(sacral.mastery, "slow");
  assert.equal(sacral.masteryEquivalentId, "club");
  const derived = derivePlayerStats({ player: { equipment: { mainHand: "sacral_holy_symbol" } } });
  assert.equal(derived.spellAttackBonus, 1);
  assert.equal(derived.spellSaveDCBonus, 1);
  assert.equal(derived.equipmentMechanics[0].onSpellCast.amountFrom, "spell_level");
  const steadfast = derivePlayerStats({ player: { equipment: { mainHand: "steadfast_holy_symbol" } } });
  assert.deepEqual(steadfast.saveAdvantages, [{ condition: "maintain_concentration", ability: "constitution" }]);
  const exclusive = derivePlayerStats({ player: { equipment: { mainHand: "sacral_holy_symbol", offHand: "steadfast_holy_symbol" } } });
  assert.equal(exclusive.equipped.mainHand.id, "sacral_holy_symbol");
  assert.equal(exclusive.equipped.offHand, null);
  assert.equal(exclusive.equipmentMechanics.length, 1);
  const redRuin = getSpellcastingFocusById("symbol_of_red_ruin");
  assert.equal(redRuin.modifiers.spellAttackBonus, 2);
  assert.equal(redRuin.modifiers.spellSaveDCBonus, 2);
  assert.deepEqual(redRuin.mechanics.damageRider, { id: "red_ruin", trigger: "source_deals_damage", oncePerTurn: true, damage: "1d8", damageType: "necrotic", actionTags: ["spell"] });
  const suffering = getSpellcastingFocusById("symbol_of_restless_suffering");
  assert.equal(suffering.mechanics.grantedAction, "restless_suffering_revivify");
  assert.equal(getSpellcastingFocusById("wizards_staff").focusType, "wizard_staff");
  assert.equal(getSpellcastingFocusById("wizards_staff").hands, 2);
  assert.equal(getSpellcastingFocusById("wizards_staff").damageFormula, "1d8");
  assert.deepEqual(getSpellcastingFocusById("wizards_staff").properties, ["two-handed"]);
  assert.equal(getSpellcastingFocusById("staff_of_the_winter_hand").hands, 2);
  assert.equal(getSpellcastingFocusById("staff_of_the_winter_hand").damageFormula, "1d8");
  assert.equal(getSpellcastingFocusById("warlocks_gloves").focusType, "warlock_gloves");
  assert.equal(getSpellcastingFocusById("warlocks_gloves").hands, 2);
  assert.equal(getSpellcastingFocusById("warlocks_gloves").icon.src, "combat_ui_v2/assets/icons/warlock_gloves/warlocks_gloves.png");
  const warlock = resolveCharacterSheet(createEmptyCharacterDraft({
    identity: { characterName: "Glove Test", classId: "warlock", level: 1 },
    abilities: { strength: 8, dexterity: 14, constitution: 12, intelligence: 10, wisdom: 10, charisma: 16 },
    gear: { weaponIds: ["warlocks_gloves", "gloves_of_the_last_wick"] },
  }));
  assert.deepEqual(warlock.equipment.weaponIds, ["warlocks_gloves"]);
  assert.ok(warlock.metadata.unresolved.some((item) => item.type === "exclusive_equipment_conflict" && item.group === "warlock_gloves"));
}

function resolvesCanonicalFootwear() {
  assert.equal(footwear.length, 11);
  assert.equal(footwear.filter((item) => item.magical).length, 10);
  assert.equal(getFootwearById("standard_boots")?.magical, false);
  assert.equal(getFootwearById("greater_mistwalker_boots")?.mechanics.uses, 2);
  const fleetfoot = derivePlayerStats({ player: { equipment: { boots: "fleetfoot_boots" } } });
  assert.equal(fleetfoot.equipped.boots.id, "fleetfoot_boots");
  assert.equal(fleetfoot.speedBonusFt, 5);
  const softPassage = derivePlayerStats({ player: { equipment: { boots: "shoes_of_soft_passage" } } });
  assert.deepEqual(softPassage.skillAdvantages, ["stealth"]);
}

function resolvesCanonicalHeadwearAndShields() {
  assert.equal(headwear.length, 6);
  assert.equal(getHeadwearById("headband_of_intellect")?.mechanics.score, 17);
  const fireCirclet = derivePlayerStats({ player: { equipment: { headwear: "circlet_of_fire_resistance" } } });
  assert.deepEqual(fireCirclet.resistances, ["fire"]);
  const intellect = derivePlayerStats({ player: { equipment: { headwear: "headband_of_intellect" } } });
  assert.equal(intellect.abilityScoreMinimums.intelligence, 17);
  const shield = derivePlayerStats({ player: { abilities: { dex: 10 }, equipment: { shield: "shield" } } });
  assert.equal(shield.ac, 12);
  assert.equal(shield.equipped.shield.id, "shield");
}

function resolvesDialogueChecksAndConsequences() {
  const save = createEmptySaveGameState();
  const options = getDialogueOptions([
    { label: "oa", text: "Open", requirements: { requiredFlags: ["flag:test.allowed"] } },
    { label: "ob", text: "Leave" },
  ], save);
  assert.equal(options[0].available, false);
  assert.equal(options[1].available, true);
  assert.equal(describeDialogueCheck({ skill: "sleight.of.hand", dc: 15 }), "Sleight Of Hand — DC 15");
  const session = { saveGame: save, options: [{ label: "ob", text: "Try", available: true, effects: [{
    effect: "check.skill", argument: "stealth.dc.15",
    success: [{ effect: "set.flag", argument: "flag:test.passed", feedback: "You slip past." }],
    failure: [{ effect: "start.combat", argument: "encounter:test.guards", feedback: "The guards spot you." }],
  }] }] };
  const success = chooseDialogueOption(session, "ob", { resolveSkillCheck: () => ({ d20: 12, modifier: 3 }) });
  assert.equal(hasStoryFlag(success.saveGame, "flag:test.passed"), true);
  assert.equal(success.checkResults[0].success, true);
  assert.deepEqual(success.consequences, [{ effect: "set.flag", text: "You slip past." }]);
  const failure = chooseDialogueOption(session, "ob", { resolveSkillCheck: () => ({ d20: 10, modifier: 0 }) });
  assert.deepEqual(failure.routes, [{ type: "combat", id: "encounter:test.guards" }]);
}

async function loadsAndExecutesCompiledDialogue() {
  const scenePackage = {
    formatVersion: 1,
    scene: {
      id: "scene:test.gate", act: "1_Greyharbour", title: "Test Gate", type: "full",
      locationId: null, triggerId: null, participants: [], frequency: "once",
      requirements: { requiredFlags: [], forbiddenFlags: [] },
      effects: { start: ["set.flag=flag:test.gate.met"], bypass: [], completion: [] },
      destinations: { success: null, failure: null },
    },
    content: { body: "A gate.", options: [
      { label: "oa", text: "Take the earring.", annotations: [], effects: [{ effect: "give.item", argument: "gold_earring" }, { effect: "go.scene", argument: "scene:test.after" }] },
    ] },
    catalogueAdditions: [],
  };
  const loaded = await loadDialoguePackage({ act: "1_Greyharbour", sceneId: "scene:test.gate", fetcher: async (path) => ({ ok: path === "/data/dialogue/1_Greyharbour/test.gate.json", json: async () => scenePackage }) });
  assert.equal(getDialoguePackagePath("1_Greyharbour", "scene:test.gate"), "/data/dialogue/1_Greyharbour/test.gate.json");
  const session = startDialogueSession(loaded, createEmptySaveGameState());
  assert.equal(hasStoryFlag(session.saveGame, "flag:test.gate.met"), true);
  const result = chooseDialogueOption(session, "oa");
  assert.deepEqual(result.saveGame.inventory.shared, [{ id: "gold_earring", quantity: 1 }]);
  assert.deepEqual(result.routes, [{ type: "dialogue", id: "scene:test.after" }]);
}

function tracksQuestObjectivesAndResolution() {
  const definition = createQuestDefinition({ id: "quest:test.lantern", title: "Test Lantern", objectives: [
    { id: "objective:test.lantern.find", text: "Find the lantern", initialStatus: "active" },
  ] });
  assert.deepEqual(validateQuestDefinition(definition), []);
  let save = startQuest(createEmptySaveGameState(), definition);
  save = setObjectiveStatus(save, definition.id, definition.objectives[0].id, "completed");
  save = resolveQuest(save, definition.id, "completed");
  assert.equal(getQuestJournal(save)[0].status, "completed");
  assert.equal(getQuestJournal(save)[0].objectives[definition.objectives[0].id].status, "completed");
}

function persistsDiscoveryAndJournalEvents() {
  let save = createEmptySaveGameState();
  save = revealDiscovery(save, "map:test.harbour", "node:test.gate", { label: "Gate" });
  save = visitDiscovery(save, "map:test.harbour", "node:test.gate", { label: "Gate" });
  save = completeDiscovery(save, "map:test.harbour", "node:test.gate", { label: "Gate" });
  assert.equal(getDiscoveryState(save, "map:test.harbour", "node:test.gate"), "completed");
  assert.deepEqual(getDiscoveryJournal(save).map((entry) => entry.state), ["visible", "visited", "completed"]);
}

function transfersCanonicalLootIntoSharedInventory() {
  let save = createEmptySaveGameState({ initialGold: 2 });
  save = applyLootToSaveGame(save, { gold: { min: 3, max: 5 }, items: [{ id: "gold_earring", quantity: 2 }] }, { random: () => 0 }).saveGame;
  assert.equal(save.inventory.currency.gold, 5);
  assert.deepEqual(save.inventory.shared, [{ id: "gold_earring", quantity: 1 }], "unique items should never duplicate");
}
