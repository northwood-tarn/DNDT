import assert from "node:assert/strict";
import {
  cellPolygonLayout,
  createIsometricProjection,
  projectCellCenter,
  projectGridPoint,
  rotateIsometricProjection,
  screenToCell,
  screenToGridPoint,
} from "../../app/combat/isometricGrid.js";

export async function runIsometricGridCombatTests() {
  testProjectionRoundTrip();
  testCardinalMovementProjectsToDiamondAxes();
  testCellPolygonLayout();
  testRotationKeepsGridCenterFixed();
}

function testProjectionRoundTrip() {
  const projection = createIsometricProjection({ width: 10, height: 7 });
  const center = projectCellCenter(projection, { x: 4, y: 3 });
  assert.deepEqual(screenToCell(projection, center), { x: 4, y: 3 }, "cell center should round-trip through isometric projection");

  const gridPoint = screenToGridPoint(projection, projectGridPoint(projection, { x: 2.25, y: 5.5 }));
  assert.ok(Math.abs(gridPoint.x - 2.25) < 0.000001, "inverse projection should recover grid x");
  assert.ok(Math.abs(gridPoint.y - 5.5) < 0.000001, "inverse projection should recover grid y");
}

function testCardinalMovementProjectsToDiamondAxes() {
  const projection = createIsometricProjection({ width: 10, height: 7 });
  const origin = projectCellCenter(projection, { x: 3, y: 3 });
  const east = projectCellCenter(projection, { x: 4, y: 3 });
  const south = projectCellCenter(projection, { x: 3, y: 4 });

  assert.ok(east.x > origin.x, "east movement should project down-right");
  assert.ok(east.y > origin.y, "east movement should project down-right");
  assert.ok(south.x < origin.x, "south movement should project down-left");
  assert.ok(south.y > origin.y, "south movement should project down-left");
  assert.equal(Math.round(east.y - origin.y), Math.round(south.y - origin.y), "cardinal steps should share one isometric tile height");
}

function testCellPolygonLayout() {
  const projection = createIsometricProjection({ width: 4, height: 4 });
  const layout = cellPolygonLayout(projection, { x: 1, y: 1 });
  assert.ok(layout.width > layout.height, "isometric cells should be wider than tall");
  assert.match(layout.clipPath, /^50\.000% 0\.000%, 100\.000% 50\.000%, 50\.000% 100\.000%, 0\.000% 50\.000%$/, "cell hit polygon should be a diamond");
}

function testRotationKeepsGridCenterFixed() {
  const grid = { width: 10, height: 7 };
  const projection = createIsometricProjection(grid);
  const center = projectGridPoint(projection, { x: grid.width / 2, y: grid.height / 2 });
  const rotated = rotateIsometricProjection(projection, 1, grid);
  const rotatedCenter = projectGridPoint(rotated, { x: grid.width / 2, y: grid.height / 2 });

  assert.ok(Math.abs(center.x - rotatedCenter.x) < 0.000001, "rotation should preserve projected grid center x");
  assert.ok(Math.abs(center.y - rotatedCenter.y) < 0.000001, "rotation should preserve projected grid center y");
}
