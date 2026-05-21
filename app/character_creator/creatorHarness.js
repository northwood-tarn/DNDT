import { BACKGROUND_LIST } from "../data/backgrounds.js";
import { CLASS_LIST } from "../data/classes.js";
import { SPECIES_LIST } from "../data/species.js";
import {
  STANDARD_ABILITY_ARRAY,
  assignBackgroundAbilityBonus,
  assignStandardAbilityScore,
  createChoiceRequirementsReport,
  createEmptyCharacterDraft,
  createGearChoicePools,
  createResolvedSheetPreview,
  createSpellChoicePools,
  resolvedSheetToCombatActor,
  resolveCharacterSheet,
} from "../character/index.js";

const ABILITIES = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];
const SKILL_OPTIONS = [
  "acrobatics",
  "animal_handling",
  "arcana",
  "athletics",
  "deception",
  "history",
  "insight",
  "intimidation",
  "investigation",
  "medicine",
  "nature",
  "perception",
  "performance",
  "persuasion",
  "religion",
  "sleight_of_hand",
  "stealth",
  "survival",
];
const state = {
  exportView: "draft",
  draft: createEmptyCharacterDraft({
    identity: {
      characterName: "Harness Wizard",
      level: 1,
      speciesId: "tiefling",
      lineageId: "chthonic",
      backgroundId: "sage",
      classId: "wizard",
    },
    abilities: {
      strength: 8,
      dexterity: 14,
      constitution: 13,
      intelligence: 12,
      wisdom: 11,
      charisma: 10,
    },
    gear: { weaponIds: ["quarterstaff"] },
    spells: { knownSpellIds: ["fire_bolt"], preparedSpellIds: ["magic_missile"] },
    choices: { backgroundAbilityScores: [{ ability: "intelligence", bonus: 2 }, { ability: "wisdom", bonus: 1 }] },
  }),
};

const els = {
  characterName: document.querySelector("#characterName"),
  speciesSelect: document.querySelector("#speciesSelect"),
  lineageField: document.querySelector("#lineageField"),
  lineageSelect: document.querySelector("#lineageSelect"),
  backgroundSelect: document.querySelector("#backgroundSelect"),
  classSelect: document.querySelector("#classSelect"),
  abilityInputs: document.querySelector("#abilityInputs"),
  backgroundAbilityBonuses: document.querySelector("#backgroundAbilityBonuses"),
  resolverChoices: document.querySelector("#resolverChoices"),
  spellPools: document.querySelector("#spellPools"),
  gearPools: document.querySelector("#gearPools"),
  completionState: document.querySelector("#completionState"),
  requirementsList: document.querySelector("#requirementsList"),
  previewSummary: document.querySelector("#previewSummary"),
  combatActions: document.querySelector("#combatActions"),
  exportOutput: document.querySelector("#exportOutput"),
  exportTabs: [...document.querySelectorAll("[data-export-view]")],
  resetButton: document.querySelector("#resetButton"),
};

init();

function init() {
  fillSelect(els.speciesSelect, SPECIES_LIST);
  fillSelect(els.backgroundSelect, BACKGROUND_LIST);
  fillSelect(els.classSelect, CLASS_LIST);
  renderAbilityInputs();
  bindCoreEvents();
  render();
}

function bindCoreEvents() {
  els.characterName.addEventListener("input", () => {
    state.draft.identity.characterName = els.characterName.value;
    render();
  });
  els.speciesSelect.addEventListener("change", () => {
    state.draft.identity.speciesId = els.speciesSelect.value;
    state.draft.identity.lineageId = null;
    state.draft.choices.speciesChoices = {};
    render();
  });
  els.lineageSelect.addEventListener("change", () => {
    state.draft.identity.lineageId = els.lineageSelect.value || null;
    render();
  });
  els.backgroundSelect.addEventListener("change", () => {
    state.draft.identity.backgroundId = els.backgroundSelect.value;
    state.draft.choices.featChoices = {};
    state.draft.choices.backgroundAbilityScores = [];
    render();
  });
  els.classSelect.addEventListener("change", () => {
    state.draft.identity.classId = els.classSelect.value;
    state.draft.spells.knownSpellIds = [];
    state.draft.spells.preparedSpellIds = [];
    state.draft.gear.weaponIds = [];
    state.draft.gear.armorId = null;
    state.draft.gear.shieldId = null;
    render();
  });
  els.resetButton.addEventListener("click", () => {
    state.draft = createEmptyCharacterDraft();
    render();
  });
  for (const button of els.exportTabs) {
    button.addEventListener("click", () => {
      state.exportView = button.dataset.exportView;
      renderReports();
    });
  }
}

