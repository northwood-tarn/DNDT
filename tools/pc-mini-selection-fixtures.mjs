import { SPECIES } from "../app/data/species.js";
import { DEFAULT_MINI_BASE_SELECTION, MINI_BASE_METALS } from "../app/mini_preview/base_asset_manifest.js";
import {
  PC_MINI_BODY_TYPES,
  PC_MINI_CLASS_IDS,
  PC_MINI_CLOAKS,
  PC_MINI_FACIAL_HAIR,
  PC_MINI_HAIR,
  PC_MINI_HEADS,
  PC_MINI_LANTERNA_ATTACHMENTS,
  PC_MINI_OUTFITS,
  PC_MINI_POSTURES,
  PC_MINI_SPECIES_IDS,
  PC_MINI_WEAPON_DISPLAYS_BY_CLASS,
} from "../app/mini_preview/pc_mini_selection_rules.js";

export function makePcMiniSelection(overrides = {}) {
  const speciesId = overrides.speciesId || "human";
  const classId = overrides.classId || "fighter";
  const lineageIds = Object.keys(SPECIES[speciesId]?.lineages || {});
  const displays = PC_MINI_WEAPON_DISPLAYS_BY_CLASS[classId];
  const display = displays.find((item) => item.id === overrides.weaponDisplayId) || displays[0];
  const selection = {
    classId,
    speciesId,
    lineageId: lineageIds[0] || undefined,
    bodyTypeId: "masculine",
    skinToneId: speciesId === "aasimar" ? "aasimar_pale" : "human_brown",
    speciesFeatureIds: speciesId === "tiefling" ? ["horns_tail"] : [],
    postureId: "posture_1",
    outfitId: "outfit_1",
    cloakId: "none",
    headId: speciesId === "dragonborn" ? "dragonborn_head" : "humanlike_narrow_severe",
    hairId: speciesId === "dragonborn" ? null : "short_messy",
    facialHairId: "none",
    weaponSlotId: display.slot,
    weaponDisplayId: display.id,
    lanternaAttachmentId: "dangling",
    base: DEFAULT_MINI_BASE_SELECTION,
    ...overrides,
  };
  if (["dragonborn", "tiefling"].includes(selection.speciesId)) delete selection.skinToneId;
  if (selection.speciesId === "dragonborn") {
    selection.hairId = null;
    selection.headId = "dragonborn_head";
  }
  if (selection.speciesId === "aasimar") selection.facialHairId = "none";
  const finalDisplay = PC_MINI_WEAPON_DISPLAYS_BY_CLASS[selection.classId].find((item) => item.id === selection.weaponDisplayId)
    || PC_MINI_WEAPON_DISPLAYS_BY_CLASS[selection.classId][0];
  selection.weaponDisplayId = finalDisplay.id;
  selection.weaponSlotId = finalDisplay.slot;
  return selection;
}

export function makeMatrixSelections() {
  const selections = [];
  for (const speciesId of PC_MINI_SPECIES_IDS) selections.push([`species_${speciesId}`, makePcMiniSelection({ speciesId })]);
  for (const classId of PC_MINI_CLASS_IDS) selections.push([`class_${classId}`, makePcMiniSelection({ classId })]);
  for (const posture of PC_MINI_POSTURES) selections.push([posture.id, makePcMiniSelection({ postureId: posture.id })]);
  for (const lanterna of PC_MINI_LANTERNA_ATTACHMENTS) selections.push([`lanterna_${lanterna.id}`, makePcMiniSelection({ lanternaAttachmentId: lanterna.id })]);
  selections.push(["base_betrayers_coin", makePcMiniSelection({ base: DEFAULT_MINI_BASE_SELECTION })]);
  for (const [disc, rim] of [
    ["aged-gold", "blackened-iron"],
    ["gunmetal", "dull-silver"],
    ["metallic-green", "tarnished-brass"],
  ]) {
    selections.push([`base_${disc}_${rim}`, makePcMiniSelection({ base: { useUniqueBase: false, disc, rim } })]);
  }
  selections.push(["hood_up_hides_hair", makePcMiniSelection({ cloakId: "hood_up", hairId: "long_loose" })]);
  return selections;
}

export function makeRandomSelections(count = 40) {
  const rng = createRng(0x5eed40);
  const selections = [];
  for (let i = 0; i < count; i += 1) {
    const speciesId = i < PC_MINI_SPECIES_IDS.length ? PC_MINI_SPECIES_IDS[i] : pick(rng, PC_MINI_SPECIES_IDS);
    const classId = i < PC_MINI_CLASS_IDS.length ? PC_MINI_CLASS_IDS[i] : pick(rng, PC_MINI_CLASS_IDS);
    const lineageIds = Object.keys(SPECIES[speciesId]?.lineages || {});
    const displays = PC_MINI_WEAPON_DISPLAYS_BY_CLASS[classId];
    const display = displays[i % displays.length];
    const customBase = i % 3 !== 0;
    const disc = pick(rng, MINI_BASE_METALS).id;
    const rim = pick(rng, MINI_BASE_METALS).id;
    const hair = speciesId === "dragonborn" ? null : pick(rng, PC_MINI_HAIR).id;
    const facialHairPool = speciesId === "aasimar"
      ? PC_MINI_FACIAL_HAIR.filter((item) => item.id === "none")
      : PC_MINI_FACIAL_HAIR;
    selections.push(makePcMiniSelection({
      speciesId,
      classId,
      lineageId: lineageIds.length ? lineageIds[i % lineageIds.length] : undefined,
      bodyTypeId: PC_MINI_BODY_TYPES[i % PC_MINI_BODY_TYPES.length].id,
      skinToneId: speciesId === "aasimar" ? "aasimar_pale" : pick(rng, ["human_pale", "human_brown", "human_black"]),
      speciesFeatureIds: speciesId === "tiefling" ? (i % 2 ? ["horns_tail"] : []) : [],
      postureId: PC_MINI_POSTURES[i % PC_MINI_POSTURES.length].id,
      outfitId: PC_MINI_OUTFITS[i % PC_MINI_OUTFITS.length].id,
      cloakId: PC_MINI_CLOAKS[i % PC_MINI_CLOAKS.length].id,
      headId: speciesId === "dragonborn" ? "dragonborn_head" : pick(rng, PC_MINI_HEADS.filter((head) => head.id !== "dragonborn_head")).id,
      hairId: hair,
      facialHairId: pick(rng, facialHairPool).id,
      weaponDisplayId: display.id,
      lanternaAttachmentId: PC_MINI_LANTERNA_ATTACHMENTS[i % PC_MINI_LANTERNA_ATTACHMENTS.length].id,
      base: customBase ? { useUniqueBase: false, disc, rim } : DEFAULT_MINI_BASE_SELECTION,
    }));
  }
  return selections;
}

function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function pick(rng, items) {
  return items[Math.floor(rng() * items.length)];
}
