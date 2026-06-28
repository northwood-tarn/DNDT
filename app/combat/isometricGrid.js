const DEFAULT_VIEW_BOX = Object.freeze({ width: 1000, height: 562.5 });
const DEFAULT_TILE = Object.freeze({ width: 72, height: 36 });
const DEFAULT_MARGIN = 56;

export function createIsometricProjection(grid, options = {}) {
  const viewBox = normalizeViewBox(options.viewBox);
  const tile = normalizeTile(options.tile);
  const margin = Number.isFinite(options.margin) ? Math.max(0, options.margin) : DEFAULT_MARGIN;
  const xAxis = options.xAxis || { x: tile.width / 2, y: tile.height / 2 };
  const yAxis = options.yAxis || { x: -tile.width / 2, y: tile.height / 2 };
  const bounds = projectedGridBounds({ origin: { x: 0, y: 0 }, xAxis, yAxis }, grid);
  const availableWidth = Math.max(1, viewBox.width - margin * 2);
  const availableHeight = Math.max(1, viewBox.height - margin * 2);
  const scale = Math.min(
    availableWidth / Math.max(1, bounds.width),
    availableHeight / Math.max(1, bounds.height)
  );
  const scaledXAxis = scaleVector(xAxis, scale);
  const scaledYAxis = scaleVector(yAxis, scale);
  const scaledBounds = projectedGridBounds({ origin: { x: 0, y: 0 }, xAxis: scaledXAxis, yAxis: scaledYAxis }, grid);

  return {
    kind: "isometric_square",
    viewBox,
    origin: {
      x: (viewBox.width - scaledBounds.width) / 2 - scaledBounds.minX,
      y: (viewBox.height - scaledBounds.height) / 2 - scaledBounds.minY,
    },
    xAxis: scaledXAxis,
    yAxis: scaledYAxis,
  };
}

export function rotateIsometricProjection(projection, quarterTurns = 0, grid = null) {
  if (!projection) return projection;
  const turns = ((quarterTurns % 4) + 4) % 4;
  if (turns === 0) return projection;
  const origin = projection.origin || { x: 0, y: 0 };
  const xAxis = projection.xAxis || { x: 1, y: 0 };
  const yAxis = projection.yAxis || { x: 0, y: 1 };
  const axes = [
    { xAxis, yAxis },
    { xAxis: yAxis, yAxis: { x: -xAxis.x, y: -xAxis.y } },
    { xAxis: { x: -xAxis.x, y: -xAxis.y }, yAxis: { x: -yAxis.x, y: -yAxis.y } },
    { xAxis: { x: -yAxis.x, y: -yAxis.y }, yAxis: xAxis },
  ][turns];
  const rotated = { ...projection, ...axes };
  if (!grid) return rotated;
  const center = projectGridPoint(projection, { x: grid.width / 2, y: grid.height / 2 });
  return {
    ...rotated,
    origin: {
      x: center.x - grid.width * axes.xAxis.x / 2 - grid.height * axes.yAxis.x / 2,
      y: center.y - grid.width * axes.xAxis.y / 2 - grid.height * axes.yAxis.y / 2,
    },
  };
}

export function projectGridPoint(projection, point) {
  const origin = projection.origin || { x: 0, y: 0 };
  const xAxis = projection.xAxis || { x: 1, y: 0 };
  const yAxis = projection.yAxis || { x: 0, y: 1 };
  return {
    x: origin.x + point.x * xAxis.x + point.y * yAxis.x,
    y: origin.y + point.x * xAxis.y + point.y * yAxis.y,
  };
}

export function projectCellCenter(projection, cell) {
  return projectGridPoint(projection, { x: cell.x + 0.5, y: cell.y + 0.5 });
}

export function projectCellPolygon(projection, cell) {
  return [
    projectGridPoint(projection, { x: cell.x, y: cell.y }),
    projectGridPoint(projection, { x: cell.x + 1, y: cell.y }),
    projectGridPoint(projection, { x: cell.x + 1, y: cell.y + 1 }),
    projectGridPoint(projection, { x: cell.x, y: cell.y + 1 }),
  ];
}

export function cellPolygonLayout(projection, cell) {
  const polygon = projectCellPolygon(projection, cell);
  const minX = Math.min(...polygon.map((point) => point.x));
  const minY = Math.min(...polygon.map((point) => point.y));
  const maxX = Math.max(...polygon.map((point) => point.x));
  const maxY = Math.max(...polygon.map((point) => point.y));
  const width = maxX - minX;
  const height = maxY - minY;
  return {
    left: minX,
    top: minY,
    width,
    height,
    clipPath: polygon.map((point) =>
      `${formatPercent((point.x - minX) / width)} ${formatPercent((point.y - minY) / height)}`
    ).join(", "),
  };
}

export function screenToGridPoint(projection, point) {
  const origin = projection.origin || { x: 0, y: 0 };
  const xAxis = projection.xAxis || { x: 1, y: 0 };
  const yAxis = projection.yAxis || { x: 0, y: 1 };
  const px = point.x - origin.x;
  const py = point.y - origin.y;
  const determinant = xAxis.x * yAxis.y - xAxis.y * yAxis.x;
  if (Math.abs(determinant) < 0.000001) return null;
  return {
    x: (px * yAxis.y - py * yAxis.x) / determinant,
    y: (py * xAxis.x - px * xAxis.y) / determinant,
  };
}

export function screenToCell(projection, point) {
  const gridPoint = screenToGridPoint(projection, point);
  if (!gridPoint) return null;
  return {
    x: Math.floor(gridPoint.x),
    y: Math.floor(gridPoint.y),
  };
}

export function cellDepth(cell) {
  return (cell.x + cell.y) * 10 + cell.y;
}

function projectedGridBounds(projection, grid) {
  const corners = [
    projectGridPoint(projection, { x: 0, y: 0 }),
    projectGridPoint(projection, { x: grid.width, y: 0 }),
    projectGridPoint(projection, { x: grid.width, y: grid.height }),
    projectGridPoint(projection, { x: 0, y: grid.height }),
  ];
  const minX = Math.min(...corners.map((point) => point.x));
  const minY = Math.min(...corners.map((point) => point.y));
  const maxX = Math.max(...corners.map((point) => point.x));
  const maxY = Math.max(...corners.map((point) => point.y));
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

function normalizeViewBox(viewBox) {
  return {
    width: Number.isFinite(viewBox?.width) && viewBox.width > 0 ? viewBox.width : DEFAULT_VIEW_BOX.width,
    height: Number.isFinite(viewBox?.height) && viewBox.height > 0 ? viewBox.height : DEFAULT_VIEW_BOX.height,
  };
}

function normalizeTile(tile) {
  return {
    width: Number.isFinite(tile?.width) && tile.width > 0 ? tile.width : DEFAULT_TILE.width,
    height: Number.isFinite(tile?.height) && tile.height > 0 ? tile.height : DEFAULT_TILE.height,
  };
}

function scaleVector(vector, scale) {
  return { x: vector.x * scale, y: vector.y * scale };
}

function formatPercent(value) {
  return `${(value * 100).toFixed(3)}%`;
}
