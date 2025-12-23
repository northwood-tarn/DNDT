// systems/senses.js
//
// Centralised helpers for "can X perceive Y?"
// These are intentionally kept pure and do not touch global state.
// Callers are expected to pass in any needed context (visibility level, etc.)
//
// Conventions:
// - `actor` objects may have:
//    - `passivePerception`  (number)
//    - `skills.Perception`  (number, used to derive passivePerception if absent)
//    - `senses` object with booleans:
//        - `detectMagic`
//        - `divineSense`
//        - `seeInvisible`
// - `tile` objects may have:
//    - `revealed` (bool)          – e.g. map already uncovered / always visible
//    - `visible`  (bool)          – current frame visibility (e.g. from fog system)
//    - `type`     (string)        – e.g. "HIDDEN_TRAP"
//    - `difficulty` (number)      – perception DC to notice
//    - `magicAura` (bool)
//    - `hiddenType` (string)      – e.g. "undead"
//    - `invisible` (bool)
//
// The optional `options` parameter lets systems pass in extra context such as
// environmental visibility or whether to ignore "revealed" tiles.

/**
 * Compute an actor's passive Perception score.
 * Falls back to 10 + Perception skill if `passivePerception` is not set.
 * @param {object} actor
 * @returns {number}
 */
function getPassivePerception(actor) {
  if (!actor) return 10;
  if (typeof actor.passivePerception === "number") return actor.passivePerception;

  const skills = actor.skills || {};
  const perceptionBonus = typeof skills.Perception === "number" ? skills.Perception : 0;
  return 10 + perceptionBonus;
}

/**
 * Check if an actor can perceive a tile or object based on senses,
 * passive perception, and simple tile flags.
 *
 * @param {object} tile
 * @param {object} actor
 * @param {object} [options]
 * @param {"bright"|"dim"|"dark"|"obscured"} [options.visibilityLevel]
 * @param {boolean} [options.ignoreRevealed=false]  If true, do not auto‑show revealed tiles.
 * @returns {boolean}
 */
export function isTileVisibleTo(tile, actor, options = {}) {
  if (!tile || !actor) return false;

  const { visibilityLevel, ignoreRevealed = false } = options;
  const senses = actor.senses || {};

  // 1. Automatically visible tiles (unless explicitly ignored)
  if (!ignoreRevealed && (tile.revealed || tile.visible === true)) {
    return true;
  }

  // 2. Invisibility gate: if the tile is explicitly invisible, only specialised senses see it.
  if (tile.invisible && !senses.seeInvisible) {
    // Magic detection can still reveal the presence of something unusual.
    if (tile.magicAura && senses.detectMagic) return true;
    if (tile.hiddenType === "undead" && senses.divineSense) return true;
    return false;
  }

  // 3. Magical / special senses
  if (tile.magicAura && senses.detectMagic) return true;
  if (tile.hiddenType === "undead" && senses.divineSense) return true;

  // 4. Simple passive Perception vs difficulty for hidden features (e.g. traps)
  if (tile.type === "HIDDEN_TRAP" || tile.hidden === true) {
    const passive = getPassivePerception(actor);
    const difficulty = typeof tile.difficulty === "number" ? tile.difficulty : 13;
    if (passive >= difficulty) return true;
  }

  // 5. Environmental visibility gate (optional, conservative):
  //    In full darkness or heavily obscured areas, you generally can't see
  //    non‑revealed tiles unless the caller already marked them visible.
  if (visibilityLevel === "dark" || visibilityLevel === "obscured") {
    // At this layer we don't model darkvision/light radius; that should be
    // handled by the lighting / visibility system before it sets tile.visible.
    return false;
  }

  // If none of the above made it visible, it is not considered visible here.
  return false;
}

/**
 * Check if an observer can perceive a target actor.
 *
 * This handles basic invisibility and see‑invisible sense, plus optional
 * stealth vs passive perception checks if the caller provides a `stealthDC`.
 *
 * @param {object} target
 * @param {object} observer
 * @param {object} [options]
 * @param {number} [options.stealthDC]  Difficulty to notice a hidden/stealthed target.
 * @param {"bright"|"dim"|"dark"|"obscured"} [options.visibilityLevel]
 * @returns {boolean}
 */
export function isActorVisibleTo(target, observer, options = {}) {
  if (!target || !observer) return false;

  const { stealthDC, visibilityLevel } = options;
  const senses = observer.senses || {};

  // 1. Invisibility handling
  if (target.invisible) {
    if (senses.seeInvisible) {
      // Observer can pierce invisibility.
    } else {
      return false;
    }
  }

  // 2. Environmental visibility (conservative gate).
  if (visibilityLevel === "dark" || visibilityLevel === "obscured") {
    // Again, detailed light/darkvision logic should already have been applied
    // by the lighting/visibility system; from here we take a simple stance.
    return false;
  }

  // 3. Stealth vs passive Perception, if applicable.
  if (typeof stealthDC === "number") {
    const passive = getPassivePerception(observer);
    if (passive < stealthDC) {
      return false;
    }
  }

  // If none of the checks blocked visibility, consider the target visible.
  return true;
}
