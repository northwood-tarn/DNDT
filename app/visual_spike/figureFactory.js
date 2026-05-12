import * as PIXI from "../lib/pixi.mjs";

function drawWashBlob(g, cellSize, points, color, alpha) {
  if (!points.length) return;
  g.beginFill(color, alpha);
  g.moveTo(points[0][0] * cellSize, points[0][1] * cellSize);
  for (let i = 1; i < points.length; i += 3) {
    const c1 = points[i] || points[points.length - 1];
    const c2 = points[i + 1] || c1;
    const p = points[i + 2] || c2;
    g.bezierCurveTo(
      c1[0] * cellSize,
      c1[1] * cellSize,
      c2[0] * cellSize,
      c2[1] * cellSize,
      p[0] * cellSize,
      p[1] * cellSize
    );
  }
  g.closePath();
  g.endFill();
}

function inkCurve(g, cellSize, { points, width = 0.02, color = 0x000000, alpha = 0.5 }) {
  if (!points || points.length < 2) return;
  g.lineStyle(cellSize * width, color, alpha);
  g.moveTo(points[0][0] * cellSize, points[0][1] * cellSize);
  if (points.length >= 4) {
    g.bezierCurveTo(
      points[1][0] * cellSize,
      points[1][1] * cellSize,
      points[2][0] * cellSize,
      points[2][1] * cellSize,
      points[3][0] * cellSize,
      points[3][1] * cellSize
    );
  } else {
    for (let i = 1; i < points.length; i++) {
      g.lineTo(points[i][0] * cellSize, points[i][1] * cellSize);
    }
  }
}

