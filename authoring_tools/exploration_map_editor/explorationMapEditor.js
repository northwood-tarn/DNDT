import * as PIXI from "/app/lib/pixi.mjs";
import { easeInOutSine, TweenSet } from "./animation.js";

const CELL = 96;
const STANDARD_IMAGE_W = 1920;
const STANDARD_IMAGE_H = 1080;
const WORLD_W = STANDARD_IMAGE_W;
const WORLD_H = STANDARD_IMAGE_H;
const COLS = Math.ceil(WORLD_W / CELL);
const ROWS = Math.ceil(WORLD_H / CELL);

const OCCLUSION_SAVE_URL = "/api/visual-spike/occlusion";
const WATER_SAVE_URL = "/api/visual-spike/water";
const NAVIGATION_SAVE_URL = "/api/visual-spike/navigation";
const MAP_KIND_DEFAULT_SCALE = {
  combat: 1,
  exploration: 1,
  grand_exploration: 0.66,
};
const AREA_KEYS = {
  SHRINE: "shrine",
  DOCK: "dock",
  RITUAL_ROAD: "ritual-road",
  ESCARPMENT: "escarpment",
};
const BACKGROUND_IMAGES = {
  [AREA_KEYS.SHRINE]: "./assets/dockside_stage_uncluttered_v2_1920x1080.png",
  [AREA_KEYS.DOCK]: "./assets/dock_transition_dock_1920x1080.png",
  [AREA_KEYS.RITUAL_ROAD]: "./assets/ritual_road_ink_negative_space_1920x1080.png",
  [AREA_KEYS.ESCARPMENT]: "./assets/escarpment_cliff_negative_ink_v2_1920x1080.png",
};
const AREA_DATA_FILES = {
  [AREA_KEYS.SHRINE]: {
    water: "./waterData.json",
  },
  [AREA_KEYS.DOCK]: {
    water: "./waterData.dock.json",
  },
  [AREA_KEYS.RITUAL_ROAD]: {
    occlusion: "./occlusionData.ritual-road.json",
    water: "./waterData.ritual-road.json",
    navigation: "./navigationData.ritual-road.json",
  },
};
const CELL_FLAGS = {
  BLOCKED: "blocked",
  SPAWN_ENEMY: "spawn_enemy",
  ENTRY: "entry",
  EXIT: "exit",
};

const CELL_DATA = Array.from({ length: ROWS }, () =>
  Array.from({ length: COLS }, () => ({ flags: [] }))
);
const MOVEMENT_KEYS = new Set(["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"]);
const AREA_SPAWNS = {
  [AREA_KEYS.SHRINE]: { x: 5 * CELL + CELL / 2, y: 4 * CELL + CELL / 2 },
  [AREA_KEYS.DOCK]: { x: CELL + CELL / 2, y: 5 * CELL + CELL / 2 },
  [AREA_KEYS.RITUAL_ROAD]: { x: 250, y: 720 },
};
const FALLBACK_NAVIGATION_DATA = {
  schemaVersion: 1,
  area: {
    id: "ritual_road",
    name: "Ritual road",
    kind: "grand_exploration",
    background: BACKGROUND_IMAGES[AREA_KEYS.RITUAL_ROAD],
    image: { width: STANDARD_IMAGE_W, height: STANDARD_IMAGE_H },
    defaults: { playerScale: MAP_KIND_DEFAULT_SCALE.grand_exploration },
    extensions: {},
  },
  entryNodeId: "lower_gate",
  nodes: [
    { id: "lower_gate", label: "Black gate", x: 250, y: 720, scale: 0.66, trigger: { type: "none", payload: {} }, extensions: {} },
    { id: "lower_bend", label: "Road bend", x: 350, y: 628, scale: 0.64, trigger: { type: "none", payload: {} }, extensions: {} },
    { id: "gate_chapel", label: "Gate chapel", x: 218, y: 452, scale: 0.62, trigger: { type: "none", payload: {} }, extensions: {} },
    { id: "middle_bend", label: "Causeway", x: 492, y: 520, scale: 0.6, trigger: { type: "none", payload: {} }, extensions: {} },
    { id: "standing_stones", label: "Standing stones", x: 488, y: 346, scale: 0.58, trigger: { type: "none", payload: {} }, extensions: {} },
    { id: "main_fork", label: "Main fork", x: 626, y: 422, scale: 0.56, trigger: { type: "none", payload: {} }, extensions: {} },
    { id: "watchtower", label: "Watchtower shrine", x: 874, y: 306, scale: 0.52, trigger: { type: "none", payload: {} }, extensions: {} },
    { id: "upper_bend", label: "Upper causeway", x: 716, y: 246, scale: 0.53, trigger: { type: "none", payload: {} }, extensions: {} },
    { id: "fortress", label: "Shrine-fortress", x: 858, y: 126, scale: 0.5, trigger: { type: "area_transition", payload: {} }, extensions: {} },
  ],
  edges: [
    { id: "lower_gate__lower_bend", from: "lower_gate", to: "lower_bend", points: [[250, 720], [286, 700], [318, 674], [350, 628]], extensions: {} },
    { id: "lower_bend__gate_chapel", from: "lower_bend", to: "gate_chapel", points: [[350, 628], [332, 590], [292, 540], [248, 486], [218, 452]], extensions: {} },
    { id: "lower_bend__middle_bend", from: "lower_bend", to: "middle_bend", points: [[350, 628], [392, 606], [446, 574], [492, 520]], extensions: {} },
    { id: "middle_bend__standing_stones", from: "middle_bend", to: "standing_stones", points: [[492, 520], [432, 492], [370, 460], [408, 404], [488, 346]], extensions: {} },
    { id: "middle_bend__main_fork", from: "middle_bend", to: "main_fork", points: [[492, 520], [536, 500], [576, 464], [626, 422]], extensions: {} },
    { id: "main_fork__watchtower", from: "main_fork", to: "watchtower", points: [[626, 422], [686, 400], [738, 382], [798, 344], [874, 306]], extensions: {} },
    { id: "main_fork__upper_bend", from: "main_fork", to: "upper_bend", points: [[626, 422], [606, 386], [650, 350], [704, 322], [716, 246]], extensions: {} },
    { id: "upper_bend__fortress", from: "upper_bend", to: "fortress", points: [[716, 246], [736, 224], [776, 204], [820, 176], [858, 126]], extensions: {} },
  ],
  combatSpawns: [],
  debug: { showOverlayByDefault: true },
  extensions: {},
};

let occlusionAreas = [];
let waterAreas = [];
let navigationData = cloneNavigationData(FALLBACK_NAVIGATION_DATA);
let navigationNodes = [];
let navigationNodeById = {};
let navigationEdges = [];
let navigationEdgeByKey = {};
let backgroundTextureByPath = {};
let discoveredNodeIds = new Set();

const SWORD_FRAMES = [
  "./assets/protagonist_step_0_clean.png",
  "./assets/protagonist_step_1_generated_crop.png",
  "./assets/protagonist_step_1_subtle.png",
  "./assets/protagonist_sword_attack_windup_crop.png",
  "./assets/protagonist_sword_attack_strike_crop.png",
  "./assets/protagonist_sword_attack_followthrough_crop.png",
];
const NPC_IMAGE = "./assets/protagonist_rogue_guard_crop.png";
const NPC_POSITION = { x: 7, y: 4 };
const HOSTILE_POSITION = { x: 9, y: 5 };
const CONVERSATION_LINES = [
  {
    speaker: "Lantern Keeper",
    text: "Keep your light low. Things below answer brightness faster than voices.",
    replies: ["Ask about the shrine lamp.", "Leave."],
  },
  {
    speaker: "You",
    text: "Then why keep the shrine lamp burning?",
    replies: ["Listen.", "Leave."],
  },
  {
    speaker: "Lantern Keeper",
    text: "Because some doors only open for flame, and some paths only remember you by it.",
    replies: ["End."],
  },
];

const SWORD_FOOT_ANCHORS = [
  { x: 0.54, y: 1 },
  { x: 0.5, y: 1 },
  { x: 0.5, y: 1 },
  { x: 0.5, y: 1 },
  { x: 0.5, y: 1 },
  { x: 0.5, y: 1 },
];

const LANTERNA_OFFSET = { x: 8, y: -54 };
const LANTERNA_COLOR = { r: 170, g: 196, b: 210 };
const LANTERNA_CORE = { r: 226, g: 234, b: 228 };
const DARKNESS_ALPHA = 0.5;
const SHRINE_STATIC_LIGHTS = [
  { x: 664, y: 274, radius: 176, strength: 0.74, glow: 150, phase: 0.4, speed: 1.1 },
  { x: 704, y: 354, radius: 88, strength: 0.48, glow: 70, phase: 1.7, speed: 1.35 },
  { x: 931, y: 344, radius: 102, strength: 0.56, glow: 86, phase: 2.8, speed: 1.55 },
  { x: 1004, y: 251, radius: 86, strength: 0.5, glow: 72, phase: 4.2, speed: 1.42 },
];
const DOCK_STATIC_LIGHTS = [
  { x: 330, y: 303, radius: 178, strength: 0.7, glow: 144, phase: 0.8, speed: 1.18 },
];
const SHRINE_WATER_REFLECTIONS = [
  { source: SHRINE_STATIC_LIGHTS[0], x: 630, y: 386, width: 118, height: 190, alpha: 0.18, color: 0xc58b52 },
  { source: SHRINE_STATIC_LIGHTS[2], x: 870, y: 438, width: 95, height: 150, alpha: 0.12, color: 0xb9804a },
  { source: SHRINE_STATIC_LIGHTS[3], x: 1030, y: 382, width: 72, height: 120, alpha: 0.1, color: 0xb9804a },
];
const DOCK_WATER_REFLECTIONS = [
  { source: DOCK_STATIC_LIGHTS[0], x: 605, y: 402, width: 130, height: 150, alpha: 0.1, color: 0xc58b52 },
];
const DOCK_WATER_AREAS = [
  {
    id: "dock_water_1",
    points: [[626, 245], [790, 210], [1152, 40], [1152, 768], [450, 768], [494, 635], [620, 525], [760, 416], [900, 334]],
  },
];
const DOCK_COLLIDERS = [
  {
    id: "dock_sea_blocked",
    points: DOCK_WATER_AREAS[0].points,
  },
];
let currentAreaKey = AREA_KEYS.RITUAL_ROAD;
let staticLights = SHRINE_STATIC_LIGHTS;
let waterReflectionDefs = SHRINE_WATER_REFLECTIONS;
const areas = {
  [AREA_KEYS.SHRINE]: {
    name: "Shrine shore",
    texture: null,
    colliders: [],
    water: [],
    staticLights: SHRINE_STATIC_LIGHTS,
    waterReflections: SHRINE_WATER_REFLECTIONS,
    playerScale: 1,
    darknessAlpha: DARKNESS_ALPHA,
    collisionInverted: false,
  },
  [AREA_KEYS.DOCK]: {
    name: "Black sea dock",
    texture: null,
    colliders: cloneAreas(DOCK_COLLIDERS),
    water: cloneAreas(DOCK_WATER_AREAS),
    staticLights: DOCK_STATIC_LIGHTS,
    waterReflections: DOCK_WATER_REFLECTIONS,
    playerScale: 1,
    darknessAlpha: DARKNESS_ALPHA,
    collisionInverted: false,
  },
  [AREA_KEYS.RITUAL_ROAD]: {
    name: "Ritual road",
    texture: null,
    colliders: [],
    water: [],
    staticLights: [],
    waterReflections: [],
    playerScale: 0.66,
    darknessAlpha: 0,
    collisionInverted: true,
  },
};

const state = {
  player: { ...AREA_SPAWNS[AREA_KEYS.RITUAL_ROAD] },
  moving: false,
  acting: false,
  downed: false,
  conversing: false,
  conversationLine: 0,
  showGrid: false,
  navEdit: false,
  navTool: "node",
  occlusionEdit: false,
  waterEdit: false,
  currentFrame: 0,
  hostileSpawned: false,
  input: new Set(),
  lastMoveStatusMS: 0,
  currentNodeId: navigationData.entryNodeId,
  selectedNodeId: null,
  selectedEdgeKey: null,
  selectedPathPointIndex: null,
  pendingConnectionNodeId: null,
  inflectionPreview: null,
  draggingNav: null,
};

const statusEl = document.getElementById("status");
const areaNameInputEl = document.getElementById("area-name-input");
const mapKindSelectEl = document.getElementById("map-kind-select");
const actNumberSelectEl = document.getElementById("act-number-select");
const mapDistributionNameEl = document.getElementById("map-distribution-name");
const mapDropPromptEl = document.getElementById("map-drop-prompt");
const mapFileInputEl = document.getElementById("map-file-input");
const newMapButtonEl = document.getElementById("new-map-button");
const loadMapButtonEl = document.getElementById("load-map-button");
const loadMapDialogEl = document.getElementById("load-map-dialog");
const loadMapCloseEl = document.getElementById("load-map-close");
const loadMapListEl = document.getElementById("load-map-list");
const readmeButtonEl = document.getElementById("readme-button");
const readmeDialogEl = document.getElementById("readme-dialog");
const readmeCloseEl = document.getElementById("readme-close");
const readmeContentEl = document.getElementById("readme-content");
const navEditToggleEl = document.getElementById("nav-edit-toggle");
const navNodeToolEl = document.getElementById("nav-node-tool");
const navConnectToolEl = document.getElementById("nav-connect-tool");
const navInflectionToolEl = document.getElementById("nav-inflection-tool");
const nodeDetailsEl = document.getElementById("node-details");
const nodeLabelInputEl = document.getElementById("node-label-input");
const nodeTriggerSelectEl = document.getElementById("node-trigger-select");
const nodeScaleInputEl = document.getElementById("node-scale-input");
const nodeDiscoveredToggleEl = document.getElementById("node-discovered-toggle");
const nodeShowLabelToggleEl = document.getElementById("node-show-label-toggle");
const nodeDescriptionInputEl = document.getElementById("node-description-input");
const gridToggleEl = document.getElementById("grid-toggle");
const occlusionEditToggleEl = document.getElementById("occlusion-edit-toggle");
const waterEditToggleEl = document.getElementById("water-edit-toggle");
const navResetEl = document.getElementById("nav-reset");
const occlusionResetEl = document.getElementById("occlusion-reset");
const waterResetEl = document.getElementById("water-reset");
const metadataSaveButtonEl = document.getElementById("metadata-save-button");
const dataExportEl = document.getElementById("data-export");
const conversationPanelEl = document.getElementById("conversation-panel");
const conversationSpeakerEl = document.getElementById("conversation-speaker");
const conversationTextEl = document.getElementById("conversation-text");
const conversationRepliesEl = document.getElementById("conversation-replies");
const tweens = new TweenSet();
let draftCollider = [];
let app;
let world;
let backgroundLayer;
let waterReflectionLayer;
let lanternaWaterReflectionLayer;
let darknessLayer;
let lightGlowLayer;
let navLayer;
let gridLayer;
let actorLayer;
let occlusionLayer;
let playerActor;
let npcActor;
let npcActors = [];
let hostileActors = [];
let activeNpcActor;
let navOverlay;
let navLightLayer;
let navLightTexture;
let gridOverlay;
let darknessOverlay;
let waterReflections = [];
let lanternaWaterReflection;
let camera = { scale: 1, baseScale: 1, mode: "free" };
let elapsedMS = 0;
let droppedMapObjectUrl = null;
let droppedMapFileName = "";
let droppedMapFile = null;
let hasUnsavedChanges = false;
let isHydratingArea = false;

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

function updateDistributionName() {
  const act = Number(actNumberSelectEl?.value);
  const areaSlug = toSafeId(areaNameInputEl?.value || "");
  const name = act && areaSlug ? `a${String(act).padStart(2, "0")}_${areaSlug}` : "";
  if (mapDistributionNameEl) mapDistributionNameEl.value = name;
  return name;
}

