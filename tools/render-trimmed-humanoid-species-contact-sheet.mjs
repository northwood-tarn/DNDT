#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import {
  alphaBounds,
  composite,
  createCanvas,
  readPng,
  resizeNearest,
  setPixel,
  writePng,
} from "./pc-mini-png.js";

const ROOT = path.resolve("app/mini_preview/assets/pc_builder_production/body_head/review/trimmed_pool");
const SOURCE_ROOT = path.resolve("app/mini_preview/assets/pc_builder_production/body_head/review/weapon_fit_gallery");
const OUT = path.join(ROOT, "humanoid_trimmed_pool_species_contact_sheet.png");
const META = path.join(ROOT, "humanoid_trimmed_pool_species_contact_sheet.json");

const SOURCES = {
  p1Fighter: path.join(SOURCE_ROOT, "human_masculine_posture1_fighter_weapons_v2.png"),
  p2Fighter: path.join(SOURCE_ROOT, "human_masculine_posture2_fighter_weapons_v3.png"),
  p3Fighter: path.join(SOURCE_ROOT, "human_masculine_posture3_fighter_weapons_v2.png"),
  rogue: path.join(SOURCE_ROOT, "human_feminine_all_postures_rogue_weapons_v1.png"),
};

const CANDIDATES = [
  { id: "balanced_sword", label: "BALANCED\nSWORD", source: "p1Fighter", cols: 4, rows: 1, col: 0, row: 0 },
  { id: "balanced_round_shield", label: "BALANCED\nROUND SHIELD", source: "p1Fighter", cols: 4, rows: 1, col: 1, row: 0 },
  { id: "aggressive_sword", label: "AGGRESSIVE\nSWORD", source: "p2Fighter", cols: 4, rows: 1, col: 0, row: 0 },
  { id: "aggressive_square_shield", label: "AGGRESSIVE\nSQUARE SHIELD", source: "p2Fighter", cols: 4, rows: 1, col: 1, row: 0 },
  { id: "defensive_square_shield", label: "DEFENSIVE\nSQUARE SHIELD", source: "p3Fighter", cols: 4, rows: 1, col: 1, row: 0 },
  { id: "defensive_spear", label: "DEFENSIVE\nSPEAR", source: "p3Fighter", cols: 4, rows: 1, col: 3, row: 0 },
  { id: "single_dagger", label: "SINGLE\nDAGGER", source: "rogue", cols: 4, rows: 3, col: 0, row: 0 },
  { id: "dual_daggers", label: "DUAL\nDAGGERS", source: "rogue", cols: 4, rows: 3, col: 1, row: 0 },
  { id: "crossbow", label: "CROSSBOW", source: "rogue", cols: 4, rows: 3, col: 2, row: 0 },
  { id: "aggressive_unarmed", label: "AGGRESSIVE\nUNARMED", source: "rogue", cols: 4, rows: 3, col: 0, row: 2 },
];

const SPECIES = [
  { id: "human", label: "HUMAN", scale: 1, tint: null, opacity: 0 },
  { id: "aasimar", label: "AASIMAR", scale: 1, tint: [228, 232, 226], opacity: 0.16 },
  { id: "elf", label: "ELF", scale: 1.04, tint: [196, 214, 196], opacity: 0.1 },
  { id: "dwarf", label: "DWARF", scale: 0.8, tint: [190, 174, 150], opacity: 0.09 },
  { id: "gnome", label: "GNOME", scale: 0.58, tint: [184, 184, 205], opacity: 0.1 },
  { id: "halfling", label: "HALFLING", scale: 0.58, tint: [196, 178, 142], opacity: 0.1 },
  { id: "dragonborn", label: "DRAGONBORN", scale: 1.06, tint: [80, 118, 84], opacity: 0.26 },
  { id: "goliath", label: "GOLIATH", scale: 1.18, tint: [176, 174, 170], opacity: 0.12 },
  { id: "tiefling", label: "TIEFLING", scale: 1, tint: [128, 70, 128], opacity: 0.22 },
];

const STYLE = {
  bg: [17, 21, 20, 255],
  panel: [25, 29, 28, 255],
  panelAlt: [30, 34, 33, 255],
  stroke: [64, 70, 66, 255],
  text: [222, 216, 190, 255],
  subText: [154, 151, 130, 255],
};

