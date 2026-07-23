import assert from "node:assert/strict";
import {
  createEmptyCharacterDraft,
  resolveCharacterSheet,
  resolvedSheetToCombatActor,
} from "../../app/character/index.js";
import { createSpellAction } from "../../app/combat/actionFactory.js";
import { listFeats } from "../../app/data/feats.js";
import { getSpellRecordById, SPELLS } from "../../app/data/spells.js";

export function runFeatContractTests() {
  for (const feat of listFeats()) {
    testFeatResolvesCleanly(feat);
  }
}

function testFeatResolvesCleanly(feat) {
  const draft = createEmptyCharacterDraft({
    identity: {
      characterName: `Feat Test ${feat.name}`,
      level: Math.max(4, feat.minLevel || 1),
      backgroundId: "feat_test_background",
      classId: "feat_test_class",
    },
    abilities: {
      strength: 14,
      dexterity: 14,
      constitution: 14,
      intelligence: 14,
      wisdom: 14,
      charisma: 14,
    },
    choices: { featChoices: { [feat.id]: generatedChoicesForFeat(feat) } },
    gear: { weaponIds: ["longsword"], armorId: "chain_mail", shieldId: "shield", inventory: [], attunedItemIds: [] },
  });
  const sheet = resolveCharacterSheet(draft, {
    backgrounds: {
      feat_test_background: {
        id: "feat_test_background",
        name: "Feat Test Background",
        skillProficiencies: [],
        toolProficiencies: [],
        originFeat: feat.id,
      },
    },
    classes: {
      feat_test_class: {
        id: "feat_test_class",
        name: "Feat Test Class",
        hitDie: 8,
        hp: { level1: { base: 8, addCon: true } },
        armor: ["light", "medium", "heavy", "shield"],
        weapons: ["Simple weapons", "Martial weapons"],
        tools: [],
        savingThrows: ["Strength", "Constitution"],
        spellcasting: {
          ability: "Charisma",
          startsAtLevel: 1,
          preparation: "known",
        },
        choices: [],
        features: {},
        subclasses: {},
      },
    },
  }, { allowNonCreationLevel: true });
  const actor = resolvedSheetToCombatActor(sheet, { id: `feat_${feat.id}` });
  const feature = sheet.features.find((item) => item.grants?.featId === feat.id);

  assert.ok(feature, `${feat.id}: feat should resolve into a sheet feature`);
  assert.equal(feature.implemented, true, `${feat.id}: feat should be implemented`);
  assert.deepEqual(sheet.metadata.unresolved, [], `${feat.id}: feat should not leave unresolved choices`);
  assertFeatEffectBridge(feat, sheet, actor, feature);
}

