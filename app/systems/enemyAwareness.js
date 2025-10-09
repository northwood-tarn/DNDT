// app/systems/enemyAwareness.js
// Centralised enemy awareness + combat initiation logic

import { startCombat } from "../systems/combatRunner.js";

// --- Awareness checks ---
export function checkEnemyAwareness(playerState, enemies, lights, collisions){
  const awareEnemies = [];
  const swarmCounters = {};

  for (const enemy of enemies){
    const { vision = "light_bound", visionRange = 10, hostility = "onsight", swarmGroup } = enemy;

    // TODO: implement LOS properly with collisions; for now assume distance only
    const dx = enemy.x - playerState.x;
    const dy = enemy.y - playerState.y;
    const dist = Math.sqrt(dx*dx + dy*dy);

    let canSee = false;
    if (vision === "darkvision" && dist <= 60) canSee = true;
    else if (vision === "lantern" && dist <= visionRange) canSee = true;
    else if (vision === "light_bound" && dist <= visionRange) canSee = true;
    else if (vision === "dark_abhorrent" && dist <= visionRange) canSee = true;

    if (!canSee) continue;

    if (hostility === "onsight"){
      awareEnemies.push(enemy);
    } else if (hostility === "territorial"){
      // territory polygon check TODO
      awareEnemies.push(enemy);
    } else if (hostility === "swarm"){
      if (!swarmCounters[swarmGroup]) swarmCounters[swarmGroup] = [];
      swarmCounters[swarmGroup].push(enemy);
    }
  }

  // Swarm check
  for (const g in swarmCounters){
    if (swarmCounters[g].length >= 5){
      awareEnemies.push(...swarmCounters[g]);
    }
  }

  return awareEnemies;
}

// --- Combat start ---
export function maybeStartCombat(awareEnemies, areaId){
  if (!awareEnemies || awareEnemies.length === 0) return false;

  // Pick encounter ID based on areaId (stub for now)
  const encounterId = areaId + "_ambush";

  startCombat(encounterId, { returnAreaId: areaId });
  return true;
}
