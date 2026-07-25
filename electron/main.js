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
  'action-options': { visible: false, detached: false },
  inventory: { visible: false, detached: false },
  equipment: { visible: false, detached: false },
  character: { visible: false, detached: false },
  quests: { visible: false, detached: false },
};
const individualExpandedCombatPanes = true;
const combatPaneSettings = { offerSpellUpcasting: true };
const DISPLAY_SCHEMAS = new Set(['laptop', 'restricted', 'large', 'full']);
const requestedDisplaySchema = process.argv.find((argument) => argument.startsWith('--combat-display-schema='))?.slice('--combat-display-schema='.length) || null;
let combatDisplaySchema = DISPLAY_SCHEMAS.has(requestedDisplaySchema) ? requestedDisplaySchema : null;
const detachedCombatPaneWindows = new Map();
const externalCombatPaneGroups = new Map();
const externalCombatPaneOrder = [];
const suppressedExternalCloses = new WeakSet();
const paneMergeTimers = new WeakMap();
let arrangingExternalPaneWindows = false;
let combatEnsembleDrag = null;
let movingCombatEnsemble = false;
let combatEnsembleReleaseTimer = null;
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
    width: Math.round(mainBounds.width / 4),
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
    displaySchema: combatDisplaySchema,
    fullScreen: Boolean(win && !win.isDestroyed() && win.isFullScreen()),
    fullScreenAvailable: !externalPanesActive,
  };
  for (const target of [win, actionOptionsWin, ...detachedCombatPaneWindows.values()]) {
    if (target && !target.isDestroyed()) target.webContents.send('combat:pane-settings:state', settingsState);
  }
}

function layoutExternalCombatPanes() {
  if (!win || win.isDestroyed()) return;
  const main = win.getBounds();
  const width = Math.round(main.width / 4);
  const columns = new Map();
  for (const groupId of externalCombatPaneOrder) {
    const group = externalCombatPaneGroups.get(groupId);
    if (!group?.window || group.window.isDestroyed() || group.free) continue;
    const column = Number.isInteger(group.column) ? group.column : columns.size;
    group.column = column;
    if (!columns.has(column)) columns.set(column, []);
    columns.get(column).push(group);
  }
  arrangingExternalPaneWindows = true;
  try {
    for (const [column, groups] of columns) {
      const x = main.x + main.width + column * width;
      groups.sort((left, right) => (left.stackOrder || 0) - (right.stackOrder || 0));
      if (groups.length === 1) {
        const group = groups[0];
        const current = group.window.getBounds();
        const height = group.partialHeight ? Math.max(260, Math.min(group.partialHeight, main.height)) : main.height;
        group.window.setBounds({ x, y: main.y, width, height: group.partialHeight ? height : main.height }, false);
        continue;
      }
      const topHeight = Math.max(260, Math.min(groups[0].stackHeight || groups[0].window.getBounds().height, main.height - 260));
      groups[0].stackHeight = topHeight;
      groups[0].window.setBounds({ x, y: main.y, width, height: topHeight }, false);
      groups[1].stackHeight = main.height - topHeight;
      groups[1].window.setBounds({ x, y: main.y + topHeight, width, height: main.height - topHeight }, false);
    }
  } finally {
    arrangingExternalPaneWindows = false;
  }
}

function nextExternalPanePlacement() {
  const main = win.getBounds();
  const width = Math.round(main.width / 4);
  const groups = externalCombatPaneOrder
    .map((id) => externalCombatPaneGroups.get(id))
    .filter((group) => group && !group.free);
  const partialTop = groups.find((group) => {
    if (!group.partialHeight) return false;
    return groups.filter((candidate) => candidate.column === group.column).length === 1
      && main.height - group.partialHeight >= 260;
  });
  if (partialTop) {
    partialTop.stackOrder = 0;
    partialTop.stackHeight = partialTop.partialHeight;
    delete partialTop.partialHeight;
    return {
      column: partialTop.column,
      stackOrder: 1,
      stackHeight: main.height - partialTop.stackHeight,
      bounds: { x: main.x + main.width + partialTop.column * width, y: main.y + partialTop.stackHeight, width, height: main.height - partialTop.stackHeight },
    };
  }
  const column = groups.length ? Math.max(...groups.map((group) => group.column || 0)) + 1 : 0;
  return { column, stackOrder: 0, stackHeight: main.height, bounds: { x: main.x + main.width + column * width, y: main.y, width, height: main.height } };
}

