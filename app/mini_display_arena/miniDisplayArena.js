const ARENA_PRESENTATIONS = Object.freeze({
  large: Object.freeze({
    gridWidth: 15,
    gridHeight: 19,
    tileWidth: 128,
    tileHeight: 64,
    origin: { x: 1088, y: 0 },
    miniatureScale: 1,
    start: { x: 2, y: 16 },
  }),
  standard: Object.freeze({
    gridWidth: 10,
    gridHeight: 14,
    tileWidth: 176,
    tileHeight: 88,
    origin: { x: 1136, y: 12 },
    miniatureScale: 1.375,
    start: { x: 1, y: 12 },
  }),
  small: Object.freeze({
    gridWidth: 9,
    gridHeight: 12,
    tileWidth: 201.142857,
    tileHeight: 100.571429,
    origin: { x: 1110.857143, y: 12 },
    miniatureScale: 1.571429,
    start: { x: 1, y: 10 },
  }),
  cramped: Object.freeze({
    gridWidth: 8,
    gridHeight: 11,
    tileWidth: 222.315789,
    tileHeight: 111.157895,
    origin: { x: 1126.736842, y: 12 },
    miniatureScale: 1.736842,
    start: { x: 1, y: 9 },
  }),
});

const requestedArena = new URLSearchParams(window.location.search).get("size")?.toLowerCase();
const conditionScaleTest = new URLSearchParams(window.location.search).get("test") === "conditions";
const arenaName = ["large", "standard", "small", "cramped"].includes(requestedArena) ? requestedArena : "large";
const arena = ARENA_PRESENTATIONS[arenaName];
const STAGE = Object.freeze({ width: 1920, height: 1080, ...arena });
const BASE_CENTER_ANCHOR = Object.freeze({
  x: 96 * arena.miniatureScale,
  y: 280 * arena.miniatureScale,
});
const PLAYABLE_VERTICAL_BOUNDS = Object.freeze({ minCenterY: 216, maxCenterY: 844 });
const viewport = document.querySelector(".viewport");
const plate = document.querySelector(".plate");
const lines = document.querySelector(".grid-lines");
const obstaclesLayer = document.querySelector(".obstacles");
const hoverCell = document.querySelector(".hover-cell");
const routeDots = document.querySelector(".route-dots");
const routeLabel = document.querySelector(".route-label");
const miniature = document.querySelector(".miniature");
const conditionPicker = document.querySelector(".condition-picker");
let position = { ...arena.start };
let selectedTarget = null;
let selectedPath = null;
let isMoving = false;
const cellKey = (cell) => `${cell.x},${cell.y}`;
const walkableCells = new Set();
const displayedCells = new Set();
const CRAMPED_OBSTACLES = Object.freeze({
  rocks: [{ x: 2, y: 6 }, { x: 5, y: 5 }],
  tree: [{ x: 2, y: 3 }, { x: 3, y: 3 }, { x: 4, y: 3 }],
});
const blockedCells = new Set(
  arenaName === "cramped"
    ? [...CRAMPED_OBSTACLES.rocks, ...CRAMPED_OBSTACLES.tree].map(cellKey)
    : [],
);
const CONDITION_ICON_GROUPS = Object.freeze([
  ["Condition categories", "poison_minus", "bodily_minus", "movement_minus", "psychological_minus", "perceptual_minus"],
  ["Ongoing damage", "ongoing_fire", "ongoing_cold", "ongoing_lightning", "generic_negative", "armor_agathys"],
  ["Damage protection", "resist_fire", "resist_cold", "resist_lightning", "generic_protection", "cover"],
  ["Positive effects", "healing", "bless", "armor_up", "speed_up", "attack_up"],
  ["Remaining effects", "armor_down", "saves_up", "saves_down", "hidden", "generic_negative"],
]);

document.documentElement.dataset.arenaSize = arenaName;
document.title = `${arenaName[0].toUpperCase()}${arenaName.slice(1)} Miniature Display Arena`;
miniature.style.width = `${192 * arena.miniatureScale}px`;
miniature.style.height = `${320 * arena.miniatureScale}px`;
miniature.style.transformOrigin = `${BASE_CENTER_ANCHOR.x}px ${BASE_CENTER_ANCHOR.y}px`;

