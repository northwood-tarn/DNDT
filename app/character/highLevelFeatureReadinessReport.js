import { CLASSES } from "../data/classes.js";
import { validateCombatActor } from "../combat/actor.js";
import { createEmptyCharacterDraft } from "./characterDraft.js";
import { resolvedSheetToCombatActor } from "./combatActorAdapter.js";
import { resolveCharacterSheet } from "./resolveCharacterSheet.js";
import { validateResolvedCharacterSheet } from "./resolvedSheet.js";

export const HIGH_LEVEL_READINESS_LEVELS = [1, 3, 5, 10, 13];

export function createHighLevelFeatureReadinessReport(options = {}) {
  const levels = options.levels || HIGH_LEVEL_READINESS_LEVELS;
  const classes = Object.values(options.classes || CLASSES);
  const entries = classes.flatMap((classRecord) =>
    levels.map((level) => createReadinessEntry(classRecord, level, options))
  );
  const risks = entries.flatMap((entry) => entry.risks.map((risk) => ({ ...risk, buildId: entry.id })));
  return {
    version: 1,
    levels,
    totals: {
      builds: entries.length,
      ready: entries.filter((entry) => entry.ready).length,
      withActor: entries.filter((entry) => entry.combatActor.valid).length,
      withUnresolved: entries.filter((entry) => entry.unresolved.length).length,
      risks: risks.length,
      highRisks: risks.filter((risk) => risk.severity === "high").length,
    },
    entries,
    risksByCategory: groupBy(risks, (risk) => risk.category),
  };
}

function createReadinessEntry(classRecord, level, options) {
  const draft = createRepresentativeDraft(classRecord, level, options);
  const sheet = resolveCharacterSheet(draft, options.registries || {}, { allowNonCreationLevel: true });
  const sheetErrors = validateResolvedCharacterSheet(sheet);
  const unresolved = structuredClone(sheet.metadata?.unresolved || []);
  const actorResult = createActorResult(sheet, sheetErrors, unresolved);
  const risks = assessBuildRisks(sheet, actorResult.actor);
  return {
    id: `${classRecord.id}_level_${level}`,
    classId: classRecord.id,
    className: classRecord.name,
    level,
    subclassId: draft.identity.subclassId || null,
    pactId: draft.identity.pactId || null,
    ready: sheetErrors.length === 0 && unresolved.length === 0 && actorResult.valid,
    sheet: {
      valid: sheetErrors.length === 0,
      errors: sheetErrors,
      featureCount: sheet.features.length,
      featureHookCount: sheet.featureHooks.length,
      resources: summarizeResources(sheet.resources),
      spellSlots: structuredClone(sheet.spellcasting.slots || {}),
      spellcasting: {
        canCast: sheet.spellcasting.canCast,
        classId: sheet.spellcasting.classId,
        pactMagic: sheet.spellcasting.pactMagic,
        spellSaveDc: sheet.spellcasting.spellSaveDc,
        spellAttackBonus: sheet.spellcasting.spellAttackBonus,
      },
    },
    combatActor: {
      valid: actorResult.valid,
      errors: actorResult.errors,
      actionCount: actorResult.actor?.actions?.length || 0,
      reactionCount: countFeatureEffects(sheet, "reactions"),
      auraCount: actorResult.actor?.auras?.length || 0,
      activeEffectCount: actorResult.actor?.activeEffects?.length || 0,
      hookCount: actorResult.actor?.featureHooks?.length || 0,
    },
    unresolved,
    interactions: summarizeInteractions(sheet, actorResult.actor),
    risks,
  };
}

function createRepresentativeDraft(classRecord, level, options) {
  const subclassId = level >= 3 ? firstEntryId(classRecord.subclasses) : null;
  const pactId = level >= 3 ? firstEntryId(classRecord.pacts) : null;
  const preset = classPreset(classRecord.id);
  return createEmptyCharacterDraft({
    identity: {
      characterName: `${classRecord.name} L${level} Readiness`,
      level,
      backgroundId: preset.backgroundId,
      speciesId: preset.speciesId,
      lineageId: preset.lineageId,
      classId: classRecord.id,
      subclassId,
      pactId,
    },
    abilities: preset.abilities,
    choices: {
      backgroundAbilityScores: preset.backgroundAbilityScores || [],
      backgroundOriginFeatChoice: preset.backgroundOriginFeatChoice || null,
      weaponMasteryIds: preset.weaponMasteryIds || [],
      classChoices: highLevelClassChoices(classRecord, level, options),
      spellChoices: {},
      featChoices: {},
      proficiencyChoices: {},
    },
    gear: preset.gear,
    spells: preset.spells,
    metadata: { source: "high_level_readiness_report" },
  });
}

