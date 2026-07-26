import { enemies, getEnemyStats } from "../data/enemies.js";
import { expandEncounterEnemyRefs, getEncounterById } from "../data/encounters.js";
import { compileEnemyActions } from "./enemyActionCompiler.js";
import { combatActorToActorInstance, enemySourceToActorDefinition } from "../actors/actorAdapters.js";
import { ensureLegendaryResistanceResource } from "./legendaryResistance.js";

export function createEnemyCombatActor(enemyRef, options = {}) {
  const source = resolveEnemySource(enemyRef);
  if (!source) return null;

  const definition = enemySourceToActorDefinition(source);

  const instanceId = options.id || source.id;
  const actionSource = {
    ...source,
    enableWeaponMastery: options.enableWeaponMastery ?? source.enableWeaponMastery,
    masteredWeaponIds: options.masteredWeaponIds || source.masteredWeaponIds,
  };
  const resources = ensureLegendaryResistanceResource(options.resources || source.resources || [], { ...source, ...options });
  const features = structuredClone(options.features || source.features || []);

  const actor = {
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
    actions: compileEnemyActions(actionSource, { ...options, resources, features }).filter(Boolean),
  };
  const instance = combatActorToActorInstance(actor, definition.id);
  actor.actorContract = {
    definitionVersion: definition.schemaVersion,
    instanceVersion: instance.schemaVersion,
    definitionId: definition.id,
  };
  return actor;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function createEnemyCombatActors(enemyRefs = [], options = {}) {
  return enemyRefs.map((enemyRef, index) => {
    const enemyId = String(typeof enemyRef === "string" ? enemyRef : enemyRef?.actorDefinitionId || enemyRef?.enemyId || enemyRef?.id || "enemy").replace(/^enemy\./, "");
    const instanceOptions = typeof enemyRef === "object" && enemyRef ? { ...enemyRef } : {};
    delete instanceOptions.enemyId;
    delete instanceOptions.actorDefinitionId;
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

export function getEnemyActorDefinitions() {
  return Object.values(enemies).map(enemySourceToActorDefinition);
}

export function getEnemyActorDefinition(enemyId) {
  const source = getEnemyStats(String(enemyId || "").replace(/^enemy\./, ""));
  return source ? enemySourceToActorDefinition(source) : null;
}

function resolveEnemySource(enemyRef) {
  if (typeof enemyRef === "string") return getEnemyStats(enemyRef.replace(/^enemy\./, ""));
  if (enemyRef?.actorDefinitionId) {
    const enemyId = String(enemyRef.actorDefinitionId).replace(/^enemy\./, "");
    const { actorDefinitionId, enemyId: legacyEnemyId, id, name, position, ...sourceOverrides } = enemyRef;
    const source = getEnemyStats(enemyId);
    return source ? { ...source, ...sourceOverrides } : null;
  }
  if (enemyRef?.enemyId && getEnemyStats(enemyRef.enemyId)) {
    const { enemyId, id, name, position, ...sourceOverrides } = enemyRef;
    return { ...getEnemyStats(enemyId), ...sourceOverrides };
  }
  if (enemyRef?.id && getEnemyStats(enemyRef.id)) return { ...getEnemyStats(enemyRef.id), ...enemyRef };
  return enemyRef || null;
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
