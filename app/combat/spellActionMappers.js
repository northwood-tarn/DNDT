export function createEffectsFromSpell(spellRecord) {
  const applyEffect = spellRecord.hooks?.applyEffect;
  if (!applyEffect) return [];
  const effects = effectPayloads(applyEffect)
    .flatMap((payload) => {
      const effect = createConditionEffect(payload, spellRecord);
      return Array.isArray(effect) ? effect : [effect];
    })
    .filter(Boolean);
  return effects;
}

export function createCombatObjectFromSpell(spellRecord) {
  const payload = spellRecord.hooks?.applyEffect;
  const kind = String(payload?.kind || "").toLowerCase();
  if (![
    "area_obscure",
    "hazard_zone",
    "area_hazard",
    "wall",
    "moving_ring_hazard",
    "area_tentacles",
  ].includes(kind)) return null;

  const area = payload.area || spellRecord.area || {};
  const radiusFt = payload.radiusFt ?? payload.outerRadiusFt ?? area.size ?? area.width ?? area.length ?? 0;
  const shape = normalizeObjectShape(area.shape || payload.shape || "sphere");
  const object = {
    name: spellRecord.name,
    shape,
    radiusFt,
    innerRadiusFt: payload.innerRadiusFt || 0,
    outerRadiusFt: payload.outerRadiusFt || radiusFt,
    sizeFt: area.size || area.width || radiusFt,
    lengthFt: area.length || area.size || radiusFt,
    blocksMovement: payload.blocksMovement === true || kind === "wall",
    blocksLineOfSight: payload.blocksSight === true || payload.blocksLineOfSight === true || kind === "wall",
    blocksProjectiles: payload.blocksProjectiles === true || kind === "wall",
    difficultTerrain: payload.difficultTerrain === true,
    visual: "green_glow",
    followsSource: payload.followsCaster === true,
    duration: spellDuration(spellRecord.duration),
    sourceActionId: spellRecord.id,
    effects: [],
  };
  if (kind === "wall") {
    object.placement = "cell_path";
    object.lengthSquares = feetToSquares(payload.lengthFt || area.length || area.size || 50);
  }

  if (payload.damagePer5ft?.dice) {
    object.effects.push({
      type: "damage",
      trigger: "enter_area",
      damage: payload.damagePer5ft.dice,
      damageType: payload.damagePer5ft.type || "untyped",
    });
  }

  for (const tick of payload.ticks || []) {
    if (!tick.damage?.dice) continue;
    object.effects.push({
      type: "damage",
      trigger: tick.phase,
      damage: tick.damage.dice,
      damageType: tick.damage.type || "untyped",
      save: tick.save || null,
    });
  }

  if (kind === "moving_ring_hazard" && payload.damage?.dice) {
    for (const trigger of ["enter_area", "turn_start"]) {
      object.effects.push({
        type: "damage",
        trigger,
        damage: payload.damage.dice,
        damageType: payload.damage.type || "untyped",
        save: {
          ...(spellRecord.hooks?.save || {}),
          dc: null,
          onSave: "half",
        },
      });
    }
  }

  if (kind === "area_tentacles" && payload.onEnterOrStart?.conditionOnFail) {
    for (const trigger of ["enter_area", "turn_start"]) {
      object.effects.push({
        type: "condition",
        trigger,
        condition: normalizeConditionId(payload.onEnterOrStart.conditionOnFail),
        duration: spellDuration(spellRecord.duration),
        save: {
          ...(spellRecord.hooks?.save || {}),
          dc: null,
          onSave: "negates_effect",
        },
      });
    }
  }

  return object;
}

export function getSpellDamage(spellRecord, options = {}) {
  return options.damage || spellRecord.hooks?.damage?.dice || firstTierDamage(spellRecord.hooks?.damage?.diceByTier) || null;
}

function effectPayloads(applyEffect) {
  const payloads = [applyEffect];
  if (Array.isArray(applyEffect.grants)) payloads.push(...applyEffect.grants);
  if (Array.isArray(applyEffect.effects)) payloads.push(...applyEffect.effects);
  return payloads;
}

function createConditionEffect(payload, spellRecord) {
  const special = specialEffectFromEffect(payload, spellRecord);
  if (special) return special;
  const movement = forcedMovementFromEffect(payload);
  if (movement) return movement;
  const modifier = modifierFromEffect(payload, spellRecord);
  if (modifier) return modifier;
  const condition = conditionFromEffect(payload);
  if (!condition) return null;
  const effect = {
    type: "condition",
    trigger: "failed_save",
    condition,
    duration: durationFromEffect(payload, spellRecord),
    repeatSave: repeatSaveFromEffect(payload, spellRecord),
  };
  if (payload.kind === "hex_curse") {
    effect.damageRider = {
      trigger: "source_hits_with_attack_roll",
      damage: payload.bonusDamage || "1d6",
      damageType: "necrotic",
    };
  }
  if (payload.kind === "temp_hp_with_retal") {
    effect.damageRetaliation = {
      trigger: payload.retaliation?.trigger || "hit_by_melee",
      damage: `${retaliationDamageAmount(payload)}`,
      damageType: payload.retaliation?.damage?.type || "cold",
      requiresTempHp: true,
    };
  }
  return effect;
}

