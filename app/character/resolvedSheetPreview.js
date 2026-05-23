import { getArmorById } from "../data/armor.js";
import { getConsumableById } from "../data/consumables.js";
import { getSpellRecordById } from "../data/spells.js";
import { getToolById } from "../data/tools.js";
import { getWeaponById } from "../data/weapons.js";
import { resolvedSheetToCombatActor, validateResolvedSheetCombatActor } from "./combatActorAdapter.js";
import { validateResolvedCharacterSheet } from "./resolvedSheet.js";

export function createResolvedSheetPreview(sheet, options = {}) {
  const sheetErrors = validateResolvedCharacterSheet(sheet);
  const combatActorErrors = sheetErrors.length ? [] : validateResolvedSheetCombatActor(sheet, options.actorOptions || {});
  const actor = sheetErrors.length || combatActorErrors.length ? null : resolvedSheetToCombatActor(sheet, options.actorOptions || {});

  return {
    version: 1,
    valid: sheetErrors.length === 0 && combatActorErrors.length === 0 && !(sheet.metadata?.unresolved || []).length,
    identity: previewIdentity(sheet),
    abilities: previewAbilities(sheet),
    combat: previewCombat(sheet),
    proficiencies: previewProficiencies(sheet),
    equipment: previewEquipment(sheet),
    spells: previewSpells(sheet),
    resources: structuredClone(sheet.resources || []),
    features: previewFeatures(sheet),
    narrative: previewNarrative(sheet),
    combatActions: previewCombatActions(actor),
    warnings: previewWarnings(sheet, sheetErrors, combatActorErrors),
  };
}

function previewIdentity(sheet) {
  return {
    characterName: sheet.identity.characterName,
    level: sheet.identity.level,
    background: { id: sheet.identity.backgroundId, name: sheet.identity.backgroundName },
    species: { id: sheet.identity.speciesId, name: sheet.identity.speciesName },
    lineage: { id: sheet.identity.lineageId || null, name: sheet.identity.lineageName || null },
    class: { id: sheet.identity.classId, name: sheet.identity.className },
    subclass: { id: sheet.identity.subclassId, name: sheet.identity.subclassName },
    pact: { id: sheet.identity.pactId, name: sheet.identity.pactName },
  };
}

function previewAbilities(sheet) {
  return Object.fromEntries(Object.entries(sheet.abilities || {}).map(([id, entry]) => [
    id,
    { score: entry.score, modifier: entry.modifier },
  ]));
}

function previewCombat(sheet) {
  return {
    armorClass: sheet.combatBasics.armorClass,
    maxHp: sheet.durability.maxHp,
    hitDice: sheet.durability.hitDice,
    speed: sheet.combatBasics.speed,
    initiativeBonus: sheet.combatBasics.initiativeBonus,
    passivePerception: sheet.combatBasics.passivePerception,
    saves: { ...(sheet.combatBasics.saves || {}) },
    senses: structuredClone(sheet.combatBasics.senses || []),
    resistances: [...(sheet.durability.resistances || [])],
    immunities: [...(sheet.durability.immunities || [])],
    conditionImmunities: [...(sheet.durability.conditionImmunities || [])],
  };
}

function previewProficiencies(sheet) {
  return {
    skills: [...(sheet.proficiencies.skills || [])],
    tools: (sheet.proficiencies.tools || []).map((id) => ({ id, name: getToolById(id)?.name || id })),
    expertise: structuredClone(sheet.proficiencies.expertise || []),
    armor: [...(sheet.proficiencies.armor || [])],
    weapons: [...(sheet.proficiencies.weapons || [])],
    savingThrows: [...(sheet.proficiencies.savingThrows || [])],
  };
}

function previewEquipment(sheet) {
  return {
    weapons: (sheet.equipment.weaponIds || []).map((id) => {
      const weapon = getWeaponById(id);
      return {
        id,
        name: weapon?.name || id,
        mastery: weapon?.mastery || null,
        mastered: (sheet.equipment.masteredWeaponIds || []).includes(id),
      };
    }),
    masteredWeaponIds: [...(sheet.equipment.masteredWeaponIds || [])],
    armor: itemPreview(sheet.equipment.armorId, getArmorById),
    shield: itemPreview(sheet.equipment.shieldId, getArmorById),
    inventory: (sheet.equipment.inventory || []).map((entry) => ({
      id: entry.id,
      name: getConsumableById(entry.id)?.name || entry.id,
      qty: entry.qty,
    })),
    attunedItemIds: [...(sheet.equipment.attunedItemIds || [])],
  };
}

function previewSpells(sheet) {
  const known = spellList(sheet.spellcasting.knownSpellIds);
  const prepared = spellList(sheet.spellcasting.preparedSpellIds);
  return {
    ability: sheet.spellcasting.ability,
    spellSaveDc: sheet.spellcasting.spellSaveDc,
    spellAttackBonus: sheet.spellcasting.spellAttackBonus,
    slots: { ...(sheet.spellcasting.slots || {}) },
    known,
    prepared,
  };
}

function spellList(ids = []) {
  return ids.map((id) => {
    const spell = getSpellRecordById(id, { includeInactive: true });
    return {
      id,
      name: spell?.name || id,
      level: spell?.level ?? null,
      source: spell?.source || null,
      concentration: spell?.concentration === true,
    };
  });
}

function previewNarrative(sheet) {
  return {
    tags: [...(sheet.narrative?.tags || [])],
  };
}

function previewFeatures(sheet) {
  return (sheet.features || []).map((feature) => ({
    id: feature.id,
    name: feature.name,
    source: feature.source,
    sourceId: feature.sourceId,
    kind: feature.kind,
    uses: feature.uses,
    implemented: feature.implemented === true,
    description: feature.description,
    mechanics: previewFeatureMechanics(feature),
  }));
}

function previewFeatureMechanics(feature) {
  const effects = feature.effects || {};
  const grants = feature.grants || {};
  return {
    actionOptions: [
      ...(effects.actionOptions || []),
      ...(grants.actionOptions || []),
    ].map((action) => ({
      id: action.id,
      name: action.name || action.id,
      actionType: action.actionType || "action",
      actionKind: action.actionKind || null,
    })),
    damageRiders: [
      ...(effects.damageRiders || []),
      ...(grants.damageRiders || []),
    ].map((rider) => ({
      id: rider.id,
      trigger: rider.trigger,
      damage: rider.damage,
      damageType: rider.damageType,
    })),
    featureHooks: [
      ...(effects.featureHooks || []),
      ...(grants.featureHooks || []),
    ].map((hook) => ({
      id: hook.id,
      timing: hook.timing,
    })),
  };
}

function previewCombatActions(actor) {
  if (!actor) return [];
  return (actor.actions || []).map((action) => ({
    id: action.id,
    name: action.name,
    type: action.type,
    cost: action.cost || "action",
    requiresTarget: action.requiresTarget !== false,
    weaponMastery: action.weaponMastery || null,
    weaponMasteryActive: action.weaponMasteryActive === true,
  }));
}

function previewWarnings(sheet, sheetErrors, combatActorErrors) {
  return {
    sheetErrors,
    unresolved: structuredClone(sheet.metadata?.unresolved || []),
    notes: structuredClone(sheet.metadata?.notes || []),
    combatActorErrors,
    unimplementedFeatures: (sheet.features || [])
      .filter((feature) => feature.implemented === false)
      .map((feature) => ({ id: feature.id, name: feature.name, source: feature.source, sourceId: feature.sourceId })),
  };
}

function itemPreview(id, getter) {
  if (!id) return null;
  const item = getter(id);
  return { id, name: item?.name || id };
}