function createActorResult(sheet, sheetErrors, unresolved) {
  if (sheetErrors.length || unresolved.length) return { valid: false, errors: [], actor: null };
  const actor = resolvedSheetToCombatActor(sheet, { id: "readiness_actor" });
  const errors = validateCombatActor(actor);
  return { valid: errors.length === 0, errors, actor: errors.length ? null : actor };
}

function assessBuildRisks(sheet, actor) {
  return [
    ...unresolvedChoiceRisks(sheet),
    ...reactionConflictRisks(sheet),
    ...zeroHpRisks(sheet),
    ...criticalRisks(sheet),
    ...oncePerTurnRisks(sheet),
    ...auraRisks(actor),
    ...persistentObjectRisks(sheet),
    ...spellSlotRisks(sheet),
  ];
}

function unresolvedChoiceRisks(sheet) {
  return (sheet.metadata?.unresolved || []).map((item) => ({
    severity: item.type?.includes("missing") ? "high" : "review",
    category: "unresolved_choice",
    message: humanUnresolvedMessage(item),
    detail: item,
  }));
}

function reactionConflictRisks(sheet) {
  const reactions = featureEffects(sheet, "reactions");
  return Object.entries(groupBy(reactions, (reaction) => reaction.trigger || "unspecified"))
    .filter(([, items]) => items.length > 1)
    .map(([trigger, items]) => ({
      severity: "high",
      category: "reaction_conflict",
      message: `${items.length} reactions can respond to ${trigger}; policy must choose prompt/automatic ordering.`,
      featureNames: items.map((item) => item.featureName),
      trigger,
    }));
}

function zeroHpRisks(sheet) {
  return featureEffects(sheet, "reactions")
    .filter((reaction) => ["would_drop_to_zero", "would_be_reduced_to_0_hp"].includes(reaction.trigger))
    .map((reaction) => ({
      severity: "high",
      category: "zero_hp_prevention",
      message: `${reaction.featureName} changes a 0-HP event and needs death/unconsciousness scenario coverage.`,
      featureName: reaction.featureName,
    }));
}

function criticalRisks(sheet) {
  const effects = [
    ...featureEffects(sheet, "reactions"),
    ...featureEffects(sheet, "triggeredEffects"),
    ...featureEffects(sheet, "damageRiders"),
  ];
  return effects
    .filter((effect) => String(effect.trigger || "").includes("critical") || effect.convertCritical || effect.criticalOnly)
    .map((effect) => ({
      severity: "high",
      category: "critical_interaction",
      message: `${effect.featureName} modifies critical-hit behavior and needs post-roll coverage.`,
      featureName: effect.featureName,
    }));
}

function oncePerTurnRisks(sheet) {
  return [
    ...featureEffects(sheet, "damageRiders"),
    ...featureEffects(sheet, "modifierRiders"),
    ...featureEffects(sheet, "triggeredEffects"),
  ]
    .filter((effect) => effect.oncePerTurn || effect.limit === "once_per_turn")
    .map((effect) => ({
      severity: "review",
      category: "once_per_turn",
      message: `${effect.featureName} has a once-per-turn rider; verify turn-bound reset and failed-attack behavior.`,
      featureName: effect.featureName,
    }));
}

function auraRisks(actor) {
  const auras = actor?.auras || [];
  const stackGroups = groupBy(auras.flatMap((aura) =>
    (aura.effects || []).map((effect) => ({
      key: `${aura.affects}:${effect.type}:${effect.stat || effect.id}`,
      auraName: aura.name,
      effect,
    }))
  ), (entry) => entry.key);
  return Object.values(stackGroups)
    .filter((items) => items.length > 1)
    .map((items) => ({
      severity: "review",
      category: "aura_stacking",
      message: `${items.length} aura effects target the same lane; strongest-only stacking should be confirmed.`,
      auraNames: items.map((item) => item.auraName),
    }));
}

