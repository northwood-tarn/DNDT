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
  quit: () => ipcRenderer.send('app:quit'),
  launchAuthoringTool: (tool) => ipcRenderer.send('authoring:launch-tool', tool),
  enterFramedMode: () => ipcRenderer.send('app:enter-framed'),
  setFullscreen: (value) => ipcRenderer.send('app:set-fullscreen', value === true),
  setCombatActionOptionsVisible: (value) => ipcRenderer.send('combat:action-options:set-visible', value === true),
  closeCombatActionOptions: () => ipcRenderer.send('combat:action-options:close'),
  setCombatPaneVisible: (paneId, value) => ipcRenderer.send('combat:pane:set-visible', { paneId, visible: value === true }),
  detachCombatPane: (paneId, position) => ipcRenderer.send('combat:pane:detach', { paneId, position }),
  closeCombatPane: (paneId) => ipcRenderer.send('combat:pane:close', { paneId }),
  closeCombatPaneHost: () => ipcRenderer.send('combat:pane-host:close'),
  setCombatPaneSetting: (key, value) => ipcRenderer.send('combat:pane-setting:set', { key, value: value === true }),
  onCombatPaneState: (listener) => {
    if (typeof listener !== 'function') return () => {};
    const wrapped = (_event, state) => listener(state);
    ipcRenderer.on('combat:panes:state', wrapped);
    return () => ipcRenderer.removeListener('combat:panes:state', wrapped);
  },
  onCombatActionOptionsVisibility: (listener) => {
    if (typeof listener !== 'function') return () => {};
    const wrapped = (_event, visible) => listener(visible === true);
    ipcRenderer.on('combat:action-options:visibility', wrapped);
    return () => ipcRenderer.removeListener('combat:action-options:visibility', wrapped);
  },
  onCombatPaneSettings: (listener) => {
    if (typeof listener !== 'function') return () => {};
    const wrapped = (_event, settings) => listener(settings);
    ipcRenderer.on('combat:pane-settings:state', wrapped);
    return () => ipcRenderer.removeListener('combat:pane-settings:state', wrapped);
  },
  onCombatPointerPosition: (listener) => {
    if (typeof listener !== 'function') return () => {};
    const wrapped = (_event, position) => listener(position);
    ipcRenderer.on('combat:pointer-position', wrapped);
    return () => ipcRenderer.removeListener('combat:pointer-position', wrapped);
  },
  onSystemMenuToggle: (listener) => {
    if (typeof listener !== 'function') return () => {};
    const wrapped = () => listener();
    ipcRenderer.on('app:toggle-system-menu', wrapped);
    return () => ipcRenderer.removeListener('app:toggle-system-menu', wrapped);
  },

  // Read local text files via main-process IPC (e.g., compiled Ink JSON)
  readTextFile: (relPath) => safeInvoke('fs:readText', relPath)
  ,saveAudioConfig: (config) => safeInvoke('audio:saveConfig', config)
  ,importAudioAsset: () => safeInvoke('audio:importAsset', {})
  ,removeAudioAsset: (relativePath) => safeInvoke('audio:removeAsset', relativePath)
});