function specialEffectFromEffect(payload, spellRecord) {
  const kind = String(payload?.kind || "").toLowerCase();
  if (kind === "held_flame" && payload.laterAction) {
    return {
      type: "grant_action",
      trigger: "action_resolved",
      target: "self",
      duration: spellDuration(spellRecord.duration),
      action: {
        id: `${spellRecord.id}_hurl`,
        name: `Hurl ${spellRecord.name}`,
        type: "spell_attack",
        cost: "action",
        range: feetToSquares(payload.laterAction.rangeFt || 60),
        attackBonus: 0,
        damage: payload.laterAction.damage?.dice || spellRecord.hooks?.damage?.dice,
        damageType: payload.laterAction.damage?.type || spellRecord.hooks?.damage?.type,
        tags: {
          spell: true,
          attackRoll: true,
          ranged: true,
          harmful: true,
          requiresSight: true,
          requiresSpeech: spellRecord.components?.v === true,
          requiresHands: spellRecord.components?.s === true,
        },
      },
    };
  }
  if (kind === "temp_hp_with_retal") {
    return [
      {
        type: "temp_hp",
        trigger: "action_resolved",
        target: "self",
        amount: payload.tempHP?.base || 0,
        duration: durationFromEffect(payload, spellRecord),
      },
      {
        type: "condition",
        trigger: "action_resolved",
        target: "self",
        condition: "armor_of_agathys",
        duration: durationFromEffect(payload, spellRecord),
        damageRetaliation: {
          trigger: payload.retaliation?.trigger || "hit_by_melee",
          damage: `${retaliationDamageAmount(payload)}`,
          damageType: payload.retaliation?.damage?.type || "cold",
          requiresTempHp: true,
        },
      },
    ];
  }
  return null;
}

function forcedMovementFromEffect(payload) {
  const kind = String(payload?.kind || "").toLowerCase();
  if (kind === "push") {
    return {
      type: "forced_movement",
      trigger: "failed_save",
      direction: "away_from_source",
      distanceSquares: feetToSquares(payload.distanceFt || payload.distance || 0),
    };
  }
  if (kind === "pull_toward_caster") {
    return {
      type: "forced_movement",
      trigger: "hit",
      direction: "toward_source",
      distanceSquares: feetToSquares(payload.distanceFt || payload.distance || 0),
    };
  }
  return null;
}

function normalizeObjectShape(shape) {
  if (shape === "sphere" || shape === "cylinder") return "radius";
  return shape || "radius";
}

function retaliationDamageAmount(payload) {
  if (Number.isFinite(payload.retaliation?.damage?.amount)) return payload.retaliation.damage.amount;
  if (payload.retaliation?.damage?.amountFrom === "slotLevel") return payload.slotLevel ?? 1;
  if (payload.retaliation?.damage?.amountFrom === "tempHPBase") return payload.tempHP?.base || 0;
  return payload.tempHP?.base || 1;
}

function modifierFromEffect(payload, spellRecord) {
  const kind = String(payload?.kind || "").toLowerCase();
  if (kind === "speed_penalty") {
    return {
      type: "modifier",
      trigger: "hit",
      stat: "speed",
      amount: -Math.abs(feetToSquares(payload.amountFt || payload.amount || 0)),
      duration: durationFromEffect(payload, spellRecord),
    };
  }
  if (kind === "attack_save_bonus") {
    const die = typeof payload.amount === "string" ? payload.amount : payload.die;
    return [
      bonusModifier("attack_roll", payload, spellRecord, die, 1),
      bonusModifier("save", payload, spellRecord, die, 1),
    ];
  }
  if (kind === "attack_save_penalty") {
    const die = typeof payload.amount === "string" ? payload.amount : payload.die;
    return [
      bonusModifier("attack_roll", payload, spellRecord, die, -1),
      bonusModifier("save", payload, spellRecord, die, -1),
    ];
  }
  if (kind === "guidance_skill_bonus") {
    return {
      type: "modifier",
      trigger: "action_resolved",
      stat: "ability_check",
      amount: Number.isFinite(payload.amount) ? payload.amount : 0,
      die: payload.bonus || payload.die || null,
      target: "target",
      duration: durationFromEffect(payload, spellRecord),
    };
  }
  if (kind === "ac_bonus") {
    return {
      type: "modifier",
      trigger: "action_resolved",
      stat: "ac",
      amount: payload.amount || 0,
      target: "target",
      duration: durationFromEffect(payload, spellRecord),
    };
  }
  if (kind === "shield_reaction") {
    return {
      type: "modifier",
      trigger: "action_resolved",
      stat: "ac",
      amount: payload.acBonus || 5,
      target: "self",
      duration: durationFromEffect({ until: "start_of_caster_next_turn" }, spellRecord),
    };
  }
  if (kind === "incoming_attack_roll_penalty") {
    return {
      type: "modifier",
      trigger: "action_resolved",
      stat: "incoming_attack_roll",
      amount: payload.amount || 0,
      die: payload.die || null,
      multiplier: -1,
      target: "self",
      duration: durationFromEffect(payload, spellRecord),
    };
  }
  if (kind === "typed_damage_reduction") {
    return {
      type: "modifier",
      trigger: "action_resolved",
      stat: "damage_reduction",
      amount: payload.amount || 0,
      die: payload.die || null,
      damageType: payload.damageType || "all",
      target: "target",
      duration: durationFromEffect(payload, spellRecord),
    };
  }
  if (kind === "mage_armor") {
    return {
      type: "modifier",
      trigger: "action_resolved",
      stat: "ac_formula",
      base: payload.acBase || 13,
      addDex: payload.addDex === true,
      target: "target",
      duration: durationFromEffect(payload, spellRecord),
    };
  }
  return null;
}

