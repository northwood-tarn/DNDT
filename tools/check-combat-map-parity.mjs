import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

import { projectCellPolygon, projectGridPoint } from "../app/combat/isometricGrid.js";
import { createGridProjectionFromStage, getCombatStageMetadata } from "../app/combat/stageMetadata.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const defaultPackageDir = path.join(
  repoRoot,
  "app/visual_spike/assets/0_plateau_assault/package_regen_from_downloads_01"
);

const checks = [];

main();

function main() {
  const packageDir = path.resolve(process.argv[2] || defaultPackageDir);
  const gridPath = path.join(packageDir, "0_plateau_assault.grid.json");
  const artPath = path.join(packageDir, "0_plateau_assault.landform_module_terrain_attempt_11.png");
  const overlayPath = path.join(packageDir, "0_plateau_assault.landform_module_terrain_attempt_11_validation_overlay.svg");

  checkStaticPackage({ gridPath, artPath, overlayPath });
  checkRuntimeParityForPackage(gridPath);
  checkRuntimeParityForRegisteredStages();

  const failed = checks.filter((check) => check.status === "FAIL");
  const warned = checks.filter((check) => check.status === "WARN");
  for (const check of checks) {
    const suffix = check.detail ? ` - ${check.detail}` : "";
    console.log(`${check.status}: ${check.name}${suffix}`);
  }
  console.log(`\nSummary: ${checks.length - failed.length} passed/warned, ${failed.length} failed.`);
  if (warned.length) console.log(`Warnings: ${warned.length}`);
  if (failed.length) process.exitCode = 1;
}

function checkStaticPackage({ gridPath, artPath, overlayPath }) {
  const metadata = readJson(gridPath);
  const artSize = readPngSize(artPath);
  record(
    artSize.width === metadata.image?.width && artSize.height === metadata.image?.height,
    "static asset: PNG dimensions match grid metadata",
    `${artSize.width}x${artSize.height} vs ${metadata.image?.width}x${metadata.image?.height}`
  );

  const overlay = fs.readFileSync(overlayPath, "utf8");
  const svgSize = readSvgSize(overlay);
  record(
    svgSize.width === metadata.image?.width && svgSize.height === metadata.image?.height,
    "static asset: overlay SVG dimensions match grid metadata",
    `${svgSize.width}x${svgSize.height} vs ${metadata.image?.width}x${metadata.image?.height}`
  );

  const image = readSvgImage(overlay);
  record(
    image?.href === path.basename(artPath) && image?.preserveAspectRatio === "none",
    "static asset: overlay embeds candidate art without aspect-ratio fitting",
    image ? `${image.href}, preserveAspectRatio=${image.preserveAspectRatio}` : "no image tag found"
  );

  const polygonPoints = readFirstSvgPolygon(overlay);
  const expected = toolDiamondPoints(metadata.grid, 0, 0);
  record(
    pointsEqual(polygonPoints, expected),
    "static asset: overlay grid uses metadata origin/tile formula",
    `first polygon ${formatPoints(polygonPoints)} expected ${formatPoints(expected)}`
  );
}

function checkRuntimeParityForPackage(gridPath) {
  const metadata = readJson(gridPath);
  checkRuntimeVsToolProjection({
    label: `package ${metadata.id || path.basename(gridPath)}`,
    grid: metadata.grid,
    projection: createGridProjectionFromStage({ image: metadata.image, grid: metadata.grid }),
  });
}

function checkRuntimeParityForRegisteredStages() {
  for (const stageId of ["dockside_gridfirst_stage_v1", "backlands_field_plateau_01"]) {
    const stage = getCombatStageMetadata(stageId);
    if (!stage) {
      record(false, `runtime parity: registered stage ${stageId} exists`, "stage metadata not found");
      continue;
    }
    checkRuntimeVsToolProjection({
      label: `registered stage ${stageId}`,
      grid: stage.grid,
      projection: createGridProjectionFromStage({ image: stage.image, grid: stage.grid }),
    });
  }
}

