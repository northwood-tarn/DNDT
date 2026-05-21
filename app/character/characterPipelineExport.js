import { resolvedSheetToCombatActor, validateResolvedSheetCombatActor } from "./combatActorAdapter.js";
import { createCharacterValidityReport } from "./characterValidityReport.js";
import { resolveCharacterSheet } from "./resolveCharacterSheet.js";
import { createResolvedSheetPreview } from "./resolvedSheetPreview.js";
import { validateResolvedCharacterSheet } from "./resolvedSheet.js";

export function createCharacterPipelineExport(draft, options = {}) {
  const resolvedSheet = resolveCharacterSheet(draft, options.registries || {}, options.resolveOptions || {});
  const sheetErrors = validateResolvedCharacterSheet(resolvedSheet);
  const unresolved = resolvedSheet.metadata?.unresolved || [];
  const combatActorErrors = sheetErrors.length || unresolved.length
    ? []
    : validateResolvedSheetCombatActor(resolvedSheet, options.actorOptions || {});
  const combatActor = sheetErrors.length || unresolved.length || combatActorErrors.length
    ? null
    : resolvedSheetToCombatActor(resolvedSheet, options.actorOptions || {});

  return {
    version: 1,
    characterDraft: structuredClone(draft),
    resolvedCharacterSheet: resolvedSheet,
    combatActor,
    validityReport: createCharacterValidityReport(draft, {
      sheet: resolvedSheet,
      actorOptions: options.actorOptions || {},
    }),
    preview: createResolvedSheetPreview(resolvedSheet, {
      actorOptions: options.actorOptions || {},
    }),
  };
}
