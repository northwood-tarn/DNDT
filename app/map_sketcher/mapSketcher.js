const canvas = document.getElementById("areaCanvas");
const ctx = canvas.getContext("2d");

const sizeSelect = document.getElementById("sizeSelect");
const modeSelect = document.getElementById("modeSelect");
const mapNameInput = document.getElementById("mapName");
const mapIdInput = document.getElementById("mapId");
const toolList = document.getElementById("toolList");
const selectedInfo = document.getElementById("selectedInfo");
const countsInfo = document.getElementById("countsInfo");
const jsonOutput = document.getElementById("jsonOutput");
const zReadout = document.getElementById("zReadout");
const importFile = document.getElementById("importFile");

const CUBE_ASSETS = {
  grass: "./assets/terrain_cube_grass.png",
  dirt: "./assets/terrain_cube_dirt.png",
};

const SIZES = [
  { id: "image_1920_1080", label: "Image Area 1920 x 1080", cols: 34, rows: 34 },
  { id: "cramped", label: "Cramped 11 x 8", cols: 11, rows: 8 },
  { id: "small", label: "Small 12 x 9", cols: 12, rows: 9 },
  { id: "standard", label: "Standard 14 x 10", cols: 14, rows: 10 },
  { id: "large", label: "Large 16 x 11", cols: 16, rows: 11 },
];

const TOOLS = [
  { id: "solid-grass", label: "grass solid", kind: "solid", material: "grass", icon: CUBE_ASSETS.grass },
  { id: "solid-dirt", label: "dirt solid", kind: "solid", material: "dirt", icon: CUBE_ASSETS.dirt },
  { id: "hero", label: "hero spawn", kind: "marker", markerType: "hero", swatch: "P" },
  { id: "enemy", label: "enemy spawn", kind: "marker", markerType: "enemy", swatch: "M" },
  { id: "trigger", label: "trigger", kind: "marker", markerType: "trigger", swatch: "T" },
  { id: "placeable", label: "placeable", kind: "marker", markerType: "placeable", swatch: "O" },
  { id: "erase", label: "erase", kind: "erase", swatch: "X" },
];

const TILE_W = 128;
const TILE_H = 64;
const UNIT_Z = 64;
const HALF_CUBE_Z = 0.5;
const CUBE_Z = 1;
const ORIGIN = { x: canvas.width / 2, y: 118 };

const state = {
  size: SIZES[0],
  activeTool: TOOLS[0],
  z: 0,
  hover: null,
  solids: new Map(),
  markers: [],
};

const images = {};

function keyOf(x, y, z) {
  return `${x},${y},${z.toFixed(1)}`;
}

function roundedZ(value) {
  return Math.round(value * 2) / 2;
}

function pointFor(x, y, z = 0) {
  return {
    x: ORIGIN.x + (x - y) * (TILE_W / 2),
    y: ORIGIN.y + (x + y) * (TILE_H / 2) - z * UNIT_Z,
  };
}

function cellFromPoint(px, py) {
  const topHit = topFaceCellFromPoint(px, py);
  if (topHit) return topHit;

  const dx = px - ORIGIN.x;
  const dy = py - ORIGIN.y;
  const x = Math.round(dx / TILE_W + dy / TILE_H);
  const y = Math.round(dy / TILE_H - dx / TILE_W);
  if (x < 0 || y < 0 || x >= state.size.cols || y >= state.size.rows) return null;
  return cellForTool(x, y);
}

function pointInDiamond(px, py, center) {
  return Math.abs(px - center.x) / (TILE_W / 2) + Math.abs(py - center.y) / (TILE_H / 2) <= 1;
}