function render() {
  els.characterName.value = state.draft.identity.characterName || "";
  els.speciesSelect.value = state.draft.identity.speciesId || "";
  els.backgroundSelect.value = state.draft.identity.backgroundId || "";
  els.classSelect.value = state.draft.identity.classId || "";
  renderLineageSelect();
  renderAbilityValues();
  renderBackgroundAbilityBonuses();
  renderSpellPools();
  renderGearPools();
  renderReports();
}

function renderLineageSelect() {
  const species = SPECIES_LIST.find((item) => item.id === state.draft.identity.speciesId);
  const lineages = Object.values(species?.lineages || {});
  els.lineageField.hidden = lineages.length === 0;
  fillSelect(els.lineageSelect, lineages, { emptyLabel: lineages.length ? "Choose lineage" : "None" });
  els.lineageSelect.value = state.draft.identity.lineageId || "";
}

function renderAbilityInputs() {
  els.abilityInputs.replaceChildren(...ABILITIES.map((ability) => {
    const label = document.createElement("label");
    label.textContent = title(ability);
    const input = document.createElement("select");
    input.dataset.ability = ability;
    input.replaceChildren(...STANDARD_ABILITY_ARRAY.map((score) => new Option(String(score), String(score))));
    input.addEventListener("change", () => {
      assignStandardAbilityScore(state.draft, ability, Number(input.value));
      render();
    });
    label.append(input);
    return label;
  }));
}

function renderAbilityValues() {
  for (const input of els.abilityInputs.querySelectorAll("select")) {
    input.value = state.draft.abilities[input.dataset.ability] ?? 10;
  }
}

function renderBackgroundAbilityBonuses() {
  const background = BACKGROUND_LIST.find((item) => item.id === state.draft.identity.backgroundId);
  const allowed = background?.abilityScoreOptions || [];
  if (!allowed.length) {
    els.backgroundAbilityBonuses.replaceChildren(emptyPool("Choose a background to assign ability bonuses."));
    return;
  }

  const card = document.createElement("section");
  card.className = "pool";
  const title = document.createElement("div");
  title.className = "pool-head";
  title.innerHTML = `<div class="pool-title">Background bonuses</div><div class="pool-count">Choose +2 and +1</div>`;
  const grid = document.createElement("div");
  grid.className = "option-list";

  for (const bonus of [2, 1]) {
    const label = document.createElement("label");
    label.textContent = `+${bonus}`;
    const select = document.createElement("select");
    select.replaceChildren(new Option("Choose ability", ""), ...allowed.map((ability) => new Option(titleCase(ability), ability)));
    select.value = state.draft.choices.backgroundAbilityScores.find((entry) => entry.bonus === bonus)?.ability || "";
    select.addEventListener("change", () => {
      if (select.value) assignBackgroundAbilityBonus(state.draft, select.value, bonus);
      render();
    });
    label.append(select);
    grid.append(label);
  }

  card.append(title, grid);
  els.backgroundAbilityBonuses.replaceChildren(card);
}

function renderSpellPools() {
  const spellPools = createSpellChoicePools(state.draft);
  const nodes = spellPools.pools.length
    ? spellPools.pools.map((pool) => renderOptionPool(pool, "spell"))
    : [emptyPool("No class spell choices at this level.")];
  els.spellPools.replaceChildren(...nodes);
}

function renderGearPools() {
  const gearPools = createGearChoicePools(state.draft);
  els.gearPools.replaceChildren(...gearPools.pools.map((pool) => renderOptionPool(pool, "gear")));
}

function renderOptionPool(pool, type) {
  const card = document.createElement("section");
  card.className = "pool";

  const head = document.createElement("div");
  head.className = "pool-head";
  head.innerHTML = `<div class="pool-title">${pool.label}</div><div class="pool-count">${formatCount(pool.count)}</div>`;

  const list = document.createElement("div");
  list.className = "option-list";
  for (const option of pool.options) {
    list.append(renderOption(pool, option, type));
  }

  card.append(head, list);
  return card;
}

function renderOption(pool, option, type) {
  const label = document.createElement("label");
  label.className = "option";

  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = pool.selected.includes(option.id);
  input.addEventListener("change", () => updatePoolSelection(pool, option.id, input.checked, type));

  const text = document.createElement("span");
  text.innerHTML = `${option.name}<span class="option-meta">${optionMeta(option)}</span>`;
  label.append(input, text);
  return label;
}

