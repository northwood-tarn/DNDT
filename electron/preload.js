// electron/preload.js — CommonJS preload, safe under type:module roots via folder-scoped package.json
const { contextBridge, ipcRenderer } = require('electron');

function safeInvoke(channel, payload) {
  try {
    return ipcRenderer.invoke(channel, payload);
  } catch (e) {
    // If no handler exists or invoke fails, resolve null so renderer can fall back to localStorage
    return Promise.resolve(null);
  }
}

// Minimal, safe API surface; extend as needed.
contextBridge.exposeInMainWorld('api', {
  ping: () => 'pong',

  // Event subscription (whitelist in case you later wire events)
  on: (channel, listener) => {
    const valid = new Set(['saves:changed']);
    if (valid.has(channel)) ipcRenderer.on(channel, listener);
  },

  // Direct invokes for save/load; renderer should feature-detect these
  invoke: (channel, payload) => {
    const valid = new Set(['saveGame','loadGame','listSaves','clearGame']);
    if (valid.has(channel)) {
      return safeInvoke(channel, payload);
    }
    return Promise.resolve(null);
  },

  // Convenience helpers (optional)
  saveGame: (data, slot) => safeInvoke('saveGame', { data, slot }),
  loadGame: (slot) => safeInvoke('loadGame', { slot }),
  listSaves: () => safeInvoke('listSaves', {}),
  clearGame: (slot) => safeInvoke('clearGame', { slot }),

  // Read local text files via main-process IPC (e.g., compiled Ink JSON)
  readTextFile: (relPath) => safeInvoke('fs:readText', relPath)
});
