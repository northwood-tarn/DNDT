import { enemies, getEnemyStats } from "../data/enemies.js";
import { expandEncounterEnemyRefs, getEncounterById } from "../data/encounters.js";
import { weapons } from "../data/weapons.js";
import { createNaturalWeaponAction, createWeaponAction, indexRecordsById } from "./actionFactory.js";
import { createFeatureActionsFromFeatures } from "./featureActionFactory.js";

const WEAPONS = indexRecordsById(weapons);

export function createEnemyCombatActor(enemyRef, options = {}) {
  const source = resolveEnemySource(enemyRef);
  if (!source) return null;

  const instanceId = options.id || source.id;
  const actionSource = {
    ...source,
    enableWeaponMastery: options.enableWeaponMastery ?? source.enableWeaponMastery,
    masteredWeaponIds: options.masteredWeaponIds || source.masteredWeaponIds,
  };
  const action = createEnemyAttackAction(actionSource, options);
  const resources = structuredClone(options.resources || source.resources || []);
  const features = structuredClone(options.features || source.features || []);

  return {
    id: instanceId,
    sourceId: source.id,
    name: options.name || source.name,
    team: "enemies",
    role: options.role || source.role,
    creatureType: source.creatureType,
    undeadRank: source.undeadRank || null,
    tags: unique([
      source.creatureType,
      source.undeadRank ? `undead:${source.undeadRank}` : null,
      ...(source.tags || []),
      ...(options.tags || []),
    ]),
    size: source.size,
    token: options.token || defaultEnemyToken(source),
    hp: options.hp ?? source.hp,
    maxHp: options.maxHp ?? source.maxHp,
    ac: options.ac ?? source.ac,
    initiativeBonus: options.initiativeBonus ?? source.saves?.dex ?? 0,
    speed: options.speed ?? source.speed,
    position: options.position || { x: 0, y: 0 },
    saves: { ...(source.saves || {}), ...(options.saves || {}) },
    abilityMods: structuredClone({ ...(source.abilityMods || {}), ...(options.abilityMods || {}) }),
    ai: {
      profile: options.aiProfile || source.aiProfile,
      targetPriority: options.targetPriority || "nearest",
    },
    awareness: structuredClone(source.awareness || {}),
    resistances: unique([...(source.resistances || []), ...(options.resistances || [])]),
    immunities: unique([...(source.immunities || []), ...(options.immunities || [])]),
    conditionImmunities: unique([...(source.conditionImmunities || []), ...(options.conditionImmunities || [])]),
    resources,
    features,
    featureHooks: structuredClone(options.featureHooks || source.featureHooks || []),
    activeEffects: structuredClone(options.activeEffects || source.activeEffects || []),
    auras: structuredClone(options.auras || source.auras || []),
    marks: structuredClone(options.marks || source.marks || []),
    equipment: createEnemyEquipment(source, options),
    xpValue: source.xpValue,
    loot: structuredClone(source.loot || {}),
    actions: [
      action,
      ...createFeatureActionsFromFeatures(features, {
        resources,
        resolveFormula: (formula) => resolveEnemyFormula(formula, source, options),
        resolveSaveDc: (option) => option.save?.dc || option.spellSaveDC || source.saveDC || null,
      }),
    ].filter(Boolean),
  };
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function createEnemyCombatActors(enemyRefs = [], options = {}) {
  return enemyRefs.map((enemyRef, index) => {
    const enemyId = typeof enemyRef === "string" ? enemyRef : enemyRef?.enemyId || enemyRef?.id;
    const instanceOptions = typeof enemyRef === "object" && enemyRef ? { ...enemyRef } : {};
    delete instanceOptions.enemyId;
    return createEnemyCombatActor(enemyRef, {
      id: `${enemyId || "enemy"}_${index + 1}`,
      ...(options.defaults || {}),
      ...instanceOptions,
      ...(Array.isArray(options.instances) ? options.instances[index] : {}),
    });
  }).filter(Boolean);
}

export function createEncounterEnemyActors(encounterId, options = {}) {
  const encounter = getEncounterById(encounterId);
  if (!encounter) return [];
  return createEnemyCombatActors(expandEncounterEnemyRefs(encounter), options);
}

export function getEnemySourceRecords() {
  return Object.values(enemies);
}

function resolveEnemySource(enemyRef) {
  if (typeof enemyRef === "string") return getEnemyStats(enemyRef);
  if (enemyRef?.enemyId && getEnemyStats(enemyRef.enemyId)) {
    const { enemyId, id, name, position, ...sourceOverrides } = enemyRef;
    return { ...getEnemyStats(enemyId), ...sourceOverrides };
  }
  if (enemyRef?.id && getEnemyStats(enemyRef.id)) return { ...getEnemyStats(enemyRef.id), ...enemyRef };
  return enemyRef || null;
}

function createEnemyAttackAction(source, options) {
  if (source.weaponId) {
    const weapon = WEAPONS[source.weaponId];
    if (!weapon) return null;
    return createWeaponAction(weapon, {
      id: options.actionId || source.weaponId,
      name: options.actionName || weapon.name,
      attackBonus: options.attackBonus ?? source.attackBonus,
      damage: options.damage || source.damage,
      damageType: options.damageType || source.damageType,
      enableWeaponMastery: isEnemyWeaponMastered(source, weapon.id),
    });
  }

  if (source.naturalAttack) {
    return createNaturalWeaponAction(source.naturalAttack, {
      id: options.actionId,
      name: options.actionName,
      range: options.range,
      attackBonus: options.attackBonus ?? source.attackBonus,
      damage: options.damage,
      damageType: options.damageType,
    });
  }

  return null;
}

function isEnemyWeaponMastered(source, weaponId) {
  if (source.enableWeaponMastery === true) return true;
  return Array.isArray(source.masteredWeaponIds) && source.masteredWeaponIds.includes(weaponId);
}

function defaultEnemyToken(source) {
  return String(source.name || source.id || "E").slice(0, 1).toUpperCase();
}

function createEnemyEquipment(source, options) {
  const weaponIds = source.weaponId ? [source.weaponId] : [];
  return {
    weaponIds,
    masteredWeaponIds: [
      ...(source.enableWeaponMastery === true ? weaponIds : []),
      ...(source.masteredWeaponIds || []),
      ...(options.masteredWeaponIds || []),
    ].filter(Boolean),
    naturalAttackIds: source.naturalAttack?.id ? [source.naturalAttack.id] : [],
  };
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
