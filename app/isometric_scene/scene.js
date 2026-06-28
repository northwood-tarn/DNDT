const IMAGE = { width: 1448, height: 1086 };

const scene = document.querySelector("#scene");
const overlay = document.querySelector("#overlay");
const miniature = document.querySelector("#miniature");

const walkablePolygon = [
  { x: 438, y: 521 },
  { x: 578, y: 347 },
  { x: 814, y: 404 },
  { x: 1079, y: 323 },
  { x: 1236, y: 444 },
  { x: 960, y: 617 },
  { x: 1083, y: 758 },
  { x: 828, y: 927 },
  { x: 608, y: 786 },
  { x: 379, y: 794 },
  { x: 289, y: 665 },
];

const grid = {
  origin: { x: 344, y: 646 },
  xAxis: { x: 58, y: 34 },
  yAxis: { x: -45, y: 43 },
  width: 12,
  height: 8,
};

let position = { x: 586, y: 603 };

renderOverlay();
placeMiniature(position, { immediate: true });

scene.addEventListener("click", (event) => {
  const point = eventToImagePoint(event);
  if (!pointInPolygon(point, walkablePolygon)) return;
  position = point;
  placeMiniature(position);
});

scene.addEventListener("pointermove", (event) => {
  const point = eventToImagePoint(event);
  scene.classList.toggle("walkable-cursor", pointInPolygon(point, walkablePolygon));
});

window.addEventListener("keydown", (event) => {
  if (event.key !== "Tab") return;
  event.preventDefault();
  scene.classList.add("inspecting");
});

window.addEventListener("keyup", (event) => {
  if (event.key !== "Tab") return;
  event.preventDefault();
  scene.classList.remove("inspecting");
});

function renderOverlay() {
  overlay.replaceChildren();
  appendPolygon(walkablePolygon, "walkable-region");
  for (let x = 0; x <= grid.width; x += 1) {
    appendLine(projectGrid({ x, y: 0 }), projectGrid({ x, y: grid.height }), "grid-line");
  }
  for (let y = 0; y <= grid.height; y += 1) {
    appendLine(projectGrid({ x: 0, y }), projectGrid({ x: grid.width, y }), "grid-line");
  }
}

function placeMiniature(point, options = {}) {
  const scaled = imageToScenePercent(point);
  if (options.immediate) miniature.style.transition = "none";
  miniature.style.left = `${scaled.x}%`;
  miniature.style.top = `${scaled.y}%`;
  miniature.style.zIndex = String(Math.round(point.y));
  if (options.immediate) {
    requestAnimationFrame(() => {
      miniature.style.transition = "";
    });
  }
}

function eventToImagePoint(event) {
  const rect = scene.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) / rect.width * IMAGE.width,
    y: (event.clientY - rect.top) / rect.height * IMAGE.height,
  };
}

function imageToScenePercent(point) {
  return {
    x: point.x / IMAGE.width * 100,
    y: point.y / IMAGE.height * 100,
  };
}

function projectGrid(point) {
  return {
    x: grid.origin.x + point.x * grid.xAxis.x + point.y * grid.yAxis.x,
    y: grid.origin.y + point.x * grid.xAxis.y + point.y * grid.yAxis.y,
  };
}

function appendPolygon(points, className) {
  const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  polygon.setAttribute("points", points.map((point) => `${point.x},${point.y}`).join(" "));
  polygon.setAttribute("class", className);
  overlay.appendChild(polygon);
}

function appendLine(from, to, className) {
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", String(from.x));
  line.setAttribute("y1", String(from.y));
  line.setAttribute("x2", String(to.x));
  line.setAttribute("y2", String(to.y));
  line.setAttribute("class", className);
  overlay.appendChild(line);
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    const intersects = ((a.y > point.y) !== (b.y > point.y))
      && (point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x);
    if (intersects) inside = !inside;
  }
  return inside;
}
