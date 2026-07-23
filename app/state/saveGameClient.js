import {
  clearSaveGame,
  createBrowserSaveGameStore,
  listSaveGames,
  loadGame,
  saveGame,
} from "./saveGameRepository.js";
import { DEFAULT_SAVE_GAME_SLOT, validateSaveGameState } from "./saveGameState.js";

export function createRendererSaveGameClient(options = {}) {
  const api = options.api || globalThis.window?.api || null;
  const fallbackStore = options.fallbackStore || createBrowserSaveGameStore(options.storage, options.namespace);
  return {
    async save(saveGameState, slot = DEFAULT_SAVE_GAME_SLOT) {
      const report = validateSaveGameState(saveGameState);
      if (!report.valid) throw new Error(`Cannot save invalid SaveGameState: ${report.errors.join("; ")}`);
      if (api?.saveGame) {
        const result = await api.saveGame(report.saveGame, slot);
        if (result?.ok) {
          saveGame(fallbackStore, report.saveGame, slot);
          globalThis.window?.__dndtAudio?.playEvent?.("SAVE_COMPLETE");
          return report.saveGame;
        }
      }
      const saved = saveGame(fallbackStore, report.saveGame, slot);
      globalThis.window?.__dndtAudio?.playEvent?.("SAVE_COMPLETE");
      return saved;
    },
    async load(slot = DEFAULT_SAVE_GAME_SLOT) {
      if (api?.loadGame) {
        const loaded = await api.loadGame(slot);
        if (loaded) {
          const saveGameState = validateLoadedSaveGame(loaded);
          saveGame(fallbackStore, saveGameState, slot);
          globalThis.window?.__dndtAudio?.playEvent?.("LOAD_COMPLETE");
          return saveGameState;
        }
      }
      const loaded = loadGame(fallbackStore, slot);
      if (!loaded) return null;
      const save = validateLoadedSaveGame(loaded);
      globalThis.window?.__dndtAudio?.playEvent?.("LOAD_COMPLETE");
      return save;
    },
    async list() {
      if (api?.listSaves) {
        const saves = await api.listSaves();
        if (Array.isArray(saves)) return saves;
      }
      return listSaveGames(fallbackStore);
    },
    async clear(slot = DEFAULT_SAVE_GAME_SLOT) {
      if (api?.clearGame) {
        const result = await api.clearGame(slot);
        if (result?.ok) {
          clearSaveGame(fallbackStore, slot);
          return true;
        }
      }
      return clearSaveGame(fallbackStore, slot);
    },
  };
}

function validateLoadedSaveGame(saveGameState) {
  const report = validateSaveGameState(saveGameState);
  if (!report.valid) throw new Error(`Loaded invalid SaveGameState: ${report.errors.join("; ")}`);
  return report.saveGame;
}