function project(point) {
  return {
    x: STAGE.origin.x + ((point.x - point.y) * STAGE.tileWidth) / 2,
    y: STAGE.origin.y + ((point.x + point.y) * STAGE.tileHeight) / 2,
  };
}

function cellCenter(cell) {
  return project({ x: cell.x + 0.5, y: cell.y + 0.5 });
}

function cellPoints(cell) {
  return [
    project({ x: cell.x, y: cell.y }),
    project({ x: cell.x + 1, y: cell.y }),
    project({ x: cell.x + 1, y: cell.y + 1 }),
    project({ x: cell.x, y: cell.y + 1 }),
  ];
}

function path(points) {
  return points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
}

function drawGrid() {
  const expansion = arenaName === "cramped" ? 0 : 8;

  for (let x = -expansion; x < STAGE.gridWidth + expansion; x += 1) {
    for (let y = -expansion; y < STAGE.gridHeight + expansion; y += 1) {
      const cell = { x, y };
      const points = cellPoints(cell);
      const center = cellCenter(cell);
      const fullyOnPlate = points.every((point) => point.x >= 0 && point.x <= STAGE.width && point.y >= 0 && point.y <= STAGE.height);
      const verticallySafe = center.y >= PLAYABLE_VERTICAL_BOUNDS.minCenterY
        && center.y <= PLAYABLE_VERTICAL_BOUNDS.maxCenterY;
      const safe = fullyOnPlate && verticallySafe;

      if (!safe) continue;
      displayedCells.add(cellKey(cell));
      walkableCells.add(cellKey(cell));
      appendCell(points);
    }
  }
}

function appendCell(points) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  node.setAttribute("class", "grid-cell");
  node.setAttribute("points", points.map((point) => `${point.x},${point.y}`).join(" "));
  lines.appendChild(node);
}

function appendLine(points) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", "path");
  node.setAttribute("class", "grid-line");
  node.setAttribute("d", path(points));
  lines.appendChild(node);
}

function fitPlate() {
  const bounds = viewport.getBoundingClientRect();
  plate.style.transform = `scale(${bounds.width / STAGE.width})`;
}

function eventPoint(event) {
  const bounds = plate.getBoundingClientRect();
  const scale = bounds.width / STAGE.width;
  return { x: (event.clientX - bounds.left) / scale, y: (event.clientY - bounds.top) / scale };
}

function pointToCell(point) {
  const projectedX = (point.x - STAGE.origin.x) / (STAGE.tileWidth / 2);
  const projectedY = (point.y - STAGE.origin.y) / (STAGE.tileHeight / 2);
  return {
    x: Math.floor((projectedX + projectedY) / 2),
    y: Math.floor((projectedY - projectedX) / 2),
  };
}

function isInside(cell) {
  return walkableCells.has(cellKey(cell)) && !blockedCells.has(cellKey(cell));
}

function showHover(cell) {
  if (!isInside(cell)) {
    hoverCell.style.opacity = "0";
    return;
  }
  hoverCell.setAttribute("points", cellPoints(cell).map((point) => `${point.x},${point.y}`).join(" "));
  hoverCell.style.opacity = "1";
  if (arenaName === "cramped") showRoute(cell, false);
}

function findPath(start, goal) {
  if (!isInside(start) || !isInside(goal)) return null;
  const frontier = [start];
  const cameFrom = new Map([[cellKey(start), null]]);
  const cells = new Map([[cellKey(start), start]]);
  const deltas = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

  while (frontier.length) {
    const current = frontier.shift();
    if (cellKey(current) === cellKey(goal)) break;
    for (const delta of deltas) {
      const next = { x: current.x + delta.x, y: current.y + delta.y };
      const key = cellKey(next);
      if (!isInside(next) || cameFrom.has(key)) continue;
      frontier.push(next);
      cells.set(key, next);
      cameFrom.set(key, cellKey(current));
    }
  }

  if (!cameFrom.has(cellKey(goal))) return null;
  const result = [];
  for (let key = cellKey(goal); key; key = cameFrom.get(key)) result.push(cells.get(key));
  return result.reverse();
}

