import * as PIXI from "../lib/pixi.mjs";
import { easeInOutSine, TweenSet } from "./animation.js";

const COLS = 12;
const ROWS = 8;
const CELL = 96;
const WORLD_W = COLS * CELL;
const WORLD_H = ROWS * CELL;

const COLLISION_SAVE_URL = "/api/visual-spike/collision";
const WATER_SAVE_URL = "/api/visual-spike/water";
const AREA_KEYS = {
  SHRINE: "shrine",
  DOCK: "dock",
  RITUAL_ROAD: "ritual-road",
};
const BACKGROUND_IMAGES = {
  [AREA_KEYS.SHRINE]: "./assets/dockside_stage_uncluttered_v2.png",
  [AREA_KEYS.DOCK]: "./assets/dock_transition_dock.png",
  [AREA_KEYS.RITUAL_ROAD]: "./assets/ritual_road_ink_negative_space.png",
};
const AREA_DATA_FILES = {
  [AREA_KEYS.SHRINE]: {
    collision: "./collisionData.json",
    water: "./waterData.json",
  },
  [AREA_KEYS.DOCK]: {
    collision: "./collisionData.dock.json",
    water: "./waterData.dock.json",
  },
  [AREA_KEYS.RITUAL_ROAD]: {
    collision: "./collisionData.ritual-road.json",
    water: "./waterData.ritual-road.json",
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

let vectorColliders = [];
let waterAreas = [];

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
const RITUAL_ROAD_STATIC_LIGHTS = [
  { x: 214, y: 650, radius: 72, strength: 0.28, glow: 42, phase: 0.2, speed: 0.9 },
  { x: 492, y: 346, radius: 86, strength: 0.24, glow: 48, phase: 1.7, speed: 0.8 },
  { x: 890, y: 324, radius: 84, strength: 0.24, glow: 50, phase: 2.8, speed: 0.86 },
  { x: 956, y: 146, radius: 116, strength: 0.3, glow: 62, phase: 3.4, speed: 0.72 },
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
let currentAreaKey = AREA_KEYS.SHRINE;
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
    collisionInverted: false,
  },
  [AREA_KEYS.RITUAL_ROAD]: {
    name: "Ritual road",
    texture: null,
    colliders: [],
    water: [],
    staticLights: RITUAL_ROAD_STATIC_LIGHTS,
    waterReflections: [],
    playerScale: 0.48,
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
  collisionEdit: false,
  waterEdit: false,
  currentFrame: 0,
  hostileSpawned: false,
  input: new Set(),
  lastMoveStatusMS: 0,
};

const statusEl = document.getElementById("status");
const gridToggleEl = document.getElementById("grid-toggle");
const collisionEditToggleEl = document.getElementById("collision-edit-toggle");
const collisionInvertToggleEl = document.getElementById("collision-invert-toggle");
const waterEditToggleEl = document.getElementById("water-edit-toggle");
const collisionResetEl = document.getElementById("collision-reset");
const waterResetEl = document.getElementById("water-reset");
const collisionSaveButtonEl = document.getElementById("collision-save-button");
const waterSaveButtonEl = document.getElementById("water-save-button");
const collisionExportEl = document.getElementById("collision-export");
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
let gridLayer;
let actorLayer;
let playerActor;
let npcActor;
let npcActors = [];
let hostileActors = [];
let activeNpcActor;
let gridOverlay;
let darknessOverlay;
let waterReflections = [];
let lanternaWaterReflection;
let camera = { scale: 1, baseScale: 1, mode: "free" };
let elapsedMS = 0;

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
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
  const insideCollision = vectorColliders.some((collider) => pointInPolygon(x, y, collider.points));
  return isCollisionInverted() ? !insideCollision : insideCollision;
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
  app = new PIXI.Application();
  await app.init({
    resizeTo: window,
    background: "#050607",
    antialias: true,
    autoDensity: true,
    preference: "webgl",
    resolution: Math.min(window.devicePixelRatio || 1, 2),
  });

  document.getElementById("stage").appendChild(app.canvas);

  world = new PIXI.Container();
  app.stage.addChild(world);

  backgroundLayer = new PIXI.Container();
  waterReflectionLayer = new PIXI.Container();
  lanternaWaterReflectionLayer = new PIXI.Container();
  darknessLayer = new PIXI.Container();
  lightGlowLayer = new PIXI.Container();
  gridLayer = new PIXI.Container();
  actorLayer = new PIXI.Container();
  actorLayer.sortableChildren = true;
  world.addChild(
    backgroundLayer,
    waterReflectionLayer,
    darknessLayer,
    lightGlowLayer,
    lanternaWaterReflectionLayer,
    actorLayer,
    gridLayer
  );

  const [
    backgroundTextures,
    swordTextures,
    npcTexture,
    shrineColliders,
    shrineWaterAreas,
    dockColliders,
    dockWaterAreas,
    ritualRoadColliders,
    ritualRoadWaterAreas,
  ] = await Promise.all([
    loadAreaBackgrounds(),
    loadTextures(SWORD_FRAMES),
    PIXI.Assets.load(NPC_IMAGE),
    loadCollisionData(AREA_KEYS.SHRINE, []),
    loadWaterData(AREA_KEYS.SHRINE, []),
    loadCollisionData(AREA_KEYS.DOCK, DOCK_COLLIDERS),
    loadWaterData(AREA_KEYS.DOCK, DOCK_WATER_AREAS),
    loadCollisionData(AREA_KEYS.RITUAL_ROAD, []),
    loadWaterData(AREA_KEYS.RITUAL_ROAD, []),
  ]);
  areas[AREA_KEYS.SHRINE].texture = backgroundTextures[AREA_KEYS.SHRINE];
  areas[AREA_KEYS.SHRINE].colliders = cloneAreas(shrineColliders);
  areas[AREA_KEYS.SHRINE].water = cloneAreas(shrineWaterAreas);
  areas[AREA_KEYS.DOCK].texture = backgroundTextures[AREA_KEYS.DOCK];
  areas[AREA_KEYS.DOCK].colliders = cloneAreas(dockColliders);
  areas[AREA_KEYS.DOCK].water = cloneAreas(dockWaterAreas);
  areas[AREA_KEYS.RITUAL_ROAD].texture = backgroundTextures[AREA_KEYS.RITUAL_ROAD];
  areas[AREA_KEYS.RITUAL_ROAD].colliders = cloneAreas(ritualRoadColliders);
  areas[AREA_KEYS.RITUAL_ROAD].water = cloneAreas(ritualRoadWaterAreas);
  currentAreaKey = AREA_KEYS.RITUAL_ROAD;
  vectorColliders = cloneAreas(areas[currentAreaKey].colliders);
  waterAreas = cloneAreas(areas[currentAreaKey].water);

  drawBackground(areas[currentAreaKey].texture);
  createWaterReflections();
  createStaticLighting();
  createLanternaWaterReflection();
  drawGrid();
  createPlayer(swordTextures);
  createNpc(npcTexture);
  createHostile(npcTexture);
  applyArea(currentAreaKey);
  placePlayerAt(state.player);
  resize();

  window.addEventListener("resize", resize);
  window.addEventListener("keydown", onKeyDown, { passive: false });
  window.addEventListener("keyup", onKeyUp, { passive: false });
  window.addEventListener("blur", clearMovementInput);
  app.canvas.addEventListener("pointerdown", onCanvasPointerDown);
  gridToggleEl?.addEventListener("change", () => setGridVisible(gridToggleEl.checked));
  collisionEditToggleEl?.addEventListener("change", () => setCollisionEdit(collisionEditToggleEl.checked));
  collisionInvertToggleEl?.addEventListener("change", () => setCollisionInverted(collisionInvertToggleEl.checked));
  waterEditToggleEl?.addEventListener("change", () => setWaterEdit(waterEditToggleEl.checked));
  collisionResetEl?.addEventListener("click", resetAllCollision);
  waterResetEl?.addEventListener("click", resetAllWater);
  collisionSaveButtonEl?.addEventListener("click", saveCollisionToDisk);
  waterSaveButtonEl?.addEventListener("click", saveWaterToDisk);
  app.ticker.add(tick);
  setGridVisible(state.showGrid);
  updateCollisionExport();
  setStatus("Ritual road. Hold arrows/WASD to move freely. G toggles collision overlay; 1 shrine, 2 dock, 3 road.");
}

async function loadTextures(paths) {
  return Promise.all(paths.map((path) => PIXI.Assets.load(path)));
}

async function loadAreaBackgrounds() {
  const entries = await Promise.all(
    Object.entries(BACKGROUND_IMAGES).map(async ([key, path]) => [key, await PIXI.Assets.load(path)])
  );
  return Object.fromEntries(entries);
}

async function loadCollisionData(areaKey, fallback = []) {
  try {
    const response = await fetch(AREA_DATA_FILES[areaKey].collision, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return normalizeColliders(data);
  } catch (err) {
    console.warn("[visual_spike] Could not load collision data", err);
    return cloneAreas(fallback);
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

function normalizeColliders(data) {
  return normalizeAreas(data, "blocked");
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
  const scale = Math.max(WORLD_W / texture.width, WORLD_H / texture.height);
  sprite.scale.set(scale);
  sprite.x = (WORLD_W - texture.width * scale) / 2;
  sprite.y = (WORLD_H - texture.height * scale) / 2;

  const mask = new PIXI.Graphics();
  mask.beginFill(0xffffff, 1);
  mask.drawRect(0, 0, WORLD_W, WORLD_H);
  mask.endFill();

  backgroundLayer.addChild(sprite, mask);
  backgroundLayer.mask = mask;
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
  ctx.clearRect(0, 0, WORLD_W, WORLD_H);
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = `rgba(0, 0, 0, ${DARKNESS_ALPHA})`;
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

  for (const collider of vectorColliders) {
    drawPolygon(gridOverlay, collider.points);
    gridOverlay.fill({ color: isCollisionInverted() ? 0x4a7f45 : 0x8f1d1d, alpha: 0.2 });
    drawPolygon(gridOverlay, collider.points);
    gridOverlay.stroke({ width: 2, color: isCollisionInverted() ? 0xcdf0bd : 0xf0f0f0, alpha: 0.65, pixelLine: true });
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
  if (!state.collisionEdit && !state.waterEdit) return;
  const point = canvasPointToWorld(event);
  if (point.x < 0 || point.y < 0 || point.x > WORLD_W || point.y > WORLD_H) return;
  draftCollider.push([point.x, point.y]);
  renderGridOverlay();
  updateCollisionExport();
  const draftType = state.waterEdit ? "Water" : isCollisionInverted() ? "Walkable" : "Blocked";
  setStatus(`${draftType} draft point ${draftCollider.length}: ${point.x},${point.y}. Enter closes; Backspace undoes; Escape clears.`);
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
    updateCollisionExport();
    setStatus(`Water polygon added for ${areas[currentAreaKey].name}. Click Save water.`);
    return;
  }

  vectorColliders = [
    ...vectorColliders,
    {
      id: `${isCollisionInverted() ? "walkable" : "blocked"}_${vectorColliders.length + 1}`,
      points: draftCollider,
    },
  ];
  draftCollider = [];
  syncCurrentAreaData();
  renderGridOverlay();
  updateCollisionExport();
  setStatus(`${isCollisionInverted() ? "Walkable" : "Blocked"} polygon added for ${areas[currentAreaKey].name}. Click Save collision.`);
}

function undoDraftPoint() {
  if (!draftCollider.length) return;
  draftCollider.pop();
  renderGridOverlay();
  updateCollisionExport();
  setStatus(`Collision draft point removed. ${draftCollider.length} point(s) remain.`);
}

function clearDraftCollider() {
  if (!draftCollider.length) return;
  draftCollider = [];
  renderGridOverlay();
  updateCollisionExport();
  setStatus("Collision draft cleared.");
}

function resetAllCollision() {
  vectorColliders = [];
  draftCollider = [];
  syncCurrentAreaData();
  renderGridOverlay();
  updateCollisionExport();
  setStatus(`All collision information cleared for ${areas[currentAreaKey].name}. Click Save collision.`);
}

function resetAllWater() {
  waterAreas = [];
  draftCollider = [];
  syncCurrentAreaData();
  refreshWaterMasks();
  renderGridOverlay();
  updateCollisionExport();
  setStatus(`All water information cleared for ${areas[currentAreaKey].name}. Click Save water.`);
}

async function saveCollisionToDisk() {
  syncCurrentAreaData();
  try {
    const response = await fetch(`${COLLISION_SAVE_URL}?area=${encodeURIComponent(currentAreaKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(vectorColliders),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
    setStatus(`Collision saved to ${payload.path || "collisionData.json"}.`);
  } catch (err) {
    console.warn("[visual_spike] Collision save failed", err);
    setStatus(`Collision save failed: ${err.message}. Start the authoring server with npm run spike:author.`);
  }
}

async function saveWaterToDisk() {
  syncCurrentAreaData();
  try {
    const response = await fetch(`${WATER_SAVE_URL}?area=${encodeURIComponent(currentAreaKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(waterAreas),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
    setWaterEdit(false, { silent: true });
    setStatus(`Water saved to ${payload.path || "waterData.json"}.`);
  } catch (err) {
    console.warn("[visual_spike] Water save failed", err);
    setStatus(`Water save failed: ${err.message}. Start the authoring server with npm run spike:author.`);
  }
}

function setCollisionEdit(enabled) {
  state.collisionEdit = enabled;
  if (enabled) setWaterEdit(false, { silent: true });
  if (collisionEditToggleEl) collisionEditToggleEl.checked = enabled;
  syncGridOverlayVisibility();
  renderGridOverlay();
  app.canvas.style.cursor = enabled ? "crosshair" : "";
  setStatus(enabled
    ? `${isCollisionInverted() ? "Walkable" : "Collision"} edit: click polygon points. Enter closes; Backspace undoes; Escape clears.`
    : "Collision edit off.");
}

function setCollisionInverted(enabled) {
  if (!areas[currentAreaKey]) return;
  areas[currentAreaKey].collisionInverted = enabled;
  if (collisionInvertToggleEl) collisionInvertToggleEl.checked = enabled;
  renderGridOverlay();
  setStatus(enabled
    ? `${areas[currentAreaKey].name}: collision polygons are walkable; everything outside them is blocked.`
    : `${areas[currentAreaKey].name}: collision polygons are blocked.`);
}

function setWaterEdit(enabled, options = {}) {
  state.waterEdit = enabled;
  if (enabled) setCollisionEdit(false);
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

function updateCollisionExport() {
  if (!collisionExportEl) return;
  collisionExportEl.value = JSON.stringify({
    collisionMode: isCollisionInverted() ? "walkable" : "blocked",
    collision: vectorColliders,
    water: waterAreas,
  }, null, 0);
}

function syncCurrentAreaData() {
  if (!areas[currentAreaKey]) return;
  areas[currentAreaKey].colliders = cloneAreas(vectorColliders);
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
  actor.parts.lanterna.alpha = 0.78;
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

function moveHeldPlayer(deltaMS) {
  if (!playerActor || state.acting || state.downed || state.conversing || state.collisionEdit || state.waterEdit) return;
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
    setStatus(`${areas[currentAreaKey].name}; position ${Math.round(state.player.x)},${Math.round(state.player.y)}`);
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
      setStatus(`${areas[currentAreaKey].name}; position ${state.player.x},${state.player.y}`);
    });
  });
}

function applyArea(areaKey) {
  currentAreaKey = areaKey;
  const area = areas[currentAreaKey];
  if (collisionInvertToggleEl) collisionInvertToggleEl.checked = isCollisionInverted();
  vectorColliders = cloneAreas(area.colliders);
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
  createStaticLighting();
  createLanternaWaterReflection();
  renderGridOverlay();
  updateCollisionExport();
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
  state.currentFrame = 1;
  Object.assign(playerActor, position);
  applyPlayerAreaScale();
  resetActorPose(playerActor);
  setActorFrame(playerActor, 1);
  updateActorDepth(playerActor);
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
  if (state.moving || state.acting || state.downed || state.collisionEdit || state.waterEdit || state.conversing) return;
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
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d", "g", "e", "r", "c", "1", "2", "3", "4", " ", "enter", "backspace", "escape"].includes(key)) {
    event.preventDefault();
  }

  if (state.conversing) {
    if (/^[1-4]$/.test(key)) selectConversationReply(Number(key) - 1);
    else if (key === "enter" || key === " " || key === "c") selectConversationReply(0);
    else if (key === "escape") endConversation();
    return;
  }

  if (state.collisionEdit || state.waterEdit) {
    if (key === "enter") closeDraftCollider();
    else if (key === "backspace") undoDraftPoint();
    else if (key === "escape") clearDraftCollider();
    else if (key === "e") {
      if (state.collisionEdit) setCollisionEdit(false);
      if (state.waterEdit) setWaterEdit(false);
    }
    return;
  }

  if (MOVEMENT_KEYS.has(key)) {
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
  } else if (key === "c") {
    tryStartConversation();
  } else if (key === "e") {
    setCollisionEdit(true);
  } else if (key === " ") {
    trySwordAttack();
  } else if (key === "r") {
    resetToGuard();
  }
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
  placePlayerAt(spawn);
  resize();
  setStatus(`${areas[currentAreaKey].name}; position ${Math.round(state.player.x)},${Math.round(state.player.y)}`);
}

function setGridVisible(visible) {
  state.showGrid = visible;
  syncGridOverlayVisibility();
  if (gridToggleEl) gridToggleEl.checked = state.showGrid;
}

function syncGridOverlayVisibility() {
  if (gridOverlay) gridOverlay.visible = state.showGrid || state.collisionEdit || state.waterEdit;
}

function resize() {
  const margin = 56;
  const scale = Math.min(
    (app.screen.width - margin * 2) / WORLD_W,
    (app.screen.height - margin * 2) / WORLD_H
  );
  camera.baseScale = Math.max(0.2, scale);
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
