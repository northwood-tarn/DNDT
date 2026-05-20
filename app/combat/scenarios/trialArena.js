import { consumables } from "../../data/consumables.js";
import { SPELLS } from "../../data/spells.js";
import { weapons } from "../../data/weapons.js";
import { createConsumableAction, createSpellAction, createWeaponAction, indexRecordsById } from "../actionFactory.js";

const CONSUMABLES = indexRecordsById(consumables);
const WEAPONS = indexRecordsById(weapons);

export function createTrialArenaScenario() {
  return {
    id: "trial-arena",
    grid: {
      width: 10,
      height: 10,
      blocked: [
        { x: 4, y: 4 },
        { x: 6, y: 5 },
      ],
      cover: [
        { x: 6, y: 5, kind: "three_quarters" },
        { x: 2, y: 6, kind: "half" },
      ],
    },
    actors: [
      {
        id: "trial_pc",
        name: "PC Fighter",
        team: "heroes",
        role: "fighter",
        token: "P",
        hp: 48,
        maxHp: 48,
        ac: 17,
        initiativeBonus: 3,
        speed: 6,
        position: { x: 1, y: 1 },
        saves: { str: 4, dex: 2, con: 4, int: 1, wis: 3, cha: 1 },
        actions: compactActions([
          createWeaponAction(WEAPONS.longsword, {
            id: "sword",
            name: "Sword",
            attackBonus: 5,
            damageBonus: 3,
          }),
          createSpellAction(SPELLS.fire_bolt, {
            attackBonus: 5,
          }),
          createConsumableAction(CONSUMABLES.healing_potion, {
            id: "health_potion",
            name: "Health Potion",
          }),
          createConsumableAction(CONSUMABLES.greater_healing_potion),
          createConsumableAction(CONSUMABLES.superior_healing_potion),
          createConsumableAction(CONSUMABLES.supreme_healing_potion),
          createConsumableAction(CONSUMABLES.antitoxin),
          createConsumableAction(CONSUMABLES.acid_vial),
          createConsumableAction(CONSUMABLES.alchemists_fire),
          createConsumableAction(CONSUMABLES.holy_water),
          createConsumableAction(CONSUMABLES.oil_flask),
          createConsumableAction(CONSUMABLES.caltrops),
          createConsumableAction(CONSUMABLES.ball_bearings),
          createConsumableAction(CONSUMABLES.hunting_trap),
          createConsumableAction(CONSUMABLES.basic_poison),
          createConsumableAction(CONSUMABLES.healers_kit),
          createSpellAction(SPELLS.vicious_mockery, {
            spellSaveDC: 13,
          }),
          createSpellAction(SPELLS.guiding_bolt, {
            attackBonus: 5,
          }),
          createSpellAction(SPELLS.hold_person, {
            spellSaveDC: 13,
          }),
          createSpellAction(SPELLS.entangle, {
            spellSaveDC: 13,
          }),
          createSpellAction(SPELLS.burning_hands, {
            spellSaveDC: 15,
          }),
          createSpellAction(SPELLS.thunderwave, {
            spellSaveDC: 15,
          }),
          createSpellAction(SPELLS.fireball, {
            spellSaveDC: 15,
          }),
          {
            id: "second_wind",
            name: "Second Wind",
            type: "self_heal",
            cost: "bonus",
            requiresTarget: false,
            healing: "1d10+1",
          },
          {
            id: "push",
            name: "Push",
            type: "push",
            range: 1,
            distanceSquares: 2,
            collisionDamage: "1d4",
            collisionDamageType: "bludgeoning",
          },
          {
            id: "target_test",
            name: "Target Test",
            type: "target_test",
            requiresTarget: true,
          },
        ]),
        inventory: [
          { id: "healing_potion", qty: 2 },
          { id: "greater_healing_potion", qty: 1 },
          { id: "superior_healing_potion", qty: 1 },
          { id: "supreme_healing_potion", qty: 1 },
          { id: "antitoxin", qty: 1 },
          { id: "acid_vial", qty: 2 },
          { id: "alchemists_fire", qty: 2 },
          { id: "holy_water", qty: 2 },
          { id: "oil_flask", qty: 2 },
          { id: "caltrops", qty: 1 },
          { id: "ball_bearings", qty: 1 },
          { id: "hunting_trap", qty: 1 },
          { id: "basic_poison", qty: 1 },
          { id: "healers_kit", qty: 10 },
        ],
      },
      {
        id: "trial_enemy",
        name: "Enemy Swordsman",
        team: "enemies",
        role: "swordsman",
        ai: { profile: "melee", targetPriority: "nearest" },
        token: "E",
        hp: 48,
        maxHp: 48,
        ac: 15,
        initiativeBonus: 1,
        speed: 6,
        position: { x: 8, y: 8 },
        saves: { str: 3, dex: 2, con: 2, int: 0, wis: 0, cha: 0 },
        actions: compactActions([
          {
            ...createWeaponAction(WEAPONS.longsword, {
              id: "strong_first_hit",
              name: "Strong First Hit",
              attackBonus: 4,
              damageBonus: 2,
            }),
            id: "strong_first_hit",
            uses: { max: 1 },
            effects: [
              { type: "condition", trigger: "hit", condition: "prone", noSave: true, consumeUseOnApply: true },
            ],
          },
          createWeaponAction(WEAPONS.longsword, {
            id: "blade",
            name: "Sword",
            attackBonus: 4,
            damageBonus: 2,
          }),
          createWeaponAction(WEAPONS.shortbow, {
            id: "shortbow",
            name: "Shortbow",
            range: 12,
            attackBonus: 4,
            damageBonus: 2,
          }),
          {
            id: "push",
            name: "Push",
            type: "push",
            range: 1,
            distanceSquares: 2,
            collisionDamage: "1d4",
            collisionDamageType: "bludgeoning",
          },
        ]),
      },
    ],
  };
}

function compactActions(actions) {
  return actions.filter(Boolean);
}
