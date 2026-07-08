import fs from "node:fs";
import zlib from "node:zlib";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

let CRC_TABLE = null;

function crc32(buffer) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data = Buffer.alloc(0)) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

export function createCanvas(width, height) {
  return {
    width,
    height,
    data: new Uint8ClampedArray(width * height * 4),
  };
}

export function writePng(filePath, canvas) {
  const { width, height, data } = canvas;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (stride + 1);
    raw[row] = 0;
    Buffer.from(data.buffer, data.byteOffset + y * stride, stride).copy(raw, row + 1);
  }

  fs.writeFileSync(
    filePath,
    Buffer.concat([
      PNG_SIGNATURE,
      chunk("IHDR", ihdr),
      chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
      chunk("IEND"),
    ]),
  );
}

export function readPng(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error(`${filePath}: not a PNG`);
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idat = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8) throw new Error(`${filePath}: only 8-bit PNGs are supported`);
      colorType = data[9];
      if (![2, 6].includes(colorType)) throw new Error(`${filePath}: only RGB/RGBA PNGs are supported`);
      if (data[12] !== 0) throw new Error(`${filePath}: interlaced PNGs are not supported`);
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const rgba = new Uint8ClampedArray(width * height * 4);
  let inOffset = 0;
  const prev = new Uint8Array(stride);
  const row = new Uint8Array(stride);

  for (let y = 0; y < height; y += 1) {
    const filter = raw[inOffset];
    inOffset += 1;
    row.set(raw.subarray(inOffset, inOffset + stride));
    inOffset += stride;
    unfilterRow(row, prev, filter, channels);
    for (let x = 0; x < width; x += 1) {
      const src = x * channels;
      const dst = (y * width + x) * 4;
      rgba[dst] = row[src];
      rgba[dst + 1] = row[src + 1];
      rgba[dst + 2] = row[src + 2];
      rgba[dst + 3] = channels === 4 ? row[src + 3] : 255;
    }
    prev.set(row);
  }

  return { width, height, data: rgba };
}

function unfilterRow(row, prev, filter, bpp) {
  for (let i = 0; i < row.length; i += 1) {
    const left = i >= bpp ? row[i - bpp] : 0;
    const up = prev[i] || 0;
    const upLeft = i >= bpp ? prev[i - bpp] || 0 : 0;
    if (filter === 1) row[i] = (row[i] + left) & 0xff;
    else if (filter === 2) row[i] = (row[i] + up) & 0xff;
    else if (filter === 3) row[i] = (row[i] + Math.floor((left + up) / 2)) & 0xff;
    else if (filter === 4) row[i] = (row[i] + paeth(left, up, upLeft)) & 0xff;
    else if (filter !== 0) throw new Error(`unsupported PNG filter ${filter}`);
  }
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

export function setPixel(canvas, x, y, color) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
  const index = (y * canvas.width + x) * 4;
  const alpha = (color[3] ?? 255) / 255;
  const inv = 1 - alpha;
  canvas.data[index] = Math.round(color[0] * alpha + canvas.data[index] * inv);
  canvas.data[index + 1] = Math.round(color[1] * alpha + canvas.data[index + 1] * inv);
  canvas.data[index + 2] = Math.round(color[2] * alpha + canvas.data[index + 2] * inv);
  canvas.data[index + 3] = Math.round(255 * (alpha + (canvas.data[index + 3] / 255) * inv));
}

export function composite(dst, src, dx, dy, options = {}) {
  const opacity = options.opacity ?? 1;
  const tint = options.tint || null;
  for (let y = 0; y < src.height; y += 1) {
    for (let x = 0; x < src.width; x += 1) {
      const sx = (y * src.width + x) * 4;
      const alpha = src.data[sx + 3] * opacity;
      if (alpha <= 0) continue;
      const color = tint
        ? [
            Math.round((src.data[sx] / 255) * tint[0]),
            Math.round((src.data[sx + 1] / 255) * tint[1]),
            Math.round((src.data[sx + 2] / 255) * tint[2]),
            alpha,
          ]
        : [src.data[sx], src.data[sx + 1], src.data[sx + 2], alpha];
      setPixel(dst, dx + x, dy + y, color);
    }
  }
}

export function drawEllipse(canvas, cx, cy, rx, ry, color, softness = 1) {
  const minX = Math.floor(cx - rx - softness);
  const maxX = Math.ceil(cx + rx + softness);
  const minY = Math.floor(cy - ry - softness);
  const maxY = Math.ceil(cy + ry + softness);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const d = ((x - cx) ** 2) / (rx ** 2) + ((y - cy) ** 2) / (ry ** 2);
      if (d <= 1) {
        const edge = Math.min(1, (1 - d) * softness + 0.35);
        setPixel(canvas, x, y, [color[0], color[1], color[2], Math.round((color[3] ?? 255) * edge)]);
      }
    }
  }
}

export function drawPolygon(canvas, points, color) {
  const minY = Math.floor(Math.min(...points.map((point) => point.y)));
  const maxY = Math.ceil(Math.max(...points.map((point) => point.y)));
  for (let y = minY; y <= maxY; y += 1) {
    const nodes = [];
    for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
      const pi = points[i];
      const pj = points[j];
      if ((pi.y < y && pj.y >= y) || (pj.y < y && pi.y >= y)) {
        nodes.push(pi.x + ((y - pi.y) / (pj.y - pi.y)) * (pj.x - pi.x));
      }
    }
    nodes.sort((a, b) => a - b);
    for (let i = 0; i < nodes.length; i += 2) {
      for (let x = Math.floor(nodes[i]); x <= Math.ceil(nodes[i + 1]); x += 1) setPixel(canvas, x, y, color);
    }
  }
}

export function drawLine(canvas, x1, y1, x2, y2, width, color) {
  const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1) * 1.5);
  for (let i = 0; i <= steps; i += 1) {
    const t = steps === 0 ? 0 : i / steps;
    drawEllipse(canvas, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, width / 2, width / 2, color, 3);
  }
}

export function resizeNearest(src, width, height) {
  const dst = createCanvas(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sx = Math.min(src.width - 1, Math.floor((x / width) * src.width));
      const sy = Math.min(src.height - 1, Math.floor((y / height) * src.height));
      const srcIndex = (sy * src.width + sx) * 4;
      const dstIndex = (y * width + x) * 4;
      dst.data[dstIndex] = src.data[srcIndex];
      dst.data[dstIndex + 1] = src.data[srcIndex + 1];
      dst.data[dstIndex + 2] = src.data[srcIndex + 2];
      dst.data[dstIndex + 3] = src.data[srcIndex + 3];
    }
  }
  return dst;
}

export function alphaBounds(canvas) {
  let left = canvas.width;
  let top = canvas.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      if (canvas.data[(y * canvas.width + x) * 4 + 3] > 8) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
  }
  if (right < left) return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
  return { left, top, right, bottom, width: right - left + 1, height: bottom - top + 1 };
}
