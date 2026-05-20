const IMAGE_W = 1920;
const IMAGE_H = 1080;
const DEFAULT_SCALE = {
  combat: 1,
  exploration: 1,
  grand_exploration: 0.66,
};
const TRIGGERS = new Set(["none", "conversation", "area_transition", "combat"]);

const startPanel = document.getElementById("start-panel");
const toolPanel = document.getElementById("tool-panel");
const chooseImageButton = document.getElementById("choose-image-button");
const imageInput = document.getElementById("image-input");
const startStatus = document.getElementById("start-status");
const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d");
const areaNameInput = document.getElementById("area-name");
const areaIdInput = document.getElementById("area-id");
const areaKindSelect = document.getElementById("area-kind");
const backgroundPathInput = document.getElementById("background-path");
const toolNodeButton = document.getElementById("tool-node");
const toolConnectButton = document.getElementById("tool-connect");
const toolInflectButton = document.getElementById("tool-inflect");
const toolSpawnButton = document.getElementById("tool-spawn");
const nodeEditor = document.getElementById("node-editor");
const nodeLabelInput = document.getElementById("node-label");
const nodeTriggerSelect = document.getElementById("node-trigger");
const nodeScaleInput = document.getElementById("node-scale");
const nodeDiscoverySelect = document.getElementById("node-discovery");
const nodeShowLabelInput = document.getElementById("node-show-label");
const nodeDescriptionInput = document.getElementById("node-description");
const markEntryButton = document.getElementById("mark-entry");
const resetNavButton = document.getElementById("reset-nav");
const exportAreaButton = document.getElementById("export-area");
const saveAreaButton = document.getElementById("save-area");
const statusEl = document.getElementById("status");
const validationList = document.getElementById("validation-list");

const state = {
  backgroundImage: null,
  backgroundPath: "",
  tool: "node",
  selectedNodeId: "",
  selectedEdgeKey: "",
  selectedPointIndex: null,
  pendingConnectionNodeId: "",
  dragging: null,
  preview: null,
  data: emptyAreaData(),
};

chooseImageButton.addEventListener("click", () => imageInput.click());
imageInput.addEventListener("change", () => {
  const file = imageInput.files?.[0];
  if (file) importImage(file);
});

areaNameInput.addEventListener("input", () => {
  state.data.area.name = areaNameInput.value.trim() || "Untitled area";
  state.data.area.id = toSafeId(state.data.area.name);
  areaIdInput.value = state.data.area.id;
  draw();
});
areaKindSelect.addEventListener("change", () => {
  state.data.area.kind = areaKindSelect.value;
  state.data.area.defaults.playerScale = DEFAULT_SCALE[state.data.area.kind] ?? 1;
});

toolNodeButton.addEventListener("click", () => setTool("node"));
toolConnectButton.addEventListener("click", () => setTool("connect"));
toolInflectButton.addEventListener("click", () => setTool("inflect"));
toolSpawnButton.addEventListener("click", () => setTool("spawn"));
markEntryButton.addEventListener("click", markSelectedEntry);
resetNavButton.addEventListener("click", resetNav);
exportAreaButton.addEventListener("click", downloadExport);
saveAreaButton.addEventListener("click", saveExport);

nodeLabelInput.addEventListener("input", updateSelectedNode);
nodeTriggerSelect.addEventListener("change", updateSelectedNode);
nodeScaleInput.addEventListener("change", updateSelectedNode);
nodeDiscoverySelect.addEventListener("change", updateSelectedNode);
nodeShowLabelInput.addEventListener("change", updateSelectedNode);
nodeDescriptionInput.addEventListener("input", updateSelectedNode);

canvas.addEventListener("pointerdown", onPointerDown);
canvas.addEventListener("pointermove", onPointerMove);
window.addEventListener("pointerup", () => {
  state.dragging = null;
});
window.addEventListener("keydown", onKeyDown);

syncMetadataControls();
setStatus("Choose a 1920x1080 image to begin.");

function emptyAreaData() {
  return {
    schemaVersion: 1,
    area: {
      id: "untitled_area",
      name: "Untitled area",
      kind: "exploration",
      background: "",
      image: { width: IMAGE_W, height: IMAGE_H },
      defaults: { playerScale: DEFAULT_SCALE.exploration },
      extensions: {},
    },
    entryNodeId: "",
    nodes: [],
    edges: [],
    combatSpawns: [],
    extensions: {},
  };
}

