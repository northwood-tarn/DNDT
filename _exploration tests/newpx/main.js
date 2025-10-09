// ===============================
// Pixi Architectural Engine — Transformations + Resets
// ===============================

const VIEW_W = 608, VIEW_H = 592;
const PLAYER_SIZE = 16, PLAYER_SPEED = 2.6; // +30%
const SCALE = 0.4;

const TMJ_CANDIDATES = [
  'data/fields.tmj.json','./data/fields.tmj.json','/data/fields.tmj.json',
  'app/data/fields.tmj.json','DNDT/app/data/fields.tmj.json'
];
const IMAGE_NAME_FALLBACK = 'fields.jpeg';

// Lighting (preview mode)
let LIGHTING_ON = false;
let NIGHT_ENABLED = true;
let TORCH_RADIUS = 160, TORCH_SOFT_RADIUS = 260, DIM_RADIUS = 360;
let FOGGINESS = 0.15;
let LIGHT_TINT_COLOR = 0xFFF4CC, LIGHT_TINT_ALPHA = 0.15;

// Edge Map
let EDGE_ENABLED = true;
let EDGE_THRESHOLD = 40;
let EDGE_GAIN = 3.0;
let EDGE_ALPHA = 1.0;
let EDGE_COLOR = 0x111111;

// Rectilinear snap
let SNAP_STRENGTH = 0.7;
let CORNER_SHARP = 0.6;
let OUTLINE_THICK = 2.5;
let INTERIOR_TRIM = 1.0;

// Posterize & Poche
let POSTER_LEVELS = 3;
let POCHE_BAND = 0;
let POCHE_OPACITY = 0.45;
let PALETTE = 'black'; // 'black'|'blueprint'|'graphite'

// Alienization v1
let WARP_TYPE='none', WARP_AMOUNT=0.0;
let GRID_ON=false, GRID_SPACING=64, GRID_ANGLE=0;
let GLYPH_ON=false, GLYPH_DENSITY=0.4, GLYPH_SIZE=3;

// Alienization v2
let FRAC_ON=false, FRAC_DENSITY=0.35, FRAC_THICK=1.2, FRAC_ALPHA=0.5;
let VG_ON=false, VG_TILT=0, VG_DENSITY=0.6, VG_TWO=false;
let MARKS_ON=false, MARKS_DENSITY=0.3, MARKS_SIZE=2, MARKS_ALPHA=0.8;

// Discipline v3
let DISC_ON=false, DISC_SYM=0.3, DISC_CORNER=0.7, DISC_STRAIGHT=0.6, DISC_OUTLINE=1.0;

// Transformations
let TRANS_MODE='none'; // 'none'|'mockery'|'confession'
// Mockery
let MOCK_EXAG=0.4, MOCK_ERASE=0.15, MOCK_DETAIL=0.3;
// Confession
let CONF_RIGID=0.6, CONF_SYMBOLS=0.25, CONF_GHOST=0.35, CONF_SCOUR=0.15;

// View
let VIEW_MODE = 'treatment';

// Globals
let app=null, world=null; let player=null; let posterCanvasLast=null;
let uiOverlay=null;
let regionEnabled=false, regionRect=null, regionEdit=false;
let regionAffectBg=true, regionAffectEdges=true, regionAffectOver=true;
let regionMask=null, regionContainer=null, regionOutline=null;
let posterBaseSprite=null, edgeBaseSprite=null;
let bg=null, bgTex=null, bgOuter=null, bgInner=null;
let posterSprite=null, pocheSprite=null, edgeSprite=null;
let gridOverlay=null, glyphOverlay=null, warpFilter=null, edgeCanvasLast=null;
let fracOverlay=null, vgOverlay=null, marksOverlay=null, ritualOverlay=null, mockOverlay=null;
let darkness=null, brightDisc=null, dimDisc=null, lightTint=null;

// Helpers
function clamp(v,a,b){ return Math.max(a, Math.min(b,v)); }
async function headOK(u){ try{ const r=await fetch(u,{method:'HEAD'}); return r.ok; } catch{ return false; } }
async function resolveFirstExisting(list){ for (const u of list){ if (await headOK(u)) return u; } return null; }
async function loadJSON(url){ const r = await fetch(url); if(!r.ok) throw new Error('HTTP '+r.status+' at '+url); return r.json(); }
function paletteColors(name){
  switch(name){
    case 'blueprint': return { ink: 0x0b1d3a, paper: 0xe0f2ff };
    case 'graphite':  return { ink: 0x333333, paper: 0xf4efe6 };
    default:          return { ink: 0x111111, paper: 0xffffff };
  }
}
function $(id){ return document.getElementById(id); }

