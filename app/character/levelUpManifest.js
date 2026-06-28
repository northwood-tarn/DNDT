import { getClassById } from "../data/classes.js";
import { listFeats } from "../data/feats.js";
import { SPELLS, listSpellsByClass } from "../data/spells.js";
import { weapons } from "../data/weapons.js";
import { createFeatChoicePools, createSpellChoicePools } from "./choicePools.js";

export function createLevelUpManifest(draft, { toLevel = (draft.identity?.level || 1) + 1 } = {}) {
  const classRecord = getClassById(draft.identity?.classId);
  if (!classRecord) throw new Error(`Cannot create level-up manifest for unknown class: ${draft.identity?.classId}`);
  const fromLevel = draft.identity?.level || Math.max(1, toLevel - 1);
  const targetDraft = withLevel(draft, toLevel);
  const steps = [
    hpStep(classRecord, toLevel),
    ...classChoiceSteps(classRecord, toLevel),
    ...spellDeltaSteps(targetDraft),
    ...advancementSteps(classRecord, targetDraft, toLevel),
    ...featureChoiceSteps(classRecord, targetDraft, toLevel),
  ].filter(Boolean);
  const grants = featureGrantSteps(classRecord, targetDraft, toLevel);
  return {
    schemaVersion: 1,
    characterId: draft.identity?.characterName || draft.identity?.id || "character",
    fromLevel,
    toLevel,
    classId: classRecord.id,
    className: classRecord.name,
    summary: [...steps, ...grants].map((step) => step.label),
    steps,
    grants,
  };
}

function hpStep(classRecord, level) {
  return {
    id: `level:${level}:hp`,
    kind: "hp_roll",
    label: "Hit points",
    required: true,
    hitDie: classRecord.hitDie,
    reroll: [1],
    conModifierPath: "abilities.constitution",
  };
}

function classChoiceSteps(classRecord, level) {
  return (classRecord.choices || [])
    .filter((choice) => choice.level === level)
    .map((choice) => {
      if (choice.kind === "subclass") {
        return {
          id: `class:${classRecord.id}:level_${level}:subclass`,
          kind: "single_choice",
          choiceKind: "subclass",
          path: "identity.subclassId",
          label: "Subclass",
          required: choice.required === true,
          detailMode: "hover",
          options: Object.entries(classRecord.subclasses || {}).map(([name, subclass]) => optionFromFeatureSet(subclass.id, name, subclass)),
        };
      }
      if (choice.kind === "pact") {
        return {
          id: `class:${classRecord.id}:level_${level}:pact`,
          kind: "single_choice",
          choiceKind: "pact",
          path: "identity.pactId",
          label: "Pact",
          required: choice.required === true,
          detailMode: "hover",
          options: Object.entries(classRecord.pacts || {}).map(([name, pact]) => optionFromFeatureSet(pact.id, name, pact)),
        };
      }
      return {
        id: `class:${classRecord.id}:level_${level}:${choice.id}`,
        kind: choice.count > 1 ? "multi_choice" : "single_choice",
        choiceKind: choice.kind,
        path: `choices.classChoices.${choice.id}`,
        label: titleCase(choice.id),
        required: choice.required === true,
        options: (choice.options || []).map((id) => ({ id, name: titleCase(id) })),
      };
    });
}

function spellDeltaSteps(targetDraft) {
  const spellPools = createSpellChoicePools(targetDraft).pools || [];
  return spellPools
    .filter((pool) => pool.mode === "known")
    .map((pool) => {
      const count = pool.missing || 0;
      if (!count) return null;
      const selected = new Set([...(pool.selected || []), ...(pool.grantedSpellIds || [])]);
      const options = pool.options
        .filter((spell) => !selected.has(spell.id))
        .map(spellOption);
      return {
        id: `level:${targetDraft.identity.level}:${pool.id}`,
        kind: "multi_choice",
        choiceKind: pool.id === "known_cantrips" ? "cantrip" : "spell",
        path: pool.path,
        label: pool.label,
        required: true,
        count,
        max: count,
        detailMode: "hover",
        options,
      };
    })
    .filter(Boolean);
}

function advancementSteps(classRecord, targetDraft, level) {
  const featPools = createFeatChoicePools(targetDraft).pools || [];
  const exactPools = featPools.filter((pool) => pool.level === level);
  if (!exactPools.length) return [];
  const feats = listFeats()
    .filter((feat) => feat.type === "general")
    .filter((feat) => (feat.minLevel || 1) <= level)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((feat) => ({
      id: feat.id,
      name: feat.name,
      description: feat.description || "",
      choices: (feat.choices || []).map(normalizeNestedChoice),
    }));
  return exactPools.map((pool) => ({
    id: pool.id,
    kind: "feat_or_asi",
    choiceKind: "advancement",
    path: pool.path,
    label: pool.label || "Feat / ASI",
    required: true,
    count: 1,
    options: feats,
  }));
}

function featureChoiceSteps(classRecord, targetDraft, level) {
  const out = [];
  const owners = [
    { source: "class", name: classRecord.name, features: classRecord.features?.[level] || [] },
    { source: "subclass", name: subclassName(classRecord, targetDraft.identity?.subclassId), features: selectedSubclass(classRecord, targetDraft.identity?.subclassId)?.features?.[level] || [] },
    { source: "pact", name: pactName(classRecord, targetDraft.identity?.pactId), features: selectedPact(classRecord, targetDraft.identity?.pactId)?.features?.[level] || [] },
  ];
  for (const owner of owners) {
    for (const feature of owner.features || []) {
      for (const requirement of feature.effects?.choiceRequirements || []) {
        out.push(featureChoiceStep(classRecord, targetDraft, owner, feature, requirement, level));
      }
    }
  }
  return out.filter(Boolean);
}

