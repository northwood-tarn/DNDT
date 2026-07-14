export function createActionFromConsumable(consumableRecord, options = {}) {
  if (!consumableRecord || consumableRecord.type !== "usable" || !["combat", "anywhere"].includes(consumableRecord.availability)) return null;
  const combat = consumableRecord.runtime || {};
  const base = {
    id: options.id || consumableRecord.id,
    name: options.name || consumableRecord.name,
    cost: mapCombatCost(options.cost || consumableRecord.combatCost),
    itemId: consumableRecord.id,
    description: consumableRecord.inspectText || consumableRecord.name,
    consumeOnResolve: consumableRecord.consumedOnUse !== false,
  };

  if (combat.kind === "healing") {
    return {
      ...base,
      type: "consumable",
      requiresTarget: false,
      healing: options.healing || resourceFormula(consumableRecord, "health") || combat.healing,
      tags: { harmful: false },
    };
  }

  if (combat.kind === "thrown_damage" || combat.kind === "thrown_ongoing_damage") {
    return {
      ...base,
      type: "weapon_attack",
      requiresTarget: true,
      range: consumableRecord.delivery?.range ?? feetToSquares(combat.rangeFt || 20),
      attackBonus: options.attackBonus ?? 0,
      damage: combat.damage,
      damageType: combat.damageType,
      effects: combat.kind === "thrown_ongoing_damage" ? ongoingDamageEffects(combat) : [],
      tags: { harmful: true, attackRoll: true, ranged: true, consumable: true },
    };
  }

  if (combat.kind === "area_damage") {
    return {
      ...base,
      type: "spell_area_save",
      requiresTarget: true,
      range: consumableRecord.delivery?.range ?? feetToSquares(combat.rangeFt || 20),
      saveAbility: abbreviateAbility(consumableRecord.delivery?.resolution?.ability) || combat.save?.ability || "dex",
      spellSaveDC: consumableRecord.delivery?.resolution?.dc || combat.save?.dc || options.spellSaveDC || 10,
      damage: combat.damage,
      damageType: combat.damageType,
      targeting: targetingFromArea(combat.area),
      tags: { harmful: true, savingThrow: true, consumable: true },
    };
  }

  if (["deployable_hazard", "deployable_trap", "flammable_oil", "obscuring_area"].includes(combat.kind)) {
    return {
      ...base,
      type: "spell_object",
      requiresTarget: true,
      range: feetToSquares(combat.rangeFt || 5),
      object: objectFromConsumable(consumableRecord),
      targeting: targetingFromArea(combat.area || { shape: "square", sizeFt: 5 }),
      tags: { harmful: combat.kind !== "obscuring_area", consumable: true },
    };
  }

  if (combat.kind === "condition_defense") {
    return {
      ...base,
      type: "spell_effect",
      requiresTarget: false,
      range: 0,
      effects: [
        {
          type: "modifier",
          trigger: "action_resolved",
          target: "self",
          stat: "save",
          ability: "all",
          amount: 0,
          label: consumableRecord.name,
          duration: { kind: "rounds", rounds: combat.durationRounds || 600, remaining: combat.durationRounds || 600, tick: "turn_end" },
        },
      ],
      tags: { harmful: false, consumable: true },
    };
  }

  if (combat.kind === "weapon_damage_buff" || combat.kind === "weapon_coating") {
    return {
      ...base,
      type: "spell_effect",
      requiresTarget: false,
      range: 0,
      effects: [weaponRiderEffect(consumableRecord)],
      tags: { harmful: false, consumable: true },
    };
  }

  if (combat.kind === "stabilize") {
    return {
      ...base,
      type: "spell_effect",
      requiresTarget: true,
      allowDefeatedTarget: true,
      requiresDefeatedTarget: true,
      range: 1,
      effects: [{ type: "condition", trigger: "action_resolved", condition: "stable", noSave: true, skipDefeated: false }],
      tags: { harmful: false, consumable: true },
    };
  }

  return null;
}

