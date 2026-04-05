import { VIEWPORT_WIDTH, VIEWPORT_HEIGHT, WORLD_WIDTH, WORLD_HEIGHT } from './constants.js';
import { clamp } from './utils.js';

// Camera: positions the world container so the player stays centered, clamped to world bounds.
export class Camera {
  constructor(worldContainer) {
    this.world = worldContainer;
    this.target = null; // DisplayObject with x,y
  }

  follow(displayObject) {
    this.target = displayObject;
  }

  update() {
    if (!this.target) return;

    const targetX = this.target.x;
    const targetY = this.target.y;

    // Desired top-left of world so target is centered in the viewport
    let worldX = -(targetX - VIEWPORT_WIDTH / 2);
    let worldY = -(targetY - VIEWPORT_HEIGHT / 2);

    // Clamp so we don't show beyond world edges
    worldX = clamp(worldX, -(WORLD_WIDTH - VIEWPORT_WIDTH), 0);
    worldY = clamp(worldY, -(WORLD_HEIGHT - VIEWPORT_HEIGHT), 0);

    this.world.x = Math.round(worldX);
    this.world.y = Math.round(worldY);
  }
}
