import { BACKGROUND_LIST } from "../../data/backgrounds.js";
import { CLASS_LIST } from "../../data/classes.js";
import { listDeviceRecipes } from "../../data/deviceRecipes.js";
import { getFeatById } from "../../data/feats.js";
import { SPECIES_LIST } from "../../data/species.js";
import { SPELLS } from "../../data/spells.js";
import { getWeaponById } from "../../data/weapons.js";
import {
  STANDARD_ABILITY_ARRAY,
  assignBackgroundAbilityBonus,
  assignClassDefaultAbilityScores,
  assignStandardAbilityScore,
  createChoiceRequirementsReport,
  createCombatActorBridgeReport,
  createFeatChoicePools,
  createEmptyCharacterDraft,
  createGearChoicePools,
  createWeaponMasteryChoicePools,
  createResolvedSheetPreview,
  createSpellChoicePools,
  resolveCharacterSheet,
} from "../../character/index.js";
import { createCharacterSaveUi } from "../characterSaveUi.js";
import { ABILITIES, SKILL_OPTIONS, title, titleCase, unique } from "../creatorHarnessOptions.js";
import { renderPipelineExport } from "../pipelineExportUi.js";
import { renderRequirementsList } from "../requirementsUi.js";

const PORTRAIT_ASSETS = {
  class: {
    fighter: "assets/portraits/fighter-negative-ink.png",
    rogue: "assets/portraits/rogue-negative-ink.png",
    cleric: "assets/portraits/cleric-negative-ink.png",
    paladin: "assets/portraits/paladin-negative-ink.png",
    wizard: "assets/portraits/wizard-negative-ink.png",
    warlock: "assets/portraits/warlock-negative-ink.png",
  },
  species: {
    aasimar: "assets/portraits/aasimar-negative-ink.png",
    dragonborn: "assets/portraits/dragonborn-negative-ink.png",
    dwarf: "assets/portraits/dwarf-negative-ink.png",
    elf: "assets/portraits/elf-negative-ink.png",
    gnome: "assets/portraits/gnome-negative-ink.png",
    goliath: "assets/portraits/goliath-negative-ink.png",
    halfling: "assets/portraits/halfling-negative-ink.png",
    human: "assets/portraits/human-negative-ink.png",
    orc: "assets/portraits/orc-negative-ink.png",
    tiefling: "assets/portraits/tiefling-negative-ink.png",
  },
  subclass: {
    champion: "assets/portraits/champion-negative-ink.png",
    duelist: "assets/portraits/duelist-negative-ink.png",
    berserker: "assets/portraits/berserker-negative-ink.png",
    assassin: "assets/portraits/assassin-negative-ink.png",
    cutthroat: "assets/portraits/cutthroat-negative-ink.png",
    saboteur: "assets/portraits/saboteur-negative-ink.png",
    dirt_wizard: "assets/portraits/dirt_wizard-negative-ink.png",
    necromancer: "assets/portraits/necromancer-negative-ink.png",
    battlemage: "assets/portraits/battlemage-negative-ink.png",
    the_fiend: "assets/portraits/the_fiend-negative-ink.png",
    the_undead: "assets/portraits/the_undead-negative-ink.png",
    the_lantern: "assets/portraits/the_lantern-negative-ink.png",
    grave_domain: "assets/portraits/grave_domain-negative-ink.png",
    lantern_domain: "assets/portraits/lantern_domain-negative-ink.png",
    war_domain: "assets/portraits/war_domain-negative-ink.png",
    oath_of_vengeance: "assets/portraits/oath_of_vengeance-negative-ink.png",
    oath_of_the_sacred: "assets/portraits/oath_of_the_sacred-negative-ink.png",
    oath_of_glory: "assets/portraits/oath_of_glory-negative-ink.png",
  },
};

const state = {
  exportView: "draft",
  currentStep: "identity",
  optionInfo: null,
  lockedOptionInfo: null,
  scrollPositions: {},
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
      dexterity: 12,
      constitution: 13,
      intelligence: 14,
      wisdom: 11,
      charisma: 10,
    },
    gear: { weaponIds: ["quarterstaff"] },
    spells: { knownSpellIds: ["fire_bolt"], preparedSpellIds: ["magic_missile"] },
    choices: { backgroundAbilityScores: [{ ability: "intelligence", bonus: 2 }, { ability: "wisdom", bonus: 1 }] },
  }),
};

const CREATOR_STEPS = [
  { id: "identity", label: "Core" },
  { id: "abilities", label: "Abilities" },
  { id: "choices", label: "Choices" },
  { id: "feats", label: "Feats" },
  { id: "spells", label: "Spells" },
  { id: "gear", label: "Gear" },
];

