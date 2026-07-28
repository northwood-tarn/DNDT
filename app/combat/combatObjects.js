import { buildFootprint } from "./footprints.js";
import { normalizeEffectDuration } from "./effects.js";

export function normalizeCombatObjects(objects = []) {
  return (Array.isArray(objects) ? objects : []).map((object, index) => ({
    id: object.id || `combat_object_${index + 1}`,
    name: object.name || object.id || `Combat Object ${index + 1}`,
    kind: object.kind || null,
    position: object.position ? { ...object.position } : null,
    origin: object.origin ? { ...object.origin } : null,
    cells: Array.isArray(object.cells) ? object.cells.map((cell) => ({ ...cell })) : null,
    shape: object.shape || object.area?.shape || "radius",
    radiusSquares: object.radiusSquares ?? feetToSquares(object.radiusFt ?? object.area?.size ?? 0),
    innerRadiusSquares: object.innerRadiusSquares ?? feetToSquares(object.innerRadiusFt ?? 0),
    outerRadiusSquares: object.outerRadiusSquares ?? feetToSquares(object.outerRadiusFt ?? object.radiusFt ?? object.area?.size ?? 0),
    lengthSquares: object.lengthSquares ?? feetToSquares(object.lengthFt ?? object.area?.length ?? object.area?.size ?? 0),
    sizeSquares: object.sizeSquares ?? feetToSquares(object.sizeFt ?? object.area?.size ?? object.area?.width ?? 0),
    blocksMovement: object.blocksMovement === true,
    blocksLineOfSight: object.blocksLineOfSight === true,
    difficultTerrain: object.difficultTerrain === true,
    blocksBoundaryMovement: object.blocksBoundaryMovement === true,
    blocksTeleport: object.blocksTeleport === true,
    blocksSound: object.blocksSound === true,
    blocksSpellLevelAtMost: Number(object.blocksSpellLevelAtMost) || 0,
    teleportSaveAbility: object.teleportSaveAbility ? String(object.teleportSaveAbility).toLowerCase().slice(0, 3) : null,
    immuneToDispel: object.immuneToDispel === true,
    visual: object.visual || null,
    logSummary: object.logSummary || null,
    followsSource: object.followsSource === true,
    sourceActorId: object.sourceActorId || null,
    sourceTeam: object.sourceTeam || sourceTeamFromObject(object),
    sourceActionId: object.sourceActionId || null,
    sourceActionTags: object.sourceActionTags ? structuredClone(object.sourceActionTags) : null,
    safeGeometry: object.safeGeometry === true,
    spellSaveDC: object.spellSaveDC ?? null,
    duration: normalizeEffectDuration(object.duration),
    effects: Array.isArray(object.effects) ? structuredClone(object.effects) : [],
    intensity: normalizeIntensity(object.intensity),
    timers: normalizeTimers(object.timers),
    stableThroughDice: object.stableThroughDice ?? null,
    stableEffects: object.stableEffects ? structuredClone(object.stableEffects) : null,
    unstableEffects: object.unstableEffects ? structuredClone(object.unstableEffects) : null,
    collapse: object.collapse ? structuredClone(object.collapse) : null,
  }));
}