async function importImage(file) {
  setStartStatus("Checking image...");
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    if (image.naturalWidth !== IMAGE_W || image.naturalHeight !== IMAGE_H) {
      setStartStatus(`${file.name} is ${image.naturalWidth}x${image.naturalHeight}. Area backgrounds must be 1920x1080.`);
      return;
    }

    setStartStatus("Importing image...");
    const response = await fetch(`/api/area-author/import-image?name=${encodeURIComponent(file.name)}`, {
      method: "POST",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: await file.arrayBuffer(),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);

    state.backgroundImage = image;
    state.backgroundPath = payload.path;
    state.data.area.background = payload.path;
    backgroundPathInput.value = payload.path;
    startPanel.hidden = true;
    toolPanel.hidden = false;
    resizeCanvasDisplay();
    draw();
    setStatus("Image imported. Place nodes with V, connect with C, shape paths with B.");
  } catch (err) {
    setStartStatus(`Import failed: ${err.message}`);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not read image."));
    image.src = src;
  });
}

function onPointerDown(event) {
  if (!state.backgroundImage) return;
  const point = eventPoint(event);
  if (!insideImage(point)) return;

  if (state.tool === "connect") {
    handleConnectPointer(point);
    return;
  }

  if (state.tool === "inflect") {
    handleInflectPointer(point);
    return;
  }

  if (state.tool === "spawn") {
    createCombatSpawn(point.x, point.y);
    draw();
    return;
  }

  const hitNode = nearestNode(point.x, point.y, 22);
  if (hitNode) {
    selectNode(hitNode.id);
    state.dragging = { type: "node", nodeId: hitNode.id };
    return;
  }

  const node = createNode(point.x, point.y);
  selectNode(node.id);
  state.dragging = { type: "node", nodeId: node.id };
  setStatus(`${node.label} added.`);
}

function onPointerMove(event) {
  if (!state.backgroundImage) return;
  const point = eventPoint(event);
  const clamped = clampPoint(point);

  if (state.dragging?.type === "node") {
    const node = state.data.nodes.find((item) => item.id === state.dragging.nodeId);
    if (!node) return;
    node.x = clamped.x;
    node.y = clamped.y;
    for (const edge of state.data.edges) {
      if (edge.from === node.id) edge.points[0] = [clamped.x, clamped.y];
      if (edge.to === node.id) edge.points[edge.points.length - 1] = [clamped.x, clamped.y];
    }
    draw();
    return;
  }

  if (state.dragging?.type === "point") {
    const edge = edgeByKey(state.dragging.edgeKey);
    if (!edge) return;
    edge.points[state.dragging.pointIndex] = [clamped.x, clamped.y];
    state.preview = null;
    draw();
    return;
  }

  if (state.tool === "inflect") {
    const hit = nearestEdge(point.x, point.y, 44);
    state.preview = hit ? { ...hit, x: clamped.x, y: clamped.y } : null;
    draw();
  }
}

function handleConnectPointer(point) {
  const node = nearestNode(point.x, point.y, 24);
  if (!node) {
    setStatus("Connect: click a node, then another node.");
    return;
  }
  if (!state.pendingConnectionNodeId) {
    state.pendingConnectionNodeId = node.id;
    selectNode(node.id);
    setStatus(`${node.label} selected. Click destination node.`);
    return;
  }
  if (state.pendingConnectionNodeId === node.id) {
    setStatus("Choose a different destination node.");
    return;
  }
  connectNodes(state.pendingConnectionNodeId, node.id);
  state.selectedEdgeKey = edgeKey(state.pendingConnectionNodeId, node.id);
  state.selectedNodeId = "";
  state.pendingConnectionNodeId = "";
  setTool("inflect");
  state.preview = midpointPreview(state.selectedEdgeKey);
  draw();
  setStatus("Route connected. Click to place a bend, or Escape to stop shaping.");
}

