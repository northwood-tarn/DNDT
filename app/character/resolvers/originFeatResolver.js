import { getFeatById } from "../../data/feats.js";
import { isToolId, listToolsByPool } from "../../data/tools.js";
import { addUniqueAll } from "./resolverUtils.js";

export function resolveOriginFeat(sheet, draft, featId, source = {}) {
  const feat = getFeatById(featId);
  if (!feat) {
    sheet.metadata.unresolved.push({ type: "unsupported_origin_feat", featId, ...source });
    return { implemented: false, grants: { featId } };
  }

  const grants = { featId };
  applyProficiencies(sheet, feat.effects?.proficiencies);
  applyResources(sheet, feat.effects?.resources || []);
  applySpellGrants(sheet, feat.effects?.spellGrants || []);
  applyInventory(sheet, feat.effects?.inventory || []);
  applyInitiativeBonus(sheet, feat.effects?.initiativeBonus);
  applyHitPointBonus(sheet, feat.effects?.hitPointBonusPerLevel);
  applyFeatChoices(sheet, draft, feat);

  if (feat.effects?.modifiers) grants.modifiers = structuredClone(feat.effects.modifiers);
  if (feat.effects?.featureHooks) grants.featureHooks = structuredClone(feat.effects.featureHooks);
  if (feat.effects?.narrativeTags) grants.narrativeTags = structuredClone(feat.effects.narrativeTags);
  if (feat.effects?.unarmedStrike) grants.unarmedStrike = structuredClone(feat.effects.unarmedStrike);
  if (feat.effects?.discounts) grants.discounts = structuredClone(feat.effects.discounts);

  return { implemented: true, grants };
}

function applyProficiencies(sheet, proficiencies = {}) {
  addUniqueAll(sheet.proficiencies.skills, proficiencies.skills || []);
  addUniqueAll(sheet.proficiencies.tools, proficiencies.tools || []);
  addUniqueAll(sheet.proficiencies.weapons, proficiencies.weapons || []);
}

function applyResources(sheet, resources) {
  for (const resource of resources) {
    const max = resolveScalingValue(sheet, resource.max);
    const id = resource.id;
    if (!id || sheet.resources.some((item) => item.id === id)) continue;
    sheet.resources.push({
      id,
      name: resource.name,
      max,
      current: max,
      recovery: resource.recovery,
      source: "origin_feat",
    });
  }
}

function applySpellGrants(sheet, spellGrants) {
  for (const grant of spellGrants) {
    if (!grant.spellId) continue;
    if (!sheet.spellcasting.knownSpellIds.includes(grant.spellId)) {
      sheet.spellcasting.knownSpellIds.push(grant.spellId);
    }
  }
}

function applyInventory(sheet, entries) {
  for (const entry of entries) {
    if (!entry.id) continue;
    const existing = sheet.equipment.inventory.find((item) => item.id === entry.id);
    if (existing) existing.qty = (existing.qty || 0) + (entry.qty || 1);
    else sheet.equipment.inventory.push({ id: entry.id, qty: entry.qty || 1 });
  }
}

function applyInitiativeBonus(sheet, initiativeBonus) {
  if (!initiativeBonus) return;
  const amount = resolveScalingValue(sheet, initiativeBonus.amount);
  sheet.combatBasics.initiativeBonus = (sheet.combatBasics.initiativeBonus || 0) + amount;
}

function applyHitPointBonus(sheet, hitPointBonusPerLevel) {
  if (!hitPointBonusPerLevel) return;
  if (!Array.isArray(sheet.durability.hitPointBonuses)) sheet.durability.hitPointBonuses = [];
  sheet.durability.hitPointBonuses.push({
    source: "origin_feat",
    perLevel: hitPointBonusPerLevel,
    total: hitPointBonusPerLevel * sheet.identity.level,
  });
}

function applyFeatChoices(sheet, draft, feat) {
  for (const choice of feat.choices || []) {
    const selection = draft.choices.featChoices?.[feat.id]?.[choice.id];
    if (!selection) {
      sheet.metadata.unresolved.push({ type: "missing_origin_feat_choice", featId: feat.id, choiceId: choice.id, kind: choice.kind, count: choice.count });
      continue;
    }
    const values = Array.isArray(selection) ? selection : [selection];
    if (values.length !== choice.count) {
      sheet.metadata.unresolved.push({ type: "invalid_origin_feat_choice_count", featId: feat.id, choiceId: choice.id, expected: choice.count, actual: values.length });
      continue;
    }
    if (!valuesAllowedForChoice(choice, values)) {
      sheet.metadata.unresolved.push({ type: "invalid_origin_feat_choice_value", featId: feat.id, choiceId: choice.id, values });
      continue;
    }
    if (choice.kind === "skill") addUniqueAll(sheet.proficiencies.skills, values);
    else if (choice.kind === "tool") addUniqueAll(sheet.proficiencies.tools, values);
    else if (choice.kind === "skill_or_tool") applySkillOrToolChoices(sheet, values);
    else if (choice.kind === "spell") addUniqueAll(sheet.spellcasting.knownSpellIds, values);
    else if (choice.kind !== "spell_list") {
      sheet.metadata.unresolved.push({ type: "unsupported_origin_feat_choice_kind", featId: feat.id, choiceId: choice.id, kind: choice.kind });
    }
  }
}

function valuesAllowedForChoice(choice, values) {
  if (choice.kind === "tool") {
    const allowed = new Set(resolveToolPool(choice.pool));
    return values.every((value) => allowed.has(value));
  }
  if (choice.kind === "skill_or_tool") {
    return values.every((value) => {
      const raw = String(value);
      if (raw.startsWith("tool:")) return isToolId(raw.slice(5));
      if (raw.startsWith("skill:")) return true;
      return true;
    });
  }
  return true;
}

function resolveToolPool(pool) {
  if (Array.isArray(pool)) return pool.flatMap((entry) => listToolsByPool(entry).length ? listToolsByPool(entry) : [entry]);
  return listToolsByPool(pool);
}

function applySkillOrToolChoices(sheet, values) {
  for (const value of values) {
    if (String(value).startsWith("tool:")) addUniqueAll(sheet.proficiencies.tools, [value.slice(5)]);
    else addUniqueAll(sheet.proficiencies.skills, [String(value).replace(/^skill:/, "")]);
  }
}

function resolveScalingValue(sheet, value) {
  if (value === "proficiency_bonus") return sheet.proficiencyBonus;
  return Number.isFinite(value) ? value : 0;
}
