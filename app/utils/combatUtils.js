/**
 * Returns true if the actor has armor equipped.
 */
export function isWearingArmor(actor) {
  return actor?.equipped?.armor != null;
}

/**
 * Returns true if the equipped weapon has the "two-handed" property.
 */
export function isUsingTwoHandedWeapon(actor) {
  const weapon = actor?.equipped?.weapon;
  return weapon?.properties?.includes("two-handed");
}

/**
 * Returns true if the actor is wielding a one-handed weapon and nothing in the offhand.
 */
export function isDueling(actor) {
  const weapon = actor?.equipped?.weapon;
  const offhand = actor?.equipped?.offhand;

  const isOneHanded = weapon?.properties?.includes("one-handed") || weapon?.properties?.includes("versatile");
  return isOneHanded && !offhand;
}

/**
 * Optional: Get Fighter style bonus depending on style name and attack type
 * - "Defense" → +1 AC
 * - "Great Weapon Fighting" → reroll 1s/2s (handled elsewhere, not here)
 * - "Dueling" → +2 to damage
 */
export function getFighterStyleBonus(actor, style) {
  if (!style) return 0;

  switch (style) {
    case "Defense":
      return isWearingArmor(actor) ? 1 : 0;
    case "Dueling":
      return isDueling(actor) ? 2 : 0;
    default:
      return 0;
  }
}