function handleInflectPointer(point) {
  const hitPoint = nearestSelectedPoint(point.x, point.y, 12);
  if (hitPoint) {
    state.selectedEdgeKey = hitPoint.edgeKey;
    state.selectedPointIndex = hitPoint.pointIndex;
    state.selectedNodeId = "";
    state.dragging = { type: "point", edgeKey: hitPoint.edgeKey, pointIndex: hitPoint.pointIndex };
    draw();
    return;
  }

  const hit = state.preview ?? nearestEdge(point.x, point.y, 44);
  if (!hit) {
    setStatus("Inflect: hover over a route, then click to add a bend.");
    return;
  }
  const edge = edgeByKey(hit.edgeKey);
  if (!edge) return;
  const insertAt = Math.max(1, hit.segmentIndex + 1);
  edge.points.splice(insertAt, 0, [Math.round(point.x), Math.round(point.y)]);
  state.selectedEdgeKey = hit.edgeKey;
  state.selectedPointIndex = insertAt;
  state.selectedNodeId = "";
  state.preview = null;
  state.dragging = { type: "point", edgeKey: hit.edgeKey, pointIndex: insertAt };
  draw();
  setStatus("Bend added. Keep adding bends, or Escape to return to Node.");
}

function createNode(x, y) {
  const index = state.data.nodes.length + 1;
  const id = nextNodeId(index);
  const scale = Number(state.data.area.defaults.playerScale) || 1;
  const node = {
    id,
    label: `Node ${index}`,
    description: "",
    discovery: { state: "undiscovered", showLabelWhenDiscovered: true },
    x: Math.round(x),
    y: Math.round(y),
    scale,
    trigger: { type: "none", payload: {} },
    extensions: {},
  };
  state.data.nodes.push(node);
  if (!state.data.entryNodeId) state.data.entryNodeId = id;
  return node;
}

function createCombatSpawn(x, y) {
  const index = state.data.combatSpawns.length + 1;
  state.data.combatSpawns.push({
    id: `combat_spawn_${index}`,
    label: `Combat spawn ${index}`,
    x: Math.round(x),
    y: Math.round(y),
    extensions: {},
  });
  setStatus(`Combat spawn ${index} added.`);
}

function nextNodeId(index) {
  let id = `node_${index}`;
  let suffix = 2;
  while (state.data.nodes.some((node) => node.id === id)) id = `node_${index}_${suffix++}`;
  return id;
}

function connectNodes(fromId, toId) {
  if (edgeByKey(edgeKey(fromId, toId))) return;
  const from = nodeById(fromId);
  const to = nodeById(toId);
  if (!from || !to) return;
  state.data.edges.push({
    id: toSafeId(`${fromId}_${toId}`),
    from: fromId,
    to: toId,
    points: [[from.x, from.y], [to.x, to.y]],
    extensions: {},
  });
}

function selectNode(id) {
  state.selectedNodeId = id;
  state.selectedEdgeKey = "";
  state.selectedPointIndex = null;
  syncNodeEditor();
  draw();
}

function syncNodeEditor() {
  const node = nodeById(state.selectedNodeId);
  nodeEditor.hidden = !node;
  if (!node) return;
  nodeLabelInput.value = node.label;
  nodeTriggerSelect.value = TRIGGERS.has(node.trigger?.type) ? node.trigger.type : "none";
  nodeScaleInput.value = String(node.scale);
  nodeDiscoverySelect.value = node.discovery?.state === "discovered" ? "discovered" : "undiscovered";
  nodeShowLabelInput.checked = node.discovery?.showLabelWhenDiscovered !== false;
  nodeDescriptionInput.value = node.description || "";
}

function updateSelectedNode() {
  const node = nodeById(state.selectedNodeId);
  if (!node) return;
  node.label = nodeLabelInput.value.trim() || node.id;
  const trigger = TRIGGERS.has(nodeTriggerSelect.value) ? nodeTriggerSelect.value : "none";
  node.trigger = {
    type: trigger,
    payload: node.trigger?.payload && typeof node.trigger.payload === "object" ? node.trigger.payload : {},
  };
  const scale = Number(nodeScaleInput.value);
  if (Number.isFinite(scale)) node.scale = Math.max(0.25, Math.min(1.5, scale));
  node.discovery = {
    state: nodeDiscoverySelect.value === "discovered" ? "discovered" : "undiscovered",
    showLabelWhenDiscovered: nodeShowLabelInput.checked,
  };
  node.description = nodeDescriptionInput.value;
  draw();
}

function markSelectedEntry() {
  const node = nodeById(state.selectedNodeId);
  if (!node) return;
  state.data.entryNodeId = node.id;
  draw();
  setStatus(`${node.label} marked entry.`);
}

