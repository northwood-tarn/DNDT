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
    navigation: path.join(__dirname, "navigationData.ritual-road.json"),
  },
};
const port = Number(process.env.PORT || 8124);
const STANDARD_IMAGE_W = 1920;
const STANDARD_IMAGE_H = 1080;

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

function normalizeNavigation(data) {
  if (!data || typeof data !== "object") throw new Error("Navigation data must be an object.");
  if (!data.area || typeof data.area !== "object") throw new Error("Navigation data needs an area object.");
  if (!Array.isArray(data.nodes)) throw new Error("Navigation data needs a nodes array.");
  if (!Array.isArray(data.edges)) throw new Error("Navigation data needs an edges array.");

  const areaId = toSafeId(data.area.id || data.area.name || "area");
  const nodeIds = new Set();
  const nodes = data.nodes.map((node, index) => {
    if (!node || typeof node !== "object") throw new Error(`Node ${index + 1} must be an object.`);
    const id = toSafeId(node.id || node.label || `node_${index + 1}`);
    if (nodeIds.has(id)) throw new Error(`Duplicate node id: ${id}`);
    nodeIds.add(id);
    const x = Math.round(Number(node.x));
    const y = Math.round(Number(node.y));
    const scale = Number(node.scale);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`Node ${id} has invalid coordinates.`);
    if (x < 0 || x > STANDARD_IMAGE_W || y < 0 || y > STANDARD_IMAGE_H) {
      throw new Error(`Node ${id} is outside the 1920x1080 image.`);
    }
    if (!Number.isFinite(scale) || scale <= 0) throw new Error(`Node ${id} has invalid scale.`);
    return {
      id,
      label: typeof node.label === "string" && node.label ? node.label : id.replaceAll("_", " "),
      description: typeof node.description === "string" ? node.description : "",
      discovery: normalizeDiscovery(node.discovery),
      x,
      y,
      scale,
      trigger: normalizeNodeTrigger(node.trigger, node.roles),
      extensions: node.extensions && typeof node.extensions === "object" ? node.extensions : {},
    };
  });

  const edges = data.edges.map((edge, index) => {
    if (!edge || typeof edge !== "object") throw new Error(`Edge ${index + 1} must be an object.`);
    const from = toSafeId(edge.from || "");
    const to = toSafeId(edge.to || "");
    if (!nodeIds.has(from) || !nodeIds.has(to)) throw new Error(`Edge ${index + 1} references unknown nodes.`);
    if (from === to) throw new Error(`Edge ${index + 1} cannot connect a node to itself.`);
    const points = normalizePathPoints(edge.points, `Edge ${index + 1}`);
    return {
      id: toSafeId(edge.id || `${from}__${to}`),
      from,
      to,
      points,
      extensions: edge.extensions && typeof edge.extensions === "object" ? edge.extensions : {},
    };
  });

  const defaults = data.area.defaults && typeof data.area.defaults === "object" ? data.area.defaults : {};
  return {
    schemaVersion: Number.isFinite(Number(data.schemaVersion)) ? Number(data.schemaVersion) : 1,
    area: {
      id: areaId,
      name: typeof data.area.name === "string" && data.area.name ? data.area.name : areaId.replaceAll("_", " "),
      kind: ["combat", "exploration", "grand_exploration"].includes(data.area.kind) ? data.area.kind : "exploration",
      background: typeof data.area.background === "string" ? data.area.background : "",
      image: {
        width: STANDARD_IMAGE_W,
        height: STANDARD_IMAGE_H,
      },
      defaults: {
        ...defaults,
        playerScale: Number.isFinite(Number(defaults.playerScale)) ? Number(defaults.playerScale) : 1,
      },
      extensions: data.area.extensions && typeof data.area.extensions === "object" ? data.area.extensions : {},
    },
    entryNodeId: nodeIds.has(data.entryNodeId) ? data.entryNodeId : legacyEntryNodeId(data.nodes, nodes) ?? nodes[0]?.id ?? "",
    nodes,
    edges,
    combatSpawns: normalizeCombatSpawns(data.combatSpawns),
    debug: data.debug && typeof data.debug === "object" ? data.debug : {},
    extensions: data.extensions && typeof data.extensions === "object" ? data.extensions : {},
  };
}

