import { CLASSES, findClassByIdOrName } from "../../data/classes.js";
import { getDeviceRecipeById, listDeviceRecipes } from "../../data/deviceRecipes.js";
import { getWeaponById } from "../../data/weapons.js";
import { getSpellcastingFocusById } from "../../data/spellcastingFoci.js";
import { isDeclarativeFeatureImplemented } from "../featureImplementation.js";
import { resolveOriginFeat } from "./originFeatResolver.js";
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
  sheet.durability.maxHp = calculateMaxHp(sheet, classRecord, draft);
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

function calculateMaxHp(sheet, classRecord, draft) {
  const levelOneBase = classRecord.hp?.level1?.base;
  if (!Number.isFinite(levelOneBase)) return null;
  const level = Math.max(1, sheet.identity.level || 1);
  const conMod = sheet.abilities.constitution.modifier || 0;
  const levelOneCon = classRecord.hp.level1.addCon ? conMod : 0;
  const laterLevelBase = classRecord.hp?.perLevel?.base || 0;
  const laterLevelCon = classRecord.hp?.perLevel?.addCon ? conMod : 0;
  const levelUpHistory = draft.choices?.levelUpHistory || {};
  let laterLevelHitPoints = 0;
  for (let gainedLevel = 2; gainedLevel <= level; gainedLevel += 1) {
    const rolled = levelUpHistory[String(gainedLevel)]?.hpDie;
    laterLevelHitPoints += Number.isInteger(rolled) ? rolled : laterLevelBase;
  }
  const bonus = (sheet.durability.hitPointBonuses || []).reduce((total, item) => (
    total + (Number.isFinite(item.total) ? item.total : 0)
  ), 0);
  return levelOneBase + levelOneCon + laterLevelHitPoints + Math.max(0, level - 1) * laterLevelCon + bonus;
}

function addFeatureSet(sheet, draft, featuresByLevel, source) {
  for (const [levelText, features] of Object.entries(featuresByLevel || {})) {
    const level = Number(levelText);
    if (!Number.isInteger(level) || level > sheet.identity.level) continue;
    for (const feature of features || []) {
      if (!featureMatchesCondition(feature, sheet, draft)) continue;
      const featureId = `${source.prefix}:${slug(feature.name)}`;
      sheet.features.push({
        id: featureId,
        name: feature.name,
        source: source.source,
        sourceId: source.sourceId,
        kind: feature.type,
        description: feature.description || feature.note || "",
        uses: feature.uses || null,
        effects: structuredClone(feature.effects || {}),
        implemented: isDeclarativeFeatureImplemented(feature),
      });
      applyFeatureEffects(sheet, draft, feature, featureId, level);
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

function applyFeatureEffects(sheet, draft, feature, featureId, level) {
  const effects = feature.effects || {};
  for (const resource of effects.resources || []) {
    const max = resolveResourceMax(resource.max, sheet, feature);
    sheet.resources.push({
      id: resource.id,
      name: resource.name,
      max,
      current: max,
      recovery: resource.recovery,
      source: featureId,
    });
  }
  for (const expertise of effects.expertise || []) {
    addExpertise(sheet, { ...expertise, source: featureId });
  }
  addUniqueAll(sheet.proficiencies.skills, effects.proficiencies?.skills || []);
  addUniqueAll(sheet.proficiencies.tools, effects.proficiencies?.tools || []);
  addUniqueAll(sheet.durability.resistances, effects.resistances || []);
  for (const advancement of effects.advancement || []) {
    if (advancement.type === "ability_score_improvement") {
      const advancementSource = advancementChoiceId(sourceFeatureId(featureId), level);
      sheet.advancement.abilityScoreImprovements.push({
        source: advancementSource,
        choices: structuredClone(advancement.choices || ["ability_score", "feat"]),
      });
      resolveAdvancementFeatChoice(sheet, draft, advancementSource);
    }
  }
  for (const attackAction of effects.attackAction || []) {
    if (Number.isFinite(attackAction.attacks)) {
      sheet.combatBasics.attackActionAttacks = Math.max(sheet.combatBasics.attackActionAttacks || 1, attackAction.attacks);
    }
  }
  for (const mastery of effects.weaponMastery || []) {
    resolveWeaponMasteryChoices(sheet, draft, featureId, mastery);
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
        options: classFeatureChoiceOptions(requirement, draft),
      });
    } else {
      applyClassFeatureChoice(sheet, draft, requirement, chosen, featureId, classFeatureChoiceOptions(requirement, draft));
    }
  }
}

function resolveResourceMax(max, sheet, feature) {
  if (max === "saboteur_level") return Math.max(3, sheet.identity.level || 3);
  if (max === "proficiency_bonus") return sheet.proficiencyBonus || 0;
  if (typeof max === "function") return max(sheet, feature);
  return max;
}

function classFeatureChoiceOptions(requirement, draft) {
  if (requirement.options?.length) return requirement.options;
  if (requirement.kind === "device_recipe") return availableDeviceRecipeIds(draft);
  if (requirement.kind === "weapon") return [...(draft.gear?.weaponIds || [])];
  return null;
}

