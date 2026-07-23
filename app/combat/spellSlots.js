export function actionConsumesSpellSlot(action) {
  return Boolean(
    action?.type?.startsWith("spell_") &&
    Number(action.spellLevel) > 0 &&
    action.forbiddenTranscriptionRepeat !== true &&
    !action.freeCastResourceId
  );
}

export function canSpendSpellSlotThisTurn(actor, action) {
  if (!actionConsumesSpellSlot(action)) return { ok: true, reason: null };
  if (!hasSpellSlotPool(actor)) return { ok: true, reason: null };
  if (actor?.turnFlags?.spellSlotSpentThisTurn === true) {
    return { ok: false, reason: "a spell slot has already been used this turn" };
  }
  const level = action.usesExactSpellSlot
    ? exactAvailableSpellSlot(actor, action.spellLevel || 1)
    : lowestAvailableSpellSlot(actor, action.spellLevel || 1);
  if (!level && highestSlotLevel(actor) < Number(action.spellLevel || 1)) return { ok: true, reason: null };
  if (!level) return { ok: false, reason: `no level ${action.spellLevel || 1}+ spell slot available` };
  return { ok: true, reason: null, level };
}

export function spendActionSpellSlot(actor, action) {
  if (!actionConsumesSpellSlot(action)) return true;
  if (!hasSpellSlotPool(actor)) return true;
  const level = action.usesExactSpellSlot
    ? exactAvailableSpellSlot(actor, action.spellLevel || 1)
    : lowestAvailableSpellSlot(actor, action.spellLevel || 1);
  if (!level && highestSlotLevel(actor) < Number(action.spellLevel || 1)) return true;
  if (!level || !spendSpellSlot(actor, level)) return false;
  actor.turnFlags ??= {};
  actor.turnFlags.spellSlotSpentThisTurn = true;
  actor.turnFlags.lastSpellSlotLevelSpent = level;
  return true;
}

function hasSpellSlotPool(actor) {
  const slots = actor?.spellSlots || actor?.spellcasting?.slots || {};
  return Object.keys(slots).length > 0;
}

function highestSlotLevel(actor) {
  const slots = actor?.spellSlots || actor?.spellcasting?.slots || {};
  return Math.max(0, ...Object.keys(slots).map(Number).filter(Number.isFinite));
}

export function lowestAvailableSpellSlot(actor, minimumLevel = 1) {
  const slots = actor?.spellSlots || actor?.spellcasting?.slots || {};
  for (const key of Object.keys(slots).map(Number).filter(Number.isFinite).sort((a, b) => a - b)) {
    if (key < minimumLevel) continue;
    if (availableSlotUses(slots[key]) > 0) return key;
  }
  return null;
}

function exactAvailableSpellSlot(actor, level) {
  const slots = actor?.spellSlots || actor?.spellcasting?.slots || {};
  return availableSlotUses(slots[level] || slots[String(level)]) > 0 ? Number(level) : null;
}

export function availableSlotUses(slot) {
  if (Number.isFinite(slot)) return slot;
  if (!slot || typeof slot !== "object") return 0;
  if (Number.isFinite(slot.current)) return slot.current;
  if (Number.isFinite(slot.remaining)) return slot.remaining;
  if (Number.isFinite(slot.max) && Number.isFinite(slot.used)) return Math.max(0, slot.max - slot.used);
  if (Number.isFinite(slot.max)) return slot.max;
  return 0;
}

export function spendSpellSlot(actor, level) {
  const slots = actor?.spellSlots || actor?.spellcasting?.slots || {};
  const slot = slots[level] || slots[String(level)];
  if (Number.isFinite(slot)) {
    slots[level] = Math.max(0, slot - 1);
    return true;
  }
  if (!slot || typeof slot !== "object") return false;
  if (Number.isFinite(slot.current)) {
    slot.current = Math.max(0, slot.current - 1);
    return true;
  }
  if (Number.isFinite(slot.remaining)) {
    slot.remaining = Math.max(0, slot.remaining - 1);
    return true;
  }
  if (Number.isFinite(slot.used)) {
    slot.used += 1;
    return true;
  }
  if (Number.isFinite(slot.max)) {
    slot.current = Math.max(0, slot.max - 1);
    return true;
  }
  return false;
}
