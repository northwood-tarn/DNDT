// electron/main.js — main process (CommonJS)
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const DESIGN_VIEWPORT = Object.freeze({
  width: 1280,
  height: 800,
  minWidth: 1100,
  minHeight: 720,
});

function resolveFromApp(...segments) {
  return path.join(app.getAppPath(), ...segments);
}

function resolveSafeRelPath(relPath) {
  // Accept paths like "./app/areas/00_docks/dockside.ink.json" and resolve against app root.
  // Reject absolute paths and any attempt to escape via "..".
  const base = app.getAppPath();
  const raw = String(relPath ?? "").trim();

  if (!raw) throw new Error("Missing relPath");
  if (path.isAbsolute(raw)) throw new Error("Absolute paths are not allowed");

  // Normalise leading "./"
  const cleaned = raw.startsWith("./") ? raw.slice(2) : raw;

  const abs = path.resolve(base, cleaned);
  const baseResolved = path.resolve(base);

  if (abs !== baseResolved && !abs.startsWith(baseResolved + path.sep)) {
    throw new Error("Path traversal attempt blocked");
  }

  return abs;
}

let win;
function createWindow() {
  const combatPreview = process.argv.includes("--combat-preview");
  const creatorPreview = process.argv.includes("--creator-preview");
  const designPreview = combatPreview || creatorPreview;
  let windowButtonHideTimer = null;
  win = new BrowserWindow({
    width: DESIGN_VIEWPORT.width,
    height: DESIGN_VIEWPORT.height,
    minWidth: DESIGN_VIEWPORT.minWidth,
    minHeight: DESIGN_VIEWPORT.minHeight,
    backgroundColor: designPreview ? '#050706' : '#0b0f14',
    show: !designPreview,
    frame: false,                       // ⬅ remove OS title bar
    titleBarStyle: 'hiddenInset',       // macOS smooth dragging
    fullscreenable: true,
    resizable: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: resolveFromApp('electron', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      devTools: true,
    }
  });

  const indexPath = combatPreview
    ? resolveFromApp('app', 'combat_test', 'index.html')
    : creatorPreview
      ? resolveFromApp('app', 'character_creator', 'step_index.html')
      : resolveFromApp('app', 'index.html');
  win.loadFile(indexPath);

  if (designPreview && process.platform === 'darwin' && typeof win.setWindowButtonVisibility === 'function') {
    const hideWindowButtons = () => {
      win.setWindowButtonVisibility(false);
    };
    const revealWindowButtons = () => {
      win.setWindowButtonVisibility(true);
      if (windowButtonHideTimer) clearTimeout(windowButtonHideTimer);
      windowButtonHideTimer = setTimeout(hideWindowButtons, 4500);
    };

    hideWindowButtons();
    win.webContents.on('before-input-event', (event, input) => {
      if (input.type === 'keyDown' && input.key === 'Escape') {
        event.preventDefault();
        revealWindowButtons();
      }
    });
  }

  if (designPreview) {
    win.once('ready-to-show', () => {
      win.center();
      win.show();
    });
  } else {
    win.center();
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ===== FILE READ IPC (for local content like compiled Ink JSON) =====
ipcMain.handle("fs:readText", async (_e, relPath) => {
  try {
    const abs = resolveSafeRelPath(relPath);
    return fs.promises.readFile(abs, "utf-8");
  } catch (err) {
    console.error("fs:readText error:", err);
    throw err;
  }
});

// ===== SAVE/LOAD IPC =====
const saveDir = path.join(app.getPath('userData'), 'saves');
if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir, { recursive: true });

ipcMain.handle('saveGame', async (_e, { data, slot }) => {
  try {
    slot = safeSaveSlot(slot || 'autosave');
    assertSaveGameShape(data);
    const filePath = path.join(saveDir, `${slot}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return { ok: true, slot };
  } catch (err) {
    console.error('saveGame error:', err);
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('loadGame', async (_e, { slot }) => {
  try {
    slot = safeSaveSlot(slot || 'autosave');
    const filePath = path.join(saveDir, `${slot}.json`);
    if (!fs.existsSync(filePath)) return null;
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    assertSaveGameShape(data);
    return data;
  } catch (err) {
    console.error('loadGame error:', err);
    return null;
  }
});

ipcMain.handle('listSaves', async () => {
  try {
    const files = fs.readdirSync(saveDir).filter(f => f.endsWith('.json'));
    return files
      .map(f => {
        const slot = path.basename(f, '.json');
        try {
          const data = JSON.parse(fs.readFileSync(path.join(saveDir, f), 'utf-8'));
          assertSaveGameShape(data);
          return saveSummary(slot, data);
        } catch (err) {
          console.warn('Skipping invalid save file:', f, err.message);
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => Date.parse(b.savedAt || 0) - Date.parse(a.savedAt || 0));
  } catch (err) {
    console.error('listSaves error:', err);
    return [];
  }
});

ipcMain.handle('clearGame', async (_e, { slot }) => {
  try {
    slot = safeSaveSlot(slot || 'autosave');
    const filePath = path.join(saveDir, `${slot}.json`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return { ok: true };
  } catch (err) {
    console.error('clearGame error:', err);
    return { ok: false, error: err.message };
  }
});

function safeSaveSlot(slot) {
  const value = String(slot || 'autosave').trim();
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) throw new Error('Invalid save slot');
  return value;
}

function assertSaveGameShape(data) {
  if (!data || typeof data !== 'object') throw new Error('SaveGameState must be an object');
  if (data.schemaVersion !== 1) throw new Error('Unsupported SaveGameState schemaVersion');
  if (!data.runId) throw new Error('SaveGameState.runId is required');
  if (!data.party || typeof data.party !== 'object') throw new Error('SaveGameState.party is required');
  if (!data.world || typeof data.world !== 'object') throw new Error('SaveGameState.world is required');
  if (!data.encounter || typeof data.encounter !== 'object') throw new Error('SaveGameState.encounter is required');
}

function saveSummary(slot, data) {
  const activeSlot = data.party?.activeSlot || null;
  const activeRecord = activeSlot ? data.party?.characterRecords?.[activeSlot] : null;
  return {
    slot,
    runId: data.runId,
    savedAt: data.savedAt,
    activePartySlot: activeSlot,
    activeCharacterName:
      activeRecord?.resolvedCharacterSheet?.identity?.characterName ||
      activeRecord?.characterDraft?.identity?.characterName ||
      null,
    activeClassId:
      activeRecord?.resolvedCharacterSheet?.identity?.classId ||
      activeRecord?.characterDraft?.identity?.classId ||
      null,
    level:
      activeRecord?.resolvedCharacterSheet?.identity?.level ||
      activeRecord?.characterDraft?.identity?.level ||
      null,
    locationAreaId: data.world?.location?.areaId || null,
    locationScene: data.world?.location?.scene || null,
    activeEncounterId: data.encounter?.activeEncounterId || null,
  };
}
