export function characterHasNarrativeAccess(sheet, requirement) {
  if (!requirement) return true;
  if (typeof requirement === "string") return hasSingleRequirement(sheet, { kind: "narrativeTag", id: requirement });
  if (Array.isArray(requirement)) return requirement.every((item) => characterHasNarrativeAccess(sheet, item));
  if (requirement.all) return requirement.all.every((item) => characterHasNarrativeAccess(sheet, item));
  if (requirement.any) return requirement.any.some((item) => characterHasNarrativeAccess(sheet, item));
  if (requirement.not) return !characterHasNarrativeAccess(sheet, requirement.not);
  return hasSingleRequirement(sheet, requirement);
}

export function createNarrativeAccessIndex(sheet) {
  return {
    narrativeTags: [...new Set(sheet.narrative?.tags || [])].sort(),
    skills: [...new Set(sheet.proficiencies?.skills || [])].sort(),
    tools: [...new Set(sheet.proficiencies?.tools || [])].sort(),
    features: (sheet.features || []).map((feature) => ({ id: feature.id, name: feature.name, source: feature.source })),
    resources: (sheet.resources || []).map((resource) => ({ id: resource.id, name: resource.name })),
    spells: [...new Set([
      ...(sheet.spellcasting?.knownSpellIds || []),
      ...(sheet.spellcasting?.preparedSpellIds || []),
    ])].sort(),
    identity: {
      classId: sheet.identity?.classId || null,
      speciesId: sheet.identity?.speciesId || null,
      lineageId: sheet.identity?.lineageId || null,
      backgroundId: sheet.identity?.backgroundId || null,
    },
  };
}

function hasSingleRequirement(sheet, requirement) {
  const kind = normalizeKind(requirement.kind);
  const id = requirement.id;
  if (!kind || !id) return false;

  if (kind === "narrative_tag") return includes(sheet.narrative?.tags, id);
  if (kind === "skill") return includes(sheet.proficiencies?.skills, id);
  if (kind === "tool") return includes(sheet.proficiencies?.tools, id);
  if (kind === "feature") return hasFeature(sheet, id);
  if (kind === "resource") return includes((sheet.resources || []).map((item) => item.id), id);
  if (kind === "spell") return hasSpell(sheet, id);
  if (kind === "class") return sheet.identity?.classId === id;
  if (kind === "species") return sheet.identity?.speciesId === id;
  if (kind === "lineage") return sheet.identity?.lineageId === id;
  if (kind === "background") return sheet.identity?.backgroundId === id;
  return false;
}

function hasFeature(sheet, id) {
  return (sheet.features || []).some((feature) => (
    feature.id === id ||
    feature.name === id ||
    feature.name?.toLowerCase() === String(id).toLowerCase()
  ));
}

function hasSpell(sheet, id) {
  return includes(sheet.spellcasting?.knownSpellIds, id) || includes(sheet.spellcasting?.preparedSpellIds, id);
}

function includes(values = [], id) {
  return (values || []).includes(id);
}

function normalizeKind(kind) {
  return String(kind || "")
    .replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
    .replace(/[-\s]+/g, "_")
    .toLowerCase();
}
