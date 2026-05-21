import { CLASSES, findClassByIdOrName } from "../../data/classes.js";
import { isDeclarativeFeatureImplemented } from "../featureImplementation.js";
import { addUniqueAll } from "./resolverUtils.js";

const ABILITY_NAME_TO_ID = {
  Strength: "strength",
  Dexterity: "dexterity",
  Constitution: "constitution",
  Intelligence: "intelligence",
  Wisdom: "wisdom",
  Charisma: "charisma",
};

export function resolveClass(sheet, draft, classRegistry = CLASSES) {
  const classId = draft.identity.classId;
  if (!classId) return;

  const classRecord = findClass(classRegistry, classId);
  if (!classRecord) {
    sheet.metadata.unresolved.push({ type: "missing_class", id: classId });
    return;
  }

  sheet.identity.classId = classRecord.id;
  sheet.identity.className = classRecord.name;
  sheet.durability.hitDice = `d${classRecord.hitDie}`;
  sheet.durability.maxHp = calculateLevelOneHp(sheet, classRecord);
  addUniqueAll(sheet.proficiencies.armor, classRecord.armor || []);
  addUniqueAll(sheet.proficiencies.weapons, classRecord.weapons || []);
  addUniqueAll(sheet.proficiencies.tools, classRecord.tools || []);
  addUniqueAll(sheet.proficiencies.savingThrows, (classRecord.savingThrows || []).map(abilityNameToId));

  if (classRecord.spellcasting) {
    applySpellcastingFrame(sheet, classRecord);
  }

  resolveClassChoices(sheet, draft, classRecord);

  addFeatureSet(sheet, draft, classRecord.features, {
    source: "class",
    sourceId: classRecord.id,
    prefix: `class:${classRecord.id}`,
  });

  resolveSubclass(sheet, draft, classRecord, getSubclassChoiceLevel(classRecord));
  resolvePact(sheet, draft, classRecord, getPactChoiceLevel(classRecord));
}

function applySpellcastingFrame(sheet, classRecord) {
  const startsAtLevel = classRecord.spellcasting.startsAtLevel || 1;
  sheet.spellcasting = {
    ...sheet.spellcasting,
    canCast: sheet.identity.level >= startsAtLevel,
    source: "class",
    classId: classRecord.id,
    ability: abilityNameToId(classRecord.spellcasting.ability),
    preparation: classRecord.spellcasting.preparation || null,
    pactMagic: classRecord.spellcasting.pactMagic === true,
    ritualCasting: classRecord.spellcasting.ritualCasting === true,
    startsAtLevel,
  };
}

function findClass(classRegistry, id) {
  if (classRegistry === CLASSES) return findClassByIdOrName(id);
  const normalized = String(id).trim().toLowerCase();
  return classRegistry[normalized] || Object.values(classRegistry).find((entry) => (
    entry.id === normalized || entry.name?.toLowerCase() === normalized
  )) || null;
}

function resolveSubclass(sheet, draft, classRecord, subclassChoiceLevel = 3) {
  const subclassId = draft.identity.subclassId;
  if (!subclassId) return;

  if (sheet.identity.level < subclassChoiceLevel) {
    sheet.metadata.unresolved.push({
      type: "premature_class_choice",
      classId: classRecord.id,
      choiceId: "subclass",
      id: subclassId,
      requiredLevel: subclassChoiceLevel,
      currentLevel: sheet.identity.level,
    });
    return;
  }

  const found = Object.entries(classRecord.subclasses || {}).find(([name, subclass]) => (
    subclass.id === subclassId || name === subclassId || name.toLowerCase() === String(subclassId).toLowerCase()
  ));

  if (!found) {
    sheet.metadata.unresolved.push({
      type: "missing_subclass",
      classId: classRecord.id,
      id: subclassId,
      options: Object.values(classRecord.subclasses || {}).map((entry) => entry.id),
    });
    return;
  }

  const [subclassName, subclass] = found;
  sheet.identity.subclassId = subclass.id;
  sheet.identity.subclassName = subclassName;
  addFeatureSet(sheet, draft, subclass.features, {
    source: "subclass",
    sourceId: `${classRecord.id}:${subclass.id}`,
    prefix: `subclass:${classRecord.id}:${subclass.id}`,
  });
}

