import assert from "node:assert/strict";
import { getItemQuantity, getMovementRemaining, hasCondition, hasReaction, validateCombatActor } from "../../app/combat/actor.js";
import { createCombatLog } from "../../app/combat/combatLog.js";
import { createCombatController } from "../../app/combat/controller.js";
import { hasLineOfSight, isWalkable, nextStepToward } from "../../app/combat/grid.js";
import { createSnapshotFromScenario } from "../../app/combat/scenario.js";
import { getActorEconomyView, getValidTargets, hasAnyUsefulOption } from "../../app/combat/selectors.js";
import { endTurnEffects, moveActor, resolveAction, startTurn } from "../../app/combat/resolver.js";
import { runAiTurn } from "../../app/combat/ai.js";
import { actorsInFootprint, coneFootprint, cubeFootprint, lineDirection, lineFootprint, radiusFootprint } from "../../app/combat/footprints.js";
import { getCondition } from "../../app/data/conditions.js";
import { getConsumableById } from "../../app/data/consumables.js";
import { createConsumableAction } from "../../app/combat/actionFactory.js";
import { createEnemyCombatActor } from "../../app/combat/enemyFactory.js";
import { createEmptyCharacterDraft, resolveCharacterSheet, resolvedSheetToCombatActor } from "../../app/character/index.js";

export {
  assert,
  actorsInFootprint,
  coneFootprint,
  createCombatController,
  createCombatLog,
  createEmptyCharacterDraft,
  createEnemyCombatActor,
  createSnapshotFromScenario,
  cubeFootprint,
  endTurnEffects,
  getActorEconomyView,
  getCondition,
  getItemQuantity,
  getMovementRemaining,
  getValidTargets,
  hasAnyUsefulOption,
  hasCondition,
  hasLineOfSight,
  hasReaction,
  isWalkable,
  lineDirection,
  lineFootprint,
  moveActor,
  nextStepToward,
  radiusFootprint,
  resolveCharacterSheet,
  resolveAction,
  resolvedSheetToCombatActor,
  runAiTurn,
  startTurn,
  validateCombatActor,
};

export function fixedDice({ d20 = 10, damage = 4 } = {}) {
  return {
    rollD20: () => ({ roll: d20, total: d20, usedLucky: false, secondRoll: null }),
    rollDamage: (dice) => ({ total: damage, rolls: [damage], modifier: 0, dice }),
  };
}

export function scriptedDice({ d20 = [], damage = 1 } = {}) {
  const rolls = [...d20];
  const damageRolls = Array.isArray(damage) ? [...damage] : null;
  function nextD20() {
    return rolls.length ? rolls.shift() : 10;
  }
  return {
    rollD20: () => {
      const roll = nextD20();
      return { roll, total: roll, usedLucky: false, secondRoll: null };
    },
    applyLuckyD20: ({ actor, currentRoll, context }) => {
      const targetNumber = Number(context?.targetNumber);
      const bonus = Number(context?.bonus || 0);
      const missedBy = targetNumber - (currentRoll + bonus);
      if (!actor?.luck || actor.luck.points <= 0 || actor.luck.usedThisCombat || missedBy <= 0 || missedBy >= 5) {
        return { roll: currentRoll, total: currentRoll, usedLucky: false, originalRoll: currentRoll, secondRoll: null };
      }
      const secondRoll = nextD20();
      const roll = Math.max(currentRoll, secondRoll);
      actor.luck.points -= 1;
      actor.luck.usedThisCombat = true;
      return { roll, total: roll, usedLucky: true, originalRoll: currentRoll, secondRoll, missedBy, pointsRemaining: actor.luck.points };
    },
    rollDamage: (dice) => {
      const total = damageRolls ? (damageRolls.length ? damageRolls.shift() : 1) : damage;
      return { total, rolls: [total], modifier: 0, dice };
    },
  };
}

export function makeHarnessSnapshot() {
  return createSnapshotFromScenario({
    id: "combat-test-harness",
    grid: {
      width: 8,
      height: 5,
      blocked: [
        { x: 2, y: 1 },
        { x: 2, y: 2 },
        { x: 2, y: 3 },
      ],
      cover: [
        { x: 4, y: 0, kind: "half" },
        { x: 4, y: 4, kind: "three_quarters" },
      ],
    },
    actors: [
      {
        id: "hero",
        name: "Hero",
        team: "heroes",
        role: "fighter",
        token: "H",
        hp: 20,
        maxHp: 20,
        ac: 15,
        initiativeBonus: 0,
        speed: 6,
        position: { x: 0, y: 2 },
        saves: { wis: 1 },
        inventory: [{ id: "healing_potion", quantity: 2 }],
        actions: [
          createConsumableAction(getConsumableById("healing_potion")),
          {
            id: "bow",
            name: "Bow",
            type: "weapon_attack",
            range: 10,
            attackBonus: 5,
            damage: "1d6",
            damageType: "piercing",
          },
          {
            id: "spark",
            name: "Spark",
            type: "spell_save",
            range: 10,
            saveAbility: "wis",
            spellSaveDC: 13,
            damage: "1d8",
            damageType: "psychic",
          },
          {
            id: "dex_blast",
            name: "Dex Blast",
            type: "spell_save",
            range: 10,
            saveAbility: "dex",
            spellSaveDC: 13,
            damage: "1d8",
            damageType: "force",
          },
        ],
      },
      {
        id: "enemy",
        name: "Enemy",
        team: "enemies",
        role: "swordsman",
        token: "E",
        hp: 8,
        maxHp: 8,
        ac: 12,
        initiativeBonus: 0,
        speed: 6,
        position: { x: 4, y: 2 },
        saves: { wis: 0 },
        actions: [
          {
            id: "blade",
            name: "Blade",
            type: "weapon_attack",
            range: 1,
            attackBonus: 5,
            damage: "1d6",
            damageType: "slashing",
          },
        ],
      },
    ],
  });
}
