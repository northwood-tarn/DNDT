import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const areaFiles = {
  shrine: {
    collision: path.join(__dirname, "collisionData.json"),
    water: path.join(__dirname, "waterData.json"),
  },
  dock: {
    collision: path.join(__dirname, "collisionData.dock.json"),
    water: path.join(__dirname, "waterData.dock.json"),
  },
  "ritual-road": {
    collision: path.join(__dirname, "collisionData.ritual-road.json"),
    water: path.join(__dirname, "waterData.ritual-road.json"),
  },
};
const port = Number(process.env.PORT || 8124);

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function normalizeColliders(data) {
  return normalizePolygons(data, "Collider", "blocked");
}

function normalizeWaterAreas(data) {
  return normalizePolygons(data, "Water area", "water");
}

function normalizePolygons(data, label, fallbackPrefix) {
  if (!Array.isArray(data)) throw new Error(`${label} data must be an array.`);

  return data.map((collider, index) => {
    if (!collider || typeof collider !== "object") {
      throw new Error(`${label} ${index + 1} must be an object.`);
    }

    if (!Array.isArray(collider.points) || collider.points.length < 3) {
      throw new Error(`${label} ${index + 1} must have at least 3 points.`);
    }

    const points = collider.points.map((point, pointIndex) => {
      if (!Array.isArray(point) || point.length < 2) {
        throw new Error(`${label} ${index + 1}, point ${pointIndex + 1} must be [x, y].`);
      }

      const x = Math.round(Number(point[0]));
      const y = Math.round(Number(point[1]));
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        throw new Error(`${label} ${index + 1}, point ${pointIndex + 1} has invalid coordinates.`);
      }
      return [x, y];
    });

    return {
      id: typeof collider.id === "string" && collider.id ? collider.id : `${fallbackPrefix}_${index + 1}`,
      points,
    };
  });
}

async function readRequestJson(req) {
  const chunks = [];
  let length = 0;

  for await (const chunk of req) {
    length += chunk.length;
    if (length > 1024 * 1024) throw new Error("Request body too large.");
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(raw || "null");
}

async function handleSaveCollision(req, res) {
  try {
    const area = getAreaKey(req);
    const data = normalizeColliders(await readRequestJson(req));
    await writeFile(areaFiles[area].collision, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    sendJson(res, 200, {
      ok: true,
      path: `app/visual_spike/${path.basename(areaFiles[area].collision)}`,
      area,
      colliders: data.length,
    });
  } catch (err) {
    sendJson(res, 400, { ok: false, error: err.message });
  }
}

async function handleSaveWater(req, res) {
  try {
    const area = getAreaKey(req);
    const data = normalizeWaterAreas(await readRequestJson(req));
    await writeFile(areaFiles[area].water, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    sendJson(res, 200, {
      ok: true,
      path: `app/visual_spike/${path.basename(areaFiles[area].water)}`,
      area,
      areas: data.length,
    });
  } catch (err) {
    sendJson(res, 400, { ok: false, error: err.message });
  }
}

function getAreaKey(req) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const area = url.searchParams.get("area") || "shrine";
  if (!areaFiles[area]) throw new Error(`Unknown visual spike area: ${area}`);
  return area;
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname === "/" ? "/visual_spike/index.html" : decodeURIComponent(url.pathname);
  const requestedPath = path.resolve(appRoot, `.${pathname}`);

  if (!requestedPath.startsWith(`${appRoot}${path.sep}`)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const body = await readFile(requestedPath);
    const type = MIME_TYPES[path.extname(requestedPath).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": type,
      "Content-Length": body.length,
      "Cache-Control": "no-store",
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

const server = createServer((req, res) => {
  if (req.method === "POST" && req.url?.startsWith("/api/visual-spike/collision")) {
    handleSaveCollision(req, res);
    return;
  }

  if (req.method === "POST" && req.url?.startsWith("/api/visual-spike/water")) {
    handleSaveWater(req, res);
    return;
  }

  if (req.method === "GET" || req.method === "HEAD") {
    serveStatic(req, res);
    return;
  }

  res.writeHead(405, { Allow: "GET, HEAD, POST" });
  res.end("Method not allowed");
});

server.listen(port, "127.0.0.1", () => {
  console.log(`DNDT visual spike authoring server: http://127.0.0.1:${port}/visual_spike/index.html`);
});