function resizeExternalPaneStack(groupId) {
  if (arrangingExternalPaneWindows || !win || win.isDestroyed()) return;
  const group = externalCombatPaneGroups.get(groupId);
  if (!group?.window || group.window.isDestroyed() || group.free) return;
  const main = win.getBounds();
  const peers = [...externalCombatPaneGroups.values()]
    .filter((candidate) => !candidate.free && candidate.column === group.column && candidate.window && !candidate.window.isDestroyed())
    .sort((left, right) => (left.stackOrder || 0) - (right.stackOrder || 0));
  const bounds = group.window.getBounds();
  if (peers.length === 1) {
    const requestedBottom = bounds.y + bounds.height;
    group.partialHeight = Math.max(260, Math.min(requestedBottom - main.y, main.height));
    if (Math.abs(group.partialHeight - main.height) < 8) delete group.partialHeight;
    layoutExternalCombatPanes();
    return;
  }
  const boundary = group === peers[0] ? bounds.y + bounds.height : bounds.y;
  peers[0].stackHeight = Math.max(260, Math.min(boundary - main.y, main.height - 260));
  layoutExternalCombatPanes();
}

function sendExternalGroup(group, activePaneId = group?.paneIds?.[0]) {
  if (!group?.window || group.window.isDestroyed()) return;
  group.activePaneId = group.paneIds.includes(activePaneId) ? activePaneId : group.paneIds[0];
  group.window.webContents.send('combat:pane-group:state', { paneIds: [...group.paneIds], activePaneId: group.activePaneId });
}

function externalGroupForPane(paneId) {
  return [...externalCombatPaneGroups].find(([, group]) => group.paneIds.includes(paneId)) || null;
}

function mergeCombatPaneIntoGroup(paneId, targetPaneId) {
  const sourceEntry = externalGroupForPane(paneId);
  const targetEntry = externalGroupForPane(targetPaneId);
  if (!sourceEntry || !targetEntry || sourceEntry[0] === targetEntry[0]) return;
  const [sourceId, source] = sourceEntry;
  const target = targetEntry[1];
  source.paneIds = source.paneIds.filter((id) => id !== paneId);
  target.paneIds = [...target.paneIds, paneId];
  detachedCombatPaneWindows.set(paneId, target.window);
  if (!source.paneIds.length) {
    externalCombatPaneGroups.delete(sourceId);
    const orderIndex = externalCombatPaneOrder.indexOf(sourceId);
    if (orderIndex >= 0) externalCombatPaneOrder.splice(orderIndex, 1);
    if (source.window && !source.window.isDestroyed()) {
      suppressedExternalCloses.add(source.window);
      source.window.destroy();
    }
  } else {
    for (const id of source.paneIds) detachedCombatPaneWindows.set(id, source.window);
    sendExternalGroup(source, source.activePaneId === paneId ? source.paneIds[0] : source.activePaneId);
  }
  sendExternalGroup(target, paneId);
  broadcastCombatPaneState();
}

function mergeExternalGroupIntoGroup(sourceId, targetId) {
  if (!sourceId || !targetId || sourceId === targetId) return;
  const source = externalCombatPaneGroups.get(sourceId);
  const target = externalCombatPaneGroups.get(targetId);
  if (!source || !target) return;
  target.paneIds = [...new Set([...target.paneIds, ...source.paneIds])];
  for (const paneId of source.paneIds) detachedCombatPaneWindows.set(paneId, target.window);
  externalCombatPaneGroups.delete(sourceId);
  const orderIndex = externalCombatPaneOrder.indexOf(sourceId);
  if (orderIndex >= 0) externalCombatPaneOrder.splice(orderIndex, 1);
  if (source.window && !source.window.isDestroyed()) {
    suppressedExternalCloses.add(source.window);
    source.window.destroy();
  }
  sendExternalGroup(target, source.activePaneId || source.paneIds[0]);
  broadcastCombatPaneState();
}