// Start
async function start(){
  app = new PIXI.Application({ width: VIEW_W, height: VIEW_H, background: 0xf6f7f8, backgroundAlpha: 1 });
  document.getElementById('game').appendChild(app.view || app.canvas);

  world = new PIXI.Container();
  app.stage.addChild(world);
  uiOverlay = new PIXI.Container();
  app.stage.addChild(uiOverlay);

  const tmjURL = await resolveFirstExisting(TMJ_CANDIDATES);
  if (!tmjURL) throw new Error('TMJ not found (404)');
  const tmj = await loadJSON(tmjURL);

  let imageName = null;
  const imageLayer = (tmj.layers||[]).find(l => l.type==='imagelayer' && l.image);
  if (imageLayer) imageName = imageLayer.image;
  let imgURL = null;
  if (imageName){
    const p = tmjURL.replace(/fields\.tmj\.json$/,'') + imageName;
    if (await headOK(p)) imgURL = p;
  }
  if (!imgURL){
    const base = tmjURL.replace(/fields\.tmj\.json$/,'');
    imgURL = await resolveFirstExisting([ base+IMAGE_NAME_FALLBACK, 'data/'+IMAGE_NAME_FALLBACK, './data/'+IMAGE_NAME_FALLBACK ]);
    if (!imgURL) throw new Error('Background image not found');
  }
  bgTex = await PIXI.Assets.load(imgURL);
  bg = new PIXI.Sprite(bgTex); bg.anchor.set(0,0); bg.scale.set(SCALE);
  bg.texture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;

  bgOuter = new PIXI.Container();
  bgInner = new PIXI.Container();
  bgInner.addChild(bg); bgOuter.addChild(bgInner); world.addChild(bgOuter);

  const WORLD_W = Math.round(bgTex.width * SCALE), WORLD_H = Math.round(bgTex.height * SCALE);

  // Collision + spawn
  const objectLayer = (tmj.layers||[]).find(l => l.type==='objectgroup');
  const polys = []; let spawn = { x: VIEW_W/2, y: VIEW_H/2 };
  if (objectLayer && Array.isArray(objectLayer.objects)){
    for (const obj of objectLayer.objects){
      if (obj.type==='collision' && Array.isArray(obj.polygon)){
        const bx=obj.x||0, by=obj.y||0;
        const pts = obj.polygon.map(p=>({x:(bx+p.x)*SCALE, y:(by+p.y)*SCALE}));
        polys.push(pts);
      } else if (obj.type==='spawn'){
        spawn = { x:(obj.x||spawn.x)*SCALE, y:(obj.y||spawn.y)*SCALE };
      }
    }
  }

  // Player
  player = new PIXI.Graphics();
  player.beginFill(0x000000).drawRect(-PLAYER_SIZE/2,-PLAYER_SIZE/2,PLAYER_SIZE,PLAYER_SIZE).endFill();
  player.x = clamp(spawn.x, PLAYER_SIZE/2, WORLD_W-PLAYER_SIZE/2);
  player.y = clamp(spawn.y, PLAYER_SIZE/2, WORLD_H-PLAYER_SIZE/2);
  world.addChild(player);

  // Input
  const keys = new Set();
  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright'].includes(k)) e.preventDefault();
    keys.add(k);
  }, {passive:false});
  window.addEventListener('keyup', e => { keys.delete(e.key.toLowerCase()); }, {passive:true});

  function updateCamera(){
    const cx = clamp(player.x - VIEW_W/2, 0, Math.max(0, WORLD_W - VIEW_W));
    const cy = clamp(player.y - VIEW_H/2, 0, Math.max(0, WORLD_H - VIEW_H));
    world.x = -cx; world.y = -cy;
  }
  function pointInPoly(x,y,poly){
    let inside=false;
    for (let i=0,j=poly.length-1;i<poly.length;j=i++){
      const xi=poly[i].x, yi=poly[i].y, xj=poly[j].x, yj=poly[j].y;
      const inter=((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi+1e-9)+xi);
      if (inter) inside=!inside;
    }
    return inside;
  }
  function tryMove(dx,dy){
    const nx=clamp(player.x+dx,PLAYER_SIZE/2,WORLD_W-PLAYER_SIZE/2);
    const ny=clamp(player.y+dy,PLAYER_SIZE/2,WORLD_H-PLAYER_SIZE/2);
    for (const poly of polys){ if (pointInPoly(nx,ny,poly)) return; }
    player.x=nx; player.y=ny;
  }

  // -------- Posterize & Poche
  function buildPosterizeAndPoche(){
    if (posterSprite){ posterSprite.destroy(true); posterSprite=null; }
    if (pocheSprite){ pocheSprite.destroy(true); pocheSprite=null; }
    const w=bgTex.width,h=bgTex.height;
    const c=document.createElement('canvas'); c.width=w; c.height=h;
    const ctx=c.getContext('2d');
    const img=bgTex.baseTexture.getDrawableSource?bgTex.baseTexture.getDrawableSource():
      (bgTex.baseTexture.resource&&bgTex.baseTexture.resource.source?bgTex.baseTexture.resource.source:null);
    if (!img) return;
    ctx.drawImage(img,0,0,w,h);
    // neutralize sepia & lift to white
    const id=ctx.getImageData(0,0,w,h), d=id.data;
    for (let i=0;i<d.length;i+=4){
      let r=d[i], g=d[i+1], b=d[i+2], avg=(r+g+b)/3;
      r=0.6*r+0.4*avg; g=0.7*g+0.3*avg; b=0.8*b+0.2*avg;
      r=255-0.8*(255-r); g=255-0.8*(255-g); b=255-0.8*(255-b);
      d[i]=r; d[i+1]=g; d[i+2]=b;
    }
    ctx.putImageData(id,0,0);
    // posterize
    const src=ctx.getImageData(0,0,w,h);
    const lev=Math.max(2,Math.min(6,POSTER_LEVELS));
    for (let i=0;i<src.data.length;i+=4){
      const r=src.data[i], g=src.data[i+1], b=src.data[i+2];
      const Y=0.299*r+0.587*g+0.114*b;
      const q=Math.round((Y/255)*(lev-1));
      const Yp=255*(q/(lev-1));
      src.data[i]=src.data[i+1]=src.data[i+2]=Yp; src.data[i+3]=255;
    }
    ctx.putImageData(src,0,0);
    posterCanvasLast = c;
    posterSprite = PIXI.Sprite.from(c);
    posterSprite.anchor.set(0,0); posterSprite.scale.set(SCALE);
    posterSprite.texture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
    bgInner.addChild(posterSprite);

    applyWarpFilter();
    buildPocheFromPoster(c);

    // Confession "scour": lighten patches on the poster layer (erase to paper)
    if (TRANS_MODE==='confession' && CONF_SCOUR>0){
      const sc = document.createElement('canvas'); sc.width=w; sc.height=h;
      const sctx = sc.getContext('2d'); sctx.drawImage(posterSprite.texture.baseTexture.resource.source,0,0);
      const holes = Math.round(80*CONF_SCOUR);
      sctx.globalCompositeOperation='destination-out';
      for (let i=0;i<holes;i++){
        const x=Math.random()*w, y=Math.random()*h;
        const r = 10 + Math.random()*60*CONF_SCOUR;
        const grad = sctx.createRadialGradient(x,y,0,x,y,r);
        grad.addColorStop(0,'rgba(0,0,0,0.9)'); grad.addColorStop(1,'rgba(0,0,0,0)');
        sctx.fillStyle=grad; sctx.beginPath(); sctx.arc(x,y,r,0,Math.PI*2); sctx.fill();
      }
      posterSprite.texture = PIXI.Texture.from(sc);
      posterSprite.texture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
    }
  }
  function buildPocheFromPoster(posterCanvas){
    const w=posterCanvas.width,h=posterCanvas.height;
    const cm=document.createElement('canvas'); cm.width=w; cm.height=h;
    const mctx=cm.getContext('2d'); mctx.drawImage(posterCanvas,0,0);
    const mdat=mctx.getImageData(0,0,w,h), md=mdat.data;
    const lev=Math.max(2,Math.min(6,POSTER_LEVELS));
    const band=Math.max(0,Math.min(lev-1,POCHE_BAND));
    const bandVal=255*(band/(lev-1));
    for (let i=0;i<md.length;i+=4){ const v=md[i]; const a=(v===bandVal)?255:0; md[i]=md[i+1]=md[i+2]=255; md[i+3]=a; }
    mctx.putImageData(mdat,0,0);
    const maskSprite = PIXI.Sprite.from(cm); maskSprite.anchor.set(0,0); maskSprite.scale.set(SCALE);
    if (pocheSprite){ pocheSprite.destroy(true); pocheSprite=null; }
    const { ink } = paletteColors(PALETTE);
    const poche = new PIXI.Graphics();
    poche.beginFill(ink).drawRect(0,0,Math.round(w*SCALE),Math.round(h*SCALE)).endFill();
    poche.alpha = POCHE_OPACITY;
    bgInner.addChild(poche); poche.mask = maskSprite; bgInner.addChild(maskSprite);
    pocheSprite = poche;
  }

  // -------- Edge + Snap + Discipline + Transformations
  function edgeCanvasFromTexture(tex){
    const w=tex.width,h=tex.height;
    const c=document.createElement('canvas'); c.width=w; c.height=h;
    const ctx=c.getContext('2d');
    const img=tex.baseTexture.getDrawableSource?tex.baseTexture.getDrawableSource():
      (tex.baseTexture.resource&&tex.baseTexture.resource.source?tex.baseTexture.resource.source:null);
    if (!img) return null;
    ctx.drawImage(img,0,0,w,h);
    const src=ctx.getImageData(0,0,w,h);
    const gray=new Uint8ClampedArray(w*h);
    for (let i=0,p=0;i<gray.length;i++,p+=4){
      const r=src.data[p],g=src.data[p+1],b=src.data[p+2];
      gray[i]=(0.299*r+0.587*g+0.114*b)|0;
    }
    const gx=[-1,0,1,-2,0,2,-1,0,1], gy=[-1,-2,-1,0,0,0,1,2,1];
    const mag=new Float32Array(w*h);
    for (let y=1;y<h-1;y++){
      for (let x=1;x<w-1;x++){
        let sx=0,sy=0,k=0;
        for (let j=-1;j<=1;j++){ for (let i2=-1;i2<=1;i2++,k++){ const v=gray[(y+j)*w+(x+i2)]; sx+=gx[k]*v; sy+=gy[k]*v; } }
        mag[y*w+x]=Math.sqrt(sx*sx+sy*sy);
      }
    }
    let maxm=1; for (let i=0;i<mag.length;i++) if (mag[i]>maxm) maxm=mag[i];
    const thr=EDGE_THRESHOLD, gamma=Math.max(0.5,EDGE_GAIN);
    let cur=new Uint8ClampedArray(w*h), tmp=new Uint8ClampedArray(w*h);
    for (let i=0;i<mag.length;i++){
      const m=(mag[i]/maxm)*255;
      cur[i]=(m>thr)? (Math.pow((m-thr)/(255-thr),1/gamma)*255)|0 : 0;
    }
    const iters=Math.round(SNAP_STRENGTH*4);
    const dilate4=()=>{
      for (let y=1;y<h-1;y++){ for (let x=1;x<w-1;x++){
        const i=y*w+x; tmp[i]=Math.max(cur[i],cur[i-1],cur[i+1],cur[i-w],cur[i+w]);
      }} [cur,tmp]=[tmp,cur];
    };
    const dilate8=()=>{
      for (let y=1;y<h-1;y++){ for (let x=1;x<w-1;x++){
        const i=y*w+x; tmp[i]=Math.max(cur[i],cur[i-1],cur[i+1],cur[i-w],cur[i+w],cur[i-w-1],cur[i-w+1],cur[i+w-1],cur[i+w+1]);
      }} [cur,tmp]=[tmp,cur];
    };
    const erode4=()=>{
      for (let y=1;y<h-1;y++){ for (let x=1;x<w-1;x++){
        const i=y*w+x; tmp[i]=Math.min(cur[i],cur[i-1],cur[i+1],cur[i-w],cur[i+w]);
      }} [cur,tmp]=[tmp,cur];
    };
    for (let k=0;k<iters;k++){ dilate4(); }
    for (let k=0;k<Math.round(OUTLINE_THICK);k++) dilate8();
    for (let k=0;k<Math.round(INTERIOR_TRIM);k++) erode4();

    // --- Discipline v3 (if on) ---
    if (DISC_ON){
      if (DISC_SYM>0){
        const alpha=DISC_SYM;
        for (let y=0;y<h;y++){
          for (let x=0;x<w;x++){
            const i=y*w+x, mi=y*w+(w-1-x);
            cur[i]=Math.max(cur[i], (cur[mi]*alpha)|0);
          }
        }
      }
      const extra = Math.round(DISC_CORNER*4);
      for (let k=0;k<extra;k++) dilate4();
      const straight = Math.round(DISC_STRAIGHT*3);
      for (let k=0;k<straight;k++) dilate4();
      erode4();
      for (let k=0;k<Math.round(DISC_OUTLINE);k++) dilate8();
    }

    // --- Transformations ---
    if (TRANS_MODE==='mockery'){
      // Exaggeration: anisotropic pulls along axes (repeat axis dilation)
      const pulls = Math.round(MOCK_EXAG*5);
      for (let k=0;k<pulls;k++) dilate4();
      // Erasure: randomly thin a percentage of edge pixels
      if (MOCK_ERASE>0){
        for (let y=1;y<h-1;y++){
          for (let x=1;x<w-1;x++){
            const i=y*w+x;
            if (cur[i]>0 && Math.random()<MOCK_ERASE*0.25){ cur[i]=0; }
          }
        }
      }
    } else if (TRANS_MODE==='confession'){
      // Rigidity: stronger axis hardening + right-angle emphasis
      const rig = Math.round(CONF_RIGID*6);
      for (let k=0;k<rig;k++) dilate4();
      erode4();
      for (let k=0;k<2;k++) dilate8();
      // Ghost lines: create a faint offset copy by mixing shifted pixels
      if (CONF_GHOST>0){
        for (let y=1;y<h-1;y++){
          for (let x=1;x<w-1;x++){
            const i=y*w+x, j=y*w+Math.min(w-2,x+1);
            const v = (cur[i]*(1-0.4*CONF_GHOST) + cur[j]*(0.4*CONF_GHOST))|0;
            cur[i]=Math.max(cur[i], v);
          }
        }
      }
    }

    // Draw to canvas
    const ctx2=c.getContext('2d');
    const dst=ctx2.createImageData(w,h);
    const rInk=(EDGE_COLOR>>16)&255, gInk=(EDGE_COLOR>>8)&255, bInk=EDGE_COLOR&255;
    for (let i=0;i<cur.length;i++){
      const p=i*4,a=Math.min(255,cur[i]*EDGE_ALPHA)|0;
      dst.data[p]=rInk; dst.data[p+1]=gInk; dst.data[p+2]=bInk; dst.data[p+3]=a;
    }
    ctx2.putImageData(dst,0,0);

    // Over-detail (mockery): draw spurious ticks near edges (overlay but derived)
    if (TRANS_MODE==='mockery' && MOCK_DETAIL>0){
      if (mockOverlay){ if (mockOverlay.parent) mockOverlay.parent.removeChild(mockOverlay); mockOverlay.destroy(true); mockOverlay=null; }
      const g=new PIXI.Graphics(); const { ink } = paletteColors(PALETTE);
      g.lineStyle(1, ink, 0.9);
      const step = Math.max(6, Math.round((1.0-MOCK_DETAIL)*40));
      for (let y=step; y<h-step; y+=step){
        for (let x=step; x<w-step; x+=step){
          const a = dst.data[(y*w+x)*4+3];
          if (a>160 && Math.random()<MOCK_DETAIL*0.4){
            const wx=x*SCALE, wy=y*SCALE, len=2+Math.random()*5;
            if (Math.random()<0.5){ g.moveTo(wx,wy); g.lineTo(wx+len,wy); }
            else { g.moveTo(wx,wy); g.lineTo(wx,wy+len); }
          }
        }
      }
      mockOverlay=g; bgInner.addChild(mockOverlay);
    } else {
      if (mockOverlay){ if (mockOverlay.parent) mockOverlay.parent.removeChild(mockOverlay); mockOverlay.destroy(true); mockOverlay=null; }
    }

    // Ritual symbols (confession): sparse geometry derived from edge map density
    if (TRANS_MODE==='confession' && CONF_SYMBOLS>0){
      if (ritualOverlay){ if (ritualOverlay.parent) ritualOverlay.parent.removeChild(ritualOverlay); ritualOverlay.destroy(true); ritualOverlay=null; }
      const g=new PIXI.Graphics(); const { ink } = paletteColors(PALETTE);
      g.lineStyle(1, ink, 0.7);
      const density = CONF_SYMBOLS;
      const cell = Math.max(24, Math.round((1.0-density)*140));
      for (let y=cell; y<h-cell; y+=cell){
        for (let x=cell; x<w-cell; x+=cell){
          const a = dst.data[(y*w+x)*4+3];
          if (a>120 && Math.random()<density){
            const wx=x*SCALE, wy=y*SCALE, r=6+Math.random()*10;
            g.drawCircle(wx,wy,r);
            if (Math.random()<0.5){ g.moveTo(wx-r,wy); g.lineTo(wx+r,wy); g.moveTo(wx,wy-r); g.lineTo(wx,wy+r); }
            if (Math.random()<0.25){ g.drawPolygon([wx-r,wy-r, wx+r,wy-r, wx,wy+r]); }
          }
        }
      }
      ritualOverlay=g; bgInner.addChild(ritualOverlay);
    } else {
      if (ritualOverlay){ if (ritualOverlay.parent) ritualOverlay.parent.removeChild(ritualOverlay); ritualOverlay.destroy(true); ritualOverlay=null; }
    }

    return c;
  }

  function buildPosterBase(){
    if (posterBaseSprite){ posterBaseSprite.destroy(true); posterBaseSprite=null; }
    // Temporarily disable confession scour by using TRANS_MODE='none'
    const prevMode = TRANS_MODE; TRANS_MODE='none';
    const prevLevels=POSTER_LEVELS, prevPoche=POCHE_BAND, prevPOp=POCHE_OPACITY, prevPal=PALETTE;
    // Build a neutral poster with current posterize settings (kept), no scour
    buildPosterizeAndPoche();
    // Clone current poster texture into a standalone sprite
    if (posterSprite){
      const tex = posterSprite.texture.clone(); tex.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
      posterBaseSprite = new PIXI.Sprite(tex); posterBaseSprite.anchor.set(0,0); posterBaseSprite.scale.set(SCALE);
    }
    // restore
    TRANS_MODE = prevMode;
    // rebuild treated after base is created
    buildPosterizeAndPoche();
  }

  function buildEdgesBase(){
    if (edgeBaseSprite){ edgeBaseSprite.destroy(true); edgeBaseSprite=null; }
    const prevDisc=DISC_ON, prevMode=TRANS_MODE;
    DISC_ON=false; TRANS_MODE='none';
    const canvas = edgeCanvasFromTexture(bgTex);
    if (canvas){
      const tex=PIXI.Texture.from(canvas); tex.baseTexture.scaleMode=PIXI.SCALE_MODES.NEAREST;
      edgeBaseSprite = new PIXI.Sprite(tex); edgeBaseSprite.anchor.set(0,0); edgeBaseSprite.scale.set(SCALE);
    }
    DISC_ON=prevDisc; TRANS_MODE=prevMode;
    refreshEdges();
  }

  function ensureRegionMask(){
    if (!regionMask){ regionMask = new PIXI.Graphics(); }
    if (!regionContainer){ regionContainer = new PIXI.Container(); regionContainer.mask = regionMask; bgInner.addChild(regionContainer); bgInner.addChild(regionMask); }
    if (!regionOutline){ regionOutline = new PIXI.Graphics(); uiOverlay.addChild(regionOutline); }
  }
  function drawRegionMask(){
    if (!regionRect) return;
    ensureRegionMask();
    regionMask.clear();
    regionMask.beginFill(0xffffff, 1.0).drawRect(regionRect.x, regionRect.y, regionRect.w, regionRect.h).endFill();
    // Visible outline in screen space so it stays above darkness
    const sx = regionRect.x + world.x, sy = regionRect.y + world.y;
    regionOutline.clear();
    regionOutline.beginFill(0x66ccff, 0.08).drawRect(sx, sy, regionRect.w, regionRect.h).endFill();
    regionOutline.lineStyle(2, 0x9bb7ff, 0.95).drawRect(sx, sy, regionRect.w, regionRect.h);
  }

  function applyRegionComposition(){
    ensureRegionMask();
    // Clear existing masked children
    if (regionContainer){ regionContainer.removeChildren(); }
    // Remove any previous base sprites in scene
    if (posterBaseSprite && posterBaseSprite.parent) posterBaseSprite.parent.removeChild(posterBaseSprite);
    if (edgeBaseSprite && edgeBaseSprite.parent) edgeBaseSprite.parent.removeChild(edgeBaseSprite);

    if (!regionEnabled || !regionRect){ return; }

    // Background
    if (regionAffectBg){
      if (posterBaseSprite) bgInner.addChildAt(posterBaseSprite, 0);
      if (posterSprite){ const treated = new PIXI.Sprite(posterSprite.texture); treated.anchor.set(0,0); treated.scale.set(SCALE); regionContainer.addChild(treated); }
      if (pocheSprite){ const treatedP = pocheSprite; /* poche is masked via poster band; leave as-is */ }
    }

    // Edges
    if (regionAffectEdges){
      if (edgeBaseSprite) bgInner.addChild(edgeBaseSprite);
      if (edgeSprite && edgeSprite.texture){ const treatedE = new PIXI.Sprite(edgeSprite.texture); treatedE.anchor.set(0,0); treatedE.scale.set(SCALE); regionContainer.addChild(treatedE); }
    }

    // Overlays (Alienization & ritual/glyphs)
    if (regionAffectOver){
      for (const ov of [gridOverlay,glyphOverlay,fracOverlay,vgOverlay,marksOverlay,ritualOverlay,mockOverlay]){
        if (ov){ regionContainer.addChild(ov); }
      }
    }

    drawRegionMask();
  }

  function refreshEdges(){
    if (!EDGE_ENABLED){ if (edgeSprite) edgeSprite.visible=false; return; }
    const canvas=edgeCanvasFromTexture(bgTex); if (!canvas) return;
    edgeCanvasLast = canvas;
    const newTex=PIXI.Texture.from(canvas); newTex.baseTexture.scaleMode=PIXI.SCALE_MODES.NEAREST;
    if (!edgeSprite){
      edgeSprite=new PIXI.Sprite(newTex); edgeSprite.anchor.set(0,0); edgeSprite.scale.set(SCALE); bgInner.addChild(edgeSprite);
    } else {
      if (edgeSprite.texture) edgeSprite.texture.destroy(true);
      edgeSprite.texture=newTex; edgeSprite.visible=true;
    }
    // keep edges above poster/poche
    if (posterSprite) bgInner.setChildIndex(edgeSprite, Math.max(bgInner.getChildIndex(posterSprite)+1, bgInner.children.length-1));
    if (ALIEN_V1_ON && GLYPH_ON) buildGlyphOverlay();
  }

  // Alienization v1 overlays
  function buildGridOverlay(){
    if (!ALIEN_V1_ON) return;
    if (gridOverlay){ if (gridOverlay.parent) gridOverlay.parent.removeChild(gridOverlay); gridOverlay.destroy(true); gridOverlay=null; }
    if (!GRID_ON) return;
    const WORLD_W = Math.round(bgTex.width * SCALE), WORLD_H = Math.round(bgTex.height * SCALE);
    const g=new PIXI.Graphics();
    const { ink } = paletteColors(PALETTE);
    g.lineStyle(1, ink, 0.15);
    const spacing=Math.max(8,Math.round(GRID_SPACING*SCALE));
    for (let x=0;x<=WORLD_W;x+=spacing){ g.moveTo(x,0); g.lineTo(x,WORLD_H); }
    for (let y=0;y<=WORLD_H;y+=spacing){ g.moveTo(0,y); g.lineTo(WORLD_W,y); }
    const c = new PIXI.Container();
    c.addChild(g);
    c.pivot.set(WORLD_W/2, WORLD_H/2); c.position.set(WORLD_W/2, WORLD_H/2);
    c.rotation = GRID_ANGLE * Math.PI/180;
    gridOverlay=c; bgInner.addChild(gridOverlay);
  }
  function buildGlyphOverlay(){
    if (!ALIEN_V1_ON) return;
    if (glyphOverlay){ if (glyphOverlay.parent) glyphOverlay.parent.removeChild(glyphOverlay); glyphOverlay.destroy(true); glyphOverlay=null; }
    if (!GLYPH_ON || !edgeCanvasLast) return;
    const ctx=edgeCanvasLast.getContext('2d');
    const ed=ctx.getImageData(0,0,edgeCanvasLast.width, edgeCanvasLast.height);
    const g=new PIXI.Graphics(); const { ink } = paletteColors(PALETTE);
    g.lineStyle(1, ink, 0.9);
    const step=Math.max(8, Math.round((1.0-GLYPH_DENSITY)*64));
    const size=GLYPH_SIZE;
    for (let y=0;y<edgeCanvasLast.height;y+=step){
      for (let x=0;x<edgeCanvasLast.width;x+=step){
        const a=ed.data[(y*edgeCanvasLast.width+x)*4+3];
        if (a>140 && Math.random()<GLYPH_DENSITY){
          const wx=x*SCALE, wy=y*SCALE;
          g.moveTo(wx,wy); g.lineTo(wx+size,wy);
          g.moveTo(wx,wy); g.lineTo(wx,wy+size);
          if (Math.random()<0.15){ g.drawRect(wx-size*0.5, wy-size*0.5, size, size); }
        }
      }
    }
    glyphOverlay=g; bgInner.addChild(glyphOverlay);
  }
  function ensureWarpFilter(){
    if (!ALIEN_V1_ON || WARP_TYPE==='none') return null;
    if (!warpFilter){
      const frag = `precision mediump float;
        varying vec2 vTextureCoord; uniform sampler2D uSampler;
        uniform float amount; uniform int mode;
        void main(){
          vec2 uv=vTextureCoord; vec2 p=(uv-0.5)*2.0;
          if (mode==1){ float r=dot(p,p); float k=amount*0.5; vec2 pp=p*(1.0+k*r); uv=pp*0.5+0.5; }
          else if (mode==2){ float r=length(p); float a=atan(p.y,p.x)+amount*(1.0-r); vec2 pp=vec2(cos(a),sin(a))*r; uv=pp*0.5+0.5; }
          gl_FragColor = texture2D(uSampler, uv);
        }`;
      warpFilter = new PIXI.Filter(undefined, frag, { amount: 0.0, mode: 0 });
    }
    return warpFilter;
  }
  function applyWarpFilter(){
    if (!posterSprite){ return; }
    const f = ensureWarpFilter();
    if (!f){ posterSprite.filters = []; return; }
    let mode=0; if (WARP_TYPE==='barrel') mode=1; else if (WARP_TYPE==='swirl') mode=2;
    f.uniforms.amount = WARP_AMOUNT; f.uniforms.mode = mode;
    posterSprite.filters = [f];
  }

  // Alienization v2 overlays
  function buildFractureOverlay(){
    if (!ALIEN_V2_ON) return;
    if (fracOverlay){ if (fracOverlay.parent) fracOverlay.parent.removeChild(fracOverlay); fracOverlay.destroy(true); fracOverlay=null; }
    if (!FRAC_ON) return;
    const WORLD_W = Math.round(bgTex.width * SCALE), WORLD_H = Math.round(bgTex.height * SCALE);
    const g=new PIXI.Graphics();
    const { ink } = paletteColors(PALETTE);
    g.lineStyle(FRAC_THICK, ink, FRAC_ALPHA);
    const base = Math.max(24, Math.round((1.0-FRAC_DENSITY)*160));
    const layers = [base, Math.max(8, Math.round(base*0.5)), Math.max(6, Math.round(base*0.33))];
    for (const step of layers){
      const s = Math.max(6, Math.round(step*SCALE));
      const jitter = s*0.25;
      for (let x=0; x<=WORLD_W; x+=s){ const xj = x + (Math.random()*2-1)*jitter; g.moveTo(xj,0); g.lineTo(xj,WORLD_H); }
      for (let y=0; y<=WORLD_H; y+=s){ const yj = y + (Math.random()*2-1)*jitter; g.moveTo(0,yj); g.lineTo(WORLD_W,yj); }
    }
    fracOverlay=g; bgInner.addChild(fracOverlay);
  }
  function buildVanishingGuides(){
    if (!ALIEN_V2_ON) return;
    if (vgOverlay){ if (vgOverlay.parent) vgOverlay.parent.removeChild(vgOverlay); vgOverlay.destroy(true); vgOverlay=null; }
    if (!VG_ON) return;
    const WORLD_W = Math.round(bgTex.width * SCALE), WORLD_H = Math.round(bgTex.height * SCALE);
    const g=new PIXI.Graphics();
    const { ink } = paletteColors(PALETTE);
    g.lineStyle(1, ink, 0.18);
    const ang = VG_TILT * Math.PI/180;
    const cx = WORLD_W/2, cy = WORLD_H/2;
    const leftVP = { x: cx - Math.cos(ang)*1000, y: cy - Math.sin(ang)*1000 };
    const rightVP = { x: cx + Math.cos(ang)*1000, y: cy + Math.sin(ang)*1000 };
    const density = Math.max(0.1, VG_DENSITY);
    const step = 20 / density;
    for (let i=-200; i<=200; i+=step){
      const y = cy + i;
      g.moveTo(cx, y); g.lineTo(leftVP.x, leftVP.y);
      if (VG_TWO){ g.moveTo(cx, y); g.lineTo(rightVP.x, rightVP.y); }
    }
    vgOverlay=g; bgInner.addChild(vgOverlay);
  }
  function buildControlMarks(){
    if (!ALIEN_V2_ON) return;
    if (marksOverlay){ if (marksOverlay.parent) marksOverlay.parent.removeChild(marksOverlay); marksOverlay.destroy(true); marksOverlay=null; }
    if (!MARKS_ON) return;
    const WORLD_W = Math.round(bgTex.width * SCALE), WORLD_H = Math.round(bgTex.height * SCALE);
    const g=new PIXI.Graphics();
    const { ink } = paletteColors(PALETTE);
    g.lineStyle(1, ink, MARKS_ALPHA);
    const step = Math.max(12, Math.round((1.0-MARKS_DENSITY)*80));
    for (let y=MARKS_SIZE; y<WORLD_H; y+=step){
      for (let x=MARKS_SIZE; x<WORLD_W; x+=step){
        if (Math.random() < MARKS_DENSITY){
          g.moveTo(x-MARKS_SIZE, y); g.lineTo(x+MARKS_SIZE, y);
          g.moveTo(x, y-MARKS_SIZE); g.lineTo(x, y+MARKS_SIZE);
        }
      }
    }
    marksOverlay=g; bgInner.addChild(marksOverlay);
  }

  // Lighting
  function createRadialSprite(innerR, outerR, alpha){
    const size=Math.ceil(outerR*2);
    const c=document.createElement('canvas'); c.width=c.height=size;
    const ctx=c.getContext('2d'), cx=outerR, cy=outerR;
    const g=ctx.createRadialGradient(cx,cy,0,cx,cy,outerR);
    const mid=Math.max(0,Math.min(1, innerR/outerR));
    g.addColorStop(0.0,`rgba(255,255,255,${alpha})`);
    g.addColorStop(mid,`rgba(255,255,255,${alpha*0.7})`);
    g.addColorStop(1.0,'rgba(255,255,255,0)');
    ctx.fillStyle=g; ctx.fillRect(0,0,size,size);
    const s=PIXI.Sprite.from(c); s.anchor.set(0.5,0.5); return s;
  }
  function buildLighting(){
    if (darkness){ try{ app.stage.removeChild(darkness); darkness.destroy({children:true}); }catch{} darkness=null; }
    if (brightDisc){ try{ brightDisc.destroy(true);}catch{} brightDisc=null; }
    if (dimDisc){ try{ dimDisc.destroy(true);}catch{} dimDisc=null; }
    if (lightTint){ try{ app.stage.removeChild(lightTint); lightTint.destroy(true);}catch{} lightTint=null; }
    if (!NIGHT_ENABLED || !LIGHTING_ON) return;
    darkness = new PIXI.Container();
    const dr = new PIXI.Graphics();
    dr.beginFill(0x000000,1.0).drawRect(0,0,app.renderer.width, app.renderer.height).endFill();
    darkness.addChild(dr);
    if (FOGGINESS>0){ darkness.filters = [ new PIXI.NoiseFilter(FOGGINESS) ]; }
    app.stage.addChild(darkness);
    brightDisc = createRadialSprite(TORCH_RADIUS,TORCH_SOFT_RADIUS,1.0);
    brightDisc.blendMode = PIXI.BLEND_MODES.ERASE; darkness.addChild(brightDisc);
    dimDisc = createRadialSprite(TORCH_SOFT_RADIUS,DIM_RADIUS,1.0);
    dimDisc.blendMode = PIXI.BLEND_MODES.ERASE; darkness.addChild(dimDisc);
    if (LIGHT_TINT_ALPHA>0){
      lightTint = createRadialSprite(TORCH_RADIUS,DIM_RADIUS,LIGHT_TINT_ALPHA);
      lightTint.tint = LIGHT_TINT_COLOR; lightTint.blendMode = PIXI.BLEND_MODES.ADD; app.stage.addChild(lightTint);
    }
  }

  // Modes
  function applyViewMode(){

  const gameDiv = document.getElementById('game');
  const secExport = document.getElementById('secExport');

    const isLighting = (VIEW_MODE==='lighting');

    const isExport = (VIEW_MODE==='export');
    if (gameDiv) gameDiv.style.display = isExport ? 'none' : 'block';
    if (secExport) secExport.classList.toggle('hidden', !isExport);
    if (uiOverlay) uiOverlay.visible = !isExport;

    LIGHTING_ON = isLighting;
    app.renderer.background.color = isLighting ? 0x0a0f16 : 0xf6f7f8;

    // Clear overlays
    for (const ov of [gridOverlay,glyphOverlay,fracOverlay,vgOverlay,marksOverlay,ritualOverlay,mockOverlay]){
      if (ov){ if (ov.parent) ov.parent.removeChild(ov); ov.destroy(true); }
    }
    gridOverlay=glyphOverlay=fracOverlay=vgOverlay=marksOverlay=ritualOverlay=mockOverlay=null;

    if (VIEW_MODE==='raw'){
      if (posterSprite){ posterSprite.destroy(true); posterSprite=null; }
      if (pocheSprite){ pocheSprite.destroy(true); pocheSprite=null; }
      if (edgeSprite) edgeSprite.visible=false;
      bg.alpha=1.0; buildLighting(); return;
    }

    bg.alpha = 1.0;
    buildPosterizeAndPoche();
    refreshEdges();

    if (ALIEN_V1_ON){ buildGridOverlay(); buildGlyphOverlay(); }
    if (ALIEN_V2_ON){ buildFractureOverlay(); buildVanishingGuides(); buildControlMarks(); }

    if (regionEnabled){ buildPosterBase(); buildEdgesBase(); }
    applyRegionComposition();
    if (uiOverlay && uiOverlay.parent){ app.stage.removeChild(uiOverlay); app.stage.addChild(uiOverlay); }

    if (!isExport) buildLighting();
  }

  // UI state & persistence
  const storeKey='pixi_arch_engine_v6';
  let ALIEN_V1_ON=false, ALIEN_V2_ON=false, GEOM_PICK='edge', DISC_PICK='none';
  function save(){ const s={
    EDGE_ENABLED, EDGE_THRESHOLD, EDGE_GAIN, EDGE_ALPHA, EDGE_COLOR,
    SNAP_STRENGTH, CORNER_SHARP, OUTLINE_THICK, INTERIOR_TRIM,
    POSTER_LEVELS, POCHE_BAND, POCHE_OPACITY, PALETTE,
    WARP_TYPE, WARP_AMOUNT, GRID_ON, GRID_SPACING, GRID_ANGLE,
    GLYPH_ON, GLYPH_DENSITY, GLYPH_SIZE, VIEW_MODE,
    FRAC_ON, FRAC_DENSITY, FRAC_THICK, FRAC_ALPHA,
    VG_ON, VG_TILT, VG_DENSITY, VG_TWO,
    MARKS_ON, MARKS_DENSITY, MARKS_SIZE, MARKS_ALPHA,
    DISC_ON, DISC_SYM, DISC_CORNER, DISC_STRAIGHT, DISC_OUTLINE,
    ALIEN_V1_ON, ALIEN_V2_ON, GEOM_PICK, DISC_PICK,
    TRANS_MODE, MOCK_EXAG, MOCK_ERASE, MOCK_DETAIL, CONF_RIGID, CONF_SYMBOLS, CONF_GHOST, CONF_SCOUR,
    regionEnabled, regionRect, regionAffectBg, regionAffectEdges, regionAffectOver
  }; localStorage.setItem(storeKey, JSON.stringify(s)); }
  function load(){ try{ const s=JSON.parse(localStorage.getItem(storeKey)||'{}');
    EDGE_ENABLED=s.EDGE_ENABLED??EDGE_ENABLED; EDGE_THRESHOLD=s.EDGE_THRESHOLD??EDGE_THRESHOLD;
    EDGE_GAIN=s.EDGE_GAIN??EDGE_GAIN; EDGE_ALPHA=s.EDGE_ALPHA??EDGE_ALPHA; EDGE_COLOR=s.EDGE_COLOR??EDGE_COLOR;
    SNAP_STRENGTH=s.SNAP_STRENGTH??SNAP_STRENGTH; CORNER_SHARP=s.CORNER_SHARP??CORNER_SHARP;
    OUTLINE_THICK=s.OUTLINE_THICK??OUTLINE_THICK; INTERIOR_TRIM=s.INTERIOR_TRIM??INTERIOR_TRIM;
    POSTER_LEVELS=s.POSTER_LEVELS??POSTER_LEVELS; POCHE_BAND=s.POCHE_BAND??POCHE_BAND; POCHE_OPACITY=s.POCHE_OPACITY??POCHE_OPACITY;
    PALETTE=s.PALETTE??PALETTE; WARP_TYPE=s.WARP_TYPE??WARP_TYPE; WARP_AMOUNT=s.WARP_AMOUNT??WARP_AMOUNT;
    GRID_ON=s.GRID_ON??GRID_ON; GRID_SPACING=s.GRID_SPACING??GRID_SPACING; GRID_ANGLE=s.GRID_ANGLE??GRID_ANGLE;
    GLYPH_ON=s.GLYPH_ON??GLYPH_ON; GLYPH_DENSITY=s.GLYPH_DENSITY??GLYPH_DENSITY; GLYPH_SIZE=s.GLYPH_SIZE??GLYPH_SIZE;
    VIEW_MODE=s.VIEW_MODE??VIEW_MODE;
    FRAC_ON=s.FRAC_ON??FRAC_ON; FRAC_DENSITY=s.FRAC_DENSITY??FRAC_DENSITY; FRAC_THICK=s.FRAC_THICK??FRAC_THICK; FRAC_ALPHA=s.FRAC_ALPHA??FRAC_ALPHA;
    VG_ON=s.VG_ON??VG_ON; VG_TILT=s.VG_TILT??VG_TILT; VG_DENSITY=s.VG_DENSITY??VG_DENSITY; VG_TWO=s.VG_TWO??VG_TWO;
    MARKS_ON=s.MARKS_ON??MARKS_ON; MARKS_DENSITY=s.MARKS_DENSITY??MARKS_DENSITY; MARKS_SIZE=s.MARKS_SIZE??MARKS_SIZE; MARKS_ALPHA=s.MARKS_ALPHA??MARKS_ALPHA;
    DISC_ON=s.DISC_ON??DISC_ON; DISC_SYM=s.DISC_SYM??DISC_SYM; DISC_CORNER=s.DISC_CORNER??DISC_CORNER; DISC_STRAIGHT=s.DISC_STRAIGHT??DISC_STRAIGHT; DISC_OUTLINE=s.DISC_OUTLINE??DISC_OUTLINE;
    ALIEN_V1_ON=s.ALIEN_V1_ON??false; ALIEN_V2_ON=s.ALIEN_V2_ON??false; GEOM_PICK=s.GEOM_PICK??'edge'; DISC_PICK=s.DISC_PICK??'none';
    TRANS_MODE=s.TRANS_MODE??TRANS_MODE; MOCK_EXAG=s.MOCK_EXAG??MOCK_EXAG; MOCK_ERASE=s.MOCK_ERASE??MOCK_ERASE; MOCK_DETAIL=s.MOCK_DETAIL??MOCK_DETAIL;
    CONF_RIGID=s.CONF_RIGID??CONF_RIGID; CONF_SYMBOLS=s.CONF_SYMBOLS??CONF_SYMBOLS; CONF_GHOST=s.CONF_GHOST??CONF_GHOST; CONF_SCOUR=s.CONF_SCOUR??CONF_SCOUR;
    regionEnabled=s.regionEnabled??false; regionRect=s.regionRect??null; regionAffectBg=s.regionAffectBg??true; regionAffectEdges=s.regionAffectEdges??true; regionAffectOver=s.regionAffectOver??true;
  }catch{} }
  load();

  // bind View/Profile
  const ctlViewMode=$('ctlViewMode'), ctlProfile=$('ctlProfile');
  if (ctlViewMode){ ctlViewMode.value=VIEW_MODE; ctlViewMode.addEventListener('change',()=>{ VIEW_MODE=ctlViewMode.value; applyViewMode(); save(); }); }
  if (ctlProfile){
    ctlProfile.addEventListener('change',()=>{
      const p=ctlProfile.value;
      if (p==='blueprint'){ PALETTE='blueprint'; EDGE_COLOR=0x0b1d3a; EDGE_ALPHA=0.95; POSTER_LEVELS=3; SNAP_STRENGTH=0.8; OUTLINE_THICK=3; INTERIOR_TRIM=1.2; }
      else if (p==='graphite'){ PALETTE='graphite'; EDGE_COLOR=0x333333; EDGE_ALPHA=0.9; POSTER_LEVELS=4; SNAP_STRENGTH=0.6; OUTLINE_THICK=2; INTERIOR_TRIM=1.0; }
      else { PALETTE='black'; EDGE_COLOR=0x111111; EDGE_ALPHA=1.0; POSTER_LEVELS=3; SNAP_STRENGTH=0.7; OUTLINE_THICK=2.5; INTERIOR_TRIM=1.0; }
      buildPosterizeAndPoche(); refreshEdges();
      if (ALIEN_V1_ON){ buildGridOverlay(); buildGlyphOverlay(); }
      if (ALIEN_V2_ON){ buildFractureOverlay(); buildVanishingGuides(); buildControlMarks(); }
      save();
    });
  }

  // Geometry dropdown
  const ctlGeomSelect=$('ctlGeomSelect');
  const secEdge=$('secEdge'), secSnap=$('secSnap'), secPoster=$('secPoster');
  function showGeom(which){
    GEOM_PICK=which;
    secEdge.classList.toggle('hidden', which!=='edge');
    secSnap.classList.toggle('hidden', which!=='snap');
    secPoster.classList.toggle('hidden', which!=='poster');
    save();
  }
  if (ctlGeomSelect){ ctlGeomSelect.value=GEOM_PICK; ctlGeomSelect.addEventListener('change', ()=>showGeom(ctlGeomSelect.value)); }
  showGeom(GEOM_PICK);

  // Alienization dropdown
  const ctlAlienSelect=$('ctlAlienSelect');
  const secAlienV1=$('secAlienV1'), secAlienV2=$('secAlienV2');
  function showAlien(which){
    ALIEN_V1_ON = (which==='v1');
    ALIEN_V2_ON = (which==='v2');
    secAlienV1.classList.toggle('hidden', !ALIEN_V1_ON);
    secAlienV2.classList.toggle('hidden', !ALIEN_V2_ON);
    applyViewMode(); save();
  }
  let initialAlien = (ALIEN_V2_ON? 'v2' : (ALIEN_V1_ON? 'v1' : 'none'));
  if (ctlAlienSelect){ ctlAlienSelect.value=initialAlien; ctlAlienSelect.addEventListener('change', ()=>showAlien(ctlAlienSelect.value)); }
  showAlien(initialAlien);

  // Discipline dropdown
  const ctlDiscSelect=$('ctlDiscSelect'), secDiscipline=$('secDiscipline');
  function showDiscipline(which){
    DISC_PICK = which;
    DISC_ON = (which==='v3');
    secDiscipline.classList.toggle('hidden', !DISC_ON);
    refreshEdges(); save();
  }
  if (ctlDiscSelect){ ctlDiscSelect.value = (DISC_ON?'v3':'none'); ctlDiscSelect.addEventListener('change', ()=>showDiscipline(ctlDiscSelect.value)); }
  showDiscipline(DISC_ON?'v3':'none');

  // Transformations dropdown
  const ctlTransSelect=$('ctlTransSelect'), secMockery=$('secMockery'), secConfession=$('secConfession');
  function showTrans(which){
    TRANS_MODE = which;
    secMockery.classList.toggle('hidden', which!=='mockery');
    secConfession.classList.toggle('hidden', which!=='confession');
    // rebuild scene with modified geometry
    buildPosterizeAndPoche(); refreshEdges(); save();
  }
  if (ctlTransSelect){ ctlTransSelect.value = TRANS_MODE; ctlTransSelect.addEventListener('change', ()=>showTrans(ctlTransSelect.value)); }
  showTrans(TRANS_MODE);

  // Bind controls (common)
  const ctlEdgeOn=$('ctlEdgeOn'), ctlEdgeTh=$('ctlEdgeTh'), ctlEdgeGain=$('ctlEdgeGain'), ctlEdgeA=$('ctlEdgeA'), ctlEdgeColor=$('ctlEdgeColor');
  const ctlSnap=$('ctlSnap'), ctlCorner=$('ctlCorner'), ctlOutline=$('ctlOutline'), ctlInterior=$('ctlInterior');
  const ctlPosterLevels=$('ctlPosterLevels'), ctlPocheBand=$('ctlPocheBand'), ctlPocheOpacity=$('ctlPocheOpacity'), ctlPalette=$('ctlPalette');
  const ctlWarpType=$('ctlWarpType'), ctlWarpAmt=$('ctlWarpAmt'), ctlGridOn=$('ctlGridOn'), ctlGridSpacing=$('ctlGridSpacing'), ctlGridAngle=$('ctlGridAngle');
  const ctlGlyphOn=$('ctlGlyphOn'), ctlGlyphDensity=$('ctlGlyphDensity'), ctlGlyphSize=$('ctlGlyphSize');
  const ctlFracOn=$('ctlFracOn'), ctlFracDensity=$('ctlFracDensity'), ctlFracThick=$('ctlFracThick'), ctlFracAlpha=$('ctlFracAlpha');
  const ctlVGOn=$('ctlVGOn'), ctlVGTilt=$('ctlVGTilt'), ctlVGDensity=$('ctlVGDensity'), ctlVGTwo=$('ctlVGTwo');
  const ctlMarksOn=$('ctlMarksOn'), ctlMarksDensity=$('ctlMarksDensity'), ctlMarksSize=$('ctlMarksSize'), ctlMarksAlpha=$('ctlMarksAlpha');
  const ctlDiscSym=$('ctlDiscSym'), ctlDiscCorner=$('ctlDiscCorner'), ctlDiscStraight=$('ctlDiscStraight'), ctlDiscOutline=$('ctlDiscOutline');
  const ctlMockExag=$('ctlMockExag'), ctlMockErase=$('ctlMockErase'), ctlMockDetail=$('ctlMockDetail');
  const ctlConfRigid=$('ctlConfRigid'), ctlConfSymbols=$('ctlConfSymbols'), ctlConfGhost=$('ctlConfGhost'), ctlConfScour=$('ctlConfScour');

  function bindRange(el, get, set, after){ if(!el) return; el.value=String(get()); el.addEventListener('input',()=>{ set(Number(el.value)); if(after) after(); save(); }); }
  function bindSelect(el, get, set, after){ if(!el) return; el.value=get(); el.addEventListener('change',()=>{ set(el.value); if(after) after(); save(); }); }
  function bindColor(el, get, set, after){ if(!el) return; el.value=get(); el.addEventListener('input',()=>{ set(el.value); if(after) after(); save(); }); }

  if (ctlEdgeOn){ ctlEdgeOn.checked=!!EDGE_ENABLED; ctlEdgeOn.addEventListener('change',()=>{ EDGE_ENABLED=ctlEdgeOn.checked; refreshEdges(); save(); }); }
  bindRange(ctlEdgeTh, ()=>EDGE_THRESHOLD, v=>EDGE_THRESHOLD=v, ()=>refreshEdges());
  bindRange(ctlEdgeGain, ()=>EDGE_GAIN, v=>EDGE_GAIN=v, ()=>refreshEdges());
  bindRange(ctlEdgeA, ()=>EDGE_ALPHA, v=>EDGE_ALPHA=v, ()=>refreshEdges());
  if (ctlEdgeColor){ ctlEdgeColor.value='#'+EDGE_COLOR.toString(16).padStart(6,'0'); ctlEdgeColor.addEventListener('input',()=>{ EDGE_COLOR=parseInt(ctlEdgeColor.value.replace('#','0x'),16); refreshEdges(); save(); }); }

  bindRange(ctlSnap, ()=>SNAP_STRENGTH, v=>SNAP_STRENGTH=v, ()=>refreshEdges());
  bindRange(ctlCorner, ()=>CORNER_SHARP, v=>CORNER_SHARP=v, ()=>refreshEdges());
  bindRange(ctlOutline, ()=>OUTLINE_THICK, v=>OUTLINE_THICK=v, ()=>refreshEdges());
  bindRange(ctlInterior, ()=>INTERIOR_TRIM, v=>INTERIOR_TRIM=v, ()=>refreshEdges());

  bindRange(ctlPosterLevels, ()=>POSTER_LEVELS, v=>POSTER_LEVELS=v, ()=>{ buildPosterizeAndPoche(); if(regionEnabled){buildPosterBase();} applyRegionComposition(); });
  bindRange(ctlPocheBand, ()=>POCHE_BAND, v=>POCHE_BAND=v, ()=>{ buildPosterizeAndPoche(); if(regionEnabled){buildPosterBase();} applyRegionComposition(); });
  bindRange(ctlPocheOpacity, ()=>POCHE_OPACITY, v=>POCHE_OPACITY=v, ()=>{ buildPosterizeAndPoche(); if(regionEnabled){buildPosterBase();} applyRegionComposition(); });
  bindSelect(ctlPalette, ()=>PALETTE, v=>PALETTE=v, ()=>{ buildPosterizeAndPoche(); refreshEdges(); if (regionEnabled){ buildPosterBase(); buildEdgesBase(); } if (ALIEN_V1_ON){buildGridOverlay();buildGlyphOverlay();} if (ALIEN_V2_ON){buildFractureOverlay();buildVanishingGuides();buildControlMarks();} applyRegionComposition(); });

  if (ctlWarpType){ ctlWarpType.value=WARP_TYPE; ctlWarpType.addEventListener('change',()=>{ WARP_TYPE=ctlWarpType.value; applyWarpFilter(); save(); }); }
  if (ctlWarpAmt){ ctlWarpAmt.value=String(WARP_AMOUNT); ctlWarpAmt.addEventListener('input',()=>{ WARP_AMOUNT=Number(ctlWarpAmt.value); applyWarpFilter(); save(); }); }
  if (ctlGridOn){ ctlGridOn.checked=!!GRID_ON; ctlGridOn.addEventListener('change',()=>{ GRID_ON=ctlGridOn.checked; buildGridOverlay(); save(); }); }
  bindRange(ctlGridSpacing, ()=>GRID_SPACING, v=>GRID_SPACING=v, ()=>buildGridOverlay());
  bindRange(ctlGridAngle, ()=>GRID_ANGLE, v=>GRID_ANGLE=v, ()=>buildGridOverlay());
  if (ctlGlyphOn){ ctlGlyphOn.checked=!!GLYPH_ON; ctlGlyphOn.addEventListener('change',()=>{ GLYPH_ON=ctlGlyphOn.checked; buildGlyphOverlay(); save(); }); }
  bindRange(ctlGlyphDensity, ()=>GLYPH_DENSITY, v=>GLYPH_DENSITY=v, ()=>buildGlyphOverlay());
  bindRange(ctlGlyphSize, ()=>GLYPH_SIZE, v=>GLYPH_SIZE=v, ()=>buildGlyphOverlay());

  if (ctlFracOn){ ctlFracOn.checked=!!FRAC_ON; ctlFracOn.addEventListener('change',()=>{ FRAC_ON=ctlFracOn.checked; buildFractureOverlay(); save(); }); }
  bindRange(ctlFracDensity, ()=>FRAC_DENSITY, v=>FRAC_DENSITY=v, ()=>buildFractureOverlay());
  bindRange(ctlFracThick, ()=>FRAC_THICK, v=>FRAC_THICK=v, ()=>buildFractureOverlay());
  bindRange(ctlFracAlpha, ()=>FRAC_ALPHA, v=>FRAC_ALPHA=v, ()=>buildFractureOverlay());

  if (ctlVGOn){ ctlVGOn.checked=!!VG_ON; ctlVGOn.addEventListener('change',()=>{ VG_ON=ctlVGOn.checked; buildVanishingGuides(); save(); }); }
  bindRange(ctlVGTilt, ()=>VG_TILT, v=>VG_TILT=v, ()=>buildVanishingGuides());
  bindRange(ctlVGDensity, ()=>VG_DENSITY, v=>VG_DENSITY=v, ()=>buildVanishingGuides());
  if (ctlVGTwo){ ctlVGTwo.checked=!!VG_TWO; ctlVGTwo.addEventListener('change',()=>{ VG_TWO=ctlVGTwo.checked; buildVanishingGuides(); save(); }); }

  if (ctlMarksOn){ ctlMarksOn.checked=!!MARKS_ON; ctlMarksOn.addEventListener('change',()=>{ MARKS_ON=ctlMarksOn.checked; buildControlMarks(); save(); }); }
  bindRange(ctlMarksDensity, ()=>MARKS_DENSITY, v=>MARKS_DENSITY=v, ()=>buildControlMarks());
  bindRange(ctlMarksSize, ()=>MARKS_SIZE, v=>MARKS_SIZE=v, ()=>buildControlMarks());
  bindRange(ctlMarksAlpha, ()=>MARKS_ALPHA, v=>MARKS_ALPHA=v, ()=>buildControlMarks());

  bindRange(ctlDiscSym, ()=>DISC_SYM, v=>DISC_SYM=v, ()=>refreshEdges());
  bindRange(ctlDiscCorner, ()=>DISC_CORNER, v=>DISC_CORNER=v, ()=>refreshEdges());
  bindRange(ctlDiscStraight, ()=>DISC_STRAIGHT, v=>DISC_STRAIGHT=v, ()=>refreshEdges());
  bindRange(ctlDiscOutline, ()=>DISC_OUTLINE, v=>DISC_OUTLINE=v, ()=>{ refreshEdges(); if(regionEnabled){buildEdgesBase();} applyRegionComposition(); });

  bindRange(ctlMockExag, ()=>MOCK_EXAG, v=>MOCK_EXAG=v, ()=>refreshEdges());
  bindRange(ctlMockErase, ()=>MOCK_ERASE, v=>MOCK_ERASE=v, ()=>refreshEdges());
  bindRange(ctlMockDetail, ()=>MOCK_DETAIL, v=>MOCK_DETAIL=v, ()=>{ refreshEdges(); applyRegionComposition(); });

  bindRange(ctlConfRigid, ()=>CONF_RIGID, v=>CONF_RIGID=v, ()=>{ buildPosterizeAndPoche(); refreshEdges(); });
  bindRange(ctlConfSymbols, ()=>CONF_SYMBOLS, v=>CONF_SYMBOLS=v, ()=>refreshEdges());
  bindRange(ctlConfGhost, ()=>CONF_GHOST, v=>CONF_GHOST=v, ()=>{ refreshEdges(); applyRegionComposition(); });
  bindRange(ctlConfScour, ()=>CONF_SCOUR, v=>CONF_SCOUR=v, ()=>{ buildPosterizeAndPoche(); refreshEdges(); });

  

  // Edge-preserving-ish smoothing: apply blur to poster canvas only
  function smoothPosterCanvas(srcCanvas, strength){
    if (!srcCanvas) return null;
    const w=srcCanvas.width, h=srcCanvas.height;
    const out=document.createElement('canvas'); out.width=w; out.height=h;
    const ctx=out.getContext('2d');
    // Use CSS filter blur as fast approx; reinforce contrast slightly to keep separation
    const px = strength<=0 ? 0 : (strength===1 ? 0.8 : (strength===2 ? 1.6 : 2.4));
    ctx.filter = px>0 ? `blur(${px}px) contrast(105%)` : 'none';
    ctx.drawImage(srcCanvas,0,0);
    ctx.filter = 'none';
    return out;
  }

  // ---- Export (no lighting): render full map to PNG ----
  async function exportPNG(){
    const ctlExportSize=document.getElementById('ctlExportSize');
    const ctlExportSmooth=document.getElementById('ctlExportSmooth');
    const ctlExportSmoothAmt=document.getElementById('ctlExportSmoothAmt');
    const ctlExportTarget=document.getElementById('ctlExportTarget');
    const wantNative = ctlExportSize && ctlExportSize.value==='native';
    const smoothOn = ctlExportSmooth && ctlExportSmooth.checked;
    const smoothAmt = ctlExportSmoothAmt ? Number(ctlExportSmoothAmt.value) : 0;
    const smoothTarget = ctlExportTarget ? ctlExportTarget.value : 'bg';
    try{
      const isExport = (VIEW_MODE==='export');
      // Build up-to-date treatment
      buildPosterizeAndPoche();
      refreshEdges();
      if (ALIEN_V1_ON){ buildGridOverlay(); buildGlyphOverlay(); }
      if (ALIEN_V2_ON){ buildFractureOverlay(); buildVanishingGuides(); buildControlMarks(); }

      // Optionally smooth the poster (background only)
      let oldPosterTexture=null;
      if (smoothOn && smoothTarget==='bg' && posterCanvasLast){
        const sm = smoothPosterCanvas(posterCanvasLast, smoothAmt);
        if (sm && posterSprite){ oldPosterTexture = posterSprite.texture; posterSprite.texture = PIXI.Texture.from(sm); posterSprite.texture.baseTexture.scaleMode=PIXI.SCALE_MODES.LINEAR; }
      }

      // Temporarily prepare stage for capture
      const oldW = app.renderer.width, oldH = app.renderer.height;
      const exportScale = wantNative ? 1.0 : SCALE;
      const WORLD_W = Math.round(bgTex.width * exportScale), WORLD_H = Math.round(bgTex.height * exportScale);
      const oldWorldX = world.x, oldWorldY = world.y;
      const oldWorldScaleX = world.scale.x, oldWorldScaleY = world.scale.y;
      const oldBg = app.renderer.background.color;
      const oldPlayerVis = player.visible;

      // Show everything, no lighting
      if (darkness){ app.stage.removeChild(darkness); darkness.destroy({children:true}); darkness=null; }
      if (lightTint){ app.stage.removeChild(lightTint); lightTint.destroy(true); lightTint=null; }
      player.visible = false;
      world.x = 0; world.y = 0;
      // scale world so that previously scaled sprites render at requested exportScale
      const factor = exportScale / SCALE; world.scale.set(factor);
      app.renderer.background.color = 0xffffff;
      app.renderer.resize(WORLD_W, WORLD_H);
      app.render();

      // Extract PNG
      const cvs = app.renderer.extract.canvas(app.stage);
      let outCanvas = cvs;
      if (smoothOn && smoothTarget==='all'){
        const sm = document.createElement('canvas'); sm.width=outCanvas.width; sm.height=outCanvas.height;
        const sctx = sm.getContext('2d');
        const px = smoothAmt<=0 ? 0 : (smoothAmt===1 ? 0.6 : (smoothAmt===2 ? 1.2 : 2.0));
        sctx.filter = px>0 ? `blur(${px}px)` : 'none';
        sctx.drawImage(outCanvas,0,0);
        sctx.filter='none';
        outCanvas = sm;
      }
      const url = outCanvas.toDataURL('image/png');

      // Restore
      player.visible = oldPlayerVis;
      world.x = oldWorldX; world.y = oldWorldY; world.scale.set(oldWorldScaleX, oldWorldScaleY);
      app.renderer.resize(oldW, oldH);
      app.renderer.background.color = oldBg;
      if (oldPosterTexture && posterSprite){ posterSprite.texture.destroy(true); posterSprite.texture = oldPosterTexture; }

      // Trigger download
      const a=document.createElement('a');
      a.href=url; a.download='map_export.png';
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL?.(url);
    }catch(e){ console.error('Export failed:', e); }
  }


  // ---- Regions UI ----
  const ctlRegionEnable=$('ctlRegionEnable'), btnAddRegion=$('btnAddRegion'), btnEditRegion=$('btnEditRegion'), btnClearRegion=$('btnClearRegion');
  const ctlRegionAffectBg=$('ctlRegionAffectBg'), ctlRegionAffectEdges=$('ctlRegionAffectEdges'), ctlRegionAffectOver=$('ctlRegionAffectOver');

  if (ctlRegionEnable){ ctlRegionEnable.checked=regionEnabled; ctlRegionEnable.addEventListener('change', ()=>{ regionEnabled=ctlRegionEnable.checked; if(regionEnabled){ buildPosterBase(); buildEdgesBase(); } applyRegionComposition(); save(); }); }
  if (ctlRegionAffectBg){ ctlRegionAffectBg.addEventListener('change', ()=>{ regionAffectBg=ctlRegionAffectBg.checked; applyRegionComposition(); save(); }); }
  if (ctlRegionAffectEdges){ ctlRegionAffectEdges.addEventListener('change', ()=>{ regionAffectEdges=ctlRegionAffectEdges.checked; applyRegionComposition(); save(); }); }
  if (ctlRegionAffectOver){ ctlRegionAffectOver.addEventListener('change', ()=>{ regionAffectOver=ctlRegionAffectOver.checked; applyRegionComposition(); save(); }); }

  if (btnAddRegion){ btnAddRegion.addEventListener('click', ()=>{ regionEdit=true; btnEditRegion?.classList.add('active'); }); }
  if (btnEditRegion){ btnEditRegion.addEventListener('click', ()=>{ regionEdit=!regionEdit; btnEditRegion.classList.toggle('active', regionEdit); }); }
  if (btnClearRegion){ btnClearRegion.addEventListener('click', ()=>{ regionRect=null; if (regionMask){ regionMask.clear(); } if (regionOutline){ regionOutline.clear(); } applyRegionComposition(); save(); }); }

  // Draw rectangle with mouse on the game canvas coordinates
  const canvasEl = app.view || app.canvas;
  let dragStart=null;
  canvasEl.addEventListener('mousedown', (e)=>{
    if (!regionEdit) return;
    const rect=canvasEl.getBoundingClientRect();
    const x=(e.clientX-rect.left), y=(e.clientY-rect.top);
    dragStart={x,y};
  });
  window.addEventListener('mousemove', (e)=>{
    if (!dragStart || !regionEdit) return;
    const rect=canvasEl.getBoundingClientRect();
    const x=(e.clientX-rect.left), y=(e.clientY-rect.top);
    let x0=Math.min(dragStart.x,x), y0=Math.min(dragStart.y,y);
    let w=Math.abs(x-dragStart.x), h=Math.abs(y-dragStart.y);
    // convert to world coords accounting for camera/world offset
    const worldX = x0 - world.x, worldY = y0 - world.y;
    regionRect = { x: worldX, y: worldY, w, h };
    drawRegionMask();
  });
  window.addEventListener('mouseup', ()=>{
    if (dragStart){ dragStart=null; regionEnabled=true; if (ctlRegionEnable) ctlRegionEnable.checked=true; buildPosterBase(); buildEdgesBase(); applyRegionComposition(); save(); }
  });

  // Drag to move when Edit is on and region exists (click inside)
  canvasEl.addEventListener('mousedown', (e)=>{
    if (!regionEdit || !regionRect) return;
    const rect=canvasEl.getBoundingClientRect();
    const x=(e.clientX-rect.left)-world.x, y=(e.clientY-rect.top)-world.y;
    if (x>=regionRect.x && x<=regionRect.x+regionRect.w && y>=regionRect.y && y<=regionRect.y+regionRect.h){
      dragStart={xOff:x-regionRect.x, yOff:y-regionRect.y, moving:true};
    }
  });
  window.addEventListener('mousemove', (e)=>{
    if (!dragStart || !dragStart.moving || !regionEdit) return;
    const rect=canvasEl.getBoundingClientRect();
    const x=(e.clientX-rect.left)-world.x, y=(e.clientY-rect.top)-world.y;
    regionRect.x = x - dragStart.xOff; regionRect.y = y - dragStart.yOff; drawRegionMask(); applyRegionComposition();
  });
  window.addEventListener('mouseup', ()=>{ if (dragStart && dragStart.moving){ dragStart=null; save(); } });


  // Export button
  const btnExport=document.getElementById('btnExport'); if (btnExport) btnExport.addEventListener('click', exportPNG);

  // Reset buttons
  const resetGeom=$('resetGeom'), resetAlien=$('resetAlien'), resetDisc=$('resetDisc'), resetTrans=$('resetTrans');
  if (resetGeom){ resetGeom.addEventListener('click', ()=>{
    // zero/neutral geometry
    EDGE_ENABLED=true; EDGE_THRESHOLD=40; EDGE_GAIN=3.0; EDGE_ALPHA=1.0; EDGE_COLOR=0x111111;
    SNAP_STRENGTH=0.0; CORNER_SHARP=0.0; OUTLINE_THICK=0.0; INTERIOR_TRIM=0.0;
    POSTER_LEVELS=3; POCHE_BAND=0; POCHE_OPACITY=0.0; PALETTE='black';
    // update UI
    $('ctlEdgeOn').checked=EDGE_ENABLED; $('ctlEdgeTh').value=EDGE_THRESHOLD; $('ctlEdgeGain').value=EDGE_GAIN; $('ctlEdgeA').value=EDGE_ALPHA; $('ctlEdgeColor').value='#111111';
    $('ctlSnap').value=SNAP_STRENGTH; $('ctlCorner').value=CORNER_SHARP; $('ctlOutline').value=OUTLINE_THICK; $('ctlInterior').value=INTERIOR_TRIM;
    $('ctlPosterLevels').value=POSTER_LEVELS; $('ctlPocheBand').value=POCHE_BAND; $('ctlPocheOpacity').value=POCHE_OPACITY; $('ctlPalette').value=PALETTE;
    buildPosterizeAndPoche(); refreshEdges(); save();
  }); }
  if (resetAlien){ resetAlien.addEventListener('click', ()=>{
    ALIEN_V1_ON=false; ALIEN_V2_ON=false;
    $('ctlAlienSelect').value='none';
    showAlien('none'); save();
  }); }
  if (resetDisc){ resetDisc.addEventListener('click', ()=>{
    DISC_ON=false; DISC_SYM=0; DISC_CORNER=0; DISC_STRAIGHT=0; DISC_OUTLINE=0;
    $('ctlDiscSelect').value='none';
    $('secDiscipline').classList.add('hidden');
    refreshEdges(); save();
  }); }
  if (resetTrans){ resetTrans.addEventListener('click', ()=>{
    TRANS_MODE='none'; MOCK_EXAG=0; MOCK_ERASE=0; MOCK_DETAIL=0; CONF_RIGID=0; CONF_SYMBOLS=0; CONF_GHOST=0; CONF_SCOUR=0;
    $('ctlTransSelect').value='none';
    $('ctlMockExag').value=MOCK_EXAG; $('ctlMockErase').value=MOCK_ERASE; $('ctlMockDetail').value=MOCK_DETAIL;
    $('ctlConfRigid').value=CONF_RIGID; $('ctlConfSymbols').value=CONF_SYMBOLS; $('ctlConfGhost').value=CONF_GHOST; $('ctlConfScour').value=CONF_SCOUR;
    showTrans('none'); save();
  }); }

  // Initial render
  applyViewMode();
  if (regionEnabled && regionRect){ drawRegionMask(); applyRegionComposition(); }

  // Ticker
  app.ticker.add(()=>{
    let dx=0,dy=0;
    if (keys.has('a')||keys.has('arrowleft')) dx-=PLAYER_SPEED;
    if (keys.has('d')||keys.has('arrowright')) dx+=PLAYER_SPEED;
    if (keys.has('w')||keys.has('arrowup')) dy-=PLAYER_SPEED;
    if (keys.has('s')||keys.has('arrowdown')) dy+=PLAYER_SPEED;
    if (dx&&dy){ dx*=Math.SQRT1_2; dy*=Math.SQRT1_2; }
    if (dx||dy) tryMove(dx,dy);
    updateCamera();


    // Keep region outline in screen-space following camera
    if (regionOutline && regionRect){
      const sx = regionRect.x + world.x, sy = regionRect.y + world.y;
      regionOutline.position.set(0,0);
      regionOutline.clear();
      regionOutline.beginFill(0x66ccff, 0.08).drawRect(sx, sy, regionRect.w, regionRect.h).endFill();
      regionOutline.lineStyle(2, 0x9bb7ff, 0.95).drawRect(sx, sy, regionRect.w, regionRect.h);
    }

    if (LIGHTING_ON){
      const camX=-world.x, camY=-world.y;
      const sx=player.x-camX, sy=player.y-camY;
      if (brightDisc){ brightDisc.x=sx; brightDisc.y=sy; }
      if (dimDisc){ dimDisc.x=sx; dimDisc.y=sy; }
      if (lightTint){ lightTint.x=sx; lightTint.y=sy; }
    }
  });
}

start().catch(err => console.error(err));
