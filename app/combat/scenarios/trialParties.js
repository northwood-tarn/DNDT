import { createEmptyCharacterDraft, resolveCharacterSheet, resolvedSheetToCombatActor } from "../../character/index.js";
import { createSpellAction } from "../actionFactory.js";
import { SPELLS } from "../../data/spells.js";

export function createTrialParty(presetId) {
  if (presetId === "level_7_team") return createLevelSevenTeam();
  if (presetId === "level_7_casters") return createLevelSevenCasterTeam();
  return [];
}

function createLevelSevenTeam() {
  const pc = createLevelSevenPc();
  return [
    { ...pc, id: "generated_pc", className: "Champion Fighter", level: 7, position: { x: 1, y: 2 } },
    trialActor({
      id: "npc_guard",
      name: "Mara, Shield Guard",
      className: "Veteran Fighter",
      level: 7,
      role: "melee",
      token: "G",
      hp: 34,
      maxHp: 34,
      ac: 16,
      abilityMods: { str: 3, dex: 1, con: 2, int: 0, wis: 1, cha: 0 },
      position: { x: 1, y: 3 },
      actions: [
        weaponAttack("guard_blade", "Guard Blade", 6, "1d8+3", "slashing"),
        {
          id: "guard_second_wind",
          name: "Second Wind",
          type: "self_heal",
          cost: "bonus",
          requiresTarget: false,
          healing: "1d10+7",
          description: "Regain 1d10 + 7 hit points as a bonus action.",
          uses: { max: 1, remaining: 1, recharge: "short_rest" },
          tags: { harmful: false },
        },
      ],
    }),
    trialActor({
      id: "npc_adept",
      name: "Ilen, Lantern Adept",
      className: "Light Cleric",
      level: 7,
      role: "caster",
      token: "A",
      hp: 31,
      maxHp: 31,
      ac: 15,
      abilityMods: { str: 0, dex: 1, con: 2, int: 0, wis: 4, cha: 1 },
      position: { x: 1, y: 4 },
      actions: [
        createSpellAction(SPELLS.guidance, { spellSaveDC: 15, casterLevel: 7 }),
        createSpellAction(SPELLS.sacred_flame, { spellSaveDC: 14, casterLevel: 7 }),
        createSpellAction(SPELLS.guiding_bolt, { attackBonus: 7, casterLevel: 7 }),
        createSpellAction(SPELLS.cure_wounds, { spellSaveDC: 14, casterLevel: 7 }),
        createSpellAction(SPELLS.bless, { spellSaveDC: 14, casterLevel: 7 }),
        createSpellAction(SPELLS.shield_of_faith, { spellSaveDC: 14, casterLevel: 7 }),
        createSpellAction(SPELLS.lesser_restoration, { spellSaveDC: 14, casterLevel: 7 }),
      ],
    }),
  ];
}

function createLevelSevenPc() {
  const sheet = resolveCharacterSheet(createEmptyCharacterDraft({
    identity: {
      characterName: "Level 7 Trial Fighter",
      level: 7,
      backgroundId: "soldier",
      speciesId: "human",
      classId: "fighter",
      subclassId: "champion",
    },
    abilities: {
      strength: 16,
      dexterity: 12,
      constitution: 14,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    },
    choices: {
      backgroundAbilityScores: ["strength", "constitution"],
      weaponMasteryIds: ["longsword", "warhammer", "greatsword"],
      speciesChoices: { skillful_skill: "perception", versatile_feat: "tough" },
    },
    gear: {
      weaponIds: ["longsword", "warhammer"],
      armorId: "chain_mail",
      shieldId: "shield",
      inventory: [{ id: "healing_potion", quantity: 2 }],
      attunedItemIds: [],
    },
    spells: { knownSpellIds: [], preparedSpellIds: [] },
  }), {}, { allowNonCreationLevel: true });
  return resolvedSheetToCombatActor(sheet);
}

function createLevelSevenCasterTeam() {
  return [
    createResolvedTrialActor(createLevelSevenWizardDraft(), { id: "generated_pc", position: { x: 1, y: 2 } }),
    createResolvedTrialActor(createLevelSevenWarlockDraft(), { id: "npc_warlock", position: { x: 1, y: 3 } }),
    createResolvedTrialActor(createLevelSevenPaladinDraft(), { id: "npc_paladin", position: { x: 1, y: 4 } }),
  ];
}

