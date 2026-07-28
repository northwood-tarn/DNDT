import { getConsumableById } from "../data/consumables.js";
import { getArmorById } from "../data/armor.js";
import { describeDeviceRecipe, getDeviceRecipeById } from "../data/deviceRecipes.js";
import { getSpellRecordById } from "../data/spells.js";
import { getWeaponById, isWeaponProficient } from "../data/weapons.js";
import { getSpellcastingFocusById } from "../data/spellcastingFoci.js";
import { createConsumableAction, createNickAttackAction, createSpellAction, createWeaponAction } from "../combat/actionFactory.js";
import { normalizeCombatActor, validateCombatActor } from "../combat/actor.js";
import { createFeatureAction, createFeatureActionsFromFeatures } from "../combat/featureActionFactory.js";
import { aggregateEquipmentModifiers, resolveEquippedAccessories, resolveEquippedItems } from "./equippedItemRuntime.js";

const ABILITY_ABBREVIATIONS = {
  strength: "str",
  dexterity: "dex",
  constitution: "con",
  intelligence: "int",
  wisdom: "wis",
  charisma: "cha",
};
const SKILL_ABILITIES = {
  acrobatics: "dexterity", animal_handling: "wisdom", arcana: "intelligence", athletics: "strength",
  deception: "charisma", history: "intelligence", insight: "wisdom", intimidation: "charisma",
  investigation: "intelligence", medicine: "wisdom", nature: "intelligence", perception: "wisdom",
  performance: "charisma", persuasion: "charisma", religion: "intelligence", sleight_of_hand: "dexterity",
  stealth: "dexterity", survival: "wisdom",
};

export function resolvedSheetToCombatActor(sheet, options = {}) {
  const equippedFoci = equippedSpellcastingFoci(sheet);
  const equippedItems = resolveEquippedItems(sheet);
  const equippedAccessories = resolveEquippedAccessories(sheet);
  const equipmentModifiers = aggregateEquipmentModifiers(equippedItems);
  const spellcastingItemBonus = equippedFoci.reduce((total, item) => ({
    attack: total.attack + (item.modifiers?.spellAttackBonus || 0),
    dc: total.dc + (item.modifiers?.spellSaveDCBonus || 0),
  }), { attack: 0, dc: 0 });
  const actor = normalizeCombatActor({
    id: options.id || slug(sheet.identity.characterName || "player_character"),
    name: options.name || sheet.identity.characterName || "Player Character",
    team: options.team || "heroes",
    role: options.role || sheet.identity.classId || "character",
    creatureType: options.creatureType || "humanoid",
    tags: unique(["humanoid", ...(options.tags || [])]),
    token: options.token || defaultToken(sheet),
    portraitId: sheet.metadata?.presentation?.portraitId || null,
    combatSpellLevelStyle: sheet.metadata?.presentation?.combatSpellLevelStyle || null,
    hp: options.hp ?? sheet.durability.maxHp,
    maxHp: sheet.durability.maxHp,
    ac: sheet.combatBasics.armorClass,
    armorClassSources: structuredClone(sheet.combatBasics.armorClassSources || []),
    level: sheet.identity.level,
    proficiencyBonus: sheet.proficiencyBonus,
    spellSaveDC: ((sheet.spellcasting.spellSaveDc || 0) + spellcastingItemBonus.dc) || null,
    spellcastingFocus: {
      requiredType: requiredSpellcastingFocusType(sheet.identity.classId),
      equippedTypes: equippedFoci.map((item) => item.focusType).filter(Boolean),
      equippedIds: equippedFoci.map((item) => item.id),
    },
    deviceSaveDC: sheet.devices?.saveDc || null,
    spellSlots: normalizeSpellSlots(sheet.spellcasting.slots || {}),
    initiativeBonus: sheet.combatBasics.initiativeBonus || 0,
    attackActionAttacks: sheet.combatBasics.attackActionAttacks || 1,
    speed: feetToSquares((sheet.combatBasics.speed || 30) + equipmentModifiers.speedBonusFt + equipmentModifiers.combatSpeedBonusFt),
    position: options.position || { x: 0, y: 0 },
    abilityMods: abbreviateAbilityMods(sheet.abilities || {}),
    activeEffects: [...createPassiveFeatureEffects(sheet), ...equippedFoci.flatMap((focus) => structuredClone(focus.mechanics?.activeEffects || [])), ...createEquipmentActiveEffects(equippedAccessories)],
    concentrationSuccessRetaliation: equippedFoci.find((focus) => focus.mechanics?.concentrationSuccessRetaliation)?.mechanics.concentrationSuccessRetaliation || null,
    auras: createFeatureAuras(sheet),
    saves: abbreviateSaves(sheet.combatBasics.saves || {}),
    senses: structuredClone(sheet.combatBasics.senses || []),
    resistances: [...(sheet.durability.resistances || [])],
    immunities: [...(sheet.durability.immunities || [])],
    conditionImmunities: [...(sheet.durability.conditionImmunities || [])],
    resources: [...structuredClone(sheet.resources || []), ...createEquipmentResources(equippedFoci), ...createAccessoryResources(equippedAccessories)],
    features: [...structuredClone(sheet.features || []), ...createEquipmentFeatures(equippedFoci), ...createAccessoryFeatures(equippedAccessories)],
    devices: structuredClone(sheet.devices || {}),
    featureHooks: [...structuredClone(sheet.featureHooks || []), ...equippedFoci.flatMap((focus) => structuredClone(focus.mechanics?.featureHooks || []))],
    luck: createLuckProfile(sheet),
    movementRules: createEquipmentMovementRules(equippedAccessories),
    skillAdvantages: [...equipmentModifiers.skillAdvantages],
    skillBonuses: structuredClone(equipmentModifiers.skillBonuses),
    equipmentProficiencies: {
      weapons: [...(sheet.proficiencies.weapons || [])],
      armor: [...(sheet.proficiencies.armor || [])],
    },
    characterSheet: createCharacterSheetSummary(sheet, spellcastingItemBonus),
    equipmentTraits: createEquipmentTraits(equippedItems),
    equipment: {
      armorId: sheet.equipment.armorId || null,
      armorType: getArmorById(sheet.equipment.armorId)?.type || null,
      shieldId: sheet.equipment.shieldId || null,
      weaponIds: [...(sheet.equipment.weaponIds || [])],
      masteredWeaponIds: [...(sheet.equipment.masteredWeaponIds || [])],
      headwearId: sheet.equipment.headwearId || null,
      ringIds: [...(sheet.equipment.ringIds || [])],
      footwearId: sheet.equipment.footwearId || null,
      itemIds: equippedItems.map((item) => item.id),
    },
    inventory: structuredClone(sheet.equipment.inventory || []),
    actions: createCombatActionsFromSheet(sheet, { equippedFoci, equippedAccessories, spellcastingItemBonus }),
  });
  return actor;
}

