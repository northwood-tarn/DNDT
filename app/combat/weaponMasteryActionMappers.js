export function createWeaponMasteryEffects(weaponRecord, mastery) {
  if (!mastery || mastery.implementation !== "automatic") return [];
  const name = weaponRecord.name || "Weapon";
  if (mastery.id === "vex") return [modifierEffect(name, "Vex", "incoming_attack_roll", "advantage", "incoming_attack", "source")];
  if (mastery.id === "sap") return [modifierEffect(name, "Sap", "attack_roll", "disadvantage", "outgoing_attack")];
  if (mastery.id === "slow") {
    return [{
      type: "modifier",
      trigger: "hit",
      target: "target",
      stat: "speed",
      amount: -2,
      duration: oneRound(),
      label: `${name} Slow`,
    }];
  }
  if (mastery.id === "push") {
    return [{
      type: "forced_movement",
      trigger: "hit",
      target: "target",
      direction: "away_from_source",
      distanceSquares: 2,
      collisionDamage: "1d4",
      collisionDamageType: "bludgeoning",
      label: `${name} Push`,
    }];
  }
  if (mastery.id === "topple") {
    return [{
      type: "condition",
      trigger: "hit",
      target: "target",
      condition: "prone",
      save: {
        ability: "con",
        dcFrom: "weapon_mastery",
        onSave: "negates",
      },
      label: `${name} Topple`,
    }];
  }
  return [];
}

function modifierEffect(weaponName, masteryName, stat, mode, consumeOn, durationAnchor = null) {
  return {
    type: "modifier",
    trigger: "hit",
    target: "target",
    stat,
    mode,
    sourceActorOnly: stat === "incoming_attack_roll",
    consumeOn,
    duration: oneRound(durationAnchor),
    label: `${weaponName} ${masteryName}`,
  };
}

function oneRound(anchor = null) {
  return { kind: "rounds", rounds: 1, tick: "turn_end", ...(anchor ? { anchor } : {}) };
}
