/**
 * arcanaResolver.js
 *
 * Engine module: Arcana roll (hidden) + spell knowledge resolution.
 *
 * This module is intentionally UI-agnostic. It exposes deterministic helpers
 * that other systems (combat, reactions, AI) can call.
 *
 * Canonical design references:
 * - app/docs/COMBAT_REACTIONS.md
 */

// -----------------------------
// Types (JSDoc)
// -----------------------------

/**
 * @typedef {Object} ActorSnapshot
 * @property {string} id
 * @property {string} name
 * @property {number} level
 * @property {Object} stats
 * @property {number} stats.intMod
 * @property {number} stats.arcanaMod   // includes INT mod + misc
 * @property {number} stats.profBonus
 * @property {boolean} stats.arcanaProficient
 */

/**
 * @typedef {Object} SpellSnapshot
 * @property {string} id
 * @property {string} name
 * @property {number} level
 * @property {string} school
 * @property {Object} hooks
 * @property {Object|null} hooks.damage // { dice: "3d6", type: "fire", addMod: false, perDart: false }
 * @property {boolean} hooks.autoHit
 * @property {Object|null} hooks.save   // { ability: "DEX", dcFrom: "casterSpellDC", onSave: "half" }
 */

/**
 * @typedef {"none"|"school"|"identity"|"full"} KnowledgeTier
 */

/**
 * @typedef {Object} KnowledgeResult
 * @property {KnowledgeTier} tier
 * @property {number} dc
 * @property {number} arcanaRoll
 * @property {number} arcanaTotal
 * @property {boolean} recognised
 * @property {{school?: string, spellId?: string, spellName?: string, level?: number}} info
 */

// -----------------------------
// Defaults / knobs
// -----------------------------

/**
 * Default tier ladder. You can tune these globally later.
 * - tier "none": arcanaTotal < dc
 * - tier "school": dc <= arcanaTotal < dc + 2
 * - tier "identity": dc + 2 <= arcanaTotal < dc + 5
 * - tier "full": arcanaTotal >= dc + 5
 */
export const DEFAULT_TIER_OFFSETS = {
  school: 0,
  identity: 2,
  full: 5
};

/**
 * Default knowledge DC function.
 * Conservative: DC = 10 + spell level
 * e.g. L0=10, L1=11, L3=13, L5=15
 */
export function defaultKnowledgeDC(spellLevel) {
  return 10 + Math.max(0, spellLevel);
}

// -----------------------------
// Arcana roll (hidden)
// -----------------------------

/**
 * Rolls a d20 using an injectable RNG for determinism in tests/replays.
 *
 * @param {Function=} rng Function returning a float in [0,1). Defaults to Math.random.
 * @returns {number} Integer 1..20
 */
export function rollD20(rng = Math.random) {
  const r = rng();
  // Clamp just in case a custom RNG returns 1.0
  const clamped = Math.max(0, Math.min(0.999999999, r));
  return 1 + Math.floor(clamped * 20);
}

/**
 * Computes the Arcana check bonus for an observer.
 * Bonus = arcanaMod + proficiency bonus (if proficient)
 *
 * @param {ActorSnapshot} observer
 * @returns {number}
 */
export function computeArcanaBonus(observer) {
  const arcanaMod = Number(observer?.stats?.arcanaMod ?? 0);
  const prof = Number(observer?.stats?.profBonus ?? 0);
  const proficient = Boolean(observer?.stats?.arcanaProficient);
  return arcanaMod + (proficient ? prof : 0);
}

/**
 * Performs a hidden Arcana check for spell identification.
 *
 * @param {ActorSnapshot} observer
 * @param {Function=} rng Function returning a float in [0,1). Defaults to Math.random.
 * @returns {{ roll: number, total: number, bonus: number }}
 */
export function rollArcanaCheck(observer, rng = Math.random) {
  const bonus = computeArcanaBonus(observer);
  const roll = rollD20(rng);
  return { roll, total: roll + bonus, bonus };
}

// -----------------------------
// Knowledge resolution
// -----------------------------

/**
 * Resolves what an observer knows about a spell being cast.
 *
 * @param {Object} args
 * @param {ActorSnapshot} args.observer
 * @param {SpellSnapshot} args.spell
 * @param {number=} args.knowledgeDC Optional override
 * @param {typeof DEFAULT_TIER_OFFSETS=} args.tierOffsets Optional override
 * @returns {KnowledgeResult}
 */
