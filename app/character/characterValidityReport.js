import { validateCharacterDraft } from "./characterDraft.js";
import { validateResolvedSheetCombatActor } from "./combatActorAdapter.js";
import { createEmptyResolvedCharacterSheet, validateResolvedCharacterSheet } from "./resolvedSheet.js";
import { resolveCharacterSheet } from "./resolveCharacterSheet.js";

export function createCharacterValidityReport(draft, options = {}) {
  const draftErrors = validateCharacterDraft(draft);
  const sheet = options.sheet || (draftErrors.length ? createEmptyResolvedCharacterSheet() : resolveCharacterSheet(draft));
  const sheetErrors = validateResolvedCharacterSheet(sheet);
  const unresolved = sheet.metadata?.unresolved || [];
  const combatActorErrors = sheetErrors.length || unresolved.length
    ? []
    : validateResolvedSheetCombatActor(sheet, options.actorOptions || {});
  const checks = [
    check("draft", "Character draft", draftErrors),
    check("resolved_sheet", "Resolved character sheet", sheetErrors),
    check("unresolved_choices", "Unresolved character choices", unresolved.map(describeUnresolved)),
    check("combat_actor", "Combat actor bridge", combatActorErrors),
  ];

  return {
    valid: checks.every((item) => item.status === "pass"),
    summary: {
      characterName: sheet.identity?.characterName || draft?.identity?.characterName || "",
      level: sheet.identity?.level || draft?.identity?.level || null,
      backgroundId: sheet.identity?.backgroundId || draft?.identity?.backgroundId || null,
      speciesId: sheet.identity?.speciesId || draft?.identity?.speciesId || null,
      lineageId: sheet.identity?.lineageId || draft?.identity?.lineageId || null,
      classId: sheet.identity?.classId || draft?.identity?.classId || null,
      armorClass: sheet.combatBasics?.armorClass ?? null,
      maxHp: sheet.durability?.maxHp ?? null,
      actionCount: countCombatActions(sheet),
    },
    checks,
    draftErrors,
    sheetErrors,
    unresolved,
    combatActorErrors,
  };
}

function check(id, label, messages) {
  return {
    id,
    label,
    status: messages.length ? "fail" : "pass",
    messages,
  };
}

function describeUnresolved(item) {
  if (!item || typeof item !== "object") return String(item);
  if (item.message) return item.message;
  if (item.type) return `${item.type}: ${JSON.stringify(item)}`;
  return JSON.stringify(item);
}

function countCombatActions(sheet) {
  return (sheet.equipment?.weaponIds?.length || 0) +
    unique([...(sheet.spellcasting?.knownSpellIds || []), ...(sheet.spellcasting?.preparedSpellIds || [])]).length +
    (sheet.equipment?.inventory?.length || 0) +
    (sheet.features || []).reduce((count, feature) => count + (feature.effects?.actionOptions?.length || 0), 0);
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}
