import assert from "node:assert/strict";
import { createEmptySaveGameState } from "../../app/state/saveGameState.js";
import { createSecretDefinition, validateSecretCatalogue, validateSecretDefinition } from "../../app/secrets/secretDefinition.js";
import { acquireSecretClue, getSecretInventoryGroups, getSecretJournalEntries, getSecretRecord, isSecretClueAvailable, unlockSecret } from "../../app/secrets/secretState.js";
import { acquireCluesAtSource } from "../../app/secrets/secretSources.js";
import { applyCanonicalSecretEffect } from "../../app/secrets/secretEffects.js";
import { getDiscoveryState } from "../../app/state/discoveryState.js";
import { beginTraversal, getAvailableRoutes } from "../../app/exploration/grandTraversal.js";
import { createSecretAwareInventoryView } from "../../app/secrets/SecretInventory.js";
import { applyLootToSaveGame } from "../../app/state/loot.js";
import { applyEffects, getDialogueOptions } from "../../app/dialogue/runtime.js";

export function runSecretTests() {
  validatesManualClueSources();
  validatesCatalogueIdentityAndCycles();
  groupsUniqueCluesAndTransformsThemAtomically();
  appliesTesseraAsVirtualClue();
  acquiresBySourceAndRevealsExistingDiscovery();
  integratesDialogueAndLootSources();
}

function validatesCatalogueIdentityAndCycles() {
  const first = definition({ unlockRequirements: [{ type: "secret", id: "secret:test.second" }] });
  const second = definition({ id: "secret:test.second", clues: [{ id: "clue:test.second", name: "Second", description: "Second", source: { type: "item", id: "item:refinery.vine_key" } }], clueThreshold: 1, unlockRequirements: [{ type: "secret", id: first.id }] });
  assert.ok(validateSecretCatalogue([first, second]).some((error) => error.includes("dependency cycle")));
}

function definition(overrides = {}) {
  return createSecretDefinition({
    id: "secret:greyharbour.refinery_cave", title: "The Refinery Cave",
    target: { id: "location:greyharbour.oil_refinery", label: "the Oil Refinery" }, clueThreshold: 2,
    clues: [
      { id: "clue:refinery.metal_1", name: "Inscribed metal", description: "A marked fragment.", source: { type: "conversation", id: "scene:refinery.foreman" } },
      { id: "clue:refinery.metal_2", name: "Inscribed metal", description: "A second fragment.", source: { type: "node", id: "node:refinery.garden", mapId: "map:refinery" } },
      { id: "clue:refinery.metal_3", name: "Inscribed metal", description: "A third fragment.", source: { type: "loot", id: "encounter:refinery.vermin" } },
    ],
    inventory: { searchingText: "There is something hidden near the Oil Refinery. Keep searching." },
    journal: { searching: "Search near the Oil Refinery.", milestones: [{ count: 1, text: "One strange fragment points towards the refinery." }], uncovered: "Together, the metal forms a key marked with a map. It opens something in the garden behind the Oil Refinery.", unlocked: "Explore the cave.", completed: "The cave has been searched." },
    rewardItems: ["item:refinery.vine_key"], unlockRequirements: [{ type: "item", id: "item:refinery.vine_key" }],
    effects: { uncovered: [{ type: "reveal.discovery", id: "node:refinery.vine_gap", mapId: "map:refinery", metadata: { label: "Gap in the vines" } }] }, ...overrides,
  });
}

function validatesManualClueSources() {
  assert.deepEqual(validateSecretDefinition(definition()), []);
  const invalid = definition({ clues: [{ id: "clue:test.bad", name: "Bad", description: "Bad", source: { type: "node", id: "node:test.bad" } }] });
  assert.ok(validateSecretDefinition(invalid).some((error) => error.includes("mapId")));
}

function groupsUniqueCluesAndTransformsThemAtomically() {
  const secret = definition(); let save = createEmptySaveGameState();
  let result = acquireSecretClue(save, secret, "clue:refinery.metal_1", { occurredAt: "2026-01-01T00:00:00Z" }); save = result.saveGame;
  result = acquireSecretClue(save, secret, "clue:refinery.metal_1"); assert.equal(result.changed, false);
  assert.equal(getSecretInventoryGroups(save, [secret])[0].label, "Clues (1): There is something hidden near the Oil Refinery. Keep searching.");
  assert.equal(createSecretAwareInventoryView(save, [secret]).items.length, 0);
  assert.equal(getSecretJournalEntries(save, [secret])[0].text, "One strange fragment points towards the refinery.");
  result = acquireSecretClue(save, secret, "clue:refinery.metal_2", { applyEffect: applyCanonicalSecretEffect }); save = result.saveGame;
  assert.equal(getSecretRecord(save, secret.id).stage, "uncovered");
  assert.deepEqual(save.inventory.shared, [{ id: "item:refinery.vine_key", quantity: 1 }]);
  assert.equal(isSecretClueAvailable(save, secret, "clue:refinery.metal_3"), false);
  assert.equal(result.events[0].message, "You have uncovered a secret at the Oil Refinery");
  save = unlockSecret(save, secret).saveGame;
  assert.equal(save.inventory.shared[0].id, "item:refinery.vine_key", "keys are permanent");
}

function integratesDialogueAndLootSources() {
  const secret = definition(); let save = createEmptySaveGameState();
  const dialogue = applyEffects(save, [{ effect: "grant.clue", argument: "clue:refinery.metal_1" }], { secretDefinitions: [secret] });
  save = dialogue.saveGame;
  assert.equal(getSecretRecord(save, secret.id).clueIds.length, 1);
  const options = getDialogueOptions([{ label: "clue", effects: [{ effect: "grant.clue", argument: "clue:refinery.metal_1" }] }], save, { secretDefinitions: [secret] });
  assert.equal(options[0].available, false, "collected conversation clues stop appearing as available rewards");
  const loot = applyLootToSaveGame(save, {}, { secretDefinitions: [secret], secretSourceId: "encounter:refinery.vermin", applyEffect: applyCanonicalSecretEffect });
  assert.equal(getSecretRecord(loot.saveGame, secret.id).stage, "uncovered");
}

function appliesTesseraAsVirtualClue() {
  const secret = definition(); let save = createEmptySaveGameState();
  save = acquireSecretClue(save, secret, "clue:refinery.metal_1", { hasTesseraBonus: () => true }).saveGame;
  assert.equal(getSecretRecord(save, secret.id).stage, "uncovered");
}

function acquiresBySourceAndRevealsExistingDiscovery() {
  const secret = definition(); let save = createEmptySaveGameState();
  const map = { id: "map:refinery", nodes: [{ id: "node:refinery.garden" }, { id: "node:refinery.vine_gap", discoveryState: "hidden" }], edges: [{ id: "route:refinery.gap", from: "node:refinery.garden", to: "node:refinery.vine_gap" }] };
  save = beginTraversal(save, map, "node:refinery.garden");
  assert.equal(getAvailableRoutes(save, map).length, 0);
  save = acquireCluesAtSource(save, [secret], { type: "conversation", id: "scene:refinery.foreman" }).saveGame;
  const result = acquireCluesAtSource(save, [secret], { type: "node", id: "node:refinery.garden", mapId: "map:refinery" }, { applyEffect: applyCanonicalSecretEffect });
  assert.equal(getDiscoveryState(result.saveGame, "map:refinery", "node:refinery.vine_gap"), "visible");
  assert.equal(getAvailableRoutes(result.saveGame, map)[0].destinationId, "node:refinery.vine_gap");
}
