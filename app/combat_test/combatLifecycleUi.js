import {
  applyCombatResultToSaveGame,
  DEFAULT_SAVE_GAME_SLOT,
  getActiveCharacterRecord,
} from "../state/saveGameState.js";
import {
  createBrowserSaveGameStore,
  loadGame,
  saveGame,
} from "../state/saveGameRepository.js";
import { createRendererSaveGameClient } from "../state/saveGameClient.js";

export function createCombatLifecycleUi(controller = null, options = {}) {
  const saveStore = options.saveStore || createBrowserSaveGameStore();
  const saveClient = options.saveClient || createRendererSaveGameClient({ fallbackStore: saveStore });
  let activeSave = loadGame(saveStore, DEFAULT_SAVE_GAME_SLOT);
  let outcomeSaved = false;
  return {
    setController(nextController) {
      controller = nextController;
    },
    async hydrate() {
      activeSave = await saveClient.load(DEFAULT_SAVE_GAME_SLOT);
      return activeSave;
    },
    scenarioOptions: (scenarioId) => {
      if (!isSavedCharacterScenario(scenarioId)) return {};
      activeSave = loadGame(saveStore, DEFAULT_SAVE_GAME_SLOT) || activeSave;
      const characterRecord = activeSave ? getActiveCharacterRecord(activeSave) : null;
      return characterRecord ? { characterRecord, freshCharacterRuntime: isFreshCharacterArena(scenarioId) } : {};
    },
    reset() {
      outcomeSaved = false;
    },
    syncOutcome() {
      if (!controller) return;
      if (outcomeSaved || controller.scenarioId !== "generated-character-arena") return;
      const activeSave = loadGame(saveStore, DEFAULT_SAVE_GAME_SLOT);
      if (!activeSave) return;
      const updated = applyCombatResultToSaveGame(activeSave, { snapshot: controller.snapshot });
      saveGame(saveStore, updated, DEFAULT_SAVE_GAME_SLOT);
      outcomeSaved = true;
    },
  };
}

function isSavedCharacterScenario(scenarioId) {
  return scenarioId === "generated-character-arena" || String(scenarioId || "").startsWith("generated-encounter-");
}

function isFreshCharacterArena(scenarioId) {
  return scenarioId === "generated-character-arena";
}
