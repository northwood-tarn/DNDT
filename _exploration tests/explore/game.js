// game.js — Architect Sketch Edition: detailed lines, buildings, frog, and canyon+bridge
import {
  PALETTE,
  drawBorderSolid,
  drawPlayerArchitect,
  drawFrog,
  drawCanyonArchitectDetailed,
  drawBridgeStone,
  drawTowerTopDetailed,
  drawHallBuilding,
  drawLShapeBuilding,
  drawGroundHatch
} from './sprites.js';

const TILE=8, SCALE=4, STILE=TILE*SCALE;
const VIEW_W_T=19, VIEW_H_T=18, WORLD_W=40, WORLD_H=30;
const BG=PALETTE.bg;

const canvas=document.getElementById('game'); const ctx=canvas.getContext('2d',{alpha:false}); ctx.imageSmoothingEnabled=false;

// Canyon path and width
const PATH=[]; for(let i=0;i<12;i++) PATH.push({x:4+i*1.1, y:10 - i*0.6});
const HALF_W=1.9;

// Helper: sample opposite rims (local)
function rimAt(points, halfW, t){
  const idx=t*(points.length-1), i0=Math.floor(idx), i1=Math.min(points.length-1,i0+1), lt=idx-i0;
  const a=points[i0], b=points[i1];
  const px=a.x+(b.x-a.x)*lt, py=a.y+(b.y-a.y)*lt;
  const nx=b.x-a.x, ny=b.y-a.y; const len=Math.hypot(nx,ny)||1;
  const ux=-ny/len, uy=nx/len;
  return {L:{x:px-ux*halfW,y:py-uy*halfW}, R:{x:px+ux*halfW,y:py+uy*halfW}};
}

// Pick a bridge location and endpoints
const T_BRIDGE=0.55; const rims=rimAt(PATH, HALF_W, T_BRIDGE);
const BRIDGE_A=rims.L, BRIDGE_B=rims.R;

// Buildings and frog
const TOWERS=[ {cx:30, cy:12, r:3.2} ];
const HALLS=[ {x:24, y:20, w:10, h:6} ];
const LSHAPES=[ {x:32, y:6, w1:6, h1:6, w2:4, h2:3} ];
const FROG={ x: WORLD_W-6, y: 4 }; // place on right side

// Collision mask: canyon (except a wide bridge corridor) + building footprints (circular or rect)
// We leave the frog non-blocking for now.
const blocked=new Set(); const tid=(x,y)=> y*WORLD_W + x;
(function buildMask(){
  function distPointSeg(px,py, ax,ay, bx,by){
    const vx=bx-ax, vy=by-ay, wx=px-ax, wy=py-ay;
    const c1=vx*wx+vy*wy, c2=vx*vx+vy*vy; const t=c2?Math.max(0,Math.min(1,c1/c2)):0;
    const cx=ax+vx*t, cy=ay+vy*t; return Math.hypot(px-cx, py-cy);
  }
  const bridgeDist=(px,py)=>distPointSeg(px,py, BRIDGE_A.x,BRIDGE_A.y, BRIDGE_B.x,BRIDGE_B.y);

  // Canyon
  const samples=260;
  for(let i=0;i<samples;i++){
    const t=i/(samples-1), idx=t*(PATH.length-1), i0=Math.floor(idx), i1=Math.min(PATH.length-1,i0+1), lt=idx-i0;
    const ax=PATH[i0].x, ay=PATH[i0].y, bx=PATH[i1].x, by=PATH[i1].y;
    const px=ax+(bx-ax)*lt, py=ay+(by-ay)*lt;
    const rad=HALF_W*1.02;
    for(let y=Math.max(1,Math.floor(py-rad)); y<=Math.min(WORLD_H-2,Math.ceil(py+rad)); y++){
      for(let x=Math.max(1,Math.floor(px-rad)); x<=Math.min(WORLD_W-2,Math.ceil(px+rad)); x++){
        const d=Math.hypot((x+0.5)-px,(y+0.5)-py);
        if(d<=rad && bridgeDist(x+0.5,y+0.5) >= 1.4){ blocked.add(tid(x,y)); }
      }
    }
  }

  // Towers: circular
  for(const t of TOWERS){
    for(let y=Math.max(1,Math.floor(t.cx - t.r)); y<=Math.min(WORLD_H-2, Math.ceil(t.cx + t.r)); y++){
      for(let x=Math.max(1,Math.floor(t.cx - t.r)); x<=Math.min(WORLD_W-2, Math.ceil(t.cx + t.r)); x++){
        if(Math.hypot((x+0.5)-t.cx, (y+0.5)-t.cy) <= t.r) blocked.add(tid(x,y));
      }
    }
  }
  // Halls: rectangles
  for(const h of HALLS){ for(let y=h.y; y<h.y+h.h; y++){ for(let x=h.x; x<h.x+h.w; x++) blocked.add(tid(x,y)); } }
  // L-shapes: union of two rects
  for(const b of LSHAPES){
    for(let y=b.y; y<b.y+b.h1; y++){ for(let x=b.x; x<b.x+b.w1; x++) blocked.add(tid(x,y)); }
    for(let y=b.y+(b.h1-b.h2); y<b.y+b.h1; y++){ for(let x=b.x+(b.w1-b.w2); x<b.x+b.w1; x++) blocked.add(tid(x,y)); }
  }
})();