function resetNav() {
  state.data.entryNodeId = "";
  state.data.nodes = [];
  state.data.edges = [];
  state.selectedNodeId = "";
  state.selectedEdgeKey = "";
  state.selectedPointIndex = null;
  state.pendingConnectionNodeId = "";
  state.preview = null;
  syncNodeEditor();
  draw();
  setStatus("Traversal reset.");
}

function buildExport() {
  syncAreaData();
  return JSON.parse(JSON.stringify(state.data));
}

function syncAreaData() {
  state.data.area.name = areaNameInput.value.trim() || "Untitled area";
  state.data.area.id = toSafeId(state.data.area.name);
  state.data.area.kind = areaKindSelect.value;
  state.data.area.background = state.backgroundPath;
  state.data.area.image = { width: IMAGE_W, height: IMAGE_H };
  state.data.area.defaults = {
    playerScale: Number(state.data.area.defaults?.playerScale) || DEFAULT_SCALE[state.data.area.kind] || 1,
  };
  areaIdInput.value = state.data.area.id;
}

function validateExport(data) {
  const errors = [];
  if (!data.area.background) errors.push("Import a 1920x1080 background image.");
  if (data.area.image.width !== IMAGE_W || data.area.image.height !== IMAGE_H) errors.push("Image metadata must be 1920x1080.");
  if (!data.entryNodeId || !data.nodes.some((node) => node.id === data.entryNodeId)) errors.push("Mark one node as entry.");
  for (const edge of data.edges) {
    if (!data.nodes.some((node) => node.id === edge.from) || !data.nodes.some((node) => node.id === edge.to)) {
      errors.push(`Path ${edge.id} must connect two real nodes.`);
    }
  }
  for (const node of data.nodes) {
    if (node.trigger.type === "combat" && data.combatSpawns.length === 0) {
      errors.push(`${node.label} starts combat, but no combat spawn exists yet.`);
      break;
    }
  }
  return errors;
}

function showValidation(errors) {
  validationList.textContent = "";
  for (const error of errors) {
    const item = document.createElement("li");
    item.textContent = error;
    validationList.appendChild(item);
  }
}

function downloadExport() {
  const data = buildExport();
  const errors = validateExport(data);
  showValidation(errors);
  if (errors.length) {
    setStatus("Export blocked. Fix validation items.");
    return;
  }
  const fileName = `area.${data.area.id}.json`;
  const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setStatus(`${fileName} exported.`);
}

async function saveExport() {
  const data = buildExport();
  const errors = validateExport(data);
  showValidation(errors);
  if (errors.length) {
    setStatus("Save blocked. Fix validation items.");
    return;
  }
  try {
    const response = await fetch("/api/area-author/export-area", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
    setStatus(`Saved to ${payload.path}.`);
  } catch (err) {
    setStatus(`Save failed: ${err.message}`);
  }
}

function draw() {
  ctx.clearRect(0, 0, IMAGE_W, IMAGE_H);
  if (state.backgroundImage) ctx.drawImage(state.backgroundImage, 0, 0, IMAGE_W, IMAGE_H);
  else {
    ctx.fillStyle = "#050606";
    ctx.fillRect(0, 0, IMAGE_W, IMAGE_H);
  }

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const edge of state.data.edges) drawEdge(edge, edgeKey(edge.from, edge.to) === state.selectedEdgeKey);
  if (state.preview) drawPreview();
  for (const spawn of state.data.combatSpawns) drawCombatSpawn(spawn);
  for (const node of state.data.nodes) drawNode(node);
}

function drawEdge(edge, selected) {
  const points = sampledCurve(edge.points);
  drawPath(points);
  ctx.strokeStyle = selected ? "rgba(255, 230, 170, 0.96)" : "rgba(145, 202, 190, 0.78)";
  ctx.lineWidth = selected ? 7 : 5;
  ctx.stroke();

  if (selected) {
    for (let i = 1; i < edge.points.length - 1; i++) {
      drawDiamond(edge.points[i][0], edge.points[i][1], state.selectedPointIndex === i ? 12 : 9, "#7bd8ff");
    }
  }
}

function drawPreview() {
  const edge = edgeByKey(state.preview.edgeKey);
  if (!edge) return;
  const points = edge.points.map((point) => [...point]);
  points.splice(Math.max(1, state.preview.segmentIndex + 1), 0, [state.preview.x, state.preview.y]);
  drawPath(sampledCurve(points));
  ctx.strokeStyle = "rgba(123, 216, 255, 0.72)";
  ctx.lineWidth = 5;
  ctx.stroke();
  drawDiamond(state.preview.x, state.preview.y, 10, "#7bd8ff");
}

