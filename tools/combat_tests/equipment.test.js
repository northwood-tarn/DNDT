import { derivePlayerStats } from "../../app/state/stateStore.js";
import { getUniqueById } from "../../app/data/uniques.js";
import { getRingById, rings } from "../../app/data/rings.js";
import { getArmorById } from "../../app/data/armor.js";
import { assert } from "./helpers.js";

export async function runEquipmentCombatTests() {
  testLanternaSavantDerivedStats();
  testArmorAndShieldDerivedStats();
  testNarrativeUniqueLookup();
  testCanonicalRings();
  testRingDerivedStats();
  testLockedBaseArmorIcons();
}

function testLanternaSavantDerivedStats() {
  const aasimar = derivePlayerStats({ player: { speciesId: "aasimar", equipment: {} } });
  assert.equal(aasimar.lanternaOilCapacityBonus, 10, "Lanterna Savant should add 10 to Aasimar oil capacity");
}

function testLockedBaseArmorIcons() {
  for (const id of ["leather_armor", "hide_armor", "studded_leather", "chain_mail", "half_plate", "plate_armor"]) {
    const item = getArmorById(id);
    assert.equal(item.icon.src, `combat_ui_v2/assets/icons/armor/${id}.png`, `${id} should resolve its locked base artwork`);
    assert.equal(item.icon.width, 160, `${id} artwork should be 160px wide`);
    assert.equal(item.icon.height, 224, `${id} artwork should be 224px high`);
  }
}

function testCanonicalRings() {
  assert.equal(rings.length, 18, "the canonical ring roster should contain eighteen rings");
  assert.equal(getRingById("ring_of_the_last_footstep").mechanics.usesPerCombat, 1, "Last Footstep should be limited to the first trigger each combat");
  assert.equal(getRingById("ring_of_the_crooked_step").mechanics.cost, "reaction", "Crooked Step should have an explicit action-economy cost");
  for (const ring of rings) {
    assert.deepEqual(ring.allowedSlots, ["ring1", "ring2"], `${ring.id} should only equip in ring slots`);
    assert.equal(ring.requiresAttunement, false, `${ring.id} should not require attunement`);
    assert.equal(ring.worldUnique, true, `${ring.id} should have exactly one instance in the game`);
    assert.ok(ring.description, `${ring.id} should expose its complete mechanical description`);
    assert.equal(ring.icon.src, `combat_ui_v2/assets/icons/rings/${ring.id}.png`, `${ring.id} should resolve its approved 80px icon by stable id`);
    assert.equal(ring.icon.width, 80, `${ring.id} icon should be 80px wide`);
  }
}

function testRingDerivedStats() {
  const defensive = derivePlayerStats({
    player: {
      abilities: { dex: 14 },
      equipment: { ring1: "ring_of_protection", ring2: "ring_of_cinders" },
    },
  });
  assert.equal(defensive.ac, 13, "Ring of Protection should contribute +1 AC");
  assert.ok(defensive.resistances.includes("fire"), "Ring of Cinders should grant fire resistance");

  const utility = derivePlayerStats({
    player: {
      abilities: { dex: 14 },
      equipment: { ring1: "ring_of_readiness", ring2: "ring_of_the_investigator" },
    },
  });
  assert.equal(utility.initiativeBonus, 2, "Ring of Readiness should contribute +2 initiative");
  assert.ok(utility.skillAdvantages.includes("investigation"), "Ring of the Investigator should grant Investigation advantage");
  assert.ok(utility.equipmentMechanics.some((entry) => entry.sourceItemId === "ring_of_readiness"), "derived stats should expose equipped ring mechanics to combat consumers");

  const duplicateUniqueRing = derivePlayerStats({
    player: {
      abilities: { dex: 14 },
      equipment: { ring1: "ring_of_protection", ring2: "ring_of_protection" },
    },
  });
  assert.equal(duplicateUniqueRing.ac, 13, "equipping the same unique ring twice should not stack its benefit");
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
  assert.equal(derived.equipped.shield.id, "shield", "shield records should resolve into the dedicated shield slot");
  assert.equal(derived.equipped.offHand, null, "a shield should not also remain duplicated in the generic off-hand slot");

  const doubleShield = derivePlayerStats({
    player: {
      abilities: { dex: 14 },
      equipment: { armor: "studded_leather", shield: "shield", offHand: "tower_shield" },
    },
  });
  assert.equal(doubleShield.ac, 16, "two different shield paths must not stack their AC bonuses");
  assert.equal(doubleShield.equipped.shield.id, "shield", "the dedicated shield slot takes priority");
  assert.equal(doubleShield.equipped.offHand, null, "a second shield must be suppressed from the off-hand slot");
}

function testNarrativeUniqueLookup() {
  const earring = getUniqueById("gold_earring");
  assert.equal(earring.type, "unique", "unique records should remain item-addressable by id");
  assert.equal(earring.combat.usable, false, "unique narrative records should not expose combat use");
  assert.ok(earring.narrative.contexts.includes("dialogue"), "unique records should expose dialogue context metadata");
}
