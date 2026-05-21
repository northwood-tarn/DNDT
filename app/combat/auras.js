import { distance } from "./grid.js";

export function normalizeAuras(auras = []) {
  return (Array.isArray(auras) ? auras : []).map((aura, index) => ({
    id: aura.id || `aura_${index + 1}`,
    name: aura.name || aura.label || `Aura ${index + 1}`,
    radiusSquares: Number.isFinite(aura.radiusSquares) ? aura.radiusSquares : 0,
    affects: aura.affects || "self_and_allies",
    sourceFeatureId: aura.sourceFeatureId || null,
    effects: Array.isArray(aura.effects) ? structuredClone(aura.effects) : [],
  }));
}

export function combatAuraEffectsAffectingActor(snapshot, actor) {
  if (!snapshot || !actor) return [];
  return (snapshot.actors || [])
    .filter((source) => !source.defeated && source.hp > 0)
    .flatMap((source) => (source.auras || [])
      .filter((aura) => auraAffectsActor(source, actor, aura))
      .filter((aura) => isInsideAura(source, actor, aura))
      .flatMap((aura) => (aura.effects || []).map((effect) => ({
        ...effect,
        sourceId: effect.sourceId || aura.id,
        sourceActorId: source.id,
        sourceTeam: source.team || null,
        sourceTags: [...(source.tags || [])],
        sourceCreatureType: source.creatureType || null,
        spellSaveDC: effect.spellSaveDC ?? source.spellSaveDC ?? null,
        sourceFeatureId: aura.sourceFeatureId || effect.sourceFeatureId || null,
        label: effect.label || aura.name,
      }))));
}

export function hasAuraConditionPrevention(snapshot, actor, conditionId, context = {}) {
  if (!conditionId) return null;
  return combatAuraEffectsAffectingActor(snapshot, actor).find((effect) => (
    effect.type === "condition_prevention" &&
    conditionMatches(effect.conditions, conditionId) &&
    sourceMatches(effect, context.source)
  )) || null;
}

function isInsideAura(source, actor, aura) {
  if (!Number.isFinite(aura.radiusSquares)) return false;
  return distance(source.position, actor.position) <= aura.radiusSquares;
}

function auraAffectsActor(source, actor, aura) {
  if (aura.affects === "self") return source.id === actor.id;
  if (aura.affects === "allies") return source.id !== actor.id && source.team === actor.team;
  if (aura.affects === "self_and_allies") return source.team === actor.team;
  if (aura.affects === "enemies") return source.team !== actor.team;
  if (aura.affects === "all") return true;
  return false;
}

function conditionMatches(conditions = [], conditionId) {
  return Array.isArray(conditions) && conditions.includes(conditionId);
}

function sourceMatches(effect, source) {
  if (!effect.sourceTag) return true;
  if (!source) return false;
  return (source.tags || []).includes(effect.sourceTag) || source.creatureType === effect.sourceTag;
}
