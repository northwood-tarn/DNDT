import {
  getMovementRemaining,
  getActionUses,
  hasAction,
} from "./actor.js";
import { getAiProfile } from "./aiProfiles.js";
import {
  coverSortValue,
  getBestCoverAgainst,
} from "./cover.js";
import {
  distance,
  findReachable,
  hasLineOfSight,
  isAdjacentToBlocked,
  nextStepToward,
} from "./grid.js";
import { livingActors } from "./resolver.js";

export async function runAiTurn(snapshot, actor, controller) {
  if (!actor || actor.defeated || actor.hp <= 0) return;
  const profile = getAiProfile(actor);
  if (profile.style === "ranged") return runRangedTurn(snapshot, actor, controller, profile);
  return runMeleeTurn(snapshot, actor, controller, profile);
}

async function runRangedTurn(snapshot, actor, controller, profile) {
  const action = getPrimaryAttack(actor);
  if (!action) {
    await dodgeIfUseful(snapshot, actor, controller, profile, "no available attack, taking Dodge");
    return;
  }
  let target = selectTarget(snapshot, actor, action.range, profile) || nearestEnemy(snapshot, actor);

  if (!target) return;
  if (!canShoot(snapshot, actor, target, action.range)) {
    controller.log.add("ai.intent", {
      round: snapshot.round,
      actorId: actor.id,
      actorName: actor.name,
      intent: `moving toward a firing position on ${target.name}`,
    });
    await controller.afterStep?.({ kind: "intent", actorId: actor.id });
    await moveTowardFiringPosition(snapshot, actor, target, action.range, controller);
    if (!canShoot(snapshot, actor, target, action.range) && profile.dashWhenOutOfRange) {
      await dashIfUseful(snapshot, actor, controller, profile, `dashing toward a firing position on ${target.name}`);
      await moveTowardFiringPosition(snapshot, actor, target, action.range, controller);
    }
  }

  target = selectTarget(snapshot, actor, action.range, profile) || target;
  if (hasAction(actor) && canShoot(snapshot, actor, target, action.range)) {
    controller.log.add("ai.intent", {
      round: snapshot.round,
      actorId: actor.id,
      actorName: actor.name,
      intent: `shooting ${target.name}, then looking for cover`,
    });
    await controller.afterStep?.({ kind: "intent", actorId: actor.id, targetId: target.id });
    controller.action(actor.id, action.id, target.id);
    await controller.afterStep?.({ kind: "attack", actorId: actor.id, targetId: target.id });
  }

  if (profile.seekCoverAfterAttack) await duckIntoCover(snapshot, actor, controller, profile);
  if (hasAction(actor)) await dodgeIfUseful(snapshot, actor, controller, profile, "no shot taken, taking Dodge");
}

async function runMeleeTurn(snapshot, actor, controller, profile) {
  const action = getPrimaryAttack(actor);
  if (!action) {
    await dodgeIfUseful(snapshot, actor, controller, profile, "no available attack, taking Dodge");
    return;
  }
  let target = selectTarget(snapshot, actor, action.range, profile) || nearestEnemy(snapshot, actor);
  if (!target) return;

  while (getMovementRemaining(actor) > 0 && distance(actor.position, target.position) > action.range) {
    const step = nextStepToward(snapshot, actor, target.position);
    if (!step) break;
    if (!await moveOneStep(snapshot, actor, step, controller)) break;
    if (actor.hp <= 0 || snapshot.outcome) return;
    target = nearestEnemy(snapshot, actor) || target;
  }

  if (distance(actor.position, target.position) > action.range && profile.dashWhenOutOfRange) {
    await dashIfUseful(snapshot, actor, controller, profile, `dashing to close with ${target.name}`);
    while (getMovementRemaining(actor) > 0 && distance(actor.position, target.position) > action.range) {
      const step = nextStepToward(snapshot, actor, target.position);
      if (!step) break;
      if (!await moveOneStep(snapshot, actor, step, controller)) break;
      if (actor.hp <= 0 || snapshot.outcome) return;
      target = nearestEnemy(snapshot, actor) || target;
    }
  }

  if (hasAction(actor) && distance(actor.position, target.position) <= action.range) {
    controller.log.add("ai.intent", {
      round: snapshot.round,
      actorId: actor.id,
      actorName: actor.name,
      intent: `closing and attacking ${target.name}`,
    });
    await controller.afterStep?.({ kind: "intent", actorId: actor.id, targetId: target.id });
    controller.action(actor.id, action.id, target.id);
    await controller.afterStep?.({ kind: "attack", actorId: actor.id, targetId: target.id });
  } else if (hasAction(actor)) {
    await dodgeIfUseful(snapshot, actor, controller, profile, "unable to attack, taking Dodge");
  }
}

function selectTarget(snapshot, actor, range, profile) {
  if (profile.targetPriority === "weakest_visible") return bestVisibleTarget(snapshot, actor, range);
  if (profile.targetPriority === "weakest") return weakestEnemy(snapshot, actor);
  return nearestEnemy(snapshot, actor);
}

function bestVisibleTarget(snapshot, actor, range) {
  return livingActors(snapshot, oppositeTeam(actor.team))
    .filter((target) => canShoot(snapshot, actor, target, range))
    .sort((a, b) => a.hp - b.hp || distance(actor.position, a.position) - distance(actor.position, b.position))[0] || null;
}

function nearestEnemy(snapshot, actor) {
  return livingActors(snapshot, oppositeTeam(actor.team))
    .sort((a, b) => distance(actor.position, a.position) - distance(actor.position, b.position))[0] || null;
}

