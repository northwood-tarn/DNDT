import { applyResourcefulNearMissD20 } from "../utils/dice.js";

export function applyLuckyToRoll({ actor, roll, dice, log, context }) {
  if (!roll || roll.autoFail || typeof dice?.applyLuckyD20 !== "function") return roll;
  const naturalReroll = applyNaturalD20Reroll(actor, roll, dice, log, context);
  if (naturalReroll) return naturalReroll;
  const resourceful = applyResourcefulNearMissD20({
    actor,
    currentRoll: roll.roll,
    context,
    rollD20: dice.rollD20?.bind(dice),
  });
  if (resourceful?.usedResourceful) {
    log.add("resourceful.roll", {
      round: context.round,
      actorId: actor.id,
      actorName: actor.name,
      rollType: context.type,
      label: context.label,
      originalRoll: resourceful.originalRoll,
      secondRoll: resourceful.secondRoll,
      roll: resourceful.roll,
      missedBy: resourceful.missedBy,
      remaining: resourceful.pointsRemaining,
    });
    return {
      ...roll,
      roll: resourceful.roll,
      rolls: [...(roll.rolls || [resourceful.originalRoll]), resourceful.secondRoll],
      reasons: [...(roll.reasons || []), `RESOURCEFUL: missed by ${resourceful.missedBy}`],
      lucky: resourceful,
    };
  }
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

function applyNaturalD20Reroll(actor, roll, dice, log, context) {
  const naturalRolls = actor?.luck?.naturalRolls || [];
  if (!naturalRolls.includes(roll.roll) || typeof dice?.rollD20 !== "function") return null;
  const second = dice.rollD20({ type: context.type, label: context.label });
  const next = {
    ...roll,
    roll: second.roll,
    rolls: [...(roll.rolls || [roll.roll]), second.roll],
    reasons: [...(roll.reasons || []), `REROLL: natural ${roll.roll}`],
    lucky: {
      usedLucky: true,
      originalRoll: roll.roll,
      secondRoll: second.roll,
      roll: second.roll,
      missedBy: null,
      pointsRemaining: actor.luck.points,
    },
  };
  log.add("lucky.roll", {
    round: context.round,
    actorId: actor.id,
    actorName: actor.name,
    rollType: context.type,
    label: context.label,
    originalRoll: roll.roll,
    secondRoll: second.roll,
    roll: second.roll,
    missedBy: null,
    pointsRemaining: actor.luck.points,
  });
  return next;
}
