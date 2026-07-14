import assert from "node:assert/strict";
import { chooseDialogueOption, describeDialogueCheck, getDialogueOptions, getDialoguePackagePath, loadDialoguePackage, startDialogueSession } from "../../app/dialogue/runtime.js";
import { completeDiscovery, getDiscoveryJournal, getDiscoveryState, revealDiscovery, visitDiscovery } from "../../app/state/discoveryState.js";
import { applyLootToSaveGame } from "../../app/state/loot.js";
import { createQuestDefinition, getQuestJournal, resolveQuest, setObjectiveStatus, startQuest, validateQuestDefinition } from "../../app/state/questState.js";
import { createEmptySaveGameState, hasStoryFlag } from "../../app/state/saveGameState.js";

export async function runGameplayFoundationTests() {
  await loadsAndExecutesCompiledDialogue();
  resolvesDialogueChecksAndConsequences();
  tracksQuestObjectivesAndResolution();
  persistsDiscoveryAndJournalEvents();
  transfersCanonicalLootIntoSharedInventory();
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
