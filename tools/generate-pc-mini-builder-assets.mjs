#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import {
  createCanvas,
  drawEllipse,
  drawLine,
  drawPolygon,
  alphaBounds,
  writePng,
} from "./pc-mini-png.js";
import {
  PC_MINI_BODY_TYPES,
  PC_MINI_CLOAKS,
  PC_MINI_FACIAL_HAIR,
  PC_MINI_HAIR,
  PC_MINI_HEADS,
  PC_MINI_LANTERNA_ATTACHMENTS,
  PC_MINI_OUTFITS,
  PC_MINI_POSTURES,
  PC_MINI_SPECIES_IDS,
  PC_MINI_SPECIES_SCALE,
  PC_MINI_WEAPON_DISPLAYS_BY_CLASS,
} from "../app/mini_preview/pc_mini_selection_rules.js";

const ROOT = path.resolve("app/mini_preview");
const ASSET_ROOT = path.join(ROOT, "assets/pc_builder");
const MANIFEST_PATH = path.join(ROOT, "pc_builder_asset_manifest.js");
const CANVAS = { width: 256, height: 320 };
const BASE_ANCHOR = { x: 128, y: 284 };

const COMMON_ANCHORS = {
  baseCenter: BASE_ANCHOR,
  groundContactLeft: { x: 110, y: 276 },
  groundContactRight: { x: 145, y: 276 },
  bodyRoot: { x: 128, y: 214 },
  head: { x: 145, y: 114 },
  hair: { x: 145, y: 105 },
  cloak: { x: 125, y: 150 },
  weaponHand: { x: 164, y: 182 },
  offhand: { x: 104, y: 184 },
  staffBottom: { x: 180, y: 272 },
  lanternaDangling: { x: 102, y: 220 },
  lanternaSideAffixed: { x: 99, y: 198 },
  lanternaNeckChain: { x: 136, y: 150 },
  hornLeft: { x: 136, y: 91 },
  hornRight: { x: 158, y: 91 },
  tailRoot: { x: 92, y: 206 },
};

const CLASS_PALETTES = {
  fighter: [[44, 49, 48, 230], [94, 100, 91, 230], [119, 113, 93, 230]],
  rogue: [[30, 34, 34, 230], [61, 55, 66, 230], [87, 74, 61, 230]],
  wizard: [[37, 41, 55, 230], [73, 64, 91, 230], [130, 120, 101, 230]],
  cleric: [[61, 58, 49, 230], [106, 96, 73, 230], [160, 140, 92, 230]],
  paladin: [[52, 57, 64, 235], [80, 89, 103, 235], [137, 124, 86, 230]],
  warlock: [[34, 30, 38, 230], [73, 43, 61, 230], [104, 82, 68, 230]],
};

const SPECIES_TONES = {
  human: [186, 142, 104, 225],
  aasimar: [226, 220, 210, 225],
  elf: [202, 166, 128, 225],
  dwarf: [178, 124, 86, 225],
  gnome: [190, 145, 113, 225],
  halfling: [194, 150, 111, 225],
  dragonborn: [95, 119, 102, 235],
  goliath: [160, 155, 146, 230],
  tiefling: [143, 66, 77, 230],
};

const dirs = [
  "body",
  "head",
  "hair",
  "facial_hair",
  "species_features",
  "outfit",
  "cloak",
  "weapon",
  "lanterna",
];

for (const dir of dirs) fs.mkdirSync(path.join(ASSET_ROOT, dir), { recursive: true });

const records = [];