const CELL = { width: 150, height: 178 };
const LEFT = 126;
const TOP = 86;
const WIDTH = LEFT + CANDIDATES.length * CELL.width + 18;
const HEIGHT = TOP + SPECIES.length * CELL.height + 18;

fs.mkdirSync(ROOT, { recursive: true });

const sourceImages = Object.fromEntries(Object.entries(SOURCES).map(([id, file]) => [id, readPng(file)]));
const candidateImages = CANDIDATES.map((candidate) => ({
  ...candidate,
  image: extractCandidate(sourceImages[candidate.source], candidate),
}));

const sheet = createCanvas(WIDTH, HEIGHT);
fillRect(sheet, 0, 0, WIDTH, HEIGHT, STYLE.bg);
drawText(sheet, "TRIMMED HUMANOID ARMED POOL - SPECIES SCALE/TINT REVIEW", 18, 18, 2, STYLE.text);
drawText(sheet, "PROXY ONLY: GENDER HELD CONSTANT; SPECIES-SPECIFIC BODY/HEAD ART NOT FINAL", 18, 48, 1, STYLE.subText);

for (let c = 0; c < CANDIDATES.length; c += 1) {
  const x = LEFT + c * CELL.width;
  drawTextBlock(sheet, CANDIDATES[c].label, x + 8, 64, 1, STYLE.text, 11);
}

for (let r = 0; r < SPECIES.length; r += 1) {
  const species = SPECIES[r];
  const y = TOP + r * CELL.height;
  fillRect(sheet, 12, y, LEFT - 18, CELL.height - 8, r % 2 ? STYLE.panelAlt : STYLE.panel);
  strokeRect(sheet, 12, y, LEFT - 18, CELL.height - 8, STYLE.stroke);
  drawText(sheet, species.label, 24, y + 18, 1, STYLE.text);
  drawText(sheet, `SCALE ${species.scale.toFixed(2)}`, 24, y + 38, 1, STYLE.subText);

  for (let c = 0; c < candidateImages.length; c += 1) {
    const x = LEFT + c * CELL.width;
    fillRect(sheet, x, y, CELL.width - 8, CELL.height - 8, r % 2 ? STYLE.panelAlt : STYLE.panel);
    strokeRect(sheet, x, y, CELL.width - 8, CELL.height - 8, STYLE.stroke);
    drawCandidate(sheet, candidateImages[c].image, species, x, y);
  }
}

writePng(OUT, sheet);

fs.writeFileSync(META, `${JSON.stringify({
  status: "review_contact_sheet",
  productionArt: false,
  output: path.relative(process.cwd(), OUT),
  note: "Species variants are proxy scale/tint reviews only. Gender is intentionally held aside.",
  candidates: CANDIDATES.map(({ image, ...candidate }) => candidate),
  species: SPECIES,
}, null, 2)}\n`);

console.log(`[trimmed-pool] wrote ${path.relative(process.cwd(), OUT)}`);
console.log(`[trimmed-pool] wrote ${path.relative(process.cwd(), META)}`);

function extractCandidate(sheetImage, candidate) {
  const cellWidth = Math.floor(sheetImage.width / candidate.cols);
  const cellHeight = Math.floor(sheetImage.height / candidate.rows);
  const x = candidate.col * cellWidth;
  const y = candidate.row * cellHeight;
  const cell = crop(sheetImage, x, y, cellWidth, cellHeight);
  const keyed = chromaKeyGreen(cell);
  const bounds = alphaBounds(keyed);
  const pad = 18;
  return crop(
    keyed,
    Math.max(0, bounds.left - pad),
    Math.max(0, bounds.top - pad),
    Math.min(keyed.width, bounds.width + pad * 2),
    Math.min(keyed.height, bounds.height + pad * 2),
  );
}

function drawCandidate(dst, source, species, cellX, cellY) {
  const maxW = CELL.width - 30;
  const maxH = CELL.height - 32;
  const baseScale = Math.min(maxW / source.width, maxH / source.height);
  const scale = Math.min(baseScale * species.scale, maxW / source.width, maxH / source.height);
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const resized = applyTint(resizeNearest(source, width, height), species.tint, species.opacity);
  const x = Math.round(cellX + (CELL.width - 8 - width) / 2);
  const y = Math.round(cellY + CELL.height - 18 - height);
  composite(dst, resized, x, y);
}