function createCharacterSheetSummary(sheet, spellcastingItemBonus) {
  const proficientSkills = new Set(sheet.proficiencies.skills || []);
  const expertiseSkills = new Set((sheet.proficiencies.expertise || []).filter((entry) => entry.kind === "skill").map((entry) => entry.id));
  const skills = Object.fromEntries(Object.entries(SKILL_ABILITIES).map(([skill, ability]) => {
    const abilityModifier = sheet.abilities[ability]?.modifier || 0;
    const multiplier = expertiseSkills.has(skill) ? 2 : proficientSkills.has(skill) ? 1 : 0;
    return [skill, { ability, modifier: abilityModifier + (sheet.proficiencyBonus * multiplier), proficient: multiplier > 0, expertise: multiplier === 2 }];
  }));
  return {
    level: sheet.identity.level,
    className: sheet.identity.className || sheet.identity.classId,
    subclassName: sheet.identity.subclassName || null,
    proficiencyBonus: sheet.proficiencyBonus,
    abilities: structuredClone(sheet.abilities),
    saves: structuredClone(sheet.combatBasics.saves || {}),
    skills,
    spellAttackBonus: sheet.spellcasting.spellAttackBonus || 0,
    spellSaveDC: sheet.spellcasting.spellSaveDc || 0,
    spellcastingAbility: sheet.spellcasting.ability || null,
    savingThrowProficiencies: [...(sheet.proficiencies.savingThrows || [])],
    baseInitiativeBonus: sheet.abilities.dexterity?.modifier || 0,
    baseSpeedFt: sheet.combatBasics.speed || 30,
  };
}

export function validateResolvedSheetCombatActor(sheet, options = {}) {
  return validateCombatActor(resolvedSheetToCombatActor(sheet, options));
}

function createCombatActionsFromSheet(sheet, context = {}) {
  return [
    ...createWeaponActions(sheet),
    ...createSpellActions(sheet, context.spellcastingItemBonus),
    ...createFirstCovenantSpellActions(sheet, context.equippedFoci, context.spellcastingItemBonus),
    ...createFocusGrantedActions(context.equippedFoci),
    ...createAccessoryActions(sheet, context.equippedAccessories, context.spellcastingItemBonus),
    ...createDeviceActions(sheet),
    ...createConsumableActions(sheet),
    ...createFeatureActions(sheet),
  ].filter(Boolean);
}

