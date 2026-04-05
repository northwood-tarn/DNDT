// sprites.js — Architect Sketch Edition (black & white, detailed linework)
export const PALETTE = { ink:'#e6f0ff', bg:'#0b0e13' };
function crisp(ctx){ ctx.imageSmoothingEnabled=false; ctx.lineCap='butt'; ctx.lineJoin='miter'; }

/* ================= BORDER (solid, unbroken) ================= */
export function drawBorderSolid(ctx, camera, viewTiles, s, worldW, worldH, col=PALETTE.ink){
  crisp(ctx);
  const w=viewTiles.w*s, h=viewTiles.h*s;
  ctx.strokeStyle=col; ctx.lineWidth=6;
  ctx.strokeRect(0.5, 0.5, w-1, h-1);
}

/* ================= PLAYER (architect refresh) ================= */
export function drawPlayerArchitect(ctx, vx, vy, s, col=PALETTE.ink){
  crisp(ctx);
  const x=vx*s, y=vy*s, cx=x+s*0.5, cy=y+s*0.5;
  ctx.strokeStyle=col; ctx.fillStyle=col;
  // torso block
  ctx.fillRect(cx-s*0.12, cy-s*0.02, s*0.24, s*0.26);
  // head circle
  ctx.beginPath(); ctx.arc(cx, cy-s*0.22, s*0.12, 0, Math.PI*2); ctx.fill();
  // visor slit
  ctx.strokeStyle=PALETTE.bg; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(cx-s*0.07, cy-s*0.22); ctx.lineTo(cx+s*0.07, cy-s*0.19); ctx.stroke();
  // outline frame
  ctx.strokeStyle=col; ctx.lineWidth=2; ctx.strokeRect(x+3, y+3, s-6, s-6);
}

/* ================= FROG NPC (same footprint as player) ================= */
export function drawFrog(ctx, vx, vy, s, col=PALETTE.ink){
  crisp(ctx);
  const x=vx*s, y=vy*s, cx=x+s*0.5, cy=y+s*0.5;
  ctx.strokeStyle=col; ctx.lineWidth=2;
  // body ellipse (approximated by polyline)
  ctx.beginPath();
  ctx.ellipse(cx, cy, s*0.18, s*0.13, 0, 0, Math.PI*2);
  ctx.stroke();
  // eyes
  ctx.beginPath(); ctx.arc(cx-s*0.10, cy-s*0.12, s*0.03, 0, Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx+s*0.10, cy-s*0.12, s*0.03, 0, Math.PI*2); ctx.stroke();
  // legs (simple arcs)
  ctx.beginPath(); ctx.moveTo(cx-s*0.20, cy+s*0.06); ctx.lineTo(cx-s*0.10, cy+s*0.14); ctx.lineTo(cx, cy+s*0.10); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx+s*0.20, cy+s*0.06); ctx.lineTo(cx+s*0.10, cy+s*0.14); ctx.lineTo(cx, cy+s*0.10); ctx.stroke();
}