function scheduleExternalPaneDrop(groupId, paneWindow) {
  clearTimeout(paneMergeTimers.get(paneWindow));
  paneMergeTimers.set(paneWindow, setTimeout(() => {
    if (!paneWindow || paneWindow.isDestroyed() || !externalCombatPaneGroups.has(groupId)) return;
    const pointer = screen.getCursorScreenPoint();
    for (const [targetId, target] of externalCombatPaneGroups) {
      if (targetId === groupId || !target.window || target.window.isDestroyed()) continue;
      const bounds = target.window.getBounds();
      const overTargetHeader = pointer.x >= bounds.x && pointer.x <= bounds.x + bounds.width
        && pointer.y >= bounds.y && pointer.y <= bounds.y + 72;
      if (overTargetHeader) {
        mergeExternalGroupIntoGroup(groupId, targetId);
        return;
      }
    }
    const main = win && !win.isDestroyed() ? win.getBounds() : null;
    if (main) {
      const current = paneWindow.getBounds();
      const overlapsMainHorizontally = current.x < main.x + main.width && current.x + current.width > main.x;
      const overTopDock = overlapsMainHorizontally && Math.abs((current.y + current.height) - main.y) <= 48;
      if (overTopDock) {
        const group = externalCombatPaneGroups.get(groupId);
        group.schemaManaged = true;
        group.dock = 'top';
        paneWindow.setParentWindow(win);
        paneWindow.setBounds({ x: main.x, y: main.y - current.height + 1, width: main.width, height: current.height }, false);
        return;
      }
      const group = externalCombatPaneGroups.get(groupId);
      group.dock = null;
      if (current.height !== main.height) {
        group.restoringFullHeight = true;
        paneWindow.setBounds({ ...current, height: main.height }, false);
        group.restoringFullHeight = false;
      }
    }
  }, 180));
}

function captureCombatWorkspace() {
  if (!win || win.isDestroyed()) return null;
  return {
    version: 1,
    schema: combatDisplaySchema || 'laptop',
    mainBounds: win.getBounds(),
    groups: externalCombatPaneOrder.map((groupId) => externalCombatPaneGroups.get(groupId)).filter((group) => group?.window && !group.window.isDestroyed()).map((group) => ({
      paneIds: [...group.paneIds],
      activePaneId: group.activePaneId || group.paneIds[0],
      bounds: group.window.getBounds(),
    })),
  };
}

function restoreCombatWorkspace(workspace) {
  if (!workspace || workspace.version !== 1 || !DISPLAY_SCHEMAS.has(workspace.schema) || !win || win.isDestroyed()) return false;
  combatDisplaySchema = workspace.schema;
  clearExternalCombatPanes();
  if (validWindowBounds(workspace.mainBounds)) win.setBounds(workspace.mainBounds, false);
  for (const savedGroup of workspace.groups || []) {
    const paneIds = [...new Set((savedGroup.paneIds || []).filter((paneId) => combatPaneState[paneId]))];
    if (!paneIds.length || !validWindowBounds(savedGroup.bounds)) continue;
    createSchemaPaneGroup(paneIds, savedGroup.bounds);
    const entry = externalGroupForPane(paneIds[0]);
    if (entry) sendExternalGroup(entry[1], savedGroup.activePaneId);
  }
  broadcastCombatPaneState();
  return true;
}

function validWindowBounds(bounds) {
  return bounds && ['x', 'y', 'width', 'height'].every((key) => Number.isFinite(bounds[key])) && bounds.width >= 160 && bounds.height >= 120;
}

function removeExternalPane(paneId, destroyEmpty = true) {
  const groupId = [...externalCombatPaneGroups].find(([, group]) => group.paneIds.includes(paneId))?.[0];
  const group = groupId ? externalCombatPaneGroups.get(groupId) : null;
  detachedCombatPaneWindows.delete(paneId);
  if (!group) return;
  group.paneIds = group.paneIds.filter((id) => id !== paneId);
  if (!group.paneIds.length) {
    externalCombatPaneGroups.delete(groupId);
    const orderIndex = externalCombatPaneOrder.indexOf(groupId);
    if (orderIndex >= 0) externalCombatPaneOrder.splice(orderIndex, 1);
    if (destroyEmpty && group.window && !group.window.isDestroyed()) group.window.destroy();
  } else {
    for (const id of group.paneIds) detachedCombatPaneWindows.set(id, group.window);
    sendExternalGroup(group);
  }
  layoutExternalCombatPanes();
}