function createDeviceActions(sheet) {
  const prepared = new Set(sheet.devices?.preparedRecipeIds || []);
  return (sheet.devices?.knownRecipeIds || [])
    .filter((recipeId) => prepared.has(recipeId))
    .map((recipeId) => getDeviceRecipeById(recipeId))
    .filter(Boolean)
    .flatMap((recipe) => createDeviceActionVariants(sheet, recipe))
    .filter(Boolean);
}

function createDeviceActionVariants(sheet, recipe) {
  const actions = [createDeviceAction(sheet, recipe)];
  if (hasResource(sheet, "quick_rigging")) {
    actions.push(createDeviceAction(sheet, recipe, {
      id: `quick_device_${recipe.id}`,
      name: `Quick Rigging: ${recipe.name}`,
      actionType: "bonus_action",
      additionalResourceIds: ["quick_rigging"],
      choiceParentResourceId: "quick_rigging",
      choiceParentName: resourceName(sheet, "quick_rigging"),
      choiceParentDescription: resourceDescription(sheet, "quick_rigging"),
      choiceLabel: recipe.name,
    }));
  }
  if (hasResource(sheet, "double_rig")) {
    actions.push(createDeviceAction(sheet, recipe, {
      id: `double_rig_${recipe.id}`,
      name: `Double Rig: ${recipe.name}`,
      actionType: "bonus_action",
      additionalResourceIds: ["quick_rigging", "double_rig"],
      choiceParentResourceId: "double_rig",
      choiceParentName: resourceName(sheet, "double_rig"),
      choiceParentDescription: resourceDescription(sheet, "double_rig"),
      choiceLabel: recipe.name,
      deviceRig: {
        mode: "double_first",
        immediateDamage: deviceHasImmediateDamage(recipe),
      },
    }));
    actions.push(createDeviceAction(sheet, recipe, {
      id: `double_rig_followup_${recipe.id}`,
      name: `Double Rig Follow-up: ${recipe.name}`,
      actionType: "free",
      deviceRig: {
        mode: "double_followup",
        immediateDamage: deviceHasImmediateDamage(recipe),
      },
    }));
  }
  return actions;
}

function resourceName(sheet, resourceId) {
  return (sheet.resources || []).find((resource) => resource.id === resourceId)?.name || resourceId;
}

function resourceDescription(sheet, resourceId) {
  return [...(sheet.features || [])].reverse().find((feature) =>
    (feature.effects?.resources || []).some((resource) => resource.id === resourceId)
  )?.description || "";
}

function createDeviceAction(sheet, recipe, overrides = {}) {
  const resolvedDescription = describeDeviceRecipe(recipe, sheet.proficiencyBonus);
  const action = createFeatureAction(
    {
      id: `device:${recipe.id}`,
      name: recipe.name,
      description: resolvedDescription,
      effects: {},
    },
    {
      id: `device_${recipe.id}`,
      iconId: `device_${recipe.id}`,
      name: recipe.name,
      resourceId: "prepared_devices",
      description: resolvedDescription,
      ...(recipe.action || {}),
      ...overrides,
      tags: { device: true, harmful: Boolean(recipe.action?.damage || recipe.action?.save || recipe.action?.object) },
    },
    {
      resources: sheet.resources || [],
      resolveFormula: (formula) => resolveFormula(formula, sheet),
      resolveSaveDc: (option) => resolveFeatureSaveDc(option, sheet),
    }
  );
  if (hasSafeGeometry(sheet)) action.safeGeometry = true;
  return action;
}

function hasSafeGeometry(sheet) {
  return (sheet.features || []).some((feature) =>
    (feature.effects?.narrativeTags || []).includes("safe_geometry")
  );
}

function hasResource(sheet, resourceId) {
  return (sheet.resources || []).some((resource) => resource.id === resourceId);
}

function deviceHasImmediateDamage(recipe) {
  const action = recipe?.action || {};
  return Boolean(action.damage || action.damageByTargetProperty);
}

function normalizeSpellSlots(slots) {
  return Object.fromEntries(Object.entries(slots || {}).map(([level, slot]) => [
    level,
    typeof slot === "number"
      ? { max: slot, current: slot }
      : {
          max: slot.max || slot.current || 0,
          current: slot.current ?? Math.max(0, (slot.max || 0) - (slot.used || 0)),
          used: slot.used || 0,
        },
  ]));
}

