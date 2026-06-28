import { actorsInFootprint, buildFootprint, lineDirection } from "../combat/footprints.js";

export function createTargetingUi({
  controller,
  gridEl,
  panelEl,
  statusEl,
  confirmButtonEl,
  shapeSelectEl,
  getSelectedActionId,
  clearSelections,
  getAiRunning,
  getCurrentActor,
  getActionById,
  canPlayerAct,
  render,
  renderLog,
}) {
  let state = createEmptyTargetTest();

  return {
    reset,
    start,
    syncForAction,
    renderPanel,
    lock,
    confirm,
    clearClasses,
    onPointerMove,
    onGridDoubleClick,
    onShapeChange,
    isAreaTargetingAction,
  };

  function reset() {
    clearClasses();
    state = createEmptyTargetTest();
  }

  function start(action) {
    reset();
    if (!isAreaTargetingAction(action)) return;
    state = {
      active: true,
      shape: action.type === "target_test" ? normalizeTargetTestShape(shapeSelectEl.value) : normalizeTargetTestShape(action.targeting?.shape),
      hover: null,
      locked: null,
      pathCells: [],
      previewKeys: new Set(),
      lockedKeys: new Set(),
    };
  }

  function syncForAction(action) {
    if (isAreaTargetingAction(action) || !state.active) return;
    reset();
  }

  function renderPanel(actor, playerTurn) {
    const action = getActionById(actor, getSelectedActionId());
    const visible = playerTurn && isAreaTargetingAction(action);
    panelEl.hidden = !visible;
    confirmButtonEl.disabled = !visible || !state.locked;
    confirmButtonEl.textContent = "Confirm Target";
    shapeSelectEl.hidden = action?.type !== "target_test";
    shapeSelectEl.disabled = !visible || action?.type !== "target_test";
    shapeSelectEl.value = state.shape;
    if (!visible) {
      statusEl.textContent = "Click grid to lock target";
      return;
    }
    const label = targetTestShapeLabel(state.shape);
    if (state.shape === "cell_path") {
      statusEl.textContent = state.pathCells.length
        ? `${label}: ${state.pathCells.length}/${action.targeting?.maxCells || 10} tiles. Double-click to confirm.`
        : `${label}: click tiles one at a time, double-click to confirm.`;
      return;
    }
    statusEl.textContent = state.locked
      ? `${label} locked: ${state.locked.x},${state.locked.y}`
      : `Hover to preview ${label.toLowerCase()}, click to lock target`;
  }

  function lock(pos) {
    if (state.shape === "cell_path") {
      appendPathCell(pos);
      renderPanel(getCurrentActor(controller.snapshot), true);
      return;
    }
    clearClasses();
    state.locked = pos;
    if (state.hover) applyPreview(state.hover);
    replaceCellClassSet(state.lockedKeys, footprint(pos), "target-test-locked");
    markAnchor(pos);
    renderPanel(getCurrentActor(controller.snapshot), true);
  }

  function confirm() {
    const actor = getCurrentActor(controller.snapshot);
    if (!canPlayerAct(controller.snapshot, actor?.id, getAiRunning()) || !state.active || !state.locked) return;
    const action = getActionById(actor, getSelectedActionId());
    if (action?.type !== "target_test" && action?.targeting?.shape) {
      const targetPayload = state.shape === "cell_path"
        ? { anchor: { ...state.pathCells[0] }, cells: state.pathCells.map((cell) => ({ ...cell })) }
        : { anchor: { ...state.locked } };
      controller.action(actor.id, action.id, targetPayload);
      clearSelections();
      reset();
      render();
      return;
    }

    const cells = footprint(state.locked);
    controller.log.add("target.test", {
      round: controller.snapshot.round,
      actorId: actor.id,
      actorName: actor.name,
      shape: state.shape,
      radiusSquares: state.shape === "radius" ? 2 : null,
      radiusFt: state.shape === "radius" ? 10 : null,
      lengthSquares: state.shape === "line" ? 6 : null,
      lengthFt: state.shape === "line" ? 30 : null,
      coneLengthSquares: state.shape === "cone" ? 6 : null,
      coneLengthFt: state.shape === "cone" ? 30 : null,
      cubeSizeSquares: state.shape === "cube" ? 6 : null,
      cubeSizeFt: state.shape === "cube" ? 30 : null,
      direction: ["line", "cone"].includes(state.shape) ? lineDirection(getCurrentActor(controller.snapshot)?.position, state.locked) : null,
      anchor: { ...state.locked },
      cells,
      affectedActors: actorsInFootprint(controller.snapshot.actors, cells),
    });
    renderLog();
  }

  function onPointerMove(event) {
    if (!state.active) return;
    if (state.shape === "cell_path") return;
    const pos = getGridEventPosition(event);
    if (!pos || samePos(pos, state.hover)) return;
    state.hover = pos;
    applyPreview(pos);
  }

  function onGridDoubleClick(event) {
    const pos = getGridEventPosition(event);
    if (pos && state.shape === "cell_path" && state.pathCells.length) confirm();
    else if (pos && state.locked) confirm();
  }

  function onShapeChange() {
    clearClasses();
    state.shape = normalizeTargetTestShape(shapeSelectEl.value);
    state.locked = null;
    if (state.hover) applyPreview(state.hover);
    renderPanel(getCurrentActor(controller.snapshot), true);
  }

  function applyPreview(pos) {
    replaceCellClassSet(state.previewKeys, footprint(pos), "target-test-preview");
  }

  function appendPathCell(pos) {
    const action = getActionById(getCurrentActor(controller.snapshot), getSelectedActionId());
    const maxCells = action?.targeting?.maxCells || 10;
    if (state.pathCells.length >= maxCells) return;
    if (state.pathCells.some((cell) => samePos(cell, pos))) return;
    const previous = state.pathCells[state.pathCells.length - 1];
    if (previous && manhattan(previous, pos) !== 1) return;
    state.pathCells.push({ ...pos });
    state.locked = { ...pos };
    replaceCellClassSet(state.lockedKeys, state.pathCells, "target-test-locked");
    markAnchor(pos);
  }

  function footprint(pos) {
    if (state.shape === "cell_path") return state.pathCells.length ? state.pathCells : [pos];
    const origin = getCurrentActor(controller.snapshot)?.position;
    const action = getActionById(getCurrentActor(controller.snapshot), getSelectedActionId());
    const targeting = action?.targeting || {};
    return buildFootprint(controller.snapshot.grid, state.shape, pos, {
      origin,
      radiusSquares: targeting.radiusSquares ?? 2,
      lengthSquares: targeting.lengthSquares ?? 6,
      sizeSquares: targeting.sizeSquares ?? 6,
    });
  }

  function targetTestShapeLabel(shape) {
    const action = getActionById(getCurrentActor(controller.snapshot), getSelectedActionId());
    const targeting = action?.targeting || {};
    if (shape === "line") return `Line ${targeting.lengthFt ?? 30}ft`;
    if (shape === "cell_path") return `Wall ${targeting.maxCells ?? 10} tiles`;
    if (shape === "cone") return `Cone ${targeting.lengthFt ?? 30}ft`;
    if (shape === "cube") return `Cube ${targeting.sizeFt ?? 30}ft`;
    return `Radius ${targeting.radiusFt ?? 10}ft`;
  }

  function replaceCellClassSet(previousKeys, cells, className) {
    for (const key of previousKeys) getCellByKey(key)?.classList.remove(className);
    previousKeys.clear();
    for (const cell of cells) {
      const key = keyOfPos(cell);
      getCellByKey(key)?.classList.add(className);
      previousKeys.add(key);
    }
  }

  function clearClasses() {
    for (const key of state.previewKeys || []) getCellByKey(key)?.classList.remove("target-test-preview");
    for (const key of state.lockedKeys || []) getCellByKey(key)?.classList.remove("target-test-locked", "target-test-anchor");
  }

  function markAnchor(pos) {
    for (const cell of gridEl.querySelectorAll(".target-test-anchor")) {
      cell.classList.remove("target-test-anchor");
    }
    getCellByKey(keyOfPos(pos))?.classList.add("target-test-anchor");
  }

  function getGridEventPosition(event) {
    const cell = event.target.closest?.(".cell");
    if (!cell || !gridEl.contains(cell)) return null;
    return {
      x: Number(cell.dataset.x),
      y: Number(cell.dataset.y),
    };
  }

  function getCellByKey(key) {
    return gridEl.querySelector(`[data-cell-key="${key}"]`);
  }
}

export function isAreaTargetingAction(action) {
  return action?.type === "target_test" || Boolean(action?.targeting?.shape);
}

function createEmptyTargetTest() {
  return {
    active: false,
    shape: "radius",
    hover: null,
    locked: null,
    pathCells: [],
    previewKeys: new Set(),
    lockedKeys: new Set(),
  };
}

function normalizeTargetTestShape(value) {
  return ["radius", "line", "cone", "cube", "cell_path"].includes(value) ? value : "radius";
}

function keyOfPos(pos) {
  return `${pos.x},${pos.y}`;
}

function samePos(a, b) {
  return !!a && !!b && a.x === b.x && a.y === b.y;
}

function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