function releaseExternalPane(groupId) {
  if (!win || win.isDestroyed()) return;
  const group = externalCombatPaneGroups.get(groupId);
  if (!group || group.free) return;
  const formerColumn = group.column;
  group.free = true;
  delete group.column;
  delete group.stackOrder;
  delete group.stackHeight;
  delete group.partialHeight;

  const peers = [...externalCombatPaneGroups.values()].filter((candidate) => (
    candidate !== group
    && !candidate.free
    && candidate.column === formerColumn
    && candidate.window
    && !candidate.window.isDestroyed()
  ));
  for (const peer of peers) {
    peer.stackOrder = 0;
    peer.stackHeight = win.getBounds().height;
    delete peer.partialHeight;
  }
  layoutExternalCombatPanes();
}

function clearExternalCombatPanes() {
  const windows = new Set([...externalCombatPaneGroups.values()].map((group) => group.window));
  for (const paneWindow of windows) {
    if (!paneWindow || paneWindow.isDestroyed()) continue;
    suppressedExternalCloses.add(paneWindow);
    paneWindow.destroy();
  }
  externalCombatPaneGroups.clear();
  externalCombatPaneOrder.splice(0, externalCombatPaneOrder.length);
  detachedCombatPaneWindows.clear();
  for (const state of Object.values(combatPaneState)) {
    state.visible = false;
    state.detached = false;
  }
}

function createSchemaPaneGroup(paneIds, bounds, options = {}) {
  const [primaryPaneId, ...additionalPaneIds] = paneIds;
  detachCombatPane(primaryPaneId);
  const entry = [...externalCombatPaneGroups].find(([, group]) => group.paneIds.includes(primaryPaneId));
  if (!entry) return;
  const group = entry[1];
  group.free = true;
  group.schemaManaged = true;
  group.dock = options.dock || null;
  group.paneIds = [...paneIds];
  for (const paneId of additionalPaneIds) {
    combatPaneState[paneId].visible = true;
    combatPaneState[paneId].detached = true;
    detachedCombatPaneWindows.set(paneId, group.window);
  }
  group.window.setMinimumSize(Math.min(bounds.width, 260), Math.min(bounds.height, 160));
  group.window.setMaximumSize(10000, 10000);
  group.window.setParentWindow(win);
  group.window.setBounds(bounds, false);
  sendExternalGroup(group, primaryPaneId);
}

function displaySchemaGeometry(schema) {
  const main = win.getBounds();
  const display = screen.getDisplayNearestPoint({ x: main.x + main.width / 2, y: main.y + main.height / 2 });
  const area = display.workArea;
  const side = Math.round(main.width / 4);
  const availableExtraHeight = Math.max(320, area.height - main.height);
  const band = Math.max(160, Math.min(Math.round(main.height / 4), Math.floor(availableExtraHeight / 2)));
  const topBand = schema === 'large' || schema === 'full' ? Math.round(band * 1.25) : band;
  const bottomBand = schema === 'large' ? Math.round(band * 1.5) : band;
  const sideCount = schema === 'restricted' || schema === 'large' || schema === 'full' ? 2 : 0;
  const totalWidth = main.width + side * sideCount;
  const totalHeight = schema === 'large' ? main.height + topBand + bottomBand : schema === 'full' ? main.height + topBand + band : main.height;
  const originX = Math.round(area.x + Math.max(0, (area.width - totalWidth) / 2));
  const originY = Math.round(area.y + Math.max(0, (area.height - totalHeight) / 2));
  const mainX = originX + (schema === 'restricted' || schema === 'large' || schema === 'full' ? side : 0);
  const mainY = originY + (schema === 'large' || schema === 'full' ? topBand : 0);
  win.setPosition(mainX, mainY, false);
  return { main: { ...main, x: mainX, y: mainY }, side, band, topBand, bottomBand };
}