function createPassiveFeatureEffects(sheet) {
  return (sheet.features || [])
    .flatMap((feature) => [
      ...(feature.effects?.modifiers || []),
      ...(feature.grants?.modifiers || []),
    ].map((modifier) => ({
      id: modifier.id || `${feature.id}_${modifier.stat}`,
      label: feature.name,
      type: "modifier",
      trigger: "passive",
      target: modifier.target || "self",
      stat: modifier.stat,
      amount: Number.isFinite(modifier.amount) ? modifier.amount : Number(modifier.value) || 0,
      die: modifier.die || null,
      mode: modifier.mode || null,
      resourceId: modifier.resourceId || null,
      consumeOn: modifier.consumeOn || null,
      requiresMark: structuredClone(modifier.requiresMark || null),
      ability: modifier.ability || null,
      abilities: structuredClone(modifier.abilities || []),
      conditionId: modifier.conditionId || null,
      conditionIds: structuredClone(modifier.conditionIds || []),
      damageType: modifier.damageType || null,
      damageTypes: structuredClone(modifier.damageTypes || []),
      sourceFeatureId: feature.id,
    })))
    .filter((effect) => effect.stat);
}

function createLuckProfile(sheet) {
  const rerolls = (sheet.features || []).flatMap((feature) => feature.effects?.d20Rerolls || []);
  const naturalRolls = unique(rerolls.flatMap((reroll) => reroll.naturalRolls || []));
  if (!naturalRolls.length) return null;
  return { points: Number.POSITIVE_INFINITY, max: Number.POSITIVE_INFINITY, usedThisCombat: false, naturalRolls };
}

function createFeatureAuras(sheet) {
  return (sheet.features || [])
    .flatMap((feature) => (feature.effects?.auras || []).map((aura) => ({
      id: aura.id || `${feature.id}_aura`,
      name: aura.name || feature.name,
      radiusSquares: feetToSquares(aura.radiusFt ?? aura.radiusFeet ?? 0),
      affects: aura.affects || "self_and_allies",
      sourceFeatureId: feature.id,
      effects: normalizeAuraEffects(aura.effects || [], feature, sheet),
    })))
    .filter((aura) => aura.radiusSquares > 0 && aura.effects.length > 0);
}

function normalizeAuraEffects(effects, feature, sheet) {
  return (effects || [])
    .map((effect, index) => ({
      ...structuredClone(effect),
      id: effect.id || `${feature.id}_aura_effect_${index + 1}`,
      label: effect.label || feature.name,
      amount: resolveAuraAmount(effect, sheet),
      spellSaveDC: resolveAuraSaveDc(effect, sheet),
      sourceFeatureId: feature.id,
    }))
    .filter((effect) => effect.type && (effect.stat || effect.type !== "modifier"));
}

function resolveAuraSaveDc(effect, sheet) {
  if (effect.save?.dcFrom === "spellSaveDC") return sheet.spellcasting.spellSaveDc;
  if (effect.save?.dcFrom === "classSaveDC") return 8 + sheet.proficiencyBonus + classAbilityModifier(sheet);
  return effect.save?.dc ?? effect.spellSaveDC ?? null;
}

function resolveAuraAmount(effect, sheet) {
  if (Number.isFinite(effect.amount)) return effect.amount;
  if (Number.isFinite(effect.amountFt)) return feetToSignedSquares(effect.amountFt);
  if (effect.amountFormula) return Number(resolveFormula(effect.amountFormula, sheet)) || 0;
  return Number(effect.value) || 0;
}

function abbreviateAbilityMods(abilities) {
  return Object.fromEntries(Object.entries(abilities).map(([ability, entry]) => [
    ABILITY_ABBREVIATIONS[ability] || ability,
    entry?.modifier || 0,
  ]));
}

function createWeaponActions(sheet) {
  const exclusiveGroups = new Set();
  const weaponRecords = (sheet.equipment.weaponIds || [])
    .map((weaponId) => {
      const weapon = getWeaponById(weaponId) || getSpellcastingFocusById(weaponId);
      if (!weapon || weapon.canMakeWeaponAttack === false) return null;
      if (!isWeaponProficient(weapon, sheet.proficiencies.weapons || []) && weapon.spellcastingClass !== sheet.identity.classId) return null;
      if (weapon.exclusiveGroup && exclusiveGroups.has(weapon.exclusiveGroup)) return null;
      if (weapon.exclusiveGroup) exclusiveGroups.add(weapon.exclusiveGroup);
      const actionWeapon = wizardStaffIsOneHanded(sheet, weapon)
        ? { ...weapon, hands: 1, properties: (weapon.properties || []).filter((property) => property !== "two-handed") }
        : weapon;
      return createWeaponAction(actionWeapon, {
        attackBonus: weaponAttackBonus(sheet, actionWeapon),
        damageBonus: weaponDamageBonus(sheet, actionWeapon),
        enableWeaponMastery: isWeaponMastered(sheet, actionWeapon),
      });
    })
    .filter(Boolean);
  return [
    ...weaponRecords,
    ...createNickAttackActions(sheet),
  ];
}

