import { VIEWPORT_WIDTH, VIEWPORT_HEIGHT, STEP_DURATION, WORLD_TILES_X, WORLD_TILES_Y, TILE_SIZE } from './constants.js';
import { initInput, consumeJustPressed, isDown } from './input.js';
import { createWorld } from './world.js';
import { Player } from './player.js';
import { Camera } from './camera.js';

// Boot Pixi application
const app = new PIXI.Application();
await app.init({
  width: VIEWPORT_WIDTH,
  height: VIEWPORT_HEIGHT,
  background: 0x000000,
  antialias: false,
  hello: false,
});
document.body.appendChild(app.canvas);
app.canvas.id = "game";

// World
const world = createWorld();
app.stage.addChild(world);

// Player
const player = new Player();
player.placeAtTile(Math.floor(WORLD_TILES_X/2), Math.floor(WORLD_TILES_Y/2));
world.addChild(player);

// Camera
const camera = new Camera(world);
camera.follow(player);

// Input
initInput();

let lastDir = null;
let nextRepeatAt = 0;

// Game loop
app.ticker.add(() => {
  const now = performance.now();

  // Edge-triggered inputs for instant start + direction memory
  const tileFromPos = (px, py) => {
    return {
      tx: Math.round((px - TILE_SIZE / 2) / TILE_SIZE),
      ty: Math.round((py - TILE_SIZE / 2) / TILE_SIZE),
    };
  };

  for (const action of consumeJustPressed()) {
    if (action === 'up')  { lastDir = 'up';  if (!player.isMoving) { const {tx,ty}=tileFromPos(player.x,player.y); if(!world.isBlockedTile(tx,ty-1)) player.tryMove(0,-1,STEP_DURATION);} }
    if (action === 'down'){ lastDir = 'down'; if (!player.isMoving) { const {tx,ty}=tileFromPos(player.x,player.y); if(!world.isBlockedTile(tx,ty+1)) player.tryMove(0,1,STEP_DURATION);} }
    if (action === 'left'){ lastDir = 'left'; if (!player.isMoving) { const {tx,ty}=tileFromPos(player.x,player.y); if(!world.isBlockedTile(tx-1,ty)) player.tryMove(-1,0,STEP_DURATION);} }
    if (action === 'right'){lastDir = 'right'; if (!player.isMoving) { const {tx,ty}=tileFromPos(player.x,player.y); if(!world.isBlockedTile(tx+1,ty)) player.tryMove(1,0,STEP_DURATION);} }
    nextRepeatAt = now + STEP_DURATION; // schedule the next auto-step
  }

  // Held-key continuous movement (single-axis, respects last pressed for tie-breaks)
  if (!player.isMoving && now >= nextRepeatAt) {
    const up = isDown('up');
    const down = isDown('down');
    const left = isDown('left');
    const right = isDown('right');

    let dir = null;
    // Prefer lastDir if still held; else pick a held direction in a stable priority
    const held = [];
    if (up) held.push('up');
    if (down) held.push('down');
    if (left) held.push('left');
    if (right) held.push('right');

    if (held.length) {
      if (lastDir && held.includes(lastDir)) {
        dir = lastDir;
      } else {
        // default priority: up, right, down, left
        const prio = ['up', 'right', 'down', 'left'];
        dir = prio.find(p => held.includes(p));
      }
    }

    if (dir) {
      if (dir === 'up')    { const {tx,ty}=tileFromPos(player.x,player.y); if(!world.isBlockedTile(tx,ty-1)) player.tryMove(0,-1,STEP_DURATION); }
      if (dir === 'down')  { const {tx,ty}=tileFromPos(player.x,player.y); if(!world.isBlockedTile(tx,ty+1)) player.tryMove(0,1,STEP_DURATION); }
      if (dir === 'left')  { const {tx,ty}=tileFromPos(player.x,player.y); if(!world.isBlockedTile(tx-1,ty)) player.tryMove(-1,0,STEP_DURATION); }
      if (dir === 'right') { const {tx,ty}=tileFromPos(player.x,player.y); if(!world.isBlockedTile(tx+1,ty)) player.tryMove(1,0,STEP_DURATION); }
      nextRepeatAt = now + STEP_DURATION;
    }
  }

  // Update entities and camera
  player.update();
  camera.update();
});
