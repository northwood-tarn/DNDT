import { alertFriendlyInitiativeBonus, hasAlertInitiativeAdvantage } from "./featureHooks.js";

export function rollInitiativeOrder(snapshot, dice, log = null) {
  const rolls = snapshot.actors.map((actor) => rollActorInitiative(actor, snapshot.actors, dice));
  rolls.sort((a, b) => b.total - a.total);
  snapshot.initiative = rolls.map((item) => item.actorId);
  if (log) {
    log.add("initiative.roll", {
      round: snapshot.round,
      rolls,
      order: rolls.map((item) => item.actorName),
    });
  }
  return rolls;
}

function rollActorInitiative(actor, actors, dice) {
  const first = dice.rollD20({ type: "initiative", label: actor.name });
  const second = hasAlertInitiativeAdvantage(actor)
    ? dice.rollD20({ type: "initiative", label: actor.name })
    : null;
  const roll = second && second.roll > first.roll ? second : first;
  const alertAllyBonus = alertFriendlyInitiativeBonus(actor, actors);
  const bonus = (actor.initiativeBonus || 0) + alertAllyBonus;
  return {
    actorId: actor.id,
    actorName: actor.name,
    total: roll.roll + bonus,
    roll: roll.roll,
    rolls: second ? [first.roll, second.roll] : [first.roll],
    mode: second ? "advantage" : "normal",
    bonus,
    baseBonus: actor.initiativeBonus || 0,
    alertAllyBonus,
  };
}
