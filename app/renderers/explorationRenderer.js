// app/renderers/explorationRenderer.js
//
// PIXI renderer for exploration.
// Listens to exploration domain events and renders into the shared PIXI app.
// No game rules. No state mutation. No DOM access.

import { on } from "../engine/events.js";
import { getApp, PIXI } from "../engine/pixi.js";
import { getState } from "../state/stateStore.js";
import { getCamera, setCamera } from "../engine/camera.js";

// -----------------------------------------------------------------------------
// Internal renderer state
// -----------------------------------------------------------------------------

let app = null;
let root = null;

let world = null; // PIXI.Container; camera moves this, not the stage/fog

// Dead-zone margins as a fraction of the viewport size (in cells).
const DEAD_ZONE_MARGIN_FRACTION = 0.30;

let map = null;
let tileSize = 32; // canonical tile size should come from map; fallback only

let mapLayer = null;
let tileLayer = null; // container for TMJ tile layers
let tileTextureCache = null; // Map<number,gidTexture>
let tilesetBaseCache = null; // Map<string,PIXI.BaseTexture>
let actorLayer = null;

let backgroundSprite = null;
let playerSprite = null;

let bound = false;

// Subscriptions
let unsubReady = null;
let unsubSpawned = null;
let unsubMoved = null;
let unsubBlocked = null;
let unsubExit = null;

// -----------------------------------------------------------------------------
// Event handlers
// -----------------------------------------------------------------------------

async function onExplorationReady({ map: loadedMap }) {
  map = loadedMap;

  console.info("[ExplorationRenderer] exploration:ready", {
    width: loadedMap?.width,
    height: loadedMap?.height,
    tileSize: loadedMap?.tileSize,
    tmjTileW: loadedMap?.tmj?.tilewidth ?? loadedMap?.raw?.tilewidth ?? loadedMap?.tilewidth,
    tmjTileH: loadedMap?.tmj?.tileheight ?? loadedMap?.raw?.tileheight ?? loadedMap?.tileheight,
    image: getMapImagePath(loadedMap),
    layers: (loadedMap?.layers?.length ?? loadedMap?.raw?.layers?.length ?? loadedMap?.tmj?.layers?.length ?? 0),
    tilesets: (loadedMap?.tilesets?.length ?? loadedMap?.raw?.tilesets?.length ?? loadedMap?.tmj?.tilesets?.length ?? 0),
  });

  await mount();

  console.info("[ExplorationRenderer] mounted", {
    stageChildren: app?.stage?.children?.map((c) => c?.name),
  });

  await drawMap();

  console.info("[ExplorationRenderer] drew map", {
    mapLayerChildren: mapLayer?.children?.length,
    tileLayerChildren: tileLayer?.children?.length,
    hasBackgroundSprite: !!backgroundSprite,
  });

  // Show the whole map initially.
  fitWorldToViewport();

  // Keep existing behavior for later (player centering/camera)
  syncPlayerPosition();
  applyCamera();

  // If devtools toggles collision debug after load, allow a one-shot redraw.
  try {
    if (typeof window !== "undefined") {
      window.__redrawCollisionDebug = () => {
        try {
          drawCollisionDebugOverlay();
        } catch (e) {
          console.warn("[ExplorationRenderer] collision debug redraw failed", e);
        }
      };

      // If it was already enabled by the time we finished drawing, render it now.
      if (window.__DEBUG_COLLISION__ === true) {
        drawCollisionDebugOverlay();
      }
    }
  } catch (_) {}
}

function onExplorationSpawned() {
  // Ensure the player sprite exists and is positioned immediately on spawn.
  if (!playerSprite) drawPlayer();
  syncPlayerPosition(true);
}

function onExplorationMoved(payload) {
  // Prefer animating from event payload when available; fall back to state-sync.
  if (!payload || !payload.from || !payload.to) {
    syncPlayerPosition();
    return;
  }

  // Keep internal state authoritative via stateStore, but render smooth movement.
  animatePlayerMove(payload.from, payload.to);
}

function onExplorationMoveBlocked() {
  // Simple feedback: a tiny "bump" animation if we have a sprite.
  bumpPlayer();
}

function onExplorationExit() {
  unmount();
}

// -----------------------------------------------------------------------------
// Mount / unmount
// -----------------------------------------------------------------------------

async function mount() {
  if (root) return;

  // Normalize getApp() whether it returns an app or a promise of an app.
  const maybeApp = getApp();
  const resolved = maybeApp && typeof maybeApp.then === "function" ? await maybeApp : maybeApp;

  app = resolved?.app ?? resolved?.pixiApp ?? resolved;

  if (!app || !app.stage) {
    throw new Error("[ExplorationRenderer] PIXI app not ready (expected getApp() to return an object with .stage)");
  }

  root = new PIXI.Container();
  root.name = "ExplorationRenderer";

  world = new PIXI.Container();
  world.name = "World";
  root.addChild(world);

  mapLayer = new PIXI.Container();
  mapLayer.name = "MapLayer";

  tileLayer = new PIXI.Container();
  tileLayer.name = "TileLayer";

  actorLayer = new PIXI.Container();
  actorLayer.name = "ActorLayer";

  world.addChild(mapLayer);
  world.addChild(tileLayer);
  world.addChild(actorLayer);

  tileTextureCache = new Map();
  tilesetBaseCache = new Map();

  app.stage.addChild(root);

  // Animation tick (kept local to renderer)
  if (app?.ticker) {
    app.ticker.add(tickAnimations);
  }

  // If the renderer resizes, keep the world fitted.
  if (app?.renderer?.on) {
    try {
      app.renderer.on("resize", () => {
        // Re-fit on resize, but don’t stomp camera; fitWorldToViewport handles both.
        fitWorldToViewport();
        applyCamera();
      });
    } catch (_) {}
  }
}