export function createPlayerFigure(cellSize) {
  const root = new PIXI.Container();
  root.sortableChildren = true;
  root.pivot.set(0, cellSize * 0.3);

  const shadow = new PIXI.Graphics();
  for (const spec of [
    { points: [[-0.16, 0.62], [-0.02, 0.58]], width: 0.018, alpha: 0.14 },
    { points: [[-0.05, 0.64], [0.13, 0.6]], width: 0.014, alpha: 0.1 },
    { points: [[-0.24, 0.6], [-0.13, 0.58]], width: 0.01, alpha: 0.08 },
  ]) inkCurve(shadow, cellSize, spec);
  root.addChild(shadow);

  const glow = new PIXI.Graphics();
  glow.beginFill(0xffbd68, 0.032);
  glow.drawEllipse(cellSize * 0.08, cellSize * 0.15, cellSize * 0.86, cellSize * 0.42);
  glow.endFill();
  glow.beginFill(0xffcf86, 0.055);
  glow.drawEllipse(cellSize * 0.08, cellSize * 0.17, cellSize * 0.34, cellSize * 0.2);
  glow.endFill();
  glow.beginFill(0xffe1a6, 0.035);
  glow.drawPolygon([
    cellSize * -0.28, cellSize * 0.02,
    cellSize * 0.0, cellSize * -0.1,
    cellSize * 0.6, cellSize * 0.03,
    cellSize * 0.56, cellSize * 0.34,
    cellSize * 0.05, cellSize * 0.42,
    cellSize * -0.3, cellSize * 0.3,
  ]);
  glow.endFill();
  glow.zIndex = -2;
  root.addChild(glow);

  const wash = new PIXI.Container();
  wash.alpha = 0.98;

  const torsoWash = new PIXI.Graphics();
  drawWashBlob(torsoWash, cellSize, [
    [-0.045, -0.34],
    [-0.095, -0.12], [-0.085, 0.22], [-0.055, 0.54],
    [-0.01, 0.59], [0.045, 0.51], [0.055, 0.26],
    [0.065, 0.01], [0.045, -0.25], [0.0, -0.36],
  ], 0x000000, 0.42);
  wash.addChild(torsoWash);

  const torsoMarks = new PIXI.Graphics();
  for (const spec of [
    { points: [[-0.06, -0.31], [-0.08, -0.02], [-0.075, 0.28], [-0.05, 0.57]], width: 0.035, alpha: 0.72 },
    { points: [[-0.025, -0.34], [-0.035, -0.06], [-0.025, 0.25], [-0.015, 0.55]], width: 0.032, alpha: 0.86 },
    { points: [[0.025, -0.29], [0.05, -0.02], [0.035, 0.25], [0.025, 0.49]], width: 0.024, alpha: 0.66 },
    { points: [[0.07, -0.08], [0.075, 0.12], [0.055, 0.35], [0.04, 0.5]], width: 0.012, alpha: 0.42 },
  ]) inkCurve(torsoMarks, cellSize, spec);
  wash.addChild(torsoMarks);

  const trailingCloak = new PIXI.Container();
  for (const spec of [
    { points: [[-0.12, -0.22], [-0.25, 0.02], [-0.27, 0.3], [-0.22, 0.66]], width: 0.035, alpha: 0.46 },
    { points: [[-0.18, -0.04], [-0.3, 0.19], [-0.27, 0.44], [-0.31, 0.73]], width: 0.022, alpha: 0.34 },
    { points: [[-0.1, 0.03], [-0.17, 0.2], [-0.16, 0.42], [-0.12, 0.63]], width: 0.018, alpha: 0.3 },
  ]) {
    const stroke = new PIXI.Graphics();
    inkCurve(stroke, cellSize, spec);
    trailingCloak.addChild(stroke);
  }
  wash.addChild(trailingCloak);

  const liftedShoulder = new PIXI.Container();
  for (const spec of [
    { points: [[0.0, -0.33], [0.09, -0.24], [0.12, -0.09], [0.1, 0.07]], width: 0.028, alpha: 0.42 },
    { points: [[0.05, -0.22], [0.12, -0.07], [0.12, 0.12], [0.08, 0.27]], width: 0.016, alpha: 0.26 },
  ]) {
    const stroke = new PIXI.Graphics();
    inkCurve(stroke, cellSize, spec);
    liftedShoulder.addChild(stroke);
  }
  wash.addChild(liftedShoulder);

  const hoodVoid = new PIXI.Graphics();
  drawWashBlob(hoodVoid, cellSize, [
    [-0.105, -0.37],
    [-0.075, -0.5], [0.065, -0.49], [0.095, -0.37],
    [0.075, -0.265], [-0.015, -0.23], [-0.085, -0.27],
    [-0.13, -0.31], [-0.13, -0.35], [-0.105, -0.37],
  ], 0x000000, 0.78);
  wash.addChild(hoodVoid);

  const hoodMarks = new PIXI.Graphics();
  for (const spec of [
    { points: [[-0.12, -0.37], [-0.08, -0.5], [0.035, -0.5], [0.085, -0.39]], width: 0.018, alpha: 0.68 },
    { points: [[-0.095, -0.29], [-0.02, -0.23]], width: 0.01, alpha: 0.34 },
    { points: [[0.0, -0.27], [0.045, -0.275]], width: 0.007, color: 0xc29d5e, alpha: 0.18 },
  ]) inkCurve(hoodMarks, cellSize, spec);
  wash.addChild(hoodMarks);

  const cloakWisps = new PIXI.Container();
  const wispSpecs = [
    { x: -0.19, y: -0.08, a: 0.48, lw: 0.018, bend: -0.08 },
    { x: -0.11, y: -0.01, a: 0.44, lw: 0.014, bend: -0.04 },
    { x: -0.035, y: 0.02, a: 0.48, lw: 0.013, bend: -0.02 },
    { x: 0.055, y: 0.05, a: 0.38, lw: 0.011, bend: 0.025 },
    { x: 0.12, y: 0.12, a: 0.28, lw: 0.009, bend: 0.05 },
  ];
  wispSpecs.forEach((spec, i) => {
    const stroke = new PIXI.Graphics();
    stroke.lineStyle(cellSize * spec.lw, 0x000000, spec.a);
    stroke.moveTo(cellSize * spec.x, cellSize * spec.y);
    stroke.bezierCurveTo(
      cellSize * (spec.x + spec.bend),
      cellSize * 0.18,
      cellSize * (spec.x + spec.bend * 0.4),
      cellSize * 0.37,
      cellSize * (spec.x + (i % 2 ? 0.03 : -0.025)),
      cellSize * (0.62 + i * 0.025)
    );
    cloakWisps.addChild(stroke);
  });
  wash.addChild(cloakWisps);

  const dryBreaks = new PIXI.Graphics();
  dryBreaks.lineStyle(1, 0x5b5143, 0.2);
  for (const [x0, y0, x1, y1] of [
    [-0.23, 0.14, -0.2, 0.34],
    [-0.16, 0.02, -0.2, 0.2],
    [0.09, 0.08, 0.1, 0.25],
    [0.05, 0.3, 0.12, 0.44],
    [-0.045, 0.38, 0.055, 0.49],
    [-0.02, -0.15, 0.04, -0.05],
  ]) {
    dryBreaks.moveTo(x0 * cellSize, y0 * cellSize);
    dryBreaks.lineTo(x1 * cellSize, y1 * cellSize);
  }
  wash.addChild(dryBreaks);

  const feet = new PIXI.Graphics();
  feet.lineStyle(cellSize * 0.018, 0x000000, 0.58);
  feet.moveTo(-cellSize * 0.08, cellSize * 0.57);
  feet.lineTo(-cellSize * 0.24, cellSize * 0.63);
  feet.lineStyle(cellSize * 0.014, 0x000000, 0.42);
  feet.moveTo(cellSize * 0.025, cellSize * 0.54);
  feet.lineTo(cellSize * 0.15, cellSize * 0.61);
  wash.addChild(feet);

  root.addChild(wash);

  const lantern = new PIXI.Container();
  lantern.x = cellSize * 0.08;
  lantern.y = cellSize * 0.12;
  const chain = new PIXI.Graphics();
  chain.lineStyle(1, 0xe3c188, 0.28);
  chain.moveTo(-cellSize * 0.1, -cellSize * 0.14);
  chain.lineTo(-cellSize * 0.045, -cellSize * 0.08);
  chain.moveTo(-cellSize * 0.02, -cellSize * 0.055);
  chain.lineTo(cellSize * 0.014, -cellSize * 0.014);
  lantern.addChild(chain);

  const lampLight = new PIXI.Graphics();
  lampLight.beginFill(0xffc76f, 0.58);
  lampLight.drawEllipse(0, cellSize * 0.055, cellSize * 0.03, cellSize * 0.055);
  lampLight.endFill();
  lantern.addChild(lampLight);

  const lampDashes = new PIXI.Graphics();
  lampDashes.lineStyle(1.1, 0xf5d29a, 0.5);
  lampDashes.moveTo(-cellSize * 0.045, -cellSize * 0.01);
  lampDashes.lineTo(-cellSize * 0.03, cellSize * 0.14);
  lampDashes.moveTo(cellSize * 0.045, 0);
  lampDashes.lineTo(cellSize * 0.026, cellSize * 0.14);
  lampDashes.moveTo(-cellSize * 0.04, -cellSize * 0.01);
  lampDashes.lineTo(cellSize * 0.036, -cellSize * 0.002);
  lampDashes.moveTo(-cellSize * 0.03, cellSize * 0.14);
  lampDashes.lineTo(cellSize * 0.024, cellSize * 0.14);
  lampDashes.lineStyle(1, 0x3b2611, 0.82);
  lampDashes.moveTo(-cellSize * 0.015, cellSize * 0.02);
  lampDashes.lineTo(cellSize * 0.014, cellSize * 0.12);
  lantern.addChild(lampDashes);
  root.addChild(lantern);

  const swordArm = new PIXI.Container();
  swordArm.x = cellSize * 0.035;
  swordArm.y = -cellSize * 0.095;
  const swordSleeve = new PIXI.Graphics();
  for (const spec of [
    { points: [[-0.01, -0.03], [0.08, -0.02], [0.14, 0.03], [0.19, 0.08]], width: 0.023, alpha: 0.62 },
    { points: [[0.03, 0.0], [0.1, 0.025], [0.15, 0.065], [0.2, 0.1]], width: 0.012, alpha: 0.46 },
  ]) inkCurve(swordSleeve, cellSize, spec);
  swordArm.addChild(swordSleeve);

  const sword = new PIXI.Graphics();
  sword.lineStyle(cellSize * 0.011, 0xd6d0c0, 0.78);
  sword.moveTo(cellSize * 0.2, cellSize * 0.09);
  sword.lineTo(cellSize * 0.63, -cellSize * 0.15);
  sword.lineStyle(cellSize * 0.006, 0x675d51, 0.72);
  sword.moveTo(cellSize * 0.23, cellSize * 0.085);
  sword.lineTo(cellSize * 0.64, -cellSize * 0.145);
  sword.lineStyle(cellSize * 0.01, 0x17120d, 0.9);
  sword.moveTo(cellSize * 0.09, cellSize * 0.13);
  sword.lineTo(cellSize * 0.22, cellSize * 0.075);
  sword.lineStyle(cellSize * 0.006, 0xc5a875, 0.5);
  sword.moveTo(cellSize * 0.15, cellSize * 0.06);
  sword.lineTo(cellSize * 0.23, cellSize * 0.11);
  swordArm.addChild(sword);
  root.addChild(swordArm);

  root.parts = { glow, lantern, cloak: wash, hoodVoid, lampLight, swordArm, cloakWisps, trailingCloak, liftedShoulder };
  return root;
}

