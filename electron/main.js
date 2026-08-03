// electron/main.js — main process (CommonJS)
const { app, BrowserWindow, ipcMain, dialog, screen } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const { spawn, execFile } = require('node:child_process');

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
let connectedCombatWindowDrag = null;
let movingCombatEnsemble = false;
let combatEnsembleReleaseTimer = null;
let combatPreviewActive = false;
let emberScreenOpen = false;
const combatScenarioId = process.argv.find((argument) => argument.startsWith('--combat-scenario='))?.slice('--combat-scenario='.length) || null;
let explorationAuthoringServer = null;
let dialogueAuthoringServer = null;
let secretAiOllamaProcess = null;
let combatPointerTimer = null;
let combatHandleOwner = null;
let combatHandleVisible = false;
const combatHandleResizeState = new WeakMap();
let combatFogWin = null;
let combatFogLayoutSignature = '';

function connectedCombatWindows() {
  const connected = new Set();
  if (win && !win.isDestroyed() && win.isVisible()) connected.add(win);
  for (const candidate of [actionOptionsWin, ...detachedCombatPaneWindows.values()]) {
    if (!candidate || candidate.isDestroyed() || !candidate.isVisible()) continue;
    if (candidate.getParentWindow() === win) connected.add(candidate);
  }
  return [...connected];
}

