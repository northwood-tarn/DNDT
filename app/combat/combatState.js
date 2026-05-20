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
  const heroes = livingActors(snapshot, "heroes").length;
  const enemies = livingActors(snapshot, "enemies").length;
  if (heroes === 0 || enemies === 0) {
    snapshot.outcome = heroes > 0 ? "victory" : "defeat";
    log.add("combat.end", {
      round: snapshot.round,
      outcome: snapshot.outcome,
    });
  }
  return snapshot.outcome;
}
