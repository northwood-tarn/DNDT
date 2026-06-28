import { getEnemyAbilityTemplate } from "../data/enemyAbilityTemplates.js";
import { SPELLS } from "../data/spells.js";
import { weapons } from "../data/weapons.js";
import { createNaturalWeaponAction, createSpellAction, createWeaponAction, indexRecordsById } from "./actionFactory.js";
import { createFeatureActionsFromFeatures } from "./featureActionFactory.js";

const WEAPONS = indexRecordsById(weapons);

export function compileEnemyActions(source, options = {}) {
  const resources = structuredClone(options.resources || source.resources || []);
  const features = structuredClone(options.features || source.features || []);
  const actionRefs = normalizeActionRefs(source, options);
  return [
    ...actionRefs.map((ref) => compileEnemyActionRef(source, ref, options)).filter(Boolean),
    ...createFeatureActionsFromFeatures(features, {
      resources,
      resolveFormula: (formula) => resolveEnemyFormula(formula, source, options),
      resolveSaveDc: (option) => option.save?.dc || option.spellSaveDC || source.saveDC || null,
    }),
  ];
}

export function validateEnemyActionRefs(source) {
  const errors = [];
  for (const [index, ref] of normalizeActionRefs(source).entries()) {
    const path = `actionRefs[${index}]`;
    if (!ref || typeof ref !== "object") {
      errors.push(`${path} must be an object`);
      continue;
    }
    const template = getEnemyAbilityTemplate(ref.template);
    if (!template) {
      errors.push(`${path}.template references unknown enemy ability template: ${ref.template || "(missing)"}`);
      continue;
    }
    for (const field of template.required || []) {
      if (ref[field] == null && source[field] == null) errors.push(`${path}.${field} is required by ${ref.template}`);
    }
    if (ref.uses != null && !Number.isFinite(ref.uses) && typeof ref.uses !== "object") {
      errors.push(`${path}.uses must be a number or object`);
    }
    if (ref.spellSaveDC != null && !Number.isFinite(ref.spellSaveDC)) errors.push(`${path}.spellSaveDC must be numeric`);
    if (ref.aiPriority != null && !Number.isFinite(ref.aiPriority)) errors.push(`${path}.aiPriority must be numeric`);
    if (ref.targetPriority != null && typeof ref.targetPriority !== "string") errors.push(`${path}.targetPriority must be a string`);
    if (template.kind === "weapon_attack" && !WEAPONS[ref.weaponId || source.weaponId]) {
      errors.push(`${path}.weaponId references unknown weapon: ${ref.weaponId || source.weaponId || "(missing)"}`);
    }
    if (template.kind === "spell_action" && !SPELLS[ref.spellId]) {
      errors.push(`${path}.spellId references unknown spell: ${ref.spellId || "(missing)"}`);
    }
  }
  return errors;
}

function normalizeActionRefs(source, options = {}) {
  const refs = options.actionRefs || source.actionRefs;
  if (Array.isArray(refs) && refs.length) return refs.map((ref) => ({ ...ref }));
  if (source.weaponId) return [{ template: "weapon_attack", weaponId: source.weaponId }];
  if (source.naturalAttack) {
    return [{
      template: "natural_attack",
      naturalAttackId: source.naturalAttack.id,
      name: source.naturalAttack.name,
      range: source.naturalAttack.range,
      damage: source.naturalAttack.damage,
      damageType: source.naturalAttack.damageType,
    }];
  }
  return [];
}

function compileEnemyActionRef(source, ref, options) {
  const template = getEnemyAbilityTemplate(ref.template);
  if (!template) return null;
  if (template.kind === "weapon_attack") return decorateEnemyAction(compileWeaponAttack(source, ref, options), ref);
  if (template.kind === "natural_attack") return decorateEnemyAction(compileNaturalAttack(source, ref, options), ref);
  if (template.kind === "feature_action") return decorateEnemyAction(compileFeatureTemplate(source, template, ref, options), ref);
  if (template.kind === "spell_action") return decorateEnemyAction(compileSpellAction(source, ref), ref);
  if (template.kind === "self_heal") return decorateEnemyAction(compileSelfHealAction(ref), ref);
  return null;
}

function decorateEnemyAction(action, ref) {
  if (!action) return null;
  return {
    ...action,
    ...(ref.id ? { id: ref.id } : {}),
    ...(ref.name ? { name: ref.name } : {}),
    ...(ref.cost ? { cost: ref.cost } : {}),
    ...(ref.damage ? { damage: ref.damage } : {}),
    ...(ref.damageType ? { damageType: ref.damageType } : {}),
    ...(ref.uses ? { uses: normalizeUses(ref.uses) } : {}),
    ...(Number.isFinite(ref.spellSaveDC) ? { spellSaveDC: ref.spellSaveDC } : {}),
    ...(Number.isFinite(ref.aiPriority) ? { aiPriority: ref.aiPriority } : {}),
    ...(ref.targetPriority ? { targetPriority: ref.targetPriority } : {}),
  };
}

