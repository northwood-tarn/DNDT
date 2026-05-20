import { SPELLS } from "../../data/spells.js";
import { weapons } from "../../data/weapons.js";
import { createSpellAction, createWeaponAction, indexRecordsById } from "../actionFactory.js";

const WEAPONS = indexRecordsById(weapons);

export function createTestScenario() {
  return {
    id: "tight-combat-test",
    grid: {
      width: 24,
      height: 16,
      blocked: [
        { x: 6, y: 3 }, { x: 6, y: 4 },
        { x: 11, y: 7 }, { x: 12, y: 7 },
        { x: 16, y: 4 }, { x: 16, y: 5 },
        { x: 18, y: 11 }, { x: 19, y: 11 },
        { x: 8, y: 12 },
      ],
      cover: [
        { x: 7, y: 4, kind: "three_quarters" },
        { x: 15, y: 5, kind: "three_quarters" },
        { x: 17, y: 11, kind: "three_quarters" },
        { x: 9, y: 5, kind: "half" },
        { x: 10, y: 5, kind: "half" },
        { x: 13, y: 10, kind: "half" },
        { x: 14, y: 10, kind: "half" },
        { x: 20, y: 10, kind: "half" },
      ],
    },
    actors: [
      {
        id: "fighter",
        name: "PC Fighter",
        team: "heroes",
        role: "fighter",
        token: "F",
        hp: 34,
        maxHp: 34,
        ac: 17,
        initiativeBonus: 1,
        speed: 6,
        position: { x: 3, y: 8 },
        saves: { dex: 1, con: 4, wis: 1 },
        actions: compactActions([
          createWeaponAction(WEAPONS.longsword, {
            id: "sword",
            name: "Sword",
            attackBonus: 5,
            damageBonus: 3,
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
        ]),
      },
      {
        id: "wizard",
        name: "PC Wizard",
        team: "heroes",
        role: "wizard",
        token: "W",
        hp: 22,
        maxHp: 22,
        ac: 13,
        initiativeBonus: 2,
        speed: 6,
        position: { x: 3, y: 10 },
        saves: { dex: 2, con: 1, wis: 3 },
        actions: compactActions([
          createSpellAction(SPELLS.fire_bolt, {
            attackBonus: 5,
          }),
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
            id: "target_test",
            name: "Target Test",
            type: "target_test",
            requiresTarget: true,
          },
        ]),
      },
      {
        id: "archer_1",
        name: "Enemy Archer 1",
        team: "enemies",
        role: "archer",
        ai: { profile: "archer", targetPriority: "weakest_visible", preferCover: true },
        token: "A",
        hp: 14,
        maxHp: 14,
        ac: 13,
        initiativeBonus: 2,
        speed: 6,
        position: { x: 18, y: 5 },
        saves: { dex: 2, con: 1, wis: 0 },
        actions: compactActions([
          createWeaponAction(WEAPONS.shortbow, {
            id: "shortbow",
            name: "Shortbow",
            range: 12,
            attackBonus: 4,
            damageBonus: 2,
          }),
        ]),
      },
      {
        id: "archer_2",
        name: "Enemy Archer 2",
        team: "enemies",
        role: "archer",
        ai: { profile: "archer", targetPriority: "weakest_visible", preferCover: true },
        token: "A",
        hp: 14,
        maxHp: 14,
        ac: 13,
        initiativeBonus: 2,
        speed: 6,
        position: { x: 20, y: 12 },
        saves: { dex: 2, con: 1, wis: 0 },
        actions: compactActions([
          createWeaponAction(WEAPONS.shortbow, {
            id: "shortbow",
            name: "Shortbow",
            range: 12,
            attackBonus: 4,
            damageBonus: 2,
          }),
        ]),
      },
      {
        id: "swordsman",
        name: "Enemy Swordsman",
        team: "enemies",
        role: "swordsman",
        ai: { profile: "melee", targetPriority: "nearest" },
        token: "S",
        hp: 20,
        maxHp: 20,
        ac: 15,
        initiativeBonus: 1,
        speed: 6,
        position: { x: 17, y: 8 },
        saves: { dex: 1, con: 2, wis: 0 },
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
              {
                type: "condition",
                trigger: "hit",
                condition: "prone",
                noSave: true,
                consumeUseOnApply: true,
              },
            ],
          },
          createWeaponAction(WEAPONS.longsword, {
            id: "blade",
            name: "Sword",
            attackBonus: 4,
            damageBonus: 2,
          }),
        ]),
      },
    ],
  };
}

function compactActions(actions) {
  return actions.filter(Boolean);
}