export function createShadowEnemy(cellSize, variant = 0) {
  const root = new PIXI.Container();
  root.pivot.set(0, cellSize * 0.3);

  const shadow = new PIXI.Graphics();
  shadow.beginFill(0x000000, 0.58);
  shadow.drawEllipse(0, cellSize * 0.53, cellSize * 0.42, cellSize * 0.13);
  shadow.endFill();
  root.addChild(shadow);

  const cutout = new PIXI.Graphics();
  cutout.beginFill(0x020203, 0.98);
  cutout.lineStyle(1.4, 0x000000, 0.9);
  cutout.moveTo(-cellSize * 0.22, cellSize * 0.47);
  cutout.lineTo(-cellSize * (variant ? 0.36 : 0.28), cellSize * 0.18);
  cutout.lineTo(-cellSize * 0.16, -cellSize * 0.2);
  cutout.lineTo(-cellSize * 0.05, -cellSize * 0.42);
  cutout.lineTo(cellSize * 0.11, -cellSize * 0.24);
  cutout.lineTo(cellSize * (variant ? 0.32 : 0.24), cellSize * 0.16);
  cutout.lineTo(cellSize * 0.2, cellSize * 0.48);
  cutout.closePath();
  cutout.endFill();
  root.addChild(cutout);

  const eye = new PIXI.Graphics();
  eye.beginFill(0xd7f6ff, 0.65);
  eye.drawEllipse(cellSize * 0.03, -cellSize * 0.18, cellSize * 0.035, cellSize * 0.014);
  eye.endFill();
  root.addChild(eye);

  const rim = new PIXI.Graphics();
  rim.lineStyle(1.2, 0x9fb8c3, 0.18);
  rim.moveTo(-cellSize * 0.18, cellSize * 0.42);
  rim.lineTo(-cellSize * 0.08, -cellSize * 0.31);
  rim.lineTo(cellSize * 0.16, cellSize * 0.4);
  root.addChild(rim);

  root.parts = { cutout, eye, rim };
  return root;
}

export function createTargetRing(cellSize, color = 0xffc15a) {
  const ring = new PIXI.Graphics();
  ring.lineStyle(2, color, 0.75);
  ring.drawEllipse(0, cellSize * 0.22, cellSize * 0.42, cellSize * 0.18);
  ring.lineStyle(1, 0xffffff, 0.24);
  ring.drawEllipse(0, cellSize * 0.22, cellSize * 0.32, cellSize * 0.12);
  return ring;
}