function updatePoolSelection(pool, optionId, checked, type) {
  const max = Number.isFinite(pool.count) ? pool.count : pool.count.max;
  const selected = new Set(pool.selected);
  if (checked) selected.add(optionId);
  else selected.delete(optionId);
  const values = Array.from(selected).slice(0, max);

  if (type === "spell") {
    updateSpellSelection(pool, values);
  } else {
    updateGearSelection(pool, values);
  }
  render();
}

function updateSpellSelection(pool, values) {
  const spellPools = createSpellChoicePools(state.draft).pools;
  const otherKnown = spellPools
    .filter((item) => item.mode === "known" && item.id !== pool.id)
    .flatMap((item) => item.selected);
  if (pool.mode === "known") state.draft.spells.knownSpellIds = unique([...otherKnown, ...values]);
  if (pool.mode === "prepared") state.draft.spells.preparedSpellIds = values;
}

function updateGearSelection(pool, values) {
  if (pool.id === "weapons") state.draft.gear.weaponIds = values;
  if (pool.id === "armor") state.draft.gear.armorId = values[0] || null;
  if (pool.id === "shield") state.draft.gear.shieldId = values[0] || null;
}

function renderReports() {
  const sheet = resolveCharacterSheet(state.draft);
  const report = createChoiceRequirementsReport(state.draft, { sheet });
  const preview = createResolvedSheetPreview(sheet);

  renderResolverChoices(report);
  els.completionState.textContent = report.complete ? "Complete" : `${report.requirements.length} item${report.requirements.length === 1 ? "" : "s"} needed`;
  els.completionState.classList.toggle("complete", report.complete);
  els.requirementsList.replaceChildren(...renderRequirements(report));
  els.previewSummary.replaceChildren(...renderPreviewSummary(preview));
  els.combatActions.replaceChildren(...preview.combatActions.map((action) => li(`${action.name}`, `${action.cost} · ${action.type}`)));
  renderPipelineExport(sheet);
}

function renderPipelineExport(sheet) {
  const payloads = {
    draft: state.draft,
    sheet,
    actor: createCombatActorExport(sheet),
  };
  for (const button of els.exportTabs) {
    button.classList.toggle("is-active", button.dataset.exportView === state.exportView);
  }
  els.exportOutput.textContent = JSON.stringify(payloads[state.exportView] || payloads.draft, null, 2);
}

