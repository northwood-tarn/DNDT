<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Fog Wisps – Canvas 2D</title>
<style>
  html, body { margin:0; height:100%; background:#000; }
  canvas { display:block; width:100vw; height:100vh; }
  .hud {
    position:fixed; left:8px; bottom:8px; color:#7ff; font:12px/1.2 system-ui, sans-serif; opacity:.7;
    background:rgba(0,0,0,.4); padding:6px 8px; border-radius:6px; user-select:none;
  }
</style>
</head>
<body>
<canvas id="c"></canvas>
<div class="hud">
  Keys: <b>D</b> toggle debug blob • <b>E</b> spawn wisp in view
</div>
<script>
(() => {
  const tealDark  = [ 11, 44, 39 ];
  const tealMid   = [ 21, 95, 89 ];
  const tealLight = [ 63,178,166 ];
  const palette = [tealDark, tealMid, tealLight];

  const cnv = document.getElementById('c');
  const ctx = cnv.getContext('2d');
  const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

  function resize() {
    cnv.width  = Math.floor(innerWidth  * DPR);
    cnv.height = Math.floor(innerHeight * DPR);
  }
  resize();
  addEventListener('resize', resize);

  // ---- one soft fog texture (offscreen) ----
  function makeFogTexture(size = 768) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');

    const blob = (cx, cy, r, a) => {
      const grd = g.createRadialGradient(cx, cy, 0, cx, cy, r);
      grd.addColorStop(0.00, `rgba(255,255,255,${a})`);
      grd.addColorStop(0.50, `rgba(255,255,255,${a*0.55})`);
      grd.addColorStop(1.00, `rgba(255,255,255,0)`);
      g.fillStyle = grd;
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI*2); g.fill();
    };

    g.clearRect(0,0,size,size);
    const R = size*0.45;
    blob(size*0.50, size*0.50, R*1.00, 0.85);
    blob(size*0.64, size*0.46, R*0.75, 0.55);
    blob(size*0.36, size*0.60, R*0.70, 0.45);
    blob(size*0.50, size*0.70, R*0.55, 0.35);
    return c;
  }
  const fogTex = makeFogTexture(768);

  // ---- utils ----
  const lerp = (a,b,t)=>a+(b-a)*t;
  const clamp01 = x=>Math.max(0,Math.min(1,x));
  const rgb = (arr)=>`rgb(${arr[0]},${arr[1]},${arr[2]})`;

  // ---- wisp class ----
  class Wisp {
    constructor(opts={}) {
      const W = cnv.width, H = cnv.height, M = Math.max(W,H);
      const pxScale = M/900;

      // start position (top-right offscreen, unless inView)
      if (opts.inView) {
        this.x = opts.x ?? W*0.5;
        this.y = opts.y ?? H*0.5;
      } else {
        const margin = M*0.18;
        this.x = W + margin * (0.2 + Math.random()*0.8);
        this.y = -margin * (0.1 + Math.random()*0.8);
      }

      this.baseScale = (opts.scale ?? (1.1 + Math.random()*1.0)) * pxScale;
      this.scale = this.baseScale;
      this.rot = 0;
      this.rotVel = (Math.random()-0.5)*0.0006;

      // drift roughly top-right -> bottom-left
      const speed = opts.speed ?? (0.55 * (0.9 + Math.random()*0.3));
      let dx = -0.92 + Math.random()*-0.15, dy = 0.62 + Math.random()*0.12;
      const n = Math.hypot(dx,dy)||1; dx/=n; dy/=n;
      this.vx = dx * speed * 2.0;
      this.vy = dy * speed * 2.0;

      this.total = opts.total ?? (8*60 + Math.random()*7*60); // frames ~8–15s
      this.fadeIn = this.total * 0.28;
      this.fadeOut= this.total * 0.32;

      this.t = 0;
      this.a = 0; // alpha
      this.maxAlpha = (opts.alpha ?? 0.58);

      // tint: pick from palette + tiny jitter
      const base = palette[(Math.random()*palette.length)|0];
      const j = (v)=>Math.max(0, Math.min(255, Math.round(v + (Math.random()*20-10))));
      this.tint = [j(base[0]), j(base[1]), j(base[2])];
    }
    step() {
      this.t += 1;

      // alpha envelope
      if (this.t < this.fadeIn) this.a = this.t/this.fadeIn;
      else if (this.t > this.total - this.fadeOut) this.a = 1 - (this.t-(this.total-this.fadeOut))/this.fadeOut;
      else this.a = 1;
      this.a *= this.maxAlpha;

      // motion + gentle breathing
      this.x += this.vx;
      this.y += this.vy;
      this.rot += this.rotVel;
      const breathe = 1.0 + Math.sin(this.t*0.015 + this.x*0.0005)*0.025;
      this.scale = this.baseScale*breathe;

      // offscreen cull
      const W = cnv.width, H = cnv.height, M = Math.max(W,H);
      if (this.t >= this.total || this.x < -M*0.6 || this.y > H + M*0.6) {
        this.dead = true;
      }
    }
    draw(g) {
      g.save();
      g.globalAlpha = this.a;
      g.translate(this.x, this.y);
      g.rotate(this.rot);
      const s = this.scale * fogTex.width;
      g.globalCompositeOperation = 'lighter'; // brighter fog on black
      g.drawImage(fogTex, -s/2, -s/2, s, s);

      // subtle color wash
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = rgb(this.tint);
      g.fillRect(-s/2, -s/2, s, s);

      g.restore();
    }
  }

  // ---- world / scheduler ----
  const wisps = [];

  function spawnWisp(opts){ wisps.push(new Wisp(opts)); }

  function spawnWave() {
    // Wave = multiple wisps quickly so they overlap ~half diagonal
    const count = 5; // tweak to 6-7 for denser coverage
    let i = 0;
    const kick = () => {
      spawnWisp();
      i++;
      if (i < count) {
        const gap = 900 + Math.random()*700; // ms between spawns
        setTimeout(kick, gap);
      }
    };
    // start with 1–2 quick ones
    spawnWisp();
    if (Math.random() < 0.6) setTimeout(() => spawnWisp(), 300);
    setTimeout(kick, 400);
  }

  // Loop waves forever with a gap so it “breathes”
  spawnWave();
  setInterval(spawnWave, 5000 + Math.random()*1500);

  // ---- debug: a bright center blob so you can ALWAYS see something ----
  let DEBUG = false; // set true to force a center blob
  let debugBlob = null;
  function ensureDebugBlob() {
    if (!DEBUG) { debugBlob = null; return; }
    if (!debugBlob) {
      debugBlob = new Wisp({ inView:true, alpha:1.0, scale:1.8, speed:0, total:999999 });
      debugBlob.tint = [100,255,230];
    }
  }

  // ---- main loop ----
  function frame() {
    // clear black
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#000';
    ctx.fillRect(0,0,cnv.width,cnv.height);

    // step & draw wisps
    for (let i=wisps.length-1; i>=0; i--) {
      const w = wisps[i];
      w.step();
      w.draw(ctx);
      if (w.dead) wisps.splice(i,1);
    }

    // debug center blob
    ensureDebugBlob();
    if (debugBlob) {
      debugBlob.step(); // keep breathing
      debugBlob.draw(ctx);
      debugBlob.t = 0;  // don’t fade out
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---- keys ----
  addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'd') { DEBUG = !DEBUG; if (!DEBUG) debugBlob=null; }
    if (k === 'e') { spawnWisp({ inView:true }); }
  });
})();
</script>
</body>
</html>