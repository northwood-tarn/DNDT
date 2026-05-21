import { enemies, getEnemyStats } from "../data/enemies.js";
import { expandEncounterEnemyIds, getEncounterById } from "../data/encounters.js";
import { weapons } from "../data/weapons.js";
import { createWeaponAction, indexRecordsById } from "./actionFactory.js";

const WEAPONS = indexRecordsById(weapons);

export function createEnemyCombatActor(enemyRef, options = {}) {
  const source = resolveEnemySource(enemyRef);
  if (!source) return null;

  const instanceId = options.id || source.id;
  const action = createEnemyAttackAction(source, options);

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
    ai: {
      profile: options.aiProfile || source.aiProfile,
      targetPriority: options.targetPriority || "nearest",
    },
    awareness: structuredClone(source.awareness || {}),
    xpValue: source.xpValue,
    loot: structuredClone(source.loot || {}),
    actions: [action].filter(Boolean),
  };
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function createEnemyCombatActors(enemyRefs = [], options = {}) {
  return enemyRefs.map((enemyRef, index) => {
    const id = typeof enemyRef === "string" ? enemyRef : enemyRef?.id;
    return createEnemyCombatActor(enemyRef, {
      id: `${id || "enemy"}_${index + 1}`,
      ...(options.defaults || {}),
      ...(Array.isArray(options.instances) ? options.instances[index] : {}),
    });
  }).filter(Boolean);
}

export function createEncounterEnemyActors(encounterId, options = {}) {
  const encounter = getEncounterById(encounterId);
  if (!encounter) return [];
  return createEnemyCombatActors(expandEncounterEnemyIds(encounter), options);
}

export function getEnemySourceRecords() {
  return Object.values(enemies);
}

function resolveEnemySource(enemyRef) {
  if (typeof enemyRef === "string") return getEnemyStats(enemyRef);
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
    });
  }

  if (source.naturalAttack) {
    return {
      id: options.actionId || source.naturalAttack.id,
      name: options.actionName || source.naturalAttack.name,
      type: "weapon_attack",
      cost: "action",
      range: options.range ?? 1,
      attackBonus: options.attackBonus ?? source.attackBonus,
      damage: options.damage || source.naturalAttack.damage,
      damageType: options.damageType || source.naturalAttack.damageType,
      tags: {
        weapon: false,
        natural: true,
        melee: true,
        ranged: false,
        attackRoll: true,
        harmful: true,
      },
    };
  }

  return null;
}

function defaultEnemyToken(source) {
  return String(source.name || source.id || "E").slice(0, 1).toUpperCase();
}
