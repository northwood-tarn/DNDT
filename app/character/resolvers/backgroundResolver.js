import { addUniqueAll } from "./resolverUtils.js";
import { resolveOriginFeat } from "./originFeatResolver.js";

export function resolveBackground(sheet, draft, backgrounds) {
  const backgroundId = draft.identity.backgroundId;
  if (!backgroundId) return;

  const background = backgrounds[backgroundId];
  if (!background) {
    sheet.metadata.unresolved.push({ type: "missing_background", id: backgroundId });
    return;
  }

  addUniqueAll(sheet.proficiencies.skills, background.skillProficiencies);
  addUniqueAll(sheet.proficiencies.tools, background.toolProficiencies);

  if (!background.originFeat) return;

  const featId = resolveBackgroundFeatId(background, draft);
  const resolvedFeat = resolveOriginFeat(sheet, draft, featId, { backgroundId: background.id });
  sheet.features.push({
    id: `background:${background.id}:origin_feat`,
    name: `Origin Feat: ${featId}`,
    source: "background",
    sourceId: background.id,
    kind: "origin_feat",
    grants: resolvedFeat.grants,
    implemented: resolvedFeat.implemented,
  });
}

function resolveBackgroundFeatId(background, draft) {
  return draft.choices.backgroundOriginFeatChoice || background.legacyFeatId || background.originFeat;
}
