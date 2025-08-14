
// tools/area-editor/app/main/main.js
import { app, BrowserWindow } from 'electron';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow () {
  const win = new BrowserWindow({
    width: 1920,
    height: 1200,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  const indexPath = pathToFileURL(path.join(__dirname, '../renderer/index.html')).toString();
  win.loadURL(indexPath);
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