/* ================ CANYON (architect polylines + dense hatching) ================ */
export function drawCanyonArchitectDetailed(ctx, points, halfW, camera, s, col=PALETTE.ink){
  crisp(ctx);
  const L=[],R=[],steps=points.length*3;
  function rimAt(t){
    const idx=t*(points.length-1), i0=Math.floor(idx), i1=Math.min(points.length-1,i0+1), lt=idx-i0;
    const a=points[i0], b=points[i1];
    const px=a.x+(b.x-a.x)*lt, py=a.y+(b.y-a.y)*lt;
    const nx=b.x-a.x, ny=b.y-a.y; const len=Math.hypot(nx,ny)||1;
    const ux=-ny/len, uy=nx/len;
    return {L:{x:px-ux*halfW,y:py-uy*halfW}, R:{x:px+ux*halfW,y:py+uy*halfW}};
  }
  for(let i=0;i<=steps;i++){ const r=rimAt(i/steps); L.push(r.L); R.push(r.R); }

  // Fill void (bg)
  ctx.fillStyle=PALETTE.bg;
  ctx.beginPath();
  for(let i=0;i<L.length;i++){ const p=L[i]; const x=(p.x-camera.x)*s, y=(p.y-camera.y)*s; if(!i) ctx.moveTo(x,y); else ctx.lineTo(x,y); }
  for(let i=R.length-1;i>=0;i--){ const p=R[i]; const x=(p.x-camera.x)*s, y=(p.y-camera.y)*s; ctx.lineTo(x,y); }
  ctx.closePath(); ctx.fill();

  // Rims - heavy
  ctx.strokeStyle=col; ctx.lineWidth=3;
  ctx.beginPath(); for(let i=0;i<L.length;i++){ const p=L[i]; const x=(p.x-camera.x)*s, y=(p.y-camera.y)*s; if(!i) ctx.moveTo(x,y); else ctx.lineTo(x,y);} ctx.stroke();
  ctx.beginPath(); for(let i=0;i<R.length;i++){ const p=R[i]; const x=(p.x-camera.x)*s, y=(p.y-camera.y)*s; if(!i) ctx.moveTo(x,y); else ctx.lineTo(x,y);} ctx.stroke();

  // Cross-hatching: parallel ticks angled uniformly
  ctx.lineWidth=1.5;
  for(let i=2;i<L.length-2;i+=2){
    const a=L[i], b=R[i];
    const x1=(a.x-camera.x)*s, y1=(a.y-camera.y)*s;
    const x2=x1+((b.x-a.x)*s*0.22), y2=y1+((b.y-a.y)*s*0.22);
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    // secondary hatch (lighter, shorter)
    const x3=x1+((b.x-a.x)*s*0.12), y3=y1+((b.y-a.y)*s*0.12);
    ctx.beginPath(); ctx.moveTo(x3,y3); ctx.lineTo(x3+(b.y-a.y)*0.3, y3-(b.x-a.x)*0.3); ctx.stroke();
  }
}

/* ================ STONE BRIDGE (blocks + rails) ================ */
export function drawBridgeStone(ctx, A, B, camera, s, col=PALETTE.ink){
  crisp(ctx);
  const x1=(A.x-camera.x)*s, y1=(A.y-camera.y)*s, x2=(B.x-camera.x)*s, y2=(B.y-camera.y)*s;
  ctx.strokeStyle=col; ctx.lineWidth=3;
  // Rails straight
  ctx.beginPath(); ctx.moveTo(x1, y1-7); ctx.lineTo(x2, y2-7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x1, y1+7); ctx.lineTo(x2, y2+7); ctx.stroke();
  // Stone blocks across
  const steps=12;
  for(let i=0;i<=steps;i++){
    const t=i/steps; const px=x1+(x2-x1)*t, py=y1+(y2-y1)*t;
    ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(px-8, py); ctx.lineTo(px+8, py); ctx.stroke();
    // vertical seams
    if(i<steps){ const pv=x1+(x2-x1)*t, qv=y1+(y2-y1)*t;
      ctx.beginPath(); ctx.moveTo(pv, qv-7); ctx.lineTo(pv, qv+7); ctx.stroke(); }
  }
}