function wizardStaffIsOneHanded(sheet, weapon) {
  if (sheet.identity.classId !== "wizard" || weapon.focusType !== "wizard_staff") return false;
  return (sheet.proficiencies.armor || []).some((entry) => ["shield", "shields"].includes(String(entry).trim().toLowerCase()));
}

function createNickAttackActions(sheet) {
  const weapons = (sheet.equipment.weaponIds || []).map((id) => getWeaponById(id) || getSpellcastingFocusById(id)).filter(Boolean);
  const nick = weapons.find((weapon) => weapon.mastery === "nick" && (weapon.properties || []).includes("light"));
  const partner = weapons.find((weapon) => weapon.id !== nick?.id && (weapon.properties || []).includes("light"));
  if (!nick || !partner || !isWeaponMastered(sheet, nick)) return [];
  const action = createNickAttackAction(nick, partner, {
    id: "nick_attack",
    attackBonusByWeapon: Object.fromEntries([nick, partner].map((weapon) => [weapon.id, weaponAttackBonus(sheet, weapon)])),
    damageBonusByWeapon: Object.fromEntries([nick, partner].map((weapon) => [weapon.id, weaponDamageBonus(sheet, weapon)])),
  });
  return action ? [action] : [];
}

function isWeaponMastered(sheet, weapon) {
  const mastered = sheet.equipment.masteredWeaponIds || [];
  return mastered.includes(weapon.id) || Boolean(weapon.masteryEquivalentId && mastered.includes(weapon.masteryEquivalentId));
}

function createSpellActions(sheet, itemBonus = { attack: 0, dc: 0 }) {
  const spellIds = unique([
    ...(sheet.spellcasting.knownSpellIds || []),
    ...(sheet.spellcasting.preparedSpellIds || []),
  ]);
  const availableSlotLevels = Object.keys(sheet.spellcasting.slots || {}).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  return spellIds
    .flatMap((spellId) => {
      const spell = getSpellRecordById(spellId);
      if (!spell) return [];
      const castingLevels = spell.level > 0
        ? availableSlotLevels.filter((level) => level >= spell.level)
        : [0];
      return castingLevels.map((slotLevel, index) => createSpellAction(spell, {
          id: index === 0 ? spell.id : `${spell.id}:level_${slotLevel}`,
          attackBonus: (sheet.spellcasting.spellAttackBonus || 0) + (itemBonus.attack || 0),
          spellSaveDC: (sheet.spellcasting.spellSaveDc || 10) + (itemBonus.dc || 0),
          spellcastingModifier: classAbilityModifier(sheet),
          casterLevel: sheet.identity.level || 1,
          slotLevel,
          usesExactSpellSlot: spell.level > 0,
        }))
        .filter(Boolean);
    })
    .filter(Boolean);
}

function equippedSpellcastingFoci(sheet) {
  const groups = new Set();
  return (sheet.equipment.weaponIds || []).map(getSpellcastingFocusById).filter((focus) => {
    if (!focus) return false;
    if (focus.exclusiveGroup && groups.has(focus.exclusiveGroup)) return false;
    if (focus.exclusiveGroup) groups.add(focus.exclusiveGroup);
    return true;
  });
}

function requiredSpellcastingFocusType(classId) {
  return ({ cleric: "holy_symbol", warlock: "warlock_gloves", wizard: "wizard_staff" })[classId] || null;
}

function createEquipmentFeatures(foci = []) {
  return foci.flatMap((focus) => focus.mechanics?.damageRider ? [{
    id: `equipment:${focus.id}`, name: focus.name,
    effects: { damageRiders: [structuredClone(focus.mechanics.damageRider)] },
  }] : []);
}

function createFocusGrantedActions(foci = []) {
  const actions = [];
  if (foci.some((focus) => focus.mechanics?.grantedAction === "restless_suffering_revivify")) actions.push({
    id: "restless_suffering_revivify", name: "Symbol of Restless Suffering: Revivify",
    description: "Return a fallen ally to life at 1 HP, then take 3d10 unavoidable necrotic damage.",
    type: "relic_revivify", cost: "action", range: 1, requiresTarget: true,
    allowDefeatedTarget: true, requiresDefeatedTarget: true, uses: { max: 1, remaining: 1, recovery: "long_rest" },
    tags: { spell: true, harmful: false, requiresHands: true },
  });
  if (foci.some((focus) => focus.mechanics?.grantedAction === "staff_of_the_adder_transform")) actions.push({
    id: "staff_of_the_adder_transform", name: "Awaken the Adder",
    description: "For one minute, the staff's attacks deal an additional 1d6 poison damage and prevent Opportunity Attacks until the start of the target's next turn.",
    type: "feature_action", actionKind: "staff_of_the_adder_transform", cost: "action", requiresTarget: false,
    resourceId: "staff_of_the_adder_transform", tags: { spell: false, harmful: false, requiresHands: true },
  });
  return actions;
}

