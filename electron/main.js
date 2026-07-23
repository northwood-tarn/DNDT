// electron/main.js — main process (CommonJS)
const { app, BrowserWindow, ipcMain, dialog, screen } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const { spawn } = require('node:child_process');

const creditsPreviewRequested = process.argv.includes('--credits-preview');
if (creditsPreviewRequested) {
  app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
}

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
  // Accept app-relative content paths and resolve them against the app root.
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
let actionOptionsWin = null;
let actionOptionsAttached = true;
const combatPaneState = {
  'action-options': { visible: true, detached: false },
  inventory: { visible: true, detached: false },
  equipment: { visible: true, detached: false },
  quests: { visible: true, detached: false },
};
const combatPaneSettings = { offerSpellUpcasting: true };
const detachedCombatPaneWindows = new Map();
let combatPreviewActive = false;
const combatScenarioId = process.argv.find((argument) => argument.startsWith('--combat-scenario='))?.slice('--combat-scenario='.length) || null;
let explorationAuthoringServer = null;
let dialogueAuthoringServer = null;
let combatPointerTimer = null;

function startCombatPointerRouting() {
  if (!combatPreviewActive || combatPointerTimer) return;
  combatPointerTimer = setInterval(() => {
    const point = screen.getCursorScreenPoint();
    for (const target of [win, actionOptionsWin, ...detachedCombatPaneWindows.values()]) {
      if (!target || target.isDestroyed() || !target.isVisible()) continue;
      const bounds = target.getContentBounds();
      const inside = point.x >= bounds.x && point.x < bounds.x + bounds.width && point.y >= bounds.y && point.y < bounds.y + bounds.height;
      target.webContents.send('combat:pointer-position', {
        inside,
        x: point.x - bounds.x,
        y: point.y - bounds.y,
      });
    }
  }, 32);
}

function actionOptionsTargetBounds() {
  if (!win || win.isDestroyed()) return null;
  const mainBounds = win.getBounds();
  return {
    x: mainBounds.x + mainBounds.width,
    y: mainBounds.y,
    width: Math.round(mainBounds.width / 3),
    height: mainBounds.height,
  };
}

function notifyActionOptionsVisibility(visible) {
  if (win && !win.isDestroyed()) win.webContents.send('combat:action-options:visibility', visible === true);
}

function serializableCombatPaneState() {
  return Object.fromEntries(Object.entries(combatPaneState).map(([paneId, state]) => [paneId, { ...state }]));
}

function broadcastCombatPaneState() {
  const state = serializableCombatPaneState();
  for (const target of [win, actionOptionsWin, ...detachedCombatPaneWindows.values()]) {
    if (target && !target.isDestroyed()) target.webContents.send('combat:panes:state', state);
  }
  notifyActionOptionsVisibility(combatPaneState['action-options'].visible);
  const externalPanesActive = Object.values(combatPaneState).some((state) => state.visible);
  const settingsState = {
    ...combatPaneSettings,
    fullScreen: Boolean(win && !win.isDestroyed() && win.isFullScreen()),
    fullScreenAvailable: !externalPanesActive,
  };
  for (const target of [win, actionOptionsWin, ...detachedCombatPaneWindows.values()]) {
    if (target && !target.isDestroyed()) target.webContents.send('combat:pane-settings:state', settingsState);
  }
}

function hasAttachedCombatPanes() {
  return Object.values(combatPaneState).some((state) => state.visible && !state.detached);
}

function attachActionOptionsWindow() {
  if (!actionOptionsWin || actionOptionsWin.isDestroyed()) return;
  const target = actionOptionsTargetBounds();
  if (!target) return;
  actionOptionsAttached = true;
  actionOptionsWin.setParentWindow(win);
  actionOptionsWin.setBounds(target, false);
}

