export function resolveIdentity(sheet, draft, backgrounds, speciesRegistry) {
  const identity = draft.identity;
  const background = backgrounds[identity.backgroundId] || null;
  const species = speciesRegistry[identity.speciesId] || null;
  const lineage = identity.lineageId ? species?.lineages?.[identity.lineageId] : null;

  sheet.identity = {
    ...sheet.identity,
    characterName: identity.characterName || "",
    level: identity.level,
    backgroundId: identity.backgroundId,
    backgroundName: background?.name || null,
    speciesId: identity.speciesId,
    speciesName: species?.name || null,
    lineageId: identity.lineageId,
    lineageName: lineage?.name || null,
    classId: identity.classId,
    subclassId: identity.subclassId,
  };
}