function normalizeDiscovery(discovery) {
  return {
    state: discovery?.state === "discovered" ? "discovered" : "undiscovered",
    showLabelWhenDiscovered: discovery?.showLabelWhenDiscovered !== false,
  };
}

function normalizeNodeTrigger(trigger, legacyRoles = []) {
  const legacy = Array.isArray(legacyRoles) ? legacyRoles : [];
  const inferredType = legacy.includes("start_conversation")
    ? "conversation"
    : legacy.includes("combat_transition") || legacy.includes("encounter")
      ? "combat"
      : legacy.includes("exit")
        ? "area_transition"
        : "none";
  const type = ["none", "conversation", "area_transition", "combat"].includes(trigger?.type)
    ? trigger.type
    : inferredType;
  return {
    type,
    payload: trigger?.payload && typeof trigger.payload === "object" ? trigger.payload : {},
  };
}

function legacyEntryNodeId(sourceNodes, normalizedNodes) {
  if (!Array.isArray(sourceNodes)) return "";
  const legacyEntry = sourceNodes.find((node) => Array.isArray(node?.roles) && node.roles.includes("entry"));
  if (!legacyEntry) return "";
  const entryId = toSafeId(legacyEntry.id || legacyEntry.label || "");
  return normalizedNodes.some((node) => node.id === entryId) ? entryId : "";
}

function normalizeCombatSpawns(spawns) {
  if (!Array.isArray(spawns)) return [];
  return spawns
    .map((spawn, index) => {
      const x = Math.round(Number(spawn?.x));
      const y = Math.round(Number(spawn?.y));
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      if (x < 0 || x > STANDARD_IMAGE_W || y < 0 || y > STANDARD_IMAGE_H) {
        throw new Error(`Combat spawn ${index + 1} is outside the 1920x1080 image.`);
      }
      return {
        id: toSafeId(spawn?.id || `combat_spawn_${index + 1}`),
        label: typeof spawn?.label === "string" && spawn.label ? spawn.label : `Combat spawn ${index + 1}`,
        x,
        y,
        extensions: spawn?.extensions && typeof spawn.extensions === "object" ? spawn.extensions : {},
      };
    })
    .filter(Boolean);
}

function normalizePathPoints(points, label) {
  if (!Array.isArray(points) || points.length < 2) throw new Error(`${label} needs at least 2 points.`);
  return points.map((point, index) => {
    if (!Array.isArray(point) || point.length < 2) throw new Error(`${label}, point ${index + 1} must be [x, y].`);
    const x = Math.round(Number(point[0]));
    const y = Math.round(Number(point[1]));
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`${label}, point ${index + 1} has invalid coordinates.`);
    if (x < 0 || x > STANDARD_IMAGE_W || y < 0 || y > STANDARD_IMAGE_H) {
      throw new Error(`${label}, point ${index + 1} is outside the 1920x1080 image.`);
    }
    return [x, y];
  });
}

function toSafeId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "id";
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

async function handleSaveNavigation(req, res) {
  try {
    const area = getAreaKey(req);
    if (!areaFiles[area].navigation) throw new Error(`Area ${area} does not have a navigation data file.`);
    const data = normalizeNavigation(await readRequestJson(req));
    await writeFile(areaFiles[area].navigation, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    sendJson(res, 200, {
      ok: true,
      path: `app/visual_spike/${path.basename(areaFiles[area].navigation)}`,
      area,
      nodes: data.nodes.length,
      edges: data.edges.length,
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

  if (req.method === "POST" && req.url?.startsWith("/api/visual-spike/navigation")) {
    handleSaveNavigation(req, res);
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
