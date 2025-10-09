import { makeRng } from "../util/random.js";

function offscreen(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  draw(g, w, h);
  return c;
}

function jitterLine(g, x1, y1, x2, y2, rng, jitter = 0.8, strokes = 1) {
  for (let s = 0; s < strokes; s++) {
    const jx1 = x1 + (rng() - 0.5) * jitter;
    const jy1 = y1 + (rng() - 0.5) * jitter;
    const jx2 = x2 + (rng() - 0.5) * jitter;
    const jy2 = y2 + (rng() - 0.5) * jitter;
    g.beginPath();
    g.moveTo(jx1, jy1);
    g.lineTo(jx2, jy2);
    g.stroke();
  }
}

export function buildTextures(seed = 4242) {
  const rng = makeRng(seed);
  const stroke = (g, alpha = 0.85, w = 1) => {
    g.strokeStyle = `rgba(255,255,255,${alpha})`;
    g.lineWidth = w;
    g.lineCap = "round";
  };

  // Roof shingles (intact)
  const roof = offscreen(64, 64, (g, W, H) => {
    g.clearRect(0,0,W,H);
    stroke(g, 0.85, 1);
    for (let y = 8; y < H; y += 8) {
      jitterLine(g, 0, y, W, y, rng, 1.2, 2);
      for (let x = 0; x < W; x += 16) {
        jitterLine(g, x + 2, y - 8, x + 10, y, rng, 1.1, 1);
        jitterLine(g, x + 10, y - 8, x + 18, y, rng, 1.1, 1);
      }
    }
  });

  // Broken roof shingles (missing patches + skew)
  const roofBroken = offscreen(64, 64, (g, W, H) => {
    g.clearRect(0,0,W,H);
    stroke(g, 0.8, 1);
    for (let y = 8; y < H; y += 8) {
      const skew = (rng() - 0.5) * 6;
      jitterLine(g, 0, y, W, y + skew, rng, 1.6, 2);
      for (let x = 0; x < W; x += 16) {
        if (rng() < 0.25) continue; // missing shingles patch
        jitterLine(g, x + 2, y - 8, x + 10, y + skew, rng, 1.6, 1);
        jitterLine(g, x + 10, y - 8, x + 18, y + skew, rng, 1.6, 1);
      }
    }
    // Broken rafters hints
    stroke(g, 0.35, 1);
    for (let i = 0; i < 10; i++) {
      const x = rng()*W, y = rng()*H;
      jitterLine(g, x - 6, y - 3, x + 6, y + 3, rng, 1.2, 1);
    }
  });

  // Cross-hatch wall
  const wall = offscreen(48, 48, (g, W, H) => {
    g.clearRect(0,0,W,H);
    stroke(g, 0.18, 1);
    for (let y = -H; y < H * 2; y += 6) jitterLine(g, -W, y, W*2, y + 12, rng, 0.8, 1);
    for (let y = -H; y < H * 2; y += 7) jitterLine(g, -W, y, W*2, y - 10, rng, 0.8, 1);
  });

  // Paving / plaza
  const paving = offscreen(64, 64, (g, W, H) => {
    g.clearRect(0,0,W,H);
    stroke(g, 0.12, 1);
    for (let y = 0; y <= H; y += 10) jitterLine(g, 0, y, W, y, rng, 1.2, 1);
    for (let x = 0; x <= W; x += 12) jitterLine(g, x, 0, x, H, rng, 1.2, 1);
    stroke(g, 0.06, 1);
    for (let i = 0; i < 40; i++) {
      const x = rng() * W, y = rng() * H, r = 0.8 + rng() * 1.2;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI*2); g.stroke();
    }
  });

  // Ravine strata
  const ravine = offscreen(64, 64, (g, W, H) => {
    g.clearRect(0,0,W,H);
    stroke(g, 0.25, 1);
    for (let y = 6; y < H; y += 6) jitterLine(g, 0, y, W, y + (rng()-0.5)*3, rng, 1.6, 1);
    stroke(g, 0.1, 1);
    for (let i = 0; i < 30; i++) {
      const x = rng()*W, y = rng()*H, dx = -3 + rng()*6, dy = -3 + rng()*6;
      jitterLine(g, x, y, x+dx, y+dy, rng, 0.6, 1);
    }
  });

  // Bridge planks
  const bridge = offscreen(64, 64, (g, W, H) => {
    g.clearRect(0,0,W,H);
    stroke(g, 0.6, 1.2);
    for (let x = 6; x < W; x += 10) jitterLine(g, x, 6, x, H - 6, rng, 0.8, 1);
    stroke(g, 0.85, 1.5);
    jitterLine(g, 4, 6, W - 4, 6, rng, 0.9, 2);
    jitterLine(g, 4, H - 6, W - 4, H - 6, rng, 0.9, 2);
  });

  // Debris (scribbles and stones)
  const debris = offscreen(64, 64, (g, W, H) => {
    g.clearRect(0,0,W,H);
    stroke(g, 0.28, 1);
    for (let i = 0; i < 70; i++) {
      const x = rng()*W, y = rng()*H;
      g.beginPath(); g.arc(x, y, 0.8 + rng()*1.6, 0, Math.PI*2); g.stroke();
      jitterLine(g, x-2, y, x+2, y + (rng()-0.5)*2, rng, 0.6, 1);
    }
  });

  // Grass overlay (light diagonal hatch)
  const grass = offscreen(64, 64, (g, W, H) => {
    g.clearRect(0,0,W,H);
    stroke(g, 0.10, 1);
    for (let y = -H; y < H * 2; y += 8) jitterLine(g, -W, y, W*2, y + 10, rng, 1.0, 1);
  });

  const roofCtx = roof.getContext("2d");
  const roofBrokenCtx = roofBroken.getContext("2d");
  const wallCtx = wall.getContext("2d");
  const pavingCtx = paving.getContext("2d");
  const ravineCtx = ravine.getContext("2d");
  const bridgeCtx = bridge.getContext("2d");
  const debrisCtx = debris.getContext("2d");
  const grassCtx = grass.getContext("2d");

  return {
    roof: roofCtx.createPattern(roof, "repeat"),
    roofBroken: roofBrokenCtx.createPattern(roofBroken, "repeat"),
    wall: wallCtx.createPattern(wall, "repeat"),
    paving: pavingCtx.createPattern(paving, "repeat"),
    ravine: ravineCtx.createPattern(ravine, "repeat"),
    bridge: bridgeCtx.createPattern(bridge, "repeat"),
    debris: debrisCtx.createPattern(debris, "repeat"),
    grass: grassCtx.createPattern(grass, "repeat")
  };
}