function checkRuntimeVsToolProjection({ label, grid, projection }) {
  const deltas = [];
  let worst = { distance: 0, x: 0, y: 0, runtime: null, tool: null };

  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      const runtimeCenter = projectGridPoint(projection, { x: x + 0.5, y: y + 0.5 });
      const toolCenter = toolCellCenter(grid, x, y);
      const dx = runtimeCenter.x - toolCenter.x;
      const dy = runtimeCenter.y - toolCenter.y;
      deltas.push(`${round(dx)},${round(dy)}`);
      const distance = Math.hypot(dx, dy);
      if (distance > worst.distance) worst = { distance, x, y, runtime: runtimeCenter, tool: toolCenter };
    }
  }

  const uniqueDeltas = [...new Set(deltas)];
  record(
    uniqueDeltas.length === 1 && uniqueDeltas[0] === "0,0",
    `runtime parity: ${label} cell centers match validation formula`,
    uniqueDeltas.length === 1
      ? `constant delta ${uniqueDeltas[0]} px`
      : `deltas ${uniqueDeltas.slice(0, 6).join(" ")}`
  );

  const runtimePolygon = projectCellPolygon(projection, { x: 0, y: 0 }).map(pointArray);
  const toolPolygon = toolDiamondPoints(grid, 0, 0);
  record(
    pointsEqual(runtimePolygon, toolPolygon),
    `runtime parity: ${label} cell (0,0) polygon matches validation diamond`,
    `runtime ${formatPoints(runtimePolygon)} vs validation ${formatPoints(toolPolygon)}`
  );

  if (worst.distance > 0.001) {
    recordWarn(
      `runtime parity: ${label} worst center delta`,
      `cell ${worst.x},${worst.y}: runtime ${formatPoint(worst.runtime)} vs validation ${formatPoint(worst.tool)}`
    );
  }
}

function toolCellCenter(grid, x, y) {
  return {
    x: grid.origin.x + ((x - y) * grid.tileWidth) / 2,
    y: grid.origin.y + ((x + y) * grid.tileHeight) / 2,
  };
}

function toolDiamondPoints(grid, x, y) {
  const center = toolCellCenter(grid, x, y);
  const halfW = grid.tileWidth / 2;
  const halfH = grid.tileHeight / 2;
  return [
    [center.x, center.y - halfH],
    [center.x + halfW, center.y],
    [center.x, center.y + halfH],
    [center.x - halfW, center.y],
  ];
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readPngSize(filePath) {
  const buffer = fs.readFileSync(filePath);
  assert.equal(buffer.toString("ascii", 1, 4), "PNG", `${filePath} is not a PNG`);
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function readSvgSize(svg) {
  const match = svg.match(/<svg[^>]*\bwidth="([0-9.]+)"[^>]*\bheight="([0-9.]+)"[^>]*>/);
  return match ? { width: Number(match[1]), height: Number(match[2]) } : { width: NaN, height: NaN };
}

function readSvgImage(svg) {
  const match = svg.match(/<image\b([^>]*)>/);
  if (!match) return null;
  return {
    href: attr(match[1], "href"),
    preserveAspectRatio: attr(match[1], "preserveAspectRatio"),
  };
}

function readFirstSvgPolygon(svg) {
  const match = svg.match(/<polygon[^>]*\bpoints="([^"]+)"/);
  if (!match) return [];
  return match[1].trim().split(/\s+/).map((pair) => pair.split(",").map(Number));
}

function attr(source, name) {
  const match = source.match(new RegExp(`\\b${name}="([^"]*)"`));
  return match ? match[1] : "";
}

function pointArray(point) {
  return [point.x, point.y];
}

function pointsEqual(a, b, epsilon = 0.001) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  return a.every((point, index) => (
    Math.abs(point[0] - b[index][0]) <= epsilon
    && Math.abs(point[1] - b[index][1]) <= epsilon
  ));
}

function formatPoints(points) {
  return `[${points.map((point) => `${round(point[0])},${round(point[1])}`).join(" ")}]`;
}

function formatPoint(point) {
  return `${round(point.x)},${round(point.y)}`;
}

function round(value) {
  return Number(value.toFixed(3));
}

function record(pass, name, detail = "") {
  checks.push({ status: pass ? "PASS" : "FAIL", name, detail });
}

function recordWarn(name, detail = "") {
  checks.push({ status: "WARN", name, detail });
}