function normalizeUses(uses) {
  if (Number.isFinite(uses)) return { max: uses, remaining: uses };
  if (!uses || typeof uses !== "object") return null;
  const max = Number(uses.max ?? uses.remaining ?? 0);
  const remaining = Number(uses.remaining ?? max);
  return { ...uses, max, remaining };
}

function compileWeaponAttack(source, ref, options) {
  const weaponId = ref.weaponId || source.weaponId;
  const weapon = WEAPONS[weaponId];
  if (!weapon) return null;
  return createWeaponAction(weapon, {
    id: ref.id || options.actionId || weaponId,
    name: ref.name || options.actionName || weapon.name,
    attackBonus: ref.attackBonus ?? options.attackBonus ?? source.attackBonus,
    damage: ref.damage || options.damage || source.damage,
    damageType: ref.damageType || options.damageType || source.damageType,
    enableWeaponMastery: isEnemyWeaponMastered(source, weapon.id),
  });
}

function compileNaturalAttack(source, ref, options) {
  return createNaturalWeaponAction({
    id: ref.naturalAttackId || ref.id,
    name: ref.name,
    range: ref.range,
    damage: ref.damage,
    damageType: ref.damageType,
  }, {
    id: ref.id || options.actionId,
    name: ref.name || options.actionName,
    range: ref.range || options.range,
    attackBonus: ref.attackBonus ?? options.attackBonus ?? source.attackBonus,
    damage: ref.damage || options.damage,
    damageType: ref.damageType || options.damageType,
  });
}

function compileSpellAction(source, ref) {
  const spell = SPELLS[ref.spellId];
  if (!spell) return null;
  return createSpellAction(spell, {
    attackBonus: ref.attackBonus ?? source.attackBonus,
    spellSaveDC: ref.spellSaveDC ?? source.saveDC ?? 10 + Math.max(0, source.level || 1),
    casterLevel: ref.casterLevel ?? source.level ?? 1,
  });
}

function compileSelfHealAction(ref) {
  return {
    id: ref.id || "self_heal",
    name: ref.name || "Self Heal",
    type: "self_heal",
    cost: ref.cost || "bonus",
    requiresTarget: false,
    healing: ref.healing,
  };
}

function compileFeatureTemplate(source, template, ref, options) {
  const feature = {
    id: ref.featureId || ref.id || template.id,
    name: ref.name || template.name || template.id,
    effects: {
      actionOptions: [{
        id: ref.id || template.id,
        name: ref.name || template.name || template.id,
        actionType: ref.actionType || template.actionType,
        actionKind: ref.actionKind || template.actionKind,
        resourceId: ref.resourceId,
        requiresTarget: ref.requiresTarget ?? template.requiresTarget,
      }],
    },
  };
  return createFeatureActionsFromFeatures([feature], {
    resources: structuredClone(options.resources || source.resources || []),
    resolveFormula: (formula) => resolveEnemyFormula(formula, source, options),
    resolveSaveDc: () => source.saveDC || null,
  })[0] || null;
}

function isEnemyWeaponMastered(source, weaponId) {
  if (source.enableWeaponMastery === true) return true;
  return Array.isArray(source.masteredWeaponIds) && source.masteredWeaponIds.includes(weaponId);
}

function resolveEnemyFormula(formula, source, options) {
  return String(formula || "")
    .replace(/\blevel\b/g, String(options.level ?? source.level ?? 1))
    .replace(/\bstr(?:ength)?_modifier\b/g, String(source.abilityMods?.str ?? source.saves?.str ?? 0))
    .replace(/\bdex(?:terity)?_modifier\b/g, String(source.abilityMods?.dex ?? source.saves?.dex ?? 0))
    .replace(/\bcon(?:stitution)?_modifier\b/g, String(source.abilityMods?.con ?? source.saves?.con ?? 0))
    .replace(/\bint(?:elligence)?_modifier\b/g, String(source.abilityMods?.int ?? source.saves?.int ?? 0))
    .replace(/\bwis(?:dom)?_modifier\b/g, String(source.abilityMods?.wis ?? source.saves?.wis ?? 0))
    .replace(/\bcha(?:risma)?_modifier\b/g, String(source.abilityMods?.cha ?? source.saves?.cha ?? 0))
    .replace(/\s+/g, "");
}
