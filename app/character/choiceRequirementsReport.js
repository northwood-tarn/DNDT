import { resolveCharacterSheet } from "./resolveCharacterSheet.js";
import { CHARACTER_CREATION_STEPS } from "./characterCreationSteps.js";
import { createCharacterChoicePools } from "./choicePools.js";

export function createChoiceRequirementsReport(draft, options = {}) {
  const sheet = options.sheet || resolveCharacterSheet(draft, {}, {
    allowNonCreationLevel: options.allowNonCreationLevel === true,
  });
  const choicePools = createCharacterChoicePools(draft);
  const requirements = [
    ...fixedStepRequirements(draft, choicePools),
    ...poolRequirements(choicePools),
    ...unresolvedRequirements(sheet.metadata?.unresolved || []),
  ];
  return {
    complete: requirements.length === 0,
    requirements,
    byStep: groupByStep(requirements),
    choicePools,
    unresolved: structuredClone(sheet.metadata?.unresolved || []),
  };
}

function fixedStepRequirements(draft, choicePools) {
  const out = [];
  if (!draft.identity?.characterName) {
    out.push(question({
      id: "identity.characterName",
      stepId: "identity",
      kind: "text",
      label: "Choose a character name.",
      path: "identity.characterName",
    }));
  }
  if (!draft.identity?.speciesId) {
    out.push(question({
      id: "identity.speciesId",
      stepId: "species",
      kind: "species",
      label: "Choose a species.",
      path: "identity.speciesId",
    }));
  }
  if (!draft.identity?.backgroundId) {
    out.push(question({
      id: "identity.backgroundId",
      stepId: "background",
      kind: "background",
      label: "Choose a background.",
      path: "identity.backgroundId",
    }));
  }
  if (!draft.identity?.classId) {
    out.push(question({
      id: "identity.classId",
      stepId: "class",
      kind: "class",
      label: "Choose a class.",
      path: "identity.classId",
    }));
  }
  const abilityRequirement = backgroundAbilityRequirement(draft);
  if (abilityRequirement) out.push(abilityRequirement);
  if (!Array.isArray(draft.gear?.weaponIds) || draft.gear.weaponIds.length === 0) {
    const weaponPool = choicePools.gear?.pools?.find((pool) => pool.id === "weapons") || null;
    out.push(question({
      id: "gear.weaponIds",
      stepId: "gear",
      kind: "gear",
      label: "Choose at least one weapon.",
      path: "gear.weaponIds",
      options: weaponPool?.options || null,
    }));
  }
  return out;
}

function backgroundAbilityRequirement(draft) {
  if (!draft.identity?.backgroundId) return null;
  const selected = draft.choices?.backgroundAbilityScores || [];
  const hasPlusTwo = selected.some((entry) => entry?.bonus === 2);
  const hasPlusOne = selected.some((entry) => entry?.bonus === 1);
  if (hasPlusTwo && hasPlusOne) return null;
  return question({
    id: "choices.backgroundAbilityScores",
    stepId: "abilities",
    kind: "background_ability_scores",
    label: "Choose background ability bonuses: one +2 and one +1.",
    path: "choices.backgroundAbilityScores",
    count: 2,
  });
}

function poolRequirements(choicePools) {
  const out = [];
  for (const pool of choicePools.spells?.pools || []) {
    if (pool.missing <= 0) continue;
    out.push(question({
      id: `spells.${pool.id}`,
      stepId: "spells",
      kind: "spell_pool",
      label: `Choose ${pool.missing} more ${pool.label.toLowerCase()}.`,
      path: pool.path,
      count: pool.count,
      options: pool.options,
      source: { type: "missing_spell_choice", poolId: pool.id, missing: pool.missing },
    }));
  }
  return out;
}

function unresolvedRequirements(unresolved) {
  return unresolved.map(requirementFromUnresolved).filter(Boolean);
}

function requirementFromUnresolved(item) {
  if (item.type === "missing_lineage_choice") {
    return question({
      id: `lineage:${item.speciesId}`,
      stepId: "species",
      kind: "lineage",
      label: "Choose a lineage.",
      path: "identity.lineageId",
      options: item.options,
      source: item,
    });
  }
  if (item.type === "missing_species_feature_choice") {
    return question({
      id: item.choiceId,
      stepId: "species",
      kind: item.kind,
      label: `Choose ${item.count} ${item.kind} option${item.count === 1 ? "" : "s"}.`,
      path: `choices.speciesChoices.${item.choiceId}`,
      count: item.count,
      options: item.options,
      source: item,
    });
  }
  if (item.type === "missing_origin_feat_choice") {
    return question({
      id: item.choiceId,
      stepId: "background",
      kind: "origin_feat_choice",
      label: "Complete origin feat choices.",
      path: `choices.featChoices.${item.featId}.${item.choiceId}`,
      count: item.count || 1,
      source: item,
    });
  }
  if (item.type === "missing_class_choice") {
    return question({
      id: item.choiceId,
      stepId: "class",
      kind: item.kind,
      label: `Choose a ${item.kind}.`,
      path: item.kind === "pact" ? "identity.pactId" : "identity.subclassId",
      options: item.options,
      source: item,
    });
  }
  if (item.type === "missing_class_feature_choice") {
    return question({
      id: item.choiceId,
      stepId: "class",
      kind: item.kind,
      label: `Choose ${item.count} ${item.kind} option${item.count === 1 ? "" : "s"}.`,
      path: `choices.classChoices.${item.choiceId}`,
      count: item.count,
      options: item.options,
      source: item,
    });
  }
  if (String(item.type || "").startsWith("invalid_") || String(item.type || "").startsWith("unsupported_") || item.type === "premature_class_choice") {
    return {
      id: `${item.type}:${item.choiceId || item.id || item.featureId || "issue"}`,
      stepId: stepForIssue(item),
      kind: "issue",
      severity: "error",
      label: item.message || item.type,
      source: item,
    };
  }
  return null;
}

function question({ id, stepId, kind, label, path, count = 1, options = null, source = null }) {
  return { id, stepId, kind, severity: "question", label, path, count, options: options ? [...options] : null, source };
}

function stepForIssue(item) {
  if (String(item.type || "").includes("species") || String(item.type || "").includes("lineage")) return "species";
  if (String(item.type || "").includes("background") || String(item.type || "").includes("origin_feat")) return "background";
  if (String(item.type || "").includes("class") || String(item.type || "").includes("subclass") || String(item.type || "").includes("pact")) return "class";
  return "review";
}

function groupByStep(requirements) {
  const order = new Set(CHARACTER_CREATION_STEPS.map((step) => step.id));
  const grouped = Object.fromEntries(Array.from(order).map((stepId) => [stepId, []]));
  for (const requirement of requirements) {
    const stepId = order.has(requirement.stepId) ? requirement.stepId : "review";
    grouped[stepId].push(requirement);
  }
  return grouped;
}
