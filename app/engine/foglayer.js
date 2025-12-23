// app/layers/fogLayer.js
//
// Global full-screen fog layer that sits in the PIXI stage and
// crossfades between a set of background PNGs.
// Meant to be created once, right after the PIXI app is created,
// and then left alone.

import { PIXI } from "./pixi.js";

let fogLayer = null;     // PIXI.Container
let spriteA = null;      // PIXI.Sprite
let spriteB = null;      // PIXI.Sprite
let currentIndex = 0;
let nextIndex = 1;
let state = "idle";      // "idle" | "hold" | "fade"
let time = 0;
let fadeDuration = 10;   // seconds
let holdDuration = 6;    // seconds
let textures = [];
let tickerFn = null;
let debugGfx = null;    // PIXI.Graphics (optional)

// IMPORTANT: use root-absolute paths so module location / router paths don't matter.
const IMAGE_PATHS = [
  "./assets/images/background/fog_01.png",
  "./assets/images/background/fog_02.png",
  "./assets/images/background/fog_03.png",
  "./assets/images/background/fog_04.png",
];

// Preload textures once.
// Uses PIXI.Assets.load when available (Pixi v7/v8), falls back to Texture.from.
async function loadFogTextures() {
  if (textures.length) return textures;

  const loadOne = async (path) => {
    // Resolve to an absolute URL that works under both http(s) and file:// (Electron).
    // This prevents Pixi/Fetch from interpreting paths in unexpected ways.
    const url = new URL(path, window.location.href).toString();
    try {
      if (PIXI.Assets && typeof PIXI.Assets.load === "function") {
        const tex = await PIXI.Assets.load(url);
        if (!tex) {
          console.warn("[fogLayer] Assets.load returned null for:", url);
          return null;
        }
        return tex;
      }

      // Fallback path: Texture.from kicks off internal loading.
      const tex = PIXI.Texture.from(url);
      if (!tex) {
        console.warn("[fogLayer] Texture.from returned null for:", url);
        return null;
      }

      // baseTexture/source differences across versions; wait for readiness if possible.
      const bt = tex.baseTexture || tex.source;
      if (bt && bt.valid) return tex;

      return await new Promise((resolve) => {
        if (!bt || typeof bt.once !== "function") {
          // Can't observe load events; just return the texture and hope Pixi resolves it.
          resolve(tex);
          return;
        }
        bt.once("loaded", () => resolve(tex));
        bt.once("error", () => resolve(null));
      });
    } catch (e) {
      console.warn("[fogLayer] Failed to load fog texture:", url, e);
      return null;
    }
  };

  const loaded = await Promise.all(IMAGE_PATHS.map(loadOne));
  textures = loaded.filter(Boolean);

  if (!textures.length) {
    console.warn("[fogLayer] No textures loaded for fog background. Paths:", IMAGE_PATHS);
  } else {
    console.info("[fogLayer] Loaded fog textures:", IMAGE_PATHS);
  }

  return textures;
}

function resize(app) {
  if (!spriteA || !spriteB) return;

  const w = app.renderer.width;
  const h = app.renderer.height;
  const maxDim = Math.max(w, h);

  [spriteA, spriteB].forEach((s) => {
    s.x = w / 2;
    s.y = h / 2;
    s.width = maxDim * 1.2;
    s.height = maxDim * 1.2;
  });

  // Optional debug overlay to prove the PIXI canvas is visible behind DOM UI.
  if (debugGfx) {
    debugGfx.clear();
    debugGfx.beginFill(0xff00ff, 0.12);
    debugGfx.drawRect(0, 0, w, h);
    debugGfx.endFill();
  }
}

function tick(app) {
  if (!fogLayer || !spriteA || !spriteB || textures.length === 0) return;

  // If a scene cleared the stage, our container may have been detached.
  // Re-attach it at index 0 so the fog stays as a global background.
  try {
    if (fogLayer && app && app.stage && !fogLayer.parent) {
      app.stage.addChildAt(fogLayer, 0);
      // Keep it pinned to the back.
      if (app.stage.getChildIndex(fogLayer) !== 0) app.stage.setChildIndex(fogLayer, 0);
      resize(app);
    }
  } catch {}

  // Allow enabling debug overlay after init (e.g. set window.__FOG_DEBUG = true, then wait a frame).
  if (!debugGfx) {
    try {
      if (typeof window !== "undefined" && window.__FOG_DEBUG) {
        debugGfx = new PIXI.Graphics();
        debugGfx.name = "FogDebug";
        fogLayer.addChildAt(debugGfx, 0);
        // Force a resize draw on next tick.
        resize(app);
      }
    } catch {}
  }

  const dt = (app.ticker.deltaMS || 16) / 1000;
  time += dt;

  if (state === "hold") {
    if (time >= holdDuration) {
      state = "fade";
      time = 0;
    }
    return;
  }

  if (state === "fade") {
    const t = Math.min(time / fadeDuration, 1);
    spriteA.alpha = 1 - t;
    spriteB.alpha = t;

    if (t >= 1) {
      currentIndex = nextIndex;
      nextIndex = (currentIndex + 1) % textures.length;

      const tmp = spriteA;
      spriteA = spriteB;
      spriteB = tmp;

      spriteB.alpha = 0;
      spriteB.texture = textures[nextIndex];

      state = "hold";
      time = 0;
    }
  }
}

