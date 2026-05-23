import {
  createStarterCharacterDraft,
  loadCombatActorFromCharacter,
  loadCharacterRecord,
  resolveCharacterSheet,
  resolvedSheetToCombatActor,
} from "../character/index.js";

export function createHeroActorsForScenario(options = {}) {
  const heroPositions = options.heroPositions || [options.heroPosition].filter(Boolean);
  const heroes = explicitHeroActors(options, heroPositions);
  if (heroes.length) return heroes;

  const records = explicitCharacterRecords(options);
  if (records.length) return records.map((record, index) => positionHeroActor(loadCombatActorFromCharacter({ record }), index, heroPositions));

  const stored = storedCharacterRecords(options);
  if (stored.length) return stored.map((record, index) => positionHeroActor(loadCombatActorFromCharacter({ record }), index, heroPositions));

  const drafts = options.characterDrafts || [options.characterDraft].filter(Boolean);
  if (drafts.length) return drafts.map((draft, index) => {
    const sheet = resolveCharacterSheet(draft, {}, options.resolveOptions || {});
    return positionHeroActor(resolvedSheetToCombatActor(sheet), index, heroPositions);
  });

  if (options.fallbackVariantId) {
    const sheet = resolveCharacterSheet(createStarterCharacterDraft(options.fallbackVariantId));
    return [positionHeroActor(resolvedSheetToCombatActor(sheet), 0, heroPositions)];
  }

  return [];
}

export function defaultHeroPosition(index) {
  return { x: 1, y: 1 + index };
}

function explicitHeroActors(options, heroPositions) {
  return (options.heroes || []).map((actor, index) => positionHeroActor(actor, index, heroPositions));
}

function explicitCharacterRecords(options) {
  return (options.characterRecords || [options.characterRecord].filter(Boolean))
    .filter((record) => record?.status === "ready" && record.combatActor);
}

function storedCharacterRecords(options) {
  const store = options.characterStore;
  if (!store) return [];
  const slots = options.partySlots || [options.characterSlot || "active"];
  return slots
    .map((slot) => loadCharacterRecord({ store, slot }))
    .filter((record) => record?.status === "ready" && record.combatActor);
}

function positionHeroActor(actor, index, heroPositions) {
  return {
    ...structuredClone(actor),
    id: index === 0 ? "generated_pc" : actor.id,
    position: heroPositions[index] || actor.position || defaultHeroPosition(index),
  };
}
