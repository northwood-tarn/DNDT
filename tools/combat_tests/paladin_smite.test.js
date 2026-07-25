import { createEmptyCharacterDraft, resolveCharacterSheet, resolvedSheetToCombatActor } from "../../app/character/index.js";
import { createCombatLog } from "../../app/combat/combatLog.js";
import { resolveAction } from "../../app/combat/resolver.js";
import { createSnapshotFromScenario } from "../../app/combat/scenario.js";
import { assert } from "./helpers.js";

export function runPaladinSmiteCombatTests() {
  const sheet = resolveCharacterSheet(createEmptyCharacterDraft({
    identity: { characterName: "Smite Paladin", classId: "paladin", level: 2 },
  }), {}, { allowNonCreationLevel: true });
  assert.ok(sheet.spellcasting.preparedSpellIds.includes("divine_smite"));
  assert.equal(sheet.resources.find((resource) => resource.id === "paladins_smite_free")?.current, 1);

  const paladin = resolvedSheetToCombatActor(sheet, { id: "paladin", position: { x: 0, y: 0 } });
  paladin.actions.push({
    id: "test_sword",
    name: "Test Sword",
    type: "weapon_attack",
    cost: "action",
    range: 1,
    attackBonus: 20,
    damage: "1d8",
    damageType: "slashing",
    tags: { weapon: true, melee: true, attackRoll: true, harmful: true },
  });
  const enemy = {
    id: "undead",
    name: "Undead",
    team: "enemies",
    role: "enemy",
    token: "U",
    creatureType: "undead",
    hp: 60,
    maxHp: 60,
    ac: 10,
    speed: 6,
    position: { x: 1, y: 0 },
    saves: {},
    actions: [],
  };
  const snapshot = createSnapshotFromScenario({
    id: "paladin-smite-test",
    grid: { width: 3, height: 2, blocked: [], cover: [] },
    actors: [paladin, enemy],
  });
  const [actor, target] = snapshot.actors;
  const log = createCombatLog();
  const dice = {
    rollD20: () => ({ roll: 18, total: 18 }),
    rollDamage: (formula) => ({ dice: formula, total: formula === "3d8" ? 15 : 5, rolls: [5], modifier: 0 }),
  };

  assert.equal(resolveAction(snapshot, actor, "divine_smite", target.id, dice, log), false, "Divine Smite cannot be cast before a hit");
  assert.equal(resolveAction(snapshot, actor, "test_sword", target.id, dice, log), true);
  const freeSmite = actor.actions.find((action) => action.id === "divine_smite:free:post_hit");
  assert.ok(freeSmite, "a qualifying hit should expose the free Paladin's Smite cast");
  assert.ok(actor.actions.some((action) => action.id === "divine_smite:post_hit"), "a qualifying hit should expose the slotted cast");

  const hpBefore = target.hp;
  assert.equal(resolveAction(snapshot, actor, freeSmite.id, target.id, dice, log), true);
  assert.equal(hpBefore - target.hp, 15, "an undead target should take the additional Divine Smite d8");
  assert.equal(actor.resources.find((resource) => resource.id === "paladins_smite_free").current, 0);
  assert.equal(actor.spellSlots[1].current, 2, "the free cast should not spend a spell slot");
  assert.equal(actor.actions.some((action) => action.type === "spell_post_hit" && action.contextual), false, "post-hit choices should close after the Smite resolves");
}
