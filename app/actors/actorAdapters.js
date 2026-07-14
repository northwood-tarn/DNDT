import { createActorDefinition, createActorInstance } from "./actorContract.js";

const ABILITY_SHORT = {
  strength: "str",
  dexterity: "dex",
  constitution: "con",
  intelligence: "int",
  wisdom: "wis",
  charisma: "cha",
};

export function enemySourceToActorDefinition(source, options = {}) {
  return createActorDefinition({
    id: options.id || `enemy.${source.id}`,
    kind: "enemy",
    identity: {
      name: source.name,
      description: source.description || "",
      tags: [source.creatureType, source.undeadRank ? `undead:${source.undeadRank}` : null, ...(source.tags || [])].filter(Boolean),
    },
    classification: {
      role: source.role,
      creatureType: source.creatureType,
      size: source.size,
      level: source.level,
    },
    presentation: { token: source.token || String(source.name || source.id).slice(0, 1).toUpperCase() },
    mechanics: {
      maxHp: source.maxHp ?? source.hp,
      armorClass: source.ac,
      speedSquares: source.speed,
      abilityModifiers: structuredClone(source.abilityMods || {}),
      saves: structuredClone(source.saves || {}),
      initiativeBonus: source.saves?.dex || 0,
      resistances: structuredClone(source.resistances || []),
      immunities: structuredClone(source.immunities || []),
      conditionImmunities: structuredClone(source.conditionImmunities || []),
      activeEffects: structuredClone(source.activeEffects || []),
      auras: structuredClone(source.auras || []),
    },
    capabilities: {
      actionRefs: source.actionRefs || [],
      features: source.features || [],
      featureHooks: source.featureHooks || [],
      resources: source.resources || [],
    },
    equipment: {
      weaponIds: source.weaponId ? [source.weaponId] : [],
      masteredWeaponIds: source.masteredWeaponIds || [],
      naturalAttacks: source.naturalAttack ? [source.naturalAttack] : [],
    },
    behavior: {
      aiProfile: source.aiProfile || null,
      awareness: structuredClone(source.awareness || {}),
    },
    rewards: {
      xp: source.xpValue ?? 0,
      loot: structuredClone(source.loot || {}),
    },
    extensions: { enemySource: structuredClone(source) },
  });
}

export function resolvedSheetToActorDefinition(sheet, combatActor, options = {}) {
  return createActorDefinition({
    id: options.id || `character.${slug(sheet.identity.characterName || combatActor?.id || "player")}`,
    kind: options.kind || "player",
    identity: {
      name: sheet.identity.characterName || combatActor?.name || "Player Character",
      tags: sheet.narrative?.tags || [],
    },
    classification: {
      role: sheet.identity.classId,
      creatureType: options.creatureType || "humanoid",
      level: sheet.identity.level,
      classId: sheet.identity.classId,
      subclassId: sheet.identity.subclassId,
    },
    presentation: {
      token: combatActor?.token || null,
      portraitId: sheet.metadata?.presentation?.portraitId || null,
      miniatureId: sheet.metadata?.presentation?.miniatureId || null,
    },
    mechanics: {
      maxHp: sheet.durability.maxHp,
      armorClass: sheet.combatBasics.armorClass,
      speedSquares: feetToSquares(sheet.combatBasics.speed || 30),
      abilityScores: mapAbilities(sheet.abilities, "score"),
      abilityModifiers: mapAbilities(sheet.abilities, "modifier"),
      saves: abbreviate(sheet.combatBasics.saves || {}),
      initiativeBonus: sheet.combatBasics.initiativeBonus || 0,
      resistances: sheet.durability.resistances || [],
      immunities: sheet.durability.immunities || [],
      conditionImmunities: sheet.durability.conditionImmunities || [],
    },
    capabilities: {
      actions: combatActor?.actions || [],
      features: sheet.features || [],
      featureHooks: sheet.featureHooks || [],
      resources: sheet.resources || [],
      spellcasting: structuredClone(sheet.spellcasting || null),
    },
    equipment: structuredClone(sheet.equipment || {}),
    narrative: structuredClone(sheet.narrative || {}),
    extensions: {
      combatActorBase: structuredClone(combatActor || {}),
      resolvedCharacterSheet: structuredClone(sheet),
    },
  });
}