/* ================ DETAILED ROUND TOWER ================= */
export function drawTowerTopDetailed(ctx, centerVx, centerVy, radiusTiles, s, col=PALETTE.ink){
  crisp(ctx);
  const cx=centerVx*s, cy=centerVy*s, r=radiusTiles*s;
  ctx.strokeStyle=col; ctx.lineWidth=2;

  // Outer circle via straight segments
  const seg=72;
  ctx.beginPath();
  for(let i=0;i<=seg;i++){ const th=i/seg*Math.PI*2; const x=cx+Math.cos(th)*r, y=cy+Math.sin(th)*r; if(!i) ctx.moveTo(x,y); else ctx.lineTo(x,y); }
  ctx.stroke();

  // Battlements (individual)
  const teeth=20, toothD=r*0.12, tang= (i)=>({x:-Math.sin(i), y:Math.cos(i)});
  for(let i=0;i<teeth;i++){
    const th=i/teeth*Math.PI*2;
    const nx=Math.cos(th), ny=Math.sin(th), tx=tang(th).x, ty=tang(th).y;
    const baseX=cx+nx*(r-toothD), baseY=cy+ny*(r-toothD);
    const halfW = Math.PI*2*r/teeth*0.45;
    ctx.beginPath();
    ctx.moveTo(baseX - tx*halfW, baseY - ty*halfW);
    ctx.lineTo(baseX + tx*halfW, baseY + ty*halfW);
    ctx.lineTo(baseX + tx*halfW + nx*toothD, baseY + ty*halfW + ny*toothD);
    ctx.lineTo(baseX - tx*halfW + nx*toothD, baseY - ty*halfW + ny*toothD);
    ctx.closePath(); ctx.stroke();
  }

  // Concentric rings (tiling)
  const rings=6;
  for(let k=1;k<=rings;k++){
    const rr=r*(1 - k/(rings+1));
    ctx.beginPath();
    for(let i=0;i<=seg;i++){ const th=i/seg*Math.PI*2; const x=cx+Math.cos(th)*rr, y=cy+Math.sin(th)*rr; if(!i) ctx.moveTo(x,y); else ctx.lineTo(x,y); }
    ctx.stroke();
  }

  // Dense radial seams
  const spokes=36;
  for(let i=0;i<spokes;i++){
    const th=i/spokes*Math.PI*2;
    const x1=cx+Math.cos(th)*(r*0.12), y1=cy+Math.sin(th)*(r*0.12);
    const x2=cx+Math.cos(th)*(r*0.98), y2=cy+Math.sin(th)*(r*0.98);
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  }
}

/* ================ OTHER BUILDINGS ================= */
export function drawHallBuilding(ctx, vx, vy, wTiles, hTiles, s, col=PALETTE.ink){
  // rectangular hall with pitched roof lines and doorway arches
  crisp(ctx);
  const x=vx*s, y=vy*s, w=wTiles*s, h=hTiles*s;
  ctx.strokeStyle=col; ctx.lineWidth=2; ctx.strokeRect(x+2, y+2, w-4, h-4);
  // roof hatch parallel lines
  for(let i=6;i<w-6;i+=10){ ctx.beginPath(); ctx.moveTo(x+i, y+4); ctx.lineTo(x+i, y+h-4); ctx.stroke(); }
  // doorway arches on long side
  const arches=Math.max(1, Math.floor(wTiles/3));
  for(let i=1;i<=arches;i++){
    const ax=x + (i/(arches+1))*w;
    ctx.beginPath(); ctx.moveTo(ax-10, y+h-4); ctx.lineTo(ax-10, y+h-18);
    ctx.arc(ax, y+h-18, 10, Math.PI, 0, false);
    ctx.lineTo(ax+10, y+h-4); ctx.stroke();
  }
}
export function drawLShapeBuilding(ctx, vx, vy, w1, h1, w2, h2, s, col=PALETTE.ink){
  crisp(ctx);
  const x=vx*s,y=vy*s;
  ctx.strokeStyle=col; ctx.lineWidth=2;
  // two rectangles forming an L
  ctx.strokeRect(x+2,y+2,w1*s-4,h1*s-4);
  ctx.strokeRect(x+2+(w1-w2)*s,y+2+(h1-h2)*s,w2*s-4,h2*s-4);
  // roof hatch diagonals
  for(let i=6;i<w1*s-6;i+=10){ ctx.beginPath(); ctx.moveTo(x+i, y+4); ctx.lineTo(x+i-20, y+h1*s-4); ctx.stroke(); }
}

/* ================ GROUND HATCH TEXTURE (walkable) ================= */
export function drawGroundHatch(ctx, camera, isBlockedFn, s, col=PALETTE.ink){
  crisp(ctx);
  ctx.strokeStyle=col; ctx.globalAlpha=0.12; ctx.lineWidth=1;
  const vw=Math.ceil(ctx.canvas.width/s), vh=Math.ceil(ctx.canvas.height/s);
  for(let vy=0; vy<vh; vy++){
    for(let vx=0; vx<vw; vx++){
      const wx=camera.x+vx, wy=camera.y+vy;
      if(isBlockedFn(wx,wy)) continue;
      const x=vx*s, y=vy*s;
      // cross hatch
      ctx.beginPath(); ctx.moveTo(x+4,y+s-6); ctx.lineTo(x+s-6,y+4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x+6,y+s-8); ctx.lineTo(x+s-8,y+6); ctx.stroke();
    }
  }
  ctx.globalAlpha=1;
}
