import { combatObjectCells } from "../combat/combatObjects.js";
import {
  cellDepth,
  cellPolygonLayout,
  createIsometricProjection,
  projectGridPoint,
  rotateIsometricProjection,
} from "../combat/isometricGrid.js";

export function renderCombatGrid({
  gridEl,
  snapshot,
  actor,
  reachable,
  targets,
  shouldPulseTargets,
  selectedTargetId,
  selectedTargetIds,
  animation,
  tabInspectActive = false,
  presentationSettings = null,
  boardRotationQuarterTurns = 0,
  getCoverAtSquare,
  getOccupantForDisplay,
  getConditionLabels,
  getActorHoverLines,
  getActorArmorClass,
  classIconClass,
  onCellClick,
}) {
  gridEl.innerHTML = "";
  const projection = getBoardProjection(snapshot.grid, presentationSettings, boardRotationQuarterTurns);
  const effectiveBoardRotationQuarterTurns = projection.fixedStage ? 0 : boardRotationQuarterTurns;
  decorateGridShell(gridEl, { tabInspectActive, presentationSettings, boardRotationQuarterTurns: effectiveBoardRotationQuarterTurns, projection });
  appendProjectedGrid(gridEl, snapshot, projection);
  for (let y = 0; y < snapshot.grid.height; y++) {
    for (let x = 0; x < snapshot.grid.width; x++) {
      gridEl.appendChild(createGridCell({
        snapshot,
        actor,
        reachable,
        targets,
        shouldPulseTargets,
        selectedTargetId,
        selectedTargetIds,
        animation,
        tabInspectActive,
        presentationSettings,
        getCoverAtSquare,
        getOccupantForDisplay,
        getConditionLabels,
        getActorHoverLines,
        getActorArmorClass,
        classIconClass,
        onCellClick,
        projection,
        x,
        y,
      }));
    }
  }
  appendActorMiniatures(gridEl, snapshot, actor, selectedTargetId, selectedTargetIds, animation, presentationSettings, projection);
  appendDemoMiniatures(gridEl, snapshot.grid, presentationSettings, projection, effectiveBoardRotationQuarterTurns);
}

function createGridCell(options) {
  const {
    snapshot,
    actor,
    reachable,
    targets,
    shouldPulseTargets,
    selectedTargetId,
    selectedTargetIds = [],
    animation,
    tabInspectActive,
    presentationSettings,
    getCoverAtSquare,
    getOccupantForDisplay,
    getConditionLabels,
    getActorHoverLines,
    getActorArmorClass,
    classIconClass,
    onCellClick,
    projection,
    x,
    y,
  } = options;
  const cell = document.createElement("button");
  cell.type = "button";
  cell.className = "cell";
  cell.dataset.x = String(x);
  cell.dataset.y = String(y);
  cell.dataset.cellKey = `${x},${y}`;
  positionIsometricCell(cell, projection, { x, y });

  decorateTerrainCell(cell, snapshot, x, y, getCoverAtSquare);
  if (reachable.has(cell.dataset.cellKey)) cell.classList.add("walkable");
  if (targets.has(cell.dataset.cellKey)) {
    cell.classList.add("targetable");
    if (shouldPulseTargets) cell.classList.add("target-pulse");
  }

  const zoneObjects = combatObjectsAtCell(snapshot, x, y);
  decorateZoneCell(cell, zoneObjects);
  decorateOccupantCell(cell, {
    occupant: getOccupantForDisplay(snapshot, { x, y }),
    actor,
    selectedTargetId,
    selectedTargetIds,
    animation,
    tabInspectActive,
    presentationSettings,
    zoneObjects,
    getConditionLabels,
    getActorHoverLines,
    getActorArmorClass,
    classIconClass,
  });
  cell.addEventListener("click", () => onCellClick({ x, y }));
  return cell;
}

function positionIsometricCell(cell, projection, pos) {
  const layout = cellPolygonLayout(projection, pos);
  const viewBox = projection.viewBox || { width: 1000, height: 562.5 };
  cell.style.left = `${layout.left / viewBox.width * 100}%`;
  cell.style.top = `${layout.top / viewBox.height * 100}%`;
  cell.style.width = `${layout.width / viewBox.width * 100}%`;
  cell.style.height = `${layout.height / viewBox.height * 100}%`;
  cell.style.clipPath = `polygon(${layout.clipPath})`;
  cell.style.zIndex = String(10 + cellDepth(pos));
}

