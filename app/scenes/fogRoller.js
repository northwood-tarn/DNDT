// app/scenes/fogRoller.js
// Slow crossfade between fog frames to simulate subtle motion.
// Exposes: start(), stop(), fadeOut(ms).
// Uses PIXI container alpha for fades (no DOM/CSS).

(function () {
  function createFogRoller(app, opts) {
    opts = Object.assign({
      frames: [
        "./assets/images/background/fog_01.png",
        "./assets/images/background/fog_02.png",
        "./assets/images/background/fog_03.png",
        "./assets/images/background/fog_04.png"
      ],
      holdTime: 16,     // seconds each frame stays fully visible
      fadeTime: 8,      // seconds spent crossfading
      pingPong: true,   // 1→2→3→4→3→2→1 (no hard seam)

      baseDim: 0.0,     // optional overall darkening (0–1)
      vignette: 0.0,    // optional vignette strength (0–1)
      featherPx: 220
    }, opts || {});

    const container = new PIXI.Container();
    container.alpha = 1;

    let sprites = [];
    let dimmer = null, vignette = null;
    let iCurrent = 0, iNext = 0, dir = 1;
    let phase = "hold"; // "hold" | "fade"
    let t = 0;

    let resizeHandler = null;
    let fading = false;
    let fadeTicker = null;

    function coverScale(sprite, vw, vh) {
      const tw = sprite.texture.width;
      const th = sprite.texture.height;
      const s = Math.max(vw / tw, vh / th);
      sprite.width = tw * s;
      sprite.height = th * s;
      sprite.x = (vw - sprite.width) * 0.5;
      sprite.y = (vh - sprite.height) * 0.5;
    }

    function makeVignette(w, h, featherPx, strength) {
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const g = c.getContext("2d");
      const cx=w/2, cy=h/2, r=Math.hypot(cx,cy);
      const grad = g.createRadialGradient(cx,cy,Math.max(0,r-featherPx), cx,cy, r);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, `rgba(0,0,0,${strength})`);
      g.fillStyle = grad; g.fillRect(0,0,w,h);
      const tex = PIXI.Texture.from(c);
      const spr = new PIXI.Sprite(tex);
      spr.width = w; spr.height = h;
      return spr;
    }

    function nextIndex(idx, d) {
      if (!opts.pingPong) return (idx + 1) % sprites.length;
      if (idx === sprites.length - 1) d = -1;
      if (idx === 0) d = 1;
      dir = d;
      return idx + dir;
    }

    async function mount() {
      const textures = await Promise.all(opts.frames.map(p => PIXI.Assets.load(p)));
      const vw = app.renderer.width, vh = app.renderer.height;

      textures.forEach((tex, idx) => {
        const spr = new PIXI.Sprite(tex);
        coverScale(spr, vw, vh);
        spr.alpha = (idx === 0) ? 1 : 0;
        spr.roundPixels = true;
        container.addChild(spr);
        sprites.push(spr);
      });

      if (opts.baseDim > 0) {
        dimmer = new PIXI.Graphics().beginFill(0x000000).drawRect(0,0,vw,vh).endFill();
        dimmer.alpha = opts.baseDim;
        dimmer.blendMode = PIXI.BLEND_MODES.MULTIPLY;
        container.addChild(dimmer);
      }
      if (opts.vignette > 0) {
        vignette = makeVignette(vw, vh, opts.featherPx, opts.vignette);
        container.addChild(vignette);
      }

      iCurrent = 0;
      iNext = (sprites.length > 1) ? nextIndex(iCurrent, dir) : 0;
      phase = "hold";
      t = 0;

      app.ticker.add(onTick);

      resizeHandler = () => {
        const w = app.renderer.width, h = app.renderer.height;
        sprites.forEach(s => coverScale(s, w, h));
        if (dimmer) dimmer.clear().beginFill(0x000000).drawRect(0,0,w,h).endFill();
        if (vignette) {
          if (vignette.parent) vignette.parent.removeChild(vignette);
          vignette.destroy(true);
          vignette = makeVignette(w, h, opts.featherPx, opts.vignette);
          container.addChild(vignette);
        }
      };
      app.renderer.on("resize", resizeHandler);
    }

    function onTick(delta) {
      if (sprites.length <= 1 || fading) return;
      const dt = delta / 60; // seconds at ~60fps
      t += dt;

      if (phase === "hold") {
        if (t >= opts.holdTime) {
          t = 0;
          phase = "fade";
          sprites[iNext].alpha = 0;
        }
      } else if (phase === "fade") {
        const a = Math.min(1, t / opts.fadeTime);
        sprites[iCurrent].alpha = 1 - a;
        sprites[iNext].alpha = a;
        if (a >= 1) {
          iCurrent = iNext;
          iNext = nextIndex(iCurrent, dir);
          t = 0;
          phase = "hold";
        }
      }
    }

    function unmount() {
      app.ticker.remove(onTick);
      if (fadeTicker) {
        app.ticker.remove(fadeTicker);
        fadeTicker = null;
      }
      if (resizeHandler) {
        app.renderer.off("resize", resizeHandler);
        resizeHandler = null;
      }
      [vignette, dimmer, ...sprites].forEach(s => {
        if (!s) return;
        if (s.parent) s.parent.removeChild(s);
        if (s.destroy) try { s.destroy(true); } catch(_) {}
      });
      sprites = [];
    }

    // Centralized fade-out using PIXI ticker (no CSS)
    function fadeOut(ms = 2000) {
      return new Promise(resolve => {
        if (fading) { resolve(); return; }
        fading = true;
        const total = Math.max(1, ms);
        let elapsed = 0;
        const startAlpha = container.alpha;
        fadeTicker = (delta) => {
          const dt = (delta / 60) * 1000; // ms
          elapsed += dt;
          const k = Math.min(1, elapsed / total);
          container.alpha = (1 - k) * startAlpha;
          if (k >= 1) {
            app.ticker.remove(fadeTicker);
            fadeTicker = null;
            container.alpha = 0;
            unmount();
            resolve();
          }
        };
        app.ticker.add(fadeTicker);
      });
    }

    return {
      container,
      start: async () => { if (sprites.length === 0) await mount(); },
      stop:  () => { unmount(); },
      fadeOut
    };
  }

  window.createFogRoller = createFogRoller;
})();
