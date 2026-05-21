export function applyLuckyToRoll({ actor, roll, dice, log, context }) {
  if (!roll || roll.autoFail || typeof dice?.applyLuckyD20 !== "function") return roll;
  const lucky = dice.applyLuckyD20({
    actor,
    currentRoll: roll.roll,
    context,
  });
  if (!lucky?.usedLucky) return roll;

  log.add("lucky.roll", {
    round: context.round,
    actorId: actor.id,
    actorName: actor.name,
    rollType: context.type,
    label: context.label,
    originalRoll: lucky.originalRoll,
    secondRoll: lucky.secondRoll,
    roll: lucky.roll,
    missedBy: lucky.missedBy,
    pointsRemaining: lucky.pointsRemaining,
  });
  return {
    ...roll,
    roll: lucky.roll,
    rolls: [...(roll.rolls || [lucky.originalRoll]), lucky.secondRoll],
    reasons: [...(roll.reasons || []), `LUCKY: missed by ${lucky.missedBy}`],
    lucky,
  };
}
