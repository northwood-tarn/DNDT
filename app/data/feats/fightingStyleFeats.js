import { fightingStyleFeat } from "./builders.js";

export const FIGHTING_STYLE_FEATS_BY_ID = {
  archery: fightingStyleFeat({
    id: "archery",
    name: "Archery",
    description: "Gain +2 to attack rolls with ranged weapons.",
    effects: { modifiers: [{ id: "archery_attack_bonus", target: "attack_roll", stat: "attack_roll", amount: 2, tags: ["weapon", "ranged"] }] },
    tags: ["ranged", "weapon"]
  }),

  blind_fighting: fightingStyleFeat({
    id: "blind_fighting",
    name: "Blind Fighting",
    description: "Gain Blindsight out to 10 feet.",
    effects: { senses: [{ type: "blindsight", rangeFt: 10 }] },
    tags: ["sense"]
  }),

  defense: fightingStyleFeat({
    id: "defense",
    name: "Defense",
    description: "Gain +1 AC while wearing armor.",
    effects: { featureHooks: [{ id: "defense_ac_while_armored", timing: "armor_class", amount: 1, condition: "wearing_armor" }] },
    tags: ["armor", "defense"]
  }),

  dueling: fightingStyleFeat({
    id: "dueling",
    name: "Dueling",
    description: "Gain +2 melee weapon damage while using one one-handed weapon.",
    effects: { featureHooks: [{ id: "dueling_damage", timing: "weapon_damage_roll", amount: 2, tags: ["weapon", "melee"], condition: "one_handed_weapon_only" }] },
    tags: ["melee", "weapon", "damage"]
  }),

  great_weapon_fighting: fightingStyleFeat({
    id: "great_weapon_fighting",
    name: "Great Weapon Fighting",
    description: "Treat low damage rolls on heavy melee weapon dice as stronger results.",
    effects: { featureHooks: [{ id: "great_weapon_fighting_damage_floor", timing: "weapon_damage_roll", tags: ["weapon", "melee", "two_handed_or_versatile"], minimumDieResult: 3 }] },
    tags: ["melee", "weapon", "damage"]
  }),

  two_weapon_fighting: fightingStyleFeat({
    id: "two_weapon_fighting",
    name: "Two-Weapon Fighting",
    description: "Add your ability modifier to the damage of the extra Light weapon attack.",
    effects: { featureHooks: [{ id: "two_weapon_fighting_damage_mod", timing: "offhand_weapon_damage", addAbilityModifier: true }] },
    tags: ["melee", "weapon", "damage"]
  }),

  unarmed_fighting: fightingStyleFeat({
    id: "unarmed_fighting",
    name: "Unarmed Fighting",
    description: "Improve Unarmed Strike damage and hurt one Grappled creature each turn.",
    effects: {
      unarmedStrike: { damage: "1d6", damageWhenHandsFree: "1d8", damageType: "bludgeoning" },
      damageRiders: [{ id: "unarmed_grapple_damage", trigger: "start_of_source_turn", damage: "1d4", damageType: "bludgeoning", requiresConditionOnTarget: "grappled", oncePerTurn: true }]
    },
    tags: ["unarmed", "damage"]
  })
};
