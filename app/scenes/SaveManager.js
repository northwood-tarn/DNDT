// SaveManager.js
// Centralised save/load management for DNDT.
//
// Responsibilities:
// - Maintain a list of saves in localStorage (v1).
// - Provide a clean API for creating, listing, loading, and deleting saves.
// - Enforce 1-per-run semantics for autosave and quicksave.
// - Leave payload/metadata construction to the caller (scenes/engine).
//
// Save shape (v1):
// {
//   saveId: string,
//   runId: string,
//   saveType: "autosave" | "quicksave" | "manual",
//   timestamp: string (ISO),
//   metadata: { ...display fields... },
//   payload: { ...full game state... }
// }

const STORAGE_KEY = "dndt_saves_";

export const SAVE_TYPE_AUTOSAVE = "autosave";
export const SAVE_TYPE_QUICKSAVE = "quicksave";
export const SAVE_TYPE_MANUAL = "manual";

const SaveManager = {
  /**
   * Return all saves as an array, newest first.
   */
  getAllSaves() {
    let saves = [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          saves = parsed;
        }
      }
    } catch (e) {
      console.error("[SaveManager] Failed to read saves:", e);
    }

    // Sort newest first by timestamp
    saves.sort((a, b) => {
      const ta = Date.parse(a.timestamp || 0) || 0;
      const tb = Date.parse(b.timestamp || 0) || 0;
      return tb - ta;
    });

    return saves;
  },

  /**
   * Persist the given array of saves.
   */
  _setAllSaves(saves) {
    try {
      const json = JSON.stringify(saves || []);
      localStorage.setItem(STORAGE_KEY, json);
    } catch (e) {
      console.error("[SaveManager] Failed to write saves:", e);
    }
  },

  /**
   * Generate a new runId (one per playthrough).
   */
  generateRunId() {
    return `run_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  },

  /**
   * Generate a new saveId.
   */
  generateSaveId() {
    return `save_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  },

  /**
   * Core save creation method.
   *
   * @param {Object} options
   *  - saveType: "autosave" | "quicksave" | "manual"
   *  - metadata: object with display metadata (see spec)
   *  - payload: full game state snapshot
   *  - runId: string (required; create one via generateRunId() for new game)
   *  - saveId: optional custom id; otherwise auto-generated
   *
   * @returns {Object} the created save object
   */
  createSave(options) {
    const {
      saveType,
      metadata,
      payload,
      runId,
      saveId
    } = options || {};

    if (!saveType || !runId || !metadata || !payload) {
      throw new Error(
        "[SaveManager] createSave requires saveType, runId, metadata, and payload"
      );
    }

    const nowIso = new Date().toISOString();
    const finalSaveId = saveId || this.generateSaveId();

    const save = {
      schemaVersion: 1,
      saveId: finalSaveId,
      runId,
      saveType,
      timestamp: nowIso,
      metadata: { ...metadata },
      payload: { ...payload }
    };

    let saves = this.getAllSaves();
    // Ensure saveId is unique (supports fixed-slot saves like dev slot 99).
    saves = saves.filter((s) => s.saveId !== finalSaveId);

    // For autosave and quicksave, keep only one per runId.
    if (saveType === SAVE_TYPE_AUTOSAVE || saveType === SAVE_TYPE_QUICKSAVE) {
      saves = saves.filter(
        (s) => !(s.runId === runId && s.saveType === saveType)
      );
    }

    saves.push(save);
    this._setAllSaves(saves);

    return save;
  },

  /**
   * Convenience wrapper: create autosave for given run.
   *
   * Will replace any existing autosave for this runId.
   */
  saveAutosave({ runId, metadata, payload }) {
    return this.createSave({
      saveType: SAVE_TYPE_AUTOSAVE,
      runId,
      metadata,
      payload
    });
  },

  /**
   * Convenience wrapper: create quicksave for given run.
   *
   * Will replace any existing quicksave for this runId.
   */
  saveQuicksave({ runId, metadata, payload }) {
    return this.createSave({
      saveType: SAVE_TYPE_QUICKSAVE,
      runId,
      metadata,
      payload
    });
  },

  /**
   * Convenience wrapper: create a manual save for given run.
   *
   * Multiple manual saves per run are allowed.
   */
  saveManual({ runId, metadata, payload }) {
    return this.createSave({
      saveType: SAVE_TYPE_MANUAL,
      runId,
      metadata,
      payload
    });
  },

  /**
   * Convenience wrapper: save to a fixed slot id (e.g. dev slot 99).
   *
   * Uses a stable saveId of the form "slot_<N>" and overwrites any existing save with that id.
   */
  saveSlot({ slotId, saveType = SAVE_TYPE_MANUAL, runId, metadata, payload }) {
    if (slotId === undefined || slotId === null) {
      throw new Error("[SaveManager] saveSlot requires slotId");
    }
    return this.createSave({
      saveType,
      runId,
      metadata,
      payload,
      saveId: `slot_${slotId}`
    });
  },

  /**
   * Return a specific save by id, or null if not found.
   */
  getSave(saveId) {
    if (!saveId) return null;
    const saves = this.getAllSaves();
    return saves.find((s) => s.saveId === saveId) || null;
  },

  /**
   * Return a fixed-slot save by numeric slot id (e.g. 99), or null.
   */
  getSlot(slotId) {
    if (slotId === undefined || slotId === null) return null;
    return this.getSave(`slot_${slotId}`);
  },

  /**
   * Delete a specific save by id.
   */
  deleteSave(saveId) {
    if (!saveId) return;
    const before = this.getAllSaves();
    const after = before.filter((s) => s.saveId !== saveId);
    this._setAllSaves(after);
  },

  /**
   * Return all saves for a given runId, newest first.
   */
  getSavesForRun(runId) {
    if (!runId) return [];
    const saves = this.getAllSaves();
    return saves.filter((s) => s.runId === runId);
  },

  /**
   * Return the latest autosave for a given runId, or null.
   */
  getLatestAutosave(runId) {
    return this._getLatestOfType(runId, SAVE_TYPE_AUTOSAVE);
  },

  /**
   * Return the latest quicksave for a given runId, or null.
   */
  getLatestQuicksave(runId) {
    return this._getLatestOfType(runId, SAVE_TYPE_QUICKSAVE);
  },

  /**
   * Internal helper: latest save of a given type for a run.
   */
  _getLatestOfType(runId, saveType) {
    if (!runId) return null;
    const saves = this.getAllSaves().filter(
      (s) => s.runId === runId && s.saveType === saveType
    );
    if (!saves.length) return null;
    // getAllSaves() is already newest-first, so take first match
    return saves[0];
  }
};

export default SaveManager;