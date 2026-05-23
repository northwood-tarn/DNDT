import { getFeatById } from "../../data/feats.js";
import { getSpellRecordById, SPELLS } from "../../data/spells.js";
import { isToolId, listToolsByPool } from "../../data/tools.js";
import { addUniqueAll } from "./resolverUtils.js";

export function resolveOriginFeat(sheet, draft, featId, source = {}) {
  const feat = getFeatById(featId);
  if (!feat) {
    sheet.metadata.unresolved.push({ type: "unsupported_origin_feat", featId, ...source });
    return { implemented: false, grants: { featId } };
  }
  if (sheet.identity.level < feat.minLevel) {
    sheet.metadata.unresolved.push({ type: "premature_feat_choice", featId, requiredLevel: feat.minLevel, currentLevel: sheet.identity.level, ...source });
    return { implemented: false, grants: { featId } };
  }

  const grants = { featId };
  applyProficiencies(sheet, feat.effects?.proficiencies);
  applyAbilityScoreBonuses(sheet, feat.effects?.abilityScoreBonuses || []);
  applySenses(sheet, feat.effects?.senses || []);
  applyResources(sheet, feat.effects?.resources || []);
  applySpellGrants(sheet, feat.effects?.spellGrants || []);
  applyInventory(sheet, feat.effects?.inventory || []);
  applyInitiativeBonus(sheet, feat.effects?.initiativeBonus);
  applyHitPointBonus(sheet, feat.effects?.hitPointBonusPerLevel);
  applyFeatChoices(sheet, draft, feat, source);

  if (feat.effects?.modifiers) grants.modifiers = structuredClone(feat.effects.modifiers);
  if (feat.effects?.featureHooks) grants.featureHooks = structuredClone(feat.effects.featureHooks);
  if (feat.effects?.actionOptions) grants.actionOptions = structuredClone(feat.effects.actionOptions);
  if (feat.effects?.damageRiders) grants.damageRiders = structuredClone(feat.effects.damageRiders);
  if (feat.effects?.narrativeTags) grants.narrativeTags = structuredClone(feat.effects.narrativeTags);
  if (feat.effects?.unarmedStrike) grants.unarmedStrike = structuredClone(feat.effects.unarmedStrike);
  if (feat.effects?.discounts) grants.discounts = structuredClone(feat.effects.discounts);
  if (feat.effects?.freeCastChoices) applyFreeCastChoices(sheet, draft, feat);

  return { implemented: true, grants };
}

function applyProficiencies(sheet, proficiencies = {}) {
  addUniqueAll(sheet.proficiencies.skills, proficiencies.skills || []);
  addUniqueAll(sheet.proficiencies.tools, proficiencies.tools || []);
  addUniqueAll(sheet.proficiencies.weapons, proficiencies.weapons || []);
  addUniqueAll(sheet.proficiencies.armor, proficiencies.armor || []);
  addUniqueAll(sheet.proficiencies.savingThrows, proficiencies.savingThrows || []);
}

function applyAbilityScoreBonuses(sheet, bonuses) {
  for (const bonus of bonuses) {
    applyAbilityScoreBonus(sheet, bonus.ability, bonus.amount || 1, bonus.cap || 20, bonus.source || "feat");
  }
}

function applyAbilityScoreBonus(sheet, ability, amount = 1, cap = 20, source = "feat") {
  if (!sheet.abilities?.[ability]) return;
  const before = sheet.abilities[ability].score;
  const score = Math.min(cap, before + amount);
  sheet.abilities[ability].score = score;
  sheet.abilities[ability].modifier = Math.floor((score - 10) / 2);
  sheet.abilities[ability].sources.push({ type: source, label: "Feat ability increase", value: score - before });
}

