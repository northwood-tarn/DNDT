import { TILE, VIEW_W, VIEW_H, WORLD_W, WORLD_H, T, ST } from "../game/map.js";

export class Renderer {
  constructor(ctx, tile, vw, vh, textures) {
    this.ctx = ctx;
    this.tile = tile;
    this.vw = vw;
    this.vh = vh;
    this.tex = textures;
  }

  draw(state) {
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, this.vw * TILE, this.vh * TILE);

    // camera
    const ox = -state.cam.x * TILE;
    const oy = -state.cam.y * TILE;
    ctx.translate(ox, oy);

    this.drawGround(ctx);
    this.drawTiles(ctx, state.grid);
    this.drawSpecials(ctx, state);
    this.drawPlants(ctx, state.plants);
    this.drawPlayer(ctx, state.player);
    this.drawWorldPerimeter();

    ctx.restore();
    this.drawViewportTicks();
  }

  drawGround(ctx) {
    ctx.save();
    ctx.fillStyle = this.tex.paving;
    ctx.globalAlpha = 0.45;
    ctx.fillRect(0, 0, WORLD_W * TILE, WORLD_H * TILE);
    ctx.restore();
  }

  drawTiles(ctx, grid) {
    const w = grid[0].length, h = grid.length;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const t = grid[y][x];
      const px = x * TILE, py = y * TILE;
      if (t === T.BUILDING) {
        ctx.save(); ctx.fillStyle = this.tex.roof; ctx.fillRect(px, py, TILE, TILE); ctx.restore();
      } else if (t === T.RAVINE) {
        ctx.save(); ctx.fillStyle = "#000"; ctx.fillRect(px, py, TILE, TILE);
        ctx.globalAlpha = 0.8; ctx.fillStyle = this.tex.ravine; ctx.fillRect(px, py, TILE, TILE); ctx.restore();
      } else if (t === T.BRIDGE) {
        ctx.save(); ctx.fillStyle = this.tex.bridge; ctx.fillRect(px, py, TILE, TILE); ctx.restore();
      } else if (t === T.OBSTACLE) {
        ctx.save(); ctx.fillStyle = this.tex.wall; ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8); ctx.restore();
      }
    }

    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const t = grid[y][x];
      const px = x * TILE, py = y * TILE;
      if (t === T.BUILDING) this.strokeRect(px, py, TILE, TILE, 1.8, 1);
      else if (t === T.OBSTACLE) this.strokeRect(px + 4, py + 4, TILE - 8, TILE - 8, 1.4, 0.9);
      else if (t === T.RAVINE) this.ravineEdges(x, y, grid);
      else if (t === T.BRIDGE) this.bridgeDetail(px, py);
    }
  }

  // ---------- NEW: composite specials layer ----------
  drawSpecials(ctx, state) {
    const specials = state.specials || [];
    for (const s of specials) {
      if (s.type === ST.HOMESTEAD) this.drawHomestead(ctx, s);
    }
  }

  drawHomestead(ctx, r) {
    const x = r.x * TILE, y = r.y * TILE, w = r.w * TILE, h = r.h * TILE;

    // Ground: grass overtaking
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = this.tex.grass;
    ctx.fillRect(x, y, w, h);
    ctx.restore();

    // Ruined roof patches
    const roofPatches = [
      { x: x + TILE, y: y + TILE, w: w * 0.55, h: h * 0.35 },
      { x: x + w * 0.15, y: y + h * 0.45, w: w * 0.5, h: h * 0.35 }
    ];
    for (const p of roofPatches) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(p.x, p.y, p.w, p.h);
      ctx.clip();
      ctx.fillStyle = this.tex.roofBroken;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.restore();

      // outline ragged edges
      this.raggedRect(p.x, p.y, p.w, p.h, 6);
    }

    // Inner courtyard paving remnants
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = this.tex.paving;
    ctx.fillRect(x + TILE, y + TILE, w - TILE * 2, h - TILE * 2);
    ctx.restore();

    // Debris scatter
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = this.tex.debris;
    ctx.fillRect(x, y, w, h);
    ctx.restore();

    // Outer wall heavy strokes (ruined look: double line weight)
    this.strokeRect(x, y, w, h, 2.2, 1);
    this.strokeRect(x + 2, y + 2, w - 4, h - 4, 1.5, 0.9);

    // A couple of broken interior walls
    this.brokenWall(x + TILE * 2, y + TILE * 2, x + TILE * 5.5, y + TILE * 2);
    this.brokenWall(x + TILE * 2, y + TILE * 2, x + TILE * 2, y + TILE * 5.5);
  }

  brokenWall(x1, y1, x2, y2) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 1.6;
    const segments = 8;
    for (let i = 0; i < segments; i++) {
      if (i % 3 === 1) continue; // make gaps
      const t0 = i / segments, t1 = (i + 0.7) / segments;
      const sx = x1 + (x2 - x1) * t0;
      const sy = y1 + (y2 - y1) * t0;
      const ex = x1 + (x2 - x1) * t1;
      const ey = y1 + (y2 - y1) * t1;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }
    ctx.restore();
  }

  raggedRect(x, y, w, h, tooth = 6) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 1.2;

    const zig = (sx, sy, ex, ey, horiz) => {
      const steps = Math.max(2, Math.floor((horiz ? w : h) / tooth));
      for (let i = 0; i < steps; i++) {
        const t0 = i / steps;
        const t1 = (i + 1) / steps;
        const ax = sx + (ex - sx) * t0;
        const ay = sy + (ey - sy) * t0;
        const bx = sx + (ex - sx) * t1;
        const by = sy + (ey - sy) * t1;
        const j = (i % 2 === 0 ? 1 : -1) * 2;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo((ax + bx) / 2 + (horiz ? 0 : j), (ay + by) / 2 + (horiz ? j : 0));
        ctx.lineTo(bx, by);
        ctx.stroke();
      }
    };

    zig(x, y, x + w, y, true);
    zig(x + w, y, x + w, y + h, false);
    zig(x + w, y + h, x, y + h, true);
    zig(x, y + h, x, y, false);

    ctx.restore();
  }

  strokeRect(x, y, w, h, lw = 1, alpha = 1) {
    const ctx = this.ctx;
    ctx.save();
    ctx.lineWidth = lw;
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.restore();
  }

  ravineEdges(tx, ty, grid) {
    const ctx = this.ctx;
    const x = tx * TILE, y = ty * TILE;
    const isNonRavine = (t) => t !== T.RAVINE;
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 1.6;
    const neighbors = [{dx:0,dy:-1},{dx:1,dy:0},{dx:0,dy:1},{dx:-1,dy:0}];
    for (const n of neighbors) {
      const nx = tx + n.dx, ny = ty + n.dy;
      if (ny >= 0 && ny < grid.length && nx >= 0 && nx < grid[0].length && isNonRavine(grid[ny][nx])) {
        if (n.dx === 0 && n.dy === -1)      this.edge(x, y, x + TILE, y);
        else if (n.dx === 1 && n.dy === 0)  this.edge(x + TILE, y, x + TILE, y + TILE);
        else if (n.dx === 0 && n.dy === 1)  this.edge(x, y + TILE, x + TILE, y + TILE);
        else if (n.dx === -1 && n.dy === 0) this.edge(x, y, x, y + TILE);
      }
    }
    const grad = ctx.createLinearGradient(x, y, x + TILE, y + TILE);
    grad.addColorStop(0, "rgba(0,0,0,0.0)");
    grad.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.restore();
  }

  edge(x1, y1, x2, y2) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x1 + 0.5, y1 + 0.5);
    ctx.lineTo(x2 + 0.5, y2 + 0.5);
    ctx.stroke();
  }

  bridgeDetail(x, y) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 6); ctx.lineTo(x + TILE - 4, y + 6);
    ctx.moveTo(x + 4, y + TILE - 6); ctx.lineTo(x + TILE - 4, y + TILE - 6);
    ctx.stroke();
    ctx.restore();
  }

  drawPlants(ctx, plants) {
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 1;
    for (const p of plants) {
      const px = p.x * TILE + p.ox;
      const py = p.y * TILE + p.oy;
      ctx.beginPath(); ctx.arc(px, py, p.r, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.moveTo(px - p.r, py); ctx.quadraticCurveTo(px, py - p.r*0.7, px + p.r, py); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px - p.r*0.8, py + 2); ctx.quadraticCurveTo(px, py + p.r*0.7, px + p.r*0.8, py + 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  drawPlayer(ctx, player) {
    const x = player.x * TILE + TILE / 2;
    const y = player.y * TILE + TILE / 2;
    ctx.save();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, TILE * 0.32, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#fff";
    const r = TILE * 0.22;
    const tri = this.directionTriangle(player.facing, x, y, r);
    ctx.beginPath(); ctx.moveTo(tri[0].x, tri[0].y);
    ctx.lineTo(tri[1].x, tri[1].y);
    ctx.lineTo(tri[2].x, tri[2].y);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  directionTriangle(dir, x, y, r) {
    if (dir === "N") return [{ x: x, y: y - r }, { x: x - r*0.8, y: y + r*0.7 }, { x: x + r*0.8, y: y + r*0.7 }];
    if (dir === "S") return [{ x: x, y: y + r }, { x: x - r*0.8, y: y - r*0.7 }, { x: x + r*0.8, y: y - r*0.7 }];
    if (dir === "W") return [{ x: x - r, y: y }, { x: x + r*0.7, y: y - r*0.8 }, { x: x + r*0.7, y: y + r*0.8 }];
    return [{ x: x + r, y: y }, { x: x - r*0.7, y: y - r*0.8 }, { x: x - r*0.7, y: y + r*0.8 }];
  }

  drawWorldPerimeter() {
    const ctx = this.ctx;
    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.strokeRect(0.5, 0.5, WORLD_W * TILE - 1, WORLD_H * TILE - 1);
    ctx.restore();
  }

  drawViewportTicks() {
    const ctx = this.ctx;
    const w = VIEW_W * TILE, h = VIEW_H * TILE;
    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 1;
    const t = 8;
    ctx.beginPath();
    ctx.moveTo(0.5, 0.5 + t); ctx.lineTo(0.5, 0.5); ctx.lineTo(0.5 + t, 0.5);
    ctx.moveTo(w - 0.5 - t, 0.5); ctx.lineTo(w - 0.5, 0.5); ctx.lineTo(w - 0.5, 0.5 + t);
    ctx.moveTo(w - 0.5, h - 0.5 - t); ctx.lineTo(w - 0.5, h - 0.5); ctx.lineTo(w - 0.5 - t, h - 0.5);
    ctx.moveTo(0.5 + t, h - 0.5); ctx.lineTo(0.5, h - 0.5); ctx.lineTo(0.5, h - 0.5 - t);
    ctx.stroke();
    ctx.restore();
  }
}