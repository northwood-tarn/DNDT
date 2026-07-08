import { CLASSES } from "../data/classes.js";
import { SPECIES } from "../data/species.js";
import { createGridProjectionFromStage } from "../combat/stageMetadata.js";
import { projectCellPolygon, projectGridPoint } from "../combat/isometricGrid.js";
import {
  DEFAULT_MINI_BASE_SELECTION,
  MINI_BASE_METALS,
  MINI_BASE_RUNTIME_FOOTPRINT,
} from "./base_asset_manifest.js";
import { MINI_LAYER_KIND } from "./pc_mini_asset_registry.js";
import { PC_MINI_TINTS, resolvePcMiniLayerPlan } from "./pc_mini_compositor.js";
import {
  PC_MINI_BODY_TYPES,
  PC_MINI_CLOAKS,
  PC_MINI_FACIAL_HAIR,
  PC_MINI_HAIR,
  PC_MINI_HEADS,
  PC_MINI_LANTERNA_ATTACHMENTS,
  PC_MINI_OUTFITS,
  PC_MINI_POSTURES,
  PC_MINI_SKIN_TONES,
  PC_MINI_SPECIES_IDS,
  PC_MINI_WEAPON_DISPLAYS_BY_CLASS,
} from "./pc_mini_selection_rules.js";

const els = Object.fromEntries([...document.querySelectorAll("select, input, button, canvas, #status, #customBaseFields")]
  .map((el) => [el.id, el]));

const STAGE = {
  image: { width: 1920, height: 1080 },
  grid: { tileWidth: 128, tileHeight: 64, origin: { x: 960, y: 120 }, width: 14, height: 10 },
};
const projection = createGridProjectionFromStage(STAGE);
const previewScale = els.gridCanvas.width / STAGE.image.width;
const imageCache = new Map();

const state = {
  classId: "fighter",
  speciesId: "human",
  lineageId: undefined,
  bodyTypeId: "masculine",
  skinToneId: "human_brown",
  speciesFeatureIds: [],
  postureId: "posture_1",
  outfitId: "outfit_1",
  cloakId: "none",
  headId: "humanlike_narrow_severe",
  hairId: "short_messy",
  facialHairId: "none",
  weaponDisplayId: "fighter_1_primary_sword",
  weaponSlotId: "main",
  lanternaAttachmentId: "dangling",
  base: structuredClone(DEFAULT_MINI_BASE_SELECTION),
};

init();

function init() {
  fillSelect(els.speciesId, PC_MINI_SPECIES_IDS.map((id) => ({ id, label: SPECIES[id]?.name || id })));
  fillSelect(els.bodyTypeId, PC_MINI_BODY_TYPES.map((item) => ({ ...item, label: item.id === "masculine" ? "Masculine" : "Feminine" })));
  fillSelect(els.postureId, PC_MINI_POSTURES.map((item) => ({
    ...item,
    label: item.id === "posture_1" ? "Balanced ready" : item.id === "posture_2" ? "Forward intent" : "Guarded",
  })));
  fillSelect(els.classId, Object.keys(CLASSES).map((id) => ({ id, label: CLASSES[id].name || id })));
  fillSelect(els.outfitId, PC_MINI_OUTFITS);
  fillSelect(els.cloakId, PC_MINI_CLOAKS);
  fillSelect(els.lanternaAttachmentId, PC_MINI_LANTERNA_ATTACHMENTS.map(shortLanternaLabel));
  fillSelect(els.baseDisc, MINI_BASE_METALS);
  fillSelect(els.baseRim, MINI_BASE_METALS);
  els.baseDisc.value = DEFAULT_MINI_BASE_SELECTION.fallbackCustomBase.disc;
  els.baseRim.value = DEFAULT_MINI_BASE_SELECTION.fallbackCustomBase.rim;
  for (const el of Object.values(els)) {
    if (el instanceof HTMLSelectElement || el instanceof HTMLInputElement) el.addEventListener("change", onInput);
  }
  els.exportPng.addEventListener("click", exportPng);
  els.exportManifest.addEventListener("click", exportManifest);
  syncControls();
  drawGrid();
  render();
}

function onInput(event) {
  const id = event.target.id;
  if (id === "useUniqueBase") {
    state.base = event.target.checked
      ? structuredClone(DEFAULT_MINI_BASE_SELECTION)
      : { useUniqueBase: false, disc: els.baseDisc.value, rim: els.baseRim.value };
  } else if (id === "baseDisc" || id === "baseRim") {
    state.base = { useUniqueBase: false, disc: els.baseDisc.value, rim: els.baseRim.value };
  } else if (id === "speciesFeatureMode") {
    state.speciesFeatureIds = event.target.value === "horns_tail" ? ["horns_tail"] : [];
  } else {
    state[id] = event.target.value;
  }
  syncControls();
  render();
}

