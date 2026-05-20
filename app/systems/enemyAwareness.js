// app/systems/enemyAwareness.js
// Centralised enemy awareness + combat initiation logic

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

  console.warn("[combat] Legacy combat framework has been removed; new combat snapshot/resolver is pending.", {
    encounterId,
    returnAreaId: areaId,
    awareEnemies,
  });
  return false;
}

// --- Factory (used by explorationSystem) ---
// Provides a small adapter around the pure helpers above.
// Keeps call-sites stable even if awareness internals evolve.
export function createEnemyAwarenessSystem(options = {}) {
  const {
    // Optional hooks for pulling current world state
    getPlayerState,
    getEnemies,
    getLights,
    getCollisions,
    getAreaId,

    // Optional override: how to start combat
    startCombatFn,
  } = options;

  function _startCombat(awareEnemies, areaId) {
    if (typeof startCombatFn === "function") {
      return startCombatFn(awareEnemies, areaId);
    }
    return maybeStartCombat(awareEnemies, areaId);
  }

  // One-step evaluation helper.
  function tick(ctx = {}) {
    const playerState = ctx.playerState ?? (typeof getPlayerState === "function" ? getPlayerState() : null);
    const enemies = ctx.enemies ?? (typeof getEnemies === "function" ? getEnemies() : []);
    const lights = ctx.lights ?? (typeof getLights === "function" ? getLights() : null);
    const collisions = ctx.collisions ?? (typeof getCollisions === "function" ? getCollisions() : null);
    const areaId = ctx.areaId ?? (typeof getAreaId === "function" ? getAreaId() : null);

    if (!playerState || !enemies) return { started: false, awareEnemies: [] };

    const awareEnemies = checkEnemyAwareness(playerState, enemies, lights, collisions);
    const started = _startCombat(awareEnemies, areaId);

    return { started, awareEnemies };
  }

  return {
    tick,
    checkEnemyAwareness,
    maybeStartCombat: _startCombat,
  };
}