function unmount() {
  if (!root) return;

  app.stage.removeChild(root);

  try {
    if (app?.ticker) app.ticker.remove(tickAnimations);
  } catch (_) {}

  _moveAnim = null;
  _bumpAnim = null;

  root.destroy({ children: true });

  root = null;
  world = null;
  mapLayer = null;
  tileLayer = null;
  actorLayer = null;
  tileTextureCache = null;
  tilesetBaseCache = null;
  backgroundSprite = null;
  playerSprite = null;
  map = null;
}

// -----------------------------------------------------------------------------
// Path helpers
// -----------------------------------------------------------------------------

function normalizeToAppRelative(p) {
  if (!p) return null;

  // Already app-relative
  if (p.startsWith("areas/") || p.startsWith("assets/") || p.startsWith("ui/")) return p;

  // If it contains ".../app/<something>", strip to "<something>"
  const marker = "/app/";
  const i = p.indexOf(marker);
  if (i >= 0) return p.slice(i + marker.length).replace(/\\/g, "/");

  // If it starts with "app/", strip it.
  if (p.startsWith("app/")) return p.slice(4).replace(/\\/g, "/");

  // If it’s just "map.png", keep it; caller will join to TMJ folder.
  return p.replace(/\\/g, "/");
}

function dirname(p) {
  if (!p) return "";
  const i = p.lastIndexOf("/");
  return i >= 0 ? p.slice(0, i + 1) : "";
}

// -----------------------------------------------------------------------------
// Drawing helpers
// -----------------------------------------------------------------------------

function getCanonicalTileSize(m) {
  if (!m) return tileSize;

  // Preferred runtime shape
  if (Number.isFinite(m.tileSize) && m.tileSize > 0) return m.tileSize;
  if (Number.isFinite(m.tileWidth) && m.tileWidth > 0) return m.tileWidth;
  if (Number.isFinite(m.tileHeight) && m.tileHeight > 0) return m.tileHeight;

  // TMJ/raw shapes
  const raw = m.tmj || m.raw || m._tmj || m.tmjRaw;
  const tw = raw?.tilewidth;
  const th = raw?.tileheight;
  if (Number.isFinite(tw) && tw > 0) return tw;
  if (Number.isFinite(th) && th > 0) return th;

  // Direct TMJ keys (some loaders keep these at top level)
  if (Number.isFinite(m.tilewidth) && m.tilewidth > 0) return m.tilewidth;
  if (Number.isFinite(m.tileheight) && m.tileheight > 0) return m.tileheight;

  return tileSize;
}

function getMapImagePath(m) {
  if (!m) return null;

  // Common runtime-map shapes
  if (m.image || m.imagePath) return m.image || m.imagePath;
  if (m.backgroundImage || m.backgroundImagePath) return m.backgroundImage || m.backgroundImagePath;

  // Area/registry-style shapes
  if (m.assets?.image) return m.assets.image;
  if (m.assets?.imagePath) return m.assets.imagePath;
  if (m.assets?.background) return m.assets.background;

  return null;
}

async function loadFirstAvailableAsset(candidates) {
  const tried = [];
  for (const c of candidates) {
    if (!c) continue;

    // Prefer explicit app-relative paths over bare filenames.
    // Bare filenames tend to resolve to `file:///.../app/<name>` under Electron/file://,
    // which PIXI's fetch-based loader often cannot load.
    const candidate = typeof c === "string" && !c.includes("/") ? null : c;
    if (!candidate) {
      tried.push(c);
      continue;
    }

    tried.push(candidate);
    try {
      if (PIXI.Assets?.load) {
        await PIXI.Assets.load(candidate);
      } else {
        PIXI.Texture.from(candidate);
      }
      return candidate;
    } catch (err) {
      console.warn("[ExplorationRenderer] Asset load failed:", candidate, err);
    }
  }
  console.warn("[ExplorationRenderer] No usable asset candidate. Tried:", tried);
  return null;
}

function getImageLayerPathFromTMJ(m) {
  const layers = getLayersFromMap(m);
  for (const layer of layers) {
    if (layer && layer.type === "imagelayer" && layer.image) return layer.image;
  }
  return null;
}

function getLayersFromMap(m) {
  if (!m) return [];
  if (Array.isArray(m.layers)) return m.layers;
  const raw = m.tmj || m.raw || m._tmj || m.tmjRaw;
  if (raw && Array.isArray(raw.layers)) return raw.layers;
  return [];
}