function syncControls() {
  const messages = [];
  const lineageIds = Object.keys(SPECIES[state.speciesId]?.lineages || {});
  const lineageSpecies = ["dragonborn", "tiefling"].includes(state.speciesId);

  if (lineageIds.length && !lineageIds.includes(state.lineageId)) {
    state.lineageId = lineageIds[0];
    messages.push("Lineage corrected.");
  }
  if (!lineageIds.length) state.lineageId = undefined;
  if (lineageSpecies) delete state.skinToneId;
  else if (!state.skinToneId) state.skinToneId = state.speciesId === "aasimar" ? "aasimar_pale" : "human_brown";

  if (state.speciesId === "dragonborn") {
    state.headId = "dragonborn_head";
    state.hairId = null;
  } else {
    const legalHeads = legalHeadsForSpecies();
    if (!legalHeads.some((head) => head.id === state.headId)) state.headId = legalHeads[0].id;
    if (!state.hairId) state.hairId = "short_messy";
  }
  if (state.speciesId === "aasimar") state.facialHairId = "none";

  const display = PC_MINI_WEAPON_DISPLAYS_BY_CLASS[state.classId].find((item) => item.id === state.weaponDisplayId)
    || PC_MINI_WEAPON_DISPLAYS_BY_CLASS[state.classId][0];
  if (display.id !== state.weaponDisplayId) messages.push("Weapon display corrected.");
  state.weaponDisplayId = display.id;
  state.weaponSlotId = display.slot;

  fillSelect(els.lineageId, lineageIds.map((id) => ({ id, label: SPECIES[state.speciesId].lineages[id].name || id })));
  fillSelect(els.skinToneId, legalSkinTones());
  fillSelect(els.headId, legalHeadsForSpecies().map(shortHeadLabel));
  fillSelect(els.hairId, state.speciesId === "dragonborn" ? [] : PC_MINI_HAIR);
  fillSelect(els.facialHairId, legalFacialHair());
  fillSelect(els.speciesFeatureMode, state.speciesId === "tiefling"
    ? [{ id: "none", label: "No horns or tail" }, { id: "horns_tail", label: "Horns and tail" }]
    : [{ id: "none", label: "None" }]);
  fillSelect(els.weaponDisplayId, PC_MINI_WEAPON_DISPLAYS_BY_CLASS[state.classId]);

  setValue("speciesId", state.speciesId);
  setValue("bodyTypeId", state.bodyTypeId);
  setValue("lineageId", state.lineageId);
  setValue("skinToneId", state.skinToneId);
  setValue("headId", state.headId);
  setValue("hairId", state.hairId);
  setValue("facialHairId", state.facialHairId);
  setValue("speciesFeatureMode", state.speciesFeatureIds.includes("horns_tail") ? "horns_tail" : "none");
  setValue("postureId", state.postureId);
  setValue("classId", state.classId);
  setValue("outfitId", state.outfitId);
  setValue("cloakId", state.cloakId);
  setValue("weaponDisplayId", state.weaponDisplayId);
  setValue("lanternaAttachmentId", state.lanternaAttachmentId);
  els.useUniqueBase.checked = Boolean(state.base.useUniqueBase);
  els.customBaseFields.hidden = state.base.useUniqueBase;
  if (!state.base.useUniqueBase) {
    setValue("baseDisc", state.base.disc);
    setValue("baseRim", state.base.rim);
  }

  document.querySelector("#lineageField").hidden = !lineageIds.length;
  document.querySelector("#skinField").hidden = lineageSpecies;
  document.querySelector("#hairField").hidden = state.speciesId === "dragonborn";
  document.querySelector("#facialHairField").hidden = state.speciesId === "aasimar";
  document.querySelector("#speciesFeatureField").hidden = state.speciesId !== "tiefling";
  els.status.textContent = messages.join(" ");
}

function legalSkinTones() {
  return PC_MINI_SKIN_TONES.filter((tone) => !tone.speciesOnly || tone.speciesOnly.includes(state.speciesId));
}

function legalHeadsForSpecies() {
  return PC_MINI_HEADS.filter((head) => head.compatibleSpecies?.includes(state.speciesId));
}

function legalFacialHair() {
  return PC_MINI_FACIAL_HAIR.filter((item) => !item.incompatibleSpecies?.includes(state.speciesId));
}

function shortHeadLabel(head) {
  const labels = {
    humanlike_narrow_severe: "Narrow severe",
    humanlike_broad_solid: "Broad solid",
    humanlike_soft_round: "Soft round",
    dragonborn_head: "Dragonborn",
  };
  return { ...head, label: labels[head.id] || head.label };
}

