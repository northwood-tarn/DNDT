import {
  createStarterCharacterDraft,
  loadCombatActorFromCharacter,
  loadCharacterRecord,
  resolveCharacterSheet,
  resolvedSheetToCombatActor,
} from "../character/index.js";
import { resolveActorToCombatActor } from "../actors/actorContract.js";

export function createHeroActorsForScenario(options = {}) {
  const heroPositions = options.heroPositions || [options.heroPosition].filter(Boolean);
  const heroes = explicitHeroActors(options, heroPositions);
  if (heroes.length) return appendSavedCompanions(heroes, options, heroPositions);

  const records = explicitCharacterRecords(options);
  if (records.length) return appendSavedCompanions(records.map((record, index) => positionHeroActor(loadCombatActorFromCharacter({ record }), index, heroPositions)), options, heroPositions);

  const stored = storedCharacterRecords(options);
  if (stored.length) return appendSavedCompanions(stored.map((record, index) => positionHeroActor(loadCombatActorFromCharacter({ record }), index, heroPositions)), options, heroPositions);

  const drafts = options.characterDrafts || [options.characterDraft].filter(Boolean);
  if (drafts.length) return appendSavedCompanions(drafts.map((draft, index) => {
    const sheet = resolveCharacterSheet(draft, {}, options.resolveOptions || {});
    return positionHeroActor(resolvedSheetToCombatActor(sheet), index, heroPositions);
  }), options, heroPositions);

  if (options.fallbackVariantId) {
    const sheet = resolveCharacterSheet(createStarterCharacterDraft(options.fallbackVariantId));
    return appendSavedCompanions([positionHeroActor(resolvedSheetToCombatActor(sheet), 0, heroPositions)], options, heroPositions);
  }

  return [];
}

function appendSavedCompanions(heroes, options, heroPositions) {
  const companionState = options.saveGame?.party?.companions;
  if (!companionState) return heroes;
  const companions = (companionState.activeIds || [])
    .slice(0, 2)
    .map((id) => companionState.recruited?.[id])
    .filter((record) => record?.definition && record?.instance)
    .map((record, index) => positionHeroActor(
      resolveActorToCombatActor(record.definition, record.instance),
      heroes.length + index,
      heroPositions,
    ));
  return [...heroes, ...companions];
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
