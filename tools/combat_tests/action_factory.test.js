import { assert } from "./helpers.js";
import { validateCombatAction } from "../../app/combat/actionSchema.js";
import { createConsumableAction, createSpellAction, createWeaponAction, indexRecordsById } from "../../app/combat/actionFactory.js";
import { consumables } from "../../app/data/consumables.js";
import { SPELLS } from "../../app/data/spells.js";
import { weapons } from "../../app/data/weapons.js";
import { canUseAction } from "../../app/combat/rules.js";
import { initLanterna } from "../../app/systems/lanternaSystem.js";

const CONSUMABLES = indexRecordsById(consumables);
const WEAPONS = indexRecordsById(weapons);

function testActionFactoryWeaponOutput() {
  const action = createWeaponAction(WEAPONS.longsword, {
    id: "sword",
    name: "Sword",
    attackBonus: 5,
    damageBonus: 3,
  });

  assert.equal(action.type, "weapon_attack", "weapon factory should produce a weapon attack");
  assert.equal(action.damage, "1d8+3", "weapon factory should apply actor damage bonus");
  assert.equal(action.damageType, "slashing", "weapon factory should infer longsword damage type");
  assert.deepEqual(validateCombatAction(action), [], "weapon factory output should validate as a combat action");
}

function testActionFactorySpellOutput() {
  const action = createSpellAction(SPELLS.fire_bolt, { attackBonus: 5 });

  assert.equal(action.type, "spell_attack", "spell factory should map Fire Bolt to spell attack");
  assert.equal(action.range, 24, "spell factory should convert 120 ft to 24 grid squares");
  assert.equal(action.damage, "1d10", "spell factory should carry spell damage dice");
  assert.equal(action.damageType, "fire", "spell factory should carry spell damage type");
  assert.equal(action.requiresSight, true, "spell factory should carry target sight requirement");
  assert.deepEqual(validateCombatAction(action), [], "spell factory output should validate as a combat action");

  const chromaticOrb = createSpellAction(SPELLS.chromatic_orb, { attackBonus: 5 });
  assert.equal(chromaticOrb.type, "spell_attack", "Chromatic Orb should map to spell attack");
  assert.equal(chromaticOrb.damageType, "acid", "choice-damage spells should default to their first listed damage type");
  assert.deepEqual(chromaticOrb.damageTypeChoices, ["acid", "cold", "fire", "lightning", "poison", "thunder"]);
  assert.deepEqual(validateCombatAction(chromaticOrb), [], "choice-damage spell output should validate");

  assert.equal(createSpellAction(SPELLS.faerie_fire).lanternaOilCost, 1, "Faerie Fire should cost 1 Lanterna oil");
  assert.equal(createSpellAction(SPELLS.dawn).lanternaOilCost, 5, "Dawn should cost 5 Lanterna oil");
  assert.equal(createSpellAction(SPELLS.sunbeam).lanternaOilCost, 6, "Sunbeam should cost 6 Lanterna oil");
  initLanterna({ startOilMinutes: 0 });
  assert.equal(canUseAction({ hp: 1 }, createSpellAction(SPELLS.faerie_fire)).ok, false, "light spells should be blocked without enough Lanterna oil");
  initLanterna({ startOilMinutes: 60 });
}

function testActionFactorySpellEffects() {
  const hold = createSpellAction(SPELLS.hold_foe, { spellSaveDC: 13 });
  const fireball = createSpellAction(SPELLS.fireball, { spellSaveDC: 15 });
  const fogCloud = createSpellAction(SPELLS.fog_cloud, { spellSaveDC: 13 });
  const darkness = createSpellAction(SPELLS.darkness, { spellSaveDC: 13 });
  const spikeGrowth = createSpellAction(SPELLS.spike_growth, { spellSaveDC: 13 });
  const bless = createSpellAction(SPELLS.bless, { spellSaveDC: 13 });
  const bane = createSpellAction(SPELLS.bane, { spellSaveDC: 13 });
  const bladeWard = createSpellAction(SPELLS.blade_ward, { spellSaveDC: 13 });
  const shieldOfFaith = createSpellAction(SPELLS.shield_of_faith, { spellSaveDC: 13 });
  const resistance = createSpellAction(SPELLS.resistance, { spellSaveDC: 13 });
  const mageArmor = createSpellAction(SPELLS.mage_armor, { spellSaveDC: 13 });
  const guidance = createSpellAction(SPELLS.guidance, { spellSaveDC: 13 });

  assert.equal(hold.damage, undefined, "Hold Person should not invent fake damage");
  assert.equal(hold.effects[0].condition, "restrained", "Hold Foe should translate to Restrained");
  assert.equal(hold.effects[0].repeatSave.ability, "wis", "Hold Foe should preserve repeat save ability");
  assert.deepEqual(validateCombatAction(hold), [], "effect-only save spells should validate");
  assert.equal(fireball.type, "spell_area_save", "Fireball should become an area save spell");
  assert.equal(fireball.targeting.shape, "radius", "Fireball sphere should use radius targeting");
  assert.deepEqual(validateCombatAction(fireball), [], "area save spell should validate");
  assert.equal(fogCloud.type, "spell_object", "Fog Cloud should create a combat object");
  assert.equal(fogCloud.object.blocksLineOfSight, true, "Fog Cloud should block line of sight");
  assert.equal(darkness.type, "spell_object", "Darkness should create a combat object");
  assert.equal(spikeGrowth.type, "spell_object", "Spike Growth should create a combat object");
  assert.equal(spikeGrowth.object.difficultTerrain, true, "Spike Growth should be difficult terrain");
  assert.deepEqual(validateCombatAction(fogCloud), [], "Fog Cloud action should validate");
  assert.deepEqual(validateCombatAction(darkness), [], "Darkness action should validate");
  assert.deepEqual(validateCombatAction(spikeGrowth), [], "Spike Growth action should validate");
  assert.equal(bless.type, "spell_effect", "Bless should become a generic effect spell");
  assert.deepEqual(bless.effects.map((effect) => effect.stat), ["attack_roll", "save"], "Bless should produce attack and save modifiers");
  assert.equal(bane.type, "spell_save", "Bane should become a save-gated effect spell");
  assert.deepEqual(bane.effects.map((effect) => effect.stat), ["attack_roll", "save"], "Bane should produce attack and save penalties");
  assert.equal(bane.effects[0].multiplier, -1, "Bane attack penalty should subtract its die");
  assert.equal(bladeWard.effects[0].stat, "incoming_attack_roll", "Blade Ward should produce incoming attack roll penalty");
  assert.equal(shieldOfFaith.effects[0].stat, "ac", "Shield of Faith should produce AC modifier");
  assert.equal(resistance.effects[0].stat, "damage_reduction", "Resistance should produce damage reduction modifier");
  assert.equal(mageArmor.effects[0].stat, "ac_formula", "Mage Armor should produce AC formula modifier");
  assert.equal(guidance.effects[0].stat, "ability_check", "Guidance should produce ability check modifier");
  for (const action of [bless, bladeWard, shieldOfFaith, resistance, mageArmor, guidance]) {
    assert.deepEqual(validateCombatAction(action), [], `${action.name} effect action should validate`);
  }
}

