#!/usr/bin/env node

const DEFAULT_CLASSES_PATH = "app/data/classes.js";
const VALID_FEATURE_TYPES = new Set(["Action", "Bonus Action", "Reaction", "Passive", "Special"]);
const VALID_ABILITIES = new Set(["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"]);
const VALID_RESOURCE_USES = new Set(["channelDivinity"]);
const VALID_EFFECT_KEYS = new Set(["resources", "expertise", "actionOptions", "choiceRequirements", "modifiers", "auras", "triggeredEffects", "reactions", "damageRiders", "conditionRiders", "modifierRiders", "healingRiders", "resistances", "narrativeTags", "narrativeOnly", "advancement", "attackAction"]);
const VALID_EFFECT_RECOVERY = new Set(["short_rest", "long_rest", "combat", "special"]);
const VALID_CHOICE_KINDS = new Set(["subclass", "pact", "skill", "tool", "spell", "weapon", "device_recipe"]);

function validateString(errors, id, pathName, value) {
  if (typeof value !== "string" || !value.trim()) errors.push(`${id}: ${pathName} must be a non-empty string`);
}

function validateStableId(errors, id, pathName, value) {
  validateString(errors, id, pathName, value);
  if (typeof value === "string" && !/^[a-z][a-z0-9_]*$/.test(value)) {
    errors.push(`${id}: ${pathName} must be a stable snake_case id`);
  }
}

function validateArray(errors, id, pathName, value) {
  if (!Array.isArray(value)) errors.push(`${id}: ${pathName} must be an array`);
}

function validatePositiveNumber(errors, id, pathName, value) {
  if (!Number.isFinite(value) || value <= 0) errors.push(`${id}: ${pathName} must be a positive number`);
}

function validateHp(errors, classId, hp) {
  if (!hp || typeof hp !== "object" || Array.isArray(hp)) {
    errors.push(`${classId}: hp must be an object`);
    return;
  }
  for (const key of ["level1", "perLevel"]) {
    const entry = hp[key];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      errors.push(`${classId}: hp.${key} must be an object`);
      continue;
    }
    validatePositiveNumber(errors, classId, `hp.${key}.base`, entry.base);
    if (typeof entry.addCon !== "boolean") errors.push(`${classId}: hp.${key}.addCon must be boolean`);
  }
}

function validateFeature(errors, ownerId, feature, index) {
  const id = `${ownerId}.features[${index}]`;
  if (!feature || typeof feature !== "object" || Array.isArray(feature)) {
    errors.push(`${id}: must be an object`);
    return;
  }
  validateString(errors, id, "name", feature.name);
  validateString(errors, id, "type", feature.type);
  if (!VALID_FEATURE_TYPES.has(feature.type)) errors.push(`${id}: unknown type "${feature.type}"`);
  if (!feature.description && !feature.note) errors.push(`${id}: description or note is required`);
  if (feature.uses && !VALID_RESOURCE_USES.has(feature.uses) && !/^(shortRest|longRest)(:\d+)?$/.test(feature.uses)) {
    errors.push(`${id}: uses must be a known resource, shortRest, longRest, or a rest value plus :count`);
  }
  if ("feature" in feature) errors.push(`${id}: use name, not duplicate feature`);
  validateEffects(errors, id, feature.effects);
}

