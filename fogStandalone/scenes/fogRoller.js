// app/scenes/fogRoller.js
// Slow crossfade between 4 fog frames to simulate subtle motion.

(function () {
  function createFogRoller(app, opts) {
    opts = Object.assign({
      frames: [
        "./assets/fog_01.png",
        "./assets/fog_02.png",
        "./assets/fog_03.png",
        "./assets/fog_04.png"
      ],
      holdTime: 16,     // seconds each frame stays fully visible
      fadeTime: 8,      // seconds spent crossfading
      pingPong: true,   // 1→2→3→4→3→2→1 (no hard seam)

      baseDim: 0.0,     // optional overall darkening (0–1)
      vignette: 0.0,    // optional vignette streng`th (0–1)
      featherPx: 220
    }, opts || {});

    const container = new PIXI.Container();
    let sprites = [];
    let dimmer = null, vignette = null;
    let iCurrent = 0, iNext = 0, dir = 1;
    let phase = "hold"; // "hold" | "fade"
    let t = 0;

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
      app.renderer.on("resize", () => {
        const w = app.renderer.width, h = app.renderer.height;
        sprites.forEach(s => coverScale(s, w, h));
        if (dimmer) dimmer.clear().beginFill(0x000000).drawRect(0,0,w,h).endFill();
        if (vignette) {
          if (vignette.parent) vignette.parent.removeChild(vignette);
          vignette.destroy(true);
          vignette = makeVignette(w, h, opts.featherPx, opts.vignette);
          container.addChild(vignette);
        }
      });
    }

    function onTick(delta) {
      if (sprites.length <= 1) return;
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
      [vignette, dimmer, ...sprites].forEach(s => {
        if (!s) return;
        if (s.parent) s.parent.removeChild(s);
        if (s.destroy) try { s.destroy(true); } catch(_) {}
      });
      sprites = [];
    }

    return {
      container,
      start: async () => { if (sprites.length === 0) await mount(); },
      stop:  () => { unmount(); }
    };
  }

  window.createFogRoller = createFogRoller;
})();