function isBlocked(x,y){
  if(x<=0||y<=0||x>=WORLD_W-1||y>=WORLD_H-1) return true; // firm outer border
  return blocked.has(tid(x,y));
}

// Player + camera
const player={ x: Math.floor(WORLD_W/2), y: Math.floor(WORLD_H/2) };
const camera={ x: Math.max(0, player.x-Math.floor(VIEW_W_T/2)), y: Math.max(0, player.y-Math.floor(VIEW_H_T/2)) };
function clampCamera(){ camera.x=Math.min(Math.max(0,camera.x), WORLD_W-VIEW_W_T); camera.y=Math.min(Math.max(0,camera.y), WORLD_H-VIEW_H_T); }
const MARGIN=4;
function updateCamera(){ if(player.x-camera.x<MARGIN) camera.x=player.x-MARGIN; if(player.y-camera.y<MARGIN) camera.y=player.y-MARGIN;
  if((camera.x+VIEW_W_T-1)-player.x<MARGIN) camera.x=player.x-(VIEW_W_T-1-MARGIN);
  if((camera.y+VIEW_H_T-1)-player.y<MARGIN) camera.y=player.y-(VIEW_H_T-1-MARGIN); clampCamera(); }

// Grid toggle (subtle, walkable-only) remains via G key
let showGrid=false;
window.addEventListener('keydown', (ev)=>{
  if(ev.key==='g' || ev.key==='G'){ showGrid=!showGrid; ev.preventDefault(); render(); }
});

// Render
function render(){
  ctx.fillStyle=BG; ctx.fillRect(0,0,canvas.width, canvas.height);

  // Ground hatch on walkable only
  drawGroundHatch(ctx, camera, isBlocked, STILE);

  // Canyon & bridge
  drawCanyonArchitectDetailed(ctx, PATH, HALF_W, camera, STILE);
  drawBridgeStone(ctx, BRIDGE_A, BRIDGE_B, camera, STILE);

  // Buildings
  for(const t of TOWERS) drawTowerTopDetailed(ctx, t.cx - camera.x, t.cy - camera.y, t.r, STILE);
  for(const h of HALLS) drawHallBuilding(ctx, h.x - camera.x, h.y - camera.y, h.w, h.h, STILE);
  for(const b of LSHAPES) drawLShapeBuilding(ctx, b.x - camera.x, b.y - camera.y, b.w1, b.h1, b.w2, b.h2, STILE);

  // Frog NPC
  drawFrog(ctx, FROG.x - camera.x, FROG.y - camera.y, STILE);

  // Border + player
  drawBorderSolid(ctx, camera, {w:VIEW_W_T, h:VIEW_H_T}, STILE, WORLD_W, WORLD_H);
  drawPlayerArchitect(ctx, player.x - camera.x, player.y - camera.y, STILE);
}

// Controls
function tryMove(dx,dy){ const nx=player.x+dx, ny=player.y+dy; if(!isBlocked(nx,ny)){ player.x=nx; player.y=ny; updateCamera(); render(); } }
window.addEventListener('keydown',(ev)=>{
  let dx=0,dy=0;
  switch(ev.key){ case'ArrowUp':case'w':case'W':dy=-1;break; case'ArrowDown':case's':case'S':dy=1;break;
    case'ArrowLeft':case'a':case'A':dx=-1;break; case'ArrowRight':case'd':case'D':dx=1;break; default:return; }
  ev.preventDefault(); tryMove(dx,dy);
});

(function main(){ updateCamera(); render(); })();