function chromaKeyGreen(src) {
  const dst = createCanvas(src.width, src.height);
  dst.data.set(src.data);
  for (let i = 0; i < dst.data.length; i += 4) {
    const r = dst.data[i];
    const g = dst.data[i + 1];
    const b = dst.data[i + 2];
    const greenDominant = g > 105 && g > r * 1.18 && g > b * 1.18;
    const saturatedGreen = g > 145 && r < 120 && b < 140;
    if (greenDominant || saturatedGreen) dst.data[i + 3] = 0;
  }
  return dst;
}

function applyTint(src, tint, opacity) {
  if (!tint || opacity <= 0) return src;
  const dst = createCanvas(src.width, src.height);
  dst.data.set(src.data);
  for (let i = 0; i < dst.data.length; i += 4) {
    if (dst.data[i + 3] <= 0) continue;
    dst.data[i] = Math.round(dst.data[i] * (1 - opacity) + tint[0] * opacity);
    dst.data[i + 1] = Math.round(dst.data[i + 1] * (1 - opacity) + tint[1] * opacity);
    dst.data[i + 2] = Math.round(dst.data[i + 2] * (1 - opacity) + tint[2] * opacity);
  }
  return dst;
}

function crop(src, x, y, width, height) {
  const dst = createCanvas(width, height);
  for (let yy = 0; yy < height; yy += 1) {
    for (let xx = 0; xx < width; xx += 1) {
      const sx = x + xx;
      const sy = y + yy;
      if (sx < 0 || sy < 0 || sx >= src.width || sy >= src.height) continue;
      const si = (sy * src.width + sx) * 4;
      const di = (yy * width + xx) * 4;
      dst.data[di] = src.data[si];
      dst.data[di + 1] = src.data[si + 1];
      dst.data[di + 2] = src.data[si + 2];
      dst.data[di + 3] = src.data[si + 3];
    }
  }
  return dst;
}

function fillRect(canvas, x, y, width, height, color) {
  for (let yy = y; yy < y + height; yy += 1) {
    for (let xx = x; xx < x + width; xx += 1) setPixel(canvas, xx, yy, color);
  }
}

function strokeRect(canvas, x, y, width, height, color) {
  for (let xx = x; xx < x + width; xx += 1) {
    setPixel(canvas, xx, y, color);
    setPixel(canvas, xx, y + height - 1, color);
  }
  for (let yy = y; yy < y + height; yy += 1) {
    setPixel(canvas, x, yy, color);
    setPixel(canvas, x + width - 1, yy, color);
  }
}

function drawTextBlock(canvas, text, x, y, scale, color, lineHeight = 9) {
  const lines = text.split("\n");
  lines.forEach((line, index) => drawText(canvas, line, x, y + index * lineHeight * scale, scale, color));
}

function drawText(canvas, text, x, y, scale, color) {
  let cursor = x;
  for (const raw of text.toUpperCase()) {
    if (raw === " ") {
      cursor += 4 * scale;
      continue;
    }
    const glyph = FONT[raw] || FONT["?"];
    for (let gy = 0; gy < glyph.length; gy += 1) {
      for (let gx = 0; gx < glyph[gy].length; gx += 1) {
        if (glyph[gy][gx] !== "1") continue;
        fillRect(canvas, cursor + gx * scale, y + gy * scale, scale, scale, color);
      }
    }
    cursor += 6 * scale;
  }
}

const FONT = {
  "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  "B": ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  "C": ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  "D": ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  "E": ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  "F": ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  "G": ["01111", "10000", "10000", "10011", "10001", "10001", "01111"],
  "H": ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  "I": ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  "J": ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  "K": ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  "L": ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  "M": ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  "N": ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  "O": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  "P": ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  "Q": ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  "R": ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  "S": ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  "T": ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  "U": ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  "V": ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  "W": ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  "X": ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  "Y": ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  "Z": ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  "?": ["01110", "10001", "00001", "00010", "00100", "00000", "00100"],
};