function testActionFactoryConsumableOutput() {
  const action = createConsumableAction(CONSUMABLES.healing_potion, {
    id: "healing_potion",
    name: "Healing Potion",
  });
  const greaterPotion = createConsumableAction(CONSUMABLES.greater_healing_potion);

  assert.equal(action.type, "consumable", "consumable factory should produce a consumable action");
  assert.equal(action.itemId, "healing_potion", "consumable action should keep source item id");
  assert.equal(action.healing, "2d4+2", "consumable factory should parse healing dice from item data");
  assert.deepEqual(validateCombatAction(action), [], "consumable factory output should validate as a combat action");
  assert.equal(greaterPotion.healing, "4d4+4", "consumable factory should prefer structured healing data");
  assert.deepEqual(validateCombatAction(greaterPotion), [], "structured healing consumables should validate as combat actions");
}

function testEveryGeneratedUpcastDescriptionMatchesCompiledAction() {
  const numberWords = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
  const containsCount = (text, count) => new RegExp(`\\b(?:${count}|${numberWords[count] || count})\\b`, "i").test(text);
  const numericEffectValues = (action) => (action?.effects || []).flatMap((effect) => [
    effect.type === "temp_hp" ? effect.amount : null,
    effect.type === "max_hp_bonus" ? effect.amount : null,
    effect.damageRetaliation?.damage,
  ]).filter((value) => value !== null && value !== undefined);
  const nestedDamageValues = (action) => [
    ...(action?.object?.effects || []).map((effect) => effect.damage),
    ...(action?.effects || []).map((effect) => effect.action?.damage),
  ].filter(Boolean);

  for (const spell of Object.values(SPELLS)) {
    if (spell.level < 1) continue;
    const native = createSpellAction(spell, {
      slotLevel: spell.level,
      casterLevel: 17,
      spellcastingModifier: 3,
      spellSaveDC: 16,
      attackBonus: 8,
      usesExactSpellSlot: true,
    });
    if (!native) continue;

    for (let slotLevel = spell.level + 1; slotLevel <= 9; slotLevel += 1) {
      const upcast = createSpellAction(spell, {
        slotLevel,
        casterLevel: 17,
        spellcastingModifier: 3,
        spellSaveDC: 16,
        attackBonus: 8,
        usesExactSpellSlot: true,
      });
      if (!upcast) continue;
      const context = `${spell.name} at level ${slotLevel}`;

      assert.match(upcast.description, new RegExp(`level ${slotLevel} slot`, "i"), `${context} should identify its slot level`);
      if (upcast.damage !== native.damage) assert.ok(upcast.description.includes(upcast.damage), `${context} should show ${upcast.damage} damage`);
      if (upcast.healing !== native.healing) assert.ok(upcast.description.includes(upcast.healing), `${context} should show ${upcast.healing} healing`);
      if (upcast.hits !== native.hits) assert.ok(containsCount(upcast.description, upcast.hits), `${context} should show ${upcast.hits} hits`);
      if (upcast.maxTargets !== native.maxTargets && upcast.maxTargets > 1) {
        assert.ok(containsCount(upcast.description, upcast.maxTargets), `${context} should show ${upcast.maxTargets} targets`);
      }

      const nativeValues = numericEffectValues(native);
      for (const value of numericEffectValues(upcast)) {
        if (!nativeValues.includes(value)) assert.ok(upcast.description.includes(String(value)), `${context} should show scaled effect value ${value}`);
      }
      const nativeNestedDamage = nestedDamageValues(native);
      for (const damage of nestedDamageValues(upcast)) {
        if (!nativeNestedDamage.includes(damage)) assert.ok(upcast.description.includes(damage), `${context} should show nested ${damage} damage`);
      }
    }
  }
}

export async function runActionFactoryCombatTests() {
  testActionFactoryWeaponOutput();
  testActionFactorySpellOutput();
  testActionFactorySpellEffects();
  testActionFactoryConsumableOutput();
  testEveryGeneratedUpcastDescriptionMatchesCompiledAction();
}
