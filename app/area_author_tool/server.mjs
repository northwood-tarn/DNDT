import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const importsDir = path.join(__dirname, "imports");
const exportsDir = path.join(__dirname, "exports");
const port = Number(process.env.PORT || 8130);
const IMAGE_W = 1920;
const IMAGE_H = 1080;

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

await mkdir(importsDir, { recursive: true });
await mkdir(exportsDir, { recursive: true });

const server = createServer((req, res) => {
  if (req.method === "POST" && req.url?.startsWith("/api/area-author/import-image")) {
    handleImportImage(req, res);
    return;
  }
  if (req.method === "POST" && req.url?.startsWith("/api/area-author/export-area")) {
    handleExportArea(req, res);
    return;
  }
  if (req.method === "GET" || req.method === "HEAD") {
    serveStatic(req, res);
    return;
  }
  sendJson(res, 405, { ok: false, error: "Method not allowed." });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`DNDT area author tool: http://127.0.0.1:${port}/area_author_tool/index.html`);
});

async function handleImportImage(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const requestedName = url.searchParams.get("name") || "area_background.png";
    const ext = safeImageExtension(path.extname(requestedName));
    const base = toSafeId(path.basename(requestedName, path.extname(requestedName))) || "area_background";
    const fileName = `${base}_${Date.now()}${ext}`;
    const buffer = await readBody(req, 30 * 1024 * 1024);
    const dimensions = readImageDimensions(buffer, ext);
    if (dimensions.width !== IMAGE_W || dimensions.height !== IMAGE_H) {
      throw new Error(`Image is ${dimensions.width}x${dimensions.height}; expected 1920x1080.`);
    }
    await writeFile(path.join(importsDir, fileName), buffer);
    sendJson(res, 200, {
      ok: true,
      path: `./imports/${fileName}`,
      width: dimensions.width,
      height: dimensions.height,
    });
  } catch (err) {
    sendJson(res, 400, { ok: false, error: err.message });
  }
}

async function handleExportArea(req, res) {
  try {
    const data = normalizeArea(await readJson(req));
    const fileName = `area.${data.area.id}.json`;
    await writeFile(path.join(exportsDir, fileName), `${JSON.stringify(data, null, 2)}\n`, "utf8");
    sendJson(res, 200, {
      ok: true,
      path: `app/area_author_tool/exports/${fileName}`,
      nodes: data.nodes.length,
      edges: data.edges.length,
    });
  } catch (err) {
    sendJson(res, 400, { ok: false, error: err.message });
  }
}

function normalizeArea(data) {
  if (!data || typeof data !== "object") throw new Error("Area export must be an object.");
  if (!data.area || typeof data.area !== "object") throw new Error("Area export needs area metadata.");
  const id = toSafeId(data.area.id || data.area.name || "area");
  const kind = ["combat", "exploration", "grand_exploration"].includes(data.area.kind) ? data.area.kind : "exploration";
  if (!data.area.background || typeof data.area.background !== "string") throw new Error("Area export needs an imported background image.");

  const nodeIds = new Set();
  const nodes = requireArray(data.nodes, "nodes").map((node, index) => {
    const nodeId = toSafeId(node?.id || node?.label || `node_${index + 1}`);
    if (nodeIds.has(nodeId)) throw new Error(`Duplicate node id: ${nodeId}`);
    nodeIds.add(nodeId);
    const point = normalizePoint(node, `Node ${nodeId}`);
    const scale = Number(node?.scale);
    if (!Number.isFinite(scale) || scale <= 0) throw new Error(`Node ${nodeId} has invalid scale.`);
    return {
      id: nodeId,
      label: typeof node?.label === "string" && node.label ? node.label : nodeId.replaceAll("_", " "),
      description: typeof node?.description === "string" ? node.description : "",
      discovery: {
        state: node?.discovery?.state === "discovered" ? "discovered" : "undiscovered",
        showLabelWhenDiscovered: node?.discovery?.showLabelWhenDiscovered !== false,
      },
      x: point.x,
      y: point.y,
      scale,
      trigger: normalizeTrigger(node?.trigger),
      extensions: node?.extensions && typeof node.extensions === "object" ? node.extensions : {},
    };
  });

  const edges = requireArray(data.edges, "edges").map((edge, index) => {
    const from = toSafeId(edge?.from || "");
    const to = toSafeId(edge?.to || "");
    if (!nodeIds.has(from) || !nodeIds.has(to)) throw new Error(`Path ${index + 1} references unknown nodes.`);
    if (from === to) throw new Error(`Path ${index + 1} connects a node to itself.`);
    return {
      id: toSafeId(edge?.id || `${from}_${to}`),
      from,
      to,
      points: normalizePathPoints(edge?.points, `Path ${index + 1}`),
      extensions: edge?.extensions && typeof edge.extensions === "object" ? edge.extensions : {},
    };
  });

  const entryNodeId = toSafeId(data.entryNodeId || "");
  if (!nodeIds.has(entryNodeId)) throw new Error("Area export needs a valid entry node.");

  return {
    schemaVersion: 1,
    area: {
      id,
      name: typeof data.area.name === "string" && data.area.name ? data.area.name : id.replaceAll("_", " "),
      kind,
      background: data.area.background,
      image: { width: IMAGE_W, height: IMAGE_H },
      defaults: {
        playerScale: Number.isFinite(Number(data.area.defaults?.playerScale)) ? Number(data.area.defaults.playerScale) : 1,
      },
      extensions: data.area.extensions && typeof data.area.extensions === "object" ? data.area.extensions : {},
    },
    entryNodeId,
    nodes,
    edges,
    combatSpawns: normalizeCombatSpawns(data.combatSpawns),
    extensions: data.extensions && typeof data.extensions === "object" ? data.extensions : {},
  };
}