function persistentObjectRisks(sheet) {
  return featureEffects(sheet, "persistentObjects")
    .concat(featureEffects(sheet, "zones"))
    .map((effect) => ({
      severity: "review",
      category: "persistent_object",
      message: `${effect.featureName} creates a persistent combat object or zone; verify lifecycle and encounter cleanup.`,
      featureName: effect.featureName,
    }));
}

function spellSlotRisks(sheet) {
  return sheet.features
    .filter((feature) => JSON.stringify(feature.effects || {}).includes("spell_slot"))
    .map((feature) => ({
      severity: "review",
      category: "spell_slot_manipulation",
      message: `${feature.name} manipulates spell slots; verify slot level limits and rest recovery.`,
      featureName: feature.name,
    }));
}

function summarizeInteractions(sheet, actor) {
  return {
    actions: actor?.actions?.map((action) => ({ id: action.id, name: action.name, type: action.actionType || action.type })) || [],
    reactions: featureEffects(sheet, "reactions").map((reaction) => summarizeEffect(reaction)),
    auras: (actor?.auras || []).map((aura) => ({
      id: aura.id,
      name: aura.name,
      radiusSquares: aura.radiusSquares,
      affects: aura.affects,
      effects: aura.effects.map((effect) => ({ type: effect.type, stat: effect.stat, amount: effect.amount })),
    })),
    damageRiders: featureEffects(sheet, "damageRiders").map((effect) => summarizeEffect(effect)),
    triggeredEffects: featureEffects(sheet, "triggeredEffects").map((effect) => summarizeEffect(effect)),
    modifierRiders: featureEffects(sheet, "modifierRiders").map((effect) => summarizeEffect(effect)),
  };
}

function summarizeEffect(effect) {
  return {
    id: effect.id,
    name: effect.name || effect.featureName,
    featureName: effect.featureName,
    trigger: effect.trigger || null,
    resourceId: effect.resourceId || null,
    reactionMode: effect.reactionMode || null,
    priority: effect.priority || null,
    oncePerTurn: effect.oncePerTurn === true || effect.limit === "once_per_turn",
  };
}

function featureEffects(sheet, key) {
  return (sheet.features || []).flatMap((feature) =>
    (feature.effects?.[key] || []).map((effect) => ({
      ...structuredClone(effect),
      featureName: feature.name,
      sourceFeatureId: feature.id,
    }))
  );
}

function countFeatureEffects(sheet, key) {
  return featureEffects(sheet, key).length;
}

function summarizeResources(resources = []) {
  return resources.map((resource) => ({
    id: resource.id,
    name: resource.name,
    max: resource.max,
    recovery: resource.recovery,
  }));
}

function classPreset(classId) {
  return CLASS_PRESETS[classId] || CLASS_PRESETS.fighter;
}

function highLevelClassChoices(classRecord, level, options) {
  const choices = { ...(options.classChoicesByClass?.[classRecord.id] || {}) };
  for (const requirement of listChoiceRequirements(classRecord, level)) {
    if (choices[requirement.id]) continue;
    if (requirement.options?.length) {
      choices[requirement.id] = requirement.count === 1 ? requirement.options[0] : requirement.options.slice(0, requirement.count);
      continue;
    }
    choices[requirement.id] = defaultChoiceForRequirement(requirement);
  }
  return choices;
}

function listChoiceRequirements(classRecord, level) {
  const featureSets = [
    classRecord.features,
    ...Object.values(classRecord.subclasses || {}).map((subclass) => subclass.features),
    ...Object.values(classRecord.pacts || {}).map((pact) => pact.features),
  ];
  return featureSets.flatMap((featuresByLevel) =>
    Object.entries(featuresByLevel || {})
      .filter(([featureLevel]) => Number(featureLevel) <= level)
      .flatMap(([, features]) => (features || []).flatMap((feature) => feature.effects?.choiceRequirements || []))
  );
}

function firstEntryId(entries = {}) {
  return Object.values(entries)[0]?.id || null;
}

function humanUnresolvedMessage(item) {
  if (item.type === "missing_class_choice") return `Choose ${item.kind || "class choice"} for ${item.classId}.`;
  if (item.type === "missing_class_feature_choice") return `Choose ${item.kind || "feature option"} for ${item.featureId}.`;
  if (item.type === "premature_class_choice") return `${item.id} requires level ${item.requiredLevel}.`;
  if (item.type === "missing_subclass") return `Missing subclass ${item.id}.`;
  if (item.type === "missing_pact") return `Missing pact ${item.id}.`;
  return item.message || item.type || "Unresolved character option.";
}

