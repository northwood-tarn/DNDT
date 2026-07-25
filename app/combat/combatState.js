import { hasAuraTurnStartRecovery } from "./auras.js";

export function getActor(snapshot, actorId) {
  return snapshot.actors.find((actor) => actor.id === actorId) || null;
}

export function livingActors(snapshot, team = null) {
  return snapshot.actors.filter((actor) => actor.hp > 0 && (!team || actor.team === team));
}

export function currentActor(snapshot) {
  const actorId = snapshot.initiative[snapshot.turnIndex];
  return getActor(snapshot, actorId);
}

export function checkOutcome(snapshot, log) {
  if (snapshot.outcome) return snapshot.outcome;
  const heroes = actorsStillInFight(snapshot, "heroes").length;
  const enemies = actorsStillInFight(snapshot, "enemies").length;
  if (heroes === 0 || enemies === 0) {
    snapshot.outcome = heroes > 0 ? "victory" : "defeat";
    reviveDefeatedCompanions(snapshot, log);
    log.add("combat.end", {
      round: snapshot.round,
      outcome: snapshot.outcome,
    });
  }
  return snapshot.outcome;
}

function actorsStillInFight(snapshot, team) {
  return snapshot.actors.filter((actor) =>
    actor.team === team && (actor.hp > 0 || hasAuraTurnStartRecovery(snapshot, actor))
  );
}

function reviveDefeatedCompanions(snapshot, log) {
  for (const actor of snapshot.actors) {
    if (actor.kind !== "companion" || actor.hp > 0) continue;
    actor.hp = 1;
    actor.defeated = false;
    log.add("actor.revive", {
      round: snapshot.round,
      actorId: actor.id,
      actorName: actor.name,
      hp: 1,
      reason: "companion post-combat recovery",
    });
  }
}