function topFaceCellFromPoint(px, py) {
  const candidates = [];
  for (let x = 0; x < state.size.cols; x += 1) {
    for (let y = 0; y < state.size.rows; y += 1) {
      const topSolid = topSolidAt(x, y);
      if (!topSolid) continue;
      const center = pointFor(x, y, topSolid.z);
      if (pointInDiamond(px, py, center)) {
        candidates.push({ x, y, z: topSolid.z });
      }
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.z - a.z || (b.x + b.y) - (a.x + a.y));
  return cellForTool(candidates[0].x, candidates[0].y);
}

function columnSolidsAt(x, y) {
  return Array.from(state.solids.values()).filter((solid) => solid.x === x && solid.y === y);
}

function topSolidAt(x, y) {
  return columnSolidsAt(x, y).sort((a, b) => b.z - a.z)[0] || null;
}

function columnTopZ(x, y) {
  const topSolid = topSolidAt(x, y);
  return topSolid ? roundedZ(topSolid.z + CUBE_Z) : 0;
}

function cellForTool(x, y) {
  const tool = state.activeTool;
  if (tool.kind === "solid" || tool.kind === "marker") {
    return { x, y, z: roundedZ(columnTopZ(x, y) + state.z) };
  }

  if (tool.kind === "erase") {
    const topSolid = topSolidAt(x, y);
    return { x, y, z: topSolid ? topSolid.z : roundedZ(state.z) };
  }

  return { x, y, z: roundedZ(state.z) };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function loadAssets() {
  images.grass = await loadImage(CUBE_ASSETS.grass);
  images.dirt = await loadImage(CUBE_ASSETS.dirt);
  render();
}

function drawGrid() {
  ctx.save();
  ctx.strokeStyle = "rgba(80, 102, 110, 0.22)";
  ctx.fillStyle = "rgba(95, 120, 120, 0.28)";
  ctx.lineWidth = 1;

  for (let x = 0; x < state.size.cols; x += 1) {
    for (let y = 0; y < state.size.rows; y += 1) {
      const p = pointFor(x, y, 0);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - TILE_H / 2);
      ctx.lineTo(p.x + TILE_W / 2, p.y);
      ctx.lineTo(p.x, p.y + TILE_H / 2);
      ctx.lineTo(p.x - TILE_W / 2, p.y);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function makeTopFaceTexture(material) {
  const img = images[material];
  if (!img) return null;

  const off = document.createElement("canvas");
  off.width = TILE_W;
  off.height = TILE_H;
  const g = off.getContext("2d");

  g.save();
  g.beginPath();
  g.moveTo(TILE_W / 2, 0);
  g.lineTo(TILE_W, TILE_H / 2);
  g.lineTo(TILE_W / 2, TILE_H);
  g.lineTo(0, TILE_H / 2);
  g.closePath();
  g.clip();

  const sourceW = img.naturalWidth * 0.56;
  const sourceH = img.naturalHeight * 0.32;
  const sourceX = img.naturalWidth * 0.22;
  const sourceY = img.naturalHeight * 0.04;
  g.drawImage(img, sourceX, sourceY, sourceW, sourceH, 0, 0, TILE_W, TILE_H);

  const shade = material === "grass" ? "rgba(189, 188, 84, 0.16)" : "rgba(151, 113, 63, 0.12)";
  g.fillStyle = shade;
  g.fillRect(0, 0, TILE_W, TILE_H);
  g.restore();

  g.strokeStyle = "rgba(238, 231, 166, 0.16)";
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(TILE_W / 2, 0.5);
  g.lineTo(TILE_W - 0.5, TILE_H / 2);
  g.lineTo(TILE_W / 2, TILE_H - 0.5);
  g.lineTo(0.5, TILE_H / 2);
  g.closePath();
  g.stroke();

  return off;
}

const topFaceCache = new Map();

function getTopFaceImage(material) {
  if (!topFaceCache.has(material)) {
    topFaceCache.set(material, makeTopFaceTexture(material));
  }
  return topFaceCache.get(material);
}

function drawTopFace(cell) {
  const p = pointFor(cell.x, cell.y, cell.z);
  const topFace = getTopFaceImage(cell.material);
  if (!topFace) return;
  ctx.drawImage(topFace, p.x - TILE_W / 2, p.y - TILE_H / 2, TILE_W, TILE_H);
}

function hasTopAt(x, y, z) {
  const key = keyOf(x, y, z);
  return state.solids.has(key);
}

function hasSolidAbove(cell) {
  return Array.from(state.solids.values()).some((solid) => {
    return solid.x === cell.x && solid.y === cell.y && solid.z > cell.z && solid.z <= cell.z + CUBE_Z;
  });
}

function drawTexturedFace(points, material, side) {
  const img = images[material];
  if (!img) return;

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  const width = maxX - minX;
  const height = maxY - minY;

  const crop = side === "left"
    ? { x: img.naturalWidth * 0.08, y: img.naturalHeight * 0.36, w: img.naturalWidth * 0.48, h: img.naturalHeight * 0.5 }
    : { x: img.naturalWidth * 0.44, y: img.naturalHeight * 0.36, w: img.naturalWidth * 0.48, h: img.naturalHeight * 0.5 };

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h, minX, minY, width, height);
  ctx.fillStyle = side === "left" ? "rgba(0, 0, 0, 0.18)" : "rgba(0, 0, 0, 0.34)";
  ctx.fillRect(minX, minY, width, height);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "rgba(0, 0, 0, 0.22)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawSolidFaces(cell) {
  const p = pointFor(cell.x, cell.y, cell.z);
  const depth = UNIT_Z;
  const leftFace = [
    { x: p.x - TILE_W / 2, y: p.y },
    { x: p.x, y: p.y + TILE_H / 2 },
    { x: p.x, y: p.y + TILE_H / 2 + depth },
    { x: p.x - TILE_W / 2, y: p.y + depth },
  ];
  const rightFace = [
    { x: p.x + TILE_W / 2, y: p.y },
    { x: p.x, y: p.y + TILE_H / 2 },
    { x: p.x, y: p.y + TILE_H / 2 + depth },
    { x: p.x + TILE_W / 2, y: p.y + depth },
  ];

  if (!hasTopAt(cell.x, cell.y + 1, cell.z)) drawTexturedFace(leftFace, cell.material, "left");
  if (!hasTopAt(cell.x + 1, cell.y, cell.z)) drawTexturedFace(rightFace, cell.material, "right");
}

function drawSolidTop(cell) {
  if (hasSolidAbove(cell)) return;
  drawTopFace(cell);
}

function markerColor(type) {
  if (type === "hero") return "#6fa9df";
  if (type === "enemy") return "#cf766f";
  if (type === "trigger") return "#d3c36c";
  return "#88aa62";
}

function markerLabel(type) {
  if (type === "hero") return "P";
  if (type === "enemy") return "M";
  if (type === "trigger") return "T";
  return "O";
}

function drawMarker(marker) {
  const p = pointFor(marker.x, marker.y, marker.z);
  ctx.save();
  ctx.translate(p.x, p.y - TILE_H * 0.45);
  ctx.fillStyle = markerColor(marker.type);
  ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(-14, -22, 28, 28, 5);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#07100f";
  ctx.font = "900 17px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(markerLabel(marker.type), 0, -8);
  ctx.restore();
}

function drawHover() {
  if (!state.hover) return;
  const p = pointFor(state.hover.x, state.hover.y, state.hover.z);
  ctx.save();
  ctx.strokeStyle = "#d3c36c";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - TILE_H / 2);
  ctx.lineTo(p.x + TILE_W / 2, p.y);
  ctx.lineTo(p.x, p.y + TILE_H / 2);
  ctx.lineTo(p.x - TILE_W / 2, p.y);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function sortedTerrain() {
  const entries = [
    ...Array.from(state.solids.values()).map((cell) => ({ ...cell, drawKind: "solid" })),
  ];
  return entries.sort((a, b) => {
    const da = a.x + a.y + a.z * 2 + (a.drawKind === "solid" ? 0.1 : 0);
    const db = b.x + b.y + b.z * 2 + (b.drawKind === "solid" ? 0.1 : 0);
    return da - db || a.y - b.y || a.x - b.x;
  });
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#050a0a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  const terrain = sortedTerrain();
  for (const cell of terrain) {
    if (cell.drawKind === "solid") drawSolidFaces(cell);
  }

  for (const cell of terrain) {
    if (cell.drawKind === "solid") drawSolidTop(cell);
  }

  const markers = [...state.markers].sort((a, b) => (a.x + a.y + a.z * 2) - (b.x + b.y + b.z * 2));
  for (const marker of markers) drawMarker(marker);

  drawHover();
  updateUi();
}

function areaJson() {
  return {
    id: mapIdInput.value.trim() || "untitled_area",
    name: mapNameInput.value.trim() || "Untitled Area",
    mode: modeSelect.value,
    size: state.size.id,
    grid: {
      cols: state.size.cols,
      rows: state.size.rows,
      projection: "isometric",
      tileWidth: TILE_W,
      tileHeight: TILE_H,
      zUnit: 0.5,
      cubeHeight: 1,
    },
    solids: Array.from(state.solids.values()).sort(sortCells),
    spawns: state.markers.filter((m) => m.type === "hero" || m.type === "enemy").sort(sortCells),
    triggers: state.markers.filter((m) => m.type === "trigger").sort(sortCells),
    placeables: state.markers.filter((m) => m.type === "placeable").sort(sortCells),
  };
}

function sortCells(a, b) {
  return a.z - b.z || a.y - b.y || a.x - b.x;
}

function updateUi() {
  zReadout.textContent = `offset ${state.z >= 0 ? "+" : ""}${state.z.toFixed(1)}`;
  const hoverText = state.hover ? ` placing at z ${state.hover.z.toFixed(1)}` : "";
  selectedInfo.textContent = `${state.activeTool.label}${hoverText}`;
  countsInfo.textContent = `${state.size.cols} x ${state.size.rows}. ${state.solids.size} solids. ${state.markers.length} markers.`;
  jsonOutput.value = JSON.stringify(areaJson(), null, 2);

  for (const button of toolList.querySelectorAll("button")) {
    button.classList.toggle("active", button.dataset.toolId === state.activeTool.id);
  }
}

function setZ(value) {
  state.z = Math.max(-6, Math.min(12, roundedZ(value)));
  render();
}

function placeAt(cell) {
  const tool = state.activeTool;
  const key = keyOf(cell.x, cell.y, cell.z);

  if (tool.kind === "solid") {
    state.solids.set(key, { x: cell.x, y: cell.y, z: cell.z, material: tool.material });
  } else if (tool.kind === "marker") {
    state.markers = state.markers.filter((marker) => !(marker.x === cell.x && marker.y === cell.y && marker.z === cell.z && marker.type === tool.markerType));
    state.markers.push({ type: tool.markerType, x: cell.x, y: cell.y, z: cell.z });
  } else if (tool.kind === "erase") {
    state.solids.delete(key);
    state.markers = state.markers.filter((marker) => !(marker.x === cell.x && marker.y === cell.y && marker.z === cell.z));
  }

  state.hover = cellForTool(cell.x, cell.y);
  render();
}

function clearArea() {
  state.solids.clear();
  state.markers = [];
  render();
}

function rebuildTools() {
  toolList.replaceChildren();
  for (const tool of TOOLS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tool-button";
    button.dataset.toolId = tool.id;

    if (tool.icon) {
      const img = document.createElement("img");
      img.src = tool.icon;
      img.alt = "";
      button.append(img);
    } else {
      const swatch = document.createElement("span");
      swatch.className = `swatch ${tool.markerType || tool.kind}`;
      swatch.textContent = tool.swatch;
      button.append(swatch);
    }

    const label = document.createElement("span");
    label.textContent = tool.label;
    button.append(label);
    button.addEventListener("click", () => {
      state.activeTool = tool;
      updateUi();
    });
    toolList.append(button);
  }
}

function rebuildSizes() {
  sizeSelect.replaceChildren();
  for (const size of SIZES) {
    const option = document.createElement("option");
    option.value = size.id;
    option.textContent = size.label;
    sizeSelect.append(option);
  }
  sizeSelect.value = state.size.id;
}

function importArea(data) {
  const size = SIZES.find((entry) => entry.id === data.size) || SIZES.find((entry) => entry.cols === data.grid?.cols && entry.rows === data.grid?.rows) || SIZES[0];
  state.size = size;
  sizeSelect.value = size.id;
  mapNameInput.value = data.name || "Untitled Area";
  mapIdInput.value = data.id || "untitled_area";
  modeSelect.value = data.mode || "combat";
  clearArea();

  for (const cell of data.solids || []) {
    state.solids.set(keyOf(cell.x, cell.y, Number(cell.z || 0)), {
      x: Number(cell.x),
      y: Number(cell.y),
      z: roundedZ(Number(cell.z || 0)),
      material: cell.material === "grass" ? "grass" : "dirt",
    });
  }

  state.markers = [
    ...(data.spawns || []),
    ...(data.triggers || []),
    ...(data.placeables || []),
  ].map((marker) => ({
    type: marker.type || "trigger",
    x: Number(marker.x),
    y: Number(marker.y),
    z: roundedZ(Number(marker.z || 0)),
  }));

  render();
}

function downloadJson() {
  const blob = new Blob([JSON.stringify(areaJson(), null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${areaJson().id}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

canvas.addEventListener("mousemove", (event) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  state.hover = cellFromPoint((event.clientX - rect.left) * scaleX, (event.clientY - rect.top) * scaleY);
  render();
});

canvas.addEventListener("mouseleave", () => {
  state.hover = null;
  render();
});

canvas.addEventListener("click", () => {
  if (state.hover) placeAt(state.hover);
});

document.getElementById("zDownButton").addEventListener("click", () => setZ(state.z - HALF_CUBE_Z));
document.getElementById("zUpButton").addEventListener("click", () => setZ(state.z + HALF_CUBE_Z));
document.getElementById("clearButton").addEventListener("click", clearArea);
document.getElementById("exportButton").addEventListener("click", downloadJson);
document.getElementById("importButton").addEventListener("click", () => importFile.click());

sizeSelect.addEventListener("change", () => {
  state.size = SIZES.find((entry) => entry.id === sizeSelect.value) || SIZES[0];
  render();
});

for (const input of [mapNameInput, mapIdInput, modeSelect]) {
  input.addEventListener("input", updateUi);
  input.addEventListener("change", updateUi);
}

importFile.addEventListener("change", async () => {
  const file = importFile.files?.[0];
  if (!file) return;
  importArea(JSON.parse(await file.text()));
  importFile.value = "";
});

window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowUp") {
    event.preventDefault();
    setZ(state.z + HALF_CUBE_Z);
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    setZ(state.z - HALF_CUBE_Z);
  } else if (event.key === "Escape") {
    state.hover = null;
    render();
  }
});

rebuildSizes();
rebuildTools();
loadAssets();
render();