function decorateTerrainCell(cell, snapshot, x, y, getCoverAtSquare) {
  if (snapshot.grid.blocked.has(cell.dataset.cellKey)) {
    cell.classList.add("blocked");
    cell.title = "Blocked";
  }
  const terrainCover = getCoverAtSquare(snapshot, { x, y });
  if (terrainCover.kind === "half") {
    cell.classList.add("cover-half");
    cell.title = "Half cover terrain";
  } else if (terrainCover.kind === "three_quarters") {
    cell.classList.add("cover-three");
    cell.title = "Three-quarters cover terrain";
  }
}

function decorateZoneCell(cell, zoneObjects) {
  if (!zoneObjects.length) return;
  cell.classList.add("zone-glow");
  cell.title = zoneObjects.map((object) => object.name).join(", ");
}

function decorateGridShell(gridEl, { tabInspectActive, presentationSettings, boardRotationQuarterTurns, projection }) {
  const presentation = presentationSettings?.scenarioPresentation || {};
  gridEl.classList.toggle("combat-tab-overlay", Boolean(tabInspectActive && presentationSettings?.tabOverlay?.revealGrid));
  gridEl.classList.toggle("combat-tilt-shift", Boolean(presentationSettings?.tiltShift?.enabled));
  gridEl.classList.toggle("visual-ground", Boolean(presentation.visualGround));
  gridEl.classList.add("isometric-grid-board");
  gridEl.classList.add("projected-grid-board");
  gridEl.dataset.visualGround = presentation.visualGround || "none";
  gridEl.dataset.tiltShiftStrength = presentationSettings?.tiltShift?.strength || "none";
  gridEl.dataset.boardRotation = String(boardRotationQuarterTurns || 0);
  gridEl.style.aspectRatio = `${projection.viewBox.width} / ${projection.viewBox.height}`;
  gridEl.style.setProperty("--combat-board-aspect", String(projection.viewBox.width / projection.viewBox.height));
  gridEl.style.removeProperty("grid-template-columns");
  gridEl.style.removeProperty("grid-template-rows");
  if (presentation.backgroundImage) {
    gridEl.style.setProperty("--combat-ground-image", `url("${presentation.backgroundImage}")`);
  } else {
    gridEl.style.removeProperty("--combat-ground-image");
  }
}

function appendProjectedGrid(gridEl, snapshot, projection) {
  if (!projection) return;

  const viewBox = projection.viewBox || { width: 1000, height: 562.5 };
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("projected-grid");
  svg.setAttribute("viewBox", `0 0 ${viewBox.width} ${viewBox.height}`);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");

  if (projection.calibrationOnly && projection.calibrationLine) {
    appendCalibrationLine(svg, projection.calibrationLine);
  } else {
    for (let x = 0; x <= snapshot.grid.width; x += 1) {
      appendProjectedLine(svg, projection, { x, y: 0 }, { x, y: snapshot.grid.height });
    }
    for (let y = 0; y <= snapshot.grid.height; y += 1) {
      appendProjectedLine(svg, projection, { x: 0, y }, { x: snapshot.grid.width, y });
    }
  }

  gridEl.appendChild(svg);
}

function appendDemoMiniatures(gridEl, grid, presentationSettings, projection, boardRotationQuarterTurns) {
  const presentation = presentationSettings?.scenarioPresentation || {};
  const miniatures = presentation.demoMiniatures || [];
  if (!projection || !miniatures.length) return;

  const layer = document.createElement("div");
  layer.className = "demo-miniature-layer";
  for (const miniature of miniatures) {
    layer.appendChild(createDemoMiniature(miniature, grid, projection, boardRotationQuarterTurns));
  }
  gridEl.appendChild(layer);
}

function appendActorMiniatures(gridEl, snapshot, currentActor, selectedTargetId, selectedTargetIds, animation, presentationSettings, projection) {
  const config = presentationSettings?.scenarioPresentation?.actorMiniatures || {};
  if (!projection || config.enabled !== true) return;

  const layer = document.createElement("div");
  layer.className = "actor-miniature-layer";
  for (const actor of snapshot.actors || []) {
    if (!actor?.position) continue;
    layer.appendChild(createActorMiniature(actor, {
      config,
      currentActor,
      selectedTargetId,
      selectedTargetIds,
      animation,
      projection,
    }));
  }
  gridEl.appendChild(layer);
}

