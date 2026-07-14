import assert from "node:assert/strict";
import {
  createEmptyCharacterDraft,
  resolveCharacterSheet,
  resolvedSheetToCombatActor,
  validateResolvedSheetCombatActor,
} from "../../app/character/index.js";

export function runCombatActorAdapterTests() {
  convertsResolvedFighterToCombatActor();
  convertsResolvedCasterSpellsToCombatActions();
}

function convertsResolvedFighterToCombatActor() {
  const draft = createEmptyCharacterDraft({
    identity: {
      characterName: "Bridge Fighter",
      level: 1,
      backgroundId: "soldier",
      classId: "fighter",
    },
    abilities: {
      strength: 16,
      dexterity: 12,
      constitution: 14,
      intelligence: 10,
      wisdom: 10,
      charisma: 8,
    },
    gear: {
      weaponIds: ["longsword"],
      armorId: "chain_mail",
      shieldId: "shield",
      inventory: [{ id: "healing_potion", quantity: 2 }],
      attunedItemIds: [],
    },
  });

  const sheet = resolveCharacterSheet(draft);
  const actor = resolvedSheetToCombatActor(sheet, { position: { x: 2, y: 3 } });

  assert.deepEqual(validateResolvedSheetCombatActor(sheet, { position: { x: 2, y: 3 } }), []);
  assert.equal(actor.id, "bridge_fighter");
  assert.equal(actor.name, "Bridge Fighter");
  assert.equal(actor.hp, 12);
  assert.equal(actor.maxHp, 12);
  assert.equal(actor.ac, 18);
  assert.equal(actor.speed, 6);
  assert.equal(actor.saves.str, 5);
  assert.equal(actor.saves.con, 4);
  assert.equal(actor.actions.some((action) => action.id === "longsword" && action.attackBonus === 5 && action.damage === "1d8+3"), true);
  assert.equal(actor.actions.some((action) => action.id === "second_wind" && action.type === "self_heal" && action.cost === "bonus"), true);
  assert.equal(actor.actions.some((action) => action.id === "healing_potion" && action.type === "consumable"), true);
  assert.equal(actor.featureHooks.some((hook) => hook.id === "savage_attacker_weapon_damage"), true);
}

function convertsResolvedCasterSpellsToCombatActions() {
  const draft = createEmptyCharacterDraft({
    identity: {
      characterName: "Bridge Wizard",
      level: 1,
      backgroundId: "sage",
      classId: "wizard",
    },
    abilities: {
      strength: 8,
      dexterity: 14,
      constitution: 12,
      intelligence: 16,
      wisdom: 10,
      charisma: 10,
    },
    gear: {
      weaponIds: ["quarterstaff"],
      armorId: null,
      shieldId: null,
      inventory: [],
      attunedItemIds: [],
    },
    spells: {
      knownSpellIds: ["fire_bolt"],
      preparedSpellIds: ["magic_missile"],
    },
  });

  const sheet = resolveCharacterSheet(draft);
  const actor = resolvedSheetToCombatActor(sheet);

  assert.deepEqual(validateResolvedSheetCombatActor(sheet), []);
  assert.equal(actor.ac, 12);
  assert.equal(actor.actions.some((action) => action.id === "fire_bolt" && action.type === "spell_attack" && action.attackBonus === 5), true);
  assert.equal(actor.actions.some((action) => action.id === "magic_missile" && action.type === "spell_auto_damage"), true);
}
