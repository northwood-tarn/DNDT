import { getSpellById } from "../data/spells.js";

export function canResolveUtilitySpell(spellOrId) {
  return Boolean(utilityHook(spellOrId));
}

export function resolveUtilitySpell(spellOrId, context = {}) {
  const spell = typeof spellOrId === "string" ? getSpellById(spellOrId) : spellOrId;
  const hook = utilityHook(spell);
  if (!spell || !hook) return failure("spell has no utility implementation");

  if (hook.kind === "repair_object") {
    const target = context.target;
    if (!target) return failure("repair target is required");
    if (target.magical === true) return failure("Mending cannot repair a magical object");
    if (Number(target.breakSizeFt || 0) > Number(hook.maximumBreakSizeFt || 1)) return failure("the break is too large to mend");
    target.broken = false;
    target.repaired = true;
    context.onRepair?.(target, spell);
    return success(spell, { kind: hook.kind, targetId: target.id || null });
  }

  if (hook.kind === "remote_interact") {
    const target = context.target;
    if (!target) return failure("interaction target is required");
    if (Number(context.distanceFt || 0) > Number(hook.rangeFt || 30)) return failure("target is out of range");
    if (Number(target.weightLb || 0) > Number(hook.maximumWeightLb || 10)) return failure("target is too heavy");
    const result = context.interact?.(target, { remote: true, spellId: spell.id }) ?? { interacted: true };
    return success(spell, { kind: hook.kind, targetId: target.id || null, result });
  }

  if (hook.kind === "minor_magic") {
    const category = context.category || "sensory_flourish";
    const allowed = spell.hooks?.applyEffect?.categories || ["sensory_flourish", "object_trick", "elemental_whisper", "voice_or_omen"];
    if (!allowed.includes(category)) return failure("minor-magic category is not available");
    const durationSeconds = Math.min(Number(context.durationSeconds || 0), Number(hook.maxDurationSeconds || 3600));
    const result = context.perform?.({ category, durationSeconds, description: context.description || "" }) ?? { performed: true };
    return success(spell, { kind: hook.kind, category, durationSeconds, result });
  }

  if (hook.kind === "detect_filter") {
    const radiusFt = Number(hook.radiusFt || 30);
    const origin = context.origin || { x: 0, y: 0 };
    const matches = (context.entities || []).filter((entity) => {
      if (!matchesFilter(entity, hook.filter)) return false;
      return distanceFeet(origin, entity.position || origin, context.feetPerSquare || 5) <= radiusFt;
    });
    context.onDetect?.(matches, spell);
    return success(spell, { kind: hook.kind, filter: hook.filter, radiusFt, matches });
  }

  if (hook.kind === "create_illusion") {
    const anchor = context.anchor;
    if (!anchor) return failure("illusion anchor is required");
    const illusion = {
      id: context.id || `${spell.id}_illusion`,
      spellId: spell.id,
      anchor: structuredClone(anchor),
      cubeFt: Number(hook.cubeFt || 15),
      description: context.description || "Silent illusion",
      investigationDC: context.spellSaveDC || null,
    };
    context.addIllusion?.(illusion);
    return success(spell, { kind: hook.kind, illusion });
  }

  return failure(`unsupported utility kind: ${hook.kind}`);
}

function utilityHook(spellOrId) {
  const spell = typeof spellOrId === "string" ? getSpellById(spellOrId) : spellOrId;
  return spell?.hooks?.utility || null;
}

function matchesFilter(entity, filter) {
  if (filter === "magic") return entity.magical === true || entity.tags?.includes?.("magic");
  if (filter === "presence") return entity.hiddenPresence === true || entity.tags?.includes?.("presence");
  if (filter === "poison_disease") return entity.poisonous === true || entity.diseased === true || entity.tags?.some?.((tag) => tag === "poison" || tag === "disease");
  return false;
}

function distanceFeet(a, b, feetPerSquare) {
  return (Math.abs(Number(a.x || 0) - Number(b.x || 0)) + Math.abs(Number(a.y || 0) - Number(b.y || 0))) * feetPerSquare;
}

function success(spell, detail) {
  return { ok: true, spellId: spell.id, ...detail };
}

function failure(reason) {
  return { ok: false, reason };
}