function startNewMap() {
  navigationData = blankNavigationData();
  rebuildNavigationGraph();
  discoveredNodeIds.clear();
  occlusionAreas = [];
  waterAreas = [];
  draftCollider = [];
  state.currentNodeId = "";
  state.selectedNodeId = null;
  state.selectedEdgeKey = null;
  areas[AREA_KEYS.RITUAL_ROAD].texture = null;
  backgroundLayer?.removeChildren();
  occlusionLayer?.removeChildren();
  renderNavigationOverlay();
  renderGridOverlay();
  updatePlayerVisibility();
  if (areaNameInputEl) areaNameInputEl.value = "";
  if (mapKindSelectEl) mapKindSelectEl.value = "";
  if (actNumberSelectEl) actNumberSelectEl.value = "";
  if (mapDistributionNameEl) mapDistributionNameEl.value = "";
  droppedMapFileName = "";
  droppedMapFile = null;
  if (droppedMapObjectUrl) URL.revokeObjectURL(droppedMapObjectUrl);
  droppedMapObjectUrl = null;
  if (mapDropPromptEl) mapDropPromptEl.hidden = false;
  document.getElementById("stage")?.scrollTo(0, 0);
  updateNodeDetailsPanel();
  updateDataExport();
  hasUnsavedChanges = false;
  setStatus("New map. Drag a 1920 × 1080 image here or click the upload prompt to select it.");
}

async function openLoadMapDialog() {
  if (!loadMapDialogEl || !loadMapListEl) return;
  if (hasUnsavedChanges && !window.confirm("Load another area and discard unsaved changes?")) return;
  loadMapListEl.textContent = "Loading areas…";
  loadMapDialogEl.showModal();
  try {
    const response = await fetch("/api/visual-spike/areas", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
    loadMapListEl.replaceChildren();
    if (!payload.areas.length) {
      loadMapListEl.textContent = "No saved area bundles found.";
      return;
    }
    for (const area of payload.areas) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `${area.id} — ${area.name}`;
      button.addEventListener("click", () => loadAreaBundle(area.id));
      loadMapListEl.appendChild(button);
    }
  } catch (err) {
    loadMapListEl.textContent = `Areas could not be listed: ${err.message}`;
  }
}

