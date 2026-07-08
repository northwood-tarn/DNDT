// main.js — Canvas 2D wisps with FBM noise (no rectangles, soft edges)

const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
const cnv = document.getElementById('c') || (() => {
  const c = document.createElement('canvas');
  c.id = 'c';
  document.body.style.margin = '0';
  document.body.style.background = '#000';
  document.body.appendChild(c);
  return c;
})();
const ctx = cnv.getContext('2d', { alpha: true });

function resize() {
  cnv.width  = Math.floor(innerWidth  * DPR);
  cnv.height = Math.floor(innerHeight * DPR);
}
resize();
addEventListener('resize', resize);

/* ---------- Seamless FBM noise (once) ---------- */
function makeSeamlessFBM(size = 1024, octaves = 5) {
  // value-noise grid
  const rnd = (x,y)=> {
    // small hash -> 0..1
    const s = Math.sin(x*127.1 + y*311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const smooth = (t)=> t*t*(3-2*t);

  function vnoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const s = rnd(xi, yi),  t = rnd(xi+1, yi);
    const u = rnd(xi, yi+1), v = rnd(xi+1, yi+1);
    const sx = smooth(xf), sy = smooth(yf);
    const a = s + (t - s)*sx;
    const b = u + (v - u)*sx;
    return a + (b - a)*sy;
  }

  // tileable by wrapping coordinates
  const N = size;
  const data = new Float32Array(N*N);
  for (let y=0; y<N; y++) {
    for (let x=0; x<N; x++) {
      let amp = 0.5, freq = 1.0, sum = 0.0, norm = 0.0;
      for (let o=0; o<octaves; o++) {
        // wrap coords to tile
        const u = ((x / N) * freq) % 1.0;
        const v = ((y / N) * freq) % 1.0;
        sum  += amp * vnoise(u * N, v * N);
        norm += amp;
        amp  *= 0.5;
        freq *= 2.0;
      }
      data[y*N + x] = sum / norm;
    }
  }
  // to canvas
  const tex = document.createElement('canvas');
  tex.width = tex.height = N;
  const g = tex.getContext('2d');
  const img = g.createImageData(N, N);
  for (let i=0; i<data.length; i++) {
    const v = Math.max(0, Math.min(255, Math.round(data[i] * 255)));
    img.data[i*4+0] = v;
    img.data[i*4+1] = v;
    img.data[i*4+2] = v;
    img.data[i*4+3] = 255;
  }
  g.putImageData(img, 0, 0);
  return tex;
}
const NOISE = makeSeamlessFBM(1024, 5);

/* ---------- Wisp (offscreen render each frame) ---------- */
class Wisp {
  constructor(opts={}) {
    this.t = 0;
    this.dead = false;

    const W = cnv.width, H = cnv.height, M = Math.max(W,H);
    const margin = M * 0.18;
    // start pos: top-right offscreen (unless inView)
    if (opts.inView) {
      this.x = opts.x ?? W*0.5;
      this.y = opts.y ?? H*0.5;
    } else {
      this.x = W + margin * (0.2 + Math.random()*0.8);
      this.y = -margin * (0.1 + Math.random()*0.8);
    }

    const speed = opts.speed ?? (0.55 * (0.9 + Math.random()*0.3));
    let dx = -0.92 + Math.random()*-0.15, dy = 0.62 + Math.random()*0.12;
    const n = Math.hypot(dx,dy)||1; dx/=n; dy/=n;
    this.vx = dx * speed * 2.0;
    this.vy = dy * speed * 2.0;

    this.baseScale = (opts.scale ?? (1.1 + Math.random()*1.0)) * (M/900);
    this.scale = this.baseScale;
    this.rot = (Math.random()-0.5)*0.1;
    this.rotVel = (Math.random()-0.5)*0.0008;

    this.total   = opts.total ?? (8*60 + Math.random()*7*60); // frames
    this.fadeIn  = this.total * 0.28;
    this.fadeOut = this.total * 0.32;
    this.maxAlpha= opts.alpha ?? 0.58;

    // tint teal-ish with mild jitter
    const base = [[11,44,39],[21,95,89],[63,178,166]][(Math.random()*3)|0];
    const j = v => Math.max(0, Math.min(255, Math.round(v + (Math.random()*20-10))));
    this.tint = [j(base[0]), j(base[1]), j(base[2])];

    // per-frame noise scrolling
    this.nu = Math.random()*NOISE.width;
    this.nv = Math.random()*NOISE.height;
    this.nux = (0.2 + Math.random()*0.3) * (Math.random()<0.5?-1:1);
    this.nvy = (0.1 + Math.random()*0.2) * (Math.random()<0.5?-1:1);

    // offscreen buffer for masked patch
    const S = Math.round(512 * DPR);
    this.buf = document.createElement('canvas');
    this.buf.width = this.buf.height = S;
    this.bctx = this.buf.getContext('2d');
  }

  step() {
    this.t += 1;

    // alpha envelope
    let a;
    if (this.t < this.fadeIn) a = this.t / this.fadeIn;
    else if (this.t > this.total - this.fadeOut) a = 1 - (this.t - (this.total - this.fadeOut)) / this.fadeOut;
    else a = 1;
    this.alpha = this.maxAlpha * a;

    // motion + breathing
    this.x += this.vx;
    this.y += this.vy;
    this.rot += this.rotVel;
    const breathe = 1.0 + Math.sin(this.t*0.015 + this.x*0.0005)*0.025;
    this.scale = this.baseScale * breathe;

    // scroll noise coords (wrap)
    const N = NOISE.width;
    this.nu = (this.nu + this.nux) % N; if (this.nu < 0) this.nu += N;
    this.nv = (this.nv + this.nvy) % N; if (this.nv < 0) this.nv += N;

    // cull
    const W = cnv.width, H = cnv.height, M = Math.max(W,H);
    if (this.t >= this.total || this.x < -M*0.6 || this.y > H + M*0.6) {
      this.dead = true;
    }
  }

  draw(g) {
    const b = this.bctx;
    const S = this.buf.width; // offscreen size (DPR-scaled)

    // 1) render moving noise patch into buffer
    b.globalCompositeOperation = 'source-over';
    b.globalAlpha = 1;
    b.clearRect(0,0,S,S);

    // pick a tileable region from NOISE (wrap in 4 draws if near edge)
    const N = NOISE.width;
    const sw = Math.floor(S * 0.9), sh = Math.floor(S * 0.9);
    let sx = Math.floor(this.nu) - (sw>>1);
    let sy = Math.floor(this.nv) - (sh>>1);
    const drawPatch = (dx,dy,sx0,sy0,sw0,sh0) => {
      b.drawImage(NOISE, sx0, sy0, sw0, sh0, dx, dy, sw0, sh0);
    };

    // handle wrapping by splitting draws
    const dx = (S - sw)>>1, dy = (S - sh)>>1;
    const wrapX = (a)=> (a+N)%N;
    const nx = sx<0 ? -sx : (sx+sw>N ? N-(sx+sw) : 0);
    const ny = sy<0 ? -sy : (sy+sh>N ? N-(sy+sh) : 0);

    // draw main
    drawPatch(dx,dy, wrapX(sx), wrapX(sy), Math.min(sw, N - wrapX(sx)), Math.min(sh, N - wrapX(sy)));
    // wrap x?
    if (sx<0 || sx+sw>N) {
      const sx2 = wrapX(sx) + Math.min(sw, N - wrapX(sx));
      const w2  = sw - Math.min(sw, N - wrapX(sx));
      if (w2>0) drawPatch(dx + Math.min(sw, N - wrapX(sx)), dy, 0, wrapX(sy), w2, Math.min(sh, N - wrapX(sy)));
    }
    // wrap y?
    if (sy<0 || sy+sh>N) {
      const sy2 = wrapX(sy) + Math.min(sh, N - wrapX(sy));
      const h2  = sh - Math.min(sh, N - wrapX(sy));
      if (h2>0) drawPatch(dx, dy + Math.min(sh, N - wrapX(sy)), wrapX(sx), 0, Math.min(sw, N - wrapX(sx)), h2);
    }
    // wrap both?
    if ((sx<0 || sx+sw>N) && (sy<0 || sy+sh>N)) {
      const w2  = sw - Math.min(sw, N - wrapX(sx));
      const h2  = sh - Math.min(sh, N - wrapX(sy));
      if (w2>0 && h2>0) drawPatch(dx + Math.min(sw, N - wrapX(sx)), dy + Math.min(sh, N - wrapX(sy)), 0, 0, w2, h2);
    }

    // 2) map noise to teal and feather edges inside buffer
    //    colorize by filling with tint "source-in"
    b.globalCompositeOperation = 'source-in';
    b.fillStyle = `rgb(${this.tint[0]},${this.tint[1]},${this.tint[2]})`;
    b.fillRect(0,0,S,S);

    //    feather: radial gradient alpha mask via destination-in
    const grd = b.createRadialGradient(S/2, S/2, S*0.1, S/2, S/2, S*0.47);
    grd.addColorStop(0.00, 'rgba(255,255,255,1)');
    grd.addColorStop(0.70, 'rgba(255,255,255,0.7)');
    grd.addColorStop(1.00, 'rgba(255,255,255,0)');
    b.globalCompositeOperation = 'destination-in';
    b.fillStyle = grd;
    b.fillRect(0,0,S,S);

    // 3) draw buffer to main with rotation/scale/blur + additive blend
    g.save();
    g.translate(this.x, this.y);
    g.rotate(this.rot);
    const s = this.scale * (S / DPR);
    g.filter = 'blur(3px)';                      // softens interior
    g.globalCompositeOperation = 'lighter';      // bright over black
    g.globalAlpha = this.alpha;
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(this.buf, -s/2, -s/2, s, s);
    g.restore();
  }
}

/* ---------- Scheduler & Loop ---------- */
const wisps = [];

function spawnWisp(opts){ wisps.push(new Wisp(opts)); }

function spawnWave() {
  // 5 wisps per wave → overlap ~half screen diagonally
  const count = 5;
  let i = 0;
  const kick = () => {
    spawnWisp();
    i++;
    if (i < count) {
      setTimeout(kick, 900 + Math.random()*700);
    }
  };
  spawnWisp();
  if (Math.random() < 0.6) setTimeout(()=>spawnWisp(), 300);
  setTimeout(kick, 400);
}

function runWaves() {
  spawnWave();
  setInterval(spawnWave, 5000 + Math.random()*1500);
}
runWaves();

// Optional: force a visible wisp with E (in view)
addEventListener('keydown', (e)=>{
  if (e.key.toLowerCase()==='e') spawnWisp({ inView:true });
});

function frame() {
  // clear black
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.filter = 'none';
  ctx.fillStyle = '#000';
  ctx.fillRect(0,0,cnv.width,cnv.height);

  // step/draw wisps
  for (let i=wisps.length-1; i>=0; i--) {
    const w = wisps[i];
    w.step();
    w.draw(ctx);
    if (w.dead) wisps.splice(i,1);
  }

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);