function bonusModifier(stat, payload, spellRecord, die, sign) {
  return {
    type: "modifier",
    trigger: sign > 0 ? "action_resolved" : "failed_save",
    stat,
    amount: Number.isFinite(payload.amount) ? sign * Math.abs(payload.amount) : 0,
    die: die || null,
    multiplier: sign < 0 ? -1 : undefined,
    target: "target",
    duration: durationFromEffect(payload, spellRecord),
  };
}

function conditionFromEffect(payload) {
  const kind = String(payload?.kind || "").toLowerCase();
  if (kind === "disadvantage_next_attack" || kind === "disadvantage_next_weapon_attack") return "next_attack_disadvantage";
  if (kind === "advantage_next_attack_against_target") return "next_incoming_attack_advantage";
  if (kind === "entangle_area" && payload.restrainedOnFail) return "restrained";
  if (kind === "faerie_fire" && payload.grantsAdvantageToAttackers) return "next_incoming_attack_advantage";
  if (kind === "sleep_2024") return normalizeConditionId(payload.firstFailedSaveCondition);
  if (kind === "local_banish_stasis") return "banished";
  if (kind === "expeditious_retreat") return "expeditious_retreat";
  if (kind === "sanctuary_self") return "sanctuary";
  if (kind === "hex_curse") return "hexed";
  if (kind === "apply_condition_bundle" && normalizeConditionId(payload.name) === "wracked_by_pain") return "wracked_by_pain";
  if (kind === "no_reactions_on_fail") return "reactions_blocked";
  if (kind === "no_opportunity_attacks") return "opportunity_attacks_blocked";
  if (kind === "charmed") return "charmed";
  if (kind === "frightened") return "frightened";
  if (kind === "condition" || kind === "apply_condition") return normalizeConditionId(payload.name || payload.condition);
  return null;
}

function repeatSaveFromEffect(payload, spellRecord) {
  if (String(payload?.kind || "").toLowerCase() === "sleep_2024") {
    return {
      timing: "turn_end",
      ability: normalizeAbility(spellRecord.hooks?.save?.ability),
      dc: null,
      removeOnSuccess: true,
      onFailureCondition: normalizeConditionId(payload.secondFailedSaveCondition),
    };
  }
  const repeatSave = payload.saveEndsEachTurn || repeatSaveFromTicks(spellRecord.hooks?.ticks);
  if (!repeatSave) return null;
  return {
    timing: "turn_end",
    ability: normalizeAbility(repeatSave.ability),
    dc: repeatSave.dc ?? null,
    removeOnSuccess: true,
  };
}

function repeatSaveFromTicks(ticks = []) {
  const turnEndSave = ticks.find((tick) => tick.phase === "turn_end" && tick.save?.onSave === "end_spell");
  return turnEndSave?.save || null;
}

function durationFromEffect(payload, spellRecord) {
  if (payload.until === "end_of_spell" || payload.until === "end_of_duration") return spellDuration(spellRecord.duration);
  if (payload.until === "end_of_target_next_turn") return "turn_end";
  if (payload.until === "start_of_caster_next_turn") return "turn_start";
  if (Number.isFinite(payload.durationRounds)) return { kind: "rounds", rounds: payload.durationRounds, tick: "turn_end" };
  if (Number.isFinite(payload.maxRounds)) return { kind: "rounds", rounds: payload.maxRounds, tick: "turn_end" };
  return null;
}

function spellDuration(duration = {}) {
  if (duration.type !== "timed" || !Number.isFinite(duration.value)) return null;
  const unit = duration.unit || "rounds";
  const rounds = unit === "seconds" ? Math.ceil(duration.value / 6) : duration.value;
  return { kind: "rounds", rounds, tick: "turn_end" };
}

function firstTierDamage(diceByTier) {
  if (!diceByTier || typeof diceByTier !== "object") return null;
  const firstKey = Object.keys(diceByTier)
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b)[0];
  const value = diceByTier[firstKey];
  return typeof value === "string" ? value : value?.dice || null;
}

function normalizeConditionId(name) {
  return name ? String(name).trim().toLowerCase().replace(/\s+/g, "_") : null;
}

function normalizeAbility(ability) {
  return ability ? String(ability).toLowerCase().slice(0, 3) : null;
}

function feetToSquares(feet) {
  return Math.max(0, Math.ceil((Number(feet) || 0) / 5));
}