function createEquipmentResources(foci = []) {
  return foci.flatMap((focus) => {
    const resources = [];
    if (focus.mechanics?.grantedAction === "staff_of_the_adder_transform") resources.push({
      id: "staff_of_the_adder_transform", name: "Awaken the Adder", max: 1, current: 1, recovery: "long_rest",
    });
    if (focus.mechanics?.freeSpellCastResourceId) resources.push({
      id: focus.mechanics.freeSpellCastResourceId, name: "First Covenant Free Cast", max: 1, current: 1, recovery: "long_rest",
    });
    return resources;
  });
}

function accessoryResourceId(item) {
  return `equipment:${item.id}`;
}

function createAccessoryResources(items = []) {
  return items.flatMap((item) => {
    const mechanics = item.mechanics || {};
    const max = Number(mechanics.sharedUses ?? mechanics.uses);
    if (!Number.isFinite(max) || max <= 0) return [];
    return [{
      id: accessoryResourceId(item),
      name: item.name,
      max,
      current: max,
      recovery: mechanics.consumeItemOnUse ? "none" : (mechanics.reset || "long_rest"),
    }];
  });
}

function createAccessoryActions(sheet, items = [], spellcastingItemBonus = { attack: 0, dc: 0 }) {
  return items.flatMap((item) => {
    const mechanics = item.mechanics || {};
    const resourceId = accessoryResourceId(item);
    if (mechanics.kind === "grant_basic_action") {
      if (mechanics.action === "dash") return [{ id: `${item.id}:dash`, name: `${item.name}: Dash`, type: "dash", cost: mechanics.cost === "bonus_action" ? "bonus" : "action", requiresTarget: false }];
      if (mechanics.action === "disengage") return [{ id: `${item.id}:disengage`, name: `${item.name}: Disengage`, type: "feature_action", actionKind: "disengage", cost: mechanics.cost === "bonus_action" ? "bonus" : "action", requiresTarget: false }];
    }
    if (mechanics.kind === "grant_spell") {
      const spell = getSpellRecordById(mechanics.spellId);
      const action = createSpellAction(spell, {
        id: `${item.id}:${mechanics.spellId}`,
        name: `${item.name}: ${spell?.name || mechanics.spellId}`,
        attackBonus: (sheet.spellcasting.spellAttackBonus || 0) + (spellcastingItemBonus.attack || 0),
        spellSaveDC: (sheet.spellcasting.spellSaveDc || 10) + (spellcastingItemBonus.dc || 0),
        spellcastingModifier: classAbilityModifier(sheet),
        slotLevel: spell?.level || 0,
        usesExactSpellSlot: false,
      });
      return action ? [{ ...action, resourceId, itemGrantedSpell: true }] : [];
    }
    if (mechanics.kind === "grant_spell_choice") {
      return (mechanics.spellIds || []).map((spellId) => {
        const spell = getSpellRecordById(spellId);
        const action = createSpellAction(spell, {
          id: `${item.id}:${spellId}`,
          name: `${item.name}: ${spell?.name || spellId}`,
          attackBonus: sheet.spellcasting.spellAttackBonus || 0,
          spellSaveDC: sheet.spellcasting.spellSaveDc || 10,
          spellcastingModifier: classAbilityModifier(sheet),
          slotLevel: spell?.level || 0,
          usesExactSpellSlot: false,
        });
        return action ? { ...action, resourceId, itemGrantedSpell: true, consumesEquippedItemId: mechanics.consumeItemOnUse ? item.id : null } : null;
      }).filter(Boolean);
    }
    if (mechanics.kind === "grant_active_effect") {
      return [createFeatureAction({ id: item.id, name: item.name, description: item.description }, {
        id: `${item.id}:activate`,
        name: item.name,
        actionType: mechanics.actionCost,
        resourceId,
        requiresTarget: false,
        selfCondition: {
          id: mechanics.condition,
          label: item.name,
          duration: { kind: "rounds", rounds: Math.max(1, Math.ceil((mechanics.durationSeconds || 6) / 6)), remaining: Math.max(1, Math.ceil((mechanics.durationSeconds || 6) / 6)), tick: "turn_end" },
          endsOn: structuredClone(mechanics.endsOn || []),
        },
      }, { resources: createAccessoryResources([item]) })].filter(Boolean);
    }
    return [];
  });
}

