import fs from "node:fs";
import path from "node:path";

const [gridPath, artPath, outputPathArg] = process.argv.slice(2);
if (!gridPath || !artPath || !outputPathArg) {
  console.error("Usage: node tools/build-art-validation-overlay.mjs <grid.json> <art.png> <output.svg>");
  process.exit(1);
}

const metadata = JSON.parse(fs.readFileSync(gridPath, "utf8"));
const outputPath = path.resolve(outputPathArg);
const outputDir = path.dirname(outputPath);
fs.mkdirSync(outputDir, { recursive: true });

const artHref = path.relative(outputDir, path.resolve(artPath)).replaceAll(path.sep, "/");
const grid = metadata.grid;
const width = grid.width;
const height = grid.height;
const tileWidth = grid.tileWidth;
const tileHeight = grid.tileHeight;
const origin = grid.origin;

const cells = buildCellIndex(metadata);
const overlays = [];

for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const cell = getCell(x, y);
    const points = diamondPoints(x, y);
    overlays.push(cellDiamond(points, cellFill(cell), cellStroke(cell), strokeWidth(cell)));
    if (cell.feature) overlays.push(labelCell(x, y, cell.feature, "#ff7d18"));
    else if (cell.cover) overlays.push(labelCell(x, y, cell.cover.kind === "three_quarter" ? "C" : "h", "#ffe45a"));
    else if (cell.slope) overlays.push(labelCell(x, y, "R", "#74e36f"));
    else if (cell.marker) overlays.push(labelCell(x, y, cell.marker, "#d7e8ff"));
  }
}

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <defs>
    <filter id="label-shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#050607" flood-opacity="0.9"/>
    </filter>
  </defs>
  <rect width="1920" height="1080" fill="#050607"/>
  <image href="${escapeXml(artHref)}" x="0" y="0" width="1920" height="1080" preserveAspectRatio="none" opacity="0.78"/>
  <g opacity="0.86">${overlays.join("\n")}</g>
  <g transform="translate(42 38)" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="18" fill="#f4f0df">
    <rect x="-18" y="-22" width="900" height="106" rx="8" fill="#050607" opacity="0.72"/>
    <text font-weight="700">${escapeXml(metadata.name || metadata.stageId)} validation overlay</text>
    <text y="30">Colored diamonds are the authoritative grid footprints. Final art must sit inside these silhouettes.</text>
    <text y="60">Orange: numbered feature. Yellow: cover/blocker. Green: slope/ramp. Red-black: blocked/void.</text>
  </g>