function shortLanternaLabel(item) {
  const labels = {
    dangling: "Dangling",
    side_affixed: "Side-affixed",
    neck_chain: "Neck-chain",
  };
  return { ...item, label: labels[item.id] || item.label };
}

function fillSelect(select, items) {
  select.replaceChildren(...items.map((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.label || item.name || item.id;
    return option;
  }));
}

function setValue(id, value) {
  if (els[id] && value !== undefined && value !== null) els[id].value = value;
}

function currentSelection() {
  const selection = structuredClone(state);
  if (!["dragonborn", "tiefling"].includes(selection.speciesId) && !selection.skinToneId) selection.skinToneId = "human_brown";
  if (["dragonborn", "tiefling"].includes(selection.speciesId)) delete selection.skinToneId;
  return selection;
}

function drawGrid() {
  const ctx = els.gridCanvas.getContext("2d");
  ctx.clearRect(0, 0, els.gridCanvas.width, els.gridCanvas.height);
  ctx.strokeStyle = "rgba(230, 219, 181, 0.2)";
  ctx.fillStyle = "rgba(255, 255, 255, 0.022)";
  for (let y = 0; y < STAGE.grid.height; y += 1) {
    for (let x = 0; x < STAGE.grid.width; x += 1) {
      const points = projectCellPolygon(projection, { x, y }).map(scalePoint);
      ctx.beginPath();
      points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
}

async function render() {
  const plan = resolvePcMiniLayerPlan(currentSelection());
  const ctx = els.miniCanvas.getContext("2d");
  ctx.clearRect(0, 0, els.miniCanvas.width, els.miniCanvas.height);
  if (!plan.ok) {
    els.status.textContent = plan.errors.join(" ");
    return;
  }
  const off = document.createElement("canvas");
  off.width = 256;
  off.height = 360;
  const offCtx = off.getContext("2d");
  for (const layer of plan.layers) {
    if (layer.hidden) continue;
    const img = await loadImage(layer.asset);
    if (layer.kind === MINI_LAYER_KIND.BASE) {
      const visible = MINI_BASE_RUNTIME_FOOTPRINT.visibleBounds;
      const sourceVisibleWidth = visible.right - visible.left;
      const scale = MINI_BASE_RUNTIME_FOOTPRINT.displayWidth / sourceVisibleWidth;
      const width = img.naturalWidth * scale;
      const height = img.naturalHeight * scale;
      const visibleCenter = { x: ((visible.left + visible.right) / 2) * scale, y: ((visible.top + visible.bottom) / 2) * scale };
      offCtx.drawImage(img, 128 - visibleCenter.x, 306 - visibleCenter.y, width, height);
    } else {
      const anchor = layer.anchors?.baseCenter || { x: 128, y: 284 };
      if (layer.tint) drawTinted(offCtx, img, 128 - anchor.x, 306 - anchor.y, layer.tint);
      else offCtx.drawImage(img, 128 - anchor.x, 306 - anchor.y);
    }
  }
  const stagePoint = scalePoint(projectGridPoint(projection, { x: 7.5, y: 5.5 }));
  ctx.drawImage(off, stagePoint.x - off.width / 2, stagePoint.y - 306 * previewScale - 6, off.width * previewScale, off.height * previewScale);
}

function drawTinted(ctx, img, x, y, tint) {
  const temp = document.createElement("canvas");
  temp.width = img.naturalWidth;
  temp.height = img.naturalHeight;
  const tempCtx = temp.getContext("2d");
  tempCtx.drawImage(img, 0, 0);
  tempCtx.globalCompositeOperation = "source-atop";
  const [r, g, b] = tint;
  tempCtx.fillStyle = `rgb(${r} ${g} ${b})`;
  tempCtx.fillRect(0, 0, temp.width, temp.height);
  ctx.drawImage(temp, x, y);
}

function loadImage(asset) {
  if (imageCache.has(asset)) return imageCache.get(asset);
  const promise = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = asset;
  });
  imageCache.set(asset, promise);
  return promise;
}

async function exportPng() {
  await render();
  const link = document.createElement("a");
  link.download = "pc-miniature.png";
  link.href = els.miniCanvas.toDataURL("image/png");
  link.click();
}

function exportManifest() {
  const plan = resolvePcMiniLayerPlan(currentSelection());
  const blob = new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.download = "pc-miniature-layer-plan.json";
  link.href = URL.createObjectURL(blob);
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function scalePoint(point) {
  return { x: point.x * previewScale, y: point.y * previewScale };
}