function weakestEnemy(snapshot, actor) {
  return livingActors(snapshot, oppositeTeam(actor.team))
    .sort((a, b) => a.hp - b.hp || distance(actor.position, a.position) - distance(actor.position, b.position))[0] || null;
}

function canShoot(snapshot, actor, target, range) {
  return canShootFrom(snapshot, actor.position, target, range);
}

function canShootFrom(snapshot, position, target, range) {
  return target &&
    distance(position, target.position) <= range &&
    hasLineOfSight(snapshot.grid, position, target.position);
}

async function moveTowardFiringPosition(snapshot, actor, target, range, controller) {
  const reachable = findReachable(snapshot, actor, getMovementRemaining(actor))
    .filter(({ pos }) => distance(pos, target.position) <= range)
    .filter(({ pos }) => hasLineOfSight(snapshot.grid, pos, target.position))
    .sort((a, b) => coverSortValue(snapshot, b.pos, [target]) - coverSortValue(snapshot, a.pos, [target]) || a.steps - b.steps);
  const destination = reachable[0]?.pos;
  if (!destination) return;
  await moveAlongGreedyPath(snapshot, actor, destination, controller);
}

async function duckIntoCover(snapshot, actor, controller, profile) {
  if (!profile.preferCover) return;
  if (getMovementRemaining(actor) <= 0) return;
  const enemies = livingActors(snapshot, oppositeTeam(actor.team));
  const attack = getPrimaryAttack(actor);
  const coverReachable = findReachable(snapshot, actor, getMovementRemaining(actor))
    .filter(({ pos, steps }) => steps > 0 && coverSortValue(snapshot, pos, enemies) > 0)
    .filter(({ pos }) => enemies.some((enemy) => canShootFrom(snapshot, pos, enemy, attack?.range || 0)))
    .sort((a, b) => {
      return coverSortValue(snapshot, b.pos, enemies) - coverSortValue(snapshot, a.pos, enemies) || a.steps - b.steps;
    });
  if (coverReachable.length) {
    const destination = coverReachable[0].pos;
    await moveAlongGreedyPath(snapshot, actor, destination, controller);
    controller.log.add("cover.move", {
      round: snapshot.round,
      actorId: actor.id,
      actorName: actor.name,
      to: { ...actor.position },
      cover: getBestCoverAgainst(snapshot.grid, actor.position, enemies.map((enemy) => enemy.position)),
    });
    await controller.afterStep?.({ kind: "cover", actorId: actor.id });
    return;
  }

  const reachable = findReachable(snapshot, actor, getMovementRemaining(actor))
    .filter(({ pos, steps }) => steps > 0 && isAdjacentToBlocked(snapshot.grid, pos))
    .filter(({ pos }) => enemies.some((enemy) => !hasLineOfSight(snapshot.grid, enemy.position, pos)))
    .sort((a, b) => a.steps - b.steps);
  const destination = reachable[0]?.pos;
  if (!destination) return;
  await moveAlongGreedyPath(snapshot, actor, destination, controller);
  controller.log.add("cover.move", {
    round: snapshot.round,
    actorId: actor.id,
    actorName: actor.name,
    to: { ...actor.position },
  });
  await controller.afterStep?.({ kind: "cover", actorId: actor.id });
}

async function moveAlongGreedyPath(snapshot, actor, destination, controller) {
  while (getMovementRemaining(actor) > 0 && distance(actor.position, destination) > 0) {
    const step = nextStepToward(snapshot, actor, destination);
    if (!step) break;
    if (!await moveOneStep(snapshot, actor, step, controller)) break;
    if (actor.hp <= 0 || snapshot.outcome) return;
  }
}

async function moveOneStep(snapshot, actor, step, controller) {
  const before = { ...actor.position };
  const moved = controller.move(actor.id, step);
  if (!moved || (actor.position.x === before.x && actor.position.y === before.y)) {
    controller.log.add("ai.intent", {
      round: snapshot.round,
      actorId: actor.id,
      actorName: actor.name,
      intent: "movement path blocked; stopping movement",
    });
    await controller.afterStep?.({ kind: "intent", actorId: actor.id });
    return false;
  }
  await controller.afterStep?.({ kind: "move", actorId: actor.id });
  return true;
}

async function dashIfUseful(snapshot, actor, controller, profile, intent) {
  if (profile.dashWhenOutOfRange === false) return false;
  if (!hasAction(actor)) return false;
  const dash = actor.actions.find((action) => action.id === "dash");
  if (!dash) return false;
  controller.log.add("ai.intent", {
    round: snapshot.round,
    actorId: actor.id,
    actorName: actor.name,
    intent,
  });
  await controller.afterStep?.({ kind: "intent", actorId: actor.id });
  const used = controller.action(actor.id, dash.id, null);
  if (used) await controller.afterStep?.({ kind: "dash", actorId: actor.id });
  return used;
}

async function dodgeIfUseful(snapshot, actor, controller, profile, intent) {
  if (profile.dodgeWhenNoAttack === false) return false;
  if (!hasAction(actor)) return false;
  const dodge = actor.actions.find((action) => action.id === "dodge");
  if (!dodge) return false;
  controller.log.add("ai.intent", {
    round: snapshot.round,
    actorId: actor.id,
    actorName: actor.name,
    intent,
  });
  await controller.afterStep?.({ kind: "intent", actorId: actor.id });
  const used = controller.action(actor.id, dodge.id, null);
  if (used) await controller.afterStep?.({ kind: "dodge", actorId: actor.id });
  return used;
}

function getPrimaryAttack(actor) {
  return actor.actions.find((action) => action.requiresTarget !== false && getActionUses(action) > 0);
}

function oppositeTeam(team) {
  return team === "heroes" ? "enemies" : "heroes";
}