function createActionOptionsWindow() {
  if (!combatPreviewActive || !win || win.isDestroyed()) return;
  if (actionOptionsWin && !actionOptionsWin.isDestroyed()) {
    attachActionOptionsWindow();
    actionOptionsWin.show();
    broadcastCombatPaneState();
    return;
  }

  const target = actionOptionsTargetBounds();
  actionOptionsWin = new BrowserWindow({
    ...target,
    parent: win,
    acceptFirstMouse: true,
    useContentSize: true,
    minWidth: target.width,
    maxWidth: target.width,
    minHeight: 260,
    maxHeight: win.getBounds().height,
    backgroundColor: '#030808',
    show: false,
    frame: false,
    resizable: true,
    fullscreenable: false,
    minimizable: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: resolveFromApp('electron', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      devTools: true,
    },
  });
  actionOptionsAttached = true;
  actionOptionsWin.loadFile(resolveFromApp('app', 'combat_ui_v2', 'action_options.html'), {
    query: combatScenarioId ? { scenario: combatScenarioId } : {},
  });
  actionOptionsWin.once('ready-to-show', () => {
    attachActionOptionsWindow();
    actionOptionsWin.show();
    win.moveTop();
    actionOptionsWin.moveTop();
    actionOptionsWin.focus();
    broadcastCombatPaneState();
  });
  actionOptionsWin.on('will-move', () => {
    actionOptionsAttached = false;
    actionOptionsWin.setParentWindow(null);
  });
  actionOptionsWin.on('moved', () => {
    if (!actionOptionsWin || actionOptionsWin.isDestroyed() || actionOptionsAttached) return;
    const targetBounds = actionOptionsTargetBounds();
    const current = actionOptionsWin.getBounds();
    const closeToAttachment = Math.abs(current.x - targetBounds.x) <= 28 && Math.abs(current.y - targetBounds.y) <= 44;
    if (closeToAttachment) attachActionOptionsWindow();
  });
  actionOptionsWin.on('closed', () => {
    actionOptionsWin = null;
    broadcastCombatPaneState();
  });
}

function setActionOptionsWindowVisible(visible) {
  setCombatPaneVisible('action-options', visible);
}

function refreshCombatPaneHost() {
  if (!combatPreviewActive) return;
  if (hasAttachedCombatPanes()) {
    createActionOptionsWindow();
    if (actionOptionsWin && !actionOptionsWin.isDestroyed()) actionOptionsWin.show();
  } else if (actionOptionsWin && !actionOptionsWin.isDestroyed()) {
    actionOptionsWin.hide();
  }
  broadcastCombatPaneState();
}

function setCombatPaneVisible(paneId, visible) {
  const state = combatPaneState[paneId];
  if (!state) return;
  state.visible = visible === true;
  if (state.visible && win && !win.isDestroyed() && win.isFullScreen()) win.setFullScreen(false);
  if (!state.visible && state.detached) {
    const detachedWindow = detachedCombatPaneWindows.get(paneId);
    if (detachedWindow && !detachedWindow.isDestroyed()) detachedWindow.destroy();
    detachedCombatPaneWindows.delete(paneId);
    state.detached = false;
  }
  refreshCombatPaneHost();
}

function detachCombatPane(paneId, position = {}) {
  const state = combatPaneState[paneId];
  if (!state?.visible || state.detached || !win || win.isDestroyed()) return;
  state.detached = true;

  const existing = detachedCombatPaneWindows.get(paneId);
  if (existing && !existing.isDestroyed()) existing.destroy();
  const hostBounds = actionOptionsWin && !actionOptionsWin.isDestroyed() ? actionOptionsWin.getBounds() : actionOptionsTargetBounds();
  const paneWidth = hostBounds.width;
  const paneHeight = hostBounds.height;
  const detachedWindow = new BrowserWindow({
    x: Number.isFinite(position.x) ? Math.round(position.x - 90) : hostBounds.x + 32,
    y: Number.isFinite(position.y) ? Math.round(position.y - 24) : hostBounds.y + 32,
    width: paneWidth,
    height: paneHeight,
    acceptFirstMouse: true,
    useContentSize: true,
    minWidth: paneWidth,
    maxWidth: paneWidth,
    minHeight: 260,
    maxHeight: win.getBounds().height,
    backgroundColor: '#050706',
    show: false,
    frame: false,
    resizable: true,
    fullscreenable: false,
    minimizable: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: resolveFromApp('electron', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      devTools: true,
    },
  });
  detachedCombatPaneWindows.set(paneId, detachedWindow);
  detachedWindow.loadFile(resolveFromApp('app', 'combat_ui_v2', 'action_options.html'), {
    query: { panel: paneId, ...(combatScenarioId ? { scenario: combatScenarioId } : {}) },
  });
  detachedWindow.once('ready-to-show', () => {
    detachedWindow.show();
    detachedWindow.focus();
    broadcastCombatPaneState();
  });
  detachedWindow.on('closed', () => {
    detachedCombatPaneWindows.delete(paneId);
    state.detached = false;
    state.visible = false;
    refreshCombatPaneHost();
  });
  refreshCombatPaneHost();
}