const els = {
  stepNav: document.querySelector("#stepNav"),
  steps: [...document.querySelectorAll(".creator-step")],
  previousStepButton: document.querySelector("#previousStepButton"),
  nextStepButton: document.querySelector("#nextStepButton"),
  optionInfo: document.querySelector("#optionInfo"),
  characterName: document.querySelector("#characterName"),
  speciesSelect: document.querySelector("#speciesSelect"),
  speciesCards: document.querySelector("#speciesCards"),
  lineageField: document.querySelector("#lineageField"),
  lineageSelect: document.querySelector("#lineageSelect"),
  backgroundSelect: document.querySelector("#backgroundSelect"),
  classSelect: document.querySelector("#classSelect"),
  classCards: document.querySelector("#classCards"),
  subclassField: document.querySelector("#subclassField"),
  subclassSelect: document.querySelector("#subclassSelect"),
  subclassCards: document.querySelector("#subclassCards"),
  levelSelect: document.querySelector("#levelSelect"),
  abilityInputs: document.querySelector("#abilityInputs"),
  backgroundAbilityBonuses: document.querySelector("#backgroundAbilityBonuses"),
  resolverChoices: document.querySelector("#resolverChoices"),
  featPools: document.querySelector("#featPools"),
  spellPools: document.querySelector("#spellPools"),
  gearPools: document.querySelector("#gearPools"),
  completionState: document.querySelector("#completionState"),
  requirementsList: document.querySelector("#requirementsList"),
  previewSummary: document.querySelector("#previewSummary"),
  combatActions: document.querySelector("#combatActions"),
  bridgeReport: document.querySelector("#bridgeReport"),
  exportOutput: document.querySelector("#exportOutput"),
  exportTabs: [...document.querySelectorAll("[data-export-view]")],
  saveCharacterButton: document.querySelector("#saveCharacterButton"),
  saveStatus: document.querySelector("#saveStatus"),
  resetButton: document.querySelector("#resetButton"),
};

init();

function init() {
  fillSelect(els.speciesSelect, SPECIES_LIST);
  fillSelect(els.backgroundSelect, BACKGROUND_LIST);
  fillSelect(els.classSelect, CLASS_LIST);
  renderStepNav();
  renderAbilityInputs();
  bindCoreEvents();
  createCharacterSaveUi({
    button: els.saveCharacterButton,
    status: els.saveStatus,
    getDraft: () => state.draft,
    actorOptions: { id: "saved_player_character", position: { x: 1, y: 1 } },
    resolveOptions: { allowNonCreationLevel: true },
  });
  render();
}

