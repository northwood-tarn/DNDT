const AI_PROFILES = {
  melee: {
    style: "melee",
    targetPriority: "nearest",
    dashWhenOutOfRange: true,
    dodgeWhenNoAttack: true,
    seekCoverAfterAttack: false,
    preferCover: false,
  },
  archer: {
    style: "ranged",
    targetPriority: "weakest_visible",
    dashWhenOutOfRange: true,
    dodgeWhenNoAttack: true,
    seekCoverAfterAttack: true,
    preferCover: true,
  },
};

export function getAiProfile(actor) {
  const base = AI_PROFILES[actor.ai?.profile] || AI_PROFILES[actor.role] || AI_PROFILES.melee;
  return {
    ...base,
    ...(actor.ai || {}),
  };
}