async function loadAreaBundle(areaId) {
  setStatus(`Loading ${areaId}…`);
  try {
    const response = await fetch(`/api/visual-spike/area?name=${encodeURIComponent(areaId)}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
    const bundle = payload.area;
    const backgroundPath = bundle.background || bundle.navigation?.area?.background;
    if (!backgroundPath) throw new Error("Area bundle has no background path.");
    const backgroundUrl = backgroundPath.startsWith("./") ? `/${backgroundPath.slice(2)}` : backgroundPath;
    const imageResponse = await fetch(backgroundUrl, { cache: "no-store" });
    if (!imageResponse.ok) throw new Error(`Background could not be loaded: HTTP ${imageResponse.status}`);
    const imageBlob = await imageResponse.blob();
    const imageFileName = backgroundPath.split("/").pop();
    const imageFile = new File([imageBlob], imageFileName, { type: imageBlob.type || "image/png" });
    const objectUrl = URL.createObjectURL(imageFile);
    const image = await decodeLocalImage(objectUrl, imageFileName);
    assertStandardBackgroundTexture({ width: image.naturalWidth, height: image.naturalHeight }, imageFileName);

    isHydratingArea = true;
    navigationData = normalizeNavigationData(bundle.navigation, blankNavigationData());
    rebuildNavigationGraph();
    occlusionAreas = normalizeAreas(bundle.occlusion, "occlusion");
    waterAreas = normalizeAreas(bundle.water, "water");
    discoveredNodeIds.clear();
    state.currentNodeId = navigationData.entryNodeId;
    state.selectedNodeId = null;
    state.selectedEdgeKey = null;
    if (droppedMapObjectUrl) URL.revokeObjectURL(droppedMapObjectUrl);
    droppedMapObjectUrl = objectUrl;
    droppedMapFileName = imageFileName;
    droppedMapFile = imageFile;
    areas[AREA_KEYS.RITUAL_ROAD].texture = PIXI.Texture.from(image);
    areas[AREA_KEYS.RITUAL_ROAD].water = cloneAreas(waterAreas);
    if (areaNameInputEl) areaNameInputEl.value = navigationData.area.name || "";
    if (mapKindSelectEl) mapKindSelectEl.value = bundle.mode || navigationData.area.kind || "exploration";
    if (actNumberSelectEl) actNumberSelectEl.value = String(bundle.act || "");
    updateDistributionName();
    drawBackground(areas[AREA_KEYS.RITUAL_ROAD].texture);
    renderOcclusionLayer();
    renderNavigationOverlay();
    renderGridOverlay();
    updateNodeDetailsPanel();
    updateDataExport();
    if (mapDropPromptEl) mapDropPromptEl.hidden = true;
    document.getElementById("stage")?.scrollTo(0, 0);
    loadMapDialogEl.close();
    hasUnsavedChanges = false;
    setStatus(`${areaId} loaded.`);
  } catch (err) {
    setStatus(`Area could not be loaded: ${err.message}`);
  } finally {
    isHydratingArea = false;
  }
}

function onMapDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
  mapDropPromptEl?.classList.add("is-dragging");
}

function onMapDragLeave(event) {
  if (event.currentTarget.contains(event.relatedTarget)) return;
  mapDropPromptEl?.classList.remove("is-dragging");
}

async function onMapDrop(event) {
  event.preventDefault();
  mapDropPromptEl?.classList.remove("is-dragging");
  const file = [...(event.dataTransfer?.files ?? [])].find((item) => item.type.startsWith("image/"));
  await loadMapFile(file);
}

async function loadMapFile(file) {
  if (!file) {
    setStatus("Choose a PNG or JPEG map image.");
    return;
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await decodeLocalImage(objectUrl, file.name);
    assertStandardBackgroundTexture({ width: image.naturalWidth, height: image.naturalHeight }, file.name);
    const texture = PIXI.Texture.from(image);
    if (droppedMapObjectUrl) URL.revokeObjectURL(droppedMapObjectUrl);
    droppedMapObjectUrl = objectUrl;
    droppedMapFileName = file.name;
    droppedMapFile = file;
    areas[AREA_KEYS.RITUAL_ROAD].texture = texture;
    drawBackground(texture);
    renderOcclusionLayer();
    if (mapDropPromptEl) mapDropPromptEl.hidden = true;
    document.getElementById("stage")?.scrollTo(0, 0);
    updateNavigationAreaMetadata();
    setStatus(`${file.name} loaded at native 1920 × 1080 resolution.`);
  } catch (err) {
    URL.revokeObjectURL(objectUrl);
    setStatus(`Map image not loaded: ${err.message}`);
  } finally {
    if (mapFileInputEl) mapFileInputEl.value = "";
  }
}

function decodeLocalImage(objectUrl, fileName) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`${fileName} could not be decoded as an image.`));
    image.src = objectUrl;
  });
}

async function openReadme() {
  if (!readmeDialogEl || !readmeContentEl) return;
  if (!readmeContentEl.childElementCount) {
    try {
      const markdown = await fetch("./README.md", { cache: "no-store" }).then((response) => response.text());
      for (const line of markdown.split("\n")) {
        if (!line.startsWith("- **")) continue;
        const paragraph = document.createElement("p");
        paragraph.textContent = `• ${line.replace(/^- /, "").replaceAll("**", "")}`;
        readmeContentEl.appendChild(paragraph);
      }
    } catch {
      readmeContentEl.textContent = "Help could not be loaded.";
    }
  }
  readmeDialogEl.showModal();
}

function tileCenter(x, y) {
  return {
    x: x * CELL + CELL / 2,
    y: y * CELL + CELL / 2,
  };
}

function isBlocked(x, y) {
  if (x < 0 || y < 0 || x > WORLD_W || y > WORLD_H) return true;
  if (isStaticOccupiedTile(x, y)) return true;
  const radius = currentAreaKey === AREA_KEYS.RITUAL_ROAD ? 10 : 18;
  const samples = [
    [x, y],
    [x - radius, y],
    [x + radius, y],
    [x, y - radius * 0.55],
    [x, y + radius * 0.55],
  ];
  return samples.some(([sampleX, sampleY]) => isCollisionSampleBlocked(sampleX, sampleY));
}

function isCollisionSampleBlocked(x, y) {
  if (x < 0 || y < 0 || x > WORLD_W || y > WORLD_H) return true;
  return false;
}

function isCollisionInverted() {
  return Boolean(areas[currentAreaKey]?.collisionInverted);
}

function cellHasFlag(x, y, flag) {
  return CELL_DATA[y]?.[x]?.flags?.includes(flag) ?? false;
}

function isStaticOccupiedTile(x, y) {
  return [...npcActors, ...hostileActors].some(({ actor, position }) =>
    actor.visible && Math.hypot(actor.x - x, actor.y - y) < 42
  );
}

async function init() {
  const stageElement = document.getElementById("stage");
  app = new PIXI.Application();
  await app.init({
    width: WORLD_W,
    height: WORLD_H,
    background: "#050607",
    antialias: true,
    autoDensity: true,
    preference: "webgl",
    resolution: Math.min(window.devicePixelRatio || 1, 2),
  });

  stageElement.appendChild(app.canvas);

  world = new PIXI.Container();
  app.stage.addChild(world);

  backgroundLayer = new PIXI.Container();
  waterReflectionLayer = new PIXI.Container();
  lanternaWaterReflectionLayer = new PIXI.Container();
  darknessLayer = new PIXI.Container();
  lightGlowLayer = new PIXI.Container();
  navLayer = new PIXI.Container();
  gridLayer = new PIXI.Container();
  actorLayer = new PIXI.Container();
  occlusionLayer = new PIXI.Container();
  actorLayer.sortableChildren = true;
  world.addChild(
    backgroundLayer,
    waterReflectionLayer,
    darknessLayer,
    lightGlowLayer,
    lanternaWaterReflectionLayer,
    navLayer,
    actorLayer,
    occlusionLayer,
    gridLayer
  );

  resize();
  stageElement.scrollTo(0, 0);

  navigationData = blankNavigationData();
  rebuildNavigationGraph();
  currentAreaKey = AREA_KEYS.RITUAL_ROAD;
  occlusionAreas = [];
  waterAreas = [];

  drawNavigationOverlay();
  drawGrid();
  resize();

  window.addEventListener("resize", resize);
  window.addEventListener("keydown", onKeyDown, { passive: false });
  window.addEventListener("keyup", onKeyUp, { passive: false });
  window.addEventListener("blur", clearMovementInput);
  app.canvas.addEventListener("pointerdown", onCanvasPointerDown);
  app.canvas.addEventListener("pointermove", onCanvasPointerMove);
  window.addEventListener("pointerup", onCanvasPointerUp);
  areaNameInputEl?.addEventListener("change", () => updateNavigationAreaMetadata());
  areaNameInputEl?.addEventListener("input", updateDistributionName);
  mapKindSelectEl?.addEventListener("change", () => updateNavigationAreaMetadata());
  actNumberSelectEl?.addEventListener("change", () => {
    updateDistributionName();
    updateDataExport();
  });
  newMapButtonEl?.addEventListener("click", startNewMap);
  loadMapButtonEl?.addEventListener("click", openLoadMapDialog);
  loadMapCloseEl?.addEventListener("click", () => loadMapDialogEl?.close());
  stageElement.addEventListener("dragover", onMapDragOver);
  stageElement.addEventListener("dragleave", onMapDragLeave);
  stageElement.addEventListener("drop", onMapDrop);
  mapFileInputEl?.addEventListener("change", () => loadMapFile(mapFileInputEl.files?.[0]));
  readmeButtonEl?.addEventListener("click", openReadme);
  readmeCloseEl?.addEventListener("click", () => readmeDialogEl?.close());
  navEditToggleEl?.addEventListener("change", () => setNavEdit(navEditToggleEl.checked));
  navNodeToolEl?.addEventListener("click", () => setNavTool("node"));
  navConnectToolEl?.addEventListener("click", () => setNavTool("connect"));
  navInflectionToolEl?.addEventListener("click", () => setNavTool("inflection"));
  nodeLabelInputEl?.addEventListener("input", updateSelectedNodeDetails);
  nodeTriggerSelectEl?.addEventListener("change", updateSelectedNodeDetails);
  nodeScaleInputEl?.addEventListener("change", updateSelectedNodeDetails);
  nodeDiscoveredToggleEl?.addEventListener("change", updateSelectedNodeDetails);
  nodeShowLabelToggleEl?.addEventListener("change", updateSelectedNodeDetails);
  nodeDescriptionInputEl?.addEventListener("input", updateSelectedNodeDetails);
  gridToggleEl?.addEventListener("change", () => setGridVisible(gridToggleEl.checked));
  occlusionEditToggleEl?.addEventListener("change", () => setOcclusionEdit(occlusionEditToggleEl.checked));
  waterEditToggleEl?.addEventListener("change", () => setWaterEdit(waterEditToggleEl.checked));
  navResetEl?.addEventListener("click", resetNavigation);
  occlusionResetEl?.addEventListener("click", resetAllOcclusion);
  waterResetEl?.addEventListener("click", resetAllWater);
  metadataSaveButtonEl?.addEventListener("click", saveMapMetadata);
  app.ticker.add(tick);
  setGridVisible(state.showGrid);
  syncNavigationControls();
  updateNavToolControls();
  updateNodeDetailsPanel();
  updateDataExport();
  hasUnsavedChanges = false;
  setStatus("Start a new map by dragging a 1920 × 1080 image here or clicking the upload prompt.");
}

function blankNavigationData() {
  const data = cloneNavigationData(FALLBACK_NAVIGATION_DATA);
  data.area = {
    ...data.area,
    id: "",
    name: "",
    kind: "",
    background: "",
    defaults: { playerScale: 1 },
  };
  data.entryNodeId = "";
  data.nodes = [];
  data.edges = [];
  data.combatSpawns = [];
  return data;
}

async function loadTextures(paths) {
  return Promise.all(paths.map((path) => PIXI.Assets.load(path)));
}

async function loadOcclusionData(areaKey) {
  try {
    const response = await fetch(AREA_DATA_FILES[areaKey].occlusion, { cache: "no-store" });
    if (response.status === 404) return [];
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return normalizeAreas(await response.json(), "occlusion");
  } catch (err) {
    console.warn("[visual_spike] Could not load occlusion data", err);
    return [];
  }
}

async function loadAreaBackgrounds() {
  const entries = await Promise.all(
    Object.entries(BACKGROUND_IMAGES).map(async ([key, path]) => {
      const texture = await PIXI.Assets.load(path);
      assertStandardBackgroundTexture(texture, path);
      return [key, texture];
    })
  );
  return Object.fromEntries(entries);
}

function assertStandardBackgroundTexture(texture, path) {
  if (texture.width !== STANDARD_IMAGE_W || texture.height !== STANDARD_IMAGE_H) {
    throw new Error(`${path} is ${texture.width}x${texture.height}; area backgrounds must be ${STANDARD_IMAGE_W}x${STANDARD_IMAGE_H}.`);
  }
}

async function loadWaterData(areaKey, fallback = []) {
  try {
    const response = await fetch(AREA_DATA_FILES[areaKey].water, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return normalizeAreas(data, "water");
  } catch (err) {
    console.warn("[visual_spike] Could not load water data", err);
    return cloneAreas(fallback);
  }
}

async function loadNavigationData(areaKey, fallback) {
  try {
    const response = await fetch(AREA_DATA_FILES[areaKey].navigation, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return normalizeNavigationData(data, fallback);
  } catch (err) {
    console.warn("[visual_spike] Could not load navigation data", err);
    return normalizeNavigationData(fallback, fallback);
  }
}

function normalizeNavigationData(data, fallback) {
  const source = data && typeof data === "object" ? data : fallback;
  const area = source.area && typeof source.area === "object" ? source.area : fallback.area;
  const kind = ["combat", "exploration", "grand_exploration"].includes(area.kind) ? area.kind : "exploration";
  const defaultScale = Number(area.defaults?.playerScale);
  const normalized = {
    schemaVersion: Number.isFinite(Number(source.schemaVersion)) ? Number(source.schemaVersion) : 1,
    area: {
      id: toSafeId(area.id || area.name || "area"),
      name: typeof area.name === "string" && area.name ? area.name : "Area",
      kind,
      background: typeof area.background === "string" && area.background ? area.background : fallback.area.background,
      image: {
        width: STANDARD_IMAGE_W,
        height: STANDARD_IMAGE_H,
      },
      defaults: {
        ...(area.defaults && typeof area.defaults === "object" ? area.defaults : {}),
        playerScale: Number.isFinite(defaultScale) ? defaultScale : MAP_KIND_DEFAULT_SCALE[kind],
      },
      extensions: area.extensions && typeof area.extensions === "object" ? area.extensions : {},
    },
    entryNodeId: "",
    nodes: [],
    edges: [],
    combatSpawns: normalizeCombatSpawns(source.combatSpawns),
    debug: source.debug && typeof source.debug === "object" ? source.debug : {},
    extensions: source.extensions && typeof source.extensions === "object" ? source.extensions : {},
  };

  const nodeIds = new Set();
  normalized.nodes = (Array.isArray(source.nodes) ? source.nodes : fallback.nodes)
    .map((node, index) => {
      const id = toSafeId(node?.id || node?.label || `node_${index + 1}`);
      if (nodeIds.has(id)) return null;
      const x = Math.round(Number(node?.x));
      const y = Math.round(Number(node?.y));
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      nodeIds.add(id);
      const scale = Number(node?.scale);
      return {
        id,
        label: typeof node?.label === "string" && node.label ? node.label : id.replaceAll("_", " "),
        description: typeof node?.description === "string" ? node.description : "",
        discovery: normalizeDiscovery(node?.discovery),
        x,
        y,
        scale: Number.isFinite(scale) && scale > 0 ? scale : normalized.area.defaults.playerScale,
        trigger: normalizeNodeTrigger(node?.trigger, node?.roles),
        extensions: node?.extensions && typeof node.extensions === "object" ? node.extensions : {},
      };
    })
    .filter(Boolean);

  normalized.entryNodeId = nodeIds.has(source.entryNodeId)
    ? source.entryNodeId
    : normalized.nodes.find((node) => Array.isArray(source.nodes) && source.nodes.find((item) => toSafeId(item?.id || item?.label) === node.id)?.roles?.includes("entry"))?.id ?? normalized.nodes[0]?.id ?? "";

  normalized.edges = (Array.isArray(source.edges) ? source.edges : fallback.edges)
    .map((edge, index) => {
      const from = toSafeId(edge?.from || "");
      const to = toSafeId(edge?.to || "");
      if (!nodeIds.has(from) || !nodeIds.has(to) || from === to) return null;
      const fromNode = normalized.nodes.find((node) => node.id === from);
      const toNode = normalized.nodes.find((node) => node.id === to);
      const points = Array.isArray(edge?.points)
        ? edge.points
            .map((point) => Array.isArray(point) ? [Math.round(Number(point[0])), Math.round(Number(point[1]))] : null)
            .filter((point) => point && Number.isFinite(point[0]) && Number.isFinite(point[1]))
        : [];
      const safePoints = points.length >= 2 ? points : [[fromNode.x, fromNode.y], [toNode.x, toNode.y]];
      return {
        id: toSafeId(edge?.id || `${from}__${to}`),
        from,
        to,
        points: safePoints,
        extensions: edge?.extensions && typeof edge.extensions === "object" ? edge.extensions : {},
      };
    })
    .filter(Boolean);
  return normalized;
}

function normalizeDiscovery(discovery) {
  const state = discovery?.state === "discovered" ? "discovered" : "undiscovered";
  return {
    state,
    showLabelWhenDiscovered: discovery?.showLabelWhenDiscovered !== false,
  };
}

function normalizeNodeTrigger(trigger, legacyRoles = []) {
  const legacy = Array.isArray(legacyRoles) ? legacyRoles : [];
  const inferredType = legacy.includes("start_conversation")
    ? "conversation"
    : legacy.includes("combat_transition") || legacy.includes("encounter")
      ? "combat"
      : legacy.includes("exit")
        ? "area_transition"
        : "none";
  const type = ["none", "conversation", "area_transition", "combat"].includes(trigger?.type)
    ? trigger.type
    : inferredType;
  return {
    type,
    payload: trigger?.payload && typeof trigger.payload === "object" ? trigger.payload : {},
  };
}

function normalizeCombatSpawns(spawns) {
  if (!Array.isArray(spawns)) return [];
  return spawns
    .map((spawn, index) => {
      const x = Math.round(Number(spawn?.x));
      const y = Math.round(Number(spawn?.y));
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      return {
        id: toSafeId(spawn?.id || `combat_spawn_${index + 1}`),
        label: typeof spawn?.label === "string" && spawn.label ? spawn.label : `Combat spawn ${index + 1}`,
        x: Math.max(0, Math.min(WORLD_W, x)),
        y: Math.max(0, Math.min(WORLD_H, y)),
        extensions: spawn?.extensions && typeof spawn.extensions === "object" ? spawn.extensions : {},
      };
    })
    .filter(Boolean);
}

function cloneNavigationData(data) {
  return JSON.parse(JSON.stringify(data));
}

function cloneAreas(areasToClone) {
  return areasToClone.map((area) => ({
    ...area,
    points: area.points.map((point) => [...point]),
  }));
}

function normalizeAreas(data, fallbackPrefix) {
  if (!Array.isArray(data)) return [];
  return data
    .map((collider, index) => {
      const points = Array.isArray(collider?.points)
        ? collider.points
            .filter((point) => Array.isArray(point) && point.length >= 2)
            .map((point) => [Math.round(Number(point[0])), Math.round(Number(point[1]))])
            .filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]))
        : [];
      if (points.length < 3) return null;
      return {
        id: typeof collider.id === "string" && collider.id ? collider.id : `${fallbackPrefix}_${index + 1}`,
        points,
      };
    })
    .filter(Boolean);
}

function drawBackground(texture) {
  backgroundLayer.removeChildren();
  backgroundLayer.mask = null;
  const sprite = new PIXI.Sprite(texture);
  sprite.position.set(0, 0);
  sprite.scale.set(1);

  const mask = new PIXI.Graphics();
  mask.beginFill(0xffffff, 1);
  mask.drawRect(0, 0, WORLD_W, WORLD_H);
  mask.endFill();

  backgroundLayer.addChild(sprite, mask);
  backgroundLayer.mask = mask;
  renderOcclusionLayer();
}

function renderOcclusionLayer() {
  if (!occlusionLayer || !areas[AREA_KEYS.RITUAL_ROAD].texture) return;
  occlusionLayer.removeChildren();
  for (const area of occlusionAreas) {
    const sprite = new PIXI.Sprite(areas[AREA_KEYS.RITUAL_ROAD].texture);
    const mask = new PIXI.Graphics();
    drawPolygon(mask, area.points);
    mask.fill({ color: 0xffffff, alpha: 1 });
    sprite.mask = mask;
    occlusionLayer.addChild(sprite, mask);
  }
}

function createWaterReflections() {
  waterReflectionLayer.removeChildren();
  waterReflectionLayer.mask = null;
  const mask = new PIXI.Graphics();
  drawWaterMask(mask);
  waterReflectionLayer.addChild(mask);
  waterReflectionLayer.mask = mask;

  const reflectionTexture = createWaterReflectionTexture();
  waterReflections = waterReflectionDefs.map((reflection, index) => {
    const sprite = new PIXI.Sprite(reflectionTexture);
    sprite.anchor.set(0.5, 0);
    sprite.x = reflection.x;
    sprite.y = reflection.y;
    sprite.width = reflection.width;
    sprite.height = reflection.height;
    sprite.tint = reflection.color;
    sprite.alpha = reflection.alpha;
    sprite.blendMode = "screen";
    sprite.parts = { reflection, phase: index * 1.7 };
    waterReflectionLayer.addChild(sprite);
    return sprite;
  });
}

function createLanternaWaterReflection() {
  lanternaWaterReflectionLayer.removeChildren();
  lanternaWaterReflectionLayer.mask = null;
  const mask = new PIXI.Graphics();
  drawWaterMask(mask);
  lanternaWaterReflectionLayer.addChild(mask);
  lanternaWaterReflectionLayer.mask = mask;

  lanternaWaterReflection = new PIXI.Sprite(createLanternaWaterReflectionTexture());
  lanternaWaterReflection.anchor.set(0.5, 0);
  lanternaWaterReflection.tint = 0xcde7ed;
  lanternaWaterReflection.alpha = 0;
  lanternaWaterReflection.blendMode = "screen";
  lanternaWaterReflectionLayer.addChild(lanternaWaterReflection);
}

function refreshWaterMasks() {
  for (const layer of [waterReflectionLayer, lanternaWaterReflectionLayer]) {
    if (!layer?.mask) continue;
    drawWaterMask(layer.mask);
  }
}

function drawWaterMask(graphics) {
  graphics.clear();
  graphics.beginFill(0xffffff, 1);
  for (const area of waterAreas) {
    graphics.drawPolygon(area.points.flat());
  }
  graphics.endFill();
}

function updateWaterReflections(timeMS) {
  if (!waterReflections.length) return;
  const t = timeMS * 0.001;
  for (const sprite of waterReflections) {
    const { reflection, phase } = sprite.parts;
    const flicker = lightFlicker(t, reflection.source);
    sprite.alpha = reflection.alpha * (0.68 + flicker * 0.34);
    sprite.x = reflection.x + Math.sin(t * 0.9 + phase) * 2.4;
    sprite.scale.x = (reflection.width / sprite.texture.width) * (1 + Math.sin(t * 1.7 + phase) * 0.035);
    sprite.scale.y = (reflection.height / sprite.texture.height) * (1 + Math.cos(t * 1.15 + phase) * 0.03);
  }

  updateLanternaWaterReflection(t);
}

function updateLanternaWaterReflection(t) {
  if (!lanternaWaterReflection || !playerActor) return;
  const lampX = playerActor.x + LANTERNA_OFFSET.x;
  const water = nearestWaterReflectionPoint(lampX, playerActor.y);
  const distance = Math.hypot(lampX - water.x, playerActor.y - water.y);
  const reach = Math.max(0, 1 - distance / 230);
  const flicker =
    0.54 +
    Math.sin(t * 5.6 + 0.9) * 0.13 +
    Math.sin(t * 9.4 + 2.1) * 0.06;

  lanternaWaterReflection.visible = reach > 0.01;
  lanternaWaterReflection.x = water.x + Math.sin(t * 1.4) * 2.2;
  lanternaWaterReflection.y = water.y + Math.cos(t * 0.9) * 2;
  lanternaWaterReflection.alpha = reach * (0.28 + flicker * 0.28);
  lanternaWaterReflection.scale.set(
    (82 / lanternaWaterReflection.texture.width) * (1 + Math.sin(t * 1.8) * 0.06),
    (72 / lanternaWaterReflection.texture.height) * (1 + Math.cos(t * 1.1) * 0.04)
  );
}

function nearestWaterReflectionPoint(x, y) {
  let best = { x, y, distance: Infinity };
  for (const area of waterAreas) {
    if (pointInPolygon(x, y, area.points)) return { x, y };
    for (let i = 0; i < area.points.length; i++) {
      const a = area.points[i];
      const b = area.points[(i + 1) % area.points.length];
      const point = nearestPointOnSegment(x, y, a, b);
      const distance = Math.hypot(x - point.x, y - point.y);
      if (distance < best.distance) best = { ...point, distance };
    }
  }
  return best.distance === Infinity ? { x, y: WORLD_H + 999 } : best;
}

function nearestPointOnSegment(x, y, a, b) {
  const ax = a[0];
  const ay = a[1];
  const bx = b[0];
  const by = b[1];
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / lengthSq));
  return {
    x: ax + dx * t,
    y: ay + dy * t,
  };
}

function createStaticLighting() {
  darknessLayer.removeChildren();
  lightGlowLayer.removeChildren();
  darknessOverlay = null;
  const canvas = document.createElement("canvas");
  canvas.width = WORLD_W;
  canvas.height = WORLD_H;
  const ctx = canvas.getContext("2d");
  const texture = PIXI.Texture.from(canvas);
  darknessOverlay = {
    canvas,
    ctx,
    texture,
    sprite: new PIXI.Sprite(texture),
    lastRenderMS: -Infinity,
  };
  darknessLayer.addChild(darknessOverlay.sprite);

  const glowTexture = createStaticLightGlowTexture();
  for (const light of staticLights) {
    const glow = new PIXI.Sprite(glowTexture);
    glow.anchor.set(0.5);
    glow.x = light.x;
    glow.y = light.y;
    const baseScale = (light.glow * 2) / glowTexture.width;
    glow.scale.set(baseScale);
    glow.alpha = 0.16;
    glow.blendMode = "screen";
    glow.parts = { light, baseScale };
    lightGlowLayer.addChild(glow);
  }

  renderStaticLighting(0);
}

function renderStaticLighting(timeMS) {
  if (!darknessOverlay) return;
  if (timeMS - darknessOverlay.lastRenderMS < 50) return;
  darknessOverlay.lastRenderMS = timeMS;

  const t = timeMS * 0.001;
  const { ctx, texture } = darknessOverlay;
  const darknessAlpha = areas[currentAreaKey]?.darknessAlpha ?? DARKNESS_ALPHA;
  ctx.clearRect(0, 0, WORLD_W, WORLD_H);
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = `rgba(0, 0, 0, ${darknessAlpha})`;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  ctx.globalCompositeOperation = "destination-out";
  for (const light of staticLights) {
    const flicker = lightFlicker(t, light);
    const radius = light.radius * (0.96 + flicker * 0.055);
    const strength = light.strength * (0.92 + flicker * 0.1);
    const gradient = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, radius);
    gradient.addColorStop(0, `rgba(0,0,0,${strength})`);
    gradient.addColorStop(0.42, `rgba(0,0,0,${strength * 0.48})`);
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(light.x - radius, light.y - radius, radius * 2, radius * 2);
  }
  drawLanternaLightMask(ctx, t);
  ctx.globalCompositeOperation = "source-over";
  texture.source.update();

  for (const glow of lightGlowLayer.children) {
    const light = glow.parts.light;
    const flicker = lightFlicker(t, light);
    glow.alpha = 0.1 + flicker * 0.075;
    glow.scale.set(glow.parts.baseScale * (0.96 + flicker * 0.035));
  }
}

function drawLanternaLightMask(ctx, t) {
  if (!playerActor) return;
  const flicker =
    0.5 +
    Math.sin(t * 5.6 + 0.9) * 0.12 +
    Math.sin(t * 9.4 + 2.1) * 0.055;
  const lampX = playerActor.x + LANTERNA_OFFSET.x;
  const lampY = playerActor.y + LANTERNA_OFFSET.y;
  const floorX = lampX + 18;
  const floorY = playerActor.y - 8;
  const radiusX = 168 * (0.98 + flicker * 0.04);
  const radiusY = 86 * (0.98 + flicker * 0.035);

  ctx.save();
  ctx.translate(floorX, floorY);
  ctx.rotate(-0.12);
  ctx.scale(1, radiusY / radiusX);
  const floorGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radiusX);
  floorGradient.addColorStop(0, "rgba(0,0,0,0.58)");
  floorGradient.addColorStop(0.34, "rgba(0,0,0,0.34)");
  floorGradient.addColorStop(0.78, "rgba(0,0,0,0.1)");
  floorGradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = floorGradient;
  ctx.fillRect(-radiusX, -radiusX, radiusX * 2, radiusX * 2);
  ctx.restore();

  const bodyRadius = 78 * (0.98 + flicker * 0.05);
  const bodyGradient = ctx.createRadialGradient(lampX, lampY + 20, 0, lampX, lampY + 20, bodyRadius);
  bodyGradient.addColorStop(0, "rgba(0,0,0,0.26)");
  bodyGradient.addColorStop(0.55, "rgba(0,0,0,0.12)");
  bodyGradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = bodyGradient;
  ctx.fillRect(lampX - bodyRadius, lampY + 20 - bodyRadius, bodyRadius * 2, bodyRadius * 2);
}

function lightFlicker(t, light) {
  return (
    0.52 +
    Math.sin(t * light.speed * 5.1 + light.phase) * 0.18 +
    Math.sin(t * light.speed * 8.7 + light.phase * 1.9) * 0.08
  );
}

function createStaticLightGlowTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,210,135,0.56)");
  gradient.addColorStop(0.22, "rgba(224,146,76,0.22)");
  gradient.addColorStop(0.58, "rgba(180,94,42,0.07)");
  gradient.addColorStop(1, "rgba(180,94,42,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return PIXI.Texture.from(canvas);
}

function createNavigationLightTexture() {
  const size = 96;
  const center = size / 2;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  const halo = ctx.createRadialGradient(center, center, 1, center, center, center);
  halo.addColorStop(0, "rgba(255,248,202,0.62)");
  halo.addColorStop(0.18, "rgba(226,230,183,0.34)");
  halo.addColorStop(0.48, "rgba(174,205,161,0.12)");
  halo.addColorStop(1, "rgba(174,205,161,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, size, size);

  ctx.save();
  ctx.translate(center, center);
  ctx.rotate(-0.34);
  ctx.shadowColor = "rgba(255,248,202,0.62)";
  ctx.shadowBlur = 11;
  ctx.fillStyle = "rgba(255,247,202,0.86)";
  ctx.beginPath();
  ctx.moveTo(-4, -19);
  ctx.lineTo(9, -7);
  ctx.lineTo(3, 18);
  ctx.lineTo(-11, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(center, center);
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(255,252,224,0.72)";
  ctx.lineWidth = 2.2;
  ctx.shadowColor = "rgba(255,248,202,0.45)";
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(-18, -6);
  ctx.lineTo(-5, -1);
  ctx.moveTo(8, -13);
  ctx.lineTo(18, -19);
  ctx.moveTo(7, 11);
  ctx.lineTo(17, 17);
  ctx.stroke();
  ctx.restore();

  softenCanvas(ctx, size, size, 1);
  return PIXI.Texture.from(canvas);
}

function createWaterReflectionTexture() {
  const width = 96;
  const height = 220;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  for (let y = 0; y < height; y++) {
    const v = y / (height - 1);
    const falloff = Math.pow(1 - v, 1.55);
    const centerWidth = (0.16 + v * 0.34) * width;
    const wave = Math.sin(v * 34) * 5 + Math.sin(v * 71 + 0.6) * 2.4;
    const alpha = 0.18 * falloff;
    const gradient = ctx.createLinearGradient(width / 2 - centerWidth, 0, width / 2 + centerWidth, 0);
    gradient.addColorStop(0, "rgba(255,255,255,0)");
    gradient.addColorStop(0.5, `rgba(255,255,255,${alpha})`);
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(width / 2 - centerWidth + wave, y, centerWidth * 2, 2);
  }

  softenCanvas(ctx, width, height, 2);
  return PIXI.Texture.from(canvas);
}

function createLanternaWaterReflectionTexture() {
  const width = 96;
  const height = 96;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  for (let y = 0; y < height; y++) {
    const v = y / (height - 1);
    const falloff = Math.pow(1 - v, 1.9);
    const spread = (0.18 + v * 0.24) * width;
    const wave = Math.sin(v * 28) * 4 + Math.sin(v * 67 + 1.4) * 1.8;
    const alpha = 0.42 * falloff;
    const gradient = ctx.createLinearGradient(width / 2 - spread, 0, width / 2 + spread, 0);
    gradient.addColorStop(0, "rgba(255,255,255,0)");
    gradient.addColorStop(0.42, `rgba(255,255,255,${alpha * 0.55})`);
    gradient.addColorStop(0.5, `rgba(255,255,255,${alpha})`);
    gradient.addColorStop(0.58, `rgba(255,255,255,${alpha * 0.55})`);
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(width / 2 - spread + wave, y, spread * 2, 2);
  }

  softenCanvas(ctx, width, height, 2);
  return PIXI.Texture.from(canvas);
}

function drawGrid() {
  gridOverlay = new PIXI.Graphics();
  gridOverlay.visible = state.showGrid;
  renderGridOverlay();
  gridLayer.addChild(gridOverlay);
}

function renderGridOverlay() {
  if (!gridOverlay) return;
  gridOverlay.clear();

  for (const area of occlusionAreas) {
    drawPolygon(gridOverlay, area.points);
    gridOverlay.fill({ color: 0xb57bd6, alpha: 0.2 });
    drawPolygon(gridOverlay, area.points);
    gridOverlay.stroke({ width: 2, color: 0xe5bdff, alpha: 0.8, pixelLine: true });
  }

  for (const area of waterAreas) {
    drawPolygon(gridOverlay, area.points);
    gridOverlay.fill({ color: 0x1c83a6, alpha: 0.22 });
    drawPolygon(gridOverlay, area.points);
    gridOverlay.stroke({ width: 2, color: 0x9ee9ff, alpha: 0.72, pixelLine: true });
  }

  if (draftCollider.length) {
    drawPolyline(gridOverlay, draftCollider);
    gridOverlay.stroke({ width: 3, color: state.waterEdit ? 0x80e8ff : 0xffd166, alpha: 0.95, pixelLine: true });
    for (const point of draftCollider) {
      gridOverlay.circle(point[0], point[1], 5);
      gridOverlay.fill({ color: state.waterEdit ? 0x80e8ff : 0xffd166, alpha: 0.95 });
    }
  }
  gridOverlay.rect(0, 0, WORLD_W, WORLD_H);
  gridOverlay.stroke({ width: 2, color: 0xf0f0f0, alpha: 0.22, pixelLine: true });
}

function drawNavigationOverlay() {
  renderNavigationOverlay();
}

function renderNavigationOverlay() {
  if (!navLayer) return;
  navLayer.removeChildren();
  navOverlay = new PIXI.Graphics();
  navLightLayer = new PIXI.Container();
  navLayer.addChild(navOverlay, navLightLayer);
  navOverlay.clear();
  navOverlay.visible = currentAreaKey === AREA_KEYS.RITUAL_ROAD;
  navLightLayer.visible = navOverlay.visible;
  if (!navOverlay.visible) return;

  for (const edge of navigationEdges) {
    const isSelected = edgeKey(edge.from, edge.to) === state.selectedEdgeKey;
    const touchesSelectedNode = state.selectedNodeId && (edge.from === state.selectedNodeId || edge.to === state.selectedNodeId);
    drawPolyline(navOverlay, sampledCurvePoints(pathForEdge(edge.from, edge.to)));
    navOverlay.stroke({
      width: isSelected ? 6 : touchesSelectedNode ? 4 : 3,
      color: isSelected ? 0xffd27d : touchesSelectedNode ? 0xd7e8b5 : 0x9eb78b,
      alpha: isSelected ? 0.96 : touchesSelectedNode ? 0.76 : 0.58,
      pixelLine: true,
    });
  }

  if (state.navEdit && state.navTool === "inflection" && state.selectedEdgeKey) {
    const edge = navigationEdgeByKey[state.selectedEdgeKey];
    if (edge) {
      edge.points.forEach((point, index) => {
        const isEnd = index === 0 || index === edge.points.length - 1;
        if (isEnd) return;
        drawDiamond(navOverlay, point[0], point[1], index === state.selectedPathPointIndex ? 8 : 5);
        navOverlay.fill({ color: index === state.selectedPathPointIndex ? 0xfff1c8 : 0x75d9ff, alpha: 0.92 });
        drawDiamond(navOverlay, point[0], point[1], index === state.selectedPathPointIndex ? 10 : 7);
        navOverlay.stroke({ width: 2, color: 0x031015, alpha: 0.72, pixelLine: true });
      });
    }
  }

  if (state.navEdit && state.navTool === "inflection" && state.inflectionPreview) {
    const edge = navigationEdgeByKey[state.inflectionPreview.edgeKey];
    if (edge) {
      const points = previewEdgePoints(edge, state.inflectionPreview);
      drawPolyline(navOverlay, sampledCurvePoints(points));
      navOverlay.stroke({ width: 5, color: 0x75d9ff, alpha: 0.76, pixelLine: true });
      drawDiamond(navOverlay, state.inflectionPreview.x, state.inflectionPreview.y, 7);
      navOverlay.fill({ color: 0x75d9ff, alpha: 0.9 });
    }
  }

  const current = navigationNodeById[state.currentNodeId];
  const reachable = new Set(current?.links ?? []);
  for (const node of navigationNodes) {
    const isCurrent = node.id === state.currentNodeId;
    const isReachable = reachable.has(node.id);
    const isSelected = node.id === state.selectedNodeId;
    if (!state.navEdit) {
      addNavigationLightNode(node, { isSelected, isCurrent, isReachable });
      if (shouldShowNodeLabel(node, { isSelected, isCurrent })) addNodeLabel(node, { isSelected, isCurrent });
      continue;
    }
    const radius = isSelected ? 13 : isCurrent ? 11 : isReachable ? 9 : 8;
    navOverlay.circle(node.x, node.y, radius + 5);
    navOverlay.fill({
      color: 0x020303,
      alpha: 0.58,
    });
    navOverlay.circle(node.x, node.y, radius);
    navOverlay.fill({
      color: nodeColor(node, { isSelected, isCurrent, isReachable }),
      alpha: isSelected ? 0.96 : isCurrent ? 0.9 : 0.78,
    });
    navOverlay.circle(node.x, node.y, radius + 3);
    navOverlay.stroke({
      width: isSelected || isCurrent ? 3 : 2,
      color: isSelected ? 0xfff1c8 : isCurrent ? 0xf1e6bd : 0x0f1914,
      alpha: isSelected || isCurrent ? 0.9 : 0.82,
      pixelLine: true,
    });
    if (shouldShowNodeLabel(node, { isSelected, isCurrent })) addNodeLabel(node, { isSelected, isCurrent });
  }
}

function addNavigationLightNode(node, { isSelected, isCurrent, isReachable }) {
  if (!navLightTexture) navLightTexture = createNavigationLightTexture();
  const isRevealed = isNodeRevealed(node);
  const marker = new PIXI.Sprite(navLightTexture);
  marker.anchor.set(0.5);
  marker.x = node.x;
  marker.y = node.y;
  marker.blendMode = "screen";
  marker.tint = nodeLightColor(node, { isSelected, isCurrent, isReachable });
  marker.alpha = isRevealed ? (isCurrent ? 0.92 : 0.74) : 0.5;
  marker.scale.set(isCurrent ? 0.58 : isReachable ? 0.5 : 0.43);
  marker.parts = {
    nodeId: node.id,
    revealed: isRevealed,
    baseAlpha: marker.alpha,
    baseScale: marker.scale.x,
    phase: lightPhaseForId(node.id),
  };
  navLightLayer.addChild(marker);
}

function updateNavigationLightNodes(timeMS) {
  if (!navLightLayer?.visible || state.navEdit) return;
  const t = timeMS * 0.001;
  for (const marker of navLightLayer.children) {
    const parts = marker.parts;
    if (!parts || parts.revealed) {
      if (parts) {
        marker.alpha = parts.baseAlpha;
        marker.scale.set(parts.baseScale);
      }
      continue;
    }
    const pulse = 0.5 + Math.sin(t * 2.25 + parts.phase) * 0.5;
    const ember = 0.5 + Math.sin(t * 5.4 + parts.phase * 1.7) * 0.5;
    marker.alpha = parts.baseAlpha + pulse * 0.16 + ember * 0.05;
    marker.scale.set(parts.baseScale * (0.92 + pulse * 0.16));
  }
}

function shouldShowNodeLabel(node, { isSelected, isCurrent }) {
  if (state.navEdit || isSelected) return true;
  return isNodeRevealed(node) &&
    node.discovery?.showLabelWhenDiscovered !== false;
}

function isNodeRevealed(node) {
  return node.discovery?.state === "discovered" || discoveredNodeIds.has(node.id);
}

function lightPhaseForId(id) {
  let hash = 0;
  for (const char of String(id)) hash = (hash * 31 + char.charCodeAt(0)) % 997;
  return hash * 0.037;
}

function nodeColor(node, { isSelected, isCurrent, isReachable }) {
  if (isSelected) return 0xffc96f;
  if (isCurrent) return 0xf1e6bd;
  if (node.id === navigationData.entryNodeId) return 0xaedb8e;
  if (node.trigger?.type === "area_transition") return 0xd18f84;
  if (node.trigger?.type === "conversation") return 0x9bc8d2;
  if (node.trigger?.type === "combat") return 0xd69048;
  if (isReachable) return 0xc5d994;
  return 0x6d7f5b;
}

function nodeLightColor(node, { isSelected, isCurrent, isReachable }) {
  if (isSelected) return 0xfff1c8;
  if (isCurrent) return 0xfff4ce;
  if (node.trigger?.type === "area_transition") return 0xffc3a6;
  if (node.trigger?.type === "conversation") return 0xcdeef2;
  if (node.trigger?.type === "combat") return 0xffc06f;
  if (isReachable) return 0xf2efbd;
  return 0xc8d8a8;
}

function addNodeLabel(node, { isSelected, isCurrent }) {
  const label = new PIXI.Text({
    text: node.label || node.id,
    style: {
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      fontSize: isSelected || isCurrent ? 13 : 11,
      fontWeight: "700",
      fill: isSelected ? 0xfff1c8 : 0xe8eadf,
      stroke: { color: 0x030504, width: 4 },
    },
  });
  label.anchor.set(0.5, 1);
  label.x = node.x;
  label.y = node.y - 16;
  label.alpha = isSelected || isCurrent || state.navEdit ? 0.98 : 0.76;
  navLayer.addChild(label);
}

function drawDiamond(graphics, x, y, radius) {
  graphics.moveTo(x, y - radius);
  graphics.lineTo(x + radius, y);
  graphics.lineTo(x, y + radius);
  graphics.lineTo(x - radius, y);
  graphics.closePath();
}

function drawPolygon(graphics, points) {
  if (!points.length) return;
  graphics.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    graphics.lineTo(points[i][0], points[i][1]);
  }
  graphics.closePath();
}

function drawPolyline(graphics, points) {
  if (!points.length) return;
  graphics.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    graphics.lineTo(points[i][0], points[i][1]);
  }
}

function edgeKey(a, b) {
  return [a, b].sort().join(":");
}

function pathForEdge(fromId, toId) {
  const edge = navigationEdgeByKey[edgeKey(fromId, toId)];
  const path = edge?.points;
  if (!path) {
    const from = navigationNodeById[fromId];
    const to = navigationNodeById[toId];
    return from && to ? [[from.x, from.y], [to.x, to.y]] : [];
  }
  const first = path[0];
  const from = navigationNodeById[fromId];
  if (from && first && Math.hypot(first[0] - from.x, first[1] - from.y) < 1) return path;
  return [...path].reverse();
}

function sampledCurvePoints(points, samplesPerSegment = 14) {
  if (points.length <= 2) return points.map((point) => [...point]);
  const result = [];
  for (let i = 0; i < points.length - 1; i++) {
    for (let step = 0; step < samplesPerSegment; step++) {
      const t = step / samplesPerSegment;
      result.push(catmullRomPoint(points, i, t));
    }
  }
  result.push([...points[points.length - 1]]);
  return result;
}

function previewEdgePoints(edge, preview) {
  if (!edge || !preview) return edge?.points ?? [];
  const insertAt = Math.max(1, preview.segmentIndex + 1);
  const points = edge.points.map((point) => [...point]);
  points.splice(insertAt, 0, [preview.x, preview.y]);
  return points;
}

function catmullRomPoint(points, index, t) {
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

function rebuildNavigationGraph() {
  navigationNodes = navigationData.nodes.map((node) => ({ ...node, links: [] }));
  navigationNodeById = Object.fromEntries(navigationNodes.map((node) => [node.id, node]));
  navigationEdges = navigationData.edges.filter((edge) => navigationNodeById[edge.from] && navigationNodeById[edge.to]);
  navigationEdgeByKey = {};
  for (const edge of navigationEdges) {
    const from = navigationNodeById[edge.from];
    const to = navigationNodeById[edge.to];
    if (!from.links.includes(to.id)) from.links.push(to.id);
    if (!to.links.includes(from.id)) to.links.push(from.id);
    navigationEdgeByKey[edgeKey(edge.from, edge.to)] = edge;
  }
  if (!navigationNodeById[navigationData.entryNodeId]) {
    navigationData.entryNodeId = navigationNodes[0]?.id ?? "";
  }
  state.currentNodeId = navigationNodeById[state.currentNodeId] ? state.currentNodeId : navigationData.entryNodeId;
}

function toSafeId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "id";
}

function pathLength(points) {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  return length;
}

function samplePath(points, progress) {
  if (!points.length) return { x: 0, y: 0 };
  const total = pathLength(points);
  if (total <= 0) return { x: points[0][0], y: points[0][1] };
  let target = total * Math.max(0, Math.min(1, progress));
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1];
    const [bx, by] = points[i];
    const segment = Math.hypot(bx - ax, by - ay);
    if (target <= segment || i === points.length - 1) {
      const t = segment > 0 ? target / segment : 0;
      return {
        x: ax + (bx - ax) * t,
        y: ay + (by - ay) * t,
      };
    }
    target -= segment;
  }
  const last = points[points.length - 1];
  return { x: last[0], y: last[1] };
}

function pointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i][0];
    const yi = points[i][1];
    const xj = points[j][0];
    const yj = points[j][1];
    const intersects = ((yi > y) !== (yj > y)) &&
      x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-9) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function canvasPointToWorld(event) {
  const rect = app.canvas.getBoundingClientRect();
  const canvasX = (event.clientX - rect.left) * (app.screen.width / rect.width);
  const canvasY = (event.clientY - rect.top) * (app.screen.height / rect.height);
  return {
    x: Math.round((canvasX - world.x) / camera.scale),
    y: Math.round((canvasY - world.y) / camera.scale),
  };
}

function onCanvasPointerDown(event) {
  const point = canvasPointToWorld(event);
  if (currentAreaKey === AREA_KEYS.RITUAL_ROAD && state.navEdit) {
    handleNavEditPointerDown(point);
    return;
  }
  if (currentAreaKey === AREA_KEYS.RITUAL_ROAD && !state.occlusionEdit && !state.waterEdit) {
    const hitNode = nearestNode(point.x, point.y, 22);
    if (hitNode) {
      selectNavigationNode(hitNode.id);
      return;
    }
    travelToNearestReachableNode(point.x, point.y);
    return;
  }
  if (!state.occlusionEdit && !state.waterEdit) return;
  if (point.x < 0 || point.y < 0 || point.x > WORLD_W || point.y > WORLD_H) return;
  draftCollider.push([point.x, point.y]);
  renderGridOverlay();
  updateDataExport();
  const draftType = state.waterEdit ? "Water" : "Occlusion";
  setStatus(`${draftType} draft point ${draftCollider.length}: ${point.x},${point.y}. Enter closes; Backspace undoes; Escape clears.`);
}

function onCanvasPointerMove(event) {
  if (state.navEdit && state.navTool === "inflection" && !state.draggingNav) {
    const point = canvasPointToWorld(event);
    const hitEdge = nearestEdge(point.x, point.y, 54);
    state.inflectionPreview = hitEdge
      ? { edgeKey: hitEdge.edgeKey, segmentIndex: hitEdge.segmentIndex, x: point.x, y: point.y }
      : null;
    renderNavigationOverlay();
    return;
  }

  if (!state.draggingNav) return;
  const point = canvasPointToWorld(event);
  const x = Math.max(0, Math.min(WORLD_W, point.x));
  const y = Math.max(0, Math.min(WORLD_H, point.y));
  if (state.draggingNav.type === "node") {
    const node = navigationData.nodes.find((item) => item.id === state.draggingNav.nodeId);
    if (!node) return;
    node.x = x;
    node.y = y;
    for (const edge of navigationData.edges) {
      if (edge.from === node.id) edge.points[0] = [x, y];
      if (edge.to === node.id) edge.points[edge.points.length - 1] = [x, y];
    }
    updateNodeDetailsPanel();
  } else if (state.draggingNav.type === "point") {
    const edge = navigationData.edges.find((item) => edgeKey(item.from, item.to) === state.draggingNav.edgeKey);
    if (!edge) return;
    edge.points[state.draggingNav.pointIndex] = [x, y];
    state.inflectionPreview = null;
  }
  rebuildNavigationGraph();
  renderNavigationOverlay();
  updateDataExport();
}

function onCanvasPointerUp() {
  state.draggingNav = null;
}

function handleNavEditPointerDown(point) {
  if (state.navTool === "inflection") {
    const hitPoint = nearestSelectedEdgePoint(point.x, point.y, 12);
    if (hitPoint) {
      state.selectedEdgeKey = hitPoint.edgeKey;
      state.selectedPathPointIndex = hitPoint.pointIndex;
      state.selectedNodeId = null;
      state.inflectionPreview = null;
      state.draggingNav = { type: "point", edgeKey: hitPoint.edgeKey, pointIndex: hitPoint.pointIndex };
      renderNavigationOverlay();
      updateNodeDetailsPanel();
      setStatus("Inflection handle selected. Drag to shape the route; Backspace deletes; P previews.");
      return;
    }

    const hitEdge = state.inflectionPreview ?? nearestEdge(point.x, point.y, 54) ?? nearestSelectedEdge(point.x, point.y);
    if (hitEdge) {
      const edge = navigationData.edges.find((item) => edgeKey(item.from, item.to) === hitEdge.edgeKey);
      if (!edge) return;
      const insertAt = Math.max(1, hitEdge.segmentIndex + 1);
      edge.points.splice(insertAt, 0, [point.x, point.y]);
      state.selectedEdgeKey = hitEdge.edgeKey;
      state.selectedPathPointIndex = insertAt;
      state.selectedNodeId = null;
      state.inflectionPreview = null;
      state.draggingNav = { type: "point", edgeKey: hitEdge.edgeKey, pointIndex: insertAt };
      rebuildNavigationGraph();
      renderNavigationOverlay();
      updateNodeDetailsPanel();
      updateDataExport();
      setStatus("Inflection handle added to selected route.");
      return;
    }

    setStatus(navigationEdges.length
      ? "Path tool: click closer to a route to add an inflection handle."
      : "Path tool needs a route. Switch to V, place two nodes, then link them.");
    return;
  }

  if (state.navTool === "connect") {
    const hitNode = nearestNode(point.x, point.y, 24);
    if (!hitNode) {
      setStatus("Connect tool: click a node, then another node.");
      return;
    }
    if (!state.pendingConnectionNodeId) {
      state.pendingConnectionNodeId = hitNode.id;
      state.selectedNodeId = hitNode.id;
      state.selectedEdgeKey = null;
      state.selectedPathPointIndex = null;
      renderNavigationOverlay();
      updateDataExport();
      setStatus(`${hitNode.label} selected for connection. Click the destination node.`);
      return;
    }
    if (state.pendingConnectionNodeId === hitNode.id) {
      setStatus("Connect tool: choose a different destination node.");
      return;
    }
    connectNavigationNodes(state.pendingConnectionNodeId, hitNode.id);
    state.selectedEdgeKey = edgeKey(state.pendingConnectionNodeId, hitNode.id);
    state.selectedNodeId = null;
    state.pendingConnectionNodeId = null;
    state.selectedPathPointIndex = null;
    state.navTool = "inflection";
    state.inflectionPreview = midpointInflectionPreview(state.selectedEdgeKey);
    renderNavigationOverlay();
    updateNavToolControls();
    updateDataExport();
    setStatus("Route connected. Move to preview a bend, click to place it, or Escape to stop editing.");
    return;
  }

  const hitNode = nearestNode(point.x, point.y, 22);
  if (hitNode) {
    selectNavigationNode(hitNode.id);
    state.draggingNav = { type: "node", nodeId: hitNode.id };
    setStatus(`${hitNode.label}. Drag to place. Use C to connect nodes.`);
    renderNavigationOverlay();
    updateDataExport();
    return;
  }

  const node = createNavigationNode(point.x, point.y);
  state.selectedNodeId = node.id;
  state.selectedEdgeKey = null;
  state.selectedPathPointIndex = null;
  state.pendingConnectionNodeId = null;
  state.inflectionPreview = null;
  state.draggingNav = { type: "node", nodeId: node.id };
  updateNodeDetailsPanel();
  setStatus(`${node.label} added. Drag into place. Use C to connect nodes.`);
  renderNavigationOverlay();
  updateDataExport();
}

function closeDraftCollider() {
  if (draftCollider.length < 3) return;
  if (state.waterEdit) {
    waterAreas = [
      ...waterAreas,
      {
        id: `water_${waterAreas.length + 1}`,
        points: draftCollider,
      },
    ];
    draftCollider = [];
    syncCurrentAreaData();
    refreshWaterMasks();
    renderGridOverlay();
    updateDataExport();
    setStatus(`Water polygon added for ${areas[currentAreaKey].name}. Click Save map metadata.`);
    return;
  }

  occlusionAreas = [
    ...occlusionAreas,
    {
      id: `occlusion_${occlusionAreas.length + 1}`,
      points: draftCollider,
    },
  ];
  draftCollider = [];
  syncCurrentAreaData();
  renderGridOverlay();
  updateDataExport();
  renderOcclusionLayer();
  setStatus(`Occlusion region added for ${areas[currentAreaKey].name}. Click Save map metadata.`);
}

function undoDraftPoint() {
  if (!draftCollider.length) return;
  draftCollider.pop();
  renderGridOverlay();
  updateDataExport();
  setStatus(`Markup point removed. ${draftCollider.length} point(s) remain.`);
}

function clearDraftCollider() {
  if (!draftCollider.length) return;
  draftCollider = [];
  renderGridOverlay();
  updateDataExport();
  setStatus("Markup draft cleared.");
}

function resetAllOcclusion() {
  occlusionAreas = [];
  draftCollider = [];
  syncCurrentAreaData();
  renderGridOverlay();
  updateDataExport();
  renderOcclusionLayer();
  setStatus(`All occlusion regions cleared for ${areas[currentAreaKey].name}. Click Save map metadata.`);
}

function resetAllWater() {
  waterAreas = [];
  draftCollider = [];
  syncCurrentAreaData();
  refreshWaterMasks();
  renderGridOverlay();
  updateDataExport();
  setStatus(`All water information cleared for ${areas[currentAreaKey].name}. Click Save map metadata.`);
}

function resetNavigation() {
  navigationData = {
    ...navigationData,
    entryNodeId: "",
    nodes: [],
    edges: [],
    combatSpawns: Array.isArray(navigationData.combatSpawns) ? navigationData.combatSpawns : [],
    debug: navigationData.debug && typeof navigationData.debug === "object" ? navigationData.debug : {},
    extensions: navigationData.extensions && typeof navigationData.extensions === "object" ? navigationData.extensions : {},
  };
  state.selectedNodeId = null;
  state.selectedEdgeKey = null;
  state.selectedPathPointIndex = null;
  state.pendingConnectionNodeId = null;
  state.inflectionPreview = null;
  state.draggingNav = null;
  rebuildNavigationGraph();
  updatePlayerVisibility();
  updateNodeDetailsPanel();
  renderNavigationOverlay();
  updateDataExport();
  setStatus("Navigation reset. In edit nav, the first blank click places Node 1 as entry.");
}

function createNavigationNode(x, y) {
  const base = `node_${navigationData.nodes.length + 1}`;
  let id = base;
  let suffix = 2;
  while (navigationData.nodes.some((node) => node.id === id)) {
    id = `${base}_${suffix++}`;
  }
  const scale = Number(navigationData.area.defaults?.playerScale) || MAP_KIND_DEFAULT_SCALE[navigationData.area.kind] || 1;
  const node = {
    id,
    label: `Node ${navigationData.nodes.length + 1}`,
    description: "",
    discovery: {
      state: "undiscovered",
      showLabelWhenDiscovered: true,
    },
    x,
    y,
    scale,
    trigger: {
      type: "none",
      payload: {},
    },
    extensions: {},
  };
  if (!navigationData.entryNodeId) navigationData.entryNodeId = id;
  navigationData.nodes.push(node);
  rebuildNavigationGraph();
  return node;
}

function selectNavigationNode(nodeId) {
  if (!navigationNodeById[nodeId]) return;
  state.selectedNodeId = nodeId;
  state.selectedEdgeKey = null;
  state.selectedPathPointIndex = null;
  updateNodeDetailsPanel();
  renderNavigationOverlay();
  updateDataExport();
  setStatus(`${navigationNodeById[nodeId].label} selected.`);
}

function selectedNavigationNode() {
  return navigationData.nodes.find((node) => node.id === state.selectedNodeId) ?? null;
}

function updateNodeDetailsPanel() {
  if (!nodeDetailsEl) return;
  const node = selectedNavigationNode();
  const visible = Boolean(node && state.navEdit);
  nodeDetailsEl.hidden = !visible;
  if (!visible) return;
  if (nodeLabelInputEl && nodeLabelInputEl.value !== node.label) nodeLabelInputEl.value = node.label ?? "";
  if (nodeTriggerSelectEl) {
    const triggerType = node.trigger?.type ?? "none";
    if (nodeTriggerSelectEl.value !== triggerType) nodeTriggerSelectEl.value = triggerType;
  }
  if (nodeScaleInputEl && Number(nodeScaleInputEl.value) !== node.scale) nodeScaleInputEl.value = String(node.scale ?? 1);
  if (nodeDiscoveredToggleEl) nodeDiscoveredToggleEl.checked = node.discovery?.state === "discovered";
  if (nodeShowLabelToggleEl) {
    nodeShowLabelToggleEl.checked = node.discovery?.showLabelWhenDiscovered !== false;
  }
  if (nodeDescriptionInputEl && nodeDescriptionInputEl.value !== (node.description ?? "")) {
    nodeDescriptionInputEl.value = node.description ?? "";
  }
}

function updateSelectedNodeDetails() {
  const node = selectedNavigationNode();
  if (!node) return;
  node.label = nodeLabelInputEl?.value?.trim() || node.label || node.id;
  const triggerType = nodeTriggerSelectEl?.value || "none";
  node.trigger = {
    type: ["none", "conversation", "area_transition", "combat"].includes(triggerType) ? triggerType : "none",
    payload: node.trigger?.payload && typeof node.trigger.payload === "object" ? node.trigger.payload : {},
  };
  const scale = Number(nodeScaleInputEl?.value);
  if (Number.isFinite(scale) && scale > 0) node.scale = Math.max(0.25, Math.min(1.5, scale));
  node.discovery = {
    state: nodeDiscoveredToggleEl?.checked ? "discovered" : "undiscovered",
    showLabelWhenDiscovered: nodeShowLabelToggleEl?.checked !== false,
  };
  node.description = nodeDescriptionInputEl?.value ?? "";
  rebuildNavigationGraph();
  if (node.id === state.currentNodeId && playerActor) playerActor.scale.set(node.scale);
  renderNavigationOverlay();
  updateDataExport();
}

function connectNavigationNodes(fromId, toId) {
  if (navigationEdgeByKey[edgeKey(fromId, toId)]) return;
  const from = navigationNodeById[fromId];
  const to = navigationNodeById[toId];
  if (!from || !to) return;
  navigationData.edges.push({
    id: toSafeId(`${fromId}__${toId}`),
    from: fromId,
    to: toId,
    points: [[from.x, from.y], [to.x, to.y]],
    extensions: {},
  });
  rebuildNavigationGraph();
}

function nearestNode(x, y, maxDistance = Infinity) {
  return navigationNodes
    .map((node) => ({ ...node, distance: Math.hypot(node.x - x, node.y - y) }))
    .filter((node) => node.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance)[0] ?? null;
}

function nearestSelectedEdgePoint(pointX, pointY, maxDistance) {
  if (!state.selectedEdgeKey) return null;
  const edge = navigationEdgeByKey[state.selectedEdgeKey];
  if (!edge) return null;
  return edge.points
    .map((point, pointIndex) => ({
      edgeKey: state.selectedEdgeKey,
      pointIndex,
      distance: Math.hypot(point[0] - pointX, point[1] - pointY),
    }))
    .filter((hit) => hit.pointIndex > 0 && hit.pointIndex < edge.points.length - 1)
    .filter((hit) => hit.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance)[0] ?? null;
}

function nearestEdge(x, y, maxDistance) {
  let best = null;
  for (const edge of navigationEdges) {
    const curve = sampledCurvePoints(pathForEdge(edge.from, edge.to), 8);
    for (let i = 1; i < curve.length; i++) {
      const point = nearestPointOnSegment(x, y, curve[i - 1], curve[i]);
      const distance = Math.hypot(x - point.x, y - point.y);
      if (distance <= maxDistance && (!best || distance < best.distance)) {
        best = { edgeKey: edgeKey(edge.from, edge.to), segmentIndex: approximateSourceSegment(edge.points, point.x, point.y), distance };
      }
    }
  }
  return best;
}

function nearestSelectedEdge(x, y) {
  const edge = state.selectedEdgeKey ? navigationEdgeByKey[state.selectedEdgeKey] : null;
  if (!edge) return null;
  return {
    edgeKey: state.selectedEdgeKey,
    segmentIndex: approximateSourceSegment(edge.points, x, y),
    distance: 0,
  };
}

function midpointInflectionPreview(edgeKeyValue) {
  const edge = navigationEdgeByKey[edgeKeyValue];
  if (!edge || edge.points.length < 2) return null;
  const points = sampledCurvePoints(edge.points, 12);
  const midpoint = samplePath(points, 0.5);
  return {
    edgeKey: edgeKeyValue,
    segmentIndex: approximateSourceSegment(edge.points, midpoint.x, midpoint.y),
    x: Math.round(midpoint.x),
    y: Math.round(midpoint.y),
  };
}

function approximateSourceSegment(points, x, y) {
  let bestIndex = 0;
  let bestDistance = Infinity;
  for (let i = 1; i < points.length; i++) {
    const point = nearestPointOnSegment(x, y, points[i - 1], points[i]);
    const distance = Math.hypot(x - point.x, y - point.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i - 1;
    }
  }
  return bestIndex;
}

function setSelectedNodeScale(delta) {
  const node = navigationData.nodes.find((item) => item.id === state.selectedNodeId);
  if (!node) return;
  node.scale = Math.max(0.25, Math.min(1.5, Math.round((node.scale + delta) * 100) / 100));
  if (node.id === state.currentNodeId && playerActor) playerActor.scale.set(node.scale);
  rebuildNavigationGraph();
  updateNodeDetailsPanel();
  renderNavigationOverlay();
  updateDataExport();
  setStatus(`${node.label} scale ${node.scale}.`);
}

function cycleSelectedNodeRole() {
  const node = navigationData.nodes.find((item) => item.id === state.selectedNodeId);
  if (!node) return;
  const triggers = ["none", "conversation", "area_transition", "combat"];
  const current = node.trigger?.type ?? "none";
  const next = triggers[(triggers.indexOf(current) + 1) % triggers.length];
  node.trigger = {
    type: next,
    payload: node.trigger?.payload && typeof node.trigger.payload === "object" ? node.trigger.payload : {},
  };
  rebuildNavigationGraph();
  updateNodeDetailsPanel();
  renderNavigationOverlay();
  updateDataExport();
  setStatus(`${node.label} trigger ${next}.`);
}

function markSelectedNodeEntry() {
  const node = navigationData.nodes.find((item) => item.id === state.selectedNodeId);
  if (!node) return;
  navigationData.entryNodeId = node.id;
  state.currentNodeId = node.id;
  placePlayerAt({ x: node.x, y: node.y });
  rebuildNavigationGraph();
  updateNodeDetailsPanel();
  renderNavigationOverlay();
  updateDataExport();
  setStatus(`${node.label} marked entry.`);
}

function deleteSelectedNavigationItem() {
  if (state.selectedEdgeKey && state.selectedPathPointIndex !== null) {
    const edge = navigationData.edges.find((item) => edgeKey(item.from, item.to) === state.selectedEdgeKey);
    if (edge && state.selectedPathPointIndex > 0 && state.selectedPathPointIndex < edge.points.length - 1) {
      edge.points.splice(state.selectedPathPointIndex, 1);
      state.selectedPathPointIndex = null;
      rebuildNavigationGraph();
      renderNavigationOverlay();
      updateNodeDetailsPanel();
      updateDataExport();
      setStatus("Bend point deleted.");
    }
    return;
  }

  if (state.selectedEdgeKey) {
    navigationData.edges = navigationData.edges.filter((item) => edgeKey(item.from, item.to) !== state.selectedEdgeKey);
    state.selectedEdgeKey = null;
    rebuildNavigationGraph();
    renderNavigationOverlay();
    updateNodeDetailsPanel();
    updateDataExport();
    setStatus("Edge deleted.");
    return;
  }

  if (state.selectedNodeId && state.selectedNodeId !== navigationData.entryNodeId) {
    const id = state.selectedNodeId;
    navigationData.nodes = navigationData.nodes.filter((node) => node.id !== id);
    navigationData.edges = navigationData.edges.filter((edge) => edge.from !== id && edge.to !== id);
    state.selectedNodeId = null;
    rebuildNavigationGraph();
    if (!navigationNodeById[state.currentNodeId]) placePlayerAt(entryNodePosition());
    renderNavigationOverlay();
    updateNodeDetailsPanel();
    updateDataExport();
    setStatus("Node deleted.");
  }
}

async function postMapMetadata(url, data) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
  return payload;
}

async function saveMapImage() {
  const distributionName = updateDistributionName();
  const extension = droppedMapFileName.includes(".") ? droppedMapFileName.slice(droppedMapFileName.lastIndexOf(".")) : ".png";
  const fileName = `${distributionName}${extension.toLowerCase()}`;
  const response = await fetch(`/api/visual-spike/map-image?name=${encodeURIComponent(fileName)}`, {
    method: "POST",
    headers: { "Content-Type": droppedMapFile.type || "application/octet-stream" },
    body: droppedMapFile,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
  return payload;
}

async function saveMapMetadata() {
  if (!areas[AREA_KEYS.RITUAL_ROAD].texture || !droppedMapFile) {
    setStatus("Add a map image before saving.");
    return;
  }
  if (!areaNameInputEl?.value?.trim()) {
    setStatus("Add an area name before saving.");
    return;
  }
  if (!mapKindSelectEl?.value) {
    setStatus("Choose a map mode before saving.");
    return;
  }
  if (!actNumberSelectEl?.value) {
    setStatus("Choose an act number before saving.");
    return;
  }
  syncCurrentAreaData();
  updateNavigationAreaMetadata();
  metadataSaveButtonEl.disabled = true;
  setStatus("Saving map metadata…");
  try {
    await Promise.all([
      saveMapImage(),
      postMapMetadata(
        `/api/visual-spike/map-metadata?name=${encodeURIComponent(updateDistributionName())}`,
        {
          schemaVersion: 1,
          id: updateDistributionName(),
          act: Number(actNumberSelectEl.value),
          mode: mapKindSelectEl.value,
          background: navigationData.area.background,
          navigation: navigationData,
          occlusion: occlusionAreas,
          water: waterAreas,
        }
      ),
    ]);
    setNavEdit(false);
    setOcclusionEdit(false, { silent: true });
    setWaterEdit(false, { silent: true });
    hasUnsavedChanges = false;
    setStatus("Map metadata saved: navigation, occlusion and water.");
  } catch (err) {
    console.warn("[visual_spike] Map metadata save failed", err);
    setStatus(`Map metadata save failed: ${err.message}. Start the authoring server with npm run map:author.`);
  } finally {
    metadataSaveButtonEl.disabled = false;
  }
}

function setNavEdit(enabled) {
  state.navEdit = enabled;
  if (enabled) {
    setOcclusionEdit(false, { silent: true });
    setWaterEdit(false, { silent: true });
  } else {
    state.selectedEdgeKey = null;
    state.selectedPathPointIndex = null;
    state.pendingConnectionNodeId = null;
    state.inflectionPreview = null;
    state.draggingNav = null;
    if (currentAreaKey === AREA_KEYS.RITUAL_ROAD && navigationNodes.length) placePlayerAt(entryNodePosition());
  }
  if (navEditToggleEl) navEditToggleEl.checked = enabled;
  app.canvas.style.cursor = enabled ? "crosshair" : "";
  updatePlayerVisibility();
  updateNodeDetailsPanel();
  renderNavigationOverlay();
  updateDataExport();
  setStatus(enabled
    ? "Nav edit: V places nodes; C connects nodes; B shapes route inflections."
    : "Nav edit off.");
}

function setNavTool(tool) {
  state.navTool = ["connect", "inflection"].includes(tool) ? tool : "node";
  if (!state.navEdit) setNavEdit(true);
  state.selectedPathPointIndex = null;
  state.inflectionPreview = null;
  if (state.navTool !== "connect") state.pendingConnectionNodeId = null;
  state.draggingNav = null;
  updateNavToolControls();
  renderNavigationOverlay();
  setStatus(navToolStatus());
}

function updateNavToolControls() {
  if (navNodeToolEl) navNodeToolEl.setAttribute("aria-pressed", state.navTool === "node" ? "true" : "false");
  if (navConnectToolEl) navConnectToolEl.setAttribute("aria-pressed", state.navTool === "connect" ? "true" : "false");
  if (navInflectionToolEl) navInflectionToolEl.setAttribute("aria-pressed", state.navTool === "inflection" ? "true" : "false");
}

function navToolStatus() {
  if (state.navTool === "connect") return "Connect tool. Click a source node, then a destination node.";
  if (state.navTool === "inflection") return "Inflection tool. Hover a route to preview a bend; click to commit it.";
  return "Node tool. Click blank map to place nodes; drag nodes to move them.";
}

function updateNavigationAreaMetadata() {
  const name = areaNameInputEl?.value?.trim() || navigationData.area.name || "Area";
  const kind = mapKindSelectEl?.value || navigationData.area.kind || "";
  const distributionName = updateDistributionName();
  const extension = droppedMapFileName.includes(".") ? droppedMapFileName.slice(droppedMapFileName.lastIndexOf(".")) : ".png";
  const background = distributionName ? `./assets/map_backgrounds/${distributionName}${extension.toLowerCase()}` : "";
  const previousKind = navigationData.area.kind;
  navigationData.area.name = name;
  navigationData.area.id = toSafeId(name);
  navigationData.area.kind = kind;
  navigationData.area.background = background;
  if (previousKind !== kind || !Number.isFinite(Number(navigationData.area.defaults?.playerScale))) {
    navigationData.area.defaults = {
      ...(navigationData.area.defaults ?? {}),
      playerScale: MAP_KIND_DEFAULT_SCALE[kind] ?? 1,
    };
  }
  areas[AREA_KEYS.RITUAL_ROAD].name = name;
  areas[AREA_KEYS.RITUAL_ROAD].playerScale = Number(navigationData.area.defaults.playerScale) || 1;
  updateDataExport();
}

function syncNavigationControls() {
  if (areaNameInputEl) areaNameInputEl.value = navigationData.area.name;
  if (mapKindSelectEl) mapKindSelectEl.value = navigationData.area.kind;
  updateDistributionName();
}

function setOcclusionEdit(enabled, options = {}) {
  state.occlusionEdit = enabled;
  if (enabled) {
    setWaterEdit(false, { silent: true });
    setNavEdit(false);
  }
  if (occlusionEditToggleEl) occlusionEditToggleEl.checked = enabled;
  syncGridOverlayVisibility();
  renderGridOverlay();
  app.canvas.style.cursor = enabled ? "crosshair" : "";
  if (!options.silent) {
    setStatus(enabled
      ? "Occlusion edit: outline foreground regions that should pass in front of the player. Enter closes; Backspace undoes; Escape clears."
      : "Occlusion edit off.");
  }
}

function setWaterEdit(enabled, options = {}) {
  state.waterEdit = enabled;
  if (enabled) {
    setOcclusionEdit(false, { silent: true });
    setNavEdit(false);
  }
  if (waterEditToggleEl) waterEditToggleEl.checked = enabled;
  syncGridOverlayVisibility();
  renderGridOverlay();
  app.canvas.style.cursor = enabled ? "crosshair" : "";
  if (!options.silent) {
    setStatus(enabled
      ? "Water edit: click polygon points. Enter closes; Backspace undoes; Escape clears."
      : "Water edit off.");
  }
}

function updateDataExport() {
  if (!isHydratingArea) hasUnsavedChanges = true;
  if (!dataExportEl) return;
  updateNavigationAreaMetadataFromControlsOnly();
  dataExportEl.value = JSON.stringify({
    navigation: navigationData,
    occlusion: occlusionAreas,
    water: waterAreas,
  }, null, 0);
}

function updateNavigationAreaMetadataFromControlsOnly() {
  if (areaNameInputEl?.value?.trim()) {
    navigationData.area.name = areaNameInputEl.value.trim();
    navigationData.area.id = toSafeId(navigationData.area.name);
  }
  if (mapKindSelectEl?.value) navigationData.area.kind = mapKindSelectEl.value;
  const distributionName = updateDistributionName();
  const extension = droppedMapFileName.includes(".") ? droppedMapFileName.slice(droppedMapFileName.lastIndexOf(".")) : ".png";
  navigationData.area.background = distributionName ? `./assets/map_backgrounds/${distributionName}${extension.toLowerCase()}` : "";
}

function syncCurrentAreaData() {
  if (!areas[currentAreaKey]) return;
  areas[currentAreaKey].water = cloneAreas(waterAreas);
}

function createPlayer(textures) {
  playerActor = new PIXI.Container();
  const anchors = SWORD_FOOT_ANCHORS;

  const marker = new PIXI.Graphics();
  marker.beginFill(0x020202, 0.28);
  marker.drawEllipse(0, -1, 31, 8);
  marker.endFill();
  marker.beginFill(0x3a2f25, 0.12);
  marker.drawEllipse(3, -2, 42, 12);
  marker.endFill();
  marker.zIndex = -1;
  playerActor.addChild(marker);

  const sprite = new PIXI.Sprite(textures[0]);
  sprite.anchor.set(anchors[0].x, anchors[0].y);
  const height = 122;
  sprite.scale.set(height / textures[0].height);
  sprite.alpha = 1;
  applyActorColorGrade(sprite);
  playerActor.addChild(sprite);

  const rimSprite = new PIXI.Sprite(textures[0]);
  rimSprite.anchor.set(anchors[0].x, anchors[0].y);
  rimSprite.scale.set(height / textures[0].height);
  rimSprite.tint = 0xc1a06f;
  rimSprite.alpha = 0.22;
  rimSprite.blendMode = "screen";
  rimSprite.x = -2;
  rimSprite.y = -1;
  playerActor.addChild(rimSprite);

  const ghostSprite = new PIXI.Sprite(textures[0]);
  ghostSprite.anchor.set(anchors[0].x, anchors[0].y);
  ghostSprite.scale.set(height / textures[0].height);
  ghostSprite.alpha = 0;
  applyActorColorGrade(ghostSprite);
  playerActor.addChild(ghostSprite);

  const lanterna = createLanternaGlow();
  playerActor.addChild(lanterna);

  playerActor.sortableChildren = true;
  playerActor.parts = {
    lanterna,
    sprite,
    rimSprite,
    ghostSprite,
    marker,
    frames: textures,
    anchors,
    frameIndex: 0,
    baseHeight: height,
  };

  Object.assign(playerActor, state.player);
  updateActorDepth(playerActor);
  actorLayer.addChild(playerActor);
}

function createNpc(texture) {
  npcActor = new PIXI.Container();
  const marker = new PIXI.Graphics();
  marker.beginFill(0x020202, 0.26);
  marker.drawEllipse(0, -1, 28, 7);
  marker.endFill();
  marker.zIndex = -1;
  npcActor.addChild(marker);

  const sprite = new PIXI.Sprite(texture);
  sprite.anchor.set(0.5, 1);
  const height = 116;
  sprite.scale.set(height / texture.height);
  applyActorColorGrade(sprite);
  npcActor.addChild(sprite);

  const rimSprite = new PIXI.Sprite(texture);
  rimSprite.anchor.set(0.5, 1);
  rimSprite.scale.set(height / texture.height);
  rimSprite.tint = 0xb39062;
  rimSprite.alpha = 0.16;
  rimSprite.blendMode = "screen";
  rimSprite.x = -2;
  rimSprite.y = -1;
  npcActor.addChild(rimSprite);

  npcActor.sortableChildren = true;
  npcActor.parts = { sprite, rimSprite, marker };
  npcActor.gridPosition = NPC_POSITION;
  Object.assign(npcActor, tileCenter(NPC_POSITION.x, NPC_POSITION.y));
  updateActorDepth(npcActor);
  actorLayer.addChild(npcActor);
  npcActors = [{ actor: npcActor, position: NPC_POSITION, area: AREA_KEYS.SHRINE }];
}

function createHostile(texture) {
  const hostileActor = new PIXI.Container();
  hostileActor.visible = false;

  const marker = new PIXI.Graphics();
  marker.beginFill(0x160303, 0.38);
  marker.drawEllipse(0, -1, 30, 8);
  marker.endFill();
  marker.zIndex = -1;
  hostileActor.addChild(marker);

  const redGlow = new PIXI.Sprite(createHostileGlowTexture());
  redGlow.anchor.set(0.5);
  redGlow.y = -58;
  redGlow.alpha = 0.34;
  redGlow.blendMode = "screen";
  hostileActor.addChild(redGlow);

  const sprite = new PIXI.Sprite(texture);
  sprite.anchor.set(0.5, 1);
  const height = 118;
  sprite.scale.set(height / texture.height);
  applyActorColorGrade(sprite);
  sprite.tint = 0x9a746d;
  hostileActor.addChild(sprite);

  const rimSprite = new PIXI.Sprite(texture);
  rimSprite.anchor.set(0.5, 1);
  rimSprite.scale.set(height / texture.height);
  rimSprite.tint = 0xaa2b2b;
  rimSprite.alpha = 0.32;
  rimSprite.blendMode = "screen";
  rimSprite.x = -2;
  rimSprite.y = -1;
  hostileActor.addChild(rimSprite);

  hostileActor.sortableChildren = true;
  hostileActor.parts = { sprite, rimSprite, marker, redGlow };
  hostileActor.gridPosition = HOSTILE_POSITION;
  Object.assign(hostileActor, tileCenter(HOSTILE_POSITION.x, HOSTILE_POSITION.y));
  updateActorDepth(hostileActor);
  actorLayer.addChild(hostileActor);
  hostileActors = [{ actor: hostileActor, position: HOSTILE_POSITION, area: AREA_KEYS.SHRINE }];
}

function updateActorDepth(actor) {
  if (actor) actor.zIndex = actor.y;
}

function applyActorColorGrade(sprite) {
  const grade = new PIXI.ColorMatrixFilter();
  grade.saturate(-0.42, false);
  grade.contrast(-0.08, true);
  grade.brightness(0.82, true);
  sprite.filters = [grade];
  sprite.tint = 0xad9678;
}

function createLanternaGlow() {
  const glow = new PIXI.Container();
  glow.x = LANTERNA_OFFSET.x;
  glow.y = LANTERNA_OFFSET.y;
  glow.blendMode = "screen";

  const halo = new PIXI.Sprite(createLanternaGlowTexture({
    size: 430,
    seed: 41,
    color: LANTERNA_COLOR,
    alpha: 108,
    stretchX: 0.9,
    stretchY: 1.25,
    coreBias: 0.12,
  }));
  halo.anchor.set(0.5);
  halo.alpha = 0.56;
  glow.addChild(halo);

  const bloom = new PIXI.Sprite(createLanternaGlowTexture({
    size: 168,
    seed: 117,
    color: LANTERNA_CORE,
    alpha: 148,
    stretchX: 1.04,
    stretchY: 1.18,
    coreBias: 0.42,
  }));
  bloom.anchor.set(0.5);
  bloom.alpha = 0.56;
  glow.addChild(bloom);

  const source = new PIXI.Sprite(createLampSourceTexture());
  source.anchor.set(0.5);
  source.alpha = 0.8;
  glow.addChild(source);

  glow.parts = { halo, bloom, source };
  return glow;
}

function createHostileGlowTexture() {
  const size = 164;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,64,40,0.52)");
  gradient.addColorStop(0.28, "rgba(190,18,20,0.2)");
  gradient.addColorStop(0.72, "rgba(110,0,8,0.06)");
  gradient.addColorStop(1, "rgba(110,0,8,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return PIXI.Texture.from(canvas);
}

function updateLanternaGlow(actor) {
  if (!actor?.parts?.lanterna) return;
  actor.parts.lanterna.alpha = currentAreaKey === AREA_KEYS.RITUAL_ROAD ? 0 : 0.78;
}

function createLanternaGlowTexture({ size, seed, color, alpha, stretchX, stretchY, coreBias }) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(size, size);
  const data = image.data;
  const center = size / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x - center) / center;
      const ny = (y - center) / center;
      const radius = Math.hypot(nx / stretchX, ny / stretchY);
      const falloff = Math.pow(Math.max(0, 1 - radius), 2.7);
      const cloudy =
        0.42 +
        valueNoise(nx * 1.2 + 2.3, ny * 1.2 - 5.7, seed) * 0.28 +
        valueNoise(nx * 3.4 - 4.1, ny * 3.4 + 1.8, seed + 29) * 0.2 +
        valueNoise(nx * 8.0 + 6.6, ny * 8.0 - 2.2, seed + 71) * 0.1;
      const verticalVeil = smoothstep(1.15, -0.25, Math.abs(nx * 0.72) + Math.max(0, ny) * 0.2);
      const hotCenter = Math.pow(Math.max(0, 1 - Math.hypot(nx * 2.9, ny * 3.7)), 2.2);
      const mist = Math.max(0, Math.min(1, falloff * cloudy * verticalVeil + hotCenter * coreBias));
      const i = (y * size + x) * 4;
      data[i] = color.r;
      data[i + 1] = color.g;
      data[i + 2] = color.b;
      data[i + 3] = Math.round(mist * alpha);
    }
  }

  ctx.putImageData(image, 0, 0);
  softenCanvas(ctx, size, size, coreBias > 0.2 ? 2 : 5);
  return PIXI.Texture.from(canvas);
}

function createLampSourceTexture() {
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(16, 15, 1, 16, 15, 15);
  gradient.addColorStop(0, "rgba(244,241,226,0.9)");
  gradient.addColorStop(0.22, "rgba(225,230,222,0.58)");
  gradient.addColorStop(0.48, "rgba(158,180,184,0.18)");
  gradient.addColorStop(1, "rgba(158,180,184,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return PIXI.Texture.from(canvas);
}

function softenCanvas(ctx, width, height, passes) {
  for (let pass = 0; pass < passes; pass++) {
    const image = ctx.getImageData(0, 0, width, height);
    const src = image.data;
    const out = new Uint8ClampedArray(src);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = (y * width + x) * 4;
        for (let c = 0; c < 4; c++) {
          out[i + c] = (
            src[i + c] * 4 +
            src[i - 4 + c] * 2 +
            src[i + 4 + c] * 2 +
            src[i - width * 4 + c] * 2 +
            src[i + width * 4 + c] * 2 +
            src[i - width * 4 - 4 + c] +
            src[i - width * 4 + 4 + c] +
            src[i + width * 4 - 4 + c] +
            src[i + width * 4 + 4 + c]
          ) / 16;
        }
      }
    }

    image.data.set(out);
    ctx.putImageData(image, 0, 0);
  }
}

function smoothstep(edge0, edge1, value) {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function valueNoise(x, y, seed) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0;
  const ty = y - y0;
  const a = hashNoise(x0, y0, seed);
  const b = hashNoise(x0 + 1, y0, seed);
  const c = hashNoise(x0, y0 + 1, seed);
  const d = hashNoise(x0 + 1, y0 + 1, seed);
  const ux = tx * tx * (3 - 2 * tx);
  const uy = ty * ty * (3 - 2 * ty);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy);
}

function hashNoise(x, y, seed) {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function setActorFrame(actor, frameIndex, options = {}) {
  const frames = actor.parts.frames;
  const anchors = actor.parts.anchors;
  const next = frameIndex % frames.length;
  if (actor.parts.frameIndex === next) return;
  const previous = actor.parts.frameIndex;
  if (options.crossfade && previous >= 0) {
    actor.parts.ghostSprite.texture = frames[previous];
    actor.parts.ghostSprite.anchor.set(anchors[previous].x, anchors[previous].y);
    actor.parts.ghostSprite.scale.set(actor.parts.baseHeight / frames[previous].height);
    actor.parts.ghostSprite.alpha = 0.12;
    tweens.add(120, (t) => {
      actor.parts.ghostSprite.alpha = 0.12 * (1 - easeInOutSine(t));
    }, () => {
      actor.parts.ghostSprite.alpha = 0;
    });
  }
  actor.parts.frameIndex = next;
  actor.parts.sprite.texture = frames[next];
  actor.parts.sprite.anchor.set(anchors[next].x, anchors[next].y);
  actor.parts.sprite.scale.set(actor.parts.baseHeight / frames[next].height);
  actor.parts.rimSprite.texture = frames[next];
  actor.parts.rimSprite.anchor.set(anchors[next].x, anchors[next].y);
  actor.parts.rimSprite.scale.set(actor.parts.baseHeight / frames[next].height);
}

function travelToNearestReachableNode(x, y) {
  const current = navigationNodeById[state.currentNodeId];
  if (!current || state.moving || state.acting || state.downed) return;
  const nearest = current.links
    .map((id) => navigationNodeById[id])
    .filter(Boolean)
    .map((node) => ({ node, distance: Math.hypot(node.x - x, node.y - y) }))
    .sort((a, b) => a.distance - b.distance)[0];
  if (!nearest || nearest.distance > 84) return;
  travelToNode(nearest.node.id);
}

function travelToDirectionalNode(dx, dy) {
  const current = navigationNodeById[state.currentNodeId];
  if (!current || state.moving || state.acting || state.downed) return;
  const length = Math.hypot(dx, dy) || 1;
  const dirX = dx / length;
  const dirY = dy / length;
  const best = current.links
    .map((id) => navigationNodeById[id])
    .filter(Boolean)
    .map((node) => {
      const nodeDx = node.x - current.x;
      const nodeDy = node.y - current.y;
      const nodeLength = Math.hypot(nodeDx, nodeDy) || 1;
      return {
        node,
        score: dirX * (nodeDx / nodeLength) + dirY * (nodeDy / nodeLength),
      };
    })
    .sort((a, b) => b.score - a.score)[0];
  if (!best || best.score < 0.15) return;
  travelToNode(best.node.id);
}

function travelToNode(nodeId) {
  const from = navigationNodeById[state.currentNodeId];
  const to = navigationNodeById[nodeId];
  if (!from || !to || !from.links.includes(nodeId) || !playerActor) return;
  clearMovementInput();
  state.moving = true;
  const path = sampledCurvePoints(pathForEdge(from.id, to.id));
  const distance = pathLength(path);
  const fromScale = from.scale ?? areas[currentAreaKey]?.playerScale ?? 1;
  const toScale = to.scale ?? fromScale;
  const duration = Math.max(520, Math.min(1800, distance * 5.4));
  setStatus(`Travelling to ${to.label}.`);
  tweens.add(duration, (t) => {
    const k = easeInOutSine(t);
    const point = samplePath(path, k);
    const x = point.x;
    const y = point.y;
    const scale = fromScale + (toScale - fromScale) * k;
    state.player.x = x;
    state.player.y = y;
    playerActor.x = x;
    playerActor.y = y;
    playerActor.scale.set(scale);
    updateActorDepth(playerActor);
  }, () => {
    state.currentNodeId = to.id;
    revealNode(to.id);
    state.player.x = to.x;
    state.player.y = to.y;
    playerActor.x = to.x;
    playerActor.y = to.y;
    playerActor.scale.set(toScale);
    state.moving = false;
    updateActorDepth(playerActor);
    renderNavigationOverlay();
    setStatus(`${to.label}. Click a connected node, or use arrows/WASD to travel.`);
  });
}

function previewSelectedEdge() {
  const edge = state.selectedEdgeKey ? navigationEdgeByKey[state.selectedEdgeKey] : null;
  if (!edge) {
    setStatus("Select an edge first, then press P to preview it.");
    return;
  }
  const current = navigationNodeById[state.currentNodeId];
  const nextId = current?.id === edge.to ? edge.from : edge.to;
  if (!current || (current.id !== edge.from && current.id !== edge.to)) {
    state.currentNodeId = edge.from;
    const from = navigationNodeById[edge.from];
    if (from) placePlayerAt({ x: from.x, y: from.y });
  }
  travelToNode(nextId);
}

function moveHeldPlayer(deltaMS) {
  if (currentAreaKey === AREA_KEYS.RITUAL_ROAD) return;
  if (!playerActor || state.acting || state.downed || state.conversing || state.occlusionEdit || state.waterEdit) return;
  let dx = 0;
  let dy = 0;
  if (state.input.has("arrowleft") || state.input.has("a")) dx -= 1;
  if (state.input.has("arrowright") || state.input.has("d")) dx += 1;
  if (state.input.has("arrowup") || state.input.has("w")) dy -= 1;
  if (state.input.has("arrowdown") || state.input.has("s")) dy += 1;
  if (!dx && !dy) {
    state.moving = false;
    return;
  }

  const length = Math.hypot(dx, dy) || 1;
  const speed = currentAreaKey === AREA_KEYS.RITUAL_ROAD ? 150 : 220;
  const distance = speed * Math.min(deltaMS, 50) / 1000;
  const vx = (dx / length) * distance;
  const vy = (dy / length) * distance;
  const transition = getAreaTransition(vx, vy);
  if (transition) {
    state.input.clear();
    transitionToArea(transition);
    return;
  }

  let nextX = state.player.x;
  let nextY = state.player.y;
  if (!isBlocked(nextX + vx, nextY)) nextX += vx;
  if (!isBlocked(nextX, nextY + vy)) nextY += vy;
  if (nextX === state.player.x && nextY === state.player.y) return;

  state.player.x = nextX;
  state.player.y = nextY;
  state.moving = true;
  playerActor.x = nextX;
  playerActor.y = nextY;
  updateActorDepth(playerActor);

  if (currentAreaKey !== AREA_KEYS.RITUAL_ROAD) updateFreeMoveAnimation(dx, dy);
  if (elapsedMS - state.lastMoveStatusMS > 350) {
    state.lastMoveStatusMS = elapsedMS;
    setStatus(`${areas[currentAreaKey].name}.`);
  }
}

function updateFreeMoveAnimation(dx, dy) {
  const framePair = dx > 0 ? [0, 1] : [1, 2];
  const nextFrame = framePair[Math.floor(elapsedMS / 260) % framePair.length];
  state.currentFrame = nextFrame;
  setActorFrame(playerActor, nextFrame);
  const sway = Math.sin(elapsedMS / 90) * 0.35;
  setActorSpritePose(playerActor, dx * sway, -Math.abs(sway) * 0.2, dx * 0.003 + dy * 0.001);
}

function getAreaTransition(dx, dy) {
  if (currentAreaKey === AREA_KEYS.SHRINE && dx > 0 && state.player.x > WORLD_W - 8 && state.player.y >= 4 * CELL) {
    return { area: AREA_KEYS.DOCK, spawn: { x: 18, y: state.player.y } };
  }
  if (currentAreaKey === AREA_KEYS.DOCK && dx < 0 && state.player.x < 8 && state.player.y >= 4 * CELL) {
    return { area: AREA_KEYS.SHRINE, spawn: { x: WORLD_W - 18, y: state.player.y }, spawnHostile: true };
  }
  return null;
}

function transitionToArea(transition) {
  if (!transition?.area || !areas[transition.area]) return;
  state.moving = true;
  const fromAlpha = world.alpha;
  tweens.add(180, (t) => {
    world.alpha = fromAlpha * (1 - easeInOutSine(t));
  }, () => {
    applyArea(transition.area);
    if (transition.spawnHostile) revealHostile();
    placePlayerAt(transition.spawn);
    resize();
    world.alpha = 0;
    tweens.add(240, (t) => {
      world.alpha = easeInOutSine(t);
    }, () => {
      world.alpha = 1;
      state.moving = false;
      setStatus(`${areas[currentAreaKey].name}.`);
    });
  });
}

function applyArea(areaKey) {
  currentAreaKey = areaKey;
  const area = areas[currentAreaKey];
  waterAreas = cloneAreas(area.water);
  staticLights = area.staticLights;
  waterReflectionDefs = area.waterReflections;
  activeNpcActor = null;
  if (npcActor) npcActor.visible = currentAreaKey === AREA_KEYS.SHRINE;
  for (const { actor, area } of hostileActors) {
    actor.visible = state.hostileSpawned && area === currentAreaKey;
  }
  applyPlayerAreaScale();
  drawBackground(area.texture);
  createWaterReflections();
  createLanternaWaterReflection();
  updatePlayerVisibility();
  renderNavigationOverlay();
  renderGridOverlay();
  updateDataExport();
}

function updatePlayerVisibility() {
  if (!playerActor) return;
  playerActor.visible = !(currentAreaKey === AREA_KEYS.RITUAL_ROAD && (state.navEdit || navigationNodes.length === 0));
}

function revealHostile() {
  state.hostileSpawned = true;
  for (const { actor, area } of hostileActors) {
    actor.visible = area === currentAreaKey;
  }
}

function placePlayerAt(position) {
  state.player.x = position.x;
  state.player.y = position.y;
  if (currentAreaKey === AREA_KEYS.RITUAL_ROAD) {
    const nearestNode = navigationNodes
      .map((node) => ({ node, distance: Math.hypot(node.x - position.x, node.y - position.y) }))
      .sort((a, b) => a.distance - b.distance)[0]?.node;
    state.currentNodeId = nearestNode?.id ?? navigationData.entryNodeId;
    revealNode(state.currentNodeId);
  }
  state.currentFrame = 1;
  if (!playerActor) {
    renderNavigationOverlay();
    return;
  }
  Object.assign(playerActor, position);
  applyPlayerAreaScale();
  if (currentAreaKey === AREA_KEYS.RITUAL_ROAD) {
    const node = navigationNodeById[state.currentNodeId];
    playerActor.scale.set(node?.scale ?? areas[currentAreaKey]?.playerScale ?? 1);
  }
  resetActorPose(playerActor);
  setActorFrame(playerActor, 1);
  updateActorDepth(playerActor);
  renderNavigationOverlay();
}

function revealNode(nodeId) {
  if (!nodeId || !navigationNodeById[nodeId]) return;
  discoveredNodeIds.add(nodeId);
}

function entryNodePosition() {
  const entry = navigationNodeById[navigationData.entryNodeId] ?? navigationNodes[0];
  return entry ? { x: entry.x, y: entry.y } : AREA_SPAWNS[AREA_KEYS.RITUAL_ROAD];
}

function applyPlayerAreaScale() {
  if (!playerActor) return;
  const scale = areas[currentAreaKey]?.playerScale ?? 1;
  playerActor.scale.set(scale);
}

function trySwordAttack() {
  if (state.moving || state.acting || state.downed) return;
  state.acting = true;
  const sequence = [
    { frame: 1, at: 0, label: "guard" },
    { frame: 3, at: 180, label: "windup" },
    { frame: 4, at: 440, label: "strike" },
    { frame: 5, at: 700, label: "followthrough" },
    { frame: 3, at: 960, label: "recovery" },
    { frame: 1, at: 1220, label: "guard" },
  ];
  for (const item of sequence) {
    tweens.add(item.at, () => {}, () => {
      setActorFrame(playerActor, item.frame);
      applySwordStagePose(playerActor, item.label);
    });
  }
  tweens.add(1380, () => {}, () => {
    resetActorPose(playerActor);
    state.acting = false;
    state.currentFrame = 1;
    setStatus(`Sword attack; position ${state.player.x},${state.player.y}`);
  });
}

function resetToGuard() {
  if (!playerActor) return;
  state.moving = false;
  state.acting = false;
  state.downed = false;
  state.currentFrame = 1;
  resetActorPose(playerActor);
  setActorFrame(playerActor, 1);
  setStatus(`Reset to guard; position ${Math.round(state.player.x)},${Math.round(state.player.y)}`);
}

function tryStartConversation() {
  if (state.moving || state.acting || state.downed || state.occlusionEdit || state.waterEdit || state.conversing) return;
  if (!playerActor) return;
  activeNpcActor = getAdjacentNpcActor();
  if (!activeNpcActor) return;

  state.conversing = true;
  state.conversationLine = 0;
  showConversationLine();
  focusConversationCamera();
}

function getAdjacentNpcActor() {
  const adjacentNpc = npcActors.find(({ actor, area, position }) =>
    actor.visible &&
    area === currentAreaKey &&
    Math.hypot(state.player.x - actor.x, state.player.y - actor.y) <= 116
  );
  return adjacentNpc?.actor ?? null;
}

function showConversationLine() {
  const line = CONVERSATION_LINES[state.conversationLine];
  if (!conversationPanelEl || !line) return;
  conversationPanelEl.hidden = false;
  conversationSpeakerEl.textContent = line.speaker;
  conversationTextEl.textContent = line.text;
  renderConversationReplies(line);
  updateConversationPanelPosition();
}

function renderConversationReplies(line) {
  if (!conversationRepliesEl) return;
  conversationRepliesEl.textContent = "";
  const replies = line.replies?.length ? line.replies : ["Continue."];
  replies.forEach((reply, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "conversation-reply";
    button.innerHTML = `<span class="conversation-reply-number">${index + 1}.</span> ${reply}`;
    button.addEventListener("click", () => selectConversationReply(index));
    conversationRepliesEl.appendChild(button);
  });
}

function selectConversationReply(index) {
  if (!state.conversing) return;
  const line = CONVERSATION_LINES[state.conversationLine];
  const reply = line?.replies?.[index] || "";
  if (/leave|end/i.test(reply)) {
    endConversation();
    return;
  }
  advanceConversation();
}

function advanceConversation() {
  if (!state.conversing) return;
  state.conversationLine += 1;
  if (state.conversationLine >= CONVERSATION_LINES.length) {
    endConversation();
    return;
  }
  showConversationLine();
}

function endConversation() {
  if (!state.conversing) return;
  state.conversing = false;
  state.conversationLine = 0;
  activeNpcActor = null;
  if (conversationPanelEl) conversationPanelEl.hidden = true;
  focusFreeCamera();
  setStatus(`Conversation ended; position ${state.player.x},${state.player.y}`);
}

function focusConversationCamera() {
  const focusNpc = activeNpcActor ?? npcActor;
  if (!playerActor || !focusNpc) return;
  camera.mode = "conversation";
  const centerX = (playerActor.x + focusNpc.x) / 2;
  const centerY = (playerActor.y + focusNpc.y) / 2 - 28;
  const targetScale = Math.min(camera.baseScale * 1.75, 1.45);
  tweenCameraTo(centerX, centerY, targetScale, 520);
}

function focusFreeCamera() {
  camera.mode = "free";
  tweenCameraTo(WORLD_W / 2, WORLD_H / 2, camera.baseScale, 420);
}

function tweenCameraTo(centerX, centerY, scale, duration) {
  const from = { x: world.x, y: world.y, scale: world.scale.x };
  const target = cameraTransformFor(centerX, centerY, scale, camera.mode === "conversation" ? 0.44 : 0.5);
  tweens.add(duration, (t) => {
    const k = easeInOutSine(t);
    camera.scale = from.scale + (scale - from.scale) * k;
    world.scale.set(camera.scale);
    world.x = from.x + (target.x - from.x) * k;
    world.y = from.y + (target.y - from.y) * k;
    updateConversationPanelPosition();
  }, () => {
    camera.scale = scale;
    world.scale.set(scale);
    world.x = target.x;
    world.y = target.y;
    updateConversationPanelPosition();
  });
}

function cameraTransformFor(centerX, centerY, scale, screenXRatio) {
  return {
    x: app.screen.width * screenXRatio - centerX * scale,
    y: app.screen.height * 0.48 - centerY * scale,
  };
}

function updateConversationPanelPosition() {
  const focusNpc = activeNpcActor ?? npcActor;
  if (!state.conversing || !conversationPanelEl || !playerActor || !focusNpc) return;
  const rightMost = Math.max(playerActor.x, focusNpc.x);
  const midY = (playerActor.y + focusNpc.y) / 2 - 60;
  const screenX = world.x + rightMost * world.scale.x + 62;
  const panelHeight = conversationPanelEl.offsetHeight || 136;
  const screenY = world.y + midY * world.scale.y - panelHeight / 2;
  const maxLeft = Math.max(16, app.screen.width - 292);
  conversationPanelEl.style.left = `${Math.max(16, Math.min(maxLeft, screenX))}px`;
  conversationPanelEl.style.top = `${Math.max(68, Math.min(app.screen.height - 190, screenY))}px`;
}

function applySwordStagePose(actor, label) {
  const poses = {
    guard: { x: 0, y: 0, rotation: 0 },
    windup: { x: -2, y: -0.5, rotation: -0.012 },
    strike: { x: 5, y: -0.8, rotation: 0.03 },
    followthrough: { x: 3, y: 0.2, rotation: 0.018 },
    recovery: { x: 1, y: 0.4, rotation: -0.006 },
  };
  const pose = poses[label] ?? poses.guard;
  tweens.add(120, (t) => {
    const k = easeInOutSine(t);
    setActorSpritePose(
      actor,
      actor.parts.sprite.x + (pose.x - actor.parts.sprite.x) * k,
      actor.parts.sprite.y + (pose.y - actor.parts.sprite.y) * k,
      actor.parts.sprite.rotation + (pose.rotation - actor.parts.sprite.rotation) * k
    );
  });
}

function resetActorPose(actor) {
  setActorSpritePose(actor, 0, 0, 0);
  actor.parts.ghostSprite.alpha = 0;
  actor.parts.marker.scale.set(1);
  actor.parts.lanterna.x = LANTERNA_OFFSET.x;
  actor.parts.lanterna.y = LANTERNA_OFFSET.y;
}

function setActorSpritePose(actor, x, y, rotation) {
  actor.parts.sprite.x = x;
  actor.parts.sprite.y = y;
  actor.parts.sprite.rotation = rotation;
  actor.parts.rimSprite.x = x - 2;
  actor.parts.rimSprite.y = y - 1;
  actor.parts.rimSprite.rotation = rotation;
}

function animateGridStep(actor, from, to, fromFrame, toFrame, duration) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dir = dx === 0 ? 0 : dx > 0 ? 1 : -1;
  let switched = false;
  setActorFrame(actor, fromFrame);

  tweens.add(duration, (t) => {
    const k = t * 0.75 + easeInOutSine(t) * 0.25;
    const lift = Math.sin(Math.PI * t);
    if (!switched && t >= 0.28) {
      switched = true;
      setActorFrame(actor, toFrame);
    }

    actor.x = from.x + (to.x - from.x) * k;
    actor.y = from.y + (to.y - from.y) * k - lift * 1;
    updateActorDepth(actor);
    setActorSpritePose(
      actor,
      dir * lift * 0.5,
      -lift * 0.35,
      (dir * 0.003 + Math.sign(dy) * 0.0015) * lift
    );
    actor.parts.marker.scale.set(1 + lift * 0.025, 1 - lift * 0.012);
  }, () => {
    setActorFrame(actor, toFrame);
    actor.x = to.x;
    actor.y = to.y;
    updateActorDepth(actor);
    setActorSpritePose(actor, 0, 0, 0);
    actor.parts.marker.scale.set(1);
  });
}

function animateStaticJourneyStep(actor, from, to, duration) {
  tweens.add(duration, (t) => {
    const k = t * 0.72 + easeInOutSine(t) * 0.28;
    actor.x = from.x + (to.x - from.x) * k;
    actor.y = from.y + (to.y - from.y) * k;
    updateActorDepth(actor);
  }, () => {
    actor.x = to.x;
    actor.y = to.y;
    updateActorDepth(actor);
  });
}

function onKeyDown(event) {
  const key = event.key.toLowerCase();
  if (isTypingTarget(event.target)) return;
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d", "g", "e", "n", "p", "t", "v", "b", "[", "]", "r", "c", "1", "2", "3", "4", " ", "enter", "backspace", "escape"].includes(key)) {
    event.preventDefault();
  }

  if (state.conversing) {
    if (/^[1-4]$/.test(key)) selectConversationReply(Number(key) - 1);
    else if (key === "enter" || key === " " || key === "c") selectConversationReply(0);
    else if (key === "escape") endConversation();
    return;
  }

  if (key === "v") {
    setNavTool("node");
    return;
  }

  if (key === "b") {
    setNavTool("inflection");
    return;
  }

  if (key === "c" && currentAreaKey === AREA_KEYS.RITUAL_ROAD) {
    setNavTool("connect");
    return;
  }

  if (state.occlusionEdit || state.waterEdit) {
    if (key === "enter") closeDraftCollider();
    else if (key === "backspace") undoDraftPoint();
    else if (key === "escape") clearDraftCollider();
    else if (key === "e") {
      if (state.occlusionEdit) setOcclusionEdit(false);
      if (state.waterEdit) setWaterEdit(false);
    }
    return;
  }

  if (state.navEdit) {
    if (key === "escape") setNavEdit(false);
    else if (key === "backspace") deleteSelectedNavigationItem();
    else if (key === "[") setSelectedNodeScale(-0.02);
    else if (key === "]") setSelectedNodeScale(0.02);
    else if (key === "t") cycleSelectedNodeRole();
    else if (key === "e") markSelectedNodeEntry();
    else if (key === "p" && state.selectedEdgeKey) previewSelectedEdge();
    else if (key === "enter" && state.selectedNodeId) setStatus("Now click another node to link it to the selected node.");
    return;
  }

  if (MOVEMENT_KEYS.has(key)) {
    if (currentAreaKey === AREA_KEYS.RITUAL_ROAD) {
      const dx = key === "arrowleft" || key === "a" ? -1 : key === "arrowright" || key === "d" ? 1 : 0;
      const dy = key === "arrowup" || key === "w" ? -1 : key === "arrowdown" || key === "s" ? 1 : 0;
      travelToDirectionalNode(dx, dy);
      return;
    }
    state.input.add(key);
    return;
  }

  if (key === "1") {
    jumpToArea(AREA_KEYS.SHRINE, AREA_SPAWNS[AREA_KEYS.SHRINE]);
  } else if (key === "2") {
    jumpToArea(AREA_KEYS.DOCK, AREA_SPAWNS[AREA_KEYS.DOCK]);
  } else if (key === "3") {
    jumpToArea(AREA_KEYS.RITUAL_ROAD, AREA_SPAWNS[AREA_KEYS.RITUAL_ROAD]);
  }
  else if (key === "g") {
    setGridVisible(!state.showGrid);
  } else if (key === "n") {
    setNavEdit(!state.navEdit);
  } else if (key === "p" && currentAreaKey === AREA_KEYS.RITUAL_ROAD) {
    previewSelectedEdge();
  } else if (key === "c") {
    tryStartConversation();
  } else if (key === "e") {
    setOcclusionEdit(true);
  } else if (key === " ") {
    trySwordAttack();
  } else if (key === "r") {
    resetToGuard();
  }
}

function isTypingTarget(target) {
  const tag = target?.tagName?.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable;
}

function onKeyUp(event) {
  const key = event.key.toLowerCase();
  if (!MOVEMENT_KEYS.has(key)) return;
  event.preventDefault();
  state.input.delete(key);
  if (![...state.input].some((pressed) => MOVEMENT_KEYS.has(pressed))) {
    clearMovementInput();
  }
}

function clearMovementInput() {
  state.input.clear();
  state.moving = false;
  if (playerActor) resetActorPose(playerActor);
}

function jumpToArea(areaKey, spawn) {
  if (!areas[areaKey] || state.acting || state.downed) return;
  clearMovementInput();
  applyArea(areaKey);
  placePlayerAt(areaKey === AREA_KEYS.RITUAL_ROAD ? entryNodePosition() : spawn);
  resize();
  setStatus(`${areas[currentAreaKey].name}.`);
}

function setGridVisible(visible) {
  state.showGrid = visible;
  syncGridOverlayVisibility();
  if (gridToggleEl) gridToggleEl.checked = state.showGrid;
}

function syncGridOverlayVisibility() {
  if (gridOverlay) gridOverlay.visible = state.showGrid || state.occlusionEdit || state.waterEdit;
}

function resize() {
  camera.baseScale = 1;
  const focusNpc = activeNpcActor ?? npcActor;
  if (camera.mode === "conversation" && playerActor && focusNpc) {
    const focusScale = Math.min(camera.baseScale * 1.75, 1.45);
    const centerX = (playerActor.x + focusNpc.x) / 2;
    const centerY = (playerActor.y + focusNpc.y) / 2 - 28;
    const target = cameraTransformFor(centerX, centerY, focusScale, 0.44);
    camera.scale = focusScale;
    world.scale.set(camera.scale);
    world.x = target.x;
    world.y = target.y;
    updateConversationPanelPosition();
    return;
  }

  camera.scale = camera.baseScale;
  world.scale.set(camera.scale);
  world.x = (app.screen.width - WORLD_W * camera.scale) / 2;
  world.y = (app.screen.height - WORLD_H * camera.scale) / 2;
}

function tick(ticker) {
  const deltaMS = ticker.deltaMS || 16.67;
  elapsedMS += deltaMS;
  moveHeldPlayer(deltaMS);
  updateWaterReflections(elapsedMS);
  renderStaticLighting(elapsedMS);
  updateNavigationLightNodes(elapsedMS);
  updateLanternaGlow(playerActor);
  updateActorDepth(playerActor);
  updateActorDepth(npcActor);
  for (const { actor } of hostileActors) updateActorDepth(actor);
  updateConversationPanelPosition();
  tweens.tick(ticker.deltaMS || 16.67);
}

init().catch((err) => {
  console.error(err);
  setStatus(`Visual spike failed to start: ${err.message}`);
});
