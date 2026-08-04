import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PIPELINE = path.join(ROOT, 'asset_pipeline');

const readJson = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));
const round = (value) => Math.round(value * 1e6) / 1e6;
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');

function rotatedFootprint(dimensions, rotation) {
  const quarterTurns = Math.abs(rotation / 90) % 2;
  return quarterTurns === 1 ? [dimensions[1], dimensions[0]] : dimensions.slice(0, 2);
}

function aabb(prop, type) {
  const [width, length] = rotatedFootprint(type.dimensions, prop.rotation_degrees);
  return {
    id: prop.id,
    minX: prop.position.x - width / 2,
    maxX: prop.position.x + width / 2,
    minY: prop.position.y - length / 2,
    maxY: prop.position.y + length / 2
  };
}

function overlaps(a, b) {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
}

export function validateMetricScene(room, style, metrics) {
  const errors = [];
  if (room.style_profile !== style.id) errors.push(`style_profile '${room.style_profile}' does not match style '${style.id}'`);
  const ids = new Set();
  for (const item of [...room.doors, ...room.props]) {
    if (ids.has(item.id)) errors.push(`duplicate object id '${item.id}'`);
    ids.add(item.id);
  }
  for (const door of room.doors) {
    const type = metrics.types[door.type];
    if (!type || type.kind !== 'opening') {
      errors.push(`door '${door.id}' has unknown opening type '${door.type}'`);
      continue;
    }
    const wallLength = ['north', 'south'].includes(door.wall) ? room.dimensions.width : room.dimensions.length;
    const halfWidth = type.dimensions[0] / 2;
    if (door.position - halfWidth < 0 || door.position + halfWidth > wallLength) errors.push(`door '${door.id}' exceeds its ${door.wall} wall`);
    if (type.dimensions[2] > room.dimensions.height) errors.push(`door '${door.id}' exceeds room height`);
  }
  const boxes = [];
  for (const prop of room.props) {
    const type = metrics.types[prop.type];
    if (!type || type.kind !== 'structural_prop') {
      errors.push(`prop '${prop.id}' has unknown structural type '${prop.type}'`);
      continue;
    }
    const box = aabb(prop, type);
    if (box.minX < 0 || box.maxX > room.dimensions.width || box.minY < 0 || box.maxY > room.dimensions.length) errors.push(`prop '${prop.id}' exceeds room footprint`);
    for (const prior of boxes) if (overlaps(box, prior)) errors.push(`props '${prior.id}' and '${prop.id}' overlap`);
    boxes.push(box);
  }
  return errors;
}

export function makeBuildPlan(room, style, metrics) {
  const { width, length, height } = room.dimensions;
  const horizontalSpan = ['north', 'south'].includes(room.camera.facing) ? width : length;
  const verticalSpan = Math.max(height, horizontalSpan * 9 / 16);
  const fovRadians = metrics.camera.fov_degrees * Math.PI / 180;
  const desiredDistance = (verticalSpan / 2) / Math.tan(fovRadians / 2) * (1 + metrics.camera.framing_margin);
  const availableDepth = ['north', 'south'].includes(room.camera.facing) ? length : width;
  const distance = Math.min(desiredDistance, availableDepth / 2 - metrics.wall_thickness * 2);
  const centre = [width / 2, length / 2, metrics.camera.height];
  const direction = { north: [0, -1], south: [0, 1], east: [-1, 0], west: [1, 0] }[room.camera.facing];
  const camera = [centre[0] + direction[0] * distance, centre[1] + direction[1] * distance, metrics.camera.height];
  return {
    build_schema_version: 1,
    unit: metrics.unit,
    room,
    style,
    constants: { wall_thickness: metrics.wall_thickness, lighting: metrics.lighting },
    resolved: {
      camera: {
        position: camera.map(round), target: centre.map(round),
        fov_degrees: metrics.camera.fov_degrees,
        pitch_degrees: metrics.camera.pitch_degrees,
        roll_degrees: metrics.camera.roll_degrees
      },
      doors: room.doors.map((door) => ({ ...door, dimensions: metrics.types[door.type].dimensions })),
      props: room.props.map((prop, index) => ({ ...prop, dimensions: metrics.types[prop.type].dimensions, segmentation_id: index + 10 }))
    }
  };
}