async function resolveBackgroundPath(imgPath) {
  if (!imgPath) return null;

  const tmjPathRaw =
    map?.assets?.tmj ||
    map?.tmjPath ||
    map?.raw?.tmjPath ||
    map?.raw?._tmjPath ||
    map?.raw?.sourcePath;

  const tmjPath = normalizeToAppRelative(tmjPathRaw);
  const base = dirname(tmjPath);

  const img = normalizeToAppRelative(imgPath);

  // If TMJ imagelayer uses "map.png", it’s relative to the TMJ folder (app-relative).
  const candidates = [
    // If caller already provides an app-relative path, try it.
    img,

    // If TMJ path is known, treat the image as relative to the TMJ folder.
    base ? `${base}${img}` : null,

    // Last-resort fallback for this area bundle when we only have "map.png".
    // This prevents PIXI resolving to `file:///.../app/map.png`.
    !img.includes("/") ? `areas/00_docks/${img}` : null,
  ];

  return await loadFirstAvailableAsset(candidates);
}

async function ensureTextureReady(sprite, timeoutMs = 2000) {
  const tex = sprite?.texture;
  const bt = tex?.baseTexture;
  if (!bt) return;

  if (bt.valid) return;

  await new Promise((resolve) => {
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };

    const t = setTimeout(finish, timeoutMs);

    try {
      bt.once?.("loaded", () => {
        clearTimeout(t);
        finish();
      });
    } catch (_) {
      // If PIXI event wiring fails, just resolve on timeout.
    }
  });
}

// -----------------------------------------------------------------------------
// Drawing
// -----------------------------------------------------------------------------

async function drawMap() {
  if (!map || !mapLayer) return;

  mapLayer.removeChildren();
  tileLayer?.removeChildren();
  actorLayer?.removeChildren();

  backgroundSprite = null;

  const width = map.width;
  const height = map.height;
  tileSize = getCanonicalTileSize(map);

  const mapPxW = width * tileSize;
  const mapPxH = height * tileSize;

  // Prefer a real background image if present.
  const imgPathRaw = getMapImagePath(map) || getImageLayerPathFromTMJ(map);
  const imgPath = await resolveBackgroundPath(imgPathRaw);

  console.info("[ExplorationRenderer] background resolved", { imgPathRaw, imgPath });

  if (imgPath) {
    const spr = PIXI.Sprite.from(imgPath);

    // Wait (briefly) for the texture to report real pixel dimensions.
    await ensureTextureReady(spr);

    const texW = spr.texture?.width || spr.texture?.orig?.width || 0;
    const texH = spr.texture?.height || spr.texture?.orig?.height || 0;

    const expectedW = width * tileSize;
    const expectedH = height * tileSize;

    // IMPORTANT: rendering must respect the map's canonical tileSize.
    // If the PNG export doesn't match the grid, fix the asset export — do NOT re-derive tileSize here,
    // because mapSystem/collision/step logic is defined in grid units.
    if (texW > 0 && texH > 0) {
      const driftW = Math.abs(texW - expectedW) / Math.max(1, expectedW);
      const driftH = Math.abs(texH - expectedH) / Math.max(1, expectedH);
      if (driftW > 0.02 || driftH > 0.02) {
        console.warn("[ExplorationRenderer] background texture dims do not match grid extents (asset export mismatch)", {
          imgPath,
          texW,
          texH,
          expectedW,
          expectedH,
          tileSize,
          mapWidthTiles: width,
          mapHeightTiles: height,
        });
      }
    }

    console.info("[ExplorationRenderer] background texture dims", {
      imgPath,
      texW,
      texH,
      mapPxW: expectedW,
      mapPxH: expectedH,
      tileSize,
    });

    spr.x = 0;
    spr.y = 0;
    spr.width = expectedW;
    spr.height = expectedH;

    backgroundSprite = spr;
    mapLayer.addChild(backgroundSprite);
  } else {

    const g = new PIXI.Graphics();
    g.beginFill(0x1a1a1a);
    g.drawRect(0, 0, mapPxW, mapPxH);
    g.endFill();
    mapLayer.addChild(g);
  }

  renderTileLayers();

  // Debug: visualize TMJ collision objects (helps diagnose grid/image alignment).
  if (isCollisionDebugEnabled()) {
    drawCollisionDebugOverlay();
  }

  // Optional grid overlay
  if (map.debugGrid) {
    const grid = new PIXI.Graphics();
    grid.lineStyle(1, 0x333333, 0.5);
    for (let x = 0; x <= width; x++) {
      grid.moveTo(x * tileSize, 0);
      grid.lineTo(x * tileSize, mapPxH);
    }
    for (let y = 0; y <= height; y++) {
      grid.moveTo(0, y * tileSize);
      grid.lineTo(mapPxW, y * tileSize);
    }
    mapLayer.addChild(grid);
  }

  drawPlayer();
}

// -----------------------------------------------------------------------------
// Fit world to viewport (the “map fits inside the window” requirement)
// -----------------------------------------------------------------------------

