// app/engine/spellSlots.js
// Centralized spell slot + per-day feature charge utilities.
// Pure functions on top of state.player. Keep scenes/engines simple.

import { classes } from "../data/classes.js";

export function computeSlotsForClassLevel(className, level) {
  const cls = classes[className];
  if (!cls) return {};
  const table = cls.slotsByLevel || {};
  const row = table[level] || {};
  // Normalize to explicit levels 1..9 for consistency
  const result = {};
  for (let L = 1; L <= 9; L++) {
    if (row[L]) result[L] = { max: row[L], used: 0 };
  }
  return result;
}

export function initSlotsFor(actor) {
  if (!actor || !actor.class || !actor.level) return;
  actor.spellSlots = computeSlotsForClassLevel(actor.class, actor.level);
}

export function getSlots(level, actor) {
  const slots = (actor?.spellSlots && actor.spellSlots[level]) || { max: 0, used: 0 };
  return { max: slots.max || 0, used: slots.used || 0 };
}

export function hasSlot(level, actor) {
  const s = getSlots(level, actor);
  return s.used < s.max;
}

export function spendSlot(level, actor) {
  if (!actor.spellSlots) actor.spellSlots = {};
  const s = actor.spellSlots[level] || { max: 0, used: 0 };
  if ((s.used || 0) >= (s.max || 0)) return false;
  s.used = (s.used || 0) + 1;
  actor.spellSlots[level] = s;
  return true;
}

export function restoreAllSlots(actor) {
  if (!actor?.spellSlots) return;
  for (const L of Object.keys(actor.spellSlots)) {
    actor.spellSlots[L].used = 0;
  }
}

// Recompute max from class table after level up and clamp used
export function applyLevelUpSlots(actor) {
  if (!actor?.class || !actor.level) return;
  const newMax = computeSlotsForClassLevel(actor.class, actor.level);
  const current = actor.spellSlots || {};
  const merged = {};
  for (let L = 1; L <= 9; L++) {
    const row = newMax[L] || { max: 0, used: 0 };
    const used = Math.min((current[L]?.used || 0), (row.max || 0));
    if (row.max) merged[L] = { max: row.max, used };
  }
  actor.spellSlots = merged;
}

// ---- Per-day feat charges (e.g., Magic Initiate) ----
// We expect actor.spells.perDay[spellId] = { perDay: 1, used: 0, refresh: 'long_rest' }

export function hasPerDayCharge(actor, spellId) {
  const rec = actor?.spells?.perDay?.[spellId];
  if (!rec) return false;
  return (rec.used || 0) < (rec.perDay || 0);
}

export function spendPerDayCharge(actor, spellId) {
  if (!hasPerDayCharge(actor, spellId)) return false;
  actor.spells.perDay[spellId].used = (actor.spells.perDay[spellId].used || 0) + 1;
  return true;
}

export function restorePerDayCharges(actor, { type = "long_rest" } = {}) {
  if (!actor?.spells?.perDay) return;
  for (const [spellId, rec] of Object.entries(actor.spells.perDay)) {
    if (!rec.refresh || rec.refresh === type) {
      rec.used = 0;
    }
  }
}

// Helper: try to pay via per-day charge first, else a slot
export function paySpellCost(actor, { spellId, slotLevel }) {
  // If the spell is available via a per-day feature with charges, consume that first
  if (hasPerDayCharge(actor, spellId)) {
    return spendPerDayCharge(actor, spellId) ? { ok: true, via: "perDay" } : { ok: false, via: "perDay" };
  }
  // Otherwise, consume a slot
  if (slotLevel && hasSlot(slotLevel, actor)) {
    return spendSlot(slotLevel, actor) ? { ok: true, via: "slot", level: slotLevel } : { ok: false, via: "slot" };
  }
  return { ok: false, via: "none" };
}
export function refreshPerDayFeats(actor) {
  if (!actor || !actor.spells || !actor.spells.perDay) return;
  for (const k of Object.keys(actor.spells.perDay)) {
    const rec = actor.spells.perDay[k];
    if (rec && typeof rec.used === 'number') rec.used = 0;
  }
}