function defaultChoiceForRequirement(requirement) {
  const defaults = {
    skill: ["perception", "insight", "stealth"],
    spell: ["banishment", "counterspell", "magic_missile"],
    device_recipe: ["alchemists_fire", "caltrops", "hunting_trap"],
  };
  const values = defaults[requirement.kind] || ["default_choice"];
  return requirement.count === 1 ? values[0] : values.slice(0, requirement.count);
}

function groupBy(values, keyFn) {
  return values.reduce((out, value) => {
    const key = keyFn(value);
    out[key] ??= [];
    out[key].push(value);
    return out;
  }, {});
}

const MARTIAL_GEAR = {
  weaponIds: ["longsword", "warhammer", "greatsword"],
  armorId: "chain_mail",
  shieldId: "shield",
  inventory: [{ id: "healing_potion", quantity: 2 }],
  attunedItemIds: [],
};

const CASTER_SPELLS = {
  knownSpellIds: ["fire_bolt", "chill_touch"],
  preparedSpellIds: ["magic_missile", "shield", "burning_hands", "counterspell", "banishment"],
};

const CLASS_PRESETS = {
  fighter: {
    backgroundId: "soldier",
    speciesId: "aasimar",
    lineageId: null,
    abilities: { strength: 16, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 10, charisma: 10 },
    weaponMasteryIds: ["longsword", "warhammer", "greatsword"],
    gear: MARTIAL_GEAR,
    spells: { knownSpellIds: [], preparedSpellIds: [] },
  },
  rogue: {
    backgroundId: "criminal",
    speciesId: "halfling",
    lineageId: "lightfoot",
    abilities: { strength: 10, dexterity: 16, constitution: 14, intelligence: 12, wisdom: 10, charisma: 10 },
    weaponMasteryIds: ["rapier", "shortsword"],
    gear: { weaponIds: ["rapier", "shortsword"], armorId: "studded_leather", shieldId: null, inventory: [{ id: "healing_potion", quantity: 1 }], attunedItemIds: [] },
    spells: { knownSpellIds: [], preparedSpellIds: [] },
  },
  wizard: {
    backgroundId: "sage",
    speciesId: "aasimar",
    lineageId: null,
    abilities: { strength: 8, dexterity: 14, constitution: 12, intelligence: 16, wisdom: 10, charisma: 10 },
    gear: { weaponIds: ["quarterstaff"], armorId: null, shieldId: null, inventory: [{ id: "healing_potion", quantity: 1 }], attunedItemIds: [] },
    spells: CASTER_SPELLS,
  },
  warlock: {
    backgroundId: "sage",
    speciesId: "tiefling",
    lineageId: "infernal",
    abilities: { strength: 10, dexterity: 14, constitution: 12, intelligence: 10, wisdom: 10, charisma: 16 },
    weaponMasteryIds: ["longsword"],
    gear: { weaponIds: ["longsword"], armorId: "leather", shieldId: null, inventory: [{ id: "healing_potion", quantity: 1 }], attunedItemIds: [] },
    spells: { knownSpellIds: ["eldritch_blast", "fire_bolt"], preparedSpellIds: ["hex", "armor_of_agathys", "hellish_rebuke", "banishment"] },
  },
  cleric: {
    backgroundId: "acolyte",
    speciesId: "aasimar",
    lineageId: null,
    abilities: { strength: 12, dexterity: 12, constitution: 14, intelligence: 10, wisdom: 16, charisma: 10 },
    gear: { weaponIds: ["quarterstaff"], armorId: "half_plate", shieldId: "shield", inventory: [{ id: "healing_potion", quantity: 2 }], attunedItemIds: [] },
    spells: { knownSpellIds: ["guidance", "sacred_flame"], preparedSpellIds: ["cure_wounds", "bless", "spirit_guardians", "banishment"] },
  },
  paladin: {
    backgroundId: "soldier",
    speciesId: "aasimar",
    lineageId: null,
    abilities: { strength: 16, dexterity: 10, constitution: 14, intelligence: 10, wisdom: 10, charisma: 14 },
    weaponMasteryIds: ["longsword", "warhammer"],
    gear: MARTIAL_GEAR,
    spells: { knownSpellIds: [], preparedSpellIds: ["cure_wounds", "bless", "banishment"] },
  },
};