function fitWorldToViewport() {
  if (!world || !map || !app?.renderer) return;

  const mapPxW = (map.width | 0) * tileSize;
  const mapPxH = (map.height | 0) * tileSize;

  const vw = app.renderer.width;
  const vh = app.renderer.height;

  if (!mapPxW || !mapPxH || !vw || !vh) return;

  const scale = Math.min(vw / mapPxW, vh / mapPxH);

  // Uniform scale, then center *the whole map* in the viewport.
  world.scale.set(scale);

  const padX = (vw - mapPxW * scale) / 2;
  const padY = (vh - mapPxH * scale) / 2;

  // Keep camera’s translation in the same transform chain.
  const cam = getSafeCamera();
  world.x = padX - cam.x * tileSize * scale;
  world.y = padY - cam.y * tileSize * scale;
}

// -----------------------------------------------------------------------------
// TMJ tile rendering (naive sprite-per-tile; loader must normalize tileset paths)
// -----------------------------------------------------------------------------

function getTilesetsFromMap(m) {
  if (!m) return [];
  if (Array.isArray(m.tilesets)) return m.tilesets;
  const raw = m.tmj || m.raw || m._tmj || m.tmjRaw;
  if (raw && Array.isArray(raw.tilesets)) return raw.tilesets;
  return [];
}

function getTilesetForGid(tilesets, gid) {
  if (!Array.isArray(tilesets) || gid <= 0) return null;

  let chosen = null;
  for (const ts of tilesets) {
    const first = ts?.firstgid ?? ts?.firstGid ?? ts?.first_gid;
    if (typeof first !== "number") continue;
    if (first <= gid && (!chosen || first > (chosen.firstgid ?? chosen.firstGid ?? chosen.first_gid))) {
      chosen = ts;
    }
  }
  return chosen;
}

function getBaseTextureForImage(imgPath) {
  if (!imgPath) return null;

  const key = imgPath;
  if (tilesetBaseCache?.has(key)) return tilesetBaseCache.get(key);

  const tex = PIXI.Texture.from(imgPath);
  const base = tex?.baseTexture || tex?.source;
  if (tilesetBaseCache) tilesetBaseCache.set(key, base || null);
  return base || null;
}

function resolveTilesetImagePath(img) {
  if (!img) return null;

  const tmjPathRaw =
    map?.assets?.tmj ||
    map?.tmjPath ||
    map?.raw?.tmjPath ||
    map?.raw?._tmjPath ||
    map?.raw?.sourcePath;

  const tmjPath = normalizeToAppRelative(tmjPathRaw);
  const base = dirname(tmjPath);

  const image = normalizeToAppRelative(img);

  // If tileset image is relative, join to TMJ folder.
  if (image.includes("/")) return image;
  return base ? `${base}${image}` : image;
}

function getTextureForGid(gidRaw) {
  if (!map) return null;
  if (!tileTextureCache) tileTextureCache = new Map();

  // Mask out TMJ flip flags; we don’t support flips yet, but we must not break indexing.
  const FLIP_MASK = 0x1fffffff;
  const gid = (gidRaw >>> 0) & FLIP_MASK;

  if (tileTextureCache.has(gid)) return tileTextureCache.get(gid);

  const tilesets = getTilesetsFromMap(map);
  const ts = getTilesetForGid(tilesets, gid);
  if (!ts) {
    tileTextureCache.set(gid, null);
    return null;
  }

  const firstgid = ts.firstgid ?? ts.firstGid ?? ts.first_gid;
  const localId = gid - firstgid;

  const tileW = ts.tilewidth ?? ts.tileWidth ?? map.tileSize ?? tileSize;
  const tileH = ts.tileheight ?? ts.tileHeight ?? map.tileSize ?? tileSize;
  const cols = ts.columns;

  const imgPath = resolveTilesetImagePath(ts.image);
  if (!imgPath || !cols || cols <= 0) {
    tileTextureCache.set(gid, null);
    return null;
  }

  const base = getBaseTextureForImage(imgPath);
  if (!base) {
    tileTextureCache.set(gid, null);
    return null;
  }

  const x = (localId % cols) * tileW;
  const y = Math.floor(localId / cols) * tileH;

  const tex = new PIXI.Texture(base, new PIXI.Rectangle(x, y, tileW, tileH));
  tileTextureCache.set(gid, tex);
  return tex;
}

function renderTileLayers() {
  if (!map || !tileLayer) return;

  tileLayer.removeChildren();

  const layers = getLayersFromMap(map);
  if (!layers.length) return;

  const mapW = map.width | 0;
  const mapH = map.height | 0;
  const tileW = map.tileSize || tileSize;
  const tileH = map.tileSize || tileSize;

  for (const layer of layers) {
    if (layer.type !== "tilelayer") continue;
    if (layer.visible === false) continue;

    const data = layer.data;
    if (!Array.isArray(data)) continue;

    const layerW = layer.width ?? mapW;
    const layerH = layer.height ?? mapH;
    if (layerW * layerH !== data.length) {
      // Don’t die; just draw what we can.
      console.warn("[ExplorationRenderer] tilelayer dims mismatch", { name: layer.name, layerW, layerH, dataLen: data.length });
    }

    const container = new PIXI.Container();
    container.name = `TMJ:${layer.name || "layer"}`;
    container.alpha = typeof layer.opacity === "number" ? layer.opacity : 1;

    for (let i = 0; i < data.length; i++) {
      const gid = data[i] | 0;
      if (!gid) continue;

      const tex = getTextureForGid(gid);
      if (!tex) continue;

      const x = i % layerW;
      const y = Math.floor(i / layerW);

      const spr = new PIXI.Sprite(tex);
      spr.x = x * tileW;
      spr.y = y * tileH;

      container.addChild(spr);
    }

    tileLayer.addChild(container);
  }
}