function objectFromConsumable(item) {
  const combat = item.runtime || {};
  const area = combat.area || {};
  const effects = [];
  if (combat.damage || combat.ignitedDamage) {
    effects.push({
      type: "damage",
      trigger: "enter_area",
      damage: combat.damage || combat.ignitedDamage,
      damageType: combat.damageType || "untyped",
      save: combat.save ? { ...combat.save, onSave: combat.save.onSave || "negates" } : null,
    });
  }
  if (combat.condition) {
    effects.push({
      type: "condition",
      trigger: "enter_area",
      condition: combat.condition,
      save: combat.save ? { ...combat.save, onSave: "negates" } : null,
      end: combat.escape
        ? {
            type: "action",
            id: `${item.id}_escape`,
            label: `Escape ${item.name}`,
            cost: "action",
            check: combat.escape,
            description: `Spend an action and pass a ${String(combat.escape.ability).toUpperCase()} check to escape ${item.name}.`,
          }
        : null,
    });
  }
  return {
    name: item.name,
    shape: areaShape(area),
    radiusFt: area.radiusFt || 0,
    sizeFt: area.sizeFt || 5,
    difficultTerrain: combat.kind === "deployable_hazard",
    blocksLineOfSight: combat.kind === "obscuring_area",
    effects,
    duration: combat.durationRounds
      ? { kind: "rounds", rounds: combat.durationRounds, remaining: combat.durationRounds, tick: "turn_end" }
      : null,
    visual: combat.kind === "obscuring_area" ? { tint: "smoke" } : null,
  };
}

function ongoingDamageEffects(combat) {
  return [
    {
      type: "condition",
      trigger: "hit",
      condition: "burning",
      noSave: true,
      ongoingEffects: [
        {
          type: "damage",
          trigger: combat.repeatTrigger || "turn_start",
          damage: combat.damage,
          damageType: combat.damageType || "untyped",
          label: "Ongoing fire",
          end: combat.endCondition
            ? {
                type: "action",
                id: combat.endCondition,
                label: "Extinguish",
                cost: "action",
                description: "Spend an action to end this ongoing effect.",
              }
            : null,
        },
      ],
      duration: null,
      repeatSave: null,
    },
  ];
}

function weaponRiderEffect(item) {
  const combat = item.runtime || {};
  const damage = combat.bonusDamage || combat.damage;
  const remainingHits = Number.isFinite(combat.maxHits) ? combat.maxHits : null;
  return {
    id: `${item.id}_weapon_rider`,
    type: "modifier",
    trigger: "action_resolved",
    target: "self",
    stat: "attack_roll",
    amount: 0,
    label: item.name,
    remainingHits,
    removeWhenSpent: remainingHits !== null,
    damageRider: damage
      ? {
          id: `${item.id}_damage_rider`,
          name: item.name,
          trigger: "source_hits_with_attack_roll",
          damage,
          damageType: combat.damageType || "untyped",
          save: combat.save ? { ...combat.save, onSave: "negates" } : null,
          consumeOnTrigger: combat.kind === "weapon_coating",
        }
      : null,
    duration: combat.durationRounds
      ? { kind: "rounds", rounds: combat.durationRounds, remaining: combat.durationRounds, tick: "turn_end" }
      : null,
  };
}

function targetingFromArea(area = {}) {
  const shape = areaShape(area);
  if (shape === "radius") return { shape, radiusSquares: feetToSquares(area.radiusFt || area.sizeFt || 5), radiusFt: area.radiusFt || area.sizeFt || 5 };
  if (shape === "cube") return { shape, sizeSquares: feetToSquares(area.sizeFt || 5), sizeFt: area.sizeFt || 5 };
  return { shape: "cube", sizeSquares: feetToSquares(area.sizeFt || 5), sizeFt: area.sizeFt || 5 };
}

function areaShape(area = {}) {
  if (area.shape === "radius") return "radius";
  if (area.shape === "cube") return "cube";
  return "cube";
}

function resourceFormula(item, resource) {
  return (item.effects || []).find((effect) => effect.type === "change-resource" && effect.resource === resource)?.amountFormula || null;
}

function mapCombatCost(cost = "action") {
  if (cost === "bonus-action" || cost === "bonus") return "bonus";
  if (cost === "reaction") return "reaction";
  return "action";
}

function abbreviateAbility(ability) {
  return ({ strength: "str", dexterity: "dex", constitution: "con", intelligence: "int", wisdom: "wis", charisma: "cha" })[ability] || ability;
}

function feetToSquares(feet) {
  return Math.max(0, Math.ceil((Number(feet) || 0) / 5));
}
