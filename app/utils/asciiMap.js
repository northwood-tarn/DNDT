// utils/asciiMap.js
// Simple bordered ASCII map with '.' for empty and 'P' for player.
import { state } from '../state/stateStore.js';

export const MAP_W = 20;
export const MAP_H = 10;

export function clampPlayer() {
  const p = state.player;
  if (!p) return;
  p.x = Math.max(0, Math.min(MAP_W - 1, p.x));
  p.y = Math.max(0, Math.min(MAP_H - 1, p.y));
}

export function renderAsciiMap() {
  const p = state.player || { x: 0, y: 0 };
  clampPlayer();

  const top = "┌" + "─" * MAP_W + "┐";
  const bot = "└" + "─" * MAP_W + "┘";

  let rows = [top];
  for (let y = 0; y < MAP_H; y++) {
    let line = "│";
    for (let x = 0; x < MAP_W; x++) {
      line += (x === p.x && y === p.y) ? "P" : ".";
    }
    line += "│";
    rows.push(line);
  }
  rows.push(bot);
  return rows.join("\n");
}