function assertFeatEffectBridge(feat, sheet, actor, feature) {
  const effects = feat.effects || {};
  for (const bonus of effects.abilityScoreBonuses || []) {
    assert.ok(sheet.abilities[bonus.ability]?.score > 14, `${feat.id}: fixed ability bonus should alter ${bonus.ability}`);
  }
  for (const skill of effects.proficiencies?.skills || []) {
    assert.ok(sheet.proficiencies.skills.includes(skill), `${feat.id}: skill proficiency ${skill} should resolve`);
  }
  for (const tool of effects.proficiencies?.tools || []) {
    assert.ok(sheet.proficiencies.tools.includes(tool), `${feat.id}: tool proficiency ${tool} should resolve`);
  }
  for (const weapon of effects.proficiencies?.weapons || []) {
    assert.ok(sheet.proficiencies.weapons.includes(weapon), `${feat.id}: weapon proficiency ${weapon} should resolve`);
  }
  for (const armor of effects.proficiencies?.armor || []) {
    assert.ok(sheet.proficiencies.armor.includes(armor), `${feat.id}: armor proficiency ${armor} should resolve`);
  }
  for (const resource of effects.resources || []) {
    assert.ok(sheet.resources.some((item) => item.id === resource.id), `${feat.id}: resource ${resource.id} should resolve`);
    assert.ok(actor.resources.some((item) => item.id === resource.id), `${feat.id}: resource ${resource.id} should bridge to combat actor`);
  }
  for (const grant of effects.spellGrants || []) {
    assert.ok(sheet.spellcasting.knownSpellIds.includes(grant.spellId), `${feat.id}: spell grant ${grant.spellId} should resolve`);
    if (spellCreatesCombatAction(grant.spellId)) {
      assert.ok(actor.actions.some((action) => action.id === grant.spellId), `${feat.id}: spell grant ${grant.spellId} should bridge to combat action`);
    }
  }
  for (const item of effects.inventory || []) {
    assert.ok(sheet.equipment.inventory.some((entry) => entry.id === item.id), `${feat.id}: inventory ${item.id} should resolve`);
    assert.ok(actor.inventory.some((entry) => entry.id === item.id), `${feat.id}: inventory ${item.id} should bridge to combat actor`);
  }
  for (const option of effects.actionOptions || []) {
    assert.ok(actor.actions.some((action) => action.id === option.id), `${feat.id}: action option ${option.id} should bridge to combat action`);
  }
  for (const hook of effects.featureHooks || []) {
    assert.ok(sheet.featureHooks.some((item) => item.id === hook.id), `${feat.id}: feature hook ${hook.id} should resolve`);
    assert.ok(actor.featureHooks.some((item) => item.id === hook.id), `${feat.id}: feature hook ${hook.id} should bridge to combat actor`);
  }
  for (const modifier of effects.modifiers || []) {
    if (modifier.stat) {
      assert.ok(actor.activeEffects.some((item) => item.id === modifier.id), `${feat.id}: modifier ${modifier.id} should bridge to active effects`);
    } else {
      assert.ok(feature.grants?.modifiers?.some((item) => item.id === modifier.id), `${feat.id}: modifier ${modifier.id} should remain declarative`);
    }
  }
  for (const rider of effects.damageRiders || []) {
    assert.ok(feature.grants?.damageRiders?.some((item) => item.id === rider.id), `${feat.id}: damage rider ${rider.id} should remain declarative on the feature`);
  }
  for (const sense of effects.senses || []) {
    assert.ok(sheet.combatBasics.senses.some((item) => item.type === sense.type), `${feat.id}: sense ${sense.type} should resolve`);
    assert.ok(actor.senses.some((item) => item.type === sense.type), `${feat.id}: sense ${sense.type} should bridge to combat actor`);
  }
  for (const tag of effects.narrativeTags || []) {
    assert.ok(sheet.narrative.tags.includes(tag), `${feat.id}: narrative tag ${tag} should resolve`);
  }
  for (const freeCast of effects.freeCastChoices || []) {
    const chosen = sheet.metadata.featChoices?.[feat.id]?.[freeCast.choiceId];
    const values = Array.isArray(chosen) ? chosen : [chosen].filter(Boolean);
    for (const spellId of values) {
      assert.ok(sheet.spellcasting.knownSpellIds.includes(spellId), `${feat.id}: free-cast spell ${spellId} should resolve`);
      assert.ok(sheet.resources.some((item) => item.id === `${freeCast.resourcePrefix}_${spellId}`), `${feat.id}: free-cast resource for ${spellId} should resolve`);
    }
  }
  if (effects.hitPointBonusPerLevel) {
    assert.ok(sheet.durability.hitPointBonuses.some((item) => item.perLevel === effects.hitPointBonusPerLevel), `${feat.id}: HP bonus should resolve`);
  }
  if (effects.unarmedStrike) {
    assert.deepEqual(feature.grants.unarmedStrike, effects.unarmedStrike, `${feat.id}: unarmed strike data should remain declarative`);
  }
  if (effects.discounts) {
    assert.deepEqual(feature.grants.discounts, effects.discounts, `${feat.id}: discount data should remain declarative`);
  }
}

function spellCreatesCombatAction(spellId) {
  const spell = getSpellRecordById(spellId);
  return Boolean(spell && createSpellAction(spell, { attackBonus: 5, spellSaveDC: 13 }));
}

function generatedChoicesForFeat(feat) {
  return Object.fromEntries((feat.choices || []).map((choice) => [
    choice.id,
    valuesForChoice(choice),
  ]));
}

function valuesForChoice(choice) {
  if (choice.kind === "spell" || choice.kind === "spell_list") return spellChoices(choice);
  if (choice.kind === "skill_or_tool") return ["skill:perception", "skill:stealth", "tool:thieves_tools"].slice(0, choice.count);
  if (choice.kind === "skill") return ["perception", "stealth", "athletics"].slice(0, choice.count);
  if (choice.kind === "skill_expertise") return ["perception", "stealth", "athletics"].slice(0, choice.count);
  if (choice.kind === "tool") return ["thieves_tools", "forgery_kit", "playing_card_set"].slice(0, choice.count);
  return (choice.options || ["strength", "dexterity", "constitution"]).slice(0, choice.count);
}

function spellChoices(choice) {
  const fixed = (choice.options || []).filter((spellId) => getSpellRecordById(spellId));
  if (fixed.length >= choice.count) return fixed.slice(0, choice.count);
  const matches = Object.values(SPELLS)
    .filter((spell) => spell?.active !== false)
    .filter((spell) => spellAllowedForChoice(choice, spell));
  return [...fixed, ...matches.map((spell) => spell.id).filter((id) => !fixed.includes(id))].slice(0, choice.count);
}

function spellAllowedForChoice(choice, spell) {
  const filter = choice.filter || {};
  if (Number.isFinite(filter.level) && spell.level !== filter.level) return false;
  if (Number.isFinite(filter.maxLevel) && spell.level > filter.maxLevel) return false;
  if (Array.isArray(filter.schools) && filter.schools.length && !filter.schools.includes(spell.school)) return false;
  if (filter.ritual === true && spell.ritual !== true) return false;
  return true;
}
