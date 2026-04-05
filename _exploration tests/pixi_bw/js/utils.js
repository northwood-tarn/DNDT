// utils.js — border helpers

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// Cosine-mix helper (0..1)
function cs(t){ return 0.5 - 0.5*Math.cos(t); }

// Deterministic pseudo-rand in [0,1)
function rnd(n){ const s=Math.sin(n*12.9898)*43758.5453; return s - Math.floor(s); }

// Smooth, architect-style loop: broad undulation + micro jitter.
// width/height are in pixels; returns array of {x,y} (closed path when you close it).
export function generateArchitectLoop(width, height, {
  inset = 6,
  stepPx = 16,      // sampling spacing
  ampLow = 2.5,     // broad waves amplitude
  freqLow = 0.12,   // broad waves frequency
  ampMicro = 0.6,   // tiny jitter amplitude
  seed = 11,
} = {}) {
  const pts = [];
  const xL = inset, yT = inset, xR = width - inset, yB = height - inset;

  function pushEdge(x0, y0, x1, y1, nx, ny, len, edgeSeed){
    const steps = Math.max(2, Math.floor(len / stepPx));
    for(let i=0;i<=steps;i++){
      const t = i/steps;              // 0..1 along the edge
      const x = x0 + (x1 - x0)*t;
      const y = y0 + (y1 - y0)*t;

      // broad wave (cos blends with different phases)
      const lf = t * (1.0 + freqLow*0.5);
      const n1 = Math.cos((lf*2.1 + seed + edgeSeed) * 2.0) * 0.55;
      const n2 = Math.cos((lf*0.9 + seed*1.7 + edgeSeed*0.7) * 3.1) * 0.30;
      const n3 = Math.cos((lf*1.7 + seed*2.3 + edgeSeed*1.3) * 1.3) * 0.15;
      const broad = (n1 + n2 + n3) * ampLow;

      // micro jitter (very subtle, prevents "perfect straight" feel)
      const micro = (rnd(seed*100 + i*13.7 + edgeSeed*17.3) - 0.5) * 2 * ampMicro;

      pts.push({ x: x + nx*(broad + micro), y: y + ny*(broad + micro) });
    }
  }

  // Top (left->right), normal up (-y)
  pushEdge(xL, yT, xR, yT, 0, -1, xR-xL, 1);
  // Right (top->bottom), normal right (+x)
  pushEdge(xR, yT, xR, yB, +1, 0, yB-yT, 2);
  // Bottom (right->left), normal down (+y)
  pushEdge(xR, yB, xL, yB, 0, +1, xR-xL, 3);
  // Left (bottom->top), normal left (-x)
  pushEdge(xL, yB, xL, yT, -1, 0, yB-yT, 4);

  return pts;
}
