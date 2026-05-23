import {
  DEFAULT_SAVE_GAME_SLOT,
  normalizeSaveGameState,
  validateSaveGameState,
} from "./saveGameState.js";

export const DEFAULT_SAVE_GAME_STORAGE_NAMESPACE = "dndt.savegame.";

export function createSaveGameMemoryStore(initialSaves = []) {
  const saves = new Map();
  for (const entry of initialSaves) {
    saves.set(entry.slot || DEFAULT_SAVE_GAME_SLOT, normalizeSaveGameState(entry.saveGame || entry));
  }
  return {
    save(saveGame, slot = DEFAULT_SAVE_GAME_SLOT) {
      const normalized = normalizeSaveGameState(saveGame);
      saves.set(slot, normalized);
      return structuredClone(normalized);
    },
    load(slot = DEFAULT_SAVE_GAME_SLOT) {
      const saveGame = saves.get(slot);
      return saveGame ? structuredClone(saveGame) : null;
    },
    list() {
      return Array.from(saves.entries()).map(([slot, saveGame]) => saveGameSummary(slot, saveGame));
    },
    clear(slot = DEFAULT_SAVE_GAME_SLOT) {
      return saves.delete(slot);
    },
  };
}

export function createBrowserSaveGameStore(storage = globalThis.localStorage, namespace = DEFAULT_SAVE_GAME_STORAGE_NAMESPACE) {
  if (!storage) return createSaveGameMemoryStore();
  return {
    save(saveGame, slot = DEFAULT_SAVE_GAME_SLOT) {
      const normalized = normalizeSaveGameState(saveGame);
      storage.setItem(storageKey(namespace, slot), JSON.stringify(normalized));
      return structuredClone(normalized);
    },
    load(slot = DEFAULT_SAVE_GAME_SLOT) {
      const raw = storage.getItem(storageKey(namespace, slot));
      return raw ? normalizeSaveGameState(JSON.parse(raw)) : null;
    },
    list() {
      return storageKeys(storage)
        .filter((key) => key.startsWith(namespace))
        .map((key) => {
          const slot = key.slice(namespace.length);
          const saveGame = this.load(slot);
          return saveGame ? saveGameSummary(slot, saveGame) : null;
        })
        .filter(Boolean);
    },
    clear(slot = DEFAULT_SAVE_GAME_SLOT) {
      storage.removeItem(storageKey(namespace, slot));
      return true;
    },
  };
}

export function saveGame(store, saveGame, slot = DEFAULT_SAVE_GAME_SLOT) {
  const report = validateSaveGameState(saveGame);
  if (!report.valid) throw new Error(`Cannot save invalid SaveGameState: ${report.errors.join("; ")}`);
  return store.save(report.saveGame, slot);
}

export function loadGame(store, slot = DEFAULT_SAVE_GAME_SLOT) {
  return store.load(slot);
}

export function listSaveGames(store) {
  return store.list();
}

export function clearSaveGame(store, slot = DEFAULT_SAVE_GAME_SLOT) {
  return store.clear(slot);
}

function saveGameSummary(slot, saveGame) {
  const activeRecord = saveGame.party?.characterRecords?.[saveGame.party?.activeSlot];
  return {
    slot,
    runId: saveGame.runId,
    savedAt: saveGame.savedAt,
    activePartySlot: saveGame.party?.activeSlot || null,
    activeCharacterName: activeRecord?.resolvedCharacterSheet?.identity?.characterName ||
      activeRecord?.characterDraft?.identity?.characterName ||
      null,
    activeClassId: activeRecord?.resolvedCharacterSheet?.identity?.classId ||
      activeRecord?.characterDraft?.identity?.classId ||
      null,
    level: activeRecord?.resolvedCharacterSheet?.identity?.level ||
      activeRecord?.characterDraft?.identity?.level ||
      null,
    locationAreaId: saveGame.world?.location?.areaId || null,
    locationScene: saveGame.world?.location?.scene || null,
    activeEncounterId: saveGame.encounter?.activeEncounterId || null,
  };
}

function storageKey(namespace, slot) {
  return `${namespace}${slot || DEFAULT_SAVE_GAME_SLOT}`;
}

function storageKeys(storage) {
  if (typeof storage.key === "function" && Number.isFinite(storage.length)) {
    return Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(Boolean);
  }
  return Object.keys(storage);
}