function featureChoiceStep(classRecord, targetDraft, owner, feature, requirement, level) {
  const count = requirement.count || 1;
  return {
    id: `${owner.source}:${classRecord.id}:level_${level}:${requirement.id}`,
    kind: count > 1 ? "multi_choice" : "single_choice",
    choiceKind: requirement.kind,
    path: `choices.classChoices.${requirement.id}`,
    label: feature.name,
    required: true,
    count,
    max: count,
    source: owner.name,
    detail: feature.description || "",
    options: featureChoiceOptions(classRecord, targetDraft, requirement, level),
  };
}

function featureChoiceOptions(classRecord, targetDraft, requirement, level) {
  if (requirement.options?.length) return requirement.options.map((id) => optionByKind(requirement.kind, id));
  if (requirement.kind === "spell") {
    if (requirement.id === "book_of_shadows_cantrips") {
      return Object.values(SPELLS).filter((spell) => spell.active !== false && spell.level === 0).map(spellOption).sort(byName);
    }
    if (requirement.id === "mystic_arcanum_spell") {
      return listSpellsByClass(classRecord.name).filter((spell) => spell.level === mysticArcanumSpellLevel(level)).map(spellOption).sort(byName);
    }
    return listSpellsByClass(classRecord.name).filter((spell) => spell.level <= maxSpellLevelForClass(classRecord.id, level)).map(spellOption).sort(byName);
  }
  if (requirement.kind === "weapon") {
    const equipped = new Set(targetDraft.gear?.weaponIds || []);
    return weapons
      .filter((weapon) => equipped.has(weapon.id) || !weapon.magical)
      .map((weapon) => ({ id: weapon.id, name: weapon.name, description: weapon.description || "", meta: weapon.damage || "" }))
      .sort(byName);
  }
  return [];
}

function featureGrantSteps(classRecord, targetDraft, level) {
  const owners = [
    { source: "class", name: classRecord.name, features: classRecord.features?.[level] || [] },
    { source: "subclass", name: subclassName(classRecord, targetDraft.identity?.subclassId), features: selectedSubclass(classRecord, targetDraft.identity?.subclassId)?.features?.[level] || [] },
    { source: "pact", name: pactName(classRecord, targetDraft.identity?.pactId), features: selectedPact(classRecord, targetDraft.identity?.pactId)?.features?.[level] || [] },
  ];
  return owners.flatMap((owner) => (owner.features || [])
    .filter((feature) => !feature.effects?.advancement?.length && !feature.effects?.choiceRequirements?.length)
    .map((feature) => ({
      id: `${owner.source}:${classRecord.id}:level_${level}:${slug(feature.name)}`,
      kind: "feature_grant",
      label: feature.name,
      source: owner.name,
      detail: feature.description || feature.summary || "",
    })));
}

function normalizeNestedChoice(choice) {
  return {
    id: choice.id,
    kind: duplicateFriendlyKinds().has(choice.kind) ? "repeated_choice" : choice.kind,
    choiceKind: choice.kind,
    count: choice.count || 1,
    allowDuplicate: choice.allowDuplicate === true || duplicateFriendlyKinds().has(choice.kind),
    options: (choice.options || []).map((id) => ({ id, name: titleCase(id) })),
    filter: choice.filter || null,
  };
}

function duplicateFriendlyKinds() {
  return new Set(["ability_score", "saving_throw_ability"]);
}

function optionByKind(kind, id) {
  return { id, name: kind === "spell" ? SPELLS[id]?.name || titleCase(id) : titleCase(id) };
}

function optionFromFeatureSet(id, name, record) {
  return {
    id,
    name,
    description: record.summary || "",
    features: Object.entries(record.features || {}).flatMap(([level, features]) => (
      features.map((feature) => ({ level: Number(level), name: feature.name, description: feature.description || "" }))
    )),
  };
}

function spellOption(spell) {
  return {
    id: spell.id,
    name: spell.name,
    level: spell.level,
    school: spell.school,
    description: spell.text || "",
    concentration: spell.concentration === true,
    ritual: spell.ritual === true,
  };
}

function withLevel(draft, level) {
  return structuredClone({ ...draft, identity: { ...draft.identity, level } });
}

function selectedSubclass(classRecord, id) {
  return Object.values(classRecord.subclasses || {}).find((entry) => entry.id === id) || null;
}

function selectedPact(classRecord, id) {
  return Object.values(classRecord.pacts || {}).find((entry) => entry.id === id) || null;
}

function subclassName(classRecord, id) {
  return Object.entries(classRecord.subclasses || {}).find(([, entry]) => entry.id === id)?.[0] || "";
}

function pactName(classRecord, id) {
  return Object.entries(classRecord.pacts || {}).find(([, entry]) => entry.id === id)?.[0] || "";
}

function maxSpellLevelForClass(classId, level) {
  if (classId === "paladin") return level >= 17 ? 5 : level >= 13 ? 4 : level >= 9 ? 3 : level >= 5 ? 2 : 1;
  if (classId === "warlock") return level >= 9 ? 5 : level >= 7 ? 4 : level >= 5 ? 3 : level >= 3 ? 2 : 1;
  return level >= 13 ? 7 : level >= 11 ? 6 : level >= 9 ? 5 : level >= 7 ? 4 : level >= 5 ? 3 : level >= 3 ? 2 : 1;
}

function mysticArcanumSpellLevel(level) {
  if (level >= 17) return 9;
  if (level >= 15) return 8;
  if (level >= 13) return 7;
  return 6;
}

function byName(a, b) {
  return a.name.localeCompare(b.name);
}

function slug(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function titleCase(value) {
  return String(value || "").replace(/[_-]+/g, " ").replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}
