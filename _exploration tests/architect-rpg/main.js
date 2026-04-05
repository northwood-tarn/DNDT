const { app, BrowserWindow } = require("electron");

function createWindow() {
  const win = new BrowserWindow({
    width: 660,
    height: 660,
    useContentSize: true,
    resizable: false,
    backgroundColor: "#000000",
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true }
  });
  win.loadFile("index.html");
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
