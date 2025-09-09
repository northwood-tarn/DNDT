import { TILE_SIZE, COLOR_FG, WORLD_WIDTH, WORLD_HEIGHT } from './constants.js';

export class Player extends PIXI.Container {
  constructor() {
    super();
    this.speed = TILE_SIZE; // tile step distance
    this.isMoving = false;
    this.targetX = 0;
    this.targetY = 0;

    // Simple white diamond icon
    const g = new PIXI.Graphics();
    const s = Math.floor(TILE_SIZE * 0.35);
    g.fill({ color: COLOR_FG });
    g.moveTo(0, -s).lineTo(s, 0).lineTo(0, s).lineTo(-s, 0).lineTo(0, -s).endFill();
    this.addChild(g);
  }

  placeAtTile(tx, ty) {
    this.x = tx * TILE_SIZE + TILE_SIZE / 2;
    this.y = ty * TILE_SIZE + TILE_SIZE / 2;
    this.targetX = this.x;
    this.targetY = this.y;
    this.isMoving = false;
  }

  tryMove(dxTiles, dyTiles, durationMs, onStart) {
    if (this.isMoving) return;
    const destX = this.x + dxTiles * TILE_SIZE;
    const destY = this.y + dyTiles * TILE_SIZE;

    // Keep inside world (leave a 2px padding to avoid crossing the stroke)
    const minX = TILE_SIZE / 2 + 2;
    const minY = TILE_SIZE / 2 + 2;
    const maxX = WORLD_WIDTH - TILE_SIZE / 2 - 2;
    const maxY = WORLD_HEIGHT - TILE_SIZE / 2 - 2;

    const clampedX = Math.min(Math.max(destX, minX), maxX);
    const clampedY = Math.min(Math.max(destY, minY), maxY);

    // If clamped equals current, don't move
    if (clampedX === this.x && clampedY === this.y) return;

    this.isMoving = true;
    this.targetX = clampedX;
    this.targetY = clampedY;
    this.moveStartTime = performance.now();
    this.moveDuration = durationMs;
    this.startX = this.x;
    this.startY = this.y;
    if (onStart) onStart();
  }

  update() {
    if (!this.isMoving) return;
    const t = (performance.now() - this.moveStartTime) / this.moveDuration;
    if (t >= 1) {
      this.x = this.targetX;
      this.y = this.targetY;
      this.isMoving = false;
      return;
    }
    const k = easeOutQuad(t);
    this.x = this.startX + (this.targetX - this.startX) * k;
    this.y = this.startY + (this.targetY - this.startY) * k;
  }
}

function easeOutQuad(t) {
  return 1 - (1 - t) * (1 - t);
}
