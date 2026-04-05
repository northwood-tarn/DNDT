// electron/main.js — main process (CommonJS)
const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

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
  const primary = screen.getPrimaryDisplay();
  const startWidth = 1280;
  const startHeight = 800;

  win = new BrowserWindow({
    width: startWidth,
    height: startHeight,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#0b0f14',
    show: true,
    frame: false,                       // ⬅ remove OS title bar
    titleBarStyle: 'hiddenInset',       // macOS smooth dragging
    fullscreenable: true,
    resizable: true,
    webPreferences: {
      preload: resolveFromApp('electron', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      devTools: true,
    }
  });

  const indexPath = resolveFromApp('app', 'index.html');
  win.loadFile(indexPath);
  win.center();
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

// ===== SAVE/LOAD IPC (unchanged) =====
const saveDir = path.join(app.getPath('userData'), 'saves');
if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir, { recursive: true });

ipcMain.handle('saveGame', async (_e, { data, slot }) => {
  try {
    if (!slot) slot = 'autosave';
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
    const filePath = path.join(saveDir, `${slot}.json`);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    console.error('loadGame error:', err);
    return null;
  }
});

ipcMain.handle('listSaves', async () => {
  try {
    const files = fs.readdirSync(saveDir).filter(f => f.endsWith('.json'));
    return files.map(f => path.basename(f, '.json'));
  } catch (err) {
    console.error('listSaves error:', err);
    return [];
  }
});

ipcMain.handle('clearGame', async (_e, { slot }) => {
  try {
    const filePath = path.join(saveDir, `${slot}.json`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return { ok: true };
  } catch (err) {
    console.error('clearGame error:', err);
    return { ok: false, error: err.message };
  }
});
