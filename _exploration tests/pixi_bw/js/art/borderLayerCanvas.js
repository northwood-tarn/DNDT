// art/borderLayerCanvas.js
// Architect-style border + canyon & bridge, rendered on an offscreen Canvas 2D.
// Exports a factory that returns { canvas, addDoorway(x,y,w,h), isBlockedTile(x,y), redraw() }.
// Coordinates for doorways/canyon/bridge are in *world pixels*; collision works on tile grid.

import { TILE_SIZE, WORLD_TILES_X, WORLD_TILES_Y } from '../constants.js';

const PALETTE = { ink: '#ffffff', bg: '#000000' };

export function createBorderLayerCanvas() {
  const width = WORLD_TILES_X * TILE_SIZE;
  const height = WORLD_TILES_Y * TILE_SIZE;

  // Offscreen canvas (works in all modern browsers via in-memory <canvas>)
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });

  // Helpers
  function crisp() {
    ctx.imageSmoothingEnabled = false;
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
  }
  function strokeLine(w=2, a=1) { ctx.strokeStyle = PALETTE.ink; ctx.globalAlpha = a; ctx.lineWidth = w; }
  function fillBG() { ctx.fillStyle = PALETTE.bg; }

  // Collision mask (tile-based)
  const blocked = new Set();
  const tid = (x,y) => y*WORLD_TILES_X + x;
  function clearMask() { blocked.clear(); }
  function isBlockedTile(x, y) {
    if (x <= 0 || y <= 0 || x >= WORLD_TILES_X-1 || y >= WORLD_TILES_Y-1) return true; // firm outer border
    return blocked.has(tid(x,y));
  }

  // --- Architectural border (rectangle with broad undulation + micro jitter) ---
  function drawArchitectBorder() {
    crisp();
    // Thick striking line + feather + hairline
    const STROKE_MAIN = 8, STROKE_FEATHER = 3, STROKE_HAIR = 1;
    const inset = 8; // keep strokes fully inside

    // Build smooth loop via low-frequency undulation along each edge
    function edge(x0,y0,x1,y1, nx,ny, amp=2.5, micro=0.6, step=16, seed=7){
      const dx=x1-x0, dy=y1-y0, len=Math.hypot(dx,dy), steps=Math.max(2,Math.floor(len/step));
      const pts=[];
      for(let i=0;i<=steps;i++){
        const t=i/steps;
        const x=x0+dx*t, y=y0+dy*t;
        const lf=t*(1.0+0.12*0.5);
        const n1=Math.cos((lf*2.1+seed)*2.0)*0.55;
        const n2=Math.cos((lf*0.9+seed*1.7)*3.1)*0.30;
        const n3=Math.cos((lf*1.7+seed*2.3)*1.3)*0.15;
        const broad=(n1+n2+n3)*amp;
        const rseed = Math.sin((i+seed)*12.9898)*43758.5453; const r=(rseed-Math.floor(rseed));
        const microJ=(r*2-1)*micro;
        pts.push({x:x+nx*(broad+microJ), y:y+ny*(broad+microJ)});
      }
      return pts;
    }
    const L=inset, T=inset, R=width-inset, B=height-inset;
    const top = edge(L,T,R,T, 0,-1);
    const right = edge(R,T,R,B, +1,0);
    const bottom = edge(R,B,L,B, 0,+1);
    const left = edge(L,B,L,T, -1,0);
    const loop=[...top,...right,...bottom,...left];

    // Main stroke
    strokeLine(STROKE_MAIN, 1.0);
    ctx.beginPath(); ctx.moveTo(loop[0].x, loop[0].y);
    for (let i=1;i<loop.length;i++) ctx.lineTo(loop[i].x, loop[i].y);
    ctx.closePath(); ctx.stroke();

    // Feather
    strokeLine(STROKE_FEATHER, 0.75);
    ctx.beginPath(); ctx.moveTo(loop[0].x, loop[0].y);
    for (let i=1;i<loop.length;i++) ctx.lineTo(loop[i].x, loop[i].y);
    ctx.closePath(); ctx.stroke();

    // Hairline
    strokeLine(STROKE_HAIR, 0.45);
    ctx.beginPath(); ctx.moveTo(loop[0].x, loop[0].y);
    for (let i=1;i<loop.length;i++) ctx.lineTo(loop[i].x, loop[i].y);
    ctx.closePath(); ctx.stroke();

    // Light inner hatch band
    strokeLine(1, 0.12);
    const bandInset = inset + 14;
    ctx.beginPath();
    ctx.rect(bandInset, bandInset, width - bandInset*2, height - bandInset*2);
    ctx.clip();
    const hatchStep = 12;
    for(let y=bandInset; y<height-bandInset; y+=hatchStep){
      ctx.beginPath();
      ctx.moveTo(bandInset, y);
      ctx.lineTo(width - bandInset, y + 8);
      ctx.stroke();
    }
    ctx.restore && ctx.restore(); // harmless if no save
  }

  // --- Canyon (crevasse) + stone bridge ---
  // We define a polyline in *tile space* running left->right near the top-left area.
  const PATH = [];
  (function buildPath(){
    // start near top-left, run gently down-right across world
    const startX = 4, startY = 6;
    const segments = 18;
    for (let i=0;i<=segments;i++){
      const x = startX + i * ((WORLD_TILES_X-8 - startX) / segments);
      const y = startY + Math.sin(i*0.35) * 1.2 + i * 0.1;
      PATH.push({ x, y });
    }
  })();
  const HALF_W = 1.9; // tiles half-width

  function rimAt(t){
    const idx = t*(PATH.length-1);
    const i0 = Math.floor(idx), i1 = Math.min(PATH.length-1, i0+1);
    const lt = idx - i0;
    const a = PATH[i0], b = PATH[i1];
    const px = a.x + (b.x-a.x)*lt, py = a.y + (b.y-a.y)*lt;
    const nx = b.x-a.x, ny = b.y-a.y;
    const len = Math.hypot(nx,ny) || 1;
    const ux = -ny/len, uy = nx/len;
    return { L:{ x:(px-ux*HALF_W)*TILE_SIZE, y:(py-uy*HALF_W)*TILE_SIZE },
             R:{ x:(px+ux*HALF_W)*TILE_SIZE, y:(py+uy*HALF_W)*TILE_SIZE } };
  }

  const T_BRIDGE = 0.32; // place bridge near top-left
  const rims = rimAt(T_BRIDGE);
  const BRIDGE_A = rims.L, BRIDGE_B = rims.R;

  function drawCanyonAndBridge() {
    crisp();
    // Sample rims
    const steps = PATH.length*3;
    const L=[], R=[];
    for (let i=0;i<=steps;i++){
      const r = rimAt(i/steps);
      L.push(r.L); R.push(r.R);
    }

    // Fill void with bg (ensures crisp black crevasse)
    fillBG();
    ctx.beginPath();
    for (let i=0;i<L.length;i++){ const p=L[i]; if(!i) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y); }
    for (let i=R.length-1;i>=0;i--){ const p=R[i]; ctx.lineTo(p.x,p.y); }
    ctx.closePath(); ctx.fill();

    // Heavy rims
    strokeLine(3, 1);
    ctx.beginPath(); for (let i=0;i<L.length;i++){ const p=L[i]; if(!i) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y);} ctx.stroke();
    ctx.beginPath(); for (let i=0;i<R.length;i++){ const p=R[i]; if(!i) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y);} ctx.stroke();

    // Cross-hatching
    strokeLine(1.5, 1);
    for (let i=2;i<L.length-2;i+=2){
      const a=L[i], b=R[i];
      const x1=a.x, y1=a.y;
      const x2=x1 + (b.x-a.x)*0.22, y2=y1 + (b.y-a.y)*0.22;
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
      const x3=x1 + (b.x-a.x)*0.12, y3=y1 + (b.y-a.y)*0.12;
      ctx.beginPath(); ctx.moveTo(x3,y3); ctx.lineTo(x3 + (b.y-a.y)*0.3, y3 - (b.x-a.x)*0.3); ctx.stroke();
    }

    // Stone bridge (rails + block seams)
    strokeLine(3, 1);
    const x1 = BRIDGE_A.x, y1 = BRIDGE_A.y;
    const x2 = BRIDGE_B.x, y2 = BRIDGE_B.y;
    // parallel rails
    ctx.beginPath(); ctx.moveTo(x1, y1-7); ctx.lineTo(x2, y2-7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1+7); ctx.lineTo(x2, y2+7); ctx.stroke();
    // stone blocks across
    const stepsB = 12;
    for (let i=0;i<=stepsB;i++){
      const t=i/stepsB, px=x1+(x2-x1)*t, py=y1+(y2-y1)*t;
      strokeLine(2, 1);
      ctx.beginPath(); ctx.moveTo(px-8, py); ctx.lineTo(px+8, py); ctx.stroke();
      if (i<stepsB){ // vertical seams
        ctx.beginPath(); ctx.moveTo(px, py-7); ctx.lineTo(px, py+7); ctx.stroke();
      }
    }
  }

  // Build collision (canyon blocks except at bridge corridor)
  function rebuildCollisionMask() {
    clearMask();
    // Canyon occupancy in tiles: distance from tile center to midline <= HALF_W, except near bridge line
    function distPointSeg(px,py, ax,ay, bx,by){
      const vx=bx-ax, vy=by-ay, wx=px-ax, wy=py-ay;
      const c1=vx*wx+vy*wy, c2=vx*vx+vy*vy; const t=c2?Math.max(0,Math.min(1,c1/c2)):0;
      const cx=ax+vx*t, cy=ay+vy*t; return Math.hypot(px-cx, py-cy);
    }
    const bridgeDist = (px,py) => distPointSeg(px,py, BRIDGE_A.x/TILE_SIZE, BRIDGE_A.y/TILE_SIZE, BRIDGE_B.x/TILE_SIZE, BRIDGE_B.y/TILE_SIZE);

    const samples=260;
    for(let i=0;i<samples;i++){
      const t=i/(samples-1);
      const idx=t*(PATH.length-1), i0=Math.floor(idx), i1=Math.min(PATH.length-1,i0+1), lt=idx-i0;
      const a=PATH[i0], b=PATH[i1];
      const px=a.x+(b.x-a.x)*lt, py=a.y+(b.y-a.y)*lt;
      const rad=HALF_W*1.02;
      for(let ty=max(1, Math.floor(py-rad)); ty<=min(WORLD_TILES_Y-2, Math.ceil(py+rad)); ty++){
        for(let tx=max(1, Math.floor(px-rad)); tx<=min(WORLD_TILES_X-2, Math.ceil(px+rad)); tx++){
          const d=Math.hypot((tx+0.5)-px, (ty+0.5)-py);
          if(d<=rad && bridgeDist(tx+0.5,ty+0.5) >= 1.4){ blocked.add(tid(tx,ty)); }
        }
      }
    }

    function min(a,b){ return a<b?a:b;} function max(a,b){ return a>b?a:b;}
  }

  // Doorway overlays (drawn AFTER border/terrain, as black rectangles)
  const doorwayRects = [];
  function addDoorway(x,y,w,h){
    doorwayRects.push({x,y,w,h});
    ctx.fillStyle = PALETTE.bg;
    ctx.fillRect(x, y, w, h);
  }

  // Full redraw
  function redraw(){
    // base fill
    fillBG(); ctx.fillRect(0,0,width,height);
    // border
    drawArchitectBorder();
    // canyon + bridge
    drawCanyonAndBridge();
    // doorway overlays last
    for (const r of doorwayRects){ ctx.fillStyle=PALETTE.bg; ctx.fillRect(r.x, r.y, r.w, r.h); }
    rebuildCollisionMask();
  }

  // Initial draw
  redraw();

  return { canvas, addDoorway, isBlockedTile, redraw };
}