function applySenses(sheet, senses) {
  for (const sense of senses) {
    if (!sense?.type || !Number.isFinite(sense.rangeFt)) continue;
    const existing = sheet.combatBasics.senses.find((item) => item.type === sense.type);
    if (existing) existing.rangeFt = Math.max(existing.rangeFt || 0, sense.rangeFt);
    else sheet.combatBasics.senses.push({ type: sense.type, rangeFt: sense.rangeFt });
  }
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
    if (grant.freeCastResourceId) {
      addFreeCastResource(sheet, grant.freeCastResourceId, `${spellName(grant.spellId)} Free Cast`);
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

function applyFeatChoices(sheet, draft, feat, source = {}) {
  for (const choice of feat.choices || []) {
    const selection = draft.choices.featChoices?.[feat.id]?.[choice.id];
    if (!selection) {
      sheet.metadata.unresolved.push(originFeatChoiceIssue("missing_origin_feat_choice", feat, choice, source));
      continue;
    }
    const values = Array.isArray(selection) ? selection : [selection];
    if (values.length !== choice.count) {
      sheet.metadata.unresolved.push(originFeatChoiceIssue("invalid_origin_feat_choice_count", feat, choice, source, {
        expected: choice.count,
        actual: values.length,
      }));
      continue;
    }
    if (!valuesAllowedForChoice(choice, values)) {
      sheet.metadata.unresolved.push(originFeatChoiceIssue("invalid_origin_feat_choice_value", feat, choice, source, { values }));
      continue;
    }
    if (choice.kind === "ability_score") applyAbilityChoice(sheet, choice, values, feat.id);
    else if (choice.kind === "saving_throw_ability") applySavingThrowAbilityChoice(sheet, choice, values, feat.id);
    else if (choice.kind === "damage_type") applyChoiceMetadata(sheet, feat.id, choice.id, values);
    else if (choice.kind === "skill") addUniqueAll(sheet.proficiencies.skills, values);
    else if (choice.kind === "skill_expertise") applySkillExpertiseChoices(sheet, values, feat.id);
    else if (choice.kind === "tool") addUniqueAll(sheet.proficiencies.tools, values);
    else if (choice.kind === "skill_or_tool") applySkillOrToolChoices(sheet, values);
    else if (choice.kind === "spell") applySpellChoice(sheet, values, feat.id, choice.id);
    else if (choice.kind === "spell_list") applySpellChoice(sheet, values, feat.id, choice.id);
    else {
      sheet.metadata.unresolved.push({ type: "unsupported_origin_feat_choice_kind", featId: feat.id, choiceId: choice.id, kind: choice.kind });
    }
  }
}

function originFeatChoiceIssue(type, feat, choice, source = {}, extra = {}) {
  const unresolved = {
    type,
    featId: feat.id,
    choiceId: choice.id,
    kind: choice.kind,
    count: choice.count,
    ...extra,
  };
  if (source.advancementId) unresolved.advancementId = source.advancementId;
  const options = choiceOptions(choice);
  if (options) unresolved.options = options;
  return unresolved;
}

function valuesAllowedForChoice(choice, values) {
  if (choice.kind === "spell" || choice.kind === "spell_list") {
    return values.every((value) => spellAllowedForChoice(choice, value));
  }
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

function spellAllowedForChoice(choice, spellId) {
  const spell = getSpellRecordById(spellId);
  if (!spell) return false;
  const filter = choice.filter || {};
  if (Number.isFinite(filter.level) && spell.level !== filter.level) return false;
  if (Number.isFinite(filter.maxLevel) && spell.level > filter.maxLevel) return false;
  if (Number.isFinite(filter.minLevel) && spell.level < filter.minLevel) return false;
  if (Array.isArray(filter.schools) && filter.schools.length && !filter.schools.includes(spell.school)) return false;
  if (Array.isArray(filter.classes) && filter.classes.length && !filter.classes.some((cls) => (spell.classes || []).includes(cls))) return false;
  if (filter.ritual === true && spell.ritual !== true) return false;
  if (filter.concentration === false && spell.concentration === true) return false;
  return true;
}

function applyAbilityChoice(sheet, choice, values, featId) {
  for (const ability of values) {
    applyAbilityScoreBonus(sheet, ability, choice.amount || 1, choice.scoreCap || 20, featId);
  }
  applyChoiceMetadata(sheet, featId, choice.id, values);
}

function applySavingThrowAbilityChoice(sheet, choice, values, featId) {
  applyAbilityChoice(sheet, choice, values, featId);
  addUniqueAll(sheet.proficiencies.savingThrows, values);
}

function applySkillExpertiseChoices(sheet, values, featId) {
  addUniqueAll(sheet.proficiencies.skills, values);
  for (const skill of values) {
    const exists = sheet.proficiencies.expertise.some((entry) => entry.kind === "skill" && entry.id === skill);
    if (!exists) sheet.proficiencies.expertise.push({ kind: "skill", id: skill, source: featId });
  }
}

function applyChoiceMetadata(sheet, featId, choiceId, values) {
  sheet.metadata.featChoices ??= {};
  sheet.metadata.featChoices[featId] ??= {};
  sheet.metadata.featChoices[featId][choiceId] = values.length === 1 ? values[0] : values;
}

function applySpellChoice(sheet, values, featId, choiceId) {
  addUniqueAll(sheet.spellcasting.knownSpellIds, values);
  applyChoiceMetadata(sheet, featId, choiceId, values);
}

function applyFreeCastChoices(sheet, draft, feat) {
  for (const item of feat.effects?.freeCastChoices || []) {
    const selection = draft.choices.featChoices?.[feat.id]?.[item.choiceId];
    const values = Array.isArray(selection) ? selection : [selection].filter(Boolean);
    for (const spellId of values) {
      const resourceId = `${item.resourcePrefix}_${spellId}`;
      addFreeCastResource(sheet, resourceId, `${spellName(spellId)} Free Cast`);
    }
  }
}

function addFreeCastResource(sheet, id, name) {
  if (!id || sheet.resources.some((item) => item.id === id)) return;
  sheet.resources.push({ id, name, max: 1, current: 1, recovery: "long_rest", source: "feat" });
}

function spellName(spellId) {
  return getSpellRecordById(spellId)?.name || String(spellId || "Spell");
}

function choiceOptions(choice) {
  if (Array.isArray(choice.options)) return choice.options.map((id) => ({ id, name: titleCase(id) }));
  if (choice.kind === "spell" || choice.kind === "spell_list") {
    return Object.values(SPELLS)
      .filter((spell) => spell?.active !== false)
      .filter((spell) => spellAllowedForChoice(choice, spell.id))
      .map((spell) => ({ id: spell.id, name: spell.name, meta: `Level ${spell.level} · ${spell.school}` }));
  }
  return null;
}

function titleCase(value) {
  return String(value || "").split("_").map((part) => part ? part[0].toUpperCase() + part.slice(1) : "").join(" ");
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
