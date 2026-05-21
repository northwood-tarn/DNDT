import { derivePlayerStats } from "../../app/state/stateStore.js";
import { getUniqueById } from "../../app/data/uniques.js";
import { assert } from "./helpers.js";

export async function runEquipmentCombatTests() {
  testArmorAndShieldDerivedStats();
  testNarrativeUniqueLookup();
}

function testArmorAndShieldDerivedStats() {
  const derived = derivePlayerStats({
    player: {
      abilities: { dex: 14 },
      equipment: {
        armor: "studded_leather",
        offHand: "shield",
      },
    },
  });

  assert.equal(derived.ac, 16, "armor plus shield should derive AC from armor, DEX, and shield AC bonus");
  assert.equal(derived.equipped.offHand.id, "shield", "shield records should resolve through armor data");
}

function testNarrativeUniqueLookup() {
  const earring = getUniqueById("gold_earring");
  assert.equal(earring.type, "unique", "unique records should remain item-addressable by id");
  assert.equal(earring.combat.usable, false, "unique narrative records should not expose combat use");
  assert.ok(earring.narrative.contexts.includes("dialogue"), "unique records should expose dialogue context metadata");
}