export function createCombatObjectFromAction(action, anchor, source) {
  const object = action.object || {};
  const position = anchor?.anchor || anchor?.cells?.[0] || anchor;
  return normalizeCombatObjects([{
    ...object,
    id: `${action.id}_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    name: object.name || action.name,
    position: position ? { ...position } : null,
    cells: Array.isArray(anchor?.cells) ? anchor.cells : object.cells,
    origin: source?.position ? { ...source.position } : null,
    sourceActorId: source?.id || null,
    sourceTeam: source?.team || null,
    sourceActionId: action.id,
    sourceActionTags: structuredClone(action.tags || {}),
    safeGeometry: action.safeGeometry === true,
    spellSaveDC: action.spellSaveDC ?? null,
    duration: resolveObjectDuration(object, source),
    effects: resolveObjectEffects(object.effects || [], source, action),
  }])[0];
}

function resolveObjectDuration(object, source) {
  const raw = object.duration || (object.durationRounds != null
    ? { kind: "rounds", rounds: object.durationRounds, tick: "turn_end" }
    : null);
  if (!raw || typeof raw !== "object") return raw;
  const rounds = resolveFormula(raw.rounds ?? raw.remaining, source);
  if (!Number.isFinite(rounds)) return raw;
  return {
    ...raw,
    rounds,
    remaining: Number.isFinite(raw.remaining) ? raw.remaining : rounds,
  };
}

function normalizeIntensity(intensity) {
  if (!intensity) return null;
  return {
    ...structuredClone(intensity),
    currentDice: Number.isFinite(intensity.currentDice) ? intensity.currentDice : intensity.startDice,
  };
}

function normalizeTimers(timers) {
  if (!timers || typeof timers !== "object") return null;
  return Object.fromEntries(Object.entries(timers).map(([id, timer]) => ([
    id,
    {
      ...structuredClone(timer),
      id,
      active: timer.active !== false,
      currentDice: Number.isFinite(timer.currentDice) ? timer.currentDice : timer.startDice,
    },
  ])));
}

function resolveObjectEffects(effects, source, action) {
  return (effects || []).map((effect) => ({
    ...effect,
    damage: resolveFormula(effect.damage, source),
    amount: Number.isFinite(effect.amount) ? effect.amount : Number(resolveFormula(effect.amountFormula, source)) || effect.amount,
    amountFormula: effect.amountFormula || null,
    spellSaveDC: effect.save?.dcFrom === "spellSaveDC" ? action.spellSaveDC : effect.spellSaveDC,
  }));
}

function resolveFormula(value, source) {
  if (typeof value !== "string") return value;
  const resolved = value
    .replace(/\bstrength_modifier\b/g, String(source?.abilityMods?.str || 0))
    .replace(/\bdexterity_modifier\b/g, String(source?.abilityMods?.dex || 0))
    .replace(/\bconstitution_modifier\b/g, String(source?.abilityMods?.con || 0))
    .replace(/\bintelligence_modifier\b/g, String(source?.abilityMods?.int || 0))
    .replace(/\bwisdom_modifier\b/g, String(source?.abilityMods?.wis || 0))
    .replace(/\bcharisma_modifier\b/g, String(source?.abilityMods?.cha || 0))
    .replace(/\bproficiency_bonus\b/g, String(source?.proficiencyBonus || 0));
  return /^[+-]?\d+$/.test(resolved) ? Number(resolved) : resolved;
}

function sourceTeamFromObject(object) {
  return object.sourceTeam || null;
}

export function combatObjectsAt(snapshot, position) {
  return (snapshot.combatObjects || []).filter((object) => combatObjectContains(snapshot, object, position));
}

export function combatObjectsAffectingActor(snapshot, actor) {
  if (!actor?.position) return [];
  return combatObjectsAt(snapshot, actor.position);
}

export function isHealingBlockedByCombatObject(snapshot, actor) {
  return combatObjectsAffectingActor(snapshot, actor).some((object) =>
    (object.effects || []).some((effect) =>
      effect.type === "healing_block" &&
      (effect.trigger || "passive") === "passive" &&
      effectAffectsActor(effect, object, actor)
    )
  );
}

function effectAffectsActor(effect, object, actor) {
  if (!effect.affects || effect.affects === "all") return true;
  if (effect.affects === "allies") return actor.team === object.sourceTeam;
  if (effect.affects === "enemies") return actor.team !== object.sourceTeam;
  return true;
}

export function blockingContainmentBoundary(snapshot, from, to) {
  return (snapshot.combatObjects || []).find((object) =>
    object.blocksBoundaryMovement === true &&
    combatObjectContains(snapshot, object, from) !== combatObjectContains(snapshot, object, to)
  ) || null;
}

export function combatObjectContains(snapshot, object, position) {
  if (!combatObjectPosition(snapshot, object) || !position) return false;
  const cells = combatObjectCells(snapshot, object);
  return cells.some((cell) => cell.x === position.x && cell.y === position.y);
}

export function combatObjectCells(snapshot, object) {
  if (Array.isArray(object?.cells)) return object.cells.map((cell) => ({ ...cell }));
  const position = combatObjectPosition(snapshot, object);
  if (!position) return [];
  return buildFootprint(snapshot.grid, object.shape || "radius", position, {
    origin: object.origin || position,
    radiusSquares: object.radiusSquares || 0,
    innerRadiusSquares: object.innerRadiusSquares || 0,
    outerRadiusSquares: object.outerRadiusSquares || object.radiusSquares || 0,
    lengthSquares: object.lengthSquares || 0,
    sizeSquares: object.sizeSquares || 0,
  });
}

function combatObjectPosition(snapshot, object) {
  if (!object?.followsSource) return object?.position || null;
  const source = (snapshot.actors || []).find((actor) => actor.id === object.sourceActorId && actor.hp > 0);
  return source?.position || object.position || null;
}

export function hasCombatObjectLineOfSight(snapshot, from, to) {
  const blockers = (snapshot.combatObjects || []).filter((object) => object.blocksLineOfSight);
  if (!blockers.length) return true;
  if (blockers.some((object) => combatObjectContains(snapshot, object, from) || combatObjectContains(snapshot, object, to))) {
    return false;
  }
  const points = bresenham(from.x, from.y, to.x, to.y);
  for (let i = 1; i < points.length - 1; i++) {
    if (blockers.some((object) => combatObjectContains(snapshot, object, points[i]))) return false;
  }
  return true;
}

function bresenham(x0, y0, x1, y1) {
  const points = [];
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;

  while (true) {
    points.push({ x, y });
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
  return points;
}

function feetToSquares(feet) {
  return Math.max(0, Math.ceil((Number(feet) || 0) / 5));
}
