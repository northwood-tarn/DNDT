import assert from "node:assert/strict";
import {
  createCharacterRecord,
  createStarterCharacterDraft,
  loadCombatActorFromCharacter,
} from "../../app/character/index.js";
import {
  applyCombatResultToSaveGame,
  clearActiveEncounterState,
  createEmptySaveGameState,
  createSaveGameFromCharacterRecord,
  getActiveCharacterRecord,
  hasStoryFlag,
  restSaveGame,
  setActiveEncounterState,
  setSaveGameLocation,
  setStoryFlag,
  upsertCharacterRecord,
  validateSaveGameState,
} from "../../app/state/saveGameState.js";
import {
  clearSaveGame,
  createBrowserSaveGameStore,
  createSaveGameMemoryStore,
  listSaveGames,
  loadGame,
  saveGame,
} from "../../app/state/saveGameRepository.js";
import { createRendererSaveGameClient } from "../../app/state/saveGameClient.js";

export async function runSaveGameStateTests() {
  createsSaveGameAroundCharacterRecord();
  tracksWorldFlagsLocationAndEncounterState();
  persistsCombatRuntimeToActiveCharacter();
  recoversCharacterRuntimeOnLongRest();
  roundTripsThroughMemoryAndBrowserStores();
  persistsCreatorCharacterSaveForCombat();
  await rendererClientUsesElectronApiAndFallsBackToBrowserStore();
}

function createsSaveGameAroundCharacterRecord() {
  const record = createCharacterRecord(createStarterCharacterDraft("wizard"), { slot: "mage" });
  const saveGameState = createSaveGameFromCharacterRecord(record, { slot: "mage", runId: "run_test" });
  const report = validateSaveGameState(saveGameState);

  assert.equal(report.valid, true);
  assert.equal(saveGameState.party.activeSlot, "mage");
  assert.equal(getActiveCharacterRecord(saveGameState).resolvedCharacterSheet.identity.classId, "wizard");

  const fighter = createCharacterRecord(createStarterCharacterDraft("fighter"), { slot: "fighter" });
  const updated = upsertCharacterRecord(saveGameState, "fighter", fighter);

  assert.deepEqual(updated.party.slots.sort(), ["fighter", "mage"]);
  assert.equal(updated.party.characterRecords.fighter.resolvedCharacterSheet.identity.classId, "fighter");
}

function tracksWorldFlagsLocationAndEncounterState() {
  let saveGameState = createEmptySaveGameState({ runId: "run_world" });
  saveGameState = setStoryFlag(saveGameState, "met_lantern_keeper");
  saveGameState = setSaveGameLocation(saveGameState, { areaId: "ash_market", entryKnot: "north_gate" });
  saveGameState = setActiveEncounterState(saveGameState, {
    encounterId: "ambush_01",
    scenarioId: "generated-encounter-arena",
    state: { round: 2, actorTurn: "goblin_archer" },
  });

  assert.equal(hasStoryFlag(saveGameState, "met_lantern_keeper"), true);
  assert.equal(saveGameState.world.visitedAreas.ash_market, true);
  assert.equal(saveGameState.encounter.activeEncounterId, "ambush_01");
  assert.equal(saveGameState.encounter.state.round, 2);

  saveGameState = clearActiveEncounterState(saveGameState, { outcome: "fled" });
  assert.equal(saveGameState.encounter.activeEncounterId, null);
  assert.equal(saveGameState.encounter.lastOutcome.outcome, "fled");
}

function persistsCombatRuntimeToActiveCharacter() {
  const record = createCharacterRecord(createStarterCharacterDraft("fighter"), { slot: "active" });
  const saveGameState = createSaveGameFromCharacterRecord(record);
  const actor = loadCombatActorFromCharacter({ record });
  actor.hp = 3;
  actor.resources[0].current = 0;
  actor.inventory = [];

  const updated = applyCombatResultToSaveGame(saveGameState, {
    snapshot: { outcome: "victory", round: 4, actors: [actor] },
    actorId: actor.id,
  });
  const updatedRecord = getActiveCharacterRecord(updated);

  assert.equal(updatedRecord.runtime.hp, 3);
  assert.equal(updatedRecord.runtime.resources[0].current, 0);
  assert.deepEqual(updatedRecord.runtime.inventory, []);
  assert.equal(updated.encounter.lastOutcome.outcome, "victory");
}