function showRoute(target, lock) {
  const route = findPath(position, target);
  if (!route) {
    if (lock) { selectedTarget = null; selectedPath = null; }
    routeDots.replaceChildren();
    routeLabel.style.opacity = "0";
    return;
  }
  if (lock) { selectedTarget = target; selectedPath = route; }
  const points = route.map(cellCenter);
  drawRouteDots(points);
  const feet = Math.max(0, route.length - 1) * 5;
  const remaining = 30 - feet;
  if (remaining < 0) {
    alignRouteLabel(points);
    routeLabel.textContent = `(${feet}/30)`;
    routeLabel.style.fill = "rgba(196, 122, 112, 0.78)";
    routeLabel.style.opacity = "1";
  } else {
    routeLabel.style.opacity = "0";
  }
}

function drawRouteDots(points) {
  routeDots.replaceChildren();
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    for (const amount of [0.35, 0.7]) {
      const node = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      node.setAttribute("class", "route-dot");
      node.setAttribute("cx", String(previous.x + (current.x - previous.x) * amount));
      node.setAttribute("cy", String(previous.y + (current.y - previous.y) * amount));
      node.setAttribute("r", "3");
      routeDots.appendChild(node);
    }
  }
}

function alignRouteLabel(points) {
  if (!points.length) return;
  const end = points[points.length - 1];
  const previous = points.length > 1 ? points[points.length - 2] : { x: end.x - 1, y: end.y };
  let angle = Math.atan2(end.y - previous.y, end.x - previous.x) * 180 / Math.PI;
  if (angle > 90 || angle < -90) angle += 180;
  const radians = angle * Math.PI / 180;
  const x = end.x - Math.sin(radians) * 30;
  const y = end.y + Math.cos(radians) * 30;
  routeLabel.setAttribute("x", String(x));
  routeLabel.setAttribute("y", String(y));
  routeLabel.setAttribute("transform", `rotate(${angle} ${x} ${y})`);
}

function drawObstacles() {
  if (arenaName !== "cramped" || conditionScaleTest) return;
  for (const cell of CRAMPED_OBSTACLES.rocks) appendObstacle(cell, "rock");
  for (const cell of CRAMPED_OBSTACLES.tree) appendObstacle(cell, "tree");
}

function appendObstacle(cell, kind) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  node.setAttribute("class", `obstacle-cell ${kind}`);
  node.setAttribute("points", cellPoints(cell).map((point) => `${point.x},${point.y}`).join(" "));
  obstaclesLayer.appendChild(node);
}

function placeMiniature(cell, animate = true) {
  if (!isInside(cell)) return;
  position = cell;
  const anchor = cellCenter(cell);
  if (!animate) miniature.style.transition = "none";
  miniature.style.left = `${anchor.x - BASE_CENTER_ANCHOR.x}px`;
  miniature.style.top = `${anchor.y - BASE_CENTER_ANCHOR.y}px`;
  miniature.style.zIndex = String(Math.round(anchor.y * 10));
  if (!animate) requestAnimationFrame(() => { miniature.style.transition = ""; });
}

function placeScaledMiniature(node, cell, scale) {
  const anchor = cellCenter(cell);
  const baseAnchor = { x: 96 * scale, y: 280 * scale };
  node.style.width = `${192 * scale}px`;
  node.style.height = `${320 * scale}px`;
  node.style.left = `${anchor.x - baseAnchor.x}px`;
  node.style.top = `${anchor.y - baseAnchor.y}px`;
  node.style.zIndex = String(Math.round(anchor.y * 10));
}

function placeConditionIcons(node, scale) {
  const row = document.createElement("div");
  row.className = "condition-icon-row";
  const iconSize = 34 * (scale / ARENA_PRESENTATIONS.cramped.miniatureScale);
  const miniatureLeft = Number.parseFloat(node.style.left);
  const miniatureTop = Number.parseFloat(node.style.top);
  const shoulderBodyLeft = miniatureLeft + 82 * scale;
  row.style.left = `${shoulderBodyLeft - 2 - iconSize}px`;
  row.style.top = `${miniatureTop + 112 * scale}px`;
  row.dataset.iconSize = String(iconSize);
  plate.appendChild(row);
  return row;
}

