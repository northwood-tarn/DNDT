// state/combatState.js

export const combatState = {
  turnOrder: [],
  turnIndex: 0,
  currentActor: null,
  active: false,
};

export function startCombat(actors) {
  combatState.turnOrder = [...actors];
  combatState.turnIndex = 0;
  combatState.currentActor = combatState.turnOrder[0];
  combatState.active = true;
}

export function nextTurn() {
  combatState.turnIndex = (combatState.turnIndex + 1) % combatState.turnOrder.length;
  combatState.currentActor = combatState.turnOrder[combatState.turnIndex];
}
