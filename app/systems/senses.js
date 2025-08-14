// systems/senses.js

// Check if an actor can perceive a tile or object based on senses and passive perception
export function isTileVisibleTo(tile, actor) {
  if (!tile || !actor) return false;

  // Automatically visible tiles
  if (tile.revealed || tile.visible === true) return true;

  // Passive Perception check for hidden traps, etc.
  if (tile.type === "HIDDEN_TRAP") {
    const passive = actor.passivePerception || 10;
    const difficulty = tile.difficulty || 13;
    if (passive >= difficulty) return true;
  }

  // Magical detection
  if (tile.magicAura && actor.senses?.detectMagic) return true;
  if (tile.hiddenType === "undead" && actor.senses?.divineSense) return true;
  if (tile.invisible && actor.senses?.seeInvisible) return true;

  return false;
}

// Check if actor can see another actor (for targeting, hiding, etc.)
export function isActorVisibleTo(target, observer) {
  if (!target || !observer) return false;
  if (!target.invisible) return true;
  return observer.senses?.seeInvisible === true;
}