function drawNode(node) {
  const selected = node.id === state.selectedNodeId;
  const entry = node.id === state.data.entryNodeId;
  const pending = node.id === state.pendingConnectionNodeId;
  const color = selected ? "#ffc96f" : pending ? "#f7e3a0" : entry ? "#aedb8e" : triggerColor(node.trigger?.type);
  ctx.beginPath();
  ctx.arc(node.x, node.y, selected ? 16 : 12, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0, 0, 0, 0.62)";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(node.x, node.y, selected ? 11 : 8, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = selected || entry ? 4 : 2;
  ctx.strokeStyle = selected ? "#fff0c2" : entry ? "#e6f1c4" : "#07100d";
  ctx.stroke();
  drawLabel(node);
}

function drawCombatSpawn(spawn) {
  ctx.save();
  ctx.translate(spawn.x, spawn.y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = "rgba(214, 144, 72, 0.9)";
  ctx.strokeStyle = "rgba(0, 0, 0, 0.78)";
  ctx.lineWidth = 3;
  ctx.fillRect(-9, -9, 18, 18);
  ctx.strokeRect(-9, -9, 18, 18);
  ctx.restore();
  ctx.font = "700 14px ui-monospace, Menlo, Consolas, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.lineWidth = 5;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.82)";
  ctx.fillStyle = "#f0c08a";
  ctx.strokeText(spawn.label, spawn.x, spawn.y + 18);
  ctx.fillText(spawn.label, spawn.x, spawn.y + 18);
}

function drawLabel(node) {
  ctx.font = "700 18px ui-monospace, Menlo, Consolas, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.lineWidth = 6;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.82)";
  ctx.fillStyle = "#f1efe3";
  ctx.strokeText(node.label, node.x, node.y - 20);
  ctx.fillText(node.label, node.x, node.y - 20);
}

function drawPath(points) {
  if (!points.length) return;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
}

function drawDiamond(x, y, radius, color) {
  ctx.beginPath();
  ctx.moveTo(x, y - radius);
  ctx.lineTo(x + radius, y);
  ctx.lineTo(x, y + radius);
  ctx.lineTo(x - radius, y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(0,0,0,0.78)";
  ctx.stroke();
}

function triggerColor(trigger) {
  if (trigger === "area_transition") return "#d18f84";
  if (trigger === "conversation") return "#9bc8d2";
  if (trigger === "combat") return "#d69048";
  return "#c5d994";
}

function sampledCurve(points, samples = 16) {
  if (points.length <= 2) return points.map((point) => [...point]);
  const result = [];
  for (let i = 0; i < points.length - 1; i++) {
    for (let step = 0; step < samples; step++) result.push(catmullRom(points, i, step / samples));
  }
  result.push([...points[points.length - 1]]);
  return result;
}

function catmullRom(points, index, t) {
  const p0 = points[Math.max(0, index - 1)];
  const p1 = points[index];
  const p2 = points[Math.min(points.length - 1, index + 1)];
  const p3 = points[Math.min(points.length - 1, index + 2)];
  const t2 = t * t;
  const t3 = t2 * t;
  return [
    0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
    0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
  ];
}

function nearestNode(x, y, maxDistance = Infinity) {
  return state.data.nodes
    .map((node) => ({ ...node, distance: Math.hypot(node.x - x, node.y - y) }))
    .filter((node) => node.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance)[0] ?? null;
}

function nearestEdge(x, y, maxDistance) {
  let best = null;
  for (const edge of state.data.edges) {
    const points = sampledCurve(edge.points, 8);
    for (let i = 1; i < points.length; i++) {
      const point = nearestPointOnSegment(x, y, points[i - 1], points[i]);
      const distance = Math.hypot(x - point.x, y - point.y);
      if (distance <= maxDistance && (!best || distance < best.distance)) {
        best = {
          edgeKey: edgeKey(edge.from, edge.to),
          segmentIndex: approximateSegment(edge.points, point.x, point.y),
          distance,
        };
      }
    }
  }
  return best;
}

function nearestSelectedPoint(x, y, maxDistance) {
  const edge = edgeByKey(state.selectedEdgeKey);
  if (!edge) return null;
  return edge.points
    .map((point, pointIndex) => ({ edgeKey: state.selectedEdgeKey, pointIndex, distance: Math.hypot(point[0] - x, point[1] - y) }))
    .filter((hit) => hit.pointIndex > 0 && hit.pointIndex < edge.points.length - 1 && hit.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance)[0] ?? null;
}

function nearestPointOnSegment(x, y, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / lengthSq)) : 0;
  return { x: a[0] + dx * t, y: a[1] + dy * t };
}