function waitForLocalServer(url, label, attempts = 40) {
  return new Promise((resolve, reject) => {
    const check = (remaining) => {
      const request = http.get(url, (response) => {
        response.resume();
        if (response.statusCode === 200) resolve();
        else if (remaining > 0) setTimeout(() => check(remaining - 1), 100);
        else reject(new Error(`${label} server did not become ready`));
      });
      request.on('error', () => {
        if (remaining > 0) setTimeout(() => check(remaining - 1), 100);
        else reject(new Error(`${label} server did not become ready`));
      });
    };
    check(attempts);
  });
}

function startDialogueAuthoringServer() {
  if (dialogueAuthoringServer) return;
  dialogueAuthoringServer = spawn(process.execPath, [resolveFromApp('authoring_tools', 'dialogue_scene_upload', 'server.mjs')], {
    cwd: app.getAppPath(),
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', PORT: '8134' },
    stdio: 'inherit',
  });
  dialogueAuthoringServer.on('exit', () => { dialogueAuthoringServer = null; });
}

function startExplorationAuthoringServer() {
  if (explorationAuthoringServer) return;
  explorationAuthoringServer = spawn(process.execPath, [resolveFromApp('authoring_tools', 'exploration_map_editor', 'authoringServer.mjs')], {
    cwd: app.getAppPath(),
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', PORT: '8124' },
    stdio: 'inherit',
  });
  explorationAuthoringServer.on('exit', () => { explorationAuthoringServer = null; });
}

function waitForExplorationAuthoringServer(attempts = 40) {
  return new Promise((resolve, reject) => {
    const check = (remaining) => {
      const request = http.get('http://127.0.0.1:8124/', (response) => {
        response.resume();
        if (response.statusCode === 200) resolve();
        else if (remaining > 0) setTimeout(() => check(remaining - 1), 100);
        else reject(new Error('Exploration Map Editor server did not become ready'));
      });
      request.on('error', () => {
        if (remaining > 0) setTimeout(() => check(remaining - 1), 100);
        else reject(new Error('Exploration Map Editor server did not become ready'));
      });
    };
    check(attempts);
  });
}

function explorationAuthoringServerIsRunning() {
  return new Promise((resolve) => {
    const request = http.get('http://127.0.0.1:8124/', (response) => {
      response.resume();
      resolve(response.statusCode === 200);
    });
    request.on('error', () => resolve(false));
  });
}

