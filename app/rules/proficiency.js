// app/rules/proficiency.js
// Single source of truth for Proficiency Bonus (PB) by character level.
// Keep this file code-light and dependency-free so any module can import it.

/**
 * Returns the proficiency bonus for the given character level (1–20).
 * 2024 table: +2 at 1–4, +3 at 5–8, +4 at 9–12, +5 at 13–16, +6 at 17–20.
 * @param {number} level
 * @returns {number} proficiency bonus
 */
export function proficiencyForLevel(level = 1) {
  if (level >= 17) return 6;
  if (level >= 13) return 5;
  if (level >= 9)  return 4;
  if (level >= 5)  return 3;
  return 2;
}

/**
 * Utility that returns the next level at which PB increases.
 * @param {number} level current level
 * @returns {number|null} next threshold level, or null if none
 */
export function nextPBThreshold(level = 1) {
  if (level < 5)  return 5;
  if (level < 9)  return 9;
  if (level < 13) return 13;
  if (level < 17) return 17;
  return null;
}

/**
 * Convenience: returns an object with the current PB and next threshold.
 * @param {number} level
 * @returns {{pb:number, next:null|number}}
 */
export function proficiencyInfo(level = 1) {
  return { pb: proficiencyForLevel(level), next: nextPBThreshold(level) };
}
