import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBuildPlan, validateMetricScene } from '../metric-asset-builder.mjs';

const metrics = {
  unit: 'metre', wall_thickness: 0.15,
  camera: { height: 1.7, fov_degrees: 60, pitch_degrees: 0, roll_degrees: 0, framing_margin: 0.08 },
  lighting: {},
  types: {
    door_standard: { kind: 'opening', dimensions: [1, 0.15, 2.1] },
    table_standard: { kind: 'structural_prop', dimensions: [1.6, 0.8, 0.75] }
  }
};
const style = { id: 'test' };
const room = {
  style_profile: 'test', dimensions: { width: 4, length: 5, height: 3 }, camera: { facing: 'north' },
  doors: [{ id: 'door', type: 'door_standard', wall: 'south', position: 2 }],
  props: [{ id: 'table', type: 'table_standard', position: { x: 2, y: 2 }, rotation_degrees: 0 }]
};

test('valid metric scene passes semantic validation', () => assert.deepEqual(validateMetricScene(room, style, metrics), []));

test('catalog footprint prevents out-of-bounds placement', () => {
  const invalid = structuredClone(room);
  invalid.props[0].position.x = 0.2;
  assert.match(validateMetricScene(invalid, style, metrics).join('\n'), /exceeds room footprint/);
});

test('camera is derived deterministically without scene overrides', () => {
  const a = makeBuildPlan(room, style, metrics);
  const b = makeBuildPlan(room, style, metrics);
  assert.deepEqual(a.resolved.camera, b.resolved.camera);
  assert.equal(a.resolved.camera.position[2], 1.7);
  assert.equal(a.resolved.camera.fov_degrees, 60);
  assert.deepEqual(a.resolved.props[0].dimensions, [1.6, 0.8, 0.75]);
});