// -----------------------------------------------------------------------------
// Debug overlays
// -----------------------------------------------------------------------------
// Cache for a parsed TMJ (used only for debug overlays when the runtime map shape
// doesn’t carry object layers through).
let _debugTMJ = null;
let _debugTMJLoadPromise = null;

function isCollisionDebugEnabled() {
  try {
    const state = getState?.();
    if (state?.debug?.collision === true) return true;
    if (map?.debugCollision === true) return true;
    // Allow devtools: window.__DEBUG_COLLISION__ = true
    if (typeof window !== "undefined" && window.__DEBUG_COLLISION__ === true) return true;
  } catch (_) {}
  return false;
}

// Loads the TMJ JSON for debug overlays if needed.
async function loadTMJForDebug() {
  const tmjPathRaw =
    map?.assets?.tmj ||
    map?.tmjPath ||
    map?.raw?.tmjPath ||
    map?.raw?._tmjPath ||
    map?.raw?.sourcePath;

  const tmjRel = normalizeToAppRelative(tmjPathRaw);
  if (!tmjRel) return null;

  // De-dupe concurrent loads.
  if (_debugTMJ) return _debugTMJ;
  if (_debugTMJLoadPromise) return _debugTMJLoadPromise;

  _debugTMJLoadPromise = (async () => {
    try {
      // Build a file:// URL relative to this module.
      const url = new URL(`../${tmjRel}`, import.meta.url);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      _debugTMJ = json;
      return json;
    } catch (e) {
      console.warn("[ExplorationRenderer] collision debug: failed to load TMJ for debug", { tmjRel }, e);
      return null;
    } finally {
      _debugTMJLoadPromise = null;
    }
  })();

  return _debugTMJLoadPromise;
}

function findCollisionLayerFromTMJ(tmjJson) {
  const layers = tmjJson?.layers;
  if (!Array.isArray(layers)) return null;

  // Be tolerant: some exports omit "type":"objectgroup" but still provide "objects".
  return layers.find(
    (l) =>
      l &&
      (l.name === "Collision" || l.name === "collision") &&
      (l.type === "objectgroup" || Array.isArray(l.objects))
  );
}