function showConditionIconGroup(rows, groupIndex) {
  const names = CONDITION_ICON_GROUPS[groupIndex].slice(1);
  rows.forEach((row) => {
    const size = Number(row.dataset.iconSize);
    row.replaceChildren(...names.map((name) => {
      const icon = document.createElement("img");
      icon.src = `./assets/condition_icons_v1/display/${name}.png`;
      icon.alt = "";
      icon.width = size;
      icon.height = size;
      icon.style.width = `${size}px`;
      icon.style.height = `${size}px`;
      return icon;
    }));
  });
}

function setupConditionScaleTest() {
  if (!conditionScaleTest || arenaName !== "cramped") return false;
  const specimens = [
    { scale: ARENA_PRESENTATIONS.large.miniatureScale, cell: { x: 1, y: 9 } },
    { scale: ARENA_PRESENTATIONS.standard.miniatureScale, cell: { x: 3, y: 7 } },
    { scale: ARENA_PRESENTATIONS.small.miniatureScale, cell: { x: 5, y: 7 } },
    { scale: ARENA_PRESENTATIONS.cramped.miniatureScale, cell: { x: 6, y: 6 } },
  ];
  const source = miniature.getAttribute("src");
  const iconRows = [];
  specimens.forEach((specimen, index) => {
    const node = index === 0 ? miniature : document.createElement("img");
    if (index > 0) {
      node.className = "miniature";
      node.src = source;
      node.alt = "Female aasimar condition icon scale specimen";
      plate.appendChild(node);
    }
    node.style.transition = "none";
    placeScaledMiniature(node, specimen.cell, specimen.scale);
    iconRows.push(placeConditionIcons(node, specimen.scale));
  });
  CONDITION_ICON_GROUPS.forEach(([label], index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = label;
    conditionPicker.appendChild(option);
  });
  conditionPicker.addEventListener("change", () => showConditionIconGroup(iconRows, Number(conditionPicker.value)));
  showConditionIconGroup(iconRows, 0);
  return true;
}

function waitForMovementStep() {
  return new Promise((resolve) => setTimeout(resolve, 240));
}

async function moveAlongPath(route) {
  isMoving = true;
  miniature.style.transition = "left 220ms ease, top 220ms ease";
  for (const cell of route.slice(1)) {
    placeMiniature(cell);
    await waitForMovementStep();
  }
  miniature.style.transition = "";
  isMoving = false;
}

plate.addEventListener("pointermove", (event) => {
  if (!conditionScaleTest) showHover(pointToCell(eventPoint(event)));
});
plate.addEventListener("pointerleave", () => { hoverCell.style.opacity = "0"; });
plate.addEventListener("click", (event) => {
  if (conditionScaleTest) return;
  const cell = pointToCell(eventPoint(event));
  if (arenaName === "cramped" && isInside(cell)) showRoute(cell, true);
  else if (isInside(cell)) placeMiniature(cell);
  plate.focus();
});
plate.addEventListener("keydown", (event) => {
  if (conditionScaleTest) return;
  if (arenaName === "cramped" && event.key === "Enter") {
    event.preventDefault();
    if (!isMoving && selectedTarget && selectedPath && (selectedPath.length - 1) * 5 <= 30) {
      const completedPath = selectedPath;
      selectedTarget = null;
      selectedPath = null;
      moveAlongPath(completedPath).then(() => {
        routeDots.replaceChildren();
        routeLabel.style.opacity = "0";
      });
    }
    return;
  }
  const delta = {
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
  }[event.key];
  if (!delta) return;
  event.preventDefault();
  placeMiniature({ x: position.x + delta.x, y: position.y + delta.y });
});
window.addEventListener("resize", fitPlate);

drawGrid();
drawObstacles();
if (!setupConditionScaleTest()) {
  conditionPicker.hidden = true;
  placeMiniature(position, false);
}
fitPlate();
plate.focus();