function syncCombatFogCompositor() {
  if (!combatPreviewActive || !win || win.isDestroyed()) return;
  const connected = connectedCombatWindows();
  if (connected.length < 2) {
    if (combatFogWin && !combatFogWin.isDestroyed()) combatFogWin.hide();
    combatFogLayoutSignature = '';
    return;
  }
  const sourceBounds = connected.map((candidate) => candidate.getBounds());
  const padding = 19;
  const left = Math.min(...sourceBounds.map((bounds) => bounds.x)) - padding;
  const top = Math.min(...sourceBounds.map((bounds) => bounds.y)) - padding;
  const right = Math.max(...sourceBounds.map((bounds) => bounds.x + bounds.width)) + padding;
  const bottom = Math.max(...sourceBounds.map((bounds) => bounds.y + bounds.height)) + padding;
  const bounds = { x: left, y: top, width: right - left, height: bottom - top };
  const panes = sourceBounds.map((pane) => ({ x: pane.x - left, y: pane.y - top, width: pane.width, height: pane.height }));
  const signature = JSON.stringify({ bounds, panes });
  if (!combatFogWin || combatFogWin.isDestroyed()) {
    combatFogWin = new BrowserWindow({
      ...bounds,
      parent: win,
      transparent: true,
      backgroundColor: '#00000000',
      show: false,
      frame: false,
      roundedCorners: false,
      resizable: false,
      movable: false,
      focusable: false,
      fullscreenable: false,
      minimizable: false,
      skipTaskbar: true,
      hasShadow: false,
      webPreferences: {
        preload: resolveFromApp('electron', 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        devTools: true,
      },
    });
    combatFogWin.setIgnoreMouseEvents(true, { forward: true });
    combatFogWin.setAlwaysOnTop(true, 'floating');
    combatFogWin.loadFile(resolveFromApp('app', 'combat_ui_v2', 'fog_compositor.html')).then(() => {
      combatFogLayoutSignature = '';
      syncCombatFogCompositor();
    }).catch((error) => console.error('[combat-fog] failed to load compositor', error));
    combatFogWin.on('closed', () => { combatFogWin = null; combatFogLayoutSignature = ''; });
    return;
  }
  if (signature !== combatFogLayoutSignature) {
    combatFogWin.setBounds(bounds, false);
    combatFogWin.webContents.send('combat:fog-layout', { width: bounds.width, height: bounds.height, panes });
    combatFogLayoutSignature = signature;
  }
  if (!combatFogWin.isVisible()) combatFogWin.showInactive();
  combatFogWin.moveTop();
}

function updateCombatEnsembleHandle(point) {
  const connected = connectedCombatWindows();
  if (!connected.length || !win || win.isDestroyed()) return;
  const owner = combatDisplaySchema === 'laptop'
    ? win
    : [...connected].sort((left, right) => {
      const leftBounds = left.getBounds();
      const rightBounds = right.getBounds();
      return leftBounds.y - rightBounds.y || rightBounds.width - leftBounds.width;
    })[0];
  const ownerBounds = owner.getBounds();
  const pointerOverConnectedWindow = connected.some((candidate) => {
    const bounds = candidate.getBounds();
    return point.x >= bounds.x && point.x < bounds.x + bounds.width
      && point.y >= bounds.y && point.y < bounds.y + bounds.height;
  });
  const pointerApproachingHandle = point.x >= ownerBounds.x + ownerBounds.width / 2 - 64
    && point.x <= ownerBounds.x + ownerBounds.width / 2 + 64
    && point.y >= ownerBounds.y - 8
    && point.y <= ownerBounds.y + 18;
  const visible = !pointerOverConnectedWindow || pointerApproachingHandle || Boolean(connectedCombatWindowDrag);
  if (owner === combatHandleOwner && visible === combatHandleVisible) return;
  for (const candidate of connected) {
    candidate.webContents.send('combat:ensemble-handle', { visible: candidate === owner && visible });
  }
  combatHandleOwner = owner;
  combatHandleVisible = visible;
}

function startCombatPointerRouting() {
  if (!combatPreviewActive || combatPointerTimer) return;
  combatPointerTimer = setInterval(() => {
    syncCombatFogCompositor();
    const point = screen.getCursorScreenPoint();
    updateCombatEnsembleHandle(point);
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

function broadcastCombatPaneDragState(active, sourceWindow = null) {
  const targets = new Set([win, actionOptionsWin, ...detachedCombatPaneWindows.values()]);
  for (const target of targets) {
    if (!target || target.isDestroyed() || target === sourceWindow) continue;
    target.webContents.send('combat:pane-drag-state', { active: active === true });
  }
}

function setEmberScreenOpen(open) {
  emberScreenOpen = open === true;
  const externalWindows = new Set([actionOptionsWin, ...detachedCombatPaneWindows.values()]);
  for (const target of externalWindows) {
    if (!target || target.isDestroyed()) continue;
    target.webContents.send('ember:screen:state', emberScreenOpen);
    target.setIgnoreMouseEvents(emberScreenOpen);
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

function orientedExternalPanePlacement(position = {}) {
  const main = win.getBounds();
  const display = screen.getDisplayNearestPoint({
    x: Number.isFinite(position.x) ? position.x : main.x + main.width,
    y: Number.isFinite(position.y) ? position.y : main.y + main.height / 2,
  });
  const area = display.workArea;
  const point = {
    x: Number.isFinite(position.x) ? position.x : main.x + main.width,
    y: Number.isFinite(position.y) ? position.y : main.y + main.height / 2,
  };
  const distances = [
    { edge: 'left', value: Math.abs(point.x - main.x) },
    { edge: 'right', value: Math.abs(point.x - (main.x + main.width)) },
    { edge: 'top', value: Math.abs(point.y - main.y) },
    { edge: 'bottom', value: Math.abs(point.y - (main.y + main.height)) },
  ].sort((left, right) => left.value - right.value);
  const edge = distances[0].edge;
  const sideWidth = Math.max(220, Math.round(main.width / 4));
  const bandHeight = Math.max(160, Math.round(main.height / 3));
  const bounds = edge === 'left'
    ? { x: main.x - sideWidth + 1, y: main.y, width: sideWidth, height: main.height }
    : edge === 'right'
      ? { x: main.x + main.width - 1, y: main.y, width: sideWidth, height: main.height }
      : edge === 'top'
        ? { x: main.x, y: main.y - bandHeight + 1, width: main.width, height: bandHeight }
        : { x: main.x, y: main.y + main.height - 1, width: main.width, height: bandHeight };
  const fitsOutsideDisplay = bounds.x >= area.x && bounds.y >= area.y
    && bounds.x + bounds.width <= area.x + area.width
    && bounds.y + bounds.height <= area.y + area.height;
  return { edge, bounds: fitsOutsideDisplay ? bounds : fitCombatPaneBounds(bounds) };
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
  group.window.webContents.send('combat:pane-group:state', {
    paneIds: [...group.paneIds],
    activePaneId: group.activePaneId,
    dock: group.dock || null,
    dockTarget: group.dockTarget || null,
  });
}

function reflowAttachedPaneTree() {
  if (!win || win.isDestroyed()) return;
  const visited = new Set();
  const placeChildren = (targetId, targetBounds) => {
    for (const [groupId, group] of externalCombatPaneGroups) {
      if (visited.has(groupId) || group.dockTarget !== targetId) continue;
      if (!group.window || group.window.isDestroyed() || group.window.getParentWindow() !== win) continue;
      const current = group.window.getBounds();
      const bounds = group.dock === 'left'
        ? { x: targetBounds.x - current.width + 1, y: targetBounds.y, width: current.width, height: targetBounds.height }
        : group.dock === 'right'
          ? { x: targetBounds.x + targetBounds.width - 1, y: targetBounds.y, width: current.width, height: targetBounds.height }
          : group.dock === 'top'
            ? { x: targetBounds.x, y: targetBounds.y - current.height + 1, width: targetBounds.width, height: current.height }
            : group.dock === 'bottom'
              ? { x: targetBounds.x, y: targetBounds.y + targetBounds.height - 1, width: targetBounds.width, height: current.height }
              : null;
      if (!bounds) continue;
      visited.add(groupId);
      const fitted = fitCombatPaneBounds(bounds);
      group.window.setBounds(fitted, false);
      placeChildren(groupId, fitted);
    }
  };
  placeChildren('main', win.getBounds());
}

function reanchorAttachedPaneDependents(closedGroupId) {
  if (!closedGroupId) return;
  for (const group of externalCombatPaneGroups.values()) {
    if (group.dockTarget === closedGroupId && group.window?.getParentWindow() === win) group.dockTarget = 'main';
  }
  reflowAttachedPaneTree();
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
    reanchorAttachedPaneDependents(sourceId);
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
  reanchorAttachedPaneDependents(sourceId);
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
      const attachedTargets = [{ id: 'main', bounds: main }];
      for (const [targetId, target] of externalCombatPaneGroups) {
        if (targetId === groupId || !target.window || target.window.isDestroyed()) continue;
        if (target.window.getParentWindow() !== win) continue;
        attachedTargets.push({ id: targetId, bounds: target.window.getBounds() });
      }
      const attachedSideBounds = attachedTargets
        .filter((target) => {
          if (target.id === 'main') return false;
          const targetGroup = externalCombatPaneGroups.get(target.id);
          return targetGroup?.dock === 'left' || targetGroup?.dock === 'right';
        })
        .map((target) => target.bounds);
      const ensembleLeft = Math.min(main.x, ...attachedSideBounds.map((bounds) => bounds.x));
      const ensembleRight = Math.max(main.x + main.width, ...attachedSideBounds.map((bounds) => bounds.x + bounds.width));
      const ensembleTarget = {
        id: 'main',
        bounds: { x: ensembleLeft, y: main.y, width: ensembleRight - ensembleLeft, height: main.height },
      };
      const draggedHorizontally = current.width >= current.height * 1.35;
      const paneOverlapsEnsembleWidth = current.x < ensembleRight && current.x + current.width > ensembleLeft;
      const withinEnsembleWidth = pointer.x >= ensembleLeft - 24 && pointer.x <= ensembleRight + 24;
      const pointerTopDistance = Math.abs(pointer.y - main.y);
      const pointerBottomDistance = Math.abs(pointer.y - (main.y + main.height));
      const paneTopDockDistance = draggedHorizontally && paneOverlapsEnsembleWidth
        ? Math.abs((current.y + current.height) - main.y)
        : Number.POSITIVE_INFINITY;
      const paneBottomDockDistance = draggedHorizontally && paneOverlapsEnsembleWidth
        ? Math.abs(current.y - (main.y + main.height))
        : Number.POSITIVE_INFINITY;
      const ensembleTopDistance = Math.min(pointerTopDistance, paneTopDockDistance);
      const ensembleBottomDistance = Math.min(pointerBottomDistance, paneBottomDockDistance);
      const ensembleVerticalDepth = Math.max(24, main.height / 12);
      const ensembleCandidates = [
        (withinEnsembleWidth || paneOverlapsEnsembleWidth) && ensembleTopDistance <= ensembleVerticalDepth
          ? { target: ensembleTarget, edge: 'top', distance: ensembleTopDistance, insideTarget: true, priority: 2 } : null,
        (withinEnsembleWidth || paneOverlapsEnsembleWidth) && ensembleBottomDistance <= ensembleVerticalDepth
          ? { target: ensembleTarget, edge: 'bottom', distance: ensembleBottomDistance, insideTarget: true, priority: 2 } : null,
      ].filter(Boolean);
      const dockCandidates = [...ensembleCandidates, ...attachedTargets.flatMap((target) => {
        const bounds = target.bounds;
        const pointerWithinWidth = pointer.x >= bounds.x - 24 && pointer.x <= bounds.x + bounds.width + 24;
        const pointerWithinHeight = pointer.y >= bounds.y - 24 && pointer.y <= bounds.y + bounds.height + 24;
        const insideTarget = pointer.x >= bounds.x && pointer.x <= bounds.x + bounds.width
          && pointer.y >= bounds.y && pointer.y <= bounds.y + bounds.height;
        const horizontalAnchorDepth = Math.max(24, bounds.width * 0.1);
        const verticalAnchorDepth = Math.max(24, bounds.height / 12);
        const topDistance = Math.abs(pointer.y - bounds.y);
        const bottomDistance = Math.abs(pointer.y - (bounds.y + bounds.height));
        const leftDistance = Math.abs(pointer.x - bounds.x);
        const rightDistance = Math.abs(pointer.x - (bounds.x + bounds.width));
        return [
          pointerWithinWidth && topDistance <= verticalAnchorDepth
            ? { target, edge: 'top', distance: topDistance, insideTarget } : null,
          pointerWithinWidth && bottomDistance <= verticalAnchorDepth
            ? { target, edge: 'bottom', distance: bottomDistance, insideTarget } : null,
          pointerWithinHeight && leftDistance <= horizontalAnchorDepth
            ? { target, edge: 'left', distance: leftDistance, insideTarget } : null,
          pointerWithinHeight && rightDistance <= horizontalAnchorDepth
            ? { target, edge: 'right', distance: rightDistance, insideTarget } : null,
        ].filter(Boolean);
      })].sort((left, right) => (right.priority || 0) - (left.priority || 0)
        || Number(right.insideTarget) - Number(left.insideTarget)
        || left.distance - right.distance);
      const dockCandidate = dockCandidates[0];
      if (dockCandidate) {
        const group = externalCombatPaneGroups.get(groupId);
        group.schemaManaged = true;
        group.dock = dockCandidate.edge;
        group.dockTarget = dockCandidate.target.id;
        paneWindow.setParentWindow(win);
        const target = dockCandidate.target.bounds;
        const targetGroup = dockCandidate.target.id === 'main'
          ? null
          : externalCombatPaneGroups.get(dockCandidate.target.id);
        const sideWidth = targetGroup && (targetGroup.dock === 'left' || targetGroup.dock === 'right')
          ? target.width
          : Math.max(220, Math.round(main.width / 4));
        const bandHeight = targetGroup && (targetGroup.dock === 'top' || targetGroup.dock === 'bottom')
          ? target.height
          : Math.max(160, Math.round(main.height / 3));
        const dockedBounds = dockCandidate.edge === 'top'
          ? { x: target.x, y: target.y - bandHeight + 1, width: target.width, height: bandHeight }
          : dockCandidate.edge === 'bottom'
            ? { x: target.x, y: target.y + target.height - 1, width: target.width, height: bandHeight }
            : dockCandidate.edge === 'left'
              ? { x: target.x - sideWidth + 1, y: target.y, width: sideWidth, height: target.height }
              : { x: target.x + target.width - 1, y: target.y, width: sideWidth, height: target.height };
        const fittedDockedBounds = fitCombatPaneBounds(dockedBounds);
        paneWindow.setBounds(fittedDockedBounds, false);
        sendExternalGroup(group, group.activePaneId);
        return;
      }
      const group = externalCombatPaneGroups.get(groupId);
      group.dock = null;
      group.dockTarget = null;
      group.schemaManaged = false;
      paneWindow.setParentWindow(null);
      sendExternalGroup(group, group.activePaneId);
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
  const restoredPaneIds = new Set();
  for (const savedGroup of workspace.groups || []) {
    const paneIds = [...new Set((savedGroup.paneIds || []).filter((paneId) => combatPaneState[paneId] && !restoredPaneIds.has(paneId)))];
    if (!paneIds.length || !validWindowBounds(savedGroup.bounds)) continue;
    for (const paneId of paneIds) restoredPaneIds.add(paneId);
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
    reanchorAttachedPaneDependents(groupId);
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
  group.window.setParentWindow(null);
  delete group.column;
  delete group.stackOrder;
  delete group.stackHeight;
  delete group.partialHeight;
  group.dock = null;
  group.dockTarget = null;
  sendExternalGroup(group, group.activePaneId);

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
  const uniquePaneIds = [...new Set(paneIds)].filter((paneId) => combatPaneState[paneId] && !externalGroupForPane(paneId));
  const [primaryPaneId, ...additionalPaneIds] = uniquePaneIds;
  if (!primaryPaneId) return;
  const fittedBounds = fitCombatPaneBounds(bounds);
  detachCombatPane(primaryPaneId);
  const entry = [...externalCombatPaneGroups].find(([, group]) => group.paneIds.includes(primaryPaneId));
  if (!entry) return;
  const group = entry[1];
  const main = win.getBounds();
  const inferredDock = options.dock
    || (bounds.y + bounds.height <= main.y + 2 ? 'top' : null)
    || (bounds.y >= main.y + main.height - 2 ? 'bottom' : null)
    || (bounds.x + bounds.width <= main.x + 2 ? 'left' : null)
    || (bounds.x >= main.x + main.width - 2 ? 'right' : null);
  group.free = true;
  group.schemaManaged = true;
  group.dock = inferredDock;
  group.dockTarget = inferredDock ? 'main' : null;
  group.paneIds = [...uniquePaneIds];
  for (const paneId of additionalPaneIds) {
    combatPaneState[paneId].visible = true;
    combatPaneState[paneId].detached = true;
    detachedCombatPaneWindows.set(paneId, group.window);
  }
  group.window.setMinimumSize(Math.min(fittedBounds.width, 260), Math.min(fittedBounds.height, 120));
  group.window.setMaximumSize(10000, 10000);
  group.window.setParentWindow(win);
  group.window.setBounds(fittedBounds, false);
  sendExternalGroup(group, primaryPaneId);
}

function fitCombatPaneBounds(bounds) {
  const display = screen.getDisplayNearestPoint({ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 });
  const area = display.workArea;
  const width = Math.max(160, Math.min(bounds.width, area.width));
  const height = Math.max(120, Math.min(bounds.height, area.height));
  const x = Math.max(area.x, Math.min(bounds.x, area.x + area.width - width));
  const y = Math.max(area.y, Math.min(bounds.y, area.y + area.height - height));
  return { x, y, width, height };
}

function displaySchemaGeometry(schema) {
  const main = win.getBounds();
  const display = screen.getDisplayNearestPoint({ x: main.x + main.width / 2, y: main.y + main.height / 2 });
  const area = display.workArea;
  const availableSideWidth = Math.max(160, Math.floor((area.width - main.width) / 2));
  const side = Math.min(Math.round(main.width / 4), availableSideWidth);
  const availableExtraHeight = Math.max(0, area.height - main.height);
  const desiredBottomBand = Math.round(main.height / 4);
  const baseBand = Math.min(desiredBottomBand, Math.floor(availableExtraHeight / 2));
  const band = Math.max(120, baseBand);
  const fullTopBand = Math.min(Math.round(main.height / 3), Math.max(120, availableExtraHeight - 120));
  const fullBottomBand = Math.min(desiredBottomBand, Math.max(120, availableExtraHeight - fullTopBand));
  const topBand = schema === 'large'
    ? Math.max(120, Math.min(Math.round(band * 1.25), availableExtraHeight - 120))
    : schema === 'full'
      ? fullTopBand
      : band;
  const bottomBand = schema === 'large'
    ? Math.max(120, availableExtraHeight - topBand)
    : schema === 'full'
      ? fullBottomBand
      : band;
  const sideCount = schema === 'restricted' || schema === 'large' || schema === 'full' ? 2 : 0;
  const totalWidth = main.width + side * sideCount;
  const totalHeight = schema === 'large' ? main.height + topBand + bottomBand : schema === 'full' ? main.height + topBand + bottomBand : main.height;
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
    createSchemaPaneGroup(['inventory', 'quests'], { x: main.x - side, y: main.y + main.height, width: span, height: bottomBand });
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
    roundedCorners: false,
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
  const orientedPlacement = orientedExternalPanePlacement(position);
  const placement = Number.isFinite(position.x) && Number.isFinite(position.y)
    ? { ...nextExternalPanePlacement(), bounds: orientedPlacement.bounds }
    : nextExternalPanePlacement();
  const detachedWindow = new BrowserWindow({
    ...placement.bounds,
    roundedCorners: false,
    parent: win,
    acceptFirstMouse: true,
    useContentSize: true,
    minWidth: 160,
    minHeight: 120,
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
  const wasDraggedFromInternal = Number.isFinite(position.x) && Number.isFinite(position.y);
  const groupId = `${paneId}:${Date.now()}`;
  const group = {
    paneIds: [paneId],
    window: detachedWindow,
    column: placement.column,
    stackOrder: placement.stackOrder,
    stackHeight: placement.stackHeight,
    free: wasDraggedFromInternal,
    schemaManaged: wasDraggedFromInternal,
    dock: wasDraggedFromInternal ? orientedPlacement.edge : null,
    dockTarget: wasDraggedFromInternal ? 'main' : null,
  };
  externalCombatPaneGroups.set(groupId, group);
  externalCombatPaneOrder.push(groupId);
  detachedCombatPaneWindows.set(paneId, detachedWindow);
  detachedWindow.loadFile(resolveFromApp('app', 'combat_ui_v2', 'action_options.html'), {
    query: { panel: paneId, ...(combatScenarioId ? { scenario: combatScenarioId } : {}) },
  });
  detachedWindow.once('ready-to-show', () => {
    if (!group.free) layoutExternalCombatPanes();
    detachedWindow.show();
    detachedWindow.focus();
    sendExternalGroup(group, paneId);
    broadcastCombatPaneState();
    detachedWindow.webContents.send('ember:screen:state', emberScreenOpen);
    detachedWindow.setIgnoreMouseEvents(emberScreenOpen);
    // An internal tab drag ends before the newly-created native window can emit
    // a move event. Resolve that drop explicitly so an existing side pane wins
    // over the provisional main-window edge placement.
    if (wasDraggedFromInternal) scheduleExternalPaneDrop(groupId, detachedWindow);
  });
  detachedWindow.on('will-move', () => {
    if (movingCombatEnsemble) return;
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
    reanchorAttachedPaneDependents(groupId);
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
  const npcCreator = process.argv.includes("--npc-creator");
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
  const secretCreator = process.argv.includes("--secret-creator");
  const designPreview = combatPreview || creatorPreview || npcCreator || fogPreview || miniDisplayPreview || inventorySmallPreview || restPrepareSmallPreview || creditsPreview || deathPreview || explorationUiPreview || audioManager || explorationMapEditor || dialogueUpload || authoringTools || secretCreator;
  const windowSize = explorationMapEditor
    ? { width: 1440, height: 900, minWidth: 1200, minHeight: 760 }
    : authoringTools
      ? { width: 680, height: 380, minWidth: 620, minHeight: 360 }
    : secretCreator
      ? { width: 1000, height: 800, minWidth: 760, minHeight: 620 }
      : DESIGN_VIEWPORT;
  win = new BrowserWindow({
    width: windowSize.width,
    height: windowSize.height,
    roundedCorners: false,
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
    : creatorPreview || npcCreator
      ? resolveFromApp('app', 'character_creator', 'step_index.html')
      : miniDisplayPreview
        ? resolveFromApp('app', 'mini_display_arena', 'index.html')
      : inventorySmallPreview
        ? resolveFromApp('app', 'ui_screens', 'inventory_small.html')
      : restPrepareSmallPreview
          ? resolveFromApp('app', 'ui_screens', 'rest_prepare_small.html')
        : audioManager
          ? resolveFromApp('authoring_tools', 'audio_manager', 'index.html')
          : secretCreator
            ? resolveFromApp('authoring_tools', 'secret_creator', 'index.html')
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
  else if (npcCreator) win.loadFile(indexPath, { query: { mode: 'npc-companion' } });
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
  if (secretAiOllamaProcess && !secretAiOllamaProcess.killed) secretAiOllamaProcess.kill('SIGTERM');
});

ipcMain.on('app:quit', () => app.quit());
ipcMain.on('ember:screen:set-open', (_event, open) => setEmberScreenOpen(open));
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
ipcMain.on('combat:pane:open-internal', (_event, { paneId } = {}) => {
  const requestedPaneId = String(paneId || '');
  if (!combatPaneState[requestedPaneId] || !win || win.isDestroyed()) return;
  if (combatPaneState[requestedPaneId].visible) {
    setCombatPaneVisible(requestedPaneId, false);
    return;
  }
  win.show();
  win.focus();
  win.webContents.send('combat:pane:open-internal', requestedPaneId);
});
ipcMain.on('combat:connected-windows:drag', (_event, { phase, position } = {}) => {
  if (!win || win.isDestroyed() || !Number.isFinite(position?.x) || !Number.isFinite(position?.y)) return;
  if (phase === 'start') {
    const windows = connectedCombatWindows().map((candidate) => ({ window: candidate, bounds: candidate.getBounds() }));
    connectedCombatWindowDrag = { pointerX: position.x, pointerY: position.y, windows };
    movingCombatEnsemble = true;
    return;
  }
  if (phase === 'move' && connectedCombatWindowDrag) {
    const offsetX = Math.round(position.x - connectedCombatWindowDrag.pointerX);
    const offsetY = Math.round(position.y - connectedCombatWindowDrag.pointerY);
    const mainEntry = connectedCombatWindowDrag.windows.find((entry) => entry.window === win);
    if (mainEntry) win.setPosition(mainEntry.bounds.x + offsetX, mainEntry.bounds.y + offsetY, false);
    for (const entry of connectedCombatWindowDrag.windows) {
      if (entry.window === win || entry.window.isDestroyed()) continue;
      const expectedX = entry.bounds.x + offsetX;
      const expectedY = entry.bounds.y + offsetY;
      const current = entry.window.getBounds();
      if (current.x !== expectedX || current.y !== expectedY) entry.window.setPosition(expectedX, expectedY, false);
    }
    return;
  }
  if (phase === 'end') {
    connectedCombatWindowDrag = null;
    movingCombatEnsemble = false;
  }
});
ipcMain.on('combat:ensemble-handle:suppress-resize', (event, suppress) => {
  const target = BrowserWindow.fromWebContents(event.sender);
  if (!target || target.isDestroyed()) return;
  if (suppress === true) {
    if (!combatHandleResizeState.has(target)) combatHandleResizeState.set(target, target.isResizable());
    target.setResizable(false);
    return;
  }
  const wasResizable = combatHandleResizeState.get(target);
  combatHandleResizeState.delete(target);
  if (wasResizable === true && !target.isDestroyed()) target.setResizable(true);
});
ipcMain.on('combat:ensemble-drag', (event, { phase, position } = {}) => {
  if (!win || win.isDestroyed() || !Number.isFinite(position?.x) || !Number.isFinite(position?.y)) return;
  const paneWindow = BrowserWindow.fromWebContents(event.sender);
  if (!paneWindow || paneWindow.isDestroyed() || paneWindow === win) return;
  if (phase === 'start') {
    const groupEntry = [...externalCombatPaneGroups].find(([, group]) => group.window === paneWindow);
    if (!groupEntry) return;
    const group = groupEntry[1];
    group.free = true;
    group.schemaManaged = false;
    group.dock = null;
    group.dockTarget = null;
    sendExternalGroup(group, group.activePaneId);
    reanchorAttachedPaneDependents(groupEntry[0]);
    const bounds = paneWindow.getBounds();
    combatEnsembleDrag = { pointerX: position.x, pointerY: position.y, windowX: bounds.x, windowY: bounds.y, paneWindow, groupId: groupEntry[0] };
    movingCombatEnsemble = true;
    broadcastCombatPaneDragState(true, paneWindow);
    clearTimeout(combatEnsembleReleaseTimer);
    return;
  }
  if (phase === 'move' && combatEnsembleDrag) {
    movingCombatEnsemble = true;
    clearTimeout(combatEnsembleReleaseTimer);
    combatEnsembleDrag.paneWindow.setPosition(
      Math.round(combatEnsembleDrag.windowX + position.x - combatEnsembleDrag.pointerX),
      Math.round(combatEnsembleDrag.windowY + position.y - combatEnsembleDrag.pointerY),
      false,
    );
    return;
  }
  if (phase === 'end') {
    const completedDrag = combatEnsembleDrag;
    combatEnsembleDrag = null;
    if (completedDrag?.groupId && completedDrag.paneWindow && !completedDrag.paneWindow.isDestroyed()) {
      scheduleExternalPaneDrop(completedDrag.groupId, completedDrag.paneWindow);
    }
    clearTimeout(combatEnsembleReleaseTimer);
    combatEnsembleReleaseTimer = setTimeout(() => {
      movingCombatEnsemble = false;
      broadcastCombatPaneDragState(false);
    }, 240);
  }
});
ipcMain.on('authoring:launch-tool', (_event, tool) => {
  const flags = {
    map: '--exploration-map-editor',
    audio: '--audio-manager',
    dialogue: '--dialogue-upload',
    npc: '--npc-creator',
    secret: '--secret-creator',
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
ipcMain.handle('authoring:save-secret', async (_event, secret) => {
  if (app.isPackaged) throw new Error('Secret authoring is disabled in packaged builds');
  if (!secret || typeof secret !== 'object') throw new Error('Missing secret definition');
  const safeId = String(secret.id || '').replace(/^secret:/, '').replace(/[^a-z0-9._-]+/g, '_');
  if (!safeId) throw new Error('Secret requires a valid id');
  const directory = resolveFromApp('app', 'data', 'secrets');
  fs.mkdirSync(directory, { recursive: true });
  const filePath = path.join(directory, `${safeId}.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(secret, null, 2)}\n`, 'utf8');
  const indexPath = path.join(directory, 'index.json');
  let index = [];
  try { index = JSON.parse(fs.readFileSync(indexPath, 'utf8')); } catch {}
  const fileName = path.basename(filePath);
  index = [...new Set([...index, fileName])].filter((name) => name !== 'index.json').sort();
  fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
  return { ok: true, path: path.relative(app.getAppPath(), filePath) };
});
ipcMain.handle('authoring:list-secret-references', async () => {
  const records = [];
  for (const root of ['app/areas', 'app/data/dialogue', 'app/data/encounters', 'app/assets/maps']) {
    const absolute = resolveFromApp(...root.split('/'));
    if (!fs.existsSync(absolute)) continue;
    for (const filePath of walkJsonFiles(absolute)) {
      try { collectSecretReferences(JSON.parse(fs.readFileSync(filePath, 'utf8')), { filePath, locationId: null, mapId: null }, records); } catch {}
    }
  }
  return [...new Map(records.map((record) => [`${record.type}:${record.id}:${record.mapId || ''}`, record])).values()].sort((a, b) => String(a.locationId || '').localeCompare(String(b.locationId || '')) || a.id.localeCompare(b.id));
});
ipcMain.handle('authoring:secret-ai-status', async () => {
  const modelName = 'qwen3:4b';
  const whisperModel = path.join(app.getPath('userData'), 'models', 'ggml-base.en.bin');
  const ollama = fs.existsSync('/opt/homebrew/bin/ollama');
  const whisper = fs.existsSync('/opt/homebrew/bin/whisper-cli') && fs.existsSync(whisperModel);
  let model = false;
  if (ollama) {
    try { await ensureSecretAiOllama(); const tags = await ollamaJson('/api/tags'); model = (tags.models || []).some((entry) => entry.name === modelName || entry.model === modelName); } catch {}
  }
  return { ollama, whisper, model, modelName, message: !ollama ? 'Ollama is not installed' : !model ? `Download ${modelName} to enable generation` : !whisper ? 'Download the local transcription model to enable voice' : 'Ready' };
});
ipcMain.handle('authoring:secret-ai-transcribe', async (_event, payload = {}) => {
  const startedAt = Date.now(), modelPath = path.join(app.getPath('userData'), 'models', 'ggml-base.en.bin');
  if (!fs.existsSync(modelPath)) throw new Error('Local transcription model is not installed');
  // This machine has unified memory; release the language model before Whisper asks Metal for memory.
  try { await ollamaJson('/api/generate', { model: 'qwen3:4b', keep_alive: 0 }); } catch {}
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'dndt-secret-voice-'));
  const inputPath = path.join(tempDirectory, 'recording.webm'), wavPath = path.join(tempDirectory, 'recording.wav');
  try {
    fs.writeFileSync(inputPath, Buffer.from(String(payload.audioBase64 || ''), 'base64'));
    await execFilePromise('/opt/homebrew/bin/ffmpeg', ['-y', '-i', inputPath, '-ar', '16000', '-ac', '1', wavPath]);
    const output = await execFilePromise('/opt/homebrew/bin/whisper-cli', ['-m', modelPath, '-f', wavPath, '-l', 'en', '-nt', '-np', '-ng', '--prompt', 'Dungeons and Dragons secret authoring. Locations, clues, keys, dialogue, encounters and exploration nodes.']);
    const transcript = output.stdout.trim();
    appendSecretAiExperiment({ type: 'transcription', at: new Date().toISOString(), elapsedMs: Date.now() - startedAt, characters: transcript.length });
    return { transcript, elapsedMs: Date.now() - startedAt };
  } finally { fs.rmSync(tempDirectory, { recursive: true, force: true }); }
});
ipcMain.handle('authoring:secret-ai-generate', async (_event, request = {}) => {
  const startedAt = Date.now(), modelName = 'qwen3:4b';
  if (!String(request.description || '').trim()) throw new Error('A description is required');
  await ensureSecretAiOllama();
  const references = (request.references || []).slice(0, 500).map((entry) => ({ type: entry.type, id: entry.id, locationId: entry.locationId || null, mapId: entry.mapId || null }));
  const prompt = `Draft one DNDT secret from the author's description. Return only schema-valid JSON. Write terse, practical game-authoring copy: no commentary, warnings, parentheticals, or invented lore. Preserve the author's names and wording where possible. Never invent an existing-world reference ID: use only IDs in AVAILABLE REFERENCES. If a needed reference is absent, use a clearly unresolved ID beginning unresolved:. Every clue is manually authored, globally unique, and has exactly one source of type conversation, item, node, or loot. Node sources require mapId. Skill checks never count as clues. Keys are permanent.\n\nAUTHOR DESCRIPTION:\n${request.description}\n\nSELECTED LOCATION:\n${request.locationId || '(none)'}\n\nAVAILABLE REFERENCES:\n${JSON.stringify(references)}`;
  const response = await ollamaJson('/api/chat', { model: modelName, stream: false, think: false, format: SECRET_AI_SCHEMA, options: { temperature: 0.2, num_ctx: 8192, num_predict: 1600 }, messages: [{ role: 'system', content: 'You convert authored game-design descriptions into conservative structured drafts for human review.' }, { role: 'user', content: prompt }] });
  const secret = JSON.parse(response.message?.content || '{}');
  const elapsedMs = Date.now() - startedAt;
  appendSecretAiExperiment({ type: 'generation', at: new Date().toISOString(), model: modelName, elapsedMs, promptCharacters: String(request.description).length, referenceCount: references.length, outputCharacters: JSON.stringify(secret).length });
  return { secret, elapsedMs, model: modelName };
});

const SECRET_AI_SCHEMA = { type: 'object', additionalProperties: false, required: ['id','title','target','clueThreshold','clues','inventory','journal','rewardItems','unlockRequirements','effects','metadata'], properties: {
  id:{type:'string'},title:{type:'string'},target:{type:'object',additionalProperties:false,required:['id','label'],properties:{id:{type:'string'},label:{type:'string'}}},clueThreshold:{type:'integer',minimum:1},
  clues:{type:'array',items:{type:'object',additionalProperties:false,required:['id','name','description','source'],properties:{id:{type:'string'},name:{type:'string'},description:{type:'string'},source:{type:'object',required:['type','id'],properties:{type:{type:'string',enum:['conversation','item','node','loot']},id:{type:'string'},mapId:{type:['string','null']}},additionalProperties:false}}}},
  inventory:{type:'object',additionalProperties:false,required:['searchingText'],properties:{searchingText:{type:'string'}}},journal:{type:'object',additionalProperties:false,required:['searching','milestones','uncovered','unlocked','completed'],properties:{searching:{type:'string'},milestones:{type:'array',items:{type:'object',additionalProperties:false,required:['count','text'],properties:{count:{type:'integer',minimum:1},text:{type:'string'}}}},uncovered:{type:'string'},unlocked:{type:'string'},completed:{type:'string'}}},
  rewardItems:{type:'array',items:{type:'string'}},unlockRequirements:{type:'array',items:{type:'object'}},effects:{type:'object',additionalProperties:false,required:['uncovered','unlocked','completed'],properties:{uncovered:{type:'array',items:{type:'object'}},unlocked:{type:'array',items:{type:'object'}},completed:{type:'array',items:{type:'object'}}}},metadata:{type:'object'}
}};

async function ensureSecretAiOllama() {
  try { await ollamaJson('/api/tags'); return; } catch {}
  if (!secretAiOllamaProcess || secretAiOllamaProcess.exitCode !== null) secretAiOllamaProcess = spawn('/opt/homebrew/bin/ollama', ['serve'], { env: { ...process.env, OLLAMA_FLASH_ATTENTION: '1', OLLAMA_KV_CACHE_TYPE: 'q8_0' }, stdio: 'ignore' });
  for (let attempt = 0; attempt < 30; attempt += 1) { await new Promise((resolve) => setTimeout(resolve, 200)); try { await ollamaJson('/api/tags'); return; } catch {} }
  throw new Error('Unable to start Ollama');
}
async function ollamaJson(endpoint, body = null) {
  const response = await fetch(`http://127.0.0.1:11434${endpoint}`, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}`);
  return response.json();
}
function execFilePromise(file, args) { return new Promise((resolve, reject) => execFile(file, args, { maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => error ? reject(new Error(stderr || error.message)) : resolve({ stdout, stderr }))); }
function appendSecretAiExperiment(record) { const directory = resolveFromApp('authoring_tools', 'secret_creator'); fs.appendFileSync(path.join(directory, 'experiments.jsonl'), `${JSON.stringify(record)}\n`, 'utf8'); }

function walkJsonFiles(directory) {
  const output = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...walkJsonFiles(target));
    else if (entry.isFile() && entry.name.endsWith('.json')) output.push(target);
  }
  return output;
}

function collectSecretReferences(value, inherited, output) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { for (const entry of value) collectSecretReferences(entry, inherited, output); return; }
  const id = typeof value.id === 'string' ? value.id : null;
  const locationId = value.locationId || value.location?.id || inherited.locationId || null;
  const mapId = value.mapId || (id?.startsWith('map:') ? id : inherited.mapId) || null;
  const context = { ...inherited, locationId, mapId };
  if (id) {
    const type = id.startsWith('scene:') ? 'conversation' : id.startsWith('node:') ? 'node' : id.startsWith('encounter:') || id.startsWith('loot:') ? 'loot' : id.startsWith('item:') ? 'item' : id.startsWith('location:') ? 'location' : null;
    if (type) output.push({ type, id, locationId: type === 'location' ? id : locationId, mapId, file: path.relative(app.getAppPath(), inherited.filePath) });
  }
  for (const child of Object.values(value)) collectSecretReferences(child, context, output);
}
ipcMain.handle('authoring:save-npc-companion', async (_event, companion) => {
  if (app.isPackaged) throw new Error('NPC companion authoring is disabled in packaged builds');
  if (!companion || typeof companion !== 'object') throw new Error('Missing companion record');
  if (!companion.id || companion.definition?.kind !== 'companion' || !companion.instance) {
    throw new Error('Invalid companion record');
  }
  const safeId = String(companion.id).trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  if (!safeId) throw new Error('Companion requires a valid id');
  const directory = resolveFromApp('app', 'data', 'companions');
  fs.mkdirSync(directory, { recursive: true });
  const filePath = path.join(directory, `${safeId}.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(companion, null, 2)}\n`, 'utf8');
  return { ok: true, path: path.relative(app.getAppPath(), filePath) };
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