function drawCollisionDebugOverlay() {
  if (!mapLayer || !map) return;

  // Container so we can nuke/recreate safely per draw.
  const existing = mapLayer.getChildByName?.("CollisionDebug");
  if (existing) {
    try {
      mapLayer.removeChild(existing);
      existing.destroy?.({ children: true });
    } catch (_) {}
  }

  const g = new PIXI.Graphics();
  g.name = "CollisionDebug";

  const mapW = (map.width | 0) || 0;
  const mapH = (map.height | 0) || 0;
  const mapPxW = mapW * tileSize;
  const mapPxH = mapH * tileSize;

  // Outline map bounds (useful sanity check)
  g.lineStyle(2, 0xff00ff, 0.7);
  g.drawRect(0, 0, mapPxW, mapPxH);

  // --- Primary truth: visualise the engine's blocked grid (whatever shape it is) ---
  // Prefer the runtime predicate if present — this should match the movement system.
  const mapIsBlockedFn = typeof map.isBlocked === "function" ? map.isBlocked.bind(map) : null;

  const blocked =
    map.blockedSet ??
    map.collisionSet ??
    map.grid?.blockedSet ??
    map.blocked ??
    map.collision ??
    map.grid?.blocked ??
    map.blockedTiles ??
    map.grid?.blockedTiles ??
    null;

  const hasBlocked = !!blocked;

  // Build-once cache for list forms (numeric indices or {x,y} pairs).
  // We keep this local so each redraw starts clean (no stale refs across map loads).
  let listIndexSet = null;

  const isBlocked = (x, y) => {
    // 1) Runtime predicate (best / matches movement)
    if (mapIsBlockedFn) {
      try {
        return !!mapIsBlockedFn(x, y);
      } catch (_) {
        // fall through
      }
    }

    if (!blocked) return false;

    const idx = y * mapW + x;
    const kComma = `${x},${y}`;
    const kColon = `${x}:${y}`;

    // 2) Set-like
    if (typeof blocked?.has === "function") {
      return blocked.has(idx) || blocked.has(kComma) || blocked.has(kColon) || blocked.has(String(idx));
    }

    // 3) Array-like
    if (Array.isArray(blocked)) {
      // 3a) 2D boolean grid [y][x]
      const row = blocked[y];
      if (Array.isArray(row) && typeof row[x] !== "undefined") return !!row[x];

      // 3b) Flat boolean array by idx (only if it truly looks booleanish)
      // Avoid the classic bug where an array of indices makes blocked[idx] truthy for small idx.
      if (typeof blocked[idx] === "boolean") return blocked[idx];

      // 3c) List of numeric indices OR list of {x,y}
      if (!listIndexSet) {
        listIndexSet = new Set();
        for (const v of blocked) {
          if (typeof v === "number") {
            listIndexSet.add(v | 0);
          } else if (v && typeof v === "object") {
            // {x,y} form
            const vx = Number.isFinite(v.x) ? v.x : Number.isFinite(v.tx) ? v.tx : null;
            const vy = Number.isFinite(v.y) ? v.y : Number.isFinite(v.ty) ? v.ty : null;
            if (vx != null && vy != null) listIndexSet.add((vy | 0) * mapW + (vx | 0));
            // string keys embedded in arrays (rare)
            const ks = v.key || v.k;
            if (typeof ks === "string") listIndexSet.add(ks);
          } else if (typeof v === "string") {
            listIndexSet.add(v);
          }
        }
      }

      return listIndexSet.has(idx) || listIndexSet.has(kComma) || listIndexSet.has(kColon) || listIndexSet.has(String(idx));
    }

    // 4) Object map
    if (typeof blocked === "object") {
      if (blocked[kComma] != null) return !!blocked[kComma];
      if (blocked[kColon] != null) return !!blocked[kColon];
      if (blocked[idx] != null) return !!blocked[idx];
      if (blocked[String(idx)] != null) return !!blocked[String(idx)];
    }

    return false;
  };

  // Draw blocked tiles (fill + outline)
  if (hasBlocked && mapW > 0 && mapH > 0) {
    g.lineStyle(1, 0xff0000, 0.85);
    g.beginFill(0xff0000, 0.18);

    let count = 0;
    for (let y = 0; y < mapH; y++) {
      for (let x = 0; x < mapW; x++) {
        if (!isBlocked(x, y)) continue;
        count++;
        g.drawRect(x * tileSize, y * tileSize, tileSize, tileSize);
      }
    }

    g.endFill();

    console.info("[ExplorationRenderer] collision debug overlay drawn (blocked grid)", {
      blockedCount: count,
      tileSize,
      mapPxW,
      mapPxH,
      blockedType: blocked?.constructor?.name || typeof blocked,
      usedRuntimePredicate: !!mapIsBlockedFn,
    });

    mapLayer.addChild(g);
    return;
  }

  // --- Fallback: if we have no blocked grid at runtime, fall back to TMJ objects ---

  // Try to find collision objects from the runtime map shape first.
  const raw = map.tmj || map.raw || map._tmj || map.tmjRaw || null;
  const runtimeLayers = raw?.layers || map.layers || [];
  let collisionLayer = runtimeLayers.find(
    (l) =>
      l &&
      (l.name === "Collision" || l.name === "collision") &&
      (l.type === "objectgroup" || Array.isArray(l.objects))
  );

  // If the runtime shape doesn't include object layers, fall back to the TMJ (debug-only).
  if (!collisionLayer) {
    collisionLayer = findCollisionLayerFromTMJ(_debugTMJ);
  }

  // If still missing, kick off an async load and redraw once it arrives.
  if (!collisionLayer || !Array.isArray(collisionLayer.objects)) {
    console.warn(
      "[ExplorationRenderer] collision debug: no blocked grid on map, and no TMJ objectgroup named 'Collision' found (will try loading TMJ for debug)"
    );

    // Fire-and-forget load; on success, redraw.
    loadTMJForDebug().then((tmjJson) => {
      const layer = findCollisionLayerFromTMJ(tmjJson);
      if (layer && Array.isArray(layer.objects)) {
        try {
          drawCollisionDebugOverlay();
        } catch (e) {
          console.warn("[ExplorationRenderer] collision debug redraw failed", e);
        }
      }
    });

    // Still draw map bounds so we know debug is active.
    mapLayer.addChild(g);
    return;
  }

  // Collision shapes from TMJ objects
  g.lineStyle(2, 0xff0000, 0.85);
  g.beginFill(0xff0000, 0.12);

  for (const obj of collisionLayer.objects) {
    if (!obj) continue;

    // Rects
    if (
      Number.isFinite(obj.width) &&
      Number.isFinite(obj.height) &&
      obj.width > 0 &&
      obj.height > 0 &&
      !obj.polygon &&
      !obj.polyline
    ) {
      g.drawRect(obj.x || 0, obj.y || 0, obj.width, obj.height);
      continue;
    }

    // Polygons
    if (Array.isArray(obj.polygon) && obj.polygon.length) {
      const ox = obj.x || 0;
      const oy = obj.y || 0;
      g.moveTo(ox + obj.polygon[0].x, oy + obj.polygon[0].y);
      for (let i = 1; i < obj.polygon.length; i++) {
        g.lineTo(ox + obj.polygon[i].x, oy + obj.polygon[i].y);
      }
      g.lineTo(ox + obj.polygon[0].x, oy + obj.polygon[0].y);
      continue;
    }

    // Polylines (outline only)
    if (Array.isArray(obj.polyline) && obj.polyline.length) {
      const ox = obj.x || 0;
      const oy = obj.y || 0;
      g.moveTo(ox + obj.polyline[0].x, oy + obj.polyline[0].y);
      for (let i = 1; i < obj.polyline.length; i++) {
        g.lineTo(ox + obj.polyline[i].x, oy + obj.polyline[i].y);
      }
      continue;
    }

    // Points (rare)
    if (obj.point) {
      const ox = obj.x || 0;
      const oy = obj.y || 0;
      g.drawCircle(ox, oy, 4);
    }
  }

  g.endFill();
  mapLayer.addChild(g);

  console.info("[ExplorationRenderer] collision debug overlay drawn (TMJ objects)", {
    objects: collisionLayer.objects.length,
    tileSize,
    mapPxW,
    mapPxH,
  });
}