function createActorMiniature(actor, { config, currentActor, selectedTargetId, selectedTargetIds = [], animation, projection }) {
  const projected = projectGridPoint(projection, {
    x: actor.position.x + 0.5,
    y: actor.position.y + 0.5,
  });
  const viewBox = projection.viewBox || { width: 1000, height: 562.5 };
  const size = actorMiniatureSize(actor, config);
  const node = document.createElement("div");
  node.className = [
    "actor-miniature",
    actor.team === "heroes" ? "actor-miniature-hero" : "actor-miniature-enemy",
    actor.hp <= 0 ? "is-defeated" : "",
    actor.id === currentActor?.id ? "is-current" : "",
    actor.id === selectedTargetId || selectedTargetIds.includes(actor.id) ? "is-selected" : "",
    actor.id === animation?.actorId ? "is-animating" : "",
    actor.id === animation?.targetId && animation.kind === "attack" ? "is-attack-target" : "",
  ].filter(Boolean).join(" ");
  node.style.left = `${projected.x / viewBox.width * 100}%`;
  node.style.top = `${projected.y / viewBox.height * 100}%`;
  node.style.width = `${size.width / viewBox.width * 100}%`;
  node.style.height = `${size.height / viewBox.height * 100}%`;
  node.style.zIndex = String(Math.round((projected.y + actor.position.x + actor.position.y) * 10) + 1000);
  node.title = `${actor.name} (${actor.hp}/${actor.maxHp})`;

  const base = document.createElement("div");
  base.className = "actor-miniature-base";
  node.appendChild(base);

  const figure = document.createElement("div");
  figure.className = "actor-miniature-figure";
  const image = actorMiniatureImage(actor, config);
  if (image) figure.style.backgroundImage = `url("${image}")`;
  node.appendChild(figure);
  return node;
}

function actorMiniatureSize(actor, config) {
  const byRole = config.sizes?.[actor.role] || config.sizes?.[actor.team];
  return byRole || config.defaultSize || { width: 144, height: 240 };
}

function actorMiniatureImage(actor, config) {
  const assets = config.assets || {};
  return assets[actor.id] || assets[actor.role] || assets[actor.team] || assets.default || "";
}

function createDemoMiniature(miniature, grid, projection, boardRotationQuarterTurns) {
  const footprint = miniature.footprint || { width: 1, height: 1 };
  const center = {
    x: miniature.position.x + footprint.width / 2,
    y: miniature.position.y + footprint.height / 2,
  };
  const projected = projectGridPoint(projection, center);
  const node = document.createElement("div");
  node.className = `demo-miniature demo-miniature-${miniature.kind || "css"} base-${miniature.baseAccent || "neutral"}`;
  node.style.left = `${projected.x / (projection.viewBox?.width || 1000) * 100}%`;
  node.style.top = `${projected.y / (projection.viewBox?.height || 562.5) * 100}%`;
  if (miniature.size?.width) node.style.width = `${miniature.size.width / (projection.viewBox?.width || 1000) * 100}%`;
  if (miniature.size?.height) node.style.height = `${miniature.size.height / (projection.viewBox?.height || 562.5) * 100}%`;
  node.style.zIndex = String(Math.round((projected.y + center.x + center.y) * 10));
  node.dataset.boardRotation = String(((boardRotationQuarterTurns % 4) + 4) % 4);
  node.title = miniature.name || miniature.id;

  const base = document.createElement("div");
  base.className = "demo-miniature-base";
  if (footprint.width > 1 || footprint.height > 1) base.classList.add("large-base");
  node.appendChild(base);

  const figure = document.createElement("div");
  figure.className = "demo-miniature-figure";
  if (miniature.image) figure.style.backgroundImage = `url("${miniature.image}")`;
  node.appendChild(figure);
  return node;
}