function applyCombatDisplaySchema(schema) {
  if (!DISPLAY_SCHEMAS.has(schema) || !win || win.isDestroyed()) return;
  combatDisplaySchema = schema;
  clearExternalCombatPanes();
  if (actionOptionsWin && !actionOptionsWin.isDestroyed()) actionOptionsWin.hide();
  const { main, side, band, topBand, bottomBand } = displaySchemaGeometry(schema);
  if (schema === 'restricted') {
    createSchemaPaneGroup(['character'], { x: main.x - side, y: main.y, width: side, height: main.height });
    createSchemaPaneGroup(['action-options', 'inventory', 'quests'], { x: main.x + main.width, y: main.y, width: side, height: main.height });
  } else if (schema === 'large') {
    const span = main.width + side;
    createSchemaPaneGroup(['equipment', 'action-options'], { x: main.x + main.width, y: main.y, width: side, height: main.height });
    createSchemaPaneGroup(['character'], { x: main.x, y: main.y - topBand + 1, width: span, height: topBand }, { dock: 'top' });
    createSchemaPaneGroup(['inventory', 'quests'], { x: main.x, y: main.y + main.height, width: span, height: bottomBand });
  } else if (schema === 'full') {
    const span = main.width + side * 2;
    createSchemaPaneGroup(['action-options'], { x: main.x - side, y: main.y, width: side, height: main.height });
    createSchemaPaneGroup(['equipment'], { x: main.x + main.width, y: main.y, width: side, height: main.height });
    createSchemaPaneGroup(['character'], { x: main.x - side, y: main.y - topBand + 1, width: span, height: topBand }, { dock: 'top' });
    createSchemaPaneGroup(['inventory', 'quests'], { x: main.x - side, y: main.y + main.height, width: span, height: band });
  }
  startCombatPointerRouting();
  broadcastCombatPaneState();
  app.focus({ steal: true });
  win.show();
  win.focus();
  win.moveTop();
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
    parent: win,
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
    removeExternalPane(paneId);
    state.detached = false;
  }
  if (individualExpandedCombatPanes && state.visible) {
    const existing = detachedCombatPaneWindows.get(paneId);
    if (existing && !existing.isDestroyed()) {
      existing.show();
      existing.focus();
      broadcastCombatPaneState();
      return;
    }
    state.detached = false;
    detachCombatPane(paneId);
    return;
  }
  refreshCombatPaneHost();
}

function toggleCombatPane(paneId) {
  const state = combatPaneState[paneId];
  if (!state) return;
  setCombatPaneVisible(paneId, !state.visible);
}

