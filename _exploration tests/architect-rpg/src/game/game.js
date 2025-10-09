import { WORLD_W, WORLD_H, VIEW_W, VIEW_H, T } from "./map.js";

export class Game {
  constructor(map) {
    this.map = map;
    this.player = { x: 3, y: 3, facing: "S" };
    this.cam = { x: 0, y: 0 };
    this.moveCooldown = 0;
    this.updateCamera();
  }

  isBlocked(x, y) {
    if (x < 0 || y < 0 || x >= WORLD_W || y >= WORLD_H) return true; // world bounds only
    const t = this.map.grid[y][x];
    return t === T.BUILDING || t === T.RAVINE || t === T.OBSTACLE;
  }

  tryStep(dx, dy) {
    if (dx !== 0 && dy !== 0) dy = 0;
    if (dx < 0) this.player.facing = "W";
    else if (dx > 0) this.player.facing = "E";
    else if (dy < 0) this.player.facing = "N";
    else if (dy > 0) this.player.facing = "S";

    if (this.moveCooldown > 0) return;

    const nx = this.player.x + dx;
    const ny = this.player.y + dy;

    const tile = this.map.grid?.[ny]?.[nx];
    const canStep = tile === T.BRIDGE || !this.isBlocked(nx, ny);
    if (canStep) {
      this.player.x = nx;
      this.player.y = ny;
      this.updateCamera();
      this.moveCooldown = 0.07;
    }
  }

  update(dt) {
    if (this.moveCooldown > 0) this.moveCooldown = Math.max(0, this.moveCooldown - dt);
  }

  updateCamera() {
    this.cam.x = clamp(this.player.x - Math.floor(VIEW_W / 2), 0, WORLD_W - VIEW_W);
    this.cam.y = clamp(this.player.y - Math.floor(VIEW_H / 2), 0, WORLD_H - VIEW_H);
  }

  state() {
    return { grid: this.map.grid, plants: this.map.plants, player: this.player, cam: this.cam };
  }
}
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }