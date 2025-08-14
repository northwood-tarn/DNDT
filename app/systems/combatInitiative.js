// systems/combatInitiative.js

import { getEnemyStats } from "../data/enemies.js";  // assumes this exists

export function rollInitiative(state) {
  const playerInit = {
    id: "player",
    type: "player",
    x: state.combat.player.x,
    y: state.combat.player.y,
    initiative: Math.floor(Math.random() * 20) + 1 + (state.player.dex || 0)
  };

  const enemyInits = state.combat.enemies.map((enemy, index) => {
    const stats = getEnemyStats(enemy.id);
    return {
      id: `${enemy.id}_${index}`,
      type: "enemy",
      enemyId: enemy.id,
      x: enemy.x,
      y: enemy.y,
      initiative: Math.floor(Math.random() * 20) + 1 + (stats.dex || 0)
    };
  });

  const fullOrder = [playerInit, ...enemyInits].sort((a, b) => b.initiative - a.initiative);

  state.combat.turnOrder = fullOrder;
  state.combat.turnIndex = 0;
}

export function getCurrentCombatant(state) {
  return state.combat.turnOrder[state.combat.turnIndex];
}

export function nextTurn(state) {
  state.combat.turnIndex = (state.combat.turnIndex + 1) % state.combat.turnOrder.length;
}