function validateEffects(errors, id, effects) {
  if (effects === undefined) return;
  if (!effects || typeof effects !== "object" || Array.isArray(effects)) {
    errors.push(`${id}: effects must be an object`);
    return;
  }
  for (const key of Object.keys(effects)) {
    if (!VALID_EFFECT_KEYS.has(key)) errors.push(`${id}: unknown effects key "${key}"`);
  }
  validateEffectArray(errors, id, "resources", effects.resources);
  validateEffectArray(errors, id, "expertise", effects.expertise);
  validateEffectArray(errors, id, "actionOptions", effects.actionOptions);
  validateEffectArray(errors, id, "choiceRequirements", effects.choiceRequirements);
  validateEffectArray(errors, id, "modifiers", effects.modifiers);
  validateEffectArray(errors, id, "auras", effects.auras);
  validateEffectArray(errors, id, "triggeredEffects", effects.triggeredEffects);
  validateEffectArray(errors, id, "reactions", effects.reactions);
  validateEffectArray(errors, id, "damageRiders", effects.damageRiders);
  validateEffectArray(errors, id, "conditionRiders", effects.conditionRiders);
  validateEffectArray(errors, id, "modifierRiders", effects.modifierRiders);
  validateEffectArray(errors, id, "healingRiders", effects.healingRiders);
  validateEffectArray(errors, id, "resistances", effects.resistances);
  validateEffectArray(errors, id, "narrativeTags", effects.narrativeTags);
  validateEffectArray(errors, id, "advancement", effects.advancement);
  validateEffectArray(errors, id, "attackAction", effects.attackAction);
  if (effects.resistances !== undefined) validateStringArray(errors, id, "effects.resistances", effects.resistances);
  if (effects.narrativeTags !== undefined) validateStringArray(errors, id, "effects.narrativeTags", effects.narrativeTags);
  if (effects.narrativeOnly !== undefined && effects.narrativeOnly !== true) errors.push(`${id}: effects.narrativeOnly must be true when present`);
  for (const [index, resource] of (effects.resources || []).entries()) {
    const pathName = `${id}.effects.resources[${index}]`;
    validateStableId(errors, pathName, "id", resource.id);
    validateString(errors, pathName, "name", resource.name);
    validatePositiveNumber(errors, pathName, "max", resource.max);
    validateString(errors, pathName, "recovery", resource.recovery);
    if (!VALID_EFFECT_RECOVERY.has(resource.recovery)) errors.push(`${pathName}: unknown recovery "${resource.recovery}"`);
  }
  for (const [index, expertise] of (effects.expertise || []).entries()) {
    const pathName = `${id}.effects.expertise[${index}]`;
    validateString(errors, pathName, "kind", expertise.kind);
    validateString(errors, pathName, "id", expertise.id);
  }
  for (const [index, action] of (effects.actionOptions || []).entries()) {
    const pathName = `${id}.effects.actionOptions[${index}]`;
    validateStableId(errors, pathName, "id", action.id);
    validateString(errors, pathName, "actionType", action.actionType);
  }
  for (const [index, advancement] of (effects.advancement || []).entries()) {
    const pathName = `${id}.effects.advancement[${index}]`;
    validateString(errors, pathName, "type", advancement.type);
  }
  for (const [index, attackAction] of (effects.attackAction || []).entries()) {
    const pathName = `${id}.effects.attackAction[${index}]`;
    validatePositiveNumber(errors, pathName, "attacks", attackAction.attacks);
  }
  for (const [index, choice] of (effects.choiceRequirements || []).entries()) {
    const pathName = `${id}.effects.choiceRequirements[${index}]`;
    validateString(errors, pathName, "id", choice.id);
    validateString(errors, pathName, "kind", choice.kind);
    if (!VALID_CHOICE_KINDS.has(choice.kind)) errors.push(`${pathName}: unknown kind "${choice.kind}"`);
    validatePositiveNumber(errors, pathName, "count", choice.count);
    if (choice.options !== undefined) validateStringArray(errors, pathName, "options", choice.options);
  }
  for (const [index, modifier] of (effects.modifiers || []).entries()) {
    const pathName = `${id}.effects.modifiers[${index}]`;
    validateStableId(errors, pathName, "id", modifier.id);
    validateString(errors, pathName, "target", modifier.target);
  }
  for (const [index, aura] of (effects.auras || []).entries()) {
    const pathName = `${id}.effects.auras[${index}]`;
    validateStableId(errors, pathName, "id", aura.id);
    validateString(errors, pathName, "name", aura.name);
    validatePositiveNumber(errors, pathName, "radiusFt", aura.radiusFt);
    validateString(errors, pathName, "affects", aura.affects);
    validateEffectArray(errors, pathName, "effects", aura.effects);
  }
  for (const [index, triggeredEffect] of (effects.triggeredEffects || []).entries()) {
    const pathName = `${id}.effects.triggeredEffects[${index}]`;
    validateStableId(errors, pathName, "id", triggeredEffect.id);
    validateString(errors, pathName, "trigger", triggeredEffect.trigger);
  }
  for (const [index, reaction] of (effects.reactions || []).entries()) {
    const pathName = `${id}.effects.reactions[${index}]`;
    validateStableId(errors, pathName, "id", reaction.id);
    validateString(errors, pathName, "trigger", reaction.trigger);
  }
  for (const [index, rider] of (effects.damageRiders || []).entries()) {
    const pathName = `${id}.effects.damageRiders[${index}]`;
    validateStableId(errors, pathName, "id", rider.id);
    validateString(errors, pathName, "trigger", rider.trigger);
    validateString(errors, pathName, "damage", rider.damage);
    validateString(errors, pathName, "damageType", rider.damageType);
  }
  for (const [index, rider] of (effects.conditionRiders || []).entries()) {
    const pathName = `${id}.effects.conditionRiders[${index}]`;
    validateStableId(errors, pathName, "id", rider.id);
    validateString(errors, pathName, "trigger", rider.trigger);
    validateString(errors, pathName, "condition", rider.condition);
  }
  for (const [index, rider] of (effects.modifierRiders || []).entries()) {
    const pathName = `${id}.effects.modifierRiders[${index}]`;
    validateStableId(errors, pathName, "id", rider.id);
    validateString(errors, pathName, "trigger", rider.trigger);
    validateString(errors, pathName, "stat", rider.stat);
  }
  for (const [index, rider] of (effects.healingRiders || []).entries()) {
    const pathName = `${id}.effects.healingRiders[${index}]`;
    validateStableId(errors, pathName, "id", rider.id);
    validateString(errors, pathName, "trigger", rider.trigger);
  }
}

