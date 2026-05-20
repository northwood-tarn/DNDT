import { hasLineOfSight, inBounds, keyOf, neighbors } from "./grid.js";
import { hasCombatObjectLineOfSight } from "./combatObjects.js";

export const COVER = {
  none: { kind: "none", bonus: 0, label: "no cover" },
  half: { kind: "half", bonus: 2, label: "half cover" },
  three_quarters: { kind: "three_quarters", bonus: 5, label: "three-quarters cover" },
  full: { kind: "full", bonus: Infinity, label: "full cover" },
};

export function getCoverAt(grid, pos) {
  const kind = grid.cover?.get(keyOf(pos)) || "none";
  return COVER[kind] || COVER.none;
}

export function getCoverForPosition(grid, pos) {
  return getCoverAt(grid, pos);
}

export function getBestCoverAgainst(grid, defenderPos, attackerPositions = []) {
  let best = getCoverAt(grid, defenderPos);
  for (const attackerPos of attackerPositions) {
    const cover = classifyDirectionalCover(grid, attackerPos, defenderPos);
    if (cover.bonus > best.bonus) best = cover;
  }
  return best;
}

export function classifyCover(snapshot, attacker, target, action = null) {
  if (!attacker || !target) return COVER.none;
  if (!hasLineOfSight(snapshot.grid, attacker.position, target.position) ||
      !hasCombatObjectLineOfSight(snapshot, attacker.position, target.position)) return COVER.full;

  const terrainCover = classifyDirectionalCover(snapshot.grid, attacker.position, target.position);
  if (terrainCover.kind === "none") return COVER.none;

  if (action?.type === "spell_save") {
    return action.saveAbility === "dex" ? terrainCover : COVER.none;
  }

  return (action?.range || 0) > 1 ? terrainCover : COVER.none;
}

export function coverSortValue(snapshot, pos, threats = []) {
  const cover = threats.length
    ? getBestCoverAgainst(snapshot.grid, pos, threats.map((actor) => actor.position || actor))
    : getCoverForPosition(snapshot.grid, pos);
  return Number.isFinite(cover.bonus) ? cover.bonus : 100;
}

function classifyDirectionalCover(grid, attackerPos, defenderPos) {
  let best = getCoverAt(grid, defenderPos);

  for (const coverPos of adjacentCoverTiles(grid, defenderPos)) {
    if (!isBetween(attackerPos, defenderPos, coverPos)) continue;
    if (!nearAttackLine(attackerPos, defenderPos, coverPos)) continue;
    const cover = getCoverAt(grid, coverPos);
    if (cover.bonus > best.bonus) best = cover;
  }

  return best;
}

function adjacentCoverTiles(grid, pos) {
  return neighbors(pos).filter((next) => {
    if (!inBounds(grid, next)) return false;
    return getCoverAt(grid, next).bonus > 0;
  });
}

function isBetween(attacker, defender, cover) {
  const attackerDistance = squaredDistance(attacker, defender);
  const coverDistance = squaredDistance(cover, defender);
  if (coverDistance > attackerDistance) return false;

  const toAttacker = {
    x: attacker.x - defender.x,
    y: attacker.y - defender.y,
  };
  const toCover = {
    x: cover.x - defender.x,
    y: cover.y - defender.y,
  };
  return dot(toAttacker, toCover) > 0;
}

function nearAttackLine(attacker, defender, cover) {
  const lineLength = Math.sqrt(squaredDistance(attacker, defender));
  if (lineLength === 0) return false;
  const numerator = Math.abs(
    (defender.y - attacker.y) * cover.x -
    (defender.x - attacker.x) * cover.y +
    defender.x * attacker.y -
    defender.y * attacker.x
  );
  return numerator / lineLength <= 0.75;
}

function squaredDistance(a, b) {
  return ((a.x - b.x) ** 2) + ((a.y - b.y) ** 2);
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y;
}
