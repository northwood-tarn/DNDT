import assert from "node:assert/strict";
import {
  applyCombatResultToCharacterStore,
  createCharacterMemoryStore,
  createCharacterLifecycleState,
  createStarterCharacterDraft,
  loadCombatActorFromCharacter,
  restCharacterStore,
  saveCharacterDraft,
} from "../../app/character/index.js";
import { createCombatScenario } from "../../app/combat/scenario.js";

export function runCharacterRepositoryTests() {
  savesReadyCharacterRecords();
  savesInvalidDraftsWithoutCombatActors();
  feedsSavedCharactersIntoGeneratedArena();
  ignoresInvalidStoredCharactersInGeneratedArena();
  persistsPostCombatRuntimeState();
  recoversRuntimeStateOnLongRest();
}

function savesReadyCharacterRecords() {
  const store = createCharacterMemoryStore();
  const record = saveCharacterDraft(createStarterCharacterDraft("wizard"), {
    store,
    slot: "active",
    actorOptions: { id: "saved_wizard", position: { x: 2, y: 2 } },
  });

  assert.equal(record.status, "ready");
  assert.equal(record.characterDraft.identity.characterName, "Generated Wizard");
  assert.equal(record.resolvedCharacterSheet.identity.classId, "wizard");
  assert.equal(record.combatActor.id, "saved_wizard");
  assert.equal(store.load("active").id, record.id);
  assert.equal(loadCombatActorFromCharacter({ store, slot: "active" }).id, "saved_wizard");
  assert.equal(store.list()[0].characterName, "Generated Wizard");
  assert.equal(store.clear("active"), true);
  assert.equal(store.load("active"), null);
}

function savesInvalidDraftsWithoutCombatActors() {
  const store = createCharacterMemoryStore();
  const draft = createStarterCharacterDraft("fighter");
  draft.identity.level = 2;
  const record = saveCharacterDraft(draft, { store, slot: "active" });

  assert.equal(record.status, "invalid");
  assert.equal(record.combatActor, null);
  assert.equal(loadCombatActorFromCharacter({ store, slot: "active" }), null);
  assert.ok(record.validityReport.draftErrors.includes("identity.level must be 1 during character creation"));
}

function feedsSavedCharactersIntoGeneratedArena() {
  const store = createCharacterMemoryStore();
  saveCharacterDraft(createStarterCharacterDraft("cleric"), { store, slot: "active" });
  const scenario = createCombatScenario("generated-character-arena", { characterStore: store, characterSlot: "active" });
  const hero = scenario.actors.find((actor) => actor.id === "generated_pc");

  assert.equal(scenario.metadata.generatedHeroSource, "character_store");
  assert.equal(scenario.metadata.generatedHeroVariantId, null);
  assert.equal(scenario.metadata.generatedHeroSheet.identity.classId, "cleric");
  assert.equal(hero.name, "Generated Cleric");
}

function persistsPostCombatRuntimeState() {
  const store = createCharacterMemoryStore();
  const lifecycle = createCharacterLifecycleState();
  saveCharacterDraft(createStarterCharacterDraft("fighter"), { store, slot: "active" });
  const scenario = createCombatScenario("generated-character-arena", { characterStore: store });
  const hero = scenario.actors.find((actor) => actor.id === "generated_pc");
  hero.hp = 7;
  hero.resources[0].current = 0;
  hero.inventory = [];

  const updated = applyCombatResultToCharacterStore({
    store,
    lifecycle,
    snapshot: { outcome: "victory", round: 3, actors: scenario.actors },
  });
  const reloaded = loadCombatActorFromCharacter({ store, slot: "active" });

  assert.equal(updated.runtime.hp, 7);
  assert.equal(reloaded.hp, 7);
  assert.equal(reloaded.resources[0].current, 0);
  assert.deepEqual(reloaded.inventory, []);
  assert.equal(lifecycle.lastCombatResult.outcome, "victory");
}

function recoversRuntimeStateOnLongRest() {
  const store = createCharacterMemoryStore();
  saveCharacterDraft(createStarterCharacterDraft("wizard"), { store, slot: "active" });
  const scenario = createCombatScenario("generated-character-arena", { characterStore: store });
  const hero = scenario.actors.find((actor) => actor.id === "generated_pc");
  hero.hp = 1;
  hero.spellSlots["1"].current = 0;
  hero.conditions = [{ id: "poisoned", label: "Poisoned" }];
  applyCombatResultToCharacterStore({ store, snapshot: { outcome: "victory", round: 1, actors: scenario.actors } });

  const recovered = restCharacterStore({ store, restType: "long_rest" });
  const actor = loadCombatActorFromCharacter({ store });

  assert.equal(recovered.runtime.hp, actor.maxHp);
  assert.equal(actor.hp, actor.maxHp);
  assert.equal(actor.spellSlots["1"].current, actor.spellSlots["1"].max);
  assert.deepEqual(actor.conditions, []);
}

function ignoresInvalidStoredCharactersInGeneratedArena() {
  const store = createCharacterMemoryStore();
  const draft = createStarterCharacterDraft("cleric");
  draft.identity.level = 2;
  saveCharacterDraft(draft, { store, slot: "active" });
  const scenario = createCombatScenario("generated-character-arena", { characterStore: store, characterSlot: "active", variantId: "fighter" });

  assert.equal(scenario.metadata.generatedHeroSource, "starter_variant");
  assert.equal(scenario.metadata.generatedHeroVariantId, "fighter");
}