function detachCombatPane(paneId, position = {}) {
  const state = combatPaneState[paneId];
  if (!state || !win || win.isDestroyed()) return;
  if (state.detached) {
    const groupedEntry = [...externalCombatPaneGroups].find(([, group]) => group.paneIds.includes(paneId));
    if (!groupedEntry || groupedEntry[1].paneIds.length < 2) return;
    removeExternalPane(paneId, false);
    state.detached = false;
  }
  state.visible = true;
  state.detached = true;

  const existing = detachedCombatPaneWindows.get(paneId);
  if (existing && !existing.isDestroyed()) existing.destroy();
  const hostBounds = actionOptionsWin && !actionOptionsWin.isDestroyed() ? actionOptionsWin.getBounds() : actionOptionsTargetBounds();
  const paneWidth = hostBounds.width;
  const paneHeight = hostBounds.height;
  const placement = nextExternalPanePlacement();
  const detachedWindow = new BrowserWindow({
    ...placement.bounds,
    parent: win,
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
  const groupId = `${paneId}:${Date.now()}`;
  const group = { paneIds: [paneId], window: detachedWindow, column: placement.column, stackOrder: placement.stackOrder, stackHeight: placement.stackHeight };
  externalCombatPaneGroups.set(groupId, group);
  externalCombatPaneOrder.push(groupId);
  detachedCombatPaneWindows.set(paneId, detachedWindow);
  detachedWindow.loadFile(resolveFromApp('app', 'combat_ui_v2', 'action_options.html'), {
    query: { panel: paneId, ...(combatScenarioId ? { scenario: combatScenarioId } : {}) },
  });
  detachedWindow.once('ready-to-show', () => {
    layoutExternalCombatPanes();
    detachedWindow.show();
    detachedWindow.focus();
    sendExternalGroup(group, paneId);
    broadcastCombatPaneState();
  });
  detachedWindow.on('will-move', () => {
    group.schemaManaged = false;
    group.dock = null;
    releaseExternalPane(groupId);
  });
  detachedWindow.on('moved', () => {
    if (movingCombatEnsemble || group.schemaManaged || !group.free || group.restoringFullHeight || detachedWindow.isDestroyed()) return;
    scheduleExternalPaneDrop(groupId, detachedWindow);
  });
  detachedWindow.on('resize', () => resizeExternalPaneStack(groupId));
  detachedWindow.on('closed', () => {
    if (suppressedExternalCloses.has(detachedWindow)) {
      suppressedExternalCloses.delete(detachedWindow);
      return;
    }
    const liveGroup = externalCombatPaneGroups.get(groupId);
    for (const id of liveGroup?.paneIds || [paneId]) {
      detachedCombatPaneWindows.delete(id);
      combatPaneState[id].detached = false;
      combatPaneState[id].visible = false;
    }
    externalCombatPaneGroups.delete(groupId);
    const orderIndex = externalCombatPaneOrder.indexOf(groupId);
    if (orderIndex >= 0) externalCombatPaneOrder.splice(orderIndex, 1);
    layoutExternalCombatPanes();
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
        const paneWidth = Math.round(windowSize.width / 4);
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
        if (combatDisplaySchema) applyCombatDisplaySchema(combatDisplaySchema);
        else if (!individualExpandedCombatPanes) {
          createActionOptionsWindow();
          startCombatPointerRouting();
        } else broadcastCombatPaneState();
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
ipcMain.on('combat:pane:toggle', (_event, { paneId } = {}) => toggleCombatPane(String(paneId || '')));
ipcMain.on('combat:pane:detach', (_event, { paneId, position } = {}) => detachCombatPane(String(paneId || ''), position));
ipcMain.on('combat:pane:externalize', (_event, { paneId, position } = {}) => detachCombatPane(String(paneId || ''), position));
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
ipcMain.on('combat:display-schema:set', (_event, { schema } = {}) => {
  applyCombatDisplaySchema(String(schema || ''));
});
ipcMain.on('combat:pane:merge', (_event, { paneId, targetPaneId } = {}) => {
  mergeCombatPaneIntoGroup(String(paneId || ''), String(targetPaneId || ''));
});
ipcMain.on('combat:pane-group:set-active', (_event, { paneId } = {}) => {
  const entry = externalGroupForPane(String(paneId || ''));
  if (entry) entry[1].activePaneId = String(paneId);
});
ipcMain.on('combat:ensemble-drag', (_event, { phase, position } = {}) => {
  if (!win || win.isDestroyed() || !Number.isFinite(position?.x) || !Number.isFinite(position?.y)) return;
  if (phase === 'start') {
    const bounds = win.getBounds();
    combatEnsembleDrag = { pointerX: position.x, pointerY: position.y, windowX: bounds.x, windowY: bounds.y };
    movingCombatEnsemble = true;
    clearTimeout(combatEnsembleReleaseTimer);
    return;
  }
  if (phase === 'move' && combatEnsembleDrag) {
    movingCombatEnsemble = true;
    clearTimeout(combatEnsembleReleaseTimer);
    win.setPosition(
      Math.round(combatEnsembleDrag.windowX + position.x - combatEnsembleDrag.pointerX),
      Math.round(combatEnsembleDrag.windowY + position.y - combatEnsembleDrag.pointerY),
      false,
    );
    return;
  }
  if (phase === 'end') {
    combatEnsembleDrag = null;
    clearTimeout(combatEnsembleReleaseTimer);
    combatEnsembleReleaseTimer = setTimeout(() => { movingCombatEnsemble = false; }, 120);
  }
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
    data = {
      ...data,
      metadata: {
        ...(data?.metadata || {}),
        ...(combatPreviewActive ? { combatWorkspace: captureCombatWorkspace() } : {}),
      },
    };
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
    if (combatPreviewActive && data.metadata?.combatWorkspace) restoreCombatWorkspace(data.metadata.combatWorkspace);
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