function validateStringArray(errors, id, pathName, value) {
  if (!Array.isArray(value)) {
    errors.push(`${id}: ${pathName} must be an array`);
    return;
  }
  const seen = new Set();
  for (const item of value) {
    validateString(errors, id, `${pathName}[]`, item);
    if (seen.has(item)) errors.push(`${id}: ${pathName} contains duplicate "${item}"`);
    seen.add(item);
  }
}

function validateEffectArray(errors, id, key, value) {
  if (value !== undefined && !Array.isArray(value)) errors.push(`${id}: effects.${key} must be an array`);
}

function validateFeaturesByLevel(errors, ownerId, featuresByLevel) {
  if (!featuresByLevel || typeof featuresByLevel !== "object" || Array.isArray(featuresByLevel)) {
    errors.push(`${ownerId}: features must be an object keyed by level`);
    return;
  }
  for (const [level, features] of Object.entries(featuresByLevel)) {
    const parsedLevel = Number(level);
    if (!Number.isInteger(parsedLevel) || parsedLevel < 1 || parsedLevel > 20) errors.push(`${ownerId}: invalid feature level "${level}"`);
    validateArray(errors, ownerId, `features.${level}`, features);
    (features || []).forEach((feature, index) => validateFeature(errors, `${ownerId}.level${level}`, feature, index));
  }
}

function validateSubclassMap(errors, classId, subclasses) {
  if (!subclasses || typeof subclasses !== "object" || Array.isArray(subclasses)) {
    errors.push(`${classId}: subclasses must be an object`);
    return;
  }
  const ids = new Set();
  for (const [name, subclass] of Object.entries(subclasses)) {
    const id = `${classId}.subclasses.${name}`;
    validateStableId(errors, id, "id", subclass?.id);
    validateString(errors, id, "summary", subclass?.summary);
    if (subclass?.deviceRecipes !== undefined) validateDeviceRecipes(errors, id, subclass.deviceRecipes);
    if (subclass?.id) {
      if (ids.has(subclass.id)) errors.push(`${id}: duplicate subclass id "${subclass.id}"`);
      ids.add(subclass.id);
    }
    validateFeaturesByLevel(errors, id, subclass?.features);
    validateSubclassFeatureChoices(errors, id, subclass);
  }
}