function createEquipmentActiveEffects(items = []) {
  const effects = [];
  for (const item of items) {
    const mechanics = item.mechanics || {};
    if (mechanics.kind === "conditional_ac_bonus" && mechanics.while === "dodging") effects.push({
      id: `${item.id}:dodging_ac`, label: item.name, type: "modifier", trigger: "passive", stat: "ac", amount: mechanics.amount || 0,
      condition: { actorCondition: "dodging" },
    });
    const saveAdvantages = mechanics.advantageOnSavingThrows || (mechanics.kind === "saving_throw_advantage" ? [{ condition: mechanics.when, ability: mechanics.ability }] : []);
    for (const advantage of saveAdvantages) effects.push({
      id: `${item.id}:save:${advantage.condition || advantage.ability || "all"}`, label: item.name, type: "modifier", trigger: "passive", stat: "save", mode: "advantage",
      ability: advantage.ability || null, conditionId: advantage.condition || null,
    });
    if (mechanics.kind === "roll_advantage") effects.push({
      id: `${item.id}:forced_movement_save`, label: item.name, type: "modifier", trigger: "passive", stat: "save", mode: "advantage",
      conditionIds: structuredClone(mechanics.when || []),
    });
  }
  return effects;
}

function createEquipmentMovementRules(items = []) {
  const rules = { ignoreDifficultTerrain: false, jumpDistanceMultiplier: 1, standFromProneMovementFt: null, dashMovementBonusFt: 0 };
  for (const item of items) {
    const mechanics = item.mechanics || {};
    if (mechanics.ignoreDifficultTerrain) rules.ignoreDifficultTerrain = true;
    if (Number.isFinite(mechanics.jumpDistanceMultiplier)) rules.jumpDistanceMultiplier = Math.max(rules.jumpDistanceMultiplier, mechanics.jumpDistanceMultiplier);
    if (Number.isFinite(mechanics.standFromProneMovementFt)) rules.standFromProneMovementFt = rules.standFromProneMovementFt == null ? mechanics.standFromProneMovementFt : Math.min(rules.standFromProneMovementFt, mechanics.standFromProneMovementFt);
    if (mechanics.kind === "dash_movement_bonus") rules.dashMovementBonusFt += Number(mechanics.amountFt) || 0;
  }
  return rules;
}

function createAccessoryFeatures(items = []) {
  return items.flatMap((item) => {
    const mechanics = item.mechanics || {};
    if (mechanics.kind === "triggered_movement") return [{ id: `equipment:${item.id}`, name: item.name, effects: { reactions: [{
      id: item.id, name: item.name, trigger: "missed_by_melee_attack", actionKind: "crooked_step", reactionMode: "automatic", distanceFt: mechanics.distanceFt,
    }] } }];
    if (mechanics.kind === "opportunity_attack_substitution") return [{ id: `equipment:${item.id}`, name: item.name, effects: { opportunityAttackSubstitution: structuredClone(mechanics) } }];
    return [];
  });
}

function createEquipmentTraits(items = []) {
  return {
    comprehendsAllScripts: items.some((item) => item.mechanics?.kind === "comprehend_written_language" && item.mechanics.allScripts === true),
    crookedStep: items.find((item) => item.mechanics?.kind === "triggered_movement")?.mechanics || null,
    opportunityAttackSubstitution: items.find((item) => item.mechanics?.kind === "opportunity_attack_substitution")?.mechanics || null,
    onSpellCast: items.flatMap((item) => item.mechanics?.onSpellCast ? [{ sourceItemId: item.id, sourceItemName: item.name, ...structuredClone(item.mechanics.onSpellCast) }] : []),
  };
}

function createFirstCovenantSpellActions(sheet, foci = [], itemBonus = { attack: 0, dc: 0 }) {
  const covenant = foci.find((focus) => focus.mechanics?.freeSpellCastResourceId);
  if (!covenant) return [];
  return createSpellActions(sheet, itemBonus)
    .filter((action) => action.spellLevel > 0 && action.spellLevel <= covenant.mechanics.freeSpellCastMaxLevel)
    .map((action) => ({
      ...action,
      id: `first_covenant_${action.id}`,
      name: `First Covenant: ${action.name}`,
      freeCastResourceId: covenant.mechanics.freeSpellCastResourceId,
      resourceId: covenant.mechanics.freeSpellCastResourceId,
      requiresSpeech: false,
      requiresHands: false,
      tags: { ...(action.tags || {}), requiresSpeech: false, requiresHands: false },
      ignoresComponents: { verbal: true, somatic: true, nonConsumedMaterial: true },
    }));
}