function getBoardProjection(grid, presentationSettings, boardRotationQuarterTurns) {
  const presentationProjection = presentationSettings?.scenarioPresentation?.gridProjection || {};
  if (presentationProjection.kind === "stage_metadata" || presentationProjection.fixedStage === true) {
    return {
      kind: presentationProjection.kind || "stage_metadata",
      fixedStage: true,
      viewBox: normalizeViewBox(presentationProjection.viewBox),
      origin: normalizePoint(presentationProjection.origin),
      xAxis: normalizePoint(presentationProjection.xAxis),
      yAxis: normalizePoint(presentationProjection.yAxis),
    };
  }
  const projection = createIsometricProjection(grid, {
    viewBox: presentationProjection.viewBox,
    tile: presentationProjection.tile,
    margin: presentationProjection.margin,
  });
  return rotateIsometricProjection(projection, boardRotationQuarterTurns, grid);
}

function normalizeViewBox(viewBox) {
  return {
    width: Number.isFinite(viewBox?.width) && viewBox.width > 0 ? viewBox.width : 1000,
    height: Number.isFinite(viewBox?.height) && viewBox.height > 0 ? viewBox.height : 562.5,
  };
}

function normalizePoint(point) {
  return {
    x: Number.isFinite(point?.x) ? point.x : 0,
    y: Number.isFinite(point?.y) ? point.y : 0,
  };
}

function appendCalibrationLine(svg, lineSpec) {
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.classList.add("calibration-line");
  line.setAttribute("x1", formatPoint(lineSpec.from.x));
  line.setAttribute("y1", formatPoint(lineSpec.from.y));
  line.setAttribute("x2", formatPoint(lineSpec.to.x));
  line.setAttribute("y2", formatPoint(lineSpec.to.y));
  svg.appendChild(line);
}

function appendProjectedLine(svg, projection, from, to) {
  const start = projectGridPoint(projection, from);
  const end = projectGridPoint(projection, to);
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", formatPoint(start.x));
  line.setAttribute("y1", formatPoint(start.y));
  line.setAttribute("x2", formatPoint(end.x));
  line.setAttribute("y2", formatPoint(end.y));
  svg.appendChild(line);
}

function formatPoint(value) {
  return Number(value).toFixed(2);
}

function decorateOccupantCell(cell, options) {
  const { occupant, actor, selectedTargetId, selectedTargetIds = [], animation, tabInspectActive, presentationSettings, zoneObjects, getConditionLabels, getActorHoverLines, getActorArmorClass, classIconClass } = options;
  if (!occupant) return;
  const hoverLines = getActorHoverLines
    ? getActorHoverLines(occupant, zoneObjects)
    : [`${occupant.name} ${occupant.hp}/${occupant.maxHp}`, ...getConditionLabels(occupant)];
  cell.title = hoverLines.join("\n");
  cell.classList.add(occupant.team === "heroes" ? "hero" : "enemy");
  if (occupant.hp <= 0) cell.classList.add("dead");
  if (occupant.hp > 0 && occupant.id === actor?.id) cell.classList.add("current");
  if (occupant.hp > 0 && (occupant.id === selectedTargetId || selectedTargetIds.includes(occupant.id))) cell.classList.add("selected-target");
  if (occupant.hp > 0 && occupant.id === animation?.actorId) cell.classList.add("animating");
  if (occupant.hp > 0 && occupant.id === animation?.targetId && animation.kind === "attack") cell.classList.add("attack-flash");
  if (occupant.hp > 0 && presentationSettings?.scenarioPresentation?.actorMiniatures?.enabled !== true) appendRoleIcon(cell, occupant, classIconClass);
  if (tabInspectActive && presentationSettings?.tabOverlay?.revealActorStats) appendActorStats(cell, occupant, getActorArmorClass);
}

function appendActorStats(cell, occupant, getActorArmorClass) {
  const stats = document.createElement("small");
  stats.className = "actor-stat-label";
  stats.textContent = `HP ${occupant.hp}/${occupant.maxHp}  AC ${getActorArmorClass ? getActorArmorClass(occupant) : occupant.ac}`;
  cell.appendChild(stats);
}

function appendRoleIcon(cell, occupant, classIconClass) {
  const roleIcon = document.createElement("span");
  roleIcon.className = `class-icon ${classIconClass(occupant)}`;
  roleIcon.title = occupant.role || occupant.team;
  cell.appendChild(roleIcon);
}

function combatObjectsAtCell(snapshot, x, y) {
  return (snapshot.combatObjects || []).filter((object) =>
    combatObjectCells(snapshot, object).some((cellPos) => cellPos.x === x && cellPos.y === y)
  );
}