function validatePactMap(errors, classId, pacts) {
  if (pacts === undefined) return;
  if (!pacts || typeof pacts !== "object" || Array.isArray(pacts)) {
    errors.push(`${classId}: pacts must be an object`);
    return;
  }
  const ids = new Set();
  for (const [name, pact] of Object.entries(pacts)) {
    const id = `${classId}.pacts.${name}`;
    validateStableId(errors, id, "id", pact?.id);
    validateString(errors, id, "summary", pact?.summary);
    if (pact?.id) {
      if (ids.has(pact.id)) errors.push(`${id}: duplicate pact id "${pact.id}"`);
      ids.add(pact.id);
    }
    validateFeaturesByLevel(errors, id, pact?.features);
  }
}

function validateSubclassProgression(errors, classId, classRecord) {
  const subclassChoiceLevel = (classRecord.choices || []).find((choice) => choice.kind === "subclass")?.level || 3;
  for (const [name, subclass] of Object.entries(classRecord.subclasses || {})) {
    for (const level of Object.keys(subclass.features || {})) {
      if (Number(level) < subclassChoiceLevel) {
        errors.push(`${classId}.subclasses.${name}: subclass feature level ${level} is before subclass choice level ${subclassChoiceLevel}`);
      }
    }
  }
}

function validatePactProgression(errors, classId, classRecord) {
  const pactChoiceLevel = (classRecord.choices || []).find((choice) => choice.kind === "pact")?.level || 3;
  for (const [name, pact] of Object.entries(classRecord.pacts || {})) {
    for (const level of Object.keys(pact.features || {})) {
      if (Number(level) < pactChoiceLevel) {
        errors.push(`${classId}.pacts.${name}: pact feature level ${level} is before pact choice level ${pactChoiceLevel}`);
      }
    }
  }
}


function validateClassChoices(errors, classId, classRecord) {
  if (classRecord.choices === undefined) return;
  if (!Array.isArray(classRecord.choices)) {
    errors.push(`${classId}: choices must be an array`);
    return;
  }
  for (const [index, choice] of classRecord.choices.entries()) {
    const id = `${classId}.choices[${index}]`;
    validateStableId(errors, id, "id", choice.id);
    validateString(errors, id, "kind", choice.kind);
    if (!VALID_CHOICE_KINDS.has(choice.kind)) errors.push(`${id}: unknown kind "${choice.kind}"`);
    validatePositiveNumber(errors, id, "level", choice.level);
    if (choice.required !== undefined && typeof choice.required !== "boolean") errors.push(`${id}: required must be boolean`);
  }
}

function validateDeviceRecipes(errors, ownerId, recipes) {
  if (!Array.isArray(recipes)) {
    errors.push(`${ownerId}: deviceRecipes must be an array`);
    return;
  }
  const ids = new Set();
  for (const [index, recipe] of recipes.entries()) {
    const id = `${ownerId}.deviceRecipes[${index}]`;
    validateString(errors, id, "id", recipe.id);
    validateString(errors, id, "name", recipe.name);
    validateString(errors, id, "use", recipe.use);
    validateString(errors, id, "text", recipe.text);
    if (ids.has(recipe.id)) errors.push(`${id}: duplicate recipe id "${recipe.id}"`);
    ids.add(recipe.id);
  }
}

function validateSubclassFeatureChoices(errors, ownerId, subclass) {
  const recipeIds = new Set((subclass.deviceRecipes || []).map((recipe) => recipe.id));
  for (const [level, features] of Object.entries(subclass.features || {})) {
    for (const [featureIndex, feature] of (features || []).entries()) {
      for (const [choiceIndex, choice] of (feature.effects?.choiceRequirements || []).entries()) {
        if (choice.kind !== "device_recipe") continue;
        const pathName = `${ownerId}.features.${level}[${featureIndex}].effects.choiceRequirements[${choiceIndex}]`;
        if (!recipeIds.size) {
          errors.push(`${pathName}: device_recipe choice requires subclass.deviceRecipes`);
          continue;
        }
        for (const option of choice.options || []) {
          if (!recipeIds.has(option)) errors.push(`${pathName}: unknown device recipe option "${option}"`);
        }
      }
    }
  }
}