function createConsumableActions(sheet) {
  return (sheet.equipment.inventory || [])
    .map((entry) => getConsumableById(entry.id))
    .filter(Boolean)
    .map((item) => createConsumableAction(item))
    .filter(Boolean);
}

function createFeatureActions(sheet) {
  return createFeatureActionsFromFeatures(sheet.features || [], {
    resources: sheet.resources || [],
    level: sheet.identity.level,
    speciesId: sheet.identity.speciesId,
    lineageId: sheet.identity.lineageId,
    resolveFormula: (formula) => resolveFormula(formula, sheet),
    resolveSaveDc: (option) => resolveFeatureSaveDc(option, sheet),
  });
}

function weaponAttackBonus(sheet, weapon) {
  return sheet.proficiencyBonus + weaponAbilityModifier(sheet, weapon);
}

function weaponDamageBonus(sheet, weapon) {
  return weaponAbilityModifier(sheet, weapon);
}

function weaponAbilityModifier(sheet, weapon) {
  const str = sheet.abilities.strength?.modifier || 0;
  const dex = sheet.abilities.dexterity?.modifier || 0;
  if (weapon.attackAbility === "strength") return str;
  if (weapon.attackAbility === "dexterity") return dex;
  if ((weapon.properties || []).includes("finesse")) return Math.max(str, dex);
  if ((weapon.weaponType || weapon.type) === "ranged") return dex;
  return str;
}

function abbreviateSaves(saves) {
  return Object.fromEntries(Object.entries(saves).map(([ability, value]) => [
    ABILITY_ABBREVIATIONS[ability] || ability,
    value,
  ]));
}

function resolveFormula(formula, sheet) {
  return String(formula || "")
    .replace(/\blevel\b/g, String(sheet.identity.level))
    .replace(/\bstrength_modifier\b/g, String(sheet.abilities.strength?.modifier || 0))
    .replace(/\bdexterity_modifier\b/g, String(sheet.abilities.dexterity?.modifier || 0))
    .replace(/\bconstitution_modifier\b/g, String(sheet.abilities.constitution?.modifier || 0))
    .replace(/\bintelligence_modifier\b/g, String(sheet.abilities.intelligence?.modifier || 0))
    .replace(/\bwisdom_modifier\b/g, String(sheet.abilities.wisdom?.modifier || 0))
    .replace(/\bcharisma_modifier\b/g, String(sheet.abilities.charisma?.modifier || 0))
    .replace(/\bproficiency_bonus\b/g, String(sheet.proficiencyBonus || 0))
    .replace(/\s+/g, "");
}

function resolveFeatureSaveDc(option, sheet) {
  if (option.save?.dcFrom === "spellSaveDC") return sheet.spellcasting.spellSaveDc;
  if (option.save?.dcFrom === "deviceSaveDC") return sheet.devices?.saveDc;
  if (option.save?.dcFrom === "classSaveDC") return 8 + sheet.proficiencyBonus + classAbilityModifier(sheet);
  if (option.save?.dcFrom === "ability") return 8 + sheet.proficiencyBonus + abilityModifier(sheet, option.save.abilityScore);
  if (option.createsCombatObject?.collapse?.manual?.save?.dcFrom === "spellSaveDC") return sheet.spellcasting.spellSaveDc;
  return option.save?.dc || option.spellSaveDC;
}

function abilityModifier(sheet, ability) {
  return sheet.abilities[String(ability || "").toLowerCase()]?.modifier || 0;
}

function classAbilityModifier(sheet) {
  const classId = sheet.identity.classId;
  if (["warlock", "paladin"].includes(classId)) return sheet.abilities.charisma?.modifier || 0;
  if (classId === "wizard") return sheet.abilities.intelligence?.modifier || 0;
  if (classId === "cleric") return sheet.abilities.wisdom?.modifier || 0;
  return Math.max(
    sheet.abilities.strength?.modifier || 0,
    sheet.abilities.dexterity?.modifier || 0,
    sheet.abilities.constitution?.modifier || 0,
    sheet.abilities.intelligence?.modifier || 0,
    sheet.abilities.wisdom?.modifier || 0,
    sheet.abilities.charisma?.modifier || 0
  );
}

function defaultToken(sheet) {
  return String(sheet.identity.className || sheet.identity.characterName || "P").trim().charAt(0).toUpperCase() || "P";
}

function feetToSquares(feet) {
  return Math.max(0, Math.ceil((Number(feet) || 0) / 5));
}

function feetToSignedSquares(feet) {
  const value = Number(feet) || 0;
  return Math.sign(value) * Math.ceil(Math.abs(value) / 5);
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