/**
 * Ensure the global fog layer exists and is attached to `app.stage`.
 * Safe to call multiple times; subsequent calls are no-ops.
 */
export async function ensureFogLayer(app) {
  // Contract: caller must pass the shared PIXI.Application instance.
  // This module never creates a PIXI app and never calls getApp().
  if (!app || !app.stage || !app.renderer) {
    console.warn("[fogLayer] ensureFogLayer called without a valid PIXI app");
    return null;
  }

  if (fogLayer) {
    // If another scene cleared the stage, our container may have been detached.
    // Re-attach it at index 0 to reassert the background contract.
    try {
      if (!fogLayer.parent) {
        app.stage.addChildAt(fogLayer, 0);
      } else if (fogLayer.parent !== app.stage) {
        fogLayer.parent.removeChild(fogLayer);
        app.stage.addChildAt(fogLayer, 0);
      } else {
        const idx = app.stage.getChildIndex(fogLayer);
        if (idx !== 0) app.stage.setChildIndex(fogLayer, 0);
      }
    } catch {}

    resize(app);
    return { app, stage: fogLayer };
  }

  await loadFogTextures();
  if (!textures.length) return null;

  fogLayer = new PIXI.Container();
  fogLayer.name = "FogLayer";

  // DEBUG (safe): enable via either:
  //   1) `window.__FOG_DEBUG = true` in DevTools (can be toggled at runtime), or
  //   2) `?fogdebug=1` in the URL.
  // If you can see a faint magenta wash, the PIXI canvas is visible and the issue is fog contrast.
  // If you cannot, the DOM is occluding the canvas or the canvas is not where you think it is.
  const wantsDebug = (() => {
    try {
      if (typeof window === "undefined") return false;
      if (window.__FOG_DEBUG) return true;
      const qs = new URLSearchParams(window.location.search || "");
      return qs.get("fogdebug") === "1";
    } catch {
      return false;
    }
  })();

  if (wantsDebug) {
    debugGfx = new PIXI.Graphics();
    debugGfx.name = "FogDebug";
    fogLayer.addChild(debugGfx);
  }

  spriteA = new PIXI.Sprite(textures[0]);
  spriteB = new PIXI.Sprite(textures[textures.length > 1 ? 1 : 0]);

  spriteA.anchor.set(0.5);
  spriteB.anchor.set(0.5);
  spriteA.alpha = 1;
  spriteB.alpha = 0;

  fogLayer.addChild(spriteA);
  fogLayer.addChild(spriteB);

  // First child so everything else renders on top.
  app.stage.addChildAt(fogLayer, 0);

  resize(app);

  currentIndex = 0;
  nextIndex = textures.length > 1 ? 1 : 0;
  state = "hold";
  time = 0;

  tickerFn = () => tick(app);
  app.ticker.add(tickerFn);

  // Helpful diagnostics.
  try {
    const names = (app.stage.children || []).map((c) => c && (c.name || c.constructor?.name || "<unnamed>"));
    console.info("[fogLayer] stage children (front-to-back):", names);
  } catch {}

  console.info("[fogLayer] Initialised global fog layer");
  return { app, stage: fogLayer };
}

export function destroyFogLayer(app) {
  if (!fogLayer || !app) return;
  if (tickerFn && app.ticker) app.ticker.remove(tickerFn);

  if (fogLayer.parent) fogLayer.parent.removeChild(fogLayer);
  fogLayer.destroy({ children: true, texture: false, baseTexture: false });

  fogLayer = null;
  spriteA = null;
  spriteB = null;
  textures = [];
  tickerFn = null;

  console.info("[fogLayer] Destroyed global fog layer");
}