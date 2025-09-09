// app/renderer/spriteMapRenderer.js
// Minimal sprite renderer for an 8x8 tileset with scaling.
// Renders to a <canvas> appended to shell.center when available.

import { shell, mountCenter, SetProfileExplorationMap } from "./shellMount.js";

export class SpriteRenderer {
  constructor(opts = {}) {
    this.tileSize = opts.tileSize ?? 8;     // logical tiles are 8x8
    this.scale = opts.scale ?? 4;           // visual scale multiplier
    this.viewWidth = opts.viewWidth ?? 40;  // tiles
    this.viewHeight = opts.viewHeight ?? 40;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.canvas.width = this.viewWidth * this.tileSize * this.scale;
    this.canvas.height = this.viewHeight * this.tileSize * this.scale;
    this.canvas.style.imageRendering = 'pixelated';
    this.canvas.style.width = `${this.canvas.width}px`;
    this.canvas.style.height = `${this.canvas.height}px`;

    // Try to mount to the center pane if present
    try {
      SetProfileExplorationMap?.({ title: 'Exploration (Sprite)' });
      mountCenter?.(this.canvas);
    } catch {}
    if (!this.canvas.parentNode) {
      document.body.appendChild(this.canvas);
    }

    // optional tileset & spritesheet images (8x8 grids)
    this.tileset = null;
    this.spritesheet = null;
  }

  async loadImages({ tilesetUrl = null, spritesUrl = null } = {}) {
    const load = (url) => new Promise((resolve, reject) => {
      if (!url) return resolve(null);
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null); // resolve null for graceful fallback
      img.src = url;
    });
    this.tileset = await load(tilesetUrl);
    this.spritesheet = await load(spritesUrl);
  }

  // Draw a single 8x8 sprite from a sheet at (sx, sy) tile coordinates
  drawSprite(img, sx, sy, dx, dy) {
    const t = this.tileSize;
    const s = this.scale;
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, sx*t, sy*t, t, t, dx*t*s, dy*t*s, t*s, t*s);
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  // world: { width, height, tiles: Uint8Array or number[][], SOLID=Set<string> }, 0=floor,1=wall
  render(world, player) {
    const t = this.tileSize;
    const s = this.scale;
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    this.clear();

    // Background tiles
    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        const idx = y * world.width + x;
        const tile = Array.isArray(world.tiles) ? world.tiles[y][x] : world.tiles[idx];
        // 0 floor, 1 wall
        if (this.tileset) {
          const tsx = tile === 1 ? 1 : 0; // choose different tile columns if desired
          const tsy = 0;
          this.drawSprite(this.tileset, tsx, tsy, x, y);
        } else {
          // fallback block colors
          ctx.fillStyle = (tile === 1) ? '#2b2f3a' : '#8893a8';
          ctx.fillRect(x*t*s, y*t*s, t*s, t*s);
          if (tile === 1) {
            ctx.fillStyle = '#0f1116';
            ctx.fillRect(x*t*s+1, y*t*s+1, t*s-2, t*s-2);
          }
        }
      }
    }

    // Player sprite
    if (player) {
      if (this.spritesheet) {
        // assume player sprite at (0,0) in provided sheet
        this.drawSprite(this.spritesheet, 0, 0, player.x, player.y);
      } else {
        // fallback: draw a simple disk
        ctx.beginPath();
        ctx.arc((player.x+0.5)*t*s, (player.y+0.5)*t*s, (t*s*0.35), 0, Math.PI*2);
        ctx.fillStyle = '#ffd54a';
        ctx.fill();
        ctx.lineWidth = Math.max(1, Math.floor(t*s*0.08));
        ctx.strokeStyle = '#242424';
        ctx.stroke();
      }
    }
  }
}