function resolveWeaponMasteryChoices(sheet, draft, featureId, mastery) {
  const count = mastery.count || 0;
  const chosen = draft.choices?.weaponMasteryIds || [];
  if (!count) return;
  if (chosen.length < count) {
    sheet.metadata.unresolved.push({
      type: "missing_class_feature_choice",
      featureId,
      choiceId: "weapon_mastery",
      kind: "weapon_mastery",
      count,
      options: null,
    });
    return;
  }
  const valid = chosen.filter((weaponId) =>
    weaponId === "club" || getWeaponById(weaponId)?.mastery || getSpellcastingFocusById(weaponId)?.mastery
  );
  if (valid.length < count) {
    sheet.metadata.unresolved.push({
      type: "invalid_class_feature_choice_value",
      featureId,
      choiceId: "weapon_mastery",
      values: chosen,
      message: "Weapon mastery choices must refer to weapons with mastery properties.",
    });
    return;
  }
  addUniqueAll(sheet.equipment.masteredWeaponIds, valid.slice(0, count));
}

function resolveAdvancementFeatChoice(sheet, draft, advancementSource) {
  const choice = draft.choices?.advancementChoices?.[advancementSource];
  const featId = choice?.featId || (choice?.kind === "feat" ? choice.id : null);
  if (!featId) return;
  const resolvedFeat = resolveOriginFeat(sheet, draft, featId, { advancementId: advancementSource });
  sheet.features.push({
    id: `advancement:${advancementSource}:feat`,
    name: `Advancement Feat: ${featId}`,
    source: "advancement",
    sourceId: advancementSource,
    kind: "feat",
    grants: resolvedFeat.grants,
    implemented: resolvedFeat.implemented,
  });
}

function sourceFeatureId(featureId) {
  return featureId.replace(/:ability_score_improvement$/, "");
}

function advancementChoiceId(classFeaturePrefix, level) {
  return `${classFeaturePrefix}:level_${level || "unknown"}:ability_score_improvement`;
}

function applyClassFeatureChoice(sheet, draft, requirement, chosen, featureId, options = null) {
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

  const validOptions = requirement.options?.length ? requirement.options : options;
  if (validOptions?.length) {
    const invalid = values.filter((value) => !validOptions.includes(value));
    if (invalid.length) {
      sheet.metadata.unresolved.push({
        type: "invalid_class_feature_choice_value",
        featureId,
        choiceId: requirement.id,
        values,
        options: validOptions,
      });
      return;
    }
  }

  sheet.metadata.classChoices[requirement.id] = values.length === 1 ? values[0] : values;
  if (requirement.kind === "skill") addUniqueAll(sheet.proficiencies.skills, values);
  if (requirement.kind === "tool") addUniqueAll(sheet.proficiencies.tools, values);
  if (requirement.kind === "spell") addUniqueAll(sheet.spellcasting.knownSpellIds, values);
  if (requirement.kind === "device_recipe") addDeviceRecipeChoices(sheet, draft, values);
}

function addExpertise(sheet, expertise) {
  if (!expertise.kind || !expertise.id) return;
  const exists = sheet.proficiencies.expertise.some((entry) => entry.kind === expertise.kind && entry.id === expertise.id);
  if (!exists) sheet.proficiencies.expertise.push(expertise);
}

function getClassChoice(draft, choiceId) {
  return draft.choices?.classChoices?.[choiceId] || null;
}

function addDeviceRecipeChoices(sheet, draft, values) {
  sheet.devices.ability ||= "intelligence";
  addUniqueAll(sheet.devices.knownRecipeIds, values);
  const recipeBook = values
    .map((id) => getDeviceRecipeById(id))
    .filter(Boolean)
    .map((recipe) => structuredClone(recipe));
  const existing = new Set(sheet.devices.recipeBook.map((recipe) => recipe.id));
  sheet.devices.recipeBook.push(...recipeBook.filter((recipe) => !existing.has(recipe.id)));

  const prepared = (draft.devices?.preparedRecipeIds || []).filter((id) => sheet.devices.knownRecipeIds.includes(id));
  if (prepared.length) addUniqueAll(sheet.devices.preparedRecipeIds, prepared);
}

function availableDeviceRecipeIds(draft) {
  const classRecord = findClass(CLASSES, draft.identity?.classId);
  const subclass = findSubclass(classRecord, draft.identity?.subclassId);
  const recipeIds = normalizeDeviceRecipeIds(subclass?.deviceRecipes || []);
  return listDeviceRecipes({ ids: recipeIds, level: draft.identity?.level || 1 }).map((recipe) => recipe.id);
}

function findSubclass(classRecord, subclassId) {
  if (!classRecord || !subclassId) return null;
  const normalized = String(subclassId).trim().toLowerCase();
  return Object.values(classRecord.subclasses || {}).find((subclass) => subclass.id === normalized) || null;
}

function normalizeDeviceRecipeIds(recipes) {
  return recipes.map((recipe) => typeof recipe === "string" ? recipe : recipe.id).filter(Boolean);
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