// -----------------------------------------------------------------------------
// Player animation helpers
// -----------------------------------------------------------------------------

let _moveAnim = null; // { fromPx, toPx, t0, durMs }
let _bumpAnim = null; // { t0, durMs, baseX, baseY }

function cellToPx(cell) {
  return {
    x: cell.x * tileSize + tileSize / 2,
    y: cell.y * tileSize + tileSize / 2,
  };
}

function stopMoveAnim() {
  _moveAnim = null;
}

function animatePlayerMove(fromCell, toCell, durMs = 120) {
  if (!playerSprite) return;

  const fromPx = cellToPx(fromCell);
  const toPx = cellToPx(toCell);

  // Cancel any existing bump so it doesn't fight the move.
  _bumpAnim = null;

  // If we don't have a ticker, just snap.
  if (!app?.ticker) {
    playerSprite.x = toPx.x;
    playerSprite.y = toPx.y;
    return;
  }

  _moveAnim = {
    fromPx,
    toPx,
    t0: performance.now(),
    durMs: Math.max(1, durMs | 0),
  };

  // Keep camera in sync with the target cell immediately (feels responsive).
  updateCameraForPlayerCell(toCell.x, toCell.y);
  applyCamera();
}

function bumpPlayer(durMs = 90) {
  if (!playerSprite || !app?.ticker) return;

  // If moving, don't bump.
  if (_moveAnim) return;

  _bumpAnim = {
    t0: performance.now(),
    durMs: Math.max(1, durMs | 0),
    baseX: playerSprite.x,
    baseY: playerSprite.y,
  };
}

function tickAnimations() {
  if (!playerSprite) return;

  const now = performance.now();

  if (_moveAnim) {
    const t = (now - _moveAnim.t0) / _moveAnim.durMs;
    if (t >= 1) {
      playerSprite.x = _moveAnim.toPx.x;
      playerSprite.y = _moveAnim.toPx.y;
      stopMoveAnim();
    } else {
      const k = Math.max(0, Math.min(1, t));
      playerSprite.x = _moveAnim.fromPx.x + (_moveAnim.toPx.x - _moveAnim.fromPx.x) * k;
      playerSprite.y = _moveAnim.fromPx.y + (_moveAnim.toPx.y - _moveAnim.fromPx.y) * k;
    }
  } else if (_bumpAnim) {
    const t = (now - _bumpAnim.t0) / _bumpAnim.durMs;
    if (t >= 1) {
      playerSprite.x = _bumpAnim.baseX;
      playerSprite.y = _bumpAnim.baseY;
      _bumpAnim = null;
    } else {
      const k = Math.max(0, Math.min(1, t));
      // Quick ease-out bump (no trig, just a tiny offset curve)
      const bump = (1 - k) * (k < 0.5 ? k : 1 - k) * (tileSize * 0.10);
      playerSprite.x = _bumpAnim.baseX + bump;
      playerSprite.y = _bumpAnim.baseY;
    }
  }
}

// -----------------------------------------------------------------------------
// Player
// -----------------------------------------------------------------------------

function drawPlayer() {
  if (!actorLayer) return;
  actorLayer.removeChildren();

  playerSprite = null;

  // Best-effort: if state exposes a player sprite path, use it.
  const state = getState();
  const spritePathRaw =
    state.getSelectedCharacter?.()?.sprite ||
    state.getSelectedCharacter?.()?.spritePath ||
    state.getPlayerSprite?.() ||
    state.player?.sprite ||
    state.player?.spritePath ||
    null;

  const spritePath = spritePathRaw ? normalizeToAppRelative(spritePathRaw) : null;

  if (spritePath) {
    try {
      const spr = PIXI.Sprite.from(spritePath);
      spr.anchor?.set?.(0.5, 0.5);

      // Fit inside tile with a little margin.
      const texW = spr.texture?.width || spr.texture?.orig?.width || 1;
      const texH = spr.texture?.height || spr.texture?.orig?.height || 1;
      const scale = Math.min((tileSize * 0.90) / texW, (tileSize * 0.90) / texH);
      spr.scale.set(scale);

      playerSprite = spr;
    } catch (err) {
      console.warn("[ExplorationRenderer] failed to create player sprite from path", spritePath, err);
    }
  }

  // Fallback: simple circle marker (outlined for visibility).
  if (!playerSprite) {
    const g = new PIXI.Graphics();

    // Black outline for contrast against pale maps
    g.lineStyle(2, 0x000000, 1);

    // Same fill as before
    g.beginFill(0xddddff);
    g.drawCircle(0, 0, tileSize * 0.30);
    g.endFill();

    playerSprite = g;
  }

  actorLayer.addChild(playerSprite);
}

// -----------------------------------------------------------------------------
// Camera / transforms
// -----------------------------------------------------------------------------

