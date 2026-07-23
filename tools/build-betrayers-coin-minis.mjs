#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { alphaBounds, composite, createCanvas, readPng, writePng } from "./pc-mini-png.js";

const LIBRARY = path.resolve("app/mini_preview/assets/pc_authored_library");
const BASE_PATH = path.resolve("app/mini_preview/assets/base_combinations/betrayers_coin.png");
const BASE_WIDTH = 115;
const BASE_ANCHOR = { x: 96, y: 106 };
const RUNTIME_ANCHOR = { x: 96, y: 280 };
const CONTACT_Y = 258;
const FIGURE_HEIGHTS = {
  aasimar: 190,
  dragonborn: 168,
  dwarf: 150,
  elf: 178,
  gnome: 124,
  goliath: 202,
  halfling: 124,
  human: 190,
  orc: 200,
  tiefling: 190,
  cloaked: 190,
};
const FIGURE_HEIGHTS_BY_ID = {
  aasimar_masculine_01: 182,
  orc_masculine_01: 194,
  tiefling_masculine_01: 184,
};
const FIGURE_SCALE_BY_SPECIES = {
  elf: 0.9,
  cloaked: 0.9,
};
const FIGURE_X_OFFSET_BY_ID = {
  aasimar_feminine_01: -3,
  aasimar_masculine_01: -8,
  dragonborn_feminine_01: -12,
  dragonborn_masculine_01: -12,
  dwarf_masculine_01: -1,
  elf_feminine_01: 1,
  human_masculine_01: -2,
  goliath_feminine_01: -4,
  goliath_masculine_01: -4,
  orc_feminine_01: -1,
  orc_masculine_01: -1,
  tiefling_feminine_01: -7,
  tiefling_masculine_01: -9,
  cloaked_protagonist_01: -6,
};

const ids = fs.readdirSync(LIBRARY)
  .filter((id) => /_(feminine|masculine)_01$/.test(id) || id === "cloaked_protagonist_01")
  .filter((id) => fs.existsSync(path.join(LIBRARY, id, "cutout", `${id}.png`)))
  .sort();

const base = readPng(BASE_PATH);
const baseScale = BASE_WIDTH / base.width;
const runtimeBase = resizeBilinear(base, BASE_WIDTH, Math.round(base.height * baseScale));
const baseX = Math.round(RUNTIME_ANCHOR.x - BASE_ANCHOR.x * baseScale);
const baseY = Math.round(RUNTIME_ANCHOR.y - BASE_ANCHOR.y * baseScale);

for (const id of ids) {
  const species = id.split("_")[0];
  const sourcePath = path.join(LIBRARY, id, "cutout", `${id}.png`);
  const source = readPng(sourcePath);
  const bounds = alphaBounds(source);
  const cropped = crop(source, bounds.left, bounds.top, bounds.width, bounds.height);
  const authoredHeight = FIGURE_HEIGHTS_BY_ID[id] || FIGURE_HEIGHTS[species] || FIGURE_HEIGHTS.human;
  const targetHeight = Math.round(authoredHeight * (FIGURE_SCALE_BY_SPECIES[species] || 1));
  const targetWidth = Math.max(1, Math.round(cropped.width * targetHeight / cropped.height));
  const figure = resizeBilinear(cropped, targetWidth, targetHeight);
  const canvas = createCanvas(192, 320);
  composite(canvas, runtimeBase, baseX, baseY);
  const figureX = Math.round(RUNTIME_ANCHOR.x - targetWidth / 2) + (FIGURE_X_OFFSET_BY_ID[id] || 0);
  composite(canvas, figure, figureX, CONTACT_Y - targetHeight);
  const runtimeDir = path.join(LIBRARY, id, "runtime");
  fs.mkdirSync(runtimeDir, { recursive: true });
  const output = path.join(runtimeDir, `${id}_betrayers_coin_192x320.png`);
  writePng(output, canvas);
  console.log(path.relative(process.cwd(), output));
}

function crop(source, x, y, width, height) {
  const output = createCanvas(width, height);
  for (let yy = 0; yy < height; yy += 1) {
    for (let xx = 0; xx < width; xx += 1) {
      const sourceIndex = ((y + yy) * source.width + x + xx) * 4;
      const outputIndex = (yy * width + xx) * 4;
      output.data[outputIndex] = source.data[sourceIndex];
      output.data[outputIndex + 1] = source.data[sourceIndex + 1];
      output.data[outputIndex + 2] = source.data[sourceIndex + 2];
      output.data[outputIndex + 3] = source.data[sourceIndex + 3];
    }
  }
  return output;
}

function resizeBilinear(source, width, height) {
  const output = createCanvas(width, height);
  const xRatio = source.width / width;
  const yRatio = source.height / height;
  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.max(0, Math.min(source.height - 1, (y + 0.5) * yRatio - 0.5));
    const y0 = Math.floor(sourceY);
    const y1 = Math.min(source.height - 1, y0 + 1);
    const fy = sourceY - y0;
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.max(0, Math.min(source.width - 1, (x + 0.5) * xRatio - 0.5));
      const x0 = Math.floor(sourceX);
      const x1 = Math.min(source.width - 1, x0 + 1);
      const fx = sourceX - x0;
      const outputIndex = (y * width + x) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        const top = pixel(source, x0, y0, channel) * (1 - fx) + pixel(source, x1, y0, channel) * fx;
        const bottom = pixel(source, x0, y1, channel) * (1 - fx) + pixel(source, x1, y1, channel) * fx;
        output.data[outputIndex + channel] = Math.round(top * (1 - fy) + bottom * fy);
      }
    }
  }
  return output;
}

function pixel(source, x, y, channel) {
  return source.data[(y * source.width + x) * 4 + channel];
}