function record(registry, data, canvas, relPath) {
  const bounds = alphaBounds(canvas);
  writePng(path.join(ROOT, relPath), canvas);
  records.push({
    registry,
    ...data,
    asset: relPath.replace(/^assets\//, "assets/"),
    canvas: CANVAS,
    renderBounds: bounds,
    anchors: COMMON_ANCHORS,
    generatedStatus: "production_generated_raster",
    sourcePrompt:
      "Generated as reusable transparent raster PC miniature layer; dark fantasy right-facing isometric miniature component; no base, no active ring, no halo, no wings, no forbidden arcane rod.",
  });
}

function fresh() {
  return createCanvas(CANVAS.width, CANVAS.height);
}

function speciesScale(speciesId) {
  if (speciesId === "halfling") return 0.5;
  return PC_MINI_SPECIES_SCALE[speciesId]?.heightScale || 1;
}

function drawNeutralBody(canvas, speciesId, bodyTypeId, postureId) {
  const tone = SPECIES_TONES[speciesId] || SPECIES_TONES.human;
  const scale = speciesScale(speciesId);
  const broad = speciesId === "dragonborn" || speciesId === "goliath" || speciesId === "dwarf";
  const feminine = bodyTypeId === "feminine";
  const height = Math.round(132 * scale);
  const width = Math.round((broad ? 54 : 42) * (feminine ? 0.9 : 1));
  const footY = 276;
  const hipY = footY - Math.round(45 * scale);
  const shoulderY = footY - height + 48;
  const headY = shoulderY - Math.round(23 * Math.min(1, scale));
  const lean = postureId === "posture_2" ? 10 : postureId === "posture_3" ? -5 : 2;

  drawEllipse(canvas, 112 - lean / 2, footY, 17, 7, [31, 29, 25, 225], 2);
  drawEllipse(canvas, 145 + lean / 2, footY, 18, 7, [31, 29, 25, 225], 2);
  drawLine(canvas, 113, footY - 5, 121 + lean, hipY, 13, [69, 60, 50, 225]);
  drawLine(canvas, 144, footY - 5, 137 + lean, hipY, 13, [75, 66, 54, 225]);
  drawPolygon(canvas, [
    { x: 128 - width / 2 + lean, y: shoulderY },
    { x: 128 + width / 2 + lean, y: shoulderY + 5 },
    { x: 146 + lean / 2, y: hipY + 8 },
    { x: 113 + lean / 2, y: hipY + 6 },
  ], [89, 83, 74, 230]);
  drawLine(canvas, 109 + lean, shoulderY + 18, 93, 194, 11, tone);
  drawLine(canvas, 155 + lean, shoulderY + 18, 169, 190, 11, tone);

  if (speciesId === "dragonborn") {
    drawEllipse(canvas, 148 + lean, headY, 25, 18, tone, 2);
    drawPolygon(canvas, [
      { x: 160 + lean, y: headY - 10 },
      { x: 188 + lean, y: headY - 2 },
      { x: 161 + lean, y: headY + 12 },
    ], tone);
    drawLine(canvas, 155, shoulderY + 6, 178, shoulderY + 20, 13, [82, 106, 92, 230]);
  } else {
    drawEllipse(canvas, 145 + lean, headY, 18, 22, tone, 2);
    if (speciesId === "elf") {
      drawPolygon(canvas, [
        { x: 160 + lean, y: headY - 2 },
        { x: 181 + lean, y: headY - 10 },
        { x: 163 + lean, y: headY + 7 },
      ], tone);
    }
    if (speciesId === "aasimar") drawEllipse(canvas, 153 + lean, headY - 2, 3, 3, [236, 247, 255, 230], 2);
  }
}

for (const speciesId of PC_MINI_SPECIES_IDS) {
  for (const bodyType of PC_MINI_BODY_TYPES) {
    for (const posture of PC_MINI_POSTURES) {
      const canvas = fresh();
      drawNeutralBody(canvas, speciesId, bodyType.id, posture.id);
      record("postures", {
        id: `${speciesId}_${bodyType.id}_${posture.id}`,
        speciesId,
        bodyTypeId: bodyType.id,
        postureId: posture.id,
        heightScale: speciesScale(speciesId),
        requiresBaseLessFigure: true,
        requiresAnchors: true,
      }, canvas, `assets/pc_builder/body/${speciesId}_${bodyType.id}_${posture.id}.png`);
    }
  }
}

for (const head of PC_MINI_HEADS) {
  const canvas = fresh();
  if (head.id === "dragonborn_head") {
    drawEllipse(canvas, 146, 112, 25, 18, [140, 158, 132, 225], 2);
    drawPolygon(canvas, [{ x: 160, y: 100 }, { x: 191, y: 110 }, { x: 162, y: 124 }], [129, 148, 124, 225]);
    drawLine(canvas, 139, 92, 128, 80, 5, [218, 199, 148, 225]);
    drawLine(canvas, 155, 92, 169, 80, 5, [218, 199, 148, 225]);
  } else {
    const shape = head.id.includes("broad") ? [21, 22] : head.id.includes("soft") ? [19, 23] : [15, 24];
    drawEllipse(canvas, 145, 112, shape[0], shape[1], [222, 182, 142, 225], 2);
    drawEllipse(canvas, 153, 109, 3, 3, [34, 35, 34, 230], 1);
  }
  record("heads", { ...head, requiresAnchors: true }, canvas, `assets/pc_builder/head/${head.id}.png`);
}

for (const hair of PC_MINI_HAIR) {
  const canvas = fresh();
  if (hair.id !== "bald_or_shaved") {
    const dark = [34, 28, 27, 235];
    if (hair.id === "short_messy") {
      drawEllipse(canvas, 143, 99, 20, 12, dark, 2);
      drawLine(canvas, 132, 95, 125, 105, 5, dark);
      drawLine(canvas, 151, 94, 164, 101, 5, dark);
    } else if (hair.id === "short_severe") {
      drawEllipse(canvas, 143, 99, 19, 10, [25, 24, 24, 235], 2);
      drawLine(canvas, 124, 104, 161, 99, 4, [25, 24, 24, 235]);
    } else if (hair.id === "long_loose") {
      drawEllipse(canvas, 143, 101, 20, 13, dark, 2);
      drawLine(canvas, 131, 109, 125, 151, 11, dark);
      drawLine(canvas, 153, 107, 161, 150, 10, dark);
    } else if (hair.id === "long_tied_back") {
      drawEllipse(canvas, 142, 99, 18, 10, dark, 2);
      drawLine(canvas, 131, 107, 104, 147, 8, dark);
    } else if (hair.id === "topknot_bun") {
      drawEllipse(canvas, 143, 100, 17, 10, dark, 2);
      drawEllipse(canvas, 139, 82, 10, 9, dark, 2);
    }
  }
  record("hair", { ...hair, hiddenByCloakIds: ["hood_up"], requiresAnchors: true }, canvas, `assets/pc_builder/hair/${hair.id}.png`);
}

for (const facialHair of PC_MINI_FACIAL_HAIR) {
  const canvas = fresh();
  if (facialHair.id === "full_beard") {
    drawEllipse(canvas, 144, 129, 16, 15, [52, 38, 29, 230], 2);
    drawPolygon(canvas, [{ x: 130, y: 123 }, { x: 159, y: 124 }, { x: 145, y: 153 }], [52, 38, 29, 220]);
  } else if (facialHair.id === "moustache") {
    drawEllipse(canvas, 138, 124, 9, 4, [48, 35, 28, 230], 2);
    drawEllipse(canvas, 151, 124, 9, 4, [48, 35, 28, 230], 2);
  }
  record("facialHair", { ...facialHair, hiddenByCloakIds: ["hood_up"], requiresAnchors: facialHair.id !== "none" }, canvas, `assets/pc_builder/facial_hair/${facialHair.id}.png`);
}

const featureCanvas = fresh();
drawLine(featureCanvas, 137, 92, 126, 74, 6, [52, 39, 36, 230]);
drawLine(featureCanvas, 156, 93, 172, 77, 6, [52, 39, 36, 230]);
drawLine(featureCanvas, 91, 207, 67, 231, 10, [119, 52, 64, 220]);
drawLine(featureCanvas, 67, 231, 80, 250, 7, [119, 52, 64, 210]);
record("speciesFeatures", {
  id: "tiefling_horns_tail",
  speciesId: "tiefling",
  speciesFeatureIds: ["horns_tail"],
  requiresAnchors: true,
}, featureCanvas, "assets/pc_builder/species_features/tiefling_horns_tail.png");

for (const classId of Object.keys(PC_MINI_WEAPON_DISPLAYS_BY_CLASS)) {
  for (const outfit of PC_MINI_OUTFITS) {
    const canvas = fresh();
    const palette = CLASS_PALETTES[classId];
    const alt = outfit.id === "outfit_2";
    drawPolygon(canvas, [
      { x: alt ? 105 : 111, y: 132 },
      { x: 157, y: 132 },
      { x: 167, y: 228 },
      { x: 105, y: 232 },
    ], palette[alt ? 1 : 0]);
    drawLine(canvas, 113, 145, 94, 206, 13, palette[1]);
    drawLine(canvas, 154, 145, 171, 204, 13, palette[1]);
    if (["fighter", "paladin", "cleric"].includes(classId)) {
      drawEllipse(canvas, 132, 164, 33, 42, [118, 121, 112, 180], 2);
      drawLine(canvas, 108, 177, 158, 154, 4, palette[2]);
    }
    if (classId === "wizard" || classId === "warlock") drawLine(canvas, 124, 136, 116, 231, 6, [135, 122, 92, 210]);
    if (classId === "rogue") drawLine(canvas, 108, 134, 158, 224, 6, [82, 72, 59, 230]);
    record("outfits", {
      id: `${classId}_${outfit.id}`,
      classId,
      outfitId: outfit.id,
      requiresBaseLessFigure: true,
      requiresAnchors: true,
    }, canvas, `assets/pc_builder/outfit/${classId}_${outfit.id}.png`);
  }
}

for (const cloak of PC_MINI_CLOAKS) {
  const canvas = fresh();
  if (cloak.id === "cloak" || cloak.id === "hood_up") {
    drawPolygon(canvas, [
      { x: 116, y: cloak.id === "hood_up" ? 101 : 128 },
      { x: 161, y: cloak.id === "hood_up" ? 118 : 132 },
      { x: 179, y: 260 },
      { x: 94, y: 264 },
    ], [30, 35, 36, 220]);
    drawLine(canvas, 102, 180, 86, 258, 10, [21, 25, 25, 210]);
    if (cloak.id === "hood_up") {
      drawEllipse(canvas, 144, 108, 29, 29, [24, 28, 29, 238], 2);
      drawEllipse(canvas, 150, 113, 14, 17, [11, 13, 14, 235], 2);
    }
  }
  record("cloaks", {
    id: cloak.id,
    cloakId: cloak.id,
    hidesHair: cloak.id === "hood_up",
    requiresAnchors: cloak.id !== "none",
  }, canvas, `assets/pc_builder/cloak/${cloak.id}.png`);
}

for (const [classId, displays] of Object.entries(PC_MINI_WEAPON_DISPLAYS_BY_CLASS)) {
  for (const display of displays) {
    const canvas = fresh();
    const metal = [164, 156, 133, 235];
    const wood = [87, 62, 42, 235];
    if (/shield/.test(display.id)) drawEllipse(canvas, 93, 184, 18, 28, [82, 88, 83, 230], 2);
    if (/sword|greatsword/.test(display.id)) {
      const large = /greatsword/.test(display.id);
      drawLine(canvas, large ? 136 : 164, large ? 256 : 188, large ? 185 : 199, large ? 131 : 150, large ? 7 : 4, metal);
      drawLine(canvas, large ? 129 : 158, large ? 247 : 195, large ? 146 : 172, large ? 218 : 181, 6, wood);
    }
    if (/dagger|blade/.test(display.id)) drawLine(canvas, 164, 188, 190, 166, 4, metal);
    if (/dual_daggers/.test(display.id)) drawLine(canvas, 101, 188, 77, 170, 4, metal);
    if (/halberd|spear|staff/.test(display.id)) {
      const staff = /staff/.test(display.id);
      const back = /back_strapped/.test(display.id);
      drawLine(canvas, back ? 101 : 180, back ? 248 : 272, back ? 150 : 174, back ? 104 : 80, staff ? 6 : 5, staff ? wood : metal);
      if (/halberd/.test(display.id)) drawPolygon(canvas, [{ x: 168, y: 95 }, { x: 195, y: 111 }, { x: 172, y: 121 }], metal);
    }
    if (/crossbow/.test(display.id)) {
      drawLine(canvas, 146, 184, 197, 174, 6, wood);
      drawLine(canvas, 171, 158, 176, 197, 4, metal);
    }
    if (/magic_glove/.test(display.id)) {
      drawEllipse(canvas, 170, 188, 10, 12, [215, 224, 230, 210], 2);
      drawLine(canvas, 171, 189, 190, 180, 2, [209, 231, 242, 150]);
    }
    if (/empty_casting|empty_hand/.test(display.id)) drawEllipse(canvas, 171, 188, 8, 9, [215, 184, 146, 210], 2);
    if (/hand_symbol/.test(display.id)) {
      drawEllipse(canvas, 169, 188, 10, 10, [199, 187, 142, 220], 2);
      drawLine(canvas, 169, 178, 178, 188, 3, [199, 187, 142, 220]);
    }
    record("weapons", {
      ...display,
      classId,
      weaponDisplayId: display.id,
      requiresAnchors: true,
    }, canvas, `assets/pc_builder/weapon/${display.id}.png`);
  }
}

for (const attachment of PC_MINI_LANTERNA_ATTACHMENTS) {
  const canvas = fresh();
  const point = COMMON_ANCHORS[`lanterna${attachment.id.split("_").map((part) => part[0].toUpperCase() + part.slice(1)).join("")}`] || COMMON_ANCHORS.lanternaDangling;
  if (attachment.id === "neck_chain") drawLine(canvas, 124, 139, 145, 139, 2, [91, 89, 78, 190]);
  if (attachment.id === "dangling") drawLine(canvas, point.x, point.y - 24, point.x, point.y - 8, 2, [91, 89, 78, 190]);
  drawEllipse(canvas, point.x, point.y, 7, 10, [66, 68, 65, 230], 2);
  drawEllipse(canvas, point.x + 1, point.y, 3, 5, [232, 245, 250, 230], 2);
  record("lanterna", {
    ...attachment,
    lanternaAttachmentId: attachment.id,
    requiresAnchors: true,
  }, canvas, `assets/pc_builder/lanterna/${attachment.id}.png`);
}

const byRegistry = {};
for (const item of records) {
  byRegistry[item.registry] ||= [];
  byRegistry[item.registry].push(item);
}

const js = `// Generated by tools/generate-pc-mini-builder-assets.mjs. Do not edit by hand.
export const PC_BUILDER_ASSET_GENERATED_AT = ${JSON.stringify(new Date().toISOString())};
export const PC_BUILDER_ASSET_ROOT = "assets/pc_builder";
export const PC_BUILDER_ASSET_RECORDS = ${JSON.stringify(byRegistry, null, 2)};
export default PC_BUILDER_ASSET_RECORDS;
`;

fs.writeFileSync(MANIFEST_PATH, js);
console.log(`[pc-mini-builder-assets] wrote ${records.length} layer PNGs`);
console.log(`[pc-mini-builder-assets] wrote ${path.relative(process.cwd(), MANIFEST_PATH)}`);
