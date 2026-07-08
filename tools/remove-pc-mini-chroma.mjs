#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { readPng, writePng } from "./pc-mini-png.js";

const input = process.argv[2];
const output = process.argv[3];

if (!input || !output) {
  console.error("Usage: node tools/remove-pc-mini-chroma.mjs <input.png> <output.png>");
  process.exit(2);
}

const png = readPng(input);
const key = sampleBorderKey(png);
const hard = 55;
const soft = 130;

for (let index = 0; index < png.data.length; index += 4) {
  const d = colorDistance([png.data[index], png.data[index + 1], png.data[index + 2]], key);
  if (d <= hard) {
    png.data[index + 3] = 0;
  } else if (d < soft) {
    const t = (d - hard) / (soft - hard);
    png.data[index + 3] = Math.min(png.data[index + 3], Math.round(255 * t));
    png.data[index] = Math.round(png.data[index] * t);
    png.data[index + 1] = Math.round(png.data[index + 1] * t);
    png.data[index + 2] = Math.round(png.data[index + 2] * t);
  }
}

fs.mkdirSync(path.dirname(output), { recursive: true });
writePng(output, png);
console.log(`[remove-pc-mini-chroma] key rgb(${key.join(",")}) -> ${output}`);

function sampleBorderKey(png) {
  const samples = [];
  for (let x = 0; x < png.width; x += Math.max(1, Math.floor(png.width / 20))) {
    samples.push(pixel(png, x, 0), pixel(png, x, png.height - 1));
  }
  for (let y = 0; y < png.height; y += Math.max(1, Math.floor(png.height / 20))) {
    samples.push(pixel(png, 0, y), pixel(png, png.width - 1, y));
  }
  return [0, 1, 2].map((channel) => Math.round(samples.reduce((sum, sample) => sum + sample[channel], 0) / samples.length));
}

function pixel(png, x, y) {
  const index = (y * png.width + x) * 4;
  return [png.data[index], png.data[index + 1], png.data[index + 2]];
}

function colorDistance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