async function loadSources() {
  const [roomSchema, styleSchema, metrics] = await Promise.all([
    readJson(path.join(PIPELINE, 'schemas/room.schema.json')),
    readJson(path.join(PIPELINE, 'schemas/style.schema.json')),
    readJson(path.join(PIPELINE, 'catalog/metrics.json'))
  ]);
  const roomFiles = (await fs.readdir(path.join(PIPELINE, 'rooms'))).filter((f) => f.endsWith('.json')).sort();
  const styleFiles = (await fs.readdir(path.join(PIPELINE, 'styles'))).filter((f) => f.endsWith('.json')).sort();
  const rooms = await Promise.all(roomFiles.map(async (name) => [name, await readJson(path.join(PIPELINE, 'rooms', name))]));
  const styles = new Map(await Promise.all(styleFiles.map(async (name) => {
    const value = await readJson(path.join(PIPELINE, 'styles', name));
    return [value.id, { name, value }];
  })));
  return { roomSchema, styleSchema, metrics, rooms, styles };
}

async function validateAll() {
  const sources = await loadSources();
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validateRoom = ajv.compile(sources.roomSchema);
  const validateStyle = ajv.compile(sources.styleSchema);
  const failures = [];
  for (const { name, value } of sources.styles.values()) if (!validateStyle(value)) failures.push(`${name}: ${ajv.errorsText(validateStyle.errors)}`);
  for (const [name, room] of sources.rooms) {
    if (!validateRoom(room)) { failures.push(`${name}: ${ajv.errorsText(validateRoom.errors)}`); continue; }
    const style = sources.styles.get(room.style_profile)?.value;
    if (!style) { failures.push(`${name}: missing style '${room.style_profile}'`); continue; }
    failures.push(...validateMetricScene(room, style, sources.metrics).map((error) => `${name}: ${error}`));
  }
  if (failures.length) throw new Error(failures.join('\n'));
  return sources;
}

async function planAll(sources) {
  for (const [roomFile, room] of sources.rooms) {
    const styleEntry = sources.styles.get(room.style_profile);
    const plan = makeBuildPlan(room, styleEntry.value, sources.metrics);
    const sourceFiles = {
      room: `rooms/${roomFile}`,
      style: `styles/${styleEntry.name}`,
      metrics: 'catalog/metrics.json'
    };
    const sourceHashes = {};
    for (const [key, relative] of Object.entries(sourceFiles)) sourceHashes[key] = hash(await fs.readFile(path.join(PIPELINE, relative)));
    const outputDir = path.join(PIPELINE, 'build', room.id);
    await fs.mkdir(outputDir, { recursive: true });
    const planText = `${JSON.stringify(plan, null, 2)}\n`;
    await fs.writeFile(path.join(outputDir, 'plan.json'), planText);
    await fs.writeFile(path.join(outputDir, 'metadata.json'), `${JSON.stringify({
      metadata_schema_version: 1,
      room_id: room.id,
      source_files: sourceFiles,
      source_sha256: sourceHashes,
      plan_sha256: hash(planText),
      renderer: { name: 'Blender', version: null },
      diffusion: null
    }, null, 2)}\n`);
    console.log(`planned ${room.id}`);
  }
}

async function main() {
  const command = process.argv[2] ?? 'validate';
  if (!['validate', 'plan'].includes(command)) throw new Error(`usage: node tools/metric-asset-builder.mjs [validate|plan]`);
  const sources = await validateAll();
  console.log(`validated ${sources.rooms.length} room(s) and ${sources.styles.size} style(s)`);
  if (command === 'plan') await planAll(sources);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
