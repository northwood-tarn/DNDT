import {
  createSpellActionExtrasFromScaling,
  getScaledSpellDamage,
  scaleSlotDamage,
} from "./spellScaling.js";

export function createEffectsFromSpell(spellRecord, options = {}) {
  const applyEffect = spellRecord.hooks?.applyEffect;
  if (!applyEffect) return [];
  const effects = effectPayloads(applyEffect)
    .flatMap((payload) => {
      const effect = createConditionEffect(payload, spellRecord, options);
      return Array.isArray(effect) ? effect : [effect];
    })
    .filter(Boolean);
  return effects;
}

export function createCombatObjectFromSpell(spellRecord, options = {}) {
  const payload = spellRecord.hooks?.applyEffect;
  const kind = String(payload?.kind || "").toLowerCase();
  if (![
    "area_obscure",
    "hazard_zone",
    "area_hazard",
    "wall",
    "moving_ring_hazard",
    "area_tentacles",
    "aura_hazard",
    "containment",
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
    blocksBoundaryMovement: payload.blocksBoundaryMovement === true || kind === "containment",
    blocksTeleport: payload.blocksTeleport === true,
    teleportSaveAbility: payload.teleportSaveAbility || null,
    immuneToDispel: payload.immuneToDispel === true,
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
      damage: getScaledSpellDamage(spellRecord, { ...options, damage: tick.damage.dice }),
      damageType: tick.damage.type || "untyped",
      save: tick.save || (spellRecord.hooks?.save ? { ...spellRecord.hooks.save, dc: null } : null),
      affects: payload.targetTeam || "all",
      conditionOnFail: tick.conditionOnFail ? normalizeConditionId(tick.conditionOnFail) : null,
      pushOnFailFt: Number(tick.pushOnFailFt) || 0,
    });
  }

  if (kind === "aura_hazard" || kind === "area_hazard") {
    const initial = object.effects.find((effect) => effect.type === "damage");
    if (initial) object.effects.unshift({ ...structuredClone(initial), trigger: "area_created" });
  }

  if (kind === "moving_ring_hazard" && payload.damage?.dice) {
    for (const trigger of ["enter_area", "turn_start"]) {
      object.effects.push({
        type: "damage",
        trigger,
        damage: scaleSlotDamage(payload.damage.dice, payload.scaling?.per2SlotsAboveBase, options.slotLevel || spellRecord.level),
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
  return getScaledSpellDamage(spellRecord, options);
}

export function createSpellActionExtras(spellRecord, options = {}) {
  const applyEffect = spellRecord.hooks?.applyEffect;
  return {
    ...createSpellActionExtrasFromScaling(spellRecord, options),
    ...areaExtrasFromEffect(applyEffect),
    ...(String(applyEffect?.kind || "").toLowerCase() === "chain_targets"
      ? { linkedTargetRange: feetToSquares(applyEffect.secondaryRangeFt || 30) }
      : {}),
    ...(Array.isArray(spellRecord.hooks?.damage?.randomChoices)
      ? { randomDamageTypeChoices: [...spellRecord.hooks.damage.randomChoices] }
      : {}),
    ...(String(applyEffect?.kind || "").toLowerCase() === "temp_hp_pool"
      ? { tempHpPool: Number(applyEffect.amount) || 0 }
      : {}),
    ...(Array.isArray(applyEffect?.saveAbilityChoices)
      ? { saveAbilityChoices: [...applyEffect.saveAbilityChoices] }
      : {}),
    ...(applyEffect?.primaryDamage?.dice && applyEffect?.secondaryDamageChoice?.dice
      ? {
          damageParts: [
            { damage: applyEffect.primaryDamage.dice, damageType: applyEffect.primaryDamage.type },
            { damage: applyEffect.secondaryDamageChoice.dice, damageType: applyEffect.secondaryDamageChoice.choices?.[0], damageTypeChoices: [...(applyEffect.secondaryDamageChoice.choices || [])] },
          ],
          damageTypeChoices: [...(applyEffect.secondaryDamageChoice.choices || [])],
        }
      : {}),
  };
}

function effectPayloads(applyEffect) {
  const payloads = [applyEffect];
  if (Array.isArray(applyEffect.grants)) payloads.push(...applyEffect.grants);
  if (Array.isArray(applyEffect.effects)) payloads.push(...applyEffect.effects);
  return payloads;
}

function createConditionEffect(payload, spellRecord, options = {}) {
  const special = specialEffectFromEffect(payload, spellRecord, options);
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

function specialEffectFromEffect(payload, spellRecord, options = {}) {
  const kind = String(payload?.kind || "").toLowerCase();
  if (kind === "weapon_enchantment") {
    const slotLevel = Number(options.slotLevel || spellRecord.level);
    const secondTier = Number(payload.secondTierSlot || 4);
    const thirdTier = Number(payload.thirdTierSlot || 6);
    const bonus = slotLevel >= thirdTier ? 3 : slotLevel >= secondTier ? 2 : Number(payload.attackBonus || 1);
    const damageDice = slotLevel >= 7 ? "3d4" : slotLevel >= 5 ? "2d4" : payload.damageDice;
    return {
      type: "modifier",
      trigger: "action_resolved",
      target: "target",
      stat: "attack_roll",
      amount: bonus,
      tags: ["weapon"],
      duration: spellDuration(spellRecord.duration),
      damageTypeChoices: [...(payload.damageTypeChoices || [])],
      damageRider: {
        trigger: "source_hits_with_attack_roll",
        actionTags: ["weapon"],
        damage: damageDice || String(bonus),
        damageType: damageDice
          ? options.damageType || payload.damageTypeChoices?.[0] || payload.damageType || "fire"
          : "same_as_action",
      },
    };
  }
  if (kind === "smite_charge") {
    return {
      type: "modifier",
      trigger: "action_resolved",
      target: "self",
      stat: "attack_roll",
      amount: 0,
      duration: spellDuration(spellRecord.duration),
      remainingHits: 1,
      removeWhenSpent: true,
      damageRider: {
        trigger: "source_hits_with_attack_roll",
        actionTags: ["melee", "weapon"],
        damage: payload.damage,
        damageType: payload.damageType,
        save: payload.save ? { ...payload.save, dc: options.spellSaveDC } : null,
        effects: (payload.effects || []).map((effect) => ({
          ...effect,
          trigger: "hit",
          duration: effect.duration || { kind: "rounds", remaining: 1, tick: "turn_end", anchor: "target" },
        })),
      },
    };
  }
  if (kind === "support_aura") {
    return {
      type: "aura",
      trigger: "action_resolved",
      target: "self",
      duration: spellDuration(spellRecord.duration),
      aura: {
        id: spellRecord.id,
        name: spellRecord.name,
        radiusSquares: feetToSquares(payload.radiusFt || 30),
        affects: "self_and_allies",
        effects: structuredClone(payload.effects || []),
      },
    };
  }
  if (kind === "protective_save_aura") {
    return {
      type: "aura",
      trigger: "action_resolved",
      target: "self",
      duration: spellDuration(spellRecord.duration),
      aura: {
        id: spellRecord.id,
        name: spellRecord.name,
        radiusSquares: feetToSquares(payload.radiusFt || 30),
        affects: "self_and_allies",
        effects: [
          { type: "modifier", trigger: "passive", stat: "save", mode: "advantage", tags: ["spell", "magical_effect"] },
          { type: "save_evasion", trigger: "passive", tags: ["spell", "magical_effect"] },
        ],
      },
    };
  }
  if (kind === "temp_hp_pool") {
    return { type: "temp_hp", trigger: "action_resolved", target: "target", amount: Number(payload.amount) || 0 };
  }
  if (kind === "pestilence_debuff") {
    return [
      { type: "condition", trigger: "failed_save", condition: "poisoned", duration: durationFromEffect(payload, spellRecord) },
      { type: "modifier", trigger: "failed_save", stat: "save", mode: "disadvantage", ability: "con", target: "target", duration: durationFromEffect(payload, spellRecord) },
    ];
  }
  if (kind === "light") {
    return { type: "light_source", trigger: "action_resolved", target: "target", brightFt: payload.brightFt || 20, dimFt: payload.dimFt || 20, duration: spellDuration(spellRecord.duration) };
  }
  if (kind === "max_hp_bonus") {
    const levelsAbove = Math.max(0, Number(options.slotLevel || spellRecord.level) - Number(payload.baseLevel || spellRecord.level));
    return { type: "max_hp_bonus", trigger: "action_resolved", target: "target", amount: Number(payload.amount || 0) + levelsAbove * Number(payload.addPerSlotAboveBase || 0), duration: spellDuration(spellRecord.duration) };
  }
  if (kind === "death_ward") return { type: "death_ward", trigger: "action_resolved", target: "target", duration: spellDuration(spellRecord.duration) };
  if (kind === "dispel_magic") return { type: "dispel_magic", trigger: "action_resolved", target: "target", maximumAutomaticSpellLevel: Number(options.slotLevel || spellRecord.level) };
  if (kind === "greater_restoration") {
    return { type: "greater_restoration", trigger: "action_resolved", target: "target", conditions: (payload.conditions || []).map(normalizeConditionId), removeExhaustion: Number(payload.removeExhaustion || 0), removeAbilityOrMaxHpReduction: payload.removeAbilityOrMaxHpReduction === true };
  }
  if (kind === "cleanse_all" && Array.isArray(payload.conditions)) {
    return { type: "remove_conditions", trigger: "action_resolved", target: "target", conditions: payload.conditions.map(normalizeConditionId), maxRemoved: payload.conditions.length };
  }
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
    const levelsAbove = Math.max(0, Number(options.slotLevel || spellRecord.level) - spellRecord.level);
    const tempHp = Number(payload.tempHP?.base || 0) + levelsAbove * Number(payload.tempHP?.perSlotAboveFirst || 0);
    return [
      {
        type: "temp_hp",
        trigger: "action_resolved",
        target: "self",
        amount: tempHp,
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
          damage: `${payload.retaliation?.damage?.amountFrom === "tempHPBase" ? tempHp : retaliationDamageAmount(payload)}`,
          damageType: payload.retaliation?.damage?.type || "cold",
          requiresTempHp: true,
        },
      },
    ];
  }
  if (kind === "conjured_blade" && payload.attack && payload.damage) {
    return {
      type: "grant_action",
      trigger: "action_resolved",
      target: "self",
      duration: spellDuration(spellRecord.duration),
      action: {
        id: `${spellRecord.id}_attack`,
        name: `${spellRecord.name}: Strike`,
        type: "spell_attack",
        cost: payload.attack.asBonusActionEachTurn ? "bonus" : "action",
        range: 1,
        attackBonus: options.attackBonus ?? 0,
        damage: scaleSlotDamage(payload.damage.dice, payload.scaling?.per2SlotsAboveBase, options.slotLevel || spellRecord.level),
        damageType: payload.damage.type || "fire",
        tags: {
          spell: true,
          attackRoll: true,
          melee: true,
          harmful: true,
          requiresHands: true,
        },
      },
    };
  }
  if (kind === "grant_bonus_action_ability" && payload.ability?.type === "teleport") {
    const rangeFt = payload.ability.distanceFt || 30;
    return {
      type: "grant_action",
      trigger: "action_resolved",
      target: "self",
      duration: spellDuration(spellRecord.duration),
      action: {
        id: `${spellRecord.id}_teleport`,
        name: payload.name || `${spellRecord.name}: Teleport`,
        type: "spell_teleport",
        cost: "bonus",
        requiresTarget: true,
        range: feetToSquares(rangeFt),
        targeting: {
          shape: "radius",
          radiusSquares: feetToSquares(rangeFt),
          radiusFt: rangeFt,
        },
        tags: {
          spell: true,
          harmful: false,
          requiresSight: payload.ability.requiresSight === true,
        },
      },
    };
  }
  if (kind === "cleanse_one" && Array.isArray(payload.conditions)) {
    return {
      type: "remove_conditions",
      trigger: "action_resolved",
      target: "target",
      conditions: payload.conditions.map(normalizeConditionId),
      maxRemoved: 1,
    };
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
  if (kind === "random_move") {
    return {
      type: "forced_movement",
      trigger: "failed_save",
      direction: "away_from_source",
      distanceSquares: feetToSquares(payload.distanceFt || payload.distance || 0),
    };
  }
  return null;
}

function normalizeObjectShape(shape) {
  if (shape === "sphere" || shape === "cylinder") return "radius";
  return shape || "radius";
}

function areaExtrasFromEffect(applyEffect) {
  const kind = String(applyEffect?.kind || "").toLowerCase();
  if (kind === "area_affects_enemies_only") return { selfCenteredArea: true, targetTeamFilter: "enemies" };
  if (kind === "area_around_caster") return { selfCenteredArea: true, targetTeamFilter: "enemies" };
  return {};
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
  if (kind === "penalty_next_save") {
    return {
      type: "modifier",
      trigger: "failed_save",
      stat: "save",
      amount: 0,
      die: payload.amount || payload.die || "1d4",
      multiplier: -1,
      target: "target",
      consumeOn: "outgoing_save",
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
  if (["pestilence_debuff", "area_around_caster"].includes(kind) && payload?.condition) return normalizeConditionId(payload.condition);
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
  if (kind === "no_healing") return "healing_blocked";
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
  const rounds = unit === "seconds"
    ? Math.ceil(duration.value / 6)
    : unit === "minutes"
      ? Math.ceil(duration.value * 10)
      : unit === "hours"
        ? Math.ceil(duration.value * 600)
        : duration.value;
  return { kind: "rounds", rounds, tick: "turn_end" };
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