function resolveClassChoices(sheet, draft, classRecord) {
  for (const choice of classRecord.choices || []) {
    if (choice.level > sheet.identity.level) continue;
    if (choice.kind === "subclass") resolveSubclassChoice(sheet, draft, classRecord, choice);
    if (choice.kind === "pact") resolvePactChoice(sheet, draft, classRecord, choice);
  }
}

function getSubclassChoiceLevel(classRecord) {
  const choice = (classRecord.choices || []).find((item) => item.kind === "subclass");
  return choice?.level || 3;
}

function getPactChoiceLevel(classRecord) {
  const choice = (classRecord.choices || []).find((item) => item.kind === "pact");
  return choice?.level || 3;
}

function resolveSubclassChoice(sheet, draft, classRecord, choice) {
  const subclassIds = Object.values(classRecord.subclasses || {}).map((entry) => entry.id);
  if (!draft.identity.subclassId && choice.required) {
    sheet.metadata.unresolved.push({
      type: "missing_class_choice",
      classId: classRecord.id,
      choiceId: choice.id,
      kind: choice.kind,
      options: subclassIds,
    });
    return;
  }
  if (draft.identity.subclassId) {
    sheet.metadata.classChoices[choice.id] = draft.identity.subclassId;
  }
}

function resolvePact(sheet, draft, classRecord, pactChoiceLevel = 3) {
  const pactId = draft.identity.pactId;
  if (!pactId) return;

  if (sheet.identity.level < pactChoiceLevel) {
    sheet.metadata.unresolved.push({
      type: "premature_class_choice",
      classId: classRecord.id,
      choiceId: "pact",
      id: pactId,
      requiredLevel: pactChoiceLevel,
      currentLevel: sheet.identity.level,
    });
    return;
  }

  const found = Object.entries(classRecord.pacts || {}).find(([name, pact]) => (
    pact.id === pactId || name === pactId || name.toLowerCase() === String(pactId).toLowerCase()
  ));

  if (!found) {
    sheet.metadata.unresolved.push({
      type: "missing_pact",
      classId: classRecord.id,
      id: pactId,
      options: Object.values(classRecord.pacts || {}).map((entry) => entry.id),
    });
    return;
  }

  const [pactName, pact] = found;
  sheet.identity.pactId = pact.id;
  sheet.identity.pactName = pactName;
  addFeatureSet(sheet, draft, pact.features, {
    source: "pact",
    sourceId: `${classRecord.id}:${pact.id}`,
    prefix: `pact:${classRecord.id}:${pact.id}`,
  });
}

function resolvePactChoice(sheet, draft, classRecord, choice) {
  const pactIds = Object.values(classRecord.pacts || {}).map((entry) => entry.id);
  if (!draft.identity.pactId && choice.required) {
    sheet.metadata.unresolved.push({
      type: "missing_class_choice",
      classId: classRecord.id,
      choiceId: choice.id,
      kind: choice.kind,
      options: pactIds,
    });
    return;
  }
  if (draft.identity.pactId) {
    sheet.metadata.classChoices[choice.id] = draft.identity.pactId;
  }
}

function calculateLevelOneHp(sheet, classRecord) {
  const base = classRecord.hp?.level1?.base;
  if (!Number.isFinite(base)) return null;
  const conMod = classRecord.hp.level1.addCon ? sheet.abilities.constitution.modifier : 0;
  const bonus = (sheet.durability.hitPointBonuses || []).reduce((total, item) => (
    total + (Number.isFinite(item.total) ? item.total : 0)
  ), 0);
  return base + conMod + bonus;
}

