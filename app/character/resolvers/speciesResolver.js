import { addUniqueAll } from "./resolverUtils.js";

export function resolveSpecies(sheet, draft, speciesRegistry) {
  const speciesId = draft.identity.speciesId;
  if (!speciesId) return;

  const species = speciesRegistry[speciesId];
  if (!species) {
    sheet.metadata.unresolved.push({ type: "missing_species", id: speciesId });
    return;
  }

  const lineage = resolveLineage(sheet, draft, species);
  sheet.combatBasics.speed = species.speed;
  sheet.combatBasics.senses = structuredClone(species.senses || []);
  sheet.identity.size = species.size;
  addUniqueAll(sheet.durability.resistances, species.resistances);

  if (lineage) addUniqueAll(sheet.durability.resistances, lineage.resistances);

  addSpeciesFeatures(sheet, draft, species, species.features || []);
  if (lineage) addSpeciesFeatures(sheet, draft, species, lineage.features || [], lineage);
}

function resolveLineage(sheet, draft, species) {
  const lineageIds = Object.keys(species.lineages || {});
  if (!lineageIds.length) return null;

  const requestedLineageId = draft.identity.lineageId;
  if (!requestedLineageId) {
    if (lineageIds.length === 1) return species.lineages[lineageIds[0]];
    sheet.metadata.unresolved.push({ type: "missing_lineage_choice", speciesId: species.id, options: lineageIds });
    return null;
  }

  const lineage = species.lineages[requestedLineageId];
  if (!lineage) {
    sheet.metadata.unresolved.push({ type: "invalid_lineage", speciesId: species.id, lineageId: requestedLineageId, options: lineageIds });
    return null;
  }
  return lineage;
}

function addSpeciesFeatures(sheet, draft, species, features, lineage = null) {
  for (const feature of features) {
    if (feature.minLevel > sheet.identity.level) continue;
    const sourceId = lineage ? `${species.id}.${lineage.id}` : species.id;
    const entry = {
      id: `species:${sourceId}:${feature.id}`,
      name: feature.name,
      source: "species",
      sourceId,
      kind: feature.effect,
      description: feature.description,
      grants: {},
      effects: structuredClone(feature.effects || {}),
      implemented: isDeclarativeFeatureImplemented(feature),
    };
    if (feature.grantsSpellId) entry.grants.spellId = feature.grantsSpellId;
    if (feature.choices?.length) entry.choices = [...feature.choices];
    sheet.features.push(entry);
    applySpeciesFeatureEffects(sheet, draft, feature, entry.id);
    if (!entry.implemented) {
      sheet.metadata.unresolved.push({ type: "unsupported_species_feature", speciesId: species.id, lineageId: lineage?.id || null, featureId: feature.id });
    }
  }
}

function isDeclarativeFeatureImplemented(feature) {
  const effects = feature.effects || {};
  return Boolean(
    feature.grantsSpellId ||
    ["skill_choice", "feat_choice", "hp_bonus_per_level"].includes(feature.effect) ||
    effects.resources?.length ||
    effects.spells?.length ||
    effects.hitPointBonuses?.length ||
    effects.choiceRequirements?.length ||
    effects.actionOptions?.length ||
    effects.modifiers?.length ||
    effects.triggeredEffects?.length ||
    effects.reactions?.length ||
    effects.narrativeTags?.length ||
    effects.narrativeOnly === true
  );
}

function applySpeciesFeatureEffects(sheet, draft, feature, featureId) {
  const effects = feature.effects || {};
  for (const spell of effects.spells || []) {
    if (spell.mode === "prepared") addUniqueAll(sheet.spellcasting.preparedSpellIds, [spell.id]);
    else addUniqueAll(sheet.spellcasting.knownSpellIds, [spell.id]);
  }
  for (const resource of effects.resources || []) {
    const max = resource.max === "proficiency_bonus" ? sheet.proficiencyBonus : resource.max;
    sheet.resources.push({
      id: resource.id,
      name: resource.name,
      max,
      current: max,
      recovery: resource.recovery,
      source: featureId,
    });
  }
  for (const bonus of effects.hitPointBonuses || []) {
    const total = Number.isFinite(bonus.total) ? bonus.total : (bonus.perLevel || 0) * sheet.identity.level;
    sheet.durability.hitPointBonuses.push({ source: featureId, perLevel: bonus.perLevel || null, total });
  }
  for (const requirement of effects.choiceRequirements || []) {
    const chosen = draft.choices?.speciesChoices?.[requirement.id] || null;
    if (!chosen) {
      sheet.metadata.unresolved.push({
        type: "missing_species_feature_choice",
        featureId,
        choiceId: requirement.id,
        kind: requirement.kind,
        count: requirement.count,
        options: requirement.options || null,
      });
    } else {
      applySpeciesChoice(sheet, requirement, chosen, featureId);
    }
  }
}

function applySpeciesChoice(sheet, requirement, chosen, featureId) {
  const values = Array.isArray(chosen) ? chosen : [chosen];
  if (values.length !== requirement.count) {
    sheet.metadata.unresolved.push({
      type: "invalid_species_feature_choice_count",
      featureId,
      choiceId: requirement.id,
      expected: requirement.count,
      actual: values.length,
    });
    return;
  }

  if (requirement.options?.length) {
    const invalid = values.filter((value) => !requirement.options.includes(value));
    if (invalid.length) {
      sheet.metadata.unresolved.push({
        type: "invalid_species_feature_choice_value",
        featureId,
        choiceId: requirement.id,
        values,
      });
      return;
    }
  }

  if (requirement.kind === "skill") {
    addUniqueAll(sheet.proficiencies.skills, values);
    return;
  }
  if (requirement.kind === "origin_feat") {
    sheet.metadata.unresolved.push({
      type: "deferred_species_origin_feat_choice",
      featureId,
      choiceId: requirement.id,
      values,
    });
  }
}