function createCombatActorExport(sheet) {
  try {
    return resolvedSheetToCombatActor(sheet, {
      id: "creator_preview_actor",
      position: { x: 0, y: 0 },
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function renderResolverChoices(report) {
  const requirements = report.requirements.filter((item) => isResolverChoiceRequirement(item));
  const nodes = requirements.length ? requirements.map(renderResolverChoice) : [emptyPool("No unresolved feature choices.")];
  els.resolverChoices.replaceChildren(...nodes);
}

function renderResolverChoice(requirement) {
  if (requirement.kind === "origin_feat_choice" && requirement.source?.featId === "skilled") {
    return renderMultiChoice(requirement, skillOrToolOptions(), getFeatChoice(requirement), (values) => {
      setFeatChoice(requirement, values);
      render();
    });
  }
  return renderMultiChoice(requirement, genericRequirementOptions(requirement), getRequirementSelection(requirement), (values) => {
    setRequirementSelection(requirement, values);
    render();
  });
}

function renderMultiChoice(requirement, options, selected, onChange) {
  const card = document.createElement("section");
  card.className = "pool";
  const head = document.createElement("div");
  head.className = "pool-head";
  head.innerHTML = `<div class="pool-title">${requirement.label}</div><div class="pool-count">Choose ${requirement.count}</div>`;
  const list = document.createElement("div");
  list.className = "option-list";
  for (const option of options) {
    const label = document.createElement("label");
    label.className = "option";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = selected.includes(option.id);
    input.addEventListener("change", () => {
      const next = new Set(selected);
      if (input.checked) next.add(option.id);
      else next.delete(option.id);
      onChange(Array.from(next).slice(0, requirement.count));
    });
    const text = document.createElement("span");
    text.innerHTML = `${option.name}<span class="option-meta">${option.meta || ""}</span>`;
    label.append(input, text);
    list.append(label);
  }
  card.append(head, list);
  return card;
}

function isResolverChoiceRequirement(requirement) {
  return ["skill", "origin_feat_choice", "tool", "spell", "class"].includes(requirement.kind) &&
    !String(requirement.id || "").startsWith("spells.");
}

function genericRequirementOptions(requirement) {
  if (requirement.kind === "skill" && requirement.options?.length) {
    return requirement.options.map((id) => ({ id, name: titleCase(id), meta: "Skill" }));
  }
  return (requirement.options || []).map((option) => {
    if (typeof option === "string") return { id: option, name: titleCase(option), meta: requirement.kind };
    return { id: option.id, name: option.name || option.id, meta: requirement.kind };
  });
}

function skillOrToolOptions() {
  return [
    ...SKILL_OPTIONS.map((id) => ({ id: `skill:${id}`, name: titleCase(id), meta: "Skill" })),
    { id: "tool:thieves_tools", name: "Thieves' Tools", meta: "Tool" },
    { id: "tool:forgery_kit", name: "Forgery Kit", meta: "Tool" },
    { id: "tool:playing_card_set", name: "Playing Card Set", meta: "Tool" },
    { id: "tool:tinkers_tools", name: "Tinker's Tools", meta: "Tool" },
  ];
}

function getRequirementSelection(requirement) {
  const source = requirement.source || {};
  if (source.type === "missing_species_feature_choice") {
    const selected = state.draft.choices.speciesChoices[source.choiceId];
    return Array.isArray(selected) ? selected : selected ? [selected] : [];
  }
  return [];
}

function setRequirementSelection(requirement, values) {
  const source = requirement.source || {};
  if (source.type === "missing_species_feature_choice") {
    state.draft.choices.speciesChoices[source.choiceId] = requirement.count === 1 ? values[0] : values;
  }
}

function getFeatChoice(requirement) {
  const source = requirement.source || {};
  const selected = state.draft.choices.featChoices?.[source.featId]?.[source.choiceId];
  return Array.isArray(selected) ? selected : selected ? [selected] : [];
}

function setFeatChoice(requirement, values) {
  const source = requirement.source || {};
  if (!state.draft.choices.featChoices[source.featId]) state.draft.choices.featChoices[source.featId] = {};
  state.draft.choices.featChoices[source.featId][source.choiceId] = values;
}

function renderRequirements(report) {
  if (report.requirements.length === 0) return [li("No outstanding requirements.", "")];
  return report.requirements.map((item) => li(item.label, `${item.stepId} · ${item.path || item.kind}`));
}

function renderPreviewSummary(preview) {
  return [
    summaryRow("Identity", `${preview.identity.characterName || "Unnamed"} · ${preview.identity.species.name || "No species"} · ${preview.identity.background.name || "No background"} · ${preview.identity.class.name || "No class"}`),
    summaryRow("Combat", `AC ${preview.combat.armorClass ?? "?"} · HP ${preview.combat.maxHp ?? "?"} · Speed ${preview.combat.speed ?? "?"}`),
    summaryRow("Gear", preview.equipment.weapons.map((item) => item.name).join(", ") || "No weapons"),
    summaryRow("Spells", [...preview.spells.known, ...preview.spells.prepared].map((spell) => spell.name).join(", ") || "No spells"),
    summaryRow("Narrative", preview.narrative.tags.join(", ") || "No narrative tags"),
    summaryRow("Warnings", `${preview.warnings.unresolved.length} unresolved · ${preview.warnings.unimplementedFeatures.length} future features`),
  ];
}

function fillSelect(select, records, options = {}) {
  const nodes = [];
  if (options.emptyLabel) nodes.push(new Option(options.emptyLabel, ""));
  for (const record of records) nodes.push(new Option(record.name, record.id));
  select.replaceChildren(...nodes);
}

function emptyPool(message) {
  const card = document.createElement("section");
  card.className = "pool";
  card.textContent = message;
  return card;
}

function summaryRow(label, value) {
  const row = document.createElement("div");
  row.className = "summary-row";
  row.innerHTML = `<strong>${label}</strong>${value}`;
  return row;
}

function li(label, meta) {
  const item = document.createElement("li");
  item.innerHTML = `${label}<span class="requirement-meta">${meta}</span>`;
  return item;
}

function formatCount(count) {
  if (Number.isFinite(count)) return `Choose ${count}`;
  return `Choose ${count.min}-${count.max}`;
}

function optionMeta(option) {
  if (option.level !== undefined) {
    const level = option.level === 0 ? "Cantrip" : `Level ${option.level}`;
    const tags = [level, option.school, option.concentration ? "Concentration" : null].filter(Boolean);
    return tags.join(" · ");
  }
  return [option.type, option.damage, option.ac ? `AC ${option.ac}` : null, ...(option.properties || [])].filter(Boolean).join(" · ");
}

function title(value) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function titleCase(value) {
  return title(String(value));
}

function unique(values) {
  return [...new Set(values)];
}
