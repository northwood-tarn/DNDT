import fs from "node:fs";
import path from "node:path";
import {
  createCanvas,
  composite,
  readPng,
  resizeNearest,
  writePng,
} from "./pc-mini-png.js";
import { MINI_BASE_RUNTIME_FOOTPRINT } from "../app/mini_preview/base_asset_manifest.js";
import { MINI_LAYER_KIND } from "../app/mini_preview/pc_mini_asset_registry.js";
import { resolvePcMiniLayerPlan } from "../app/mini_preview/pc_mini_compositor.js";

const MINI_ROOT = path.resolve("app/mini_preview");
const OUTPUT_SIZE = { width: 256, height: 360 };
const OUTPUT_BASE_CENTER = { x: 128, y: 306 };

export function renderPcMini(selection, options = {}) {
  const plan = resolvePcMiniLayerPlan(selection);
  if (!plan.ok) return { ok: false, errors: plan.errors, plan };

  const canvas = createCanvas(OUTPUT_SIZE.width, OUTPUT_SIZE.height);
  const renderedLayers = [];

  for (const layer of plan.layers) {
    if (layer.hidden) {
      renderedLayers.push({ kind: layer.kind, id: layer.id, hidden: true });
      continue;
    }
    if (!layer.asset) return { ok: false, errors: [`${layer.kind}: missing asset path`], plan };
    const sourcePath = path.resolve(MINI_ROOT, layer.asset);
    const source = readPng(sourcePath);
    if (layer.kind === MINI_LAYER_KIND.BASE) {
      const scaled = scaleBase(source);
      const visible = MINI_BASE_RUNTIME_FOOTPRINT.visibleBounds;
      const sourceVisibleWidth = visible.right - visible.left;
      const scale = MINI_BASE_RUNTIME_FOOTPRINT.displayWidth / sourceVisibleWidth;
      const visibleCenter = {
        x: ((visible.left + visible.right) / 2) * scale,
        y: ((visible.top + visible.bottom) / 2) * scale,
      };
      composite(canvas, scaled, Math.round(OUTPUT_BASE_CENTER.x - visibleCenter.x), Math.round(OUTPUT_BASE_CENTER.y - visibleCenter.y));
      renderedLayers.push({ kind: layer.kind, id: layer.id, asset: layer.asset, baseSeparated: true });
      continue;
    }
    const anchor = layer.anchors?.baseCenter || { x: 128, y: 284 };
    composite(canvas, source, Math.round(OUTPUT_BASE_CENTER.x - anchor.x), Math.round(OUTPUT_BASE_CENTER.y - anchor.y), {
      tint: layer.tint,
    });
    renderedLayers.push({ kind: layer.kind, id: layer.id, asset: layer.asset, tint: layer.tint || null });
  }

  const manifest = {
    ok: true,
    cacheKey: plan.cacheKey,
    selection: plan.selection,
    render: plan.render,
    output: {
      canvas: OUTPUT_SIZE,
      baseCenter: OUTPUT_BASE_CENTER,
    },
    layers: renderedLayers,
  };

  if (options.outPng) {
    fs.mkdirSync(path.dirname(options.outPng), { recursive: true });
    writePng(options.outPng, canvas);
  }
  if (options.outManifest) {
    fs.mkdirSync(path.dirname(options.outManifest), { recursive: true });
    fs.writeFileSync(options.outManifest, `${JSON.stringify(manifest, null, 2)}\n`);
  }

  return { ok: true, errors: [], plan, manifest, canvas };
}

function scaleBase(source) {
  const visible = MINI_BASE_RUNTIME_FOOTPRINT.visibleBounds;
  const sourceVisibleWidth = visible.right - visible.left;
  const scale = MINI_BASE_RUNTIME_FOOTPRINT.displayWidth / sourceVisibleWidth;
  return resizeNearest(source, Math.round(source.width * scale), Math.round(source.height * scale));
}