function recoversCharacterRuntimeOnLongRest() {
  const record = createCharacterRecord(createStarterCharacterDraft("wizard"), { slot: "active" });
  const actor = loadCombatActorFromCharacter({ record });
  actor.hp = 1;
  actor.spellSlots["1"].current = 0;
  actor.conditions = [{ id: "poisoned", label: "Poisoned" }];
  let saveGameState = createSaveGameFromCharacterRecord(record);
  saveGameState = applyCombatResultToSaveGame(saveGameState, { snapshot: { actors: [actor] }, actorId: actor.id });

  const recovered = restSaveGame(saveGameState, { restType: "long_rest" });
  const recoveredRecord = getActiveCharacterRecord(recovered);

  assert.equal(recoveredRecord.runtime.hp, recoveredRecord.runtime.maxHp);
  assert.equal(recoveredRecord.runtime.spellSlots["1"].current, recoveredRecord.runtime.spellSlots["1"].max);
  assert.deepEqual(recoveredRecord.runtime.conditions, []);
  assert.equal(recovered.rests.shortRestsUsed.active, 0);
}

function roundTripsThroughMemoryAndBrowserStores() {
  const record = createCharacterRecord(createStarterCharacterDraft("cleric"), { slot: "active" });
  const saveGameState = setSaveGameLocation(createSaveGameFromCharacterRecord(record), { areaId: "sanctum" });
  const memoryStore = createSaveGameMemoryStore();
  saveGame(memoryStore, saveGameState, "manual_1");

  assert.equal(loadGame(memoryStore, "manual_1").world.location.areaId, "sanctum");
  assert.equal(listSaveGames(memoryStore)[0].activeCharacterName, "Generated Cleric");
  assert.equal(listSaveGames(memoryStore)[0].activeClassId, "cleric");
  assert.equal(listSaveGames(memoryStore)[0].level, 1);
  assert.equal(clearSaveGame(memoryStore, "manual_1"), true);
  assert.equal(loadGame(memoryStore, "manual_1"), null);

  const storage = createFakeStorage();
  const browserStore = createBrowserSaveGameStore(storage, "test.save.");
  saveGame(browserStore, saveGameState, "autosave");
  assert.equal(loadGame(browserStore, "autosave").party.activeSlot, "active");
  assert.equal(listSaveGames(browserStore)[0].locationAreaId, "sanctum");
}

function persistsCreatorCharacterSaveForCombat() {
  const record = createCharacterRecord(createStarterCharacterDraft("wizard"), {
    slot: "active",
    actorOptions: { id: "saved_player_character", position: { x: 1, y: 1 } },
  });
  const saveGameState = createSaveGameFromCharacterRecord(record, { slot: "active" });
  const storage = createFakeStorage();
  const browserStore = createBrowserSaveGameStore(storage, "creator.save.");

  saveGame(browserStore, saveGameState, "autosave");
  const loaded = loadGame(browserStore, "autosave");
  const active = getActiveCharacterRecord(loaded);

  assert.equal(active.status, "ready");
  assert.equal(active.combatActor.id, "saved_player_character");
  assert.equal(active.resolvedCharacterSheet.identity.classId, "wizard");
}

async function rendererClientUsesElectronApiAndFallsBackToBrowserStore() {
  const record = createCharacterRecord(createStarterCharacterDraft("cleric"), { slot: "active" });
  const saveGameState = setSaveGameLocation(createSaveGameFromCharacterRecord(record), { areaId: "sanctum" });
  const savedByApi = new Map();
  const storage = createFakeStorage();
  const apiClient = createRendererSaveGameClient({
    storage,
    namespace: "mirrored.save.",
    api: {
      saveGame: async (data, slot) => {
        savedByApi.set(slot, data);
        return { ok: true, slot };
      },
      loadGame: async (slot) => savedByApi.get(slot) || null,
      listSaves: async () => [{ slot: "manual_2", locationAreaId: "sanctum" }],
      clearGame: async (slot) => {
        savedByApi.delete(slot);
        return { ok: true };
      },
    },
  });

  await apiClient.save(saveGameState, "manual_2");
  assert.equal((await apiClient.load("manual_2")).world.location.areaId, "sanctum");
  assert.equal(
    loadGame(createBrowserSaveGameStore(storage, "mirrored.save."), "manual_2").world.location.areaId,
    "sanctum",
    "renderer API saves should also mirror to browser storage for local combat harness consumers"
  );
  assert.equal((await apiClient.list())[0].slot, "manual_2");
  assert.equal(await apiClient.clear("manual_2"), true);
  assert.equal(loadGame(createBrowserSaveGameStore(storage, "mirrored.save."), "manual_2"), null);

  const fallbackStorage = createFakeStorage();
  const fallbackClient = createRendererSaveGameClient({ storage: fallbackStorage, namespace: "fallback.save." });
  await fallbackClient.save(saveGameState, "manual_3");
  assert.equal((await fallbackClient.load("manual_3")).party.activeSlot, "active");
  assert.equal((await fallbackClient.list())[0].slot, "manual_3");
}

function createFakeStorage() {
  const map = new Map();
  return {
    get length() {
      return map.size;
    },
    key(index) {
      return Array.from(map.keys())[index] || null;
    },
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
  };
}