function normalizeTrigger(trigger) {
  const type = ["none", "conversation", "area_transition", "combat"].includes(trigger?.type) ? trigger.type : "none";
  return {
    type,
    payload: trigger?.payload && typeof trigger.payload === "object" ? trigger.payload : {},
  };
}

function normalizeCombatSpawns(spawns) {
  if (!Array.isArray(spawns)) return [];
  return spawns.map((spawn, index) => {
    const point = normalizePoint(spawn, `Combat spawn ${index + 1}`);
    return {
      id: toSafeId(spawn?.id || `combat_spawn_${index + 1}`),
      label: typeof spawn?.label === "string" && spawn.label ? spawn.label : `Combat spawn ${index + 1}`,
      x: point.x,
      y: point.y,
      extensions: spawn?.extensions && typeof spawn.extensions === "object" ? spawn.extensions : {},
    };
  });
}

function normalizePathPoints(points, label) {
  if (!Array.isArray(points) || points.length < 2) throw new Error(`${label} needs at least two points.`);
  return points.map((point, index) => normalizePoint({ x: point?.[0], y: point?.[1] }, `${label}, point ${index + 1}`)).map((point) => [point.x, point.y]);
}

function normalizePoint(point, label) {
  const x = Math.round(Number(point?.x));
  const y = Math.round(Number(point?.y));
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`${label} has invalid position.`);
  if (x < 0 || x > IMAGE_W || y < 0 || y > IMAGE_H) throw new Error(`${label} is outside the 1920x1080 image.`);
  return { x, y };
}

function requireArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`Area export needs a ${label} array.`);
  return value;
}

async function serveStatic(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const pathname = decodeURIComponent(url.pathname === "/" ? "/area_author_tool/index.html" : url.pathname);
    const prefix = "/area_author_tool/";
    if (!pathname.startsWith(prefix)) {
      sendText(res, 404, "Not found.");
      return;
    }
    const relative = pathname.slice(prefix.length);
    const filePath = path.resolve(__dirname, relative);
    if (!filePath.startsWith(__dirname)) {
      sendText(res, 403, "Forbidden.");
      return;
    }
    const data = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Content-Length": data.length,
      "Cache-Control": "no-store",
    });
    if (req.method === "HEAD") res.end();
    else res.end(data);
  } catch {
    sendText(res, 404, "Not found.");
  }
}

async function readJson(req) {
  const buffer = await readBody(req, 5 * 1024 * 1024);
  return JSON.parse(buffer.toString("utf8"));
}

async function readBody(req, maxBytes) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) throw new Error("Request body is too large.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function readImageDimensions(buffer, ext) {
  if (ext === ".png") return readPngDimensions(buffer);
  if (ext === ".jpg" || ext === ".jpeg") return readJpegDimensions(buffer);
  if (ext === ".webp") return readWebpDimensions(buffer);
  throw new Error("Unsupported image type.");
}

function readPngDimensions(buffer) {
  if (buffer.length < 24 || buffer.toString("ascii", 1, 4) !== "PNG") throw new Error("Invalid PNG image.");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function readJpegDimensions(buffer) {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) throw new Error("Invalid JPEG image.");
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) throw new Error("Invalid JPEG marker.");
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
    }
    offset += 2 + length;
  }
  throw new Error("Could not read JPEG dimensions.");
}

function readWebpDimensions(buffer) {
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") throw new Error("Invalid WEBP image.");
  const chunk = buffer.toString("ascii", 12, 16);
  if (chunk === "VP8X") {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    };
  }
  throw new Error("Only extended WEBP images are supported by this importer.");
}

function safeImageExtension(ext) {
  const lower = ext.toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".webp"].includes(lower)) return lower;
  return ".png";
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function sendText(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function toSafeId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "area";
}