function createWindow() {
  const combatPreview = process.argv.includes("--combat-preview");
  combatPreviewActive = combatPreview;
  const creatorPreview = process.argv.includes("--creator-preview");
  const fogPreview = process.argv.includes("--fog-preview");
  const miniDisplayPreview = process.argv.includes("--mini-display-preview");
  const inventorySmallPreview = process.argv.includes("--inventory-small-preview");
  const restPrepareSmallPreview = process.argv.includes("--rest-prepare-small-preview");
  const creditsPreview = process.argv.includes("--credits-preview");
  const deathPreview = process.argv.includes("--death-preview");
  const explorationUiPreview = process.argv.includes("--exploration-ui-preview");
  const audioManager = process.argv.includes("--audio-manager");
  const explorationMapEditor = process.argv.includes("--exploration-map-editor");
  const dialogueUpload = process.argv.includes("--dialogue-upload");
  const authoringTools = process.argv.includes("--authoring-tools");
  const designPreview = combatPreview || creatorPreview || fogPreview || miniDisplayPreview || inventorySmallPreview || restPrepareSmallPreview || creditsPreview || deathPreview || explorationUiPreview || audioManager || explorationMapEditor || dialogueUpload || authoringTools;
  const windowSize = explorationMapEditor
    ? { width: 1440, height: 900, minWidth: 1200, minHeight: 760 }
    : authoringTools
      ? { width: 760, height: 560, minWidth: 680, minHeight: 500 }
      : DESIGN_VIEWPORT;
  win = new BrowserWindow({
    width: windowSize.width,
    height: windowSize.height,
    acceptFirstMouse: combatPreview,
    useContentSize: true,
    minWidth: windowSize.minWidth,
    minHeight: windowSize.minHeight,
    backgroundColor: designPreview ? '#050706' : '#00000000',
    transparent: !designPreview,
    show: !designPreview,
    frame: false,                       // ⬅ remove OS title bar
    titleBarStyle: 'hiddenInset',       // macOS smooth dragging
    fullscreenable: true,
    maximizable: !combatPreview,
    resizable: !combatPreview,
    autoHideMenuBar: true,
    webPreferences: {
      preload: resolveFromApp('electron', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      devTools: true,
    }
  });

  if (process.platform === 'darwin' && typeof win.setWindowButtonVisibility === 'function') {
    win.setWindowButtonVisibility(false);
  }

  if (!designPreview) {
    if (typeof win.setHasShadow === 'function') win.setHasShadow(false);
  }

  const indexPath = combatPreview
    ? resolveFromApp('app', 'combat_ui_v2', 'index.html')
    : creatorPreview
      ? resolveFromApp('app', 'character_creator', 'step_index.html')
      : miniDisplayPreview
        ? resolveFromApp('app', 'mini_display_arena', 'index.html')
      : inventorySmallPreview
        ? resolveFromApp('app', 'ui_screens', 'inventory_small.html')
      : restPrepareSmallPreview
          ? resolveFromApp('app', 'ui_screens', 'rest_prepare_small.html')
        : audioManager
          ? resolveFromApp('authoring_tools', 'audio_manager', 'index.html')
          : authoringTools
            ? resolveFromApp('authoring_tools', 'index.html')
          : resolveFromApp('app', 'index.html');
  if (explorationMapEditor) {
    explorationAuthoringServerIsRunning()
      .then((running) => { if (!running) startExplorationAuthoringServer(); })
      .then(() => waitForExplorationAuthoringServer())
      .then(() => win.loadURL('http://127.0.0.1:8124/'))
      .catch((error) => console.error(error));
  } else if (dialogueUpload) {
    startDialogueAuthoringServer();
    waitForLocalServer('http://127.0.0.1:8134/', 'Dialogue Scene Upload')
      .then(() => win.loadURL('http://127.0.0.1:8134/'))
      .catch((error) => console.error(error));
  } else if (creditsPreview) win.loadFile(indexPath, { query: { scene: 'credits' } });
  else if (deathPreview) win.loadFile(indexPath, { query: { scene: 'gameOver' } });
  else if (explorationUiPreview) win.loadFile(indexPath, { query: { scene: 'explorationLauncherPreview' } });
  else if (combatPreview) win.loadFile(indexPath, { query: combatScenarioId ? { scenario: combatScenarioId } : {} });
  else win.loadFile(indexPath);

  // Capture Escape in the main process so the application menu still opens
  // when keyboard focus is inside an embedded scene iframe.
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || input.key !== 'Escape' || input.isAutoRepeat) return;
    if (combatPreview) return;
    event.preventDefault();
    win.webContents.send('app:toggle-system-menu');
  });

  if (designPreview) {
    win.once('ready-to-show', () => {
      if (explorationMapEditor) win.maximize();
      else if (combatPreview) {
        const paneWidth = Math.round(windowSize.width / 3);
        const combinedWidth = windowSize.width + paneWidth;
        const displays = screen.getAllDisplays();
        const preferredDisplay = displays
          .filter((display) => display.workArea.width >= combinedWidth)
          .sort((left, right) => right.workArea.width - left.workArea.width)[0]
          || screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
        const workArea = preferredDisplay.workArea;
        const x = Math.round(workArea.x + Math.max(0, (workArea.width - combinedWidth) / 2));
        const y = Math.round(workArea.y + Math.max(0, (workArea.height - windowSize.height) / 2));
        win.setPosition(x, y, false);
      } else win.center();
      win.show();
      if (combatPreview) {
        createActionOptionsWindow();
        startCombatPointerRouting();
      }
    });
  } else {
    win.center();
  }

  if (combatPreview) {
    win.on('enter-full-screen', broadcastCombatPaneState);
    win.on('leave-full-screen', broadcastCombatPaneState);
    win.on('closed', () => {
      if (combatPointerTimer) clearInterval(combatPointerTimer);
      combatPointerTimer = null;
      if (actionOptionsWin && !actionOptionsWin.isDestroyed()) actionOptionsWin.destroy();
      for (const detachedWindow of detachedCombatPaneWindows.values()) {
        if (!detachedWindow.isDestroyed()) detachedWindow.destroy();
      }
      detachedCombatPaneWindows.clear();
      actionOptionsWin = null;
    });
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

app.on('before-quit', () => {
  if (explorationAuthoringServer && !explorationAuthoringServer.killed) explorationAuthoringServer.kill('SIGTERM');
  if (dialogueAuthoringServer && !dialogueAuthoringServer.killed) dialogueAuthoringServer.kill('SIGTERM');
});

ipcMain.on('app:quit', () => app.quit());
ipcMain.on('combat:action-options:set-visible', (_event, visible) => setActionOptionsWindowVisible(visible === true));
ipcMain.on('combat:action-options:close', () => setActionOptionsWindowVisible(false));
ipcMain.on('combat:pane:set-visible', (_event, { paneId, visible } = {}) => setCombatPaneVisible(String(paneId || ''), visible === true));
ipcMain.on('combat:pane:detach', (_event, { paneId, position } = {}) => detachCombatPane(String(paneId || ''), position));
ipcMain.on('combat:pane:close', (_event, { paneId } = {}) => setCombatPaneVisible(String(paneId || ''), false));
ipcMain.on('combat:pane-host:close', () => {
  for (const state of Object.values(combatPaneState)) {
    if (!state.detached) state.visible = false;
  }
  refreshCombatPaneHost();
});
ipcMain.on('combat:pane-setting:set', (_event, { key, value } = {}) => {
  if (!(key in combatPaneSettings)) return;
  combatPaneSettings[key] = value === true;
  broadcastCombatPaneState();
});
ipcMain.on('authoring:launch-tool', (_event, tool) => {
  const flags = {
    map: '--exploration-map-editor',
    audio: '--audio-manager',
    dialogue: '--dialogue-upload',
  };
  const flag = flags[String(tool || '')];
  if (!flag) return;
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(process.execPath, [app.getAppPath(), flag], {
    cwd: app.getAppPath(),
    env,
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
});
ipcMain.on('app:enter-framed', () => {
  if (!win || win.isDestroyed()) return;
  win.setBackgroundColor('#050706');
  if (typeof win.setHasShadow === 'function') win.setHasShadow(true);
  if (process.platform === 'darwin' && typeof win.setWindowButtonVisibility === 'function') win.setWindowButtonVisibility(false);
});
ipcMain.on('app:set-fullscreen', (_event, value) => {
  if (!win || win.isDestroyed()) return;
  const externalPanesActive = Object.values(combatPaneState).some((state) => state.visible);
  if (value === true && externalPanesActive) return;
  win.setFullScreen(value === true);
  broadcastCombatPaneState();
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

// ===== AUDIO AUTHORING IPC =====
const AUDIO_CONFIG_REL = path.join('app', 'data', 'audio-config.json');
const AUDIO_ASSET_REL = path.join('app', 'assets', 'audio');
const AUDIO_EXTENSIONS = new Set(['.mp3', '.ogg', '.wav', '.m4a']);

ipcMain.handle('audio:saveConfig', async (_e, config) => {
  try {
    if (app.isPackaged) throw new Error('Audio authoring is disabled in packaged builds');
    if (!config || config.audioConfigVersion !== 1) throw new Error('Invalid audio configuration');
    const target = resolveFromApp(...AUDIO_CONFIG_REL.split(path.sep));
    await fs.promises.writeFile(target, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
    return { ok: true };
  } catch (error) { return { ok: false, error: error.message }; }
});

ipcMain.handle('audio:importAsset', async () => {
  try {
    if (app.isPackaged) throw new Error('Audio importing is disabled in packaged builds');
    const result = await dialog.showOpenDialog(win, { title: 'Import audio asset', properties: ['openFile'], filters: [{ name: 'Audio', extensions: ['mp3', 'ogg', 'wav', 'm4a'] }] });
    if (result.canceled || !result.filePaths[0]) return { ok: false, canceled: true };
    const source = result.filePaths[0], extension = path.extname(source).toLowerCase();
    if (!AUDIO_EXTENSIONS.has(extension)) throw new Error(`Unsupported audio format: ${extension || 'none'}`);
    const directory = resolveFromApp(...AUDIO_ASSET_REL.split(path.sep));
    await fs.promises.mkdir(directory, { recursive: true });
    const stem = path.basename(source, extension).replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'audio';
    let filename = `${stem}${extension}`, counter = 2;
    while (fs.existsSync(path.join(directory, filename))) filename = `${stem}_${counter++}${extension}`;
    await fs.promises.copyFile(source, path.join(directory, filename));
    return { ok: true, name: path.basename(source, extension), path: `assets/audio/${filename}`, filename };
  } catch (error) { return { ok: false, error: error.message }; }
});

ipcMain.handle('audio:removeAsset', async (_e, relativePath) => {
  try {
    if (app.isPackaged) throw new Error('Audio asset removal is disabled in packaged builds');
    const normalized = String(relativePath || '').replaceAll('\\', '/');
    if (!normalized.startsWith('assets/audio/') || normalized.includes('..')) throw new Error('Invalid audio asset path');
    const target = resolveFromApp('app', ...normalized.split('/'));
    if (fs.existsSync(target)) await fs.promises.unlink(target);
    return { ok: true };
  } catch (error) { return { ok: false, error: error.message }; }
});

// ===== SAVE/LOAD IPC =====
const saveDir = path.join(app.getPath('userData'), 'saves');
if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir, { recursive: true });
seedBundledDemoSaves();

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
  if (![1, 2].includes(data.schemaVersion)) throw new Error('Unsupported SaveGameState schemaVersion');
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
    activeCharacterId: activeRecord?.id || null,
    activeCharacterName:
      activeRecord?.resolvedCharacterSheet?.identity?.characterName ||
      activeRecord?.characterDraft?.identity?.characterName ||
      null,
    activeClassId:
      activeRecord?.resolvedCharacterSheet?.identity?.classId ||
      activeRecord?.characterDraft?.identity?.classId ||
      null,
    activeSubclassId:
      activeRecord?.resolvedCharacterSheet?.identity?.subclassName ||
      activeRecord?.resolvedCharacterSheet?.identity?.subclassId ||
      activeRecord?.characterDraft?.identity?.subclassId ||
      null,
    activeBackgroundId:
      activeRecord?.resolvedCharacterSheet?.identity?.backgroundId ||
      activeRecord?.characterDraft?.identity?.backgroundId ||
      null,
    level:
      activeRecord?.resolvedCharacterSheet?.identity?.level ||
      activeRecord?.characterDraft?.identity?.level ||
      null,
    locationAreaId: data.world?.location?.areaId || null,
    locationLabel: data.metadata?.displayLocation || data.world?.location?.areaId || null,
    locationScene: data.world?.location?.scene || null,
    activeEncounterId: data.encounter?.activeEncounterId || null,
    saveType: data.metadata?.saveType || (slot.includes('quick') ? 'quicksave' : 'autosave'),
  };
}

function seedBundledDemoSaves() {
  const demoDir = resolveFromApp('app', 'data', 'demo_saves');
  if (!fs.existsSync(demoDir)) return;
  for (const file of fs.readdirSync(demoDir).filter((entry) => entry.endsWith('.json'))) {
    const destination = path.join(saveDir, file);
    if (!fs.existsSync(destination)) fs.copyFileSync(path.join(demoDir, file), destination);
  }
}
