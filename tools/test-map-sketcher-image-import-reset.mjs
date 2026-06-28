import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

class StubElement {
  constructor(tagName = "div", id = "") {
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this.children = [];
    this.files = [];
    this.value = "";
    this.type = "";
    this.className = "";
    this.textContent = "";
    this.attributes = new Map();
    this.listeners = new Map();
    this.style = {
      values: new Map(),
      setProperty: (name, value) => this.style.values.set(name, value),
    };
    this.classList = {
      add: (...names) => {
        const existing = new Set(this.className.split(/\s+/).filter(Boolean));
        for (const name of names) existing.add(name);
        this.className = [...existing].join(" ");
      },
    };
    this.parts = new Map();
  }

  set innerHTML(value) {
    this.children = [];
    this.parts.clear();
    this._innerHTML = value;
  }

  get innerHTML() {
    return this._innerHTML || "";
  }

  append(...nodes) {
    this.children.push(...nodes);
  }

  appendChild(node) {
    this.children.push(node);
    return node;
  }

  addEventListener(type, handler) {
    this.listeners.set(type, handler);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  querySelector(selector) {
    if (!this.parts.has(selector)) this.parts.set(selector, new StubElement("span"));
    return this.parts.get(selector);
  }
}

const elements = new Map();
function getElement(id) {
  if (!elements.has(id)) elements.set(id, new StubElement("div", id));
  return elements.get(id);
}

globalThis.document = {
  getElementById: getElement,
  createElement: (tagName) => new StubElement(tagName),
  body: new StubElement("body"),
};
globalThis.window = {
  addEventListener() {},
};
globalThis.confirm = () => true;
globalThis.URL = {
  createObjectURL: () => "blob:test-image",
  revokeObjectURL() {},
};
globalThis.Image = class {
  constructor() {
    this.naturalWidth = 1920;
    this.naturalHeight = 1080;
  }

  set src(_value) {
    queueMicrotask(() => this.onload?.());
  }
};

const requiredElementIds = [
  "map-name",
  "map-id",
  "map-mode",
  "map-size",
  "altitude-overlay-button",
  "grid",
  "palette",
  "feature-definitions",
  "selected-tool",
  "status",
  "map-note",
  "ascii-output",
  "clear-button",
  "import-button",
  "import-input",
  "layer-0-button",
  "layer-0-input",
  "layer-1-button",
  "layer-1-input",
  "layer-1-opacity",
  "origin-x",
  "origin-y",
  "tile-width",
  "tile-height",
  "export-sketch-button",
  "export-json-button",
];
for (const id of requiredElementIds) getElement(id);

getElement("map-name").value = "Backlands Field Plateau";
getElement("map-id").value = "backlands_field_plateau_01";
getElement("map-mode").value = "combat";
getElement("layer-1-opacity").value = "100";
getElement("origin-x").value = "960";
getElement("origin-y").value = "120";
getElement("tile-width").value = "128";
getElement("tile-height").value = "64";

const sourcePath = path.resolve("app/map_sketcher/mapSketcher.js");
const source = await fs.readFile(sourcePath, "utf8");
const testableSource = `${source}
export const __test = { state, els, handleImageImport, toJson };
`;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(testableSource).toString("base64")}`;
const { __test } = await import(moduleUrl);

__test.state.cells[0][0].terrain = ".";
__test.state.cells[0][0].markers = ["P"];
__test.state.cells[0][0].altitude = 4;
__test.state.cells[1][1].terrain = "R";
__test.state.cells[1][1].markers = ["M"];
__test.state.cells[1][1].altitude = -1;
__test.state.featureDefinitions["1"] = "stale placed object";
__test.state.featureMetadata["1"].cover = "full";
__test.state.gridOrigin = { x: 960, y: 120 };
__test.els.originX.value = "960";
__test.els.originY.value = "120";
__test.state.imageLayers[0] = {
  name: "stale_layer_0.png",
  type: "image/png",
  width: 1920,
  height: 1080,
  url: "blob:stale-layer-0",
};
__test.els.mapNote.value = "stale image note";

const input = new StubElement("input");
input.files = [{ name: "escarpment_left_path_01.png", type: "image/png" }];
await __test.handleImageImport(1, input);

const exported = __test.toJson();
assert.equal(exported.id, "escarpment_left_path_01");
assert.equal(exported.name, "escarpment left path 01");
assert.equal(exported.layers[0].path, null);
assert.equal(exported.layers[1].path, "escarpment_left_path_01.png");
assert.equal(exported.layers[1].width, 1920);
assert.equal(exported.layers[1].height, 1080);
assert.equal(exported.grid.width, 34);
assert.equal(exported.grid.height, 34);
assert.deepEqual(exported.grid.origin, { x: 960, y: -512 });
assert.deepEqual(gridBounds(exported.grid), {
  minX: -1216,
  minY: -544,
  maxX: 3136,
  maxY: 1632,
});
assert.equal(gridCoversPoint(exported.grid, 1, 1), true);
assert.equal(gridCoversPoint(exported.grid, 1919, 1), true);
assert.equal(gridCoversPoint(exported.grid, 1, 1079), true);
assert.equal(gridCoversPoint(exported.grid, 1919, 1079), true);
assert.equal(exported.imageNote, "");
assert.equal(exported.cells.length, 34 * 34);
assert.equal(exported.cells.filter((cell) => cell.terrain.symbol !== " ").length, 0);
assert.equal(exported.cells.filter((cell) => cell.markers.length > 0).length, 0);
assert.equal(exported.cells.filter((cell) => cell.altitude !== 0).length, 0);
assert.equal(exported.heroSpawns.length, 0);
assert.equal(exported.placedObjects.items.length, 0);
assert.equal(exported.finalPassability.cells.length, 0);
assert.equal(exported.cover.length, 0);
assert.deepEqual(exported.featureDefinitions, {
  1: "",
  2: "",
  3: "",
  4: "",
  5: "",
  6: "",
  7: "",
  8: "",
  9: "",
});
assert.equal(exported.featureMetadata["1"].cover, "none");
assert.equal(__test.state.selectedKind, "terrain");
assert.equal(__test.state.selectedSymbol, ".");
assert.equal(__test.state.selectedHeight, 0);
assert.equal(__test.els.size.value, "image_area_1920x1080");
assert.equal(__test.els.originX.value, "960");
assert.equal(__test.els.originY.value, "-512");

console.log("map sketcher image import reset: ok");

function gridBounds(grid) {
  const halfW = grid.tileWidth / 2;
  const halfH = grid.tileHeight / 2;
  const corners = [];
  for (const y of [0, grid.height - 1]) {
    for (const x of [0, grid.width - 1]) {
      const centerX = grid.origin.x + ((x - y) * grid.tileWidth) / 2;
      const centerY = grid.origin.y + ((x + y) * grid.tileHeight) / 2;
      corners.push(
        { x: centerX, y: centerY - halfH },
        { x: centerX + halfW, y: centerY },
        { x: centerX, y: centerY + halfH },
        { x: centerX - halfW, y: centerY },
      );
    }
  }
  return {
    minX: Math.min(...corners.map((point) => point.x)),
    minY: Math.min(...corners.map((point) => point.y)),
    maxX: Math.max(...corners.map((point) => point.x)),
    maxY: Math.max(...corners.map((point) => point.y)),
  };
}

function gridCoversPoint(grid, px, py) {
  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      const centerX = grid.origin.x + ((x - y) * grid.tileWidth) / 2;
      const centerY = grid.origin.y + ((x + y) * grid.tileHeight) / 2;
      const dx = Math.abs(px - centerX) / (grid.tileWidth / 2);
      const dy = Math.abs(py - centerY) / (grid.tileHeight / 2);
      if (dx + dy <= 1) return true;
    }
  }
  return false;
}