export function resolveSpellKnowledge({
  observer,
  spell,
  knowledgeDC = null,
  tierOffsets = DEFAULT_TIER_OFFSETS
}) {
  if (!observer) throw new Error("resolveSpellKnowledge: missing observer");
  if (!spell) throw new Error("resolveSpellKnowledge: missing spell");

  const { roll: arcanaRoll, total: arcanaTotal } = rollArcanaCheck(observer);
  const dc = Number.isFinite(knowledgeDC) ? knowledgeDC : defaultKnowledgeDC(spell.level);

  /** @type {KnowledgeTier} */
  let tier = "none";

  if (arcanaTotal >= dc + (tierOffsets.full ?? 5)) tier = "full";
  else if (arcanaTotal >= dc + (tierOffsets.identity ?? 2)) tier = "identity";
  else if (arcanaTotal >= dc + (tierOffsets.school ?? 0)) tier = "school";

  const recognised = tier === "identity" || tier === "full";

  /** @type {KnowledgeResult["info"]} */
  const info = {};
  if (tier === "school" || tier === "identity" || tier === "full") {
    info.school = spell.school;
  }
  if (tier === "identity" || tier === "full") {
    info.spellId = spell.id;
    info.spellName = spell.name;
    info.level = spell.level;
  }
  if (tier === "full") {
    // We intentionally keep this minimal for now.
    // Future: include range/area/conditions if needed for AI.
    info.level = spell.level;
  }

  return { tier, dc, arcanaRoll, arcanaTotal, recognised, info };
}

// -----------------------------
// Utility: expected damage (for impact gating)
// -----------------------------

/**
 * Very small dice parser for common spell damage strings.
 * Supports:
 * - "XdY" (e.g. 3d6)
 * - "XdY+N" or "XdY-N" (e.g. 1d4+1)
 * - "N" (flat number)
 *
 * Returns average expected value.
 *
 * @param {string} dice
 * @returns {number}
 */
export function averageFromDiceString(dice) {
  if (!dice || typeof dice !== "string") return 0;
  const s = dice.trim();

  // Flat number
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);

  const m = s.match(/^\s*(\d+)\s*d\s*(\d+)\s*([+-]\s*\d+)?\s*$/i);
  if (!m) return 0;

  const count = Number(m[1]);
  const sides = Number(m[2]);
  const mod = m[3] ? Number(m[3].replace(/\s+/g, "")) : 0;

  // Average die = (1+sides)/2
  const avgDie = (1 + sides) / 2;
  return (count * avgDie) + mod;
}

/**
 * Computes an "average expected damage" for a spell.
 *
 * Design intent:
 * - Used only for Counterspell Impact Gate.
 * - Consistency beats precision.
 *
 * Current rule:
 * - If spell auto-hits (e.g. Magic Missile), return full average.
 * - If spell uses a save and onSave is "half", assume half of full average.
 * - Otherwise assume full average.
 *
 * NOTE: This is deliberately conservative and can be tuned later.
 *
 * @param {SpellSnapshot} spell
 * @returns {number}
 */
export function estimateAverageSpellDamage(spell) {
  const dmg = spell?.hooks?.damage;
  if (!dmg?.dice) return 0;

  let avg = averageFromDiceString(dmg.dice);

  // Magic Missile style (perDart) uses same dice per dart; elsewhere engine applies darts.
  // Here we rely on spell.hooks.darts if present.
  if (dmg.perDart && Number.isFinite(spell?.hooks?.darts)) {
    avg = avg * Number(spell.hooks.darts);
  }

  const autoHit = Boolean(spell?.hooks?.autoHit);
  if (autoHit) return avg;

  const save = spell?.hooks?.save;
  if (save && save.onSave === "half") {
    // Simple expected value heuristic.
    return avg * 0.5;
  }

  return avg;
}

/**
 * Converts expected damage into a % of current HP.
 * Returns 0 if hpMax is 0.
 *
 * @param {number} expectedDamage
 * @param {number} hpCurrent
 * @returns {number} Percentage in range 0..Infinity
 */
export function expectedDamageAsPercentOfCurrentHP(expectedDamage, hpCurrent) {
  const hp = Math.max(0, Number(hpCurrent ?? 0));
  if (hp <= 0) return Infinity; // if you're at 0, anything is "100%+" meaningful.
  return (Math.max(0, expectedDamage) / hp) * 100;
}

// -----------------------------
// Convenience wrapper
// -----------------------------

/**
 * One-stop helper for Counterspell logic to obtain:
 * - knowledge tier + info
 * - expected damage heuristic
 *
 * @param {Object} args
 * @param {ActorSnapshot} args.observer
 * @param {SpellSnapshot} args.spell
 * @param {number=} args.hpCurrent
 * @param {number=} args.knowledgeDC
 * @returns {{ knowledge: KnowledgeResult, expectedDamage: number, expectedDamagePctOfCurrentHP: number }}
 */
export function buildCounterspellContext({ observer, spell, hpCurrent = 0, knowledgeDC = null }) {
  const knowledge = resolveSpellKnowledge({ observer, spell, knowledgeDC });
  const expectedDamage = estimateAverageSpellDamage(spell);
  const expectedDamagePctOfCurrentHP = expectedDamageAsPercentOfCurrentHP(expectedDamage, hpCurrent);
  return { knowledge, expectedDamage, expectedDamagePctOfCurrentHP };
}