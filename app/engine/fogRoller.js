// app/engine/fogRoller.js
// Robust ESM Fog Roller — crossfades between frames; accepts multiple candidates per frame.
// Each frame entry can be a string or an array of strings (first that loads wins).

import { PIXI } from "./pixi.js";

async function loadOne(srcOrList) {
  const list = Array.isArray(srcOrList) ? srcOrList : [srcOrList];
  let lastErr = null;
  for (const src of list) {
    try {
      const tx = await PIXI.Assets.load(src);
      return tx;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("No candidate frame could be loaded");
}

function makeFullScreenSprite(tx, app) {
  const s = new PIXI.Sprite(tx);
  const resize = () => {
    const w = app.renderer.width;
    const h = app.renderer.height;
    const rw = tx.width || 1;
    const rh = tx.height || 1;
    const scale = Math.max(w / rw, h / rh);
    s.scale.set(scale, scale);
    s.x = (w - rw * scale) / 2;
    s.y = (h - rh * scale) / 2;
  };
  resize();
  return { sprite: s, resize };
}

export function createFogRoller(app, {
  frames = [
    ["./assets/fog/fog_01.png", "./assets/fog/fog_01.jpeg"],
    ["./assets/fog/fog_02.png", "./assets/fog/fog_02.jpeg"],
    ["./assets/fog/fog_03.png", "./assets/fog/fog_03.jpeg"],
    ["./assets/fog/fog_04.png", "./assets/fog/fog_04.jpeg"],
  ],
  holdTime = 10,
  fadeTime = 5,
  pingPong = true,
  baseDim = 0.25,
  onLog = null,
} = {}) {
  const container = new PIXI.Container();
  container.zIndex = -1000;
  container.sortableChildren = true;

  const overlay = new PIXI.Graphics();
  overlay.rect(0, 0, app.renderer.width, app.renderer.height).fill({ color: 0x000000, alpha: baseDim });
  overlay.zIndex = 10;
  container.addChild(overlay);

  let sprites = [];
  let resizers = [];
  let idx = 0;
  let dir = 1;
  let running = false;
  let elapsed = 0;
  let phase = "hold";
  let current = 0, next = 1;

  function layout() {
    overlay.clear();
    overlay.rect(0, 0, app.renderer.width, app.renderer.height).fill({ color: 0x000000, alpha: baseDim });
    resizers.forEach(fn => fn && fn());
  }

  async function loadFrames() {
    if (onLog) onLog("FogRoller: loading frames...");
    const txs = [];
    for (const f of frames) {
      const tx = await loadOne(f);
      txs.push(tx);
    }
    if (onLog) onLog(`FogRoller: loaded ${txs.length} frame(s)`);
    sprites = [];
    resizers = [];
    txs.forEach((tx, i) => {
      const { sprite, resize } = makeFullScreenSprite(tx, app);
      sprite.alpha = (i === 0) ? 1 : 0;
      sprite.zIndex = i;
      sprites.push(sprite);
      resizers.push(resize);
      container.addChildAt(sprite, 0); // behind overlay
    });
    layout();
  }

  function advanceIndex() {
    if (pingPong) {
      if (idx + dir >= frames.length || idx + dir < 0) dir *= -1;
      idx += dir;
    } else {
      idx = (idx + 1) % frames.length;
    }
    current = idx;
    next = (idx + dir + frames.length) % frames.length;
  }

  function tick(dt) {
    if (!running || sprites.length < 2) return;
    const seconds = dt / 60;
    elapsed += seconds;

    if (phase === "hold") {
      if (elapsed >= holdTime) {
        phase = "fade";
        elapsed = 0;
      }
    } else {
      const t = Math.min(1, elapsed / fadeTime);
      sprites[current].alpha = 1 - t;
      sprites[next].alpha = t;
      if (elapsed >= fadeTime) {
        sprites.forEach((s, i) => { s.alpha = (i === next) ? 1 : 0; });
        phase = "hold";
        elapsed = 0;
        advanceIndex();
      }
    }
  }

  async function start() {
    if (running) return;
    await loadFrames();
    running = true;
    app.ticker.add(tick);
    const onResize = () => layout();
    window.addEventListener("resize", onResize);
    container.__fog_onResize = onResize;
  }

  function stop() {
    if (!running) return;
    running = false;
    app.ticker.remove(tick);
  }

  function destroy() {
    stop();
    if (container.__fog_onResize) {
      window.removeEventListener("resize", container.__fog_onResize);
      container.__fog_onResize = null;
    }
    sprites.forEach(s => s.destroy({ texture: false, baseTexture: false }));
    sprites = [];
    resizers = [];
    container.destroy({ children: true });
  }

  return { container, start, stop, destroy };
}
