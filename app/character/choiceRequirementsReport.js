import { resolveCharacterSheet } from "./resolveCharacterSheet.js";
import { CHARACTER_CREATION_STEPS } from "./characterCreationSteps.js";
import { createCharacterChoicePools } from "./choicePools.js";
import { getClassById } from "../data/classes.js";
import { getFeatById } from "../data/feats.js";

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
  for (const pool of choicePools.weaponMastery?.pools || []) {
    if (pool.missing <= 0) continue;
    out.push(question({
      id: `weapon_mastery.${pool.id}`,
      stepId: "gear",
      kind: "weapon_mastery_pool",
      label: `Choose ${pool.missing} more ${pool.label.toLowerCase()}.`,
      path: pool.path,
      count: pool.count,
      options: pool.options,
      source: { type: "missing_weapon_mastery_choice", poolId: pool.id, missing: pool.missing },
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
    const feat = getFeatById(item.featId);
    return question({
      id: item.choiceId,
      stepId: item.advancementId ? "class" : "background",
      kind: "origin_feat_choice",
      label: `Choose ${item.count || 1} ${choiceNoun(item.choiceId, item.kind, item.count || 1)} for ${feat?.name || item.featId}.`,
      path: `choices.featChoices.${item.featId}.${item.choiceId}`,
      count: item.count || 1,
      options: item.options || null,
      source: item,
    });
  }
  if (["invalid_origin_feat_choice_count", "invalid_origin_feat_choice_value"].includes(item.type) && item.kind && item.options) {
    const feat = getFeatById(item.featId);
    return question({
      id: item.choiceId,
      stepId: item.advancementId ? "class" : "background",
      kind: "origin_feat_choice",
      label: `Choose ${item.count || item.expected || 1} ${choiceNoun(item.choiceId, item.kind, item.count || item.expected || 1)} for ${feat?.name || item.featId}.`,
      path: `choices.featChoices.${item.featId}.${item.choiceId}`,
      count: item.count || item.expected || 1,
      options: item.options,
      source: item,
    });
  }
  if (item.type === "missing_class_choice") {
    const classRecord = getClassById(item.classId);
    return question({
      id: item.choiceId,
      stepId: "class",
      kind: item.kind,
      label: `Choose a ${classRecord?.name ? `${classRecord.name} ` : ""}${item.kind}.`,
      path: item.kind === "pact" ? "identity.pactId" : "identity.subclassId",
      options: item.options,
      source: item,
    });
  }
  if (item.type === "missing_class_feature_choice") {
    if (item.kind === "weapon_mastery") return null;
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
      label: describeUnresolvedCharacterIssue(item),
      source: item,
    };
  }
  return null;
}

export function describeUnresolvedCharacterIssue(item) {
  if (!item || typeof item !== "object") return String(item);
  if (item.message) return item.message;
  if (item.type === "missing_origin_feat_choice") {
    const feat = getFeatById(item.featId);
    return `Choose ${item.count || 1} ${choiceNoun(item.choiceId, item.kind, item.count || 1)} for ${feat?.name || item.featId}.`;
  }
  if (item.type === "invalid_origin_feat_choice_count") {
    const feat = getFeatById(item.featId);
    return `${feat?.name || item.featId} needs ${item.expected} choice${item.expected === 1 ? "" : "s"} for ${choiceLabel(item.choiceId)}; ${item.actual} selected.`;
  }
  if (item.type === "invalid_origin_feat_choice_value") {
    const feat = getFeatById(item.featId);
    return `${feat?.name || item.featId} has an invalid ${choiceLabel(item.choiceId)} selection.`;
  }
  if (item.type === "unsupported_origin_feat") return `The selected feat is not supported: ${item.featId}.`;
  if (item.type === "unsupported_origin_feat_choice_kind") {
    const feat = getFeatById(item.featId);
    return `${feat?.name || item.featId} uses an unsupported choice type: ${item.kind}.`;
  }
  if (item.type === "missing_lineage_choice") return "Choose a lineage for this species.";
  if (item.type === "missing_species_feature_choice") return `Choose ${item.count || 1} ${choiceLabel(item.choiceId, item.kind)}.`;
  if (item.type === "missing_class_choice") {
    const classRecord = getClassById(item.classId);
    return `Choose a ${classRecord?.name ? `${classRecord.name} ` : ""}${item.kind}.`;
  }
  if (item.type === "missing_class_feature_choice") return `Choose ${item.count || 1} ${choiceLabel(item.choiceId, item.kind)}.`;
  if (item.type === "premature_class_choice") return `This ${item.choiceId || "class choice"} is not available until level ${item.requiredLevel}.`;
  if (String(item.type || "").startsWith("invalid_")) return `Invalid character choice: ${humanize(item.type.replace(/^invalid_/, ""))}.`;
  if (String(item.type || "").startsWith("unsupported_")) return `Unsupported character feature: ${humanize(item.type.replace(/^unsupported_/, ""))}.`;
  if (item.type) return humanize(item.type);
  return JSON.stringify(item);
}

function choiceLabel(choiceId, kind = "") {
  if (choiceId === "ability") return "ability";
  if (choiceId === "abilities") return "abilities";
  if (choiceId === "spell" || choiceId === "spells") return "spell";
  if (choiceId === "step") return "Misty Step grant";
  if (choiceId === "proficiencies") return "skill or tool proficiency";
  if (choiceId === "expertise") return "expertise";
  if (choiceId === "damage_type") return "damage type";
  return humanize(kind || choiceId || "choice");
}

function choiceNoun(choiceId, kind, count) {
  const label = choiceLabel(choiceId, kind);
  if (count === 1 || label.endsWith("s")) return label;
  if (label.endsWith("y")) return `${label.slice(0, -1)}ies`;
  if (label === "Misty Step grant") return label;
  if (label === "expertise") return label;
  return `${label}s`;
}

function humanize(value) {
  return String(value || "choice").replace(/_/g, " ");
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
