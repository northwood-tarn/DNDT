const svg = document.querySelector("#projectionSvg");
const readout = document.querySelector("#readout");
const yawSlider = document.querySelector("#yawSlider");
const pitchSlider = document.querySelector("#pitchSlider");
const yawValue = document.querySelector("#yawValue");
const pitchValue = document.querySelector("#pitchValue");

const config = {
  yawDegrees: 35,
  pitchDegrees: 60,
  grid: { width: 10, height: 8 },
  tileSize: 56,
  origin: { x: 430, y: 78 },
  bases: [
    { id: "A", className: "base-a", cell: { x: 2, y: 5 } },
    { id: "B", className: "base-b", cell: { x: 7, y: 2 } },
  ],
};

render();

yawSlider.addEventListener("input", syncControls);
pitchSlider.addEventListener("input", syncControls);

window.addEventListener("keydown", (event) => {
  if (event.key !== "Tab") return;
  event.preventDefault();
  svg.classList.toggle("grid-hidden", true);
});

window.addEventListener("keyup", (event) => {
  if (event.key !== "Tab") return;
  event.preventDefault();
  svg.classList.toggle("grid-hidden", false);
});

function render() {
  const projection = currentProjection();
  svg.replaceChildren();
  renderGrid(projection);
  renderCellCenters(projection);
  renderBases(projection);
  renderReadout(projection);
}

function createOrthographicProjection({ yawDegrees, pitchDegrees, tileSize, origin }) {
  const yaw = radians(yawDegrees);
  const pitch = radians(pitchDegrees);
  const pitchScale = Math.sin(pitch);
  return {
    origin,
    xAxis: {
      x: Math.cos(yaw) * tileSize,
      y: Math.sin(yaw) * pitchScale * tileSize,
    },
    yAxis: {
      x: -Math.sin(yaw) * tileSize,
      y: Math.cos(yaw) * pitchScale * tileSize,
    },
  };
}

function currentProjection() {
  return createOrthographicProjection(config);
}

function syncControls() {
  config.yawDegrees = Number(yawSlider.value);
  config.pitchDegrees = Number(pitchSlider.value);
  yawValue.textContent = String(config.yawDegrees);
  pitchValue.textContent = String(config.pitchDegrees);
  document.querySelector("h1").textContent = `Yaw ${config.yawDegrees} / Pitch ${config.pitchDegrees} / Orthographic`;
  render();
}

function renderGrid(projection) {
  const { width, height } = config.grid;
  for (let x = 0; x <= width; x += 1) {
    appendLine(project(projection, { x, y: 0 }), project(projection, { x, y: height }), "grid-line");
  }
  for (let y = 0; y <= height; y += 1) {
    appendLine(project(projection, { x: 0, y }), project(projection, { x: width, y }), "grid-line");
  }
  appendLine(project(projection, { x: 0, y: 0 }), project(projection, { x: width, y: 0 }), "axis-x");
  appendLine(project(projection, { x: 0, y: 0 }), project(projection, { x: 0, y: height }), "axis-y");
}

function renderCellCenters(projection) {
  for (let y = 0; y < config.grid.height; y += 1) {
    for (let x = 0; x < config.grid.width; x += 1) {
      const center = project(projection, cellCenter({ x, y }));
      appendCircle(center, 2.3, "cell-center");
      appendText(center, `${x},${y}`, "cell-label", { dy: -10 });
    }
  }
}

function renderBases(projection) {
  for (const base of config.bases) {
    const centerGrid = cellCenter(base.cell);
    const center = project(projection, centerGrid);
    appendEllipse({ x: center.x, y: center.y + 5 }, 31, 12, "base-shadow");
    appendEllipse(center, 30, 12, `base ${base.className}`);
    appendCircle(center, 4, "base-center");
    appendText({ x: center.x, y: center.y + 30 }, `${base.id}: cell ${base.cell.x},${base.cell.y}`, "base-label");
  }
}

function renderReadout(projection) {
  const xAxis = projection.xAxis;
  const yAxis = projection.yAxis;
  readout.textContent = [
    `yaw ${config.yawDegrees}`,
    `pitch ${config.pitchDegrees}`,
    `xAxis ${formatVector(xAxis)}`,
    `yAxis ${formatVector(yAxis)}`,
  ].join(" / ");
}

function cellCenter(cell) {
  return { x: cell.x + 0.5, y: cell.y + 0.5 };
}

function project(projection, point) {
  return {
    x: projection.origin.x + point.x * projection.xAxis.x + point.y * projection.yAxis.x,
    y: projection.origin.y + point.x * projection.xAxis.y + point.y * projection.yAxis.y,
  };
}

function appendLine(from, to, className) {
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", fmt(from.x));
  line.setAttribute("y1", fmt(from.y));
  line.setAttribute("x2", fmt(to.x));
  line.setAttribute("y2", fmt(to.y));
  line.setAttribute("class", className);
  svg.appendChild(line);
}

function appendEllipse(center, rx, ry, className) {
  const ellipse = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
  ellipse.setAttribute("cx", fmt(center.x));
  ellipse.setAttribute("cy", fmt(center.y));
  ellipse.setAttribute("rx", fmt(rx));
  ellipse.setAttribute("ry", fmt(ry));
  ellipse.setAttribute("class", className);
  svg.appendChild(ellipse);
}

function appendCircle(center, r, className) {
  const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  circle.setAttribute("cx", fmt(center.x));
  circle.setAttribute("cy", fmt(center.y));
  circle.setAttribute("r", fmt(r));
  circle.setAttribute("class", className);
  svg.appendChild(circle);
}

function appendText(point, value, className, options = {}) {
  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("x", fmt(point.x));
  text.setAttribute("y", fmt(point.y + (options.dy || 0)));
  text.setAttribute("class", className);
  text.textContent = value;
  svg.appendChild(text);
}

function radians(degrees) {
  return degrees * Math.PI / 180;
}

function fmt(value) {
  return Number(value).toFixed(2);
}

function formatVector(vector) {
  return `(${fmt(vector.x)}, ${fmt(vector.y)})`;
}
