import { distance } from "./grid.js";
import { livingActors } from "./combatState.js";

export function resolveCompoundWeaponAttack(snapshot, actor, target, action, dice, log, { resolveAttack }) {
  if (!Array.isArray(action.attacks) || !action.attacks.length) return false;
  for (const attack of action.attacks) {
    if (target.hp <= 0) break;
    resolveAttack(snapshot, actor, target, attack, dice, log);
  }
  log.add("compound.attack", {
    round: snapshot.round,
    actorId: actor.id,
    actorName: actor.name,
    targetId: target.id,
    targetName: target.name,
    actionName: action.name,
    attacks: action.attacks.length,
  });
  return true;
}

export function findCleaveTarget(snapshot, actor, originalTarget) {
  return livingActors(snapshot)
    .filter((candidate) => candidate.team !== actor.team)
    .filter((candidate) => candidate.id !== originalTarget.id)
    .filter((candidate) => distance(candidate.position, originalTarget.position) <= 1)
    .sort((a, b) => {
      const actorDistance = distance(actor.position, a.position) - distance(actor.position, b.position);
      return actorDistance || a.id.localeCompare(b.id);
    })[0] || null;
}

export function createCleaveSecondaryAttack(action) {
  return {
    ...structuredClone(action),
    id: `${action.id}_cleave`,
    name: `${action.name} Cleave`,
    damage: removeFlatDamageBonus(action.damage),
    weaponMastery: null,
    weaponMasteryName: null,
    weaponMasteryImplementation: null,
    cleaveSecondary: true,
    effects: [],
    damageRiders: [],
    tags: {
      ...(action.tags || {}),
      mastery_cleave: false,
    },
  };
}

function removeFlatDamageBonus(damage) {
  return String(damage || "").replace(/[+-]\d+$/, "");
}
