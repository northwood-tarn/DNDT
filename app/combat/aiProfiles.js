export const AI_PROFILES = {
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
  aggressive: {
    style: "melee",
    targetPriority: "nearest",
    dashWhenOutOfRange: true,
    dodgeWhenNoAttack: false,
    seekCoverAfterAttack: false,
    preferCover: false,
  },
  pack: {
    style: "melee",
    targetPriority: "weakest",
    dashWhenOutOfRange: true,
    dodgeWhenNoAttack: true,
    seekCoverAfterAttack: false,
    preferCover: false,
  },
  guard: {
    style: "melee",
    targetPriority: "nearest",
    dashWhenOutOfRange: false,
    dodgeWhenNoAttack: true,
    seekCoverAfterAttack: false,
    preferCover: false,
  },
  stalker: {
    style: "melee",
    targetPriority: "weakest",
    dashWhenOutOfRange: true,
    dodgeWhenNoAttack: true,
    seekCoverAfterAttack: false,
    preferCover: false,
  },
  tactical: {
    style: "melee",
    targetPriority: "nearest",
    dashWhenOutOfRange: true,
    dodgeWhenNoAttack: true,
    seekCoverAfterAttack: false,
    preferCover: false,
  },
};

export const AI_PROFILE_IDS = Object.keys(AI_PROFILES);

export function getAiProfile(actor) {
  const base = AI_PROFILES[actor.ai?.profile] || AI_PROFILES[actor.role] || AI_PROFILES.melee;
  return {
    ...base,
    ...(actor.ai || {}),
  };
}
