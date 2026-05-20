import { SPELLS } from "../../data/spells.js";
import { weapons } from "../../data/weapons.js";
import { createSpellAction, createWeaponAction, indexRecordsById } from "../actionFactory.js";

const WEAPONS = indexRecordsById(weapons);

export function createSpellMechanicsArenaScenario() {
  return {
    id: "spell-mechanics-arena",
    grid: {
      width: 12,
      height: 10,
      blocked: [
        { x: 5, y: 4 },
      ],
      cover: [
        { x: 7, y: 4, kind: "three_quarters" },
        { x: 3, y: 6, kind: "half" },
      ],
    },
    actors: [
      {
        id: "spell_tester",
        name: "PC Mage",
        team: "heroes",
        role: "wizard",
        token: "W",
        hp: 80,
        maxHp: 80,
        ac: 14,
        initiativeBonus: 5,
        speed: 6,
        position: { x: 1, y: 1 },
        saves: { str: 0, dex: 2, con: 3, int: 5, wis: 3, cha: 1 },
        actions: compactActions([
          createWeaponAction(WEAPONS.shortbow, {
            id: "test_bow",
            name: "Test Bow",
            range: 12,
            attackBonus: 6,
            damageBonus: 3,
          }),
          createSpellAction(SPELLS.produce_flame, { attackBonus: 6 }),
          createSpellAction(SPELLS.magic_missile, { spellSaveDC: 15 }),
          createSpellAction(SPELLS.sleep, { spellSaveDC: 15 }),
          createSpellAction(SPELLS.sanctuary, { spellSaveDC: 15 }),
          createSpellAction(SPELLS.conjure_vermin, { spellSaveDC: 15 }),
          createSpellAction(SPELLS.armor_of_agathys, { spellSaveDC: 15 }),
          createSpellAction(SPELLS.hex, { spellSaveDC: 15 }),
          createSpellAction(SPELLS.banishment, { spellSaveDC: 15 }),
          createSpellAction(SPELLS.wall_of_force, { spellSaveDC: 15 }),
          createSpellAction(SPELLS.evards_maw, { spellSaveDC: 15 }),
          createSpellAction(SPELLS.wrack_of_the_patron, { spellSaveDC: 15 }),
          createSpellAction(SPELLS.fog_cloud, { spellSaveDC: 15 }),
          createSpellAction(SPELLS.spike_growth, { spellSaveDC: 15 }),
          createSpellAction(SPELLS.hunger_of_hadar, { spellSaveDC: 15 }),
          {
            id: "target_test",
            name: "Target Test",
            type: "target_test",
            requiresTarget: true,
          },
        ]),
      },
      {
        id: "melee_dummy",
        name: "Enemy Swordsman",
        team: "enemies",
        role: "swordsman",
        ai: { profile: "melee", targetPriority: "nearest" },
        token: "S",
        hp: 80,
        maxHp: 80,
        ac: 13,
        initiativeBonus: 1,
        speed: 6,
        position: { x: 7, y: 1 },
        saves: { str: 2, dex: 1, con: 2, int: 0, wis: 0, cha: 0 },
        actions: compactActions([
          createWeaponAction(WEAPONS.longsword, {
            id: "blade",
            name: "Sword",
            attackBonus: 5,
            damageBonus: 3,
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
      {
        id: "ranged_dummy",
        name: "Enemy Archer",
        team: "enemies",
        role: "archer",
        ai: { profile: "archer", targetPriority: "weakest_visible", preferCover: true },
        token: "A",
        hp: 80,
        maxHp: 80,
        ac: 13,
        initiativeBonus: 1,
        speed: 6,
        position: { x: 9, y: 7 },
        saves: { str: 0, dex: 3, con: 1, int: 0, wis: 0, cha: 0 },
        actions: compactActions([
          createWeaponAction(WEAPONS.shortbow, {
            id: "shortbow",
            name: "Shortbow",
            range: 12,
            attackBonus: 5,
            damageBonus: 3,
          }),
        ]),
      },
    ],
  };
}

function compactActions(actions) {
  return actions.filter(Boolean);
}