function bindCoreEvents() {
  els.previousStepButton.addEventListener("click", () => moveStep(-1));
  els.nextStepButton.addEventListener("click", () => moveStep(1));
  els.characterName.addEventListener("input", () => {
    state.draft.identity.characterName = els.characterName.value;
    render();
  });
  els.speciesSelect.addEventListener("focus", () => setOptionInfo(speciesInfo(SPECIES_LIST.find((item) => item.id === state.draft.identity.speciesId))));
  els.speciesSelect.addEventListener("change", () => {
    state.draft.identity.speciesId = els.speciesSelect.value;
    state.draft.identity.lineageId = null;
    state.draft.choices.speciesChoices = {};
    setOptionInfo(speciesInfo(SPECIES_LIST.find((item) => item.id === state.draft.identity.speciesId)), { lock: true });
    render();
  });
  els.lineageSelect.addEventListener("change", () => {
    state.draft.identity.lineageId = els.lineageSelect.value || null;
    const species = SPECIES_LIST.find((item) => item.id === state.draft.identity.speciesId);
    setOptionInfo(lineageInfo(Object.values(species?.lineages || {}).find((item) => item.id === state.draft.identity.lineageId), species), { lock: true });
    render();
  });
  els.lineageSelect.addEventListener("focus", () => {
    const species = SPECIES_LIST.find((item) => item.id === state.draft.identity.speciesId);
    setOptionInfo(lineageInfo(Object.values(species?.lineages || {}).find((item) => item.id === state.draft.identity.lineageId), species));
  });
  els.backgroundSelect.addEventListener("focus", () => setOptionInfo(backgroundInfo(BACKGROUND_LIST.find((item) => item.id === state.draft.identity.backgroundId))));
  els.backgroundSelect.addEventListener("change", () => {
    state.draft.identity.backgroundId = els.backgroundSelect.value;
    state.draft.choices.featChoices = {};
    state.draft.choices.backgroundAbilityScores = [];
    setOptionInfo(backgroundInfo(BACKGROUND_LIST.find((item) => item.id === state.draft.identity.backgroundId)), { lock: true });
    render();
  });
  els.classSelect.addEventListener("focus", () => setOptionInfo(classInfo(CLASS_LIST.find((item) => item.id === state.draft.identity.classId))));
  els.classSelect.addEventListener("change", () => {
    state.draft.identity.classId = els.classSelect.value;
    state.draft.identity.subclassId = null;
    state.draft.identity.pactId = null;
    state.draft.spells.knownSpellIds = [];
    state.draft.spells.preparedSpellIds = [];
    state.draft.gear.weaponIds = [];
    state.draft.gear.armorId = null;
    state.draft.gear.shieldId = null;
    state.draft.choices.weaponMasteryIds = [];
    assignClassDefaultAbilityScores(state.draft, els.classSelect.value);
    setOptionInfo(classInfo(CLASS_LIST.find((item) => item.id === state.draft.identity.classId)), { lock: true });
    render();
  });
  els.subclassSelect.addEventListener("focus", () => {
    const classRecord = CLASS_LIST.find((item) => item.id === state.draft.identity.classId);
    setOptionInfo(subclassInfo(subclassOptions(classRecord).find((item) => item.id === state.draft.identity.subclassId), classRecord));
  });
  els.subclassSelect.addEventListener("change", () => {
    state.draft.identity.subclassId = els.subclassSelect.value || null;
    const classRecord = CLASS_LIST.find((item) => item.id === state.draft.identity.classId);
    setOptionInfo(subclassInfo(subclassOptions(classRecord).find((item) => item.id === state.draft.identity.subclassId), classRecord), { lock: true });
    render();
  });
  els.levelSelect.addEventListener("change", () => {
    state.draft.identity.level = Number(els.levelSelect.value) || 1;
    if ((state.draft.identity.level || 1) < 3) {
      state.draft.identity.subclassId = null;
      state.draft.identity.pactId = null;
    }
    state.draft.choices.advancementChoices = {};
    render();
  });
  els.resetButton.addEventListener("click", () => {
    state.draft = createEmptyCharacterDraft();
    state.optionInfo = null;
    state.lockedOptionInfo = null;
    state.currentStep = "identity";
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
  captureScrollPositions();
  renderStepState();
  els.characterName.value = state.draft.identity.characterName || "";
  els.speciesSelect.value = state.draft.identity.speciesId || "";
  els.backgroundSelect.value = state.draft.identity.backgroundId || "";
  els.classSelect.value = state.draft.identity.classId || "";
  els.levelSelect.value = String(state.draft.identity.level || 1);
  renderSpeciesCards();
  renderClassCards();
  renderLineageSelect();
  renderSubclassSelect();
  renderAbilityValues();
  renderBackgroundAbilityBonuses();
  renderSpellPools();
  renderFeatPools();
  renderGearPools();
  renderReports();
  renderOptionInfo();
  restoreScrollPositions();
}

function renderStepNav() {
  els.stepNav.replaceChildren(...CREATOR_STEPS.map((step) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "step-button";
    button.dataset.step = step.id;
    button.textContent = step.label;
    button.addEventListener("click", () => {
      state.currentStep = step.id;
      render();
    });
    return button;
  }));
}

function renderStepState() {
  const index = currentStepIndex();
  for (const section of els.steps) section.hidden = section.dataset.step !== state.currentStep;
  for (const button of els.stepNav.querySelectorAll(".step-button")) {
    button.classList.toggle("is-active", button.dataset.step === state.currentStep);
  }
  els.previousStepButton.disabled = index <= 0;
  els.nextStepButton.disabled = index >= CREATOR_STEPS.length - 1;
}

function moveStep(delta) {
  const nextIndex = Math.max(0, Math.min(CREATOR_STEPS.length - 1, currentStepIndex() + delta));
  state.currentStep = CREATOR_STEPS[nextIndex].id;
  render();
}

function currentStepIndex() {
  return Math.max(0, CREATOR_STEPS.findIndex((step) => step.id === state.currentStep));
}

function renderSpeciesCards() {
  els.speciesCards.dataset.scrollKey = "cards:species";
  els.speciesCards.replaceChildren(...SPECIES_LIST.map((species) => renderChoiceCard({
    info: speciesInfo(species),
    selected: species.id === state.draft.identity.speciesId,
    onSelect: () => {
      state.draft.identity.speciesId = species.id;
      state.draft.identity.lineageId = null;
      state.draft.choices.speciesChoices = {};
      setOptionInfo(speciesInfo(species), { lock: true });
      render();
    },
  })));
}

function renderClassCards() {
  els.classCards.dataset.scrollKey = "cards:class";
  els.classCards.replaceChildren(...CLASS_LIST.map((classRecord) => renderChoiceCard({
    info: classInfo(classRecord),
    selected: classRecord.id === state.draft.identity.classId,
    onSelect: () => {
      state.draft.identity.classId = classRecord.id;
      state.draft.identity.subclassId = null;
      state.draft.identity.pactId = null;
      state.draft.spells.knownSpellIds = [];
      state.draft.spells.preparedSpellIds = [];
      state.draft.gear.weaponIds = [];
      state.draft.gear.armorId = null;
      state.draft.gear.shieldId = null;
      state.draft.choices.weaponMasteryIds = [];
      assignClassDefaultAbilityScores(state.draft, classRecord.id);
      setOptionInfo(classInfo(classRecord), { lock: true });
      render();
    },
  })));
}

function renderSubclassSelect() {
  const classRecord = CLASS_LIST.find((item) => item.id === state.draft.identity.classId);
  const subclasses = subclassOptions(classRecord);
  const requiresSubclass = (state.draft.identity.level || 1) >= 3 && subclasses.length > 0;
  els.subclassField.hidden = !requiresSubclass;
  if (!requiresSubclass) {
    els.subclassSelect.replaceChildren();
    els.subclassCards.replaceChildren();
    return;
  }
  fillSelect(els.subclassSelect, subclasses, { emptyLabel: "Choose subclass" });
  els.subclassSelect.value = state.draft.identity.subclassId || "";
  els.subclassCards.dataset.scrollKey = "cards:subclass";
  els.subclassCards.replaceChildren(...subclasses.map((subclass) => renderChoiceCard({
    info: subclassInfo(subclass, classRecord),
    selected: subclass.id === state.draft.identity.subclassId,
    onSelect: () => {
      state.draft.identity.subclassId = subclass.id;
      setOptionInfo(subclassInfo(subclass, classRecord), { lock: true });
      render();
    },
  })));
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
  const masteryPools = createWeaponMasteryChoicePools(state.draft);
  els.gearPools.replaceChildren(
    ...gearPools.pools.map((pool) => renderOptionPool(pool, "gear")),
    ...masteryPools.pools.map((pool) => renderOptionPool(pool, "mastery"))
  );
}

function renderFeatPools() {
  const featPools = createFeatChoicePools(state.draft);
  const nodes = featPools.pools.length
    ? featPools.pools.map((pool) => renderOptionPool(pool, "feat"))
    : [emptyPool("No general feat choices at this level.")];
  els.featPools.replaceChildren(...nodes);
}

function renderOptionPool(pool, type) {
  const card = document.createElement("section");
  card.className = "pool";
  card.dataset.scrollKey = `pool:${type}:${pool.id}`;

  const head = document.createElement("div");
  head.className = "pool-head";
  head.innerHTML = `<div class="pool-title">${pool.label}</div><div class="pool-count">${formatPoolCount(pool, type)}</div>`;

  const list = document.createElement("div");
  list.className = "option-list";
  for (const option of pool.options) {
    list.append(renderOption(pool, option, type));
  }

  card.append(head, list);
  return card;
}

function renderChoiceCard({ info, selected, onSelect }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "choice-card";
  button.classList.toggle("is-selected", selected);
  button.innerHTML = `
    <span>
      <span class="choice-card-title">${info.title}</span>
      <span class="choice-card-meta">${info.meta}</span>
    </span>
  `;
  button.addEventListener("mouseenter", () => setOptionInfo(info));
  button.addEventListener("mouseleave", () => restoreLockedOptionInfo());
  button.addEventListener("focus", () => setOptionInfo(info));
  button.addEventListener("click", onSelect);
  return button;
}

function renderOption(pool, option, type) {
  const row = document.createElement("div");
  row.className = "option-row";
  const label = document.createElement("label");
  label.className = "option";

  const input = document.createElement("input");
  const grantDetail = type === "spell" ? spellGrantDetail(pool, option.id) : null;
  const granted = Boolean(grantDetail);
  input.type = "checkbox";
  input.checked = granted || pool.selected.includes(option.id);
  input.disabled = granted;
  input.title = granted ? `${grantDetail.label}; does not count against class spell choices.` : "";
  input.addEventListener("focus", () => setOptionInfo(optionInfo(option, type, grantDetail)));
  input.addEventListener("change", () => updatePoolSelection(pool, option.id, input.checked, type));

  const text = document.createElement("span");
  text.innerHTML = `${option.name}<span class="option-meta">${optionMeta(option)}${optionStatusMeta(type, grantDetail)}</span>`;
  label.addEventListener("mouseenter", () => setOptionInfo(optionInfo(option, type, grantDetail)));
  label.append(input, text);
  row.append(label);

  if (type === "feat" && input.checked) {
    const details = renderSelectedFeatChoices(option.id);
    if (details) row.append(details);
  }

  return row;
}

function renderSelectedFeatChoices(featId) {
  const requirements = activeFeatChoiceRequirements().filter((requirement) => requirement.source?.featId === featId);
  if (!requirements.length) return null;
  const details = document.createElement("div");
  details.className = "feat-choice-details";
  details.replaceChildren(...requirements.map(renderResolverChoice));
  return details;
}

function updatePoolSelection(pool, optionId, checked, type) {
  const max = Number.isFinite(pool.count) ? pool.count : pool.count.max;
  const selected = new Set(pool.selected);
  if (checked) selected.add(optionId);
  else selected.delete(optionId);
  const values = Array.from(selected).slice(0, max);

  if (type === "spell") {
    updateSpellSelection(pool, values);
  } else if (type === "feat") {
    updateFeatSelection(pool, values);
  } else if (type === "mastery") {
    state.draft.choices.weaponMasteryIds = values;
  } else {
    updateGearSelection(pool, values);
  }
  render();
}

function updateSpellSelection(pool, values) {
  const spellChoices = createSpellChoicePools(state.draft);
  const spellPools = spellChoices.pools;
  const otherKnown = spellPools
    .filter((item) => item.mode === "known" && item.id !== pool.id)
    .flatMap((item) => item.selected);
  if (pool.mode === "known") state.draft.spells.knownSpellIds = unique([...(spellChoices.granted?.known || []), ...otherKnown, ...values]);
  if (pool.mode === "prepared") state.draft.spells.preparedSpellIds = unique([...(spellChoices.granted?.prepared || []), ...values]);
}

function updateGearSelection(pool, values) {
  if (pool.id === "weapons") {
    state.draft.gear.weaponIds = values;
  }
  if (pool.id === "armor") state.draft.gear.armorId = values[0] || null;
  if (pool.id === "shield") state.draft.gear.shieldId = values[0] || null;
}

function updateFeatSelection(pool, values) {
  state.draft.choices.advancementChoices ??= {};
  if (!values[0]) delete state.draft.choices.advancementChoices[pool.id];
  else state.draft.choices.advancementChoices[pool.id] = { kind: "feat", featId: values[0] };
}

function renderReports() {
  const sheet = resolveCharacterSheet(state.draft, {}, { allowNonCreationLevel: true });
  const report = createChoiceRequirementsReport(state.draft, { sheet, allowNonCreationLevel: true });
  const preview = createResolvedSheetPreview(sheet);
  const bridgeReport = createCombatActorBridgeReport(sheet, {
    actorOptions: { id: "creator_preview_actor", position: { x: 0, y: 0 } },
  });

  renderResolverChoices(report, sheet);
  els.completionState.textContent = report.complete ? "Complete" : `${report.requirements.length} item${report.requirements.length === 1 ? "" : "s"} needed`;
  els.completionState.classList.toggle("complete", report.complete);
  els.requirementsList.replaceChildren(...renderRequirementsList(report));
  els.previewSummary.replaceChildren(...renderPreviewSummary(preview));
  els.combatActions.replaceChildren(...preview.combatActions.map((action) => li(`${action.name}`, `${action.cost} · ${action.type}`)));
  els.bridgeReport.replaceChildren(...renderBridgeReport(bridgeReport));
  renderPipelineExport({ buttons: els.exportTabs, output: els.exportOutput, exportView: state.exportView, draft: state.draft, sheet });
}

function renderResolverChoices(report, sheet) {
  const stableChoices = [
    ...activeResolvedFeatureChoiceRequirements(sheet),
    ...activeFeatChoiceRequirements(),
  ];
  const stablePaths = new Set(stableChoices.map((item) => item.path));
  const requirements = report.requirements
    .filter((item) => isResolverChoiceRequirement(item))
    .filter((item) => !stablePaths.has(item.path));
  const nodes = [...stableChoices, ...requirements].map(renderResolverChoice);
  els.resolverChoices.replaceChildren(...(nodes.length ? nodes : [emptyPool("No feature choices.")]));
}

function renderResolverChoice(requirement) {
  if (requirement.source?.featId && ["ability_score", "saving_throw_ability"].includes(requirement.source?.kind)) {
    return renderRepeatedChoice(requirement, genericRequirementOptions(requirement), getFeatChoice(requirement), (values) => {
      setFeatChoice(requirement, values);
      render();
    });
  }
  if (requirement.kind === "origin_feat_choice") {
    const options = requirement.source?.featId === "skilled" ? skillOrToolOptions() : genericRequirementOptions(requirement);
    return renderMultiChoice(requirement, options, getFeatChoice(requirement), (values) => {
      setFeatChoice(requirement, values);
      render();
    });
  }
  if (isFeatChoiceRequirement(requirement)) {
    return renderMultiChoice(requirement, genericRequirementOptions(requirement), getFeatChoice(requirement), (values) => {
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
  card.dataset.scrollKey = `requirement:${requirement.path || requirement.id}`;
  const optionIds = new Set(options.map((option) => option.id));
  const current = selected.filter((value) => optionIds.has(value));
  const head = document.createElement("div");
  head.className = "pool-head";
  head.innerHTML = `<div class="pool-title">${requirement.label}</div><div class="pool-count">${formatChosenCount(current.length, requirement.count)}</div>`;
  const list = document.createElement("div");
  list.className = "option-list";
  for (const option of options) {
    const label = document.createElement("label");
    label.className = "option";
    label.addEventListener("mouseenter", () => setOptionInfo(optionInfo(option, requirement.kind)));
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = current.includes(option.id);
    input.addEventListener("focus", () => setOptionInfo(optionInfo(option, requirement.kind)));
    input.addEventListener("change", () => {
      const next = new Set(current);
      if (input.checked) next.add(option.id);
      else next.delete(option.id);
      onChange(Array.from(next).slice(0, maxCount(requirement.count)));
    });
    const text = document.createElement("span");
    text.innerHTML = `${option.name}<span class="option-meta">${option.meta || ""}</span>`;
    label.append(input, text);
    list.append(label);
  }
  card.append(head, list);
  return card;
}

function renderRepeatedChoice(requirement, options, selected, onChange) {
  const card = document.createElement("section");
  card.className = "pool";
  card.dataset.scrollKey = `requirement:${requirement.path || requirement.id}`;
  const head = document.createElement("div");
  head.className = "pool-head";
  head.innerHTML = `<div class="pool-title">${requirement.label}</div><div class="pool-count">${formatChosenCount(selected.filter(Boolean).length, requirement.count)}</div>`;
  const list = document.createElement("div");
  list.className = "option-list";
  for (let index = 0; index < requirement.count; index += 1) {
    const label = document.createElement("label");
    label.className = "choice-row";
    const text = document.createElement("span");
    text.textContent = `Choice ${index + 1}`;
    const select = document.createElement("select");
    select.replaceChildren(
      new Option("Choose option", ""),
      ...options.map((option) => new Option(`${option.name}${option.meta ? ` (${option.meta})` : ""}`, option.id))
    );
    select.value = selected[index] || "";
    select.addEventListener("focus", () => setOptionInfo(requirementInfo(requirement)));
    select.addEventListener("change", () => {
      const next = [...selected];
      next[index] = select.value;
      const option = options.find((item) => item.id === select.value);
      setOptionInfo(option ? optionInfo(option, requirement.kind) : requirementInfo(requirement));
      onChange(next.filter(Boolean).slice(0, requirement.count));
    });
    label.append(text, select);
    list.append(label);
  }
  card.append(head, list);
  return card;
}

function isResolverChoiceRequirement(requirement) {
  return ["skill", "origin_feat_choice", "origin_feat", "tool", "spell", "class", "weapon", "device_recipe", "ability_score", "saving_throw_ability", "skill_expertise", "skill_or_tool", "damage_type"].includes(requirement.kind) &&
    !String(requirement.id || "").startsWith("spells.");
}

function isFeatChoiceRequirement(requirement) {
  return requirement.source?.type === "missing_origin_feat_choice" ||
    requirement.source?.type === "invalid_origin_feat_choice_count";
}

function genericRequirementOptions(requirement) {
  if (requirement.kind === "skill" && requirement.options?.length) {
    return requirement.options.map((id) => ({ id, name: titleCase(id), meta: "Skill" }));
  }
  if (requirement.kind === "weapon") {
    return (requirement.options?.length ? requirement.options : state.draft.gear.weaponIds || [])
      .map((id) => {
        const weapon = getWeaponById(id);
        return { id, name: weapon?.name || titleCase(id), meta: "Equipped weapon" };
      });
  }
  if (requirement.kind === "device_recipe") {
    return listDeviceRecipes({
      ids: requirement.options || [],
      level: state.draft.identity.level || 1,
    }).map((recipe) => ({ id: recipe.id, name: recipe.name, meta: `Level ${recipe.minLevel} recipe`, description: recipe.text }));
  }
  return (requirement.options || []).map((option) => {
    if (typeof option === "string") return { id: option, name: titleCase(option), meta: requirement.kind };
    return { id: option.id, name: option.name || option.id, meta: option.meta || requirement.kind };
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
  if (source.type === "missing_species_feature_choice" || source.type === "stable_species_feature_choice") {
    const selected = state.draft.choices.speciesChoices[source.choiceId];
    return Array.isArray(selected) ? selected : selected ? [selected] : [];
  }
  if (source.type === "missing_class_feature_choice" || source.type === "stable_class_feature_choice") {
    const selected = state.draft.choices.classChoices?.[source.choiceId];
    return Array.isArray(selected) ? selected : selected ? [selected] : [];
  }
  return [];
}

function setRequirementSelection(requirement, values) {
  const source = requirement.source || {};
  if (source.type === "missing_species_feature_choice" || source.type === "stable_species_feature_choice") {
    state.draft.choices.speciesChoices[source.choiceId] = requirement.count === 1 ? values[0] : values;
  }
  if (source.type === "missing_class_feature_choice" || source.type === "stable_class_feature_choice") {
    state.draft.choices.classChoices ??= {};
    state.draft.choices.classChoices[source.choiceId] = requirement.count === 1 ? values[0] : values;
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

function activeFeatChoiceRequirements() {
  return selectedAdvancementFeatIds().flatMap((featId) => {
    const feat = getFeatById(featId);
    return (feat?.choices || [])
      .filter((choice) => choiceOptions(choice).length)
      .map((choice) => ({
        id: choice.id,
        stepId: "class",
        kind: "origin_feat_choice",
        severity: "question",
        label: `Choose ${choice.count || 1} ${choiceLabel(choice.id, choice.kind, choice.count || 1)} for ${feat.name}.`,
        path: `choices.featChoices.${feat.id}.${choice.id}`,
        count: choice.count || 1,
        options: choiceOptions(choice),
        source: {
          type: "selected_origin_feat_choice",
          featId: feat.id,
          choiceId: choice.id,
          kind: choice.kind,
          count: choice.count || 1,
        },
      }));
  });
}

function choiceOptions(choice) {
  if (Array.isArray(choice.options)) {
    return choice.options.map((option) => ({ id: option, name: titleCase(option), meta: choice.kind }));
  }
  if (choice.kind === "spell" || choice.kind === "spell_list") {
    return Object.values(SPELLS)
      .filter((spell) => spell?.active !== false)
      .filter((spell) => spellAllowedForChoice(choice, spell))
      .map((spell) => ({ id: spell.id, name: spell.name, meta: `${spell.level === 0 ? "Cantrip" : `Level ${spell.level}`} · ${spell.school}${spell.ritual ? " · Ritual" : ""}` }));
  }
  return [];
}

function spellAllowedForChoice(choice, spell) {
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

function activeResolvedFeatureChoiceRequirements(sheet) {
  return (sheet.features || []).flatMap((feature) => {
    const sourceType = feature.source === "species" ? "stable_species_feature_choice" :
      feature.source === "class" || feature.source === "subclass" ? "stable_class_feature_choice" : null;
    if (!sourceType) return [];
    return (feature.effects?.choiceRequirements || []).map((choice) => ({
      id: choice.id,
      stepId: sourceType === "stable_species_feature_choice" ? "species" : "class",
      kind: choice.kind,
      severity: "question",
      label: `Choose ${choice.count || 1} ${choiceLabel(choice.id, choice.kind, choice.count || 1)} for ${feature.name}.`,
      path: `${sourceType === "stable_species_feature_choice" ? "choices.speciesChoices" : "choices.classChoices"}.${choice.id}`,
      count: choice.count || 1,
      options: resolvedFeatureChoiceOptions(choice),
      source: {
        type: sourceType,
        featureId: feature.id,
        choiceId: choice.id,
        kind: choice.kind,
        count: choice.count || 1,
      },
    }));
  });
}

function resolvedFeatureChoiceOptions(choice) {
  if (choice.options?.length) return choice.options;
  if (choice.kind === "device_recipe") {
    const classRecord = CLASS_LIST.find((item) => item.id === state.draft.identity.classId);
    const subclass = Object.values(classRecord?.subclasses || {}).find((item) => item.id === state.draft.identity.subclassId);
    return listDeviceRecipes({
      ids: (subclass?.deviceRecipes || []).map((item) => typeof item === "string" ? item : item.id),
      level: state.draft.identity.level || 1,
    }).map((recipe) => recipe.id);
  }
  if (choice.kind === "weapon") return [...(state.draft.gear.weaponIds || [])];
  return [];
}

function subclassOptions(classRecord) {
  return Object.entries(classRecord?.subclasses || {}).map(([name, record]) => ({
    id: record.id,
    name: record.name || name,
  }));
}

function selectedAdvancementFeatIds() {
  return unique(Object.values(state.draft.choices.advancementChoices || {})
    .map((choice) => choice?.featId)
    .filter(Boolean));
}

function captureScrollPositions() {
  document.querySelectorAll("[data-scroll-key] .option-list, [data-scroll-key].choice-card-grid").forEach((node) => {
    const key = scrollKeyFor(node);
    if (key) state.scrollPositions[key] = node.scrollTop;
  });
}

function restoreScrollPositions() {
  requestAnimationFrame(() => {
    document.querySelectorAll("[data-scroll-key] .option-list, [data-scroll-key].choice-card-grid").forEach((node) => {
      const key = scrollKeyFor(node);
      if (key && Number.isFinite(state.scrollPositions[key])) node.scrollTop = state.scrollPositions[key];
    });
  });
}

function scrollKeyFor(node) {
  return node.dataset.scrollKey || node.closest("[data-scroll-key]")?.dataset.scrollKey || null;
}

function setOptionInfo(info, options = {}) {
  if (!info) return;
  state.optionInfo = info;
  if (options.lock) state.lockedOptionInfo = info;
  renderOptionInfo();
}

function restoreLockedOptionInfo() {
  state.optionInfo = null;
  renderOptionInfo();
}

function renderOptionInfo() {
  const info = state.optionInfo || state.lockedOptionInfo || selectedIdentityInfo() || defaultOptionInfo();
  const thumbContent = info.image
    ? `<div class="option-info-thumb is-image" style="background-image: url('${info.image}')"></div>`
    : `<div class="option-info-thumb">${info.initials}</div>`;
  els.optionInfo.innerHTML = `
    <div class="option-info-main">
      ${thumbContent}
      <div>
        <div class="option-info-title">${info.title}</div>
        <div class="option-info-meta">${info.meta}</div>
        <div class="option-info-text">${info.text}</div>
      </div>
    </div>
  `;
}

function selectedIdentityInfo() {
  if (state.currentStep !== "identity") return null;
  const classRecord = CLASS_LIST.find((item) => item.id === state.draft.identity.classId);
  if ((state.draft.identity.level || 1) >= 3 && state.draft.identity.subclassId) {
    const subclass = subclassOptions(classRecord).find((item) => item.id === state.draft.identity.subclassId);
    if (subclass) return subclassInfo(subclass, classRecord);
  }
  if (classRecord) return classInfo(classRecord);
  const species = SPECIES_LIST.find((item) => item.id === state.draft.identity.speciesId);
  return species ? speciesInfo(species) : null;
}

function defaultOptionInfo() {
  return {
    title: "Hover an option",
    initials: "?",
    meta: "Creator harness",
    text: "Hover or focus a class, species, subclass, spell, feat, or gear option to see a short summary here.",
  };
}

function speciesInfo(species) {
  if (!species) return defaultOptionInfo();
  const lineageCount = Object.keys(species.lineages || {}).length;
  const featureText = (species.features || []).map((feature) => feature.description || feature.name).filter(Boolean).slice(0, 3).join(" ");
  return {
    title: species.name,
    initials: initials(species.name),
    image: portraitAsset("species", species.id),
    meta: `Species${lineageCount ? ` · ${lineageCount} lineage option${lineageCount === 1 ? "" : "s"}` : ""}`,
    text: species.summary || species.description || featureText || `Size ${species.size || "medium"}; speed ${species.speed || 30} ft.`,
  };
}

function lineageInfo(lineage, species) {
  if (!lineage) {
    return {
      title: species ? `${species.name} lineage` : "Lineage",
      initials: "LN",
      meta: "Lineage refines species features",
      text: "Choose a lineage when the selected species has lineage variants. This can grant resistances, spells, or distinct species actions.",
    };
  }
  const featureText = (lineage.features || []).map((feature) => feature.description || feature.name).filter(Boolean).join(" ");
  const resistText = lineage.resistances?.length ? `Resistance: ${lineage.resistances.map(titleCase).join(", ")}.` : "";
  return {
    title: `${species?.name || "Species"}: ${lineage.name}`,
    initials: initials(lineage.name),
    meta: "Lineage",
    text: [featureText, resistText].filter(Boolean).join(" ") || "A lineage variant for the selected species.",
  };
}

function backgroundInfo(background) {
  if (!background) return defaultOptionInfo();
  return {
    title: background.name,
    initials: initials(background.name),
    meta: "Background",
    text: background.description || `Skills: ${(background.skillProficiencies || []).map(titleCase).join(", ") || "none"}.`,
  };
}

function classInfo(classRecord) {
  if (!classRecord) return defaultOptionInfo();
  return {
    title: classRecord.name,
    initials: initials(classRecord.name),
    image: portraitAsset("class", classRecord.id),
    meta: `Class · d${classRecord.hitDie} hit die · ${classRecord.primaryAbility?.join(", ") || "Flexible"}`,
    text: classRecord.summary || "",
  };
}

function subclassInfo(subclass, classRecord) {
  if (!subclass) return defaultOptionInfo();
  return {
    title: subclass.name,
    initials: initials(subclass.name),
    image: portraitAsset("subclass", subclass.id),
    meta: `${classRecord?.name || "Class"} subclass`,
    text: subclass.summary || subclass.description || "",
  };
}

function portraitAsset(kind, id) {
  return PORTRAIT_ASSETS[kind]?.[id] || null;
}

function optionInfo(option, type, grantDetail = null) {
  return {
    title: option.name || titleCase(option.id),
    initials: initials(option.name || option.id),
    meta: [titleCase(type), optionMeta(option), grantDetail?.label].filter(Boolean).join(" · "),
    text: option.text || option.description || option.meta || "",
  };
}

function requirementInfo(requirement) {
  return {
    title: requirement.label || "Choice",
    initials: "CH",
    meta: `${titleCase(requirement.kind || "choice")} · ${formatChosenCount(getRequirementSelection(requirement).length, requirement.count || 1)}`,
    text: choiceExplanation(requirement),
  };
}

function choiceExplanation(requirement) {
  const kind = requirement.kind || "choice";
  if (kind === "weapon") return "Choose one equipped weapon for the selected feature. If the weapon list changes, this can be remade.";
  if (kind === "skill") return "Choose skill proficiencies or expertise created by your selected feature.";
  if (kind === "spell" || kind === "spell_list") return "Choose a spell granted by the selected feature. Granted spells do not count against class spell choices.";
  if (kind === "ability_score") return "Choose which ability score receives the feature's increase.";
  if (kind === "origin_feat" || kind === "origin_feat_choice") return "Choose the feat or feat-related option granted by this feature.";
  return "This choice is required by a selected feature and can be changed until the character is saved.";
}

function initials(value) {
  return String(value || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";
}

function choiceLabel(choiceId, kind, count) {
  if (choiceId === "abilities") return "abilities";
  if (choiceId === "ability") return count === 1 ? "ability" : "abilities";
  if (choiceId === "damage_type") return "damage type";
  if (choiceId === "proficiencies") return "skill or tool proficiency";
  if (choiceId === "expertise") return "expertise";
  const label = titleCase(kind || choiceId || "choice").toLowerCase();
  return count === 1 || label.endsWith("s") ? label : `${label}s`;
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
  const item = document.createElement("li"); item.innerHTML = `${label}<span class="requirement-meta">${meta}</span>`; return item;
}

function formatPoolCount(pool, type) {
  const grantText = type === "spell" && pool.grantedSpellDetails?.length ? ` · Granted ${pool.grantedSpellDetails.length}` : "";
  return `${formatChosenCount(pool.selected.length, pool.count)}${grantText}`;
}

function formatChosenCount(selected, count) {
  return `Chosen ${selected}/${maxCount(count)}`;
}

function maxCount(count) {
  if (Number.isFinite(count)) return count;
  return count?.max ?? count?.min ?? 0;
}

function spellGrantDetail(pool, spellId) {
  const details = (pool.grantedSpellDetails || []).filter((detail) => detail.id === spellId);
  if (!details.length) return null;
  return {
    label: `Granted by ${unique(details.map((detail) => detail.source || "feature")).join(", ")}`,
  };
}

function optionStatusMeta(type, grantDetail) {
  if (type !== "spell") return "";
  return grantDetail ? ` · ${grantDetail.label}` : " · Chosen class option";
}

function renderBridgeReport(report) {
  if (!report.valid) {
    return [summaryRow("Bridge blocked", [...report.sheetErrors, ...report.actorErrors].join("; ") || "Unresolved character choices remain.")];
  }
  return report.sections.map((section) => {
    const row = document.createElement("section");
    row.className = "bridge-section";
    const title = document.createElement("strong");
    title.textContent = section.label;
    const list = document.createElement("ul");
    list.replaceChildren(...section.lines.map((item) => {
      const node = document.createElement("li");
      node.innerHTML = `<span>${item.label}: ${item.value}</span><small>${item.source}</small>`;
      return node;
    }));
    row.append(title, list);
    return row;
  });
}

function optionMeta(option) {
  if (option.level !== undefined) {
    const level = option.level === 0 ? "Cantrip" : `Level ${option.level}`;
    const tags = [level, option.school, option.concentration ? "Concentration" : null].filter(Boolean);
    return tags.join(" · ");
  }
  return [
    option.type,
    option.damage,
    option.mastery ? `Mastery: ${title(option.mastery)}` : null,
    option.ac ? `AC ${option.ac}` : null,
    ...(option.properties || []),
  ].filter(Boolean).join(" · ");
}