</svg>
`;

fs.writeFileSync(outputPath, svg);
console.log(outputPath);

function buildCellIndex(data) {
  const index = new Map();
  for (let y = 0; y < data.grid.height; y += 1) {
    for (let x = 0; x < data.grid.width; x += 1) {
      index.set(key(x, y), { x, y, walkable: false, blocked: true, altitude: 0 });
    }
  }

  if (Array.isArray(data.cells)) {
    for (const sourceCell of data.cells) {
      const x = Number(sourceCell.x);
      const y = Number(sourceCell.y);
      if (!Number.isInteger(x) || !Number.isInteger(y)) continue;
      const terrainSymbol = sourceCell.terrain?.symbol || sourceCell.terrain || sourceCell.base?.symbol || sourceCell.base || " ";
      const markerSymbols = normalizeMarkerSymbols(sourceCell.markers);
      patch(x, y, {
        walkable: terrainSymbol !== " ",
        blocked: terrainSymbol === " ",
        altitude: Number(sourceCell.altitude) || 0,
      });
      if (terrainSymbol === "R") patch(x, y, { slope: true, walkable: true, blocked: false });
      if (terrainSymbol === "h") patch(x, y, { cover: { kind: "half", blocksMovement: false }, walkable: true, blocked: false });
      if (terrainSymbol === "C") patch(x, y, { cover: { kind: "three_quarter", blocksMovement: false }, walkable: true, blocked: false });
      if (terrainSymbol === "H") patch(x, y, { marker: "H", walkable: true, blocked: false });
      for (const marker of markerSymbols) {
        if (/^[1-9]$/.test(marker)) patch(x, y, { feature: marker, blocked: true, walkable: false });
        else if (marker === "P") patch(x, y, { marker: "P" });
        else if (marker === "M") patch(x, y, { marker: "M" });
        else patch(x, y, { marker });
      }
    }
  }

  for (const cell of data.altitude?.cells || []) patch(cell.x, cell.y, { altitude: cell.height || 0 });
  for (const cell of data.walkable?.cells || []) patch(cell.x, cell.y, { walkable: true, blocked: false });
  for (const cell of data.playable?.cells || []) patch(cell.x, cell.y, { walkable: true, blocked: false });
  if (Array.isArray(data.finalPassability?.cells)) {
    for (let y = 0; y < data.grid.height; y += 1) {
      for (let x = 0; x < data.grid.width; x += 1) patch(x, y, { walkable: false, blocked: true });
    }
    for (const cell of data.finalPassability.cells) patch(cell.x, cell.y, { walkable: true, blocked: false });
  }
  for (const cell of data.blocked || []) patch(cell.x, cell.y, { blocked: true, walkable: false, blockedKind: cell.kind });
  for (const cell of data.slopes || []) patch(cell.x, cell.y, { slope: true, walkable: true, blocked: false });
  for (const cover of data.cover || []) {
    if (Number.isInteger(cover.x) && Number.isInteger(cover.y)) {
      patch(cover.x, cover.y, { cover, blocked: cover.blocksMovement, walkable: !cover.blocksMovement });
    }
  }
  for (const cover of data.cover || []) {
    for (const cell of cover.cells || []) {
      patch(cell.x, cell.y, {
        cover: { kind: cover.type || cover.kind, blocksMovement: Boolean(cover.blocksMovement) },
        blocked: Boolean(cover.blocksMovement),
        walkable: !cover.blocksMovement,
      });
    }
  }
  for (const object of data.placedObjects?.items || []) {
    for (const cell of object.footprint || object.cells || []) {
      patch(cell.x, cell.y, {
        feature: object.symbol || object.id,
        featureLabel: object.label,
        blocked: Boolean(object.blocksMovement),
        walkable: !object.blocksMovement,
      });
    }
  }
  for (const feature of data.features || []) patch(feature.x, feature.y, { feature: feature.feature, featureLabel: feature.label, blocked: true, walkable: false });
  for (const cell of data.lights || []) patch(cell.x, cell.y, { marker: "L" });
  for (const cell of data.transitions || []) patch(cell.x, cell.y, { marker: "T" });
  for (const cell of data.conversationTriggers || []) patch(cell.x, cell.y, { marker: "V" });
  for (const cell of data.npcs || []) patch(cell.x, cell.y, { marker: "N" });
  for (const cell of data.spawns?.defaultHeroSpawns || []) patch(cell.x, cell.y, { marker: `P${cell.order || ""}` });
  for (const cell of data.spawns?.defaultEnemySpawns || []) patch(cell.x, cell.y, { marker: "M" });

  return index;

  function patch(x, y, value) {
    index.set(key(x, y), { ...index.get(key(x, y)), ...value });
  }
}

function normalizeMarkerSymbols(markers) {
  if (!Array.isArray(markers)) return [];
  return markers.map((marker) => marker?.symbol || marker).filter(Boolean);
}

function getCell(x, y) {
  return cells.get(key(x, y)) || { x, y, blocked: true, walkable: false, altitude: 0 };
}

function key(x, y) {
  return `${x},${y}`;
}

function cellCenter(x, y) {
  return {
    x: origin.x + ((x - y) * tileWidth) / 2,
    y: origin.y + ((x + y) * tileHeight) / 2,
  };
}

function diamondPoints(x, y) {
  const center = cellCenter(x, y);
  const halfW = tileWidth / 2;
  const halfH = tileHeight / 2;
  return [
    [center.x, center.y - halfH],
    [center.x + halfW, center.y],
    [center.x, center.y + halfH],
    [center.x - halfW, center.y],
  ];
}

function cellDiamond(points, fill, stroke, widthValue) {
  return `<polygon points="${points.map((point) => point.join(",")).join(" ")}" fill="${fill}" stroke="${stroke}" stroke-width="${widthValue}" vector-effect="non-scaling-stroke"/>`;
}

function labelCell(x, y, label, color) {
  const center = cellCenter(x, y);
  return `<text x="${center.x}" y="${center.y + 7}" fill="${color}" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="24" font-weight="800" filter="url(#label-shadow)">${escapeXml(label)}</text>`;
}

function cellFill(cell) {
  if (cell.feature) return "rgba(255,125,24,0.42)";
  if (cell.cover) return "rgba(255,226,75,0.34)";
  if (cell.slope) return "rgba(112,225,100,0.28)";
  if (cell.blocked) return "rgba(8,10,11,0.42)";
  if (cell.altitude >= 4) return "rgba(218,151,73,0.12)";
  if (cell.altitude > 0) return "rgba(175,161,89,0.10)";
  return "rgba(190,220,184,0.06)";
}

function cellStroke(cell) {
  if (cell.feature) return "#ff7d18";
  if (cell.cover) return "#ffe45a";
  if (cell.slope) return "#74e36f";
  if (cell.blocked) return "#20272b";
  if (cell.altitude >= 4) return "#d89852";
  if (cell.altitude > 0) return "#9f995d";
  return "#d7ead1";
}

function strokeWidth(cell) {
  if (cell.feature || cell.cover) return 4;
  if (cell.slope || cell.blocked) return 3;
  return 1.4;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