function addFeatureSet(sheet, draft, featuresByLevel, source) {
  for (const [levelText, features] of Object.entries(featuresByLevel || {})) {
    const level = Number(levelText);
    if (!Number.isInteger(level) || level > sheet.identity.level) continue;
    for (const feature of features || []) {
      if (!featureMatchesCondition(feature, sheet, draft)) continue;
      sheet.features.push({
        id: `${source.prefix}:${slug(feature.name)}`,
        name: feature.name,
        source: source.source,
        sourceId: source.sourceId,
        kind: feature.type,
        description: feature.description || feature.note || "",
        uses: feature.uses || null,
        effects: structuredClone(feature.effects || {}),
        implemented: isDeclarativeFeatureImplemented(feature),
      });
      applyFeatureEffects(sheet, draft, feature, `${source.prefix}:${slug(feature.name)}`);
    }
  }
}

function featureMatchesCondition(feature, sheet, draft) {
  if (!feature.condition) return true;
  if (feature.condition.subclass) {
    const required = String(feature.condition.subclass).toLowerCase();
    const subclassId = String(sheet.identity.subclassId || draft.identity.subclassId || "").toLowerCase();
    const subclassName = String(sheet.identity.subclassName || "").toLowerCase();
    return subclassId === required || subclassName === required || subclassName.includes(required);
  }
  return true;
}

function applyFeatureEffects(sheet, draft, feature, featureId) {
  const effects = feature.effects || {};
  for (const resource of effects.resources || []) {
    sheet.resources.push({
      id: resource.id,
      name: resource.name,
      max: resource.max,
      current: resource.max,
      recovery: resource.recovery,
      source: featureId,
    });
  }
  for (const expertise of effects.expertise || []) {
    addExpertise(sheet, { ...expertise, source: featureId });
  }
  addUniqueAll(sheet.durability.resistances, effects.resistances || []);
  for (const advancement of effects.advancement || []) {
    if (advancement.type === "ability_score_improvement") {
      sheet.advancement.abilityScoreImprovements.push({
        source: featureId,
        choices: structuredClone(advancement.choices || ["ability_score", "feat"]),
      });
    }
  }
  for (const attackAction of effects.attackAction || []) {
    if (Number.isFinite(attackAction.attacks)) {
      sheet.combatBasics.attackActionAttacks = Math.max(sheet.combatBasics.attackActionAttacks || 1, attackAction.attacks);
    }
  }
  for (const requirement of effects.choiceRequirements || []) {
    const chosen = getClassChoice(draft, requirement.id);
    if (!chosen) {
      sheet.metadata.unresolved.push({
        type: "missing_class_feature_choice",
        featureId,
        choiceId: requirement.id,
        kind: requirement.kind,
        count: requirement.count,
        options: requirement.options || null,
      });
    } else {
      applyClassFeatureChoice(sheet, requirement, chosen, featureId);
    }
  }
}

function applyClassFeatureChoice(sheet, requirement, chosen, featureId) {
  const values = Array.isArray(chosen) ? chosen : [chosen];
  if (values.length !== requirement.count) {
    sheet.metadata.unresolved.push({
      type: "invalid_class_feature_choice_count",
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
        type: "invalid_class_feature_choice_value",
        featureId,
        choiceId: requirement.id,
        values,
        options: requirement.options,
      });
      return;
    }
  }

  sheet.metadata.classChoices[requirement.id] = values.length === 1 ? values[0] : values;
  if (requirement.kind === "skill") addUniqueAll(sheet.proficiencies.skills, values);
  if (requirement.kind === "tool") addUniqueAll(sheet.proficiencies.tools, values);
  if (requirement.kind === "spell") addUniqueAll(sheet.spellcasting.knownSpellIds, values);
}

function addExpertise(sheet, expertise) {
  if (!expertise.kind || !expertise.id) return;
  const exists = sheet.proficiencies.expertise.some((entry) => entry.kind === expertise.kind && entry.id === expertise.id);
  if (!exists) sheet.proficiencies.expertise.push(expertise);
}

function getClassChoice(draft, choiceId) {
  return draft.choices?.classChoices?.[choiceId] || null;
}

function abilityNameToId(name) {
  return ABILITY_NAME_TO_ID[name] || String(name || "").toLowerCase();
}

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