function createLevelSevenWizardDraft() {
  return createEmptyCharacterDraft({
    identity: {
      characterName: "Veyra",
      level: 7,
      backgroundId: "sage",
      speciesId: "gnome",
      lineageId: "forest",
      classId: "wizard",
      subclassId: "dirt_wizard",
    },
    abilities: { strength: 8, dexterity: 14, constitution: 12, intelligence: 16, wisdom: 10, charisma: 10 },
    choices: { backgroundAbilityScores: ["intelligence", "dexterity"] },
    gear: { weaponIds: ["quarterstaff"], armorId: null, shieldId: null, inventory: [{ id: "healing_potion", quantity: 1 }], attunedItemIds: [] },
    spells: {
      knownSpellIds: ["fire_bolt", "mage_hand", "ray_of_frost"],
      preparedSpellIds: ["magic_missile", "shield", "burning_hands", "thunderwave", "hold_person", "fireball"],
    },
  });
}

function createLevelSevenWarlockDraft() {
  return createEmptyCharacterDraft({
    identity: {
      characterName: "Sen",
      level: 7,
      backgroundId: "guide",
      speciesId: "tiefling",
      lineageId: "chthonic",
      classId: "warlock",
      subclassId: "the_lantern",
      pactId: "pact_of_the_tome",
    },
    abilities: { strength: 10, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 12, charisma: 16 },
    choices: {
      backgroundAbilityScores: ["charisma", "constitution"],
      classChoices: {
        pact: "pact_of_the_tome",
        book_of_shadows_cantrips: ["fire_bolt", "ray_of_frost"],
      },
    },
    gear: { weaponIds: ["dagger"], armorId: "leather", shieldId: null, inventory: [{ id: "healing_potion", quantity: 1 }], attunedItemIds: [] },
    spells: {
      knownSpellIds: ["eldritch_blast", "dread_whisper"],
      preparedSpellIds: ["hex", "armor_of_agathys", "hellish_rebuke", "darkness", "hunger_of_hadar"],
    },
  });
}

function createLevelSevenPaladinDraft() {
  return createEmptyCharacterDraft({
    identity: {
      characterName: "Brann",
      level: 7,
      backgroundId: "guard",
      speciesId: "dragonborn",
      lineageId: "red",
      classId: "paladin",
      subclassId: "oath_of_glory",
    },
    abilities: { strength: 16, dexterity: 10, constitution: 14, intelligence: 10, wisdom: 12, charisma: 16 },
    choices: {
      backgroundAbilityScores: ["strength", "charisma"],
      weaponMasteryIds: ["longsword", "warhammer"],
    },
    gear: { weaponIds: ["longsword"], armorId: "chain_mail", shieldId: "shield", inventory: [{ id: "healing_potion", quantity: 1 }], attunedItemIds: [] },
    spells: { knownSpellIds: [], preparedSpellIds: ["bless", "shield_of_faith", "cure_wounds"] },
  });
}

function trialActor(overrides = {}) {
  return {
    id: "npc",
    name: "NPC",
    team: "heroes",
    role: "melee",
    token: "N",
    hp: 24,
    maxHp: 24,
    ac: 14,
    speed: 6,
    position: { x: 1, y: 1 },
    level: 1,
    className: "Adventurer",
    abilityMods: { str: 1, dex: 1, con: 1, int: 0, wis: 1, cha: 0 },
    saves: { str: 1, dex: 1, con: 1, int: 0, wis: 1, cha: 0 },
    actions: [],
    ...overrides,
  };
}

function weaponAttack(id, name, attackBonus, damage, damageType) {
  return {
    id,
    name,
    type: "weapon_attack",
    range: 1,
    attackBonus,
    damage,
    damageType,
    description: `Melee weapon attack for ${damage} ${damageType} damage.`,
    tags: { harmful: true, attackRoll: true, weapon: true, melee: true },
  };
}

function createResolvedTrialActor(draft, options = {}) {
  const sheet = resolveCharacterSheet(draft, {}, { allowNonCreationLevel: true });
  const actor = resolvedSheetToCombatActor(sheet, options);
  return {
    ...actor,
    className: canonicalClassLine(sheet),
    metadata: {
      ...(actor.metadata || {}),
      source: "resolved_character_sheet",
      classId: sheet.identity.classId,
      subclassId: sheet.identity.subclassId,
      pactId: sheet.identity.pactId,
    },
  };
}

function canonicalClassLine(sheet) {
  return [
    sheet.identity.className,
    sheet.identity.subclassName,
    sheet.identity.pactName,
  ].filter(Boolean).join(" / ");
}
