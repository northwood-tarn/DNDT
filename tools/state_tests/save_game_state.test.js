import assert from "node:assert/strict";
import {
  createCharacterRecord,
  createLevelUpPlan,
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
  levelUpSaveGame,
  recruitCompanion,
  setActiveCompanions,
  getActiveCompanions,
  getRecruitedCompanions,
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
import { getEmberDepartureCheck, UNDERSIZED_PARTY_WARNING } from "../../app/systems/emberSystem.js";
import { canLongRest, runLongRest } from "../../app/engine/long_rest.js";
import { createActorDefinition } from "../../app/actors/actorContract.js";
import { executeNpcOffer, listAvailableNpcOffers, validateNpcServices } from "../../app/npc/services.js";
import {
  createFixedEncounterTrigger,
  findFixedEncounterTrigger,
  resolveFixedEncounterTrigger,
  validateFixedEncounterTrigger,
} from "../../app/encounters/fixedTriggers.js";

export async function runSaveGameStateTests() {
  createsSaveGameAroundCharacterRecord();
  tracksWorldFlagsLocationAndEncounterState();
  persistsCombatRuntimeToActiveCharacter();
  recoversCharacterRuntimeOnLongRest();
  roundTripsThroughMemoryAndBrowserStores();
  persistsCreatorCharacterSaveForCombat();
  levelsUpTheActiveSavedCharacterAtomically();
  recruitsAndManagesPersistentCompanionsAtEmbers();
  warnsBeforeLeavingAnEmberWithAnUndersizedParty();
  resolvesCanonicalNpcOffersAtomically();
  resolvesPersistentFixedEncounterTriggers();
  await rendererClientUsesElectronApiAndFallsBackToBrowserStore();
}

function resolvesPersistentFixedEncounterTriggers() {
  let saveGameState = createEmptySaveGameState();
  const trigger = createFixedEncounterTrigger({
    id: "forest_gate_guards",
    mapId: "forest_edge",
    location: { type: "tile", column: 4, row: 7 },
    encounterId: "combat_goblin_skirmish",
    frequency: "once",
    entryMode: "dialogue",
    dialogueId: "forest_gate_preamble",
    requirements: { requiredFlags: ["forest_open"], forbiddenFlags: ["guards_defeated"] },
    destinations: {
      success: { type: "map", id: "forest_interior" },
      failure: { type: "combat", id: "combat_goblin_skirmish" },
    },
    flags: {
      onTriggered: { met_forest_guards: true },
      onBypassed: { forest_guards_bypassed: true },
      onCompleted: { guards_defeated: true },
    },
  });
  const context = { mapId: "forest_edge", position: { column: 4, row: 7 } };

  assert.deepEqual(validateFixedEncounterTrigger(trigger), []);
  assert.equal(findFixedEncounterTrigger(saveGameState, [trigger], context), null, "required flags should gate a trigger");
  saveGameState = setStoryFlag(saveGameState, "forest_open");
  assert.equal(findFixedEncounterTrigger(saveGameState, [trigger], context).id, "forest_gate_guards");

  let result = resolveFixedEncounterTrigger(saveGameState, trigger, "triggered");
  saveGameState = result.saveGame;
  assert.deepEqual(result.destination, { type: "dialogue", id: "forest_gate_preamble", encounterId: "combat_goblin_skirmish" });
  assert.equal(hasStoryFlag(saveGameState, "met_forest_guards"), true);
  assert.equal(findFixedEncounterTrigger(saveGameState, [trigger], context), null, "a once-only trigger should not fire twice");
  assert.equal(saveGameState.world.fixedEncounterTriggers.forest_gate_guards.firedCount, 1);

  result = resolveFixedEncounterTrigger(saveGameState, trigger, "success");
  assert.deepEqual(result.destination, { type: "map", id: "forest_interior" }, "dialogue should be able to resolve to an opaque success destination");

  const repeatTrigger = createFixedEncounterTrigger({
    ...trigger,
    id: "repeat_gate_guards",
    frequency: "repeat",
    location: { type: "region", regionId: "gate_approach" },
    requirements: {},
  });
  const regionContext = { mapId: "forest_edge", regionId: "gate_approach" };
  assert.equal(findFixedEncounterTrigger(saveGameState, [repeatTrigger], regionContext).id, "repeat_gate_guards");
  saveGameState = resolveFixedEncounterTrigger(saveGameState, repeatTrigger, "triggered").saveGame;
  assert.equal(findFixedEncounterTrigger(saveGameState, [repeatTrigger], regionContext).id, "repeat_gate_guards", "repeat triggers should remain available");
}

function resolvesCanonicalNpcOffersAtomically() {
  const record = createCharacterRecord(createStarterCharacterDraft("fighter"), { slot: "active" });
  let saveGameState = createSaveGameFromCharacterRecord(record, { initialGold: 30 });
  const npc = createActorDefinition({
    id: "npc.harbour_host",
    kind: "npc",
    identity: { name: "Harbour Host" },
    services: [{
      id: "host_offers",
      offers: [
        { id: "healing_potion", kind: "item", itemId: "healing_potion", quantity: 1, price: 10, stock: 1 },
        { id: "ember_bed", kind: "service", effect: { type: "long_rest" }, price: 5, stock: null },
        { id: "bribe_watch", kind: "narrative", effect: { flags: { watch_bribed: true } }, price: 3, stock: 1 },
      ],
    }],
  });

  assert.deepEqual(validateNpcServices(npc), []);
  assert.equal(listAvailableNpcOffers(saveGameState, npc, { atEmber: false }).some((offer) => offer.id === "ember_bed"), true);

  let result = executeNpcOffer(saveGameState, npc, "healing_potion");
  assert.equal(result.ok, true);
  saveGameState = result.saveGame;
  assert.deepEqual(saveGameState.inventory.shared.find((item) => item.id === "healing_potion"), { id: "healing_potion", quantity: 1 });
  assert.equal(saveGameState.inventory.currency.gold, 20);

  result = executeNpcOffer(saveGameState, npc, "healing_potion");
  assert.equal(result.ok, false);
  assert.equal(result.reason, "out_of_stock");
  assert.equal(result.saveGame.inventory.currency.gold, 20, "failed purchases must not charge the player");

  result = executeNpcOffer(saveGameState, npc, "ember_bed", { atEmber: false });
  assert.equal(result.ok, true);
  saveGameState = result.saveGame;
  assert.equal(saveGameState.inventory.currency.gold, 15);

  result = executeNpcOffer(saveGameState, npc, "bribe_watch");
  assert.equal(result.ok, true);
  saveGameState = result.saveGame;
  assert.equal(hasStoryFlag(saveGameState, "watch_bribed"), true);
  assert.equal(saveGameState.inventory.currency.gold, 12);
}

function warnsBeforeLeavingAnEmberWithAnUndersizedParty() {
  let saveGameState = createEmptySaveGameState();
  let departure = getEmberDepartureCheck(saveGameState);
  assert.equal(departure.allowed, false);
  assert.equal(departure.requiresConfirmation, true);
  assert.equal(departure.message, UNDERSIZED_PARTY_WARNING);

  departure = getEmberDepartureCheck(saveGameState, { confirmed: true });
  assert.equal(departure.allowed, true, "the player should be able to confirm solo departure");

  saveGameState = recruitCompanion(saveGameState, companionDefinition("tara"), companionInstance("tara", 18));
  assert.equal(getEmberDepartureCheck(saveGameState).requiresConfirmation, true, "one companion should still require confirmation");
  saveGameState = recruitCompanion(saveGameState, companionDefinition("xavier"), companionInstance("xavier", 14));
  assert.equal(getEmberDepartureCheck(saveGameState).allowed, true, "two companions should not require confirmation");
}

function recruitsAndManagesPersistentCompanionsAtEmbers() {
  const pcRecord = createCharacterRecord(createStarterCharacterDraft("fighter"), { slot: "active" });
  let saveGameState = createSaveGameFromCharacterRecord(pcRecord);
  saveGameState = recruitCompanion(saveGameState, companionDefinition("tara"), companionInstance("tara", 18));
  saveGameState = recruitCompanion(saveGameState, companionDefinition("xavier"), companionInstance("xavier", 14));
  saveGameState = recruitCompanion(saveGameState, companionDefinition("duncan"), companionInstance("duncan", 20));

  assert.deepEqual(saveGameState.party.companions.activeIds, ["tara", "xavier"], "recruitment should fill at most two open companion slots");
  assert.equal(getRecruitedCompanions(saveGameState).length, 3, "all recruited companions should remain in the persistent roster");
  assert.throws(() => setActiveCompanions(saveGameState, ["duncan"]), /only be changed at an ember/);
  assert.throws(() => setActiveCompanions(saveGameState, ["tara", "xavier", "duncan"], { atEmber: true }), /at most two/);

  saveGameState = setActiveCompanions(saveGameState, [], { atEmber: true });
  assert.deepEqual(getActiveCompanions(saveGameState), [], "the PC should be allowed to adventure alone");
  saveGameState = setActiveCompanions(saveGameState, ["duncan"], { atEmber: true });
  assert.deepEqual(saveGameState.party.companions.activeIds, ["duncan"]);

  const pc = loadCombatActorFromCharacter({ record: pcRecord });
  const fallenDuncan = {
    ...saveGameState.party.companions.recruited.duncan.instance,
    id: "duncan",
    team: "heroes",
    kind: "companion",
    hp: 0,
    maxHp: 20,
    defeated: true,
    resources: [],
    spellSlots: {},
    inventory: [],
    conditions: [],
    activeEffects: [],
    marks: [],
  };
  saveGameState = applyCombatResultToSaveGame(saveGameState, {
    snapshot: { outcome: "victory", round: 3, actors: [pc, fallenDuncan] },
    actorId: pc.id,
  });
  assert.equal(saveGameState.party.companions.recruited.duncan.instance.state.hp, 1, "a fallen companion should persist after combat at 1 HP");
  assert.equal(saveGameState.party.companions.recruited.duncan.instance.state.defeated, false);

  const store = createSaveGameMemoryStore();
  saveGame(store, saveGameState, "companions");
  assert.deepEqual(loadGame(store, "companions").party.companions.activeIds, ["duncan"], "party selection should survive save/load");
}

function companionDefinition(id) {
  return {
    id: `companion.${id}`,
    kind: "companion",
    identity: { name: id[0].toUpperCase() + id.slice(1) },
    mechanics: { maxHp: 20, armorClass: 12, speedSquares: 6 },
  };
}

function companionInstance(id, hp) {
  return {
    id,
    definitionId: `companion.${id}`,
    team: "heroes",
    state: { hp, maxHp: 20 },
  };
}

function levelsUpTheActiveSavedCharacterAtomically() {
  const record = createCharacterRecord(createStarterCharacterDraft("fighter"), { slot: "active" });
  const manifest = createLevelUpPlan(record);
  const hpStep = manifest.steps.find((step) => step.kind === "hp_roll");
  const saveGameState = createSaveGameFromCharacterRecord(record);
  const updated = levelUpSaveGame(saveGameState, { manifest, values: { [hpStep.id]: { die: 6 } } });

  assert.equal(updated.party.characterRecords.active.characterDraft.identity.level, 2);
  assert.equal(updated.party.actorInstances.active.id, updated.party.characterRecords.active.actorInstance.id);
  assert.equal(saveGameState.party.characterRecords.active.characterDraft.identity.level, 1, "save update must be immutable");
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

  const shortRested = restSaveGame(saveGameState, { restType: "short_rest" });
  assert.equal(shortRested.rests.shortRestsUsed.active, 1, "short rests should remain available away from embers");

  assert.throws(
    () => restSaveGame(saveGameState, { restType: "long_rest" }),
    /only be taken at an ember or through an NPC sleeping service/,
    "long rests should be rejected while exploring",
  );
  const recovered = restSaveGame(saveGameState, { restType: "long_rest", atEmber: true });
  const recoveredRecord = getActiveCharacterRecord(recovered);

  assert.equal(recoveredRecord.runtime.hp, recoveredRecord.runtime.maxHp);
  assert.equal(recoveredRecord.runtime.spellSlots["1"].current, recoveredRecord.runtime.spellSlots["1"].max);
  assert.deepEqual(recoveredRecord.runtime.conditions, []);
  assert.equal(recovered.rests.shortRestsUsed.active, 0);

  assert.equal(canLongRest({}, { atEmber: false }), false);
  assert.equal(canLongRest({}, { atEmber: true, mode: "ember" }), true);
  assert.equal(canLongRest({}, { sleepingService: true }), true);
  assert.equal(runLongRest({}, { atEmber: false }).reason, "LongRestNotAllowed");
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