function validateClassRecord(errors, classRecord, key, tools) {
  const id = classRecord?.id || key;
  if (!classRecord || typeof classRecord !== "object" || Array.isArray(classRecord)) {
    errors.push(`${key}: class must be an object`);
    return;
  }
  validateStableId(errors, id, "id", classRecord.id);
  if (classRecord.id !== key) errors.push(`${id}: key must match id`);
  validateString(errors, id, "name", classRecord.name);
  validateString(errors, id, "summary", classRecord.summary);
  validatePositiveNumber(errors, id, "hitDie", classRecord.hitDie);
  validateHp(errors, id, classRecord.hp);
  validateArray(errors, id, "primaryAbility", classRecord.primaryAbility);
  validateArray(errors, id, "savingThrows", classRecord.savingThrows);
  validateArray(errors, id, "armor", classRecord.armor);
  validateArray(errors, id, "weapons", classRecord.weapons);
  validateArray(errors, id, "tools", classRecord.tools);
  validateClassChoices(errors, id, classRecord);
  validateSubclassChoiceContract(errors, id, classRecord);
  validatePactChoiceContract(errors, id, classRecord);
  for (const ability of [...(classRecord.primaryAbility || []), ...(classRecord.savingThrows || [])]) {
    if (!VALID_ABILITIES.has(ability)) errors.push(`${id}: unknown ability "${ability}"`);
  }
  for (const toolId of classRecord.tools || []) {
    if (!tools[toolId]) errors.push(`${id}: unknown tool "${toolId}"`);
  }
  if (classRecord.spellcasting?.ability && !VALID_ABILITIES.has(classRecord.spellcasting.ability)) {
    errors.push(`${id}: unknown spellcasting ability "${classRecord.spellcasting.ability}"`);
  }
  validateFeaturesByLevel(errors, id, classRecord.features);
  validateSubclassMap(errors, id, classRecord.subclasses);
  validatePactMap(errors, id, classRecord.pacts);
  validateSubclassProgression(errors, id, classRecord);
  validatePactProgression(errors, id, classRecord);
}

function validateSubclassChoiceContract(errors, classId, classRecord) {
  const subclasses = Object.values(classRecord.subclasses || {});
  if (!subclasses.length) return;
  const subclassChoices = (classRecord.choices || []).filter((choice) => choice.kind === "subclass");
  if (subclassChoices.length !== 1) {
    errors.push(`${classId}: classes with subclasses must declare exactly one subclass choice`);
    return;
  }
  const choice = subclassChoices[0];
  if (choice.id !== "subclass") errors.push(`${classId}: subclass choice id must be "subclass"`);
  if (choice.level !== 3) errors.push(`${classId}: subclass choice level must be 3`);
  if (choice.required !== true) errors.push(`${classId}: subclass choice must be required`);
}

function validatePactChoiceContract(errors, classId, classRecord) {
  const pacts = Object.values(classRecord.pacts || {});
  if (!pacts.length) return;
  const pactChoices = (classRecord.choices || []).filter((choice) => choice.kind === "pact");
  if (pactChoices.length !== 1) {
    errors.push(`${classId}: classes with pacts must declare exactly one pact choice`);
    return;
  }
  const choice = pactChoices[0];
  if (choice.id !== "pact") errors.push(`${classId}: pact choice id must be "pact"`);
  if (choice.level !== 3) errors.push(`${classId}: pact choice level must be 3`);
  if (choice.required !== true) errors.push(`${classId}: pact choice must be required`);
}

export async function validateClasses(classesPath = DEFAULT_CLASSES_PATH) {
  const errors = [];
  const mod = await import(new URL(`../${classesPath}`, import.meta.url));
  const toolsMod = await import(new URL("../app/data/tools.js", import.meta.url));
  const classes = mod.CLASSES;
  if (!classes || typeof classes !== "object" || Array.isArray(classes)) return ["CLASSES export must be an object registry"];
  for (const [key, classRecord] of Object.entries(classes)) validateClassRecord(errors, classRecord, key, toolsMod.TOOLS);
  return errors;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const errors = await validateClasses(process.argv[2] || DEFAULT_CLASSES_PATH);
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("[classes] Validation OK");
  }
}