function approximateSegment(points, x, y) {
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 1; i < points.length; i++) {
    const point = nearestPointOnSegment(x, y, points[i - 1], points[i]);
    const distance = Math.hypot(x - point.x, y - point.y);
    if (distance < bestDistance) {
      best = i - 1;
      bestDistance = distance;
    }
  }
  return best;
}

function midpointPreview(key) {
  const edge = edgeByKey(key);
  if (!edge) return null;
  const points = sampledCurve(edge.points);
  const point = points[Math.floor(points.length / 2)];
  return { edgeKey: key, segmentIndex: approximateSegment(edge.points, point[0], point[1]), x: point[0], y: point[1] };
}

function nodeById(id) {
  return state.data.nodes.find((node) => node.id === id) ?? null;
}

function edgeByKey(key) {
  return state.data.edges.find((edge) => edgeKey(edge.from, edge.to) === key) ?? null;
}

function edgeKey(a, b) {
  return [a, b].sort().join(":");
}

function eventPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.round((event.clientX - rect.left) * (IMAGE_W / rect.width)),
    y: Math.round((event.clientY - rect.top) * (IMAGE_H / rect.height)),
  };
}

function insideImage(point) {
  return point.x >= 0 && point.y >= 0 && point.x <= IMAGE_W && point.y <= IMAGE_H;
}

function clampPoint(point) {
  return {
    x: Math.max(0, Math.min(IMAGE_W, Math.round(point.x))),
    y: Math.max(0, Math.min(IMAGE_H, Math.round(point.y))),
  };
}

function setTool(tool) {
  state.tool = ["connect", "inflect", "spawn"].includes(tool) ? tool : "node";
  if (state.tool !== "connect") state.pendingConnectionNodeId = "";
  if (state.tool !== "inflect") {
    state.preview = null;
    state.selectedPointIndex = null;
  }
  toolNodeButton.setAttribute("aria-pressed", state.tool === "node" ? "true" : "false");
  toolConnectButton.setAttribute("aria-pressed", state.tool === "connect" ? "true" : "false");
  toolInflectButton.setAttribute("aria-pressed", state.tool === "inflect" ? "true" : "false");
  toolSpawnButton.setAttribute("aria-pressed", state.tool === "spawn" ? "true" : "false");
  draw();
}

function onKeyDown(event) {
  if (isTypingTarget(event.target)) return;
  const key = event.key.toLowerCase();
  if (key === "v") setTool("node");
  else if (key === "c") setTool("connect");
  else if (key === "b") setTool("inflect");
  else if (key === "p") setTool("spawn");
  else if (key === "escape") setTool("node");
  else if (key === "backspace") deleteSelected();
}

function deleteSelected() {
  if (state.selectedPointIndex !== null && state.selectedEdgeKey) {
    const edge = edgeByKey(state.selectedEdgeKey);
    if (edge && state.selectedPointIndex > 0 && state.selectedPointIndex < edge.points.length - 1) {
      edge.points.splice(state.selectedPointIndex, 1);
      state.selectedPointIndex = null;
      draw();
    }
    return;
  }
  if (state.selectedNodeId && state.selectedNodeId !== state.data.entryNodeId) {
    const id = state.selectedNodeId;
    state.data.nodes = state.data.nodes.filter((node) => node.id !== id);
    state.data.edges = state.data.edges.filter((edge) => edge.from !== id && edge.to !== id);
    state.selectedNodeId = "";
    syncNodeEditor();
    draw();
  }
}

function syncMetadataControls() {
  areaNameInput.value = state.data.area.name;
  areaIdInput.value = state.data.area.id;
  areaKindSelect.value = state.data.area.kind;
  backgroundPathInput.value = state.data.area.background;
}

function resizeCanvasDisplay() {
  canvas.width = IMAGE_W;
  canvas.height = IMAGE_H;
}

function toSafeId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "area";
}

function setStartStatus(message) {
  startStatus.textContent = message;
}

function setStatus(message) {
  statusEl.textContent = message;
}

function isTypingTarget(target) {
  const tag = target?.tagName?.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable;
}