function getSafeCamera() {
  const cam = getCamera() || {};
  const x = Number.isFinite(cam.x) ? cam.x : 0;
  const y = Number.isFinite(cam.y) ? cam.y : 0;

  let w = Number.isFinite(cam.w) ? cam.w : 0;
  let h = Number.isFinite(cam.h) ? cam.h : 0;

  if ((!w || !h) && app?.renderer && Number.isFinite(tileSize) && tileSize > 0) {
    const rw = app.renderer.width;
    const rh = app.renderer.height;
    w = w || Math.max(1, Math.floor(rw / tileSize));
    h = h || Math.max(1, Math.floor(rh / tileSize));
  }

  w = w || 1;
  h = h || 1;

  return { ...cam, x, y, w, h };
}

function applyCamera() {
  if (!world || !map) return;

  const cam = getSafeCamera();
  const scale = world.scale?.x || 1;

  // Preserve “map fits in viewport” padding while also applying camera translation.
  const mapPxW = (map.width | 0) * tileSize;
  const mapPxH = (map.height | 0) * tileSize;

  const vw = app?.renderer?.width || 0;
  const vh = app?.renderer?.height || 0;

  const padX = vw ? (vw - mapPxW * scale) / 2 : 0;
  const padY = vh ? (vh - mapPxH * scale) / 2 : 0;

  world.x = padX - cam.x * tileSize * scale;
  world.y = padY - cam.y * tileSize * scale;

  if (!Number.isFinite(world.x) || !Number.isFinite(world.y)) {
    console.warn("[ExplorationRenderer] applyCamera produced non-finite world coords", { cam, tileSize, worldX: world.x, worldY: world.y });
    world.x = padX;
    world.y = padY;
  }
}

function updateCameraForPlayerCell(px, py) {
  if (!map) return;

  const cam = getSafeCamera();
  const worldW = map.width | 0;
  const worldH = map.height | 0;

  const marginX = Math.max(0, Math.floor((cam.w || 1) * DEAD_ZONE_MARGIN_FRACTION)) | 0;
  const marginY = Math.max(0, Math.floor((cam.h || 1) * DEAD_ZONE_MARGIN_FRACTION)) | 0;

  const safeMinX = cam.x + marginX;
  const safeMaxX = cam.x + cam.w - 1 - marginX;
  const safeMinY = cam.y + marginY;
  const safeMaxY = cam.y + cam.h - 1 - marginY;

  let nextX = cam.x;
  let nextY = cam.y;

  if (px < safeMinX) nextX = px - marginX;
  else if (px > safeMaxX) nextX = px - (cam.w - 1 - marginX);

  if (py < safeMinY) nextY = py - marginY;
  else if (py > safeMaxY) nextY = py - (cam.h - 1 - marginY);

  const maxX = Math.max(0, worldW - (cam.w || 1));
  const maxY = Math.max(0, worldH - (cam.h || 1));

  nextX = Math.max(0, Math.min(maxX, nextX | 0));
  nextY = Math.max(0, Math.min(maxY, nextY | 0));

  if (nextX !== cam.x || nextY !== cam.y) setCamera({ x: nextX, y: nextY });
}

// -----------------------------------------------------------------------------
// Sync from state
// -----------------------------------------------------------------------------

function syncPlayerPosition(snap = false) {
  if (!playerSprite) return;

  const state = getState();
  const pos = state.getPlayerPosition?.();
  if (!pos) return;

  if (snap) {
    stopMoveAnim();
    _bumpAnim = null;
    playerSprite.x = pos.x * tileSize + tileSize / 2;
    playerSprite.y = pos.y * tileSize + tileSize / 2;
  } else {
    // If no animation is active, keep it snapped anyway.
    if (!_moveAnim) {
      playerSprite.x = pos.x * tileSize + tileSize / 2;
      playerSprite.y = pos.y * tileSize + tileSize / 2;
    }
  }

  updateCameraForPlayerCell(pos.x, pos.y);
  applyCamera();
}

// -----------------------------------------------------------------------------
// Public lifecycle
// -----------------------------------------------------------------------------

export function startExplorationRenderer() {
  if (bound) return;
  bound = true;

  unsubReady = on("exploration:ready", onExplorationReady);
  unsubSpawned = on("exploration:spawned", onExplorationSpawned);
  unsubMoved = on("exploration:moved", onExplorationMoved);
  unsubBlocked = on("exploration:moveBlocked", onExplorationMoveBlocked);
  unsubExit = on("exploration:exit", onExplorationExit);

  // Devtools convenience: toggle + immediate redraw without requiring a full scene reload.
  try {
    if (typeof window !== "undefined") {
      window.__setCollisionDebug = (enabled = true) => {
        window.__DEBUG_COLLISION__ = !!enabled;
        if (window.__DEBUG_COLLISION__) {
          drawCollisionDebugOverlay();
        }
      };
    }
  } catch (_) {}
}

export function stopExplorationRenderer() {
  if (!bound) return;
  bound = false;

  if (typeof unsubReady === "function") unsubReady();
  if (typeof unsubSpawned === "function") unsubSpawned();
  if (typeof unsubMoved === "function") unsubMoved();
  if (typeof unsubBlocked === "function") unsubBlocked();
  if (typeof unsubExit === "function") unsubExit();
  unsubReady = null;
  unsubSpawned = null;
  unsubMoved = null;
  unsubBlocked = null;
  unsubExit = null;

  unmount();
}