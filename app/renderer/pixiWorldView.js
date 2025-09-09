// app/renderer/pixiWorldView.js
import * as PIXI from '../lib/pixi.mjs';
import { loadTMJ } from '../loaders/pixiMapAdapter.js';
import { blockMove } from '../systems/collisionPoly.js';

export function createWorldView(opts={}){
  const VIEW_W = opts.width  ?? 608;
  const VIEW_H = opts.height ?? 592;
  const PLAYER_SIZE = 64;                 // world pixels (sprite size)
  const STEP_PIXELS = 32;                 // grid size per step
  const STEP_TIME = 1/6;                  // seconds per step (6 steps/sec)
  const designScreensHigh = opts.designScreensHigh ?? 2.2;

  let app=null, world=null, bg=null, bgTex=null, SCALE=1;
  let player=null, polys=[], WORLD={w:0,h:0};

  // step state
  let cooldown = 0;        // time remaining before next step is allowed

  async function loadFromTMJ(url){
    const info = await loadTMJ(url, { designScreensHigh, viewH: VIEW_H });
    SCALE = info.world.scale;
    WORLD = { w: info.world.w, h: info.world.h };

    bgTex = await PIXI.Assets.load(info.imageURL);
    bg = new PIXI.Sprite(bgTex);
    bg.anchor.set(0);
    bg.scale.set(SCALE);
    world.addChild(bg);

    // Player sprite (textured). Expect asset at /app/assets/pc_nobody.png
    const tex = await PIXI.Assets.load('/app/assets/pc_nobody.png');
    player = new PIXI.Sprite(tex);
    player.anchor.set(0.5);
    // Force exact world size regardless of source pixels
    player.width = PLAYER_SIZE;
    player.height = PLAYER_SIZE;
    player.x = info.spawn.x || VIEW_W/2;
    player.y = info.spawn.y || VIEW_H/2;
    world.addChild(player);

    polys = info.polys || [];
  }

  async function mount(node){
    app = new PIXI.Application();
    await app.init({ width: VIEW_W, height: VIEW_H, background: 0xf6f7f8, backgroundAlpha: 1 });
    node.appendChild(app.canvas);
    world = new PIXI.Container();
    app.stage.addChild(world);

    // Input
    const down=new Set();
    window.addEventListener('keydown', e=>{
      const k=e.key.toLowerCase();
      if(['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright'].includes(k)) e.preventDefault();
      down.add(k);
    }, {passive:false});
    window.addEventListener('keyup', e=>down.delete(e.key.toLowerCase()), {passive:true});

    app.ticker.add((ticker)=>{
      if (!player) return;
      const dt = ticker.deltaMS/1000;
      if (cooldown > 0) cooldown -= dt;

      // Discrete stepping: on key press/hold, advance exactly one grid cell when cooldown <= 0
      if (cooldown <= 0){
        let dx=0, dy=0;
        if (down.has('w')||down.has('arrowup')) dy = -1;
        else if (down.has('s')||down.has('arrowdown')) dy = 1;
        else if (down.has('a')||down.has('arrowleft')) dx = -1;
        else if (down.has('d')||down.has('arrowright')) dx = 1;

        if (dx!==0 || dy!==0){
          const nx = clamp(player.x + dx*STEP_PIXELS, PLAYER_SIZE/2, WORLD.w-PLAYER_SIZE/2);
          const ny = clamp(player.y + dy*STEP_PIXELS, PLAYER_SIZE/2, WORLD.h-PLAYER_SIZE/2);
          const res = blockMove(nx, ny, polys);
          if (!res.blocked){
            player.x = res.x;
            player.y = res.y;
            cooldown = STEP_TIME; // lock for next step
          } else {
            // even when blocked, set a small cooldown to avoid spam
            cooldown = STEP_TIME * 0.5;
          }
        }
      }

      // Camera follow
      const cx=Math.max(0,Math.min(WORLD.w-VIEW_W,player.x-VIEW_W/2));
      const cy=Math.max(0,Math.min(WORLD.h-VIEW_H,player.y-VIEW_H/2));
      world.x=-cx; world.y=-cy;
    });
  }

  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
  function getWorld(){ return world; }
  function getStage(){ return app?.stage; }
  function getPlayer(){ return player; }
  function getScale(){ return SCALE; }
  function destroy(){ try{ app.destroy(true,{children:true}); }catch{} }

  return { mount, loadFromTMJ, getWorld, getStage, getPlayer, getScale, VIEW_W, VIEW_H, destroy };
}