export function combatActorToActorDefinition(actor, options = {}) {
  return createActorDefinition({
    id: options.id || `actor.${actor.sourceId || actor.id}`,
    kind: options.kind || (actor.team === "enemies" ? "enemy" : "npc"),
    identity: { name: actor.name, tags: actor.tags || [] },
    classification: {
      role: actor.role || null,
      creatureType: actor.creatureType || null,
      size: actor.size || null,
      level: actor.level ?? null,
    },
    presentation: { token: actor.token || null },
    mechanics: {
      maxHp: actor.maxHp,
      armorClass: actor.ac,
      speedSquares: actor.speed,
      abilityModifiers: actor.abilityMods || {},
      saves: actor.saves || {},
      resistances: actor.resistances || [],
      immunities: actor.immunities || [],
      conditionImmunities: actor.conditionImmunities || [],
    },
    capabilities: {
      actions: actor.actions || [],
      features: actor.features || [],
      featureHooks: actor.featureHooks || [],
      resources: actor.resources || [],
    },
    equipment: structuredClone(actor.equipment || {}),
    extensions: { combatActorBase: structuredClone(actor) },
  });
}

export function ayaBlueprintToActorDefinition(aya, options = {}) {
  const maxHp = aya.vitals?.maxHp ?? aya.vitals?.hp ?? 1;
  return createActorDefinition({
    id: options.id || `character.${aya.id}`,
    kind: options.kind || "companion",
    identity: { name: aya.name, description: aya.notes || "", tags: [] },
    classification: {
      role: aya.class?.toLowerCase() || null,
      creatureType: "humanoid",
      level: aya.level,
      classId: aya.class?.toLowerCase() || null,
      subclassId: aya.subclass?.toLowerCase().replace(/\s+/g, "_") || null,
    },
    presentation: { token: String(aya.name || "A").slice(0, 1).toUpperCase() },
    mechanics: {
      maxHp,
      armorClass: (aya.equipment?.armor?.ac || 10) + (aya.equipment?.shield?.bonus || 0),
      speedSquares: 6,
      abilityScores: structuredClone(aya.abilities || {}),
      saves: Object.fromEntries(Object.entries(aya.abilities || {}).map(([id, score]) => [id, Math.floor((score - 10) / 2)])),
      initiativeBonus: aya.combat?.initiativeBonus || 0,
    },
    capabilities: { actions: [], features: aya.features || [], resources: [] },
    equipment: structuredClone(aya.equipment || {}),
    narrative: { quests: structuredClone(aya.quests || {}), flags: structuredClone(aya.flags || {}) },
    extensions: { legacyAyaBlueprint: structuredClone(aya) },
  });
}

export function legacyPlayerToActorDefinition(player, options = {}) {
  return createActorDefinition({
    id: options.id || `character.${player.id || slug(player.name || "legacy_player")}`,
    kind: options.kind || "player",
    identity: { name: player.name || "Player Character", tags: [] },
    classification: {
      role: player.classId || player.class?.toLowerCase() || null,
      creatureType: "humanoid",
      level: player.level || 1,
      classId: player.classId || player.class?.toLowerCase() || null,
    },
    presentation: { token: String(player.name || "P").slice(0, 1).toUpperCase() },
    mechanics: {
      maxHp: player.maxHp ?? player.hp ?? 1,
      armorClass: player.ac ?? 10,
      speedSquares: player.speed ?? 6,
      abilityScores: structuredClone(player.abilities || {}),
    },
    capabilities: {
      actions: player.actions || [],
      features: player.features || [],
      resources: player.resources || [],
      spellcasting: { slots: structuredClone(player.spellSlots || {}), knownSpellIds: structuredClone(player.knownSpells || []) },
    },
    equipment: structuredClone(player.equipment || player.equipped || {}),
    extensions: { legacyPlayer: serializableLegacyPlayer(player) },
  });
}

export function combatActorToActorInstance(actor, definitionId, options = {}) {
  return createActorInstance({
    id: options.id || actor.id,
    definitionId,
    team: options.team || actor.team || "heroes",
    name: options.name || actor.name || null,
    position: options.position || actor.position || null,
    state: {
      hp: actor.hp,
      maxHp: actor.maxHp,
      tempHp: actor.tempHp || 0,
      defeated: actor.defeated === true,
      spellSlots: actor.spellSlots || {},
      resources: actor.resources || [],
      inventory: actor.inventory || [],
      conditions: actor.conditions || [],
      activeEffects: actor.activeEffects || [],
      marks: actor.marks || [],
      luck: actor.luck || null,
    },
    metadata: options.metadata || {},
  });
}

function mapAbilities(abilities, field) {
  return Object.fromEntries(Object.entries(abilities || {}).map(([id, value]) => [ABILITY_SHORT[id] || id, value?.[field] ?? value]));
}

function abbreviate(values) {
  return Object.fromEntries(Object.entries(values || {}).map(([id, value]) => [ABILITY_SHORT[id] || id, value]));
}

function feetToSquares(feet) {
  return Math.max(0, Math.floor(feet / 5));
}

function slug(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "actor";
}

function serializableLegacyPlayer(player) {
  return Object.fromEntries(Object.entries(player || {}).filter(([, value]) => typeof value !== "function").map(([key, value]) => [key, structuredClone(value)]));
}
