import { BACKGROUND_LIST } from "../../data/backgrounds.js";
import { CLASS_LIST } from "../../data/classes.js";
import { getDeviceRecipeById, listDeviceRecipes } from "../../data/deviceRecipes.js";
import { SPECIES_LIST } from "../../data/species.js";
import { getFeatById, listOriginFeats } from "../../data/feats.js";
import { SPELLS } from "../../data/spells.js";
import { getToolById, listToolsByPool } from "../../data/tools.js";
import { createDeviceRecipeChoicePools, createFeatChoicePools, createGearChoicePools, createSpellChoicePools, createWeaponMasteryChoicePools } from "../../character/choicePools.js";
import { assignClassDefaultAbilityScores } from "../../character/abilityScores.js";
import { ABILITY_IDS, createEmptyCharacterDraft } from "../../character/characterDraft.js";
import { SKILL_OPTIONS } from "../creatorHarnessOptions.js";
import { createStepCreatorCharacterRecord } from "../stepCreatorPipeline.js";

const BASE_STEPS = [
  { id: "name", label: "Name" },
  { id: "background", label: "Background" },
  { id: "species", label: "Species" },
  { id: "class", label: "Class" },
  { id: "feats", label: "Feats" },
  { id: "features", label: "Features" },
  { id: "gear", label: "Gear" },
  { id: "summary", label: "Summary" },
  { id: "appearance", label: "Portrait and Miniature" },
];
const SPELL_STEP = { id: "spells", label: "Spells" };

const BACKGROUND_PROMPT =
  "Even though the community of 'Harbour was a small one, there were plenty of opportunities to hone the skills that, later, would matter to many more than just you. Coming up, what did you do, and what were you good at?";
const CLASS_PROMPT =
  "It wasn't long before what you could <em>do</em> eclipsed who you were, in both the minds of those you knew and those you would come to meet.";
const SPECIES_PROMPT =
  "You are of the 'Harbour, raised by the 'Harbour, even if your lost family history shows itself to you in every reflection.";
const FEATS_PROMPT =
  "As you grew, you outstripped even the most skilled of those you came up with.";
const FEATURES_PROMPT =
  "As you grew, you outstripped even the most skilled of those you came up with.";
const SPELLS_PROMPT =
  "Power gathered in words, signs, and habits of attention, waiting to be given shape.";
const GEAR_PROMPT =
  "Worn a little, each piece of your gear is a partial portrait of your unusual childhood.";
const APPEARANCE_PROMPT =
  "Choose the portrait by which your story will remember you, and the figure that will carry you into battle.";
const ABILITY_SCORE_OPTIONS = [8, 10, 11, 12, 13, 14, 15];
const SKILL_ABILITY = {
  acrobatics: "dexterity",
  animal_handling: "wisdom",
  arcana: "intelligence",
  athletics: "strength",
  deception: "charisma",
  history: "intelligence",
  insight: "wisdom",
  intimidation: "charisma",
  investigation: "intelligence",
  medicine: "wisdom",
  nature: "intelligence",
  perception: "wisdom",
  performance: "charisma",
  persuasion: "charisma",
  religion: "intelligence",
  sleight_of_hand: "dexterity",
  stealth: "dexterity",
  survival: "wisdom",
};

const PORTRAIT_ASSETS = {
  background: Object.fromEntries(BACKGROUND_LIST.map((background) => [
    background.id,
    `assets/portraits/backgrounds/${background.id}-negative-ink.png`,
  ])),
  species: Object.fromEntries(SPECIES_LIST.map((species) => [
    species.id,
    `assets/portraits/${species.id}-negative-ink.png`,
  ])),
  class: {
    fighter: "assets/portraits/fighter-negative-ink.png",
    rogue: "assets/portraits/rogue-negative-ink.png",
    cleric: "assets/portraits/cleric-negative-ink.png",
    paladin: "assets/portraits/paladin-negative-ink.png",
    wizard: "assets/portraits/wizard-negative-ink.png",
    warlock: "assets/portraits/warlock-negative-ink.png",
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

const els = {
  shell: document.querySelector("#creatorShell"),
  title: document.querySelector("#stepTitle"),
  nameInput: document.querySelector("#characterName"),
  chosenName: document.querySelector("#chosenName"),
  portraitTiles: document.querySelector("#portraitTiles"),
  infoPanel: document.querySelector("#infoPanel"),
  grantPanel: document.querySelector("#grantPanel"),
  dropdown: document.querySelector("#backgroundDropdown"),
  dropdownButton: document.querySelector("#backgroundDropdownButton"),
  options: document.querySelector("#backgroundOptions"),
  speciesDropdown: document.querySelector("#speciesDropdown"),
  speciesDropdownButton: document.querySelector("#speciesDropdownButton"),
  speciesOptions: document.querySelector("#speciesOptions"),
  lineageTitle: document.querySelector("#lineageTitle"),
  lineageDropdown: document.querySelector("#lineageDropdown"),
  lineageDropdownButton: document.querySelector("#lineageDropdownButton"),
  lineageOptions: document.querySelector("#lineageOptions"),
  classDropdown: document.querySelector("#classDropdown"),
  classDropdownButton: document.querySelector("#classDropdownButton"),
  classOptions: document.querySelector("#classOptions"),
  subclassTitle: document.querySelector("#subclassTitle"),
  subclassDropdown: document.querySelector("#subclassDropdown"),
  subclassDropdownButton: document.querySelector("#subclassDropdownButton"),
  subclassOptions: document.querySelector("#subclassOptions"),
  abilityTable: document.querySelector("#abilityTable"),
  featChoices: document.querySelector("#featChoices"),
  portraitSelection: document.querySelector("#portraitSelection"),
  miniatureSelection: document.querySelector("#miniatureSelection"),
  diamonds: document.querySelector("#stepDiamonds"),
  nextButton: document.querySelector("#nextStepButton"),
  detailsToggle: document.querySelector("#detailsToggle"),
  detailsClose: document.querySelector("#detailsClose"),
  details: document.querySelector("#creatorDetails"),
  detailsBody: document.querySelector("#detailsBody"),
  tooltip: document.querySelector("#uiTooltip"),
};

const state = {
  draft: createEmptyCharacterDraft(),
  started: false,
  stepId: "name",
  name: "",
  backgroundId: "",
  hoveredBackgroundId: "",
  speciesId: "",
  lineageId: "",
  hoveredSpeciesId: "",
  hoveredLineageId: "",
  classId: "",
  subclassId: "",
  hoveredClassId: "",
  hoveredSubclassId: "",
  hoveredFeatId: "",
  hoveredFeatSource: "",
  hoveredFeatureKey: "",
  hoveredGearOption: null,
  hoveredSpellOption: null,
  portraitId: "",
  miniatureId: "",
};

renderBackgroundOptions();
renderSpeciesOptions();
renderClassOptions();
renderDiamonds();
render();
fadePageContent();
initAnimatedFog();

els.nameInput?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  state.name = els.nameInput.value.trim();
  state.draft.identity.characterName = state.name;
  state.started = true;
  setStep("background");
});

setupDropdown(els.dropdown, els.dropdownButton);
setupDropdown(els.speciesDropdown, els.speciesDropdownButton);
setupDropdown(els.lineageDropdown, els.lineageDropdownButton);
setupDropdown(els.classDropdown, els.classDropdownButton);
setupDropdown(els.subclassDropdown, els.subclassDropdownButton);

document.addEventListener("click", (event) => {
  if (!event.target.closest(".background-dropdown")) closeDropdowns();
});

els.detailsToggle?.addEventListener("click", () => setDetailsOpen(els.details?.hidden));
els.detailsClose?.addEventListener("click", () => setDetailsOpen(false));
els.nextButton?.addEventListener("click", advanceStep);
if (els.nextButton) attachTooltip(els.nextButton, "Next", { placement: "top" });
document.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  if (!canAdvanceStep()) return;
  event.preventDefault();
  advanceStep();
});

function advanceStep() {
  if (!canAdvanceStep()) return;
  if (state.stepId === "appearance") {
    startGame();
    return;
  }
  if (state.stepId === "name") {
    state.name = els.nameInput.value.trim();
    state.draft.identity.characterName = state.name;
    state.started = true;
  }
  setStep(nextStepId() || state.stepId);
}

function canAdvanceStep() {
  if (state.stepId === "name") return Boolean(els.nameInput?.value.trim());
  if (state.stepId === "background") return Boolean(state.backgroundId);
  if (state.stepId === "species") {
    const needsLineage = lineageOptions(selectedSpecies()).length > 0;
    return Boolean(state.speciesId) && (!needsLineage || Boolean(state.lineageId));
  }
  if (state.stepId === "class") {
    const needsSubclass = requiresSubclassSelection(selectedClass());
    return Boolean(state.classId) && (!needsSubclass || Boolean(state.subclassId));
  }
  if (state.stepId === "feats") return true;
  if (state.stepId === "features") return true;
  if (state.stepId === "spells") return true;
  if (state.stepId === "gear") return true;
  if (state.stepId === "summary") return true;
  if (state.stepId === "appearance") return Boolean(state.portraitId && state.miniatureId);
  return false;
}

function setStep(stepId) {
  if (!implementedSteps().some((step) => step.id === stepId)) return;
  if (state.stepId === stepId) {
    render();
    return;
  }
  state.stepId = stepId;
  render();
  fadePageContent();
}

function activeSteps() {
  if (!hasSpellStep()) return BASE_STEPS;
  return BASE_STEPS.flatMap((step) => step.id === "gear" ? [SPELL_STEP, step] : [step]);
}

function nextStepId() {
  const steps = implementedSteps();
  const index = steps.findIndex((step) => step.id === state.stepId);
  return index >= 0 ? steps[index + 1]?.id : null;
}

function implementedSteps() {
  return activeSteps();
}

function render() {
  const isName = state.stepId === "name";
  const isBackground = state.stepId === "background";
  const isSpecies = state.stepId === "species";
  const isClass = state.stepId === "class";
  const isFeats = state.stepId === "feats";
  const isFeatures = state.stepId === "features";
  const isSpells = state.stepId === "spells";
  const isGear = state.stepId === "gear";
  const isSummary = state.stepId === "summary";
  const isAppearance = state.stepId === "appearance";
  els.shell?.classList.toggle("is-summary", isSummary);
  els.shell?.classList.toggle("is-features", isFeatures);
  els.nextButton?.classList.toggle("is-start-ready", isAppearance && canAdvanceStep());
  els.nextButton?.setAttribute("aria-label", isAppearance ? "Start game" : "Next section");
  els.title.textContent = isName ? "Your Name" : isBackground ? "Your Background" : isSpecies ? "Your Species" : isClass ? "Your Class" : isFeats ? "Your Feats" : isFeatures ? "Your Features" : isSpells ? "Your Spells" : isGear ? "Your Gear" : isSummary ? "Your Summary" : "Select Portrait and Miniature";
  els.nameInput.hidden = !isName;
  els.dropdown.hidden = !isBackground;
  els.speciesDropdown.hidden = !isSpecies;
  els.lineageTitle.hidden = !isSpecies || lineageOptions(selectedSpecies()).length === 0;
  els.lineageDropdown.hidden = els.lineageTitle.hidden;
  els.classDropdown.hidden = !isClass;
  const needsSubclass = isClass && requiresSubclassSelection(selectedClass());
  els.subclassTitle.hidden = !needsSubclass;
  els.subclassDropdown.hidden = !needsSubclass;
  els.abilityTable.hidden = !isClass || !canShowAbilityTable();
  els.featChoices.hidden = !isFeats && !isFeatures && !isSpells && !isGear;
  els.portraitSelection.hidden = !isAppearance;
  els.miniatureSelection.hidden = !isAppearance;
  els.chosenName.hidden = isName || isSummary;
  els.chosenName.textContent = state.name;
  els.infoPanel.innerHTML = isName
    ? "Uttered in admiration and tenderness, disgust and hatred, what is the name by which you were known?"
    : isBackground ? BACKGROUND_PROMPT : isSpecies ? SPECIES_PROMPT : isClass ? CLASS_PROMPT : isFeats ? FEATS_PROMPT : isFeatures ? FEATURES_PROMPT : isSpells ? SPELLS_PROMPT : isGear ? GEAR_PROMPT : isAppearance ? APPEARANCE_PROMPT : "";
  els.diamonds.hidden = !state.started;
  updateNextProgress();
  renderAbilityTable();
  renderPortraitTiles();
  if (isFeats) renderFeatChoices();
  else if (isFeatures) renderFeatureChoices();
  else if (isSpells) renderSpellChoices();
  else if (isGear) renderGearChoices();
  else els.featChoices?.replaceChildren();
  if (isAppearance) renderAppearanceChoices();
  renderGrants();
  renderDiamonds();
  renderDetails();
}

function renderDiamonds() {
  if (!els.diamonds) return;
  els.diamonds.replaceChildren(...activeSteps().map((step) => {
    const button = document.createElement("button");
    button.className = `step-diamond${state.stepId === step.id ? " is-active" : ""}`;
    button.type = "button";
    button.setAttribute("aria-label", step.label);
    button.append(createDiamondSvg());
    attachTooltip(button, step.label, { placement: "top" });
    button.addEventListener("click", () => setStep(step.id));
    return button;
  }));
}

function initAnimatedFog() {
  const layers = [...document.querySelectorAll(".creator-fog-layer")];
  if (layers.length < 2) return;
  const sources = Array.from({ length: 10 }, (_, index) => `../assets/fog/fog_${String(index + 1).padStart(2, "0")}.png`);
  let sourceIndex = 0;
  let visibleLayer = 0;

  layers[0].src = sources[0];
  layers[1].src = sources[1];
  layers[0].addEventListener("load", () => layers[0].classList.add("is-visible"), { once: true });

  setInterval(() => {
    const hiddenLayer = visibleLayer === 0 ? 1 : 0;
    sourceIndex = (sourceIndex + 1) % sources.length;
    const nextSource = sources[sourceIndex];
    const next = layers[hiddenLayer];
    const current = layers[visibleLayer];

    const reveal = () => {
      requestAnimationFrame(() => {
        next.classList.add("is-visible");
        current.classList.remove("is-visible");
        visibleLayer = hiddenLayer;
      });
    };

    if (next.getAttribute("src") === nextSource && next.complete) {
      reveal();
      return;
    }

    next.classList.remove("is-visible");
    next.addEventListener("load", reveal, { once: true });
    next.src = nextSource;
  }, 12000);
}

function updateNextProgress() {
  if (!els.nextButton) return;
  const steps = activeSteps();
  const index = Math.max(0, steps.findIndex((step) => step.id === state.stepId));
  els.nextButton.style.setProperty("--moon-fill", `${((index + 1) / steps.length) * 100}%`);
}

function renderBackgroundOptions() {
  if (!els.options) return;
  els.options.replaceChildren(...BACKGROUND_LIST.map((background) => {
    const option = document.createElement("button");
    option.className = "background-option";
    option.type = "button";
    option.role = "option";
    option.textContent = background.name;
    option.addEventListener("mouseenter", () => {
      state.hoveredBackgroundId = background.id;
      renderGrants();
      renderDetails();
    });
    option.addEventListener("focus", () => {
      state.hoveredBackgroundId = background.id;
      renderGrants();
      renderDetails();
    });
    option.addEventListener("click", () => {
      state.backgroundId = background.id;
      state.hoveredBackgroundId = background.id;
      state.draft.identity.backgroundId = background.id;
      state.draft.choices.featChoices = {};
      state.draft.choices.backgroundAbilityScores = [];
      closeDropdowns();
      render();
    });
    return option;
  }));
}

function renderAppearanceChoices() {
  if (!els.portraitSelection || !els.miniatureSelection) return;

  const speciesId = state.speciesId;
  const portraitOptions = speciesId ? [
    appearancePortraitOption(speciesId, "feminine", "01", "Portrait I"),
    appearancePortraitOption(speciesId, "masculine", "01", "Portrait II"),
    appearancePortraitOption(speciesId, "feminine", "02", "Portrait III"),
    appearancePortraitOption(speciesId, "masculine", "02", "Portrait IV"),
    appearancePortraitOption(speciesId, "feminine", "03", "Portrait V"),
    appearancePortraitOption(speciesId, "masculine", "03", "Portrait VI"),
  ] : [];
  const portraitIds = new Set(portraitOptions.map((option) => option.id));
  if (state.portraitId && !portraitIds.has(state.portraitId)) {
    state.portraitId = "";
    state.draft.presentation.portraitId = null;
  }

  const miniatureOptions = speciesId ? [
    appearanceMiniatureOption(speciesId, "feminine", "Figure I"),
    appearanceMiniatureOption(speciesId, "masculine", "Figure II"),
  ] : [];
  const miniatureIds = new Set(miniatureOptions.map((option) => option.id));
  if (state.miniatureId && !miniatureIds.has(state.miniatureId)) {
    state.miniatureId = "";
    state.draft.presentation.miniatureId = null;
  }

  els.portraitSelection.replaceChildren(...portraitOptions.map((option) => appearanceButton(option, "portrait")));
  els.miniatureSelection.replaceChildren(...miniatureOptions.map((option) => appearanceButton(option, "miniature")));
}

function appearancePortraitOption(speciesId, form, setId, label) {
  const assetName = `${speciesId}_${form}_${setId}.png`;
  const id = `character_creator/assets/player_portraits/${assetName}`;
  return { id, src: `assets/player_portraits/${assetName}`, label };
}

function appearanceMiniatureOption(speciesId, form, label) {
  const assetName = `${speciesId}_${form}_01`;
  const id = `mini_preview/assets/pc_authored_library/${assetName}/cutout/${assetName}.png`;
  return { id, src: `../${id}`, label };
}

function appearanceButton(option, kind) {
  const selectedId = kind === "portrait" ? state.portraitId : state.miniatureId;
  const button = document.createElement("button");
  button.className = `appearance-option${selectedId === option.id ? " is-selected" : ""}`;
  button.type = "button";
  button.setAttribute("aria-pressed", selectedId === option.id ? "true" : "false");

  const image = document.createElement("img");
  image.src = option.src;
  image.alt = "";
  const label = document.createElement("span");
  label.className = "appearance-option-label";
  label.textContent = option.label;
  button.append(image, label);

  button.addEventListener("click", () => {
    if (kind === "portrait") {
      state.portraitId = option.id;
      state.draft.presentation.portraitId = option.id;
    } else {
      state.miniatureId = option.id;
      state.draft.presentation.miniatureId = option.id;
    }
    render();
  });
  return button;
}

function renderClassOptions() {
  if (!els.classOptions) return;
  els.classOptions.replaceChildren(...CLASS_LIST.map((classRecord) => {
    const option = optionButton(classRecord.name, () => {
      state.hoveredClassId = classRecord.id;
      renderGrants();
      renderDetails();
    });
    option.addEventListener("click", () => {
      state.classId = classRecord.id;
      state.subclassId = "";
      state.hoveredClassId = classRecord.id;
      state.hoveredSubclassId = "";
      state.draft.identity.classId = classRecord.id;
      state.draft.identity.subclassId = null;
      state.draft.identity.pactId = null;
      state.draft.spells.knownSpellIds = [];
      state.draft.spells.preparedSpellIds = [];
      state.draft.gear.weaponIds = [];
      state.draft.gear.armorId = null;
      state.draft.gear.shieldId = null;
      state.draft.choices.weaponMasteryIds = [];
      assignClassDefaultAbilityScores(state.draft, classRecord);
      renderSubclassOptions();
      closeDropdowns();
      render();
    });
    return option;
  }));
  renderSubclassOptions();
}

function renderSpeciesOptions() {
  if (!els.speciesOptions) return;
  els.speciesOptions.replaceChildren(...SPECIES_LIST.map((species) => {
    const option = optionButton(species.name, () => {
      state.hoveredSpeciesId = species.id;
      renderGrants();
      renderDetails();
    });
    option.addEventListener("click", () => {
      state.speciesId = species.id;
      state.lineageId = "";
      state.hoveredSpeciesId = species.id;
      state.hoveredLineageId = "";
      state.draft.identity.speciesId = species.id;
      state.draft.identity.lineageId = null;
      state.draft.choices.speciesChoices = {};
      renderLineageOptions();
      closeDropdowns();
      render();
    });
    return option;
  }));
  renderLineageOptions();
}

function renderLineageOptions() {
  if (!els.lineageOptions) return;
  const lineages = lineageOptions(selectedSpecies());
  els.lineageOptions.replaceChildren(...lineages.map((lineage) => {
    const option = optionButton(lineage.name, () => {
      state.hoveredLineageId = lineage.id;
      renderGrants();
      renderDetails();
    });
    option.addEventListener("click", () => {
      state.lineageId = lineage.id;
      state.hoveredLineageId = lineage.id;
      state.draft.identity.lineageId = lineage.id;
      closeDropdowns();
      render();
    });
    return option;
  }));
}

function renderSubclassOptions() {
  if (!els.subclassOptions) return;
  const classRecord = selectedClass();
  const subclasses = subclassOptions(classRecord);
  els.subclassOptions.replaceChildren(...subclasses.map((subclass) => {
    const option = optionButton(subclass.name, () => {
      state.hoveredSubclassId = subclass.id;
      renderGrants();
      renderDetails();
    });
    option.addEventListener("click", () => {
      state.subclassId = subclass.id;
      state.hoveredSubclassId = subclass.id;
      state.draft.identity.subclassId = subclass.id;
      closeDropdowns();
      render();
    });
    return option;
  }));
}

function renderAbilityTable() {
  if (!els.abilityTable) return;
  if (state.stepId !== "class" || !canShowAbilityTable()) {
    els.abilityTable.replaceChildren();
    return;
  }
  const classRecord = selectedClass();
  const savingThrows = new Set((classRecord?.savingThrows || []).map(normalizeAbilityId));
  const title = document.createElement("p");
  title.className = "sample-kicker ability-table-title";
  title.textContent = "Your Ability Scores";
  const header = document.createElement("div");
  header.className = "ability-row ability-head";
  header.replaceChildren(
    document.createElement("span"),
    document.createElement("span"),
    abilityHead("Modifier"),
    abilityHead("Saving Throw")
  );

  const rows = ABILITY_IDS.map((ability) => {
    const row = document.createElement("div");
    row.className = "ability-row";
    const score = state.draft.abilities[ability];
    const saveProficient = savingThrows.has(ability);
    row.replaceChildren(
      abilityNameCell(ability),
      abilityScoreDropdown(ability, score),
      abilityValueCell(signed(abilityModifier(score) + (saveProficient ? 2 : 0)), "ability-save"),
      abilityProficiencyCell(saveProficient)
    );
    return row;
  });
  const note = document.createElement("p");
  note.className = "ability-table-note";
  note.textContent = "This distribution of ability points represents what is ideal for your character";

  els.abilityTable.replaceChildren(title, header, ...rows, note);
}

function canShowAbilityTable() {
  if (!state.classId) return false;
  const subclasses = subclassOptions(selectedClass());
  return subclasses.length === 0 || Boolean(state.subclassId);
}

function abilityHead(text) {
  const span = document.createElement("span");
  span.className = "ability-head-label";
  span.textContent = text;
  return span;
}

function abilityNameCell(ability) {
  const span = document.createElement("span");
  span.className = "ability-name";
  span.textContent = titleCase(ability);
  return span;
}

function abilityValueCell(value, className = "") {
  const span = document.createElement("span");
  span.className = `ability-value ${className}`.trim();
  span.textContent = value;
  return span;
}

function abilityProficiencyCell(proficient) {
  const span = document.createElement("span");
  span.className = `ability-prof${proficient ? " is-proficient" : ""}`;
  return span;
}

function abilityScoreDropdown(ability, score) {
  const dropdown = document.createElement("div");
  dropdown.className = "background-dropdown ability-score-dropdown";

  const button = document.createElement("button");
  button.className = "creator-field background-dropdown-button ability-score-button";
  button.type = "button";
  button.textContent = String(score ?? "");
  button.setAttribute("aria-expanded", "false");
  attachDropdownToggle(dropdown, button);

  const panel = document.createElement("div");
  panel.className = "background-options ability-score-options";
  panel.replaceChildren(...ABILITY_SCORE_OPTIONS.map((value) => {
    const option = optionButton(String(value), () => {});
    option.classList.toggle("is-selected", value === score);
    option.addEventListener("click", () => {
      assignAbilityScoreWithSwap(ability, value);
      closeDropdowns();
      render();
    });
    return option;
  }));

  dropdown.append(button, panel);
  return dropdown;
}

function assignAbilityScoreWithSwap(ability, score) {
  const current = state.draft.abilities[ability];
  const swapAbility = ABILITY_IDS.find((id) => id !== ability && state.draft.abilities[id] === score);
  state.draft.abilities[ability] = score;
  if (swapAbility) state.draft.abilities[swapAbility] = current;
}

function renderFeatChoices() {
  if (!els.featChoices || state.stepId !== "feats") return;
  const nodes = [];
  const backgroundFeat = selectedBackgroundFeat();
  if (backgroundFeat) {
    nodes.push(featControl(backgroundFeat, true, null, backgroundFeatSource()));
  }

  for (const record of speciesOriginFeatChoiceRecords()) {
    nodes.push(...renderFeatureOriginFeatChoices(record));
  }

  for (const pool of createFeatChoicePools(state.draft).pools) {
    const title = document.createElement("p");
    title.className = "sample-kicker subsection-kicker";
    title.textContent = pool.label;
    nodes.push(title);
    for (const option of pool.options) {
      const selected = pool.selected.includes(option.id);
      nodes.push(featControl(option, selected, pool, pool.label));
    }
  }

  if (!nodes.length) {
    const empty = document.createElement("p");
    empty.className = "creator-choice-empty";
    empty.textContent = "No feat choices are available at this stage.";
    nodes.push(empty);
  }
  els.featChoices.replaceChildren(...nodes);
}

function renderFeatureChoices() {
  if (!els.featChoices || state.stepId !== "features") return;
  const records = featureRecords();
  const nodes = [];
  let activeSource = "";
  let sourceGroup = null;
  for (const record of records) {
    if (record.sourceLabel !== activeSource) {
      if (sourceGroup) nodes.push(sourceGroup);
      sourceGroup = document.createElement("section");
      sourceGroup.className = "feature-source-group";
      const title = document.createElement("p");
      title.className = "sample-kicker subsection-kicker";
      title.textContent = record.sourceLabel;
      sourceGroup.append(title);
      activeSource = record.sourceLabel;
    }
    sourceGroup.append(featureControl(record));
  }
  if (sourceGroup) nodes.push(sourceGroup);

  for (const pool of createDeviceRecipeChoicePools(state.draft).pools) {
    const group = document.createElement("section");
    group.className = "feature-source-group";
    const title = document.createElement("p");
    title.className = "sample-kicker subsection-kicker";
    title.textContent = pool.label;
    group.append(title, renderDeviceDropdown(pool));
    nodes.push(group);
  }

  if (!nodes.length) {
    const empty = document.createElement("p");
    empty.className = "creator-choice-empty";
    empty.textContent = "Choose species and class details to inspect features.";
    nodes.push(empty);
  }
  els.featChoices.replaceChildren(...nodes);
}

function renderDeviceDropdown(pool) {
  return multiSelectDropdown({
    options: pool.options.map((option) => ({
      id: option.id,
      name: option.name,
      meta: `Level ${option.minLevel || 1} recipe`,
      text: option.text,
    })),
    selected: pool.selected,
    count: pool.count,
    emptyLabel: "Prepare devices",
    onPreview: (option) => previewDeviceOption(option, pool.label),
    onChange: (values, option) => {
      previewDeviceOption(option, pool.label);
      setDeviceSelection(pool, values);
    },
  });
}

function renderGearChoices() {
  if (!els.featChoices || state.stepId !== "gear") return;
  const pools = createGearChoicePools(state.draft).pools;
  const nodes = [];
  for (const pool of pools) {
    const group = document.createElement("section");
    group.className = "feature-source-group gear-source-group";
    const title = document.createElement("p");
    title.className = "sample-kicker subsection-kicker";
    title.textContent = pool.label;
    group.append(title, ...renderGearDropdowns(pool));
    nodes.push(group);
  }

  if (!nodes.length) {
    const empty = document.createElement("p");
    empty.className = "creator-choice-empty";
    empty.textContent = "Choose a class to inspect available gear.";
    nodes.push(empty);
  }
  els.featChoices.replaceChildren(...nodes);
}

function renderSpellChoices() {
  if (!els.featChoices || state.stepId !== "spells") return;
  const nodes = [];
  const classPools = createSpellChoicePools(state.draft).pools || [];
  for (const pool of classPools) nodes.push(renderSpellPool(pool));

  for (const feat of selectedSpellFeatRecords()) {
    const spellChoiceNodes = renderSpellFeatSubchoices(feat);
    if (spellChoiceNodes.length) {
      const title = document.createElement("p");
      title.className = "sample-kicker subsection-kicker";
      title.textContent = feat.name;
      nodes.push(title, ...spellChoiceNodes);
    }
  }

  const fixedSpells = fixedSpellGrantRecords();
  if (fixedSpells.length) {
    const title = document.createElement("p");
    title.className = "sample-kicker subsection-kicker";
    title.textContent = "Granted spells";
    nodes.push(title, ...fixedSpells.map(fixedSpellButton));
  }

  if (!nodes.length) {
    const empty = document.createElement("p");
    empty.className = "creator-choice-empty";
    empty.textContent = "No spell choices are available at this stage.";
    nodes.push(empty);
  }
  els.featChoices.replaceChildren(...nodes);
}

function renderSpellPool(pool) {
  const section = document.createElement("section");
  section.className = "feature-source-group spell-source-group";
  const title = document.createElement("p");
  title.className = "sample-kicker subsection-kicker";
  title.textContent = pool.label;
  section.append(title, renderSpellDropdown(pool));
  return section;
}

function renderSpellDropdown(pool) {
  return multiSelectDropdown({
    options: pool.options.map(spellChoiceOption),
    selected: pool.selected,
    count: pool.count,
    emptyLabel: "Select spells",
    onPreview: (option) => previewSpellOption(option, pool.label),
    onChange: (values, option) => {
      previewSpellOption(option, pool.label);
      setSpellSelection(pool, values);
    },
  });
}

function renderGearDropdowns(pool) {
  return [renderGearDropdown(pool)];
}

function renderGearDropdown(pool) {
  const options = pool.count.min === 0 ? [emptyGearOption(pool), ...pool.options] : pool.options;
  return multiSelectDropdown({
    options: options.map((option) => option.id === "" ? option : gearOption(option, pool)),
    selected: pool.selected,
    count: pool.count.max || 1,
    emptyLabel: pool.id === "weapons" ? "Select weapons" : "Select equipment",
    onPreview: (option) => {
      if (option.id) state.hoveredGearOption = { pool, option };
      renderGrants();
      renderDetails();
    },
    onChange: (values, option) => {
      setGearSelection(pool, values);
      if (option.id) state.hoveredGearOption = { pool, option };
    },
  });
}

function emptyGearOption(pool) {
  if (pool.id === "armor" && !pool.options.length) return { id: "", name: "No armor proficiency", meta: "" };
  if (pool.id === "shield" && !pool.options.length) return { id: "", name: "No shield proficiency", meta: "" };
  return { id: "", name: "No selection", meta: "" };
}

function gearOption(option, pool) {
  return {
    ...option,
    meta: [
      pool.id === "weapons" ? null : option.type,
      option.damage,
      option.mastery ? `Mastery: ${titleCase(option.mastery)}` : null,
      option.ac ? `AC ${option.ac}` : null,
      ...(option.properties || []),
      pool.id === "shield" ? "Shield" : null,
    ].filter(Boolean).join(" · "),
  };
}

function spellChoiceOption(option) {
  return {
    ...option,
    meta: option.level === 0 ? "Cantrip" : `Level ${option.level}`,
  };
}

function fixedSpellButton(record) {
  const button = document.createElement("button");
  button.className = "background-option creator-choice-option";
  button.type = "button";
  button.textContent = record.option.name;
  const preview = () => previewSpellOption(record.option, record.source);
  button.addEventListener("mouseenter", preview);
  button.addEventListener("focus", preview);
  return button;
}

function featureButton(record) {
  const button = document.createElement("button");
  button.className = "background-option creator-choice-option";
  button.type = "button";
  button.textContent = record.feature.name;
  const preview = () => {
    state.hoveredFeatureKey = record.key;
    renderGrants();
    renderDetails();
  };
  button.addEventListener("mouseenter", preview);
  button.addEventListener("focus", preview);
  return button;
}

function featureControl(record) {
  const choices = renderFeatureSubchoices(record, { inline: true });
  if (choices.length === 1) return choices[0];
  if (!choices.length) return featureButton(record);
  const group = document.createElement("section");
  group.className = "feat-inline-group";
  group.replaceChildren(featureButton(record), ...choices);
  return group;
}

function renderFeatureSubchoices(record, renderOptions = {}) {
  const requirements = [
    ...(record.feature.effects?.choiceRequirements || []).filter((choice) => choice.kind !== "origin_feat"),
    ...(record.feature.effects?.weaponMastery || []).map((mastery) => ({
      id: "weapon_mastery",
      kind: "weapon_mastery",
      count: mastery.count || 0,
    })),
  ];
  return requirements.map((choice) => {
    const options = featureChoiceOptions(choice);
    if (!options.length) return null;
    return renderFeatureChoice(record, choice, options, renderOptions);
  }).filter(Boolean);
}

function renderFeatureOriginFeatChoices(record) {
  return (record.feature.effects?.choiceRequirements || [])
    .filter((choice) => choice.kind === "origin_feat")
    .map((choice) => {
      const options = featureChoiceOptions(choice);
      if (!options.length) return null;
      return renderFeatureChoice(record, choice, options, { inline: true });
    })
    .filter(Boolean);
}

function renderFeatureChoice(record, choice, options, optionsOverride = {}) {
  const section = optionsOverride.inline ? document.createDocumentFragment() : featureChoiceSection(record, choice);
  const current = getFeatureChoice(record, choice).filter((value) => options.some((option) => option.id === value));
  section.append(multiSelectDropdown({
    options,
    selected: current,
    count: choice.count || 1,
    emptyLabel: optionsOverride.inline ? record.feature.name : optionsOverride.emptyLabel || `Select ${choiceLabel(choice).toLowerCase()}`,
    inline: optionsOverride.inline,
    onPreview: (option) => previewFeatureChoice(record, option),
    onChange: (values, option) => {
      previewFeatureChoice(record, option);
      setFeatureChoice(record, choice, values);
    },
  }));
  return section;
}

function featureChoiceSection(record, choice) {
  const section = document.createElement("section");
  section.className = "feat-subchoice";
  const title = document.createElement("p");
  title.className = "feat-subchoice-title";
  title.textContent = subchoiceTitle(choice, record.feature);
  section.append(title);
  return section;
}

function featControl(feat, selected, pool = null, sourceLabel = "") {
  const choices = selected ? renderFeatSubchoices(feat, { inline: true }) : [];
  if (choices.length === 1) return choices[0];
  const nodes = [featButton(feat, selected, pool, sourceLabel), ...choices];
  if (nodes.length === 1) return nodes[0];
  const group = document.createElement("section");
  group.className = "feat-inline-group";
  group.replaceChildren(...nodes);
  return group;
}

function featButton(feat, selected, pool = null, sourceLabel = "") {
  const button = document.createElement("button");
  button.className = `background-option creator-choice-option${selected ? " is-selected" : ""}`;
  button.type = "button";
  button.textContent = feat.name;
  const preview = () => {
    state.hoveredFeatId = feat.id;
    state.hoveredFeatSource = sourceLabel;
    renderGrants();
    renderDetails();
  };
  button.addEventListener("mouseenter", preview);
  button.addEventListener("focus", preview);
  button.addEventListener("click", () => {
    state.hoveredFeatId = feat.id;
    if (pool) updateFeatSelection(pool, [feat.id]);
    render();
  });
  return button;
}

function renderFeatSubchoices(feat, options = {}) {
  return (feat.choices || []).map((choice) => {
    if (choiceIsSpell(choice)) return null;
    const choiceOptions = featChoiceOptions(feat, choice);
    if (!choiceOptions.length) return null;
    return renderDropdownFeatChoice(feat, choice, choiceOptions, options);
  }).filter(Boolean);
}

function renderSpellFeatSubchoices(feat) {
  return (feat.choices || []).map((choice) => {
    if (!choiceIsSpell(choice)) return null;
    const options = featChoiceOptions(feat, choice);
    if (!options.length) return null;
    return renderDropdownSpellFeatChoice(feat, choice, options);
  }).filter(Boolean);
}

function renderDropdownSpellFeatChoice(feat, choice, options) {
  const section = featChoiceSection(feat, choice);
  const current = getFeatChoice(feat.id, choice.id).filter((value) => options.some((option) => option.id === value));
  const dropdownOptions = options.map((option) => spellChoiceOption(spellOptionFromId(option.id) || option));
  section.append(multiSelectDropdown({
    options: dropdownOptions,
    selected: current,
    count: choice.count || 1,
    emptyLabel: "Select spells",
    onPreview: (option) => {
      previewSpellOption(spellOptionFromId(option.id) || option, feat.name);
    },
    onChange: (values, option) => {
      previewSpellOption(spellOptionFromId(option.id) || option, feat.name);
      setFeatChoice(feat.id, choice.id, values);
    },
  }));
  return section;
}

function renderDropdownFeatChoice(feat, choice, options, renderOptions = {}) {
  const section = renderOptions.inline ? document.createDocumentFragment() : featChoiceSection(feat, choice);
  const current = getFeatChoice(feat.id, choice.id).filter((value) => options.some((option) => option.id === value));
  section.append(multiSelectDropdown({
    options,
    selected: current,
    count: choice.count || 1,
    emptyLabel: renderOptions.inline ? feat.name : `Select ${choiceLabel(choice).toLowerCase()}`,
    inline: renderOptions.inline,
    onPreview: (option) => previewFeatChoice(feat, option),
    onChange: (values, option) => {
      previewFeatChoice(feat, option);
      setFeatChoice(feat.id, choice.id, values);
    },
  }));
  return section;
}

function multiSelectDropdown({ options, selected, count, emptyLabel, inline = false, onPreview, onChange }) {
  const max = Math.max(1, Number.isFinite(count) ? count : count?.max || count?.min || 1);
  let selectedValues = selected.filter((value) => options.some((option) => option.id === value)).slice(0, max);
  const dropdown = document.createElement("div");
  dropdown.className = `background-dropdown feat-subchoice-dropdown${inline ? " creator-choice-dropdown" : ""}`;

  const button = document.createElement("button");
  button.className = `${inline ? "background-option creator-choice-option" : "creator-field"} background-dropdown-button feat-subchoice-button`;
  button.type = "button";
  button.setAttribute("aria-expanded", "false");
  updateMultiSelectButton(button, options, selectedValues, max, emptyLabel, inline);
  attachDropdownToggle(dropdown, button);

  const panel = document.createElement("div");
  panel.className = "background-options feat-subchoice-options";
  panel.replaceChildren(...groupedFeatChoiceNodes(options, onPreview, (option) => {
    const wasSelected = selectedValues.includes(option.id);
    selectedValues = nextMultiSelectValues(selectedValues, option.id, max);
    updateMultiSelectButton(button, options, selectedValues, max, emptyLabel, inline);
    markMultiSelectOptions(panel, selectedValues);
    onChange(selectedValues, option);
    if (!wasSelected && selectedValues.length >= max) closeDropdowns();
  }, selectedValues));

  dropdown.append(button, panel);
  return dropdown;
}

function updateMultiSelectButton(button, options, selected, count, emptyLabel, keepLabel = false) {
  const names = selected
    .map((id) => options.find((option) => option.id === id)?.name)
    .filter(Boolean);
  const label = document.createElement("span");
  label.className = "feat-subchoice-label";
  label.textContent = keepLabel ? emptyLabel : names.length ? names.join(", ") : emptyLabel;
  const counter = document.createElement("span");
  counter.className = "feat-subchoice-count";
  counter.textContent = `(${selected.length}/${count})`;
  button.replaceChildren(label, counter);
}

function nextMultiSelectValues(selected, optionId, max) {
  if (!optionId) return [];
  if (selected.includes(optionId)) return selected.filter((id) => id !== optionId);
  if (max === 1) return [optionId];
  if (selected.length < max) return [...selected, optionId];
  return [...selected.slice(0, max - 1), optionId];
}

function markMultiSelectOptions(panel, selected) {
  const selectedIds = new Set(selected);
  panel.querySelectorAll(".feat-subchoice-option").forEach((button) => {
    button.classList.toggle("is-selected", selectedIds.has(button.dataset.optionId));
  });
}

function groupedFeatChoiceNodes(options, onPreview, onSelect, selected = []) {
  const nodes = [];
  let activeGroup = "";
  const selectedIds = new Set(selected);
  for (const option of options) {
    const group = option.meta || "";
    if (group && group !== activeGroup) {
      const heading = document.createElement("div");
      heading.className = "feat-subchoice-group";
      heading.textContent = group.toUpperCase();
      nodes.push(heading);
      activeGroup = group;
    }
    const button = optionButton(option.name, () => onPreview(option));
    const selected = selectedIds.has(option.id);
    button.classList.add("feat-subchoice-option");
    button.dataset.optionId = option.id;
    button.classList.toggle("is-selected", selected);
    button.replaceChildren(featOptionText(option));
    button.addEventListener("click", () => {
      onSelect(option);
    });
    nodes.push(button);
  }
  return nodes;
}

function featChoiceSection(feat, choice) {
  const section = document.createElement("section");
  section.className = "feat-subchoice";
  const title = document.createElement("p");
  title.className = "feat-subchoice-title";
  title.textContent = subchoiceTitle(choice, feat);
  section.append(title);
  return section;
}

function featOptionText(option) {
  const span = document.createElement("span");
  span.textContent = option.name;
  if (option.meta) {
    const meta = document.createElement("span");
    meta.className = "option-meta";
    meta.textContent = option.meta;
    span.append(meta);
  }
  return span;
}

function previewFeatChoice(feat, option) {
  state.hoveredFeatId = feat.id;
  state.hoveredFeatSource = `${feat.name} choice: ${option.name}`;
  renderGrants();
  renderDetails();
}

function previewSpellOption(option, source) {
  state.hoveredSpellOption = { option, source };
  renderGrants();
  renderDetails();
}

function previewDeviceOption(option, source) {
  state.hoveredGearOption = { option: { ...option, description: option.text || option.description || "" }, pool: { label: source || "Device Recipe" } };
  renderGrants();
  renderDetails();
}

function previewFeatureChoice(record, option) {
  const recipe = getDeviceRecipeById(option.id);
  if (recipe) {
    state.hoveredFeatureKey = record.key;
    state.hoveredFeatSource = `${record.feature.name}: ${recipe.name}`;
    state.hoveredGearOption = { option: { ...option, name: recipe.name, description: recipe.text }, pool: { label: "Device Recipe" } };
    renderGrants();
    renderDetails();
    return;
  }
  if (state.stepId === "feats" && option.meta === "Origin Feat") {
    state.hoveredFeatId = option.id;
    state.hoveredFeatSource = `${record.sourceLabel}: ${record.feature.name}`;
    renderGrants();
    renderDetails();
    return;
  }
  state.hoveredFeatureKey = record.key;
  state.hoveredFeatSource = `${record.feature.name} choice: ${option.name}`;
  renderGrants();
  renderDetails();
}

function optionButton(label, preview) {
  const option = document.createElement("button");
  option.className = "background-option";
  option.type = "button";
  option.role = "option";
  option.textContent = label;
  option.addEventListener("mouseenter", preview);
  option.addEventListener("focus", preview);
  return option;
}

function renderGrants() {
  if (!els.grantPanel) return;
  if (state.stepId === "appearance") {
    els.grantPanel.replaceChildren();
    return;
  }
  if (state.stepId === "summary") {
    renderSummaryGrants();
    return;
  }
  if (state.stepId === "gear") {
    renderGearGrants();
    return;
  }
  if (state.stepId === "spells") {
    renderSpellGrants();
    return;
  }
  if (state.stepId === "features") {
    renderFeatureGrants();
    return;
  }
  if (state.stepId === "feats") {
    renderFeatGrants();
    return;
  }
  if (state.stepId === "class") {
    renderClassGrants();
    return;
  }
  if (state.stepId === "species") {
    renderSpeciesGrants();
    return;
  }
  const background = backgroundForGrant();
  if (!background || state.stepId !== "background") {
    els.grantPanel.replaceChildren();
    return;
  }

  els.dropdownButton.textContent = selectedBackground()?.name || "";
  markSelectedOptions(els.options, BACKGROUND_LIST, state.backgroundId);

  const nodes = [];
  nodes.push(grantLine(background.name, "grant-title"));
  if (background.description) nodes.push(grantLine(background.description, "grant-description"));

  const lines = [
    `Primary abilities: ${background.abilityScoreOptions.map(titleCase).join(", ")}`,
    `Your Skills: ${background.skillProficiencies.map(titleCase).join(", ")}`,
    `Your Tools: ${(background.toolProficiencies || []).map(titleCase).join(", ") || "None"}`,
  ];

  if (background.equipment?.length) lines.push(`Equipment: ${background.equipment.map(titleCase).join(", ")}`);
  if (background.gold) lines.push(`Gold: ${background.gold}`);

  nodes.push(...lines.map((line) => grantLine(line)));
  nodes.push(originFeatLine(background.legacyFeatId || background.originFeat || "None"));
  els.grantPanel.replaceChildren(...nodes);
}

function renderFeatGrants() {
  const feat = featForGrant();
  if (!feat) {
    els.grantPanel.replaceChildren();
    return;
  }
  els.grantPanel.replaceChildren(
    grantLine(feat.name, "grant-title"),
    grantLine(`Source: ${featSourceForGrant()}`),
    grantLine(feat.description || "Feat details are drawn from the existing character creator data.", "grant-description"),
    ...((feat.tags || []).length ? [grantLine(`Tags: ${feat.tags.map(titleCase).join(", ")}`)] : []),
    ...((feat.choices || []).length ? [grantLine(`Choices: ${feat.choices.map((choice) => choiceLabel(choice)).join("; ")}`)] : [])
  );
}

function renderFeatureGrants() {
  const record = featureForGrant();
  if (!record) {
    els.grantPanel.replaceChildren();
    return;
  }
  const feature = record.feature;
  const lines = [];
  if (feature.type || feature.effect) lines.push(`Type: ${titleCase(feature.type || feature.effect)}`);
  if (feature.uses) lines.push(`Uses: ${feature.uses}`);
  if (feature.grantsSpellId) lines.push(`Spell: ${titleCase(feature.grantsSpellId)}`);
  const choices = [
    ...(feature.effects?.choiceRequirements || []),
    ...(feature.effects?.weaponMastery || []).map((mastery) => ({ kind: "weapon mastery", count: mastery.count })),
  ];
  if (choices.length) lines.push(`Choices: ${choices.map((choice) => choiceLabel(choice)).join("; ")}`);
  els.grantPanel.replaceChildren(
    grantLine(feature.name, "grant-title"),
    grantLine(`Source: ${record.sourceLabel}`),
    grantLine(feature.description || feature.note || "Feature details are drawn from the existing character creator data.", "grant-description"),
    ...lines.map((line) => grantLine(line))
  );
}

function renderGearGrants() {
  const active = gearForGrant();
  if (!active) {
    els.grantPanel.replaceChildren();
    return;
  }
  const option = active.option;
  const lines = [];
  if (option.damage) lines.push(`Damage: ${option.damage}`);
  if (option.mastery) lines.push(`Mastery: ${titleCase(option.mastery)}`);
  if (option.ac) lines.push(`AC: ${option.ac}`);
  if (option.type) lines.push(`Type: ${titleCase(option.type)}`);
  if (option.properties?.length) lines.push(`Properties: ${option.properties.map(titleCase).join(", ")}`);
  els.grantPanel.replaceChildren(
    grantLine(option.name, "grant-title"),
    grantLine(`Source: ${active.pool.label}`),
    grantLine(option.description || "Gear details are drawn from the existing character creator data.", "grant-description"),
    ...lines.map((line) => grantLine(line))
  );
}

function renderSummaryGrants() {
  const sections = summarySections();
  els.infoPanel.replaceChildren();
  els.grantPanel.replaceChildren(...sections.map(summarySectionNode));
}

function renderSpellGrants() {
  const active = spellForGrant();
  if (!active) {
    els.grantPanel.replaceChildren();
    return;
  }
  const option = active.option;
  const lines = [];
  lines.push(`Level: ${option.level === 0 ? "Cantrip" : option.level}`);
  if (option.school) lines.push(`School: ${option.school}`);
  if (option.concentration) lines.push("Concentration");
  if (option.ritual) lines.push("Ritual");
  els.grantPanel.replaceChildren(
    grantLine(option.name, "grant-title"),
    grantLine(`Source: ${active.source}`),
    grantLine(option.text || "Spell details are drawn from the existing spell registry.", "grant-description"),
    ...lines.map((line) => grantLine(line))
  );
}

function renderSpeciesGrants() {
  const species = speciesForGrant();
  const lineage = lineageForGrant();
  const selectedSpeciesRecord = selectedSpecies();
  const selectedLineageRecord = selectedLineage();
  els.speciesDropdownButton.textContent = selectedSpeciesRecord?.name || "";
  els.lineageDropdownButton.textContent = selectedLineageRecord?.name || "";
  markSelectedOptions(els.speciesOptions, SPECIES_LIST, state.speciesId);
  markSelectedOptions(els.lineageOptions, lineageOptions(selectedSpecies()), state.lineageId);

  if (!species && !lineage) {
    els.grantPanel.replaceChildren();
    return;
  }

  const nodes = [];
  if (species) {
    nodes.push(grantLine(species.name, "grant-title"));
    nodes.push(grantLine(speciesText(species), "grant-description"));
    nodes.push(grantLine(`Size: ${species.size || "Medium"}`));
    nodes.push(grantLine(`Speed: ${species.speed || 30} ft.`));
    if (species.senses?.length) nodes.push(grantLine(`Senses: ${species.senses.map(senseText).join(", ")}`));
    if (species.resistances?.length) nodes.push(grantLine(`Resistances: ${species.resistances.map(titleCase).join(", ")}`));
  }
  if (lineage) {
    nodes.push(grantLine(lineage.name, "grant-title grant-subsection"));
    nodes.push(grantLine(lineageText(lineage), "grant-description"));
    if (lineage.resistances?.length) nodes.push(grantLine(`Resistances: ${lineage.resistances.map(titleCase).join(", ")}`));
  }
  els.grantPanel.replaceChildren(...nodes);
}

function renderClassGrants() {
  const classRecord = classForGrant();
  const subclass = subclassForGrant();
  const selectedClassRecord = selectedClass();
  const selectedSubclassRecord = selectedSubclass();
  els.classDropdownButton.textContent = selectedClassRecord?.name || "";
  els.subclassDropdownButton.textContent = selectedSubclassRecord?.name || "";
  markSelectedOptions(els.classOptions, CLASS_LIST, state.classId);
  markSelectedOptions(els.subclassOptions, subclassOptions(selectedClass()), state.subclassId);

  if (!classRecord && !subclass) {
    els.grantPanel.replaceChildren();
    return;
  }

  const nodes = [];
  if (classRecord) {
    nodes.push(grantLine(classRecord.name, "grant-title"));
    if (classRecord.summary) nodes.push(grantLine(classRecord.summary, "grant-description"));
    nodes.push(grantLine(`Hit die: d${classRecord.hitDie}`));
    nodes.push(grantLine(`Primary abilities: ${(classRecord.primaryAbility || []).join(", ") || "Flexible"}`));
    nodes.push(grantLine(`Saving throws: ${(classRecord.savingThrows || []).join(", ") || "None"}`));
  }
  if (subclass) {
    nodes.push(grantLine(subclass.name, "grant-title grant-subsection"));
    if (subclass.summary || subclass.description) nodes.push(grantLine(subclass.summary || subclass.description, "grant-description"));
  }
  els.grantPanel.replaceChildren(...nodes);
}

function renderPortraitTiles() {
  if (!els.portraitTiles) return;
  const background = selectedBackground();
  const species = selectedSpecies();
  const classRecord = selectedClass();
  const subclass = selectedSubclass();
  const showClassTiles = ["class", "feats", "features", "spells", "gear", "summary"].includes(state.stepId);
  const showTiles = ["background", "species", "class", "feats", "features", "spells", "gear", "summary"].includes(state.stepId);
  const tiles = [
    portraitTile(background, "background"),
    portraitTile(species, "species"),
    showClassTiles ? portraitTile(classRecord, "class") : null,
    showClassTiles ? portraitTile(subclass, "subclass") : null,
  ].filter(Boolean);
  els.portraitTiles.hidden = !showTiles || tiles.length === 0;
  els.portraitTiles.replaceChildren(...tiles);
}

function portraitTile(record, kind) {
  const src = record?.id ? PORTRAIT_ASSETS[kind]?.[record.id] : null;
  if (!src) return null;
  const tile = document.createElement("figure");
  tile.className = `portrait-tile portrait-tile-${kind}`;
  tile.tabIndex = 0;
  const img = document.createElement("img");
  img.src = src.replace("assets/portraits/", "assets/portraits/cropped/");
  img.alt = "";
  img.animate([{ opacity: 0 }, { opacity: 0.8 }], { duration: 1000, easing: "ease", fill: "both" });
  if (state.stepId === "summary") {
    tile.append(img);
    return tile;
  }
  attachTooltip(tile, `${titleCase(kind)}: ${record.name}`, { placement: "top" });
  const preview = () => {
    if (kind === "background") state.hoveredBackgroundId = record.id;
    if (kind === "species") state.hoveredSpeciesId = record.id;
    if (kind === "class") state.hoveredClassId = record.id;
    if (kind === "subclass") state.hoveredSubclassId = record.id;
    renderGrants();
    renderDetails();
  };
  tile.addEventListener("mouseenter", preview);
  tile.addEventListener("focus", preview);
  tile.append(img);
  return tile;
}

function renderDetails() {
  if (!els.detailsBody) return;
  const background = selectedBackground();
  const species = selectedSpecies();
  const lineage = selectedLineage();
  const classRecord = selectedClass();
  const subclass = selectedSubclass();
  const name = state.name;
  const optionTitle = classRecord?.name || species?.name || background?.name || "No option selected";
  const optionText = classRecord?.summary || speciesText(species) || background?.description || "Hover or choose an option to inspect what the existing creator grants.";
  const requirements = [
    state.name ? "Name entered." : "Enter a name.",
    background ? "Background chosen." : "Choose a background.",
    species ? "Species chosen." : "Choose a species.",
    classRecord ? "Class chosen." : "Choose a class.",
  ];

  els.detailsBody.innerHTML = `
    ${detailSection("Option Info", `<p>${escapeHtml(optionTitle)}</p><p>${escapeHtml(optionText)}</p>`)}
    ${detailSection("Requirements", `<ul>${requirements.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`)}
    ${detailSection("Resolved Sheet Preview", `<p>Identity: ${escapeHtml(name)} · ${escapeHtml(background?.name || "No background")} · ${escapeHtml(species?.name || "No species")} · ${escapeHtml(lineage?.name || "No lineage")} · ${escapeHtml(classRecord?.name || "No class")} · ${escapeHtml(subclass?.name || "No subclass")}</p>`)}
    ${detailSection("Combat Actions", "<p>Resolved from the full creator once class, features, and gear are selected.</p>")}
    ${detailSection("Combat Actor Sources", "<p>Drawn from the same draft-to-sheet pipeline as the full creator.</p>")}
    ${detailSection("Pipeline Export", "<p>Draft, resolved sheet, actor, and bridge report remain owned by the existing creator rig.</p>")}
  `;
}

function setDetailsOpen(open) {
  if (!els.details || !els.detailsToggle) return;
  els.details.hidden = !open;
  els.detailsToggle.setAttribute("aria-expanded", String(open));
  if (open) renderDetails();
}

function setupDropdown(dropdown, button) {
  attachDropdownToggle(dropdown, button);
}

function attachDropdownToggle(dropdown, button) {
  button?.addEventListener("click", (event) => {
    event.stopPropagation();
    const wasOpen = dropdown?.classList.contains("is-open");
    closeDropdowns();
    dropdown?.classList.toggle("is-open", !wasOpen);
    button.setAttribute("aria-expanded", String(!wasOpen));
    document.querySelector(".preview-left")?.classList.toggle("has-open-dropdown", !wasOpen);
    if (!wasOpen) constrainDropdownToShell(dropdown);
  });
}

function closeDropdowns() {
  document.querySelectorAll(".background-dropdown.is-open").forEach((dropdown) => {
    dropdown.classList.remove("is-open");
    dropdown.querySelector("button[aria-expanded]")?.setAttribute("aria-expanded", "false");
    dropdown.style.removeProperty("--dropdown-available-height");
  });
  document.querySelector(".preview-left")?.classList.remove("has-open-dropdown");
}

function constrainDropdownToShell(dropdown) {
  const panel = dropdown?.querySelector(".background-options");
  if (!panel) return;
  const shellRect = els.shell?.getBoundingClientRect();
  const dropdownRect = dropdown.getBoundingClientRect();
  const shellBottom = shellRect?.bottom || window.innerHeight;
  const panelTop = dropdownRect.bottom + 6;
  const available = Math.max(48, Math.floor(shellBottom - panelTop - 12));
  dropdown.style.setProperty("--dropdown-available-height", `${available}px`);
}

function backgroundForGrant() {
  return BACKGROUND_LIST.find((item) => item.id === (state.hoveredBackgroundId || state.backgroundId)) || null;
}

function selectedBackground() {
  return BACKGROUND_LIST.find((item) => item.id === state.backgroundId) || null;
}

function selectedBackgroundFeat() {
  const background = selectedBackground();
  return getFeatById(background?.legacyFeatId || background?.originFeat);
}

function backgroundFeatSource() {
  const background = selectedBackground();
  return background ? `${background.name} background` : "Background";
}

function featForGrant() {
  if (state.hoveredFeatId) return getFeatById(state.hoveredFeatId);
  return selectedBackgroundFeat();
}

function gearForGrant() {
  if (state.hoveredGearOption) return state.hoveredGearOption;
  const pool = createGearChoicePools(state.draft).pools.find((item) => item.selected.length);
  if (!pool) return null;
  const option = pool.options.find((item) => item.id === pool.selected[0]);
  return option ? { pool, option } : null;
}

function spellForGrant() {
  if (state.hoveredSpellOption) return state.hoveredSpellOption;
  const classPool = createSpellChoicePools(state.draft).pools.find((pool) => pool.selected.length);
  if (classPool) {
    const option = classPool.options.find((item) => item.id === classPool.selected[0]);
    if (option) return { option, source: classPool.label };
  }
  return fixedSpellGrantRecords()[0] || null;
}

function featSourceForGrant() {
  return state.hoveredFeatSource || backgroundFeatSource();
}

function speciesForGrant() {
  return SPECIES_LIST.find((item) => item.id === (state.hoveredSpeciesId || state.speciesId)) || null;
}

function selectedSpecies() {
  return SPECIES_LIST.find((item) => item.id === state.speciesId) || null;
}

function lineageForGrant() {
  return lineageOptions(selectedSpecies()).find((item) => item.id === (state.hoveredLineageId || state.lineageId)) || null;
}

function selectedLineage() {
  return lineageOptions(selectedSpecies()).find((item) => item.id === state.lineageId) || null;
}

function classForGrant() {
  return CLASS_LIST.find((item) => item.id === (state.hoveredClassId || state.classId)) || null;
}

function selectedClass() {
  return CLASS_LIST.find((item) => item.id === state.classId) || null;
}

function subclassForGrant() {
  return subclassOptions(selectedClass()).find((item) => item.id === (state.hoveredSubclassId || state.subclassId)) || null;
}

function selectedSubclass() {
  return subclassOptions(selectedClass()).find((item) => item.id === state.subclassId) || null;
}

function featureForGrant() {
  const records = featureRecords();
  return records.find((record) => record.key === state.hoveredFeatureKey) || records[0] || null;
}

function featureRecords() {
  const records = [];
  const level = state.draft.identity?.level || 1;
  const species = selectedSpecies();
  const lineage = selectedLineage();
  const classRecord = selectedClass();
  const subclass = selectedSubclass();
  if (species) records.push(...featureList(species.features, {
    sourceKind: "species",
    sourceId: species.id,
    sourceLabel: species.name,
    level,
  }));
  if (lineage) records.push(...featureList(lineage.features, {
    sourceKind: "species",
    sourceId: `${species.id}.${lineage.id}`,
    sourceLabel: `${lineage.name} ${species.name}`,
    level,
  }));
  if (classRecord) records.push(...featureList(classRecord.features, {
    sourceKind: "class",
    sourceId: classRecord.id,
    sourceLabel: classRecord.name,
    level,
  }));
  if (subclass) records.push(...featureList(subclass.features, {
    sourceKind: "class",
    sourceId: subclass.id,
    sourceLabel: `${subclass.name} ${classRecord.name}`,
    level,
  }));
  return records;
}

function hasSpellStep() {
  if ((createSpellChoicePools(state.draft).pools || []).length) return true;
  if (selectedSpellFeatRecords().some((feat) =>
    (feat.effects?.spellGrants || []).length || (feat.choices || []).some(choiceIsSpell)
  )) return true;
  return fixedSpellGrantRecords().length > 0;
}

function selectedSpellFeatRecords() {
  const ids = [
    selectedBackground()?.legacyFeatId || selectedBackground()?.originFeat,
    ...Object.values(state.draft.choices?.advancementChoices || {}).map((choice) => choice?.featId),
    ...Object.values(state.draft.choices?.speciesChoices || {}).flatMap((value) => Array.isArray(value) ? value : [value]),
  ].filter(Boolean);
  return [...new Set(ids)]
    .map((id) => getFeatById(id))
    .filter(Boolean)
    .filter((feat) => (feat.effects?.spellGrants || []).length || (feat.choices || []).some(choiceIsSpell));
}

function fixedSpellGrantRecords() {
  const records = [];
  for (const record of featureRecords().filter((item) => item.sourceKind === "species")) {
    for (const spell of record.feature.effects?.spells || []) {
      const option = spellOptionFromId(spell.id);
      if (option) records.push({ option, source: record.feature.name || record.sourceLabel });
    }
  }
  for (const feat of selectedSpellFeatRecords()) {
    for (const grant of feat.effects?.spellGrants || []) {
      const option = spellOptionFromId(grant.spellId);
      if (option) records.push({ option, source: feat.name });
    }
  }
  const seen = new Set();
  return records.filter((record) => {
    const key = `${record.option.id}:${record.source}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function speciesOriginFeatChoiceRecords() {
  return featureRecords().filter((record) =>
    record.sourceKind === "species" &&
    (record.feature.effects?.choiceRequirements || []).some((choice) => choice.kind === "origin_feat")
  );
}

function featureList(features, source) {
  if (Array.isArray(features)) {
    return features
      .filter((feature) => (feature.minLevel || 1) <= source.level)
      .map((feature, index) => featureRecord(feature, { ...source, level: feature.minLevel || 1, index }));
  }
  return Object.entries(features || {}).flatMap(([levelText, levelFeatures]) => {
    const level = Number(levelText);
    if (!Number.isInteger(level) || level > source.level) return [];
    return (levelFeatures || []).map((feature, index) => featureRecord(feature, { ...source, level, index }));
  });
}

function featureRecord(feature, source) {
  return {
    ...source,
    feature,
    key: `${source.sourceKind}:${source.sourceId}:${source.level}:${feature.id || slug(feature.name || source.index)}`,
  };
}

function featureChoiceOptions(choice) {
  if (choice.kind === "skill") {
    return (choice.options || SKILL_OPTIONS).map((id) => ({ id, name: titleCase(id), meta: "Skill" }));
  }
  if (choice.kind === "spell") {
    return (choice.options || []).map((id) => ({ id, name: SPELLS[id]?.name || titleCase(id), meta: "Spell" }));
  }
  if (choice.kind === "origin_feat") {
    return listOriginFeats().map((feat) => ({ id: feat.id, name: feat.name, meta: "Origin Feat" }));
  }
  if (choice.kind === "weapon_mastery") {
    const pool = createWeaponMasteryChoicePools(state.draft).pools[0];
    return (pool?.options || []).map((option) => ({ id: option.id, name: option.name, meta: gearOption(option, pool).meta }));
  }
  if (choice.kind === "weapon") {
    return (choice.options || state.draft.gear?.weaponIds || []).map((id) => ({ id, name: titleCase(id), meta: "Weapon" }));
  }
  if (choice.kind === "device_recipe") {
    const ids = choice.options || selectedSubclass()?.deviceRecipes || [];
    return listDeviceRecipes({
      ids: ids.map((item) => typeof item === "string" ? item : item.id),
      level: state.draft.identity.level || 1,
    }).map((recipe) => ({ id: recipe.id, name: recipe.name, meta: `Level ${recipe.minLevel} recipe`, text: recipe.text }));
  }
  return (choice.options || []).map((option) => {
    if (typeof option === "string") return { id: option, name: titleCase(option), meta: titleCase(choice.kind) };
    return { id: option.id, name: option.name || titleCase(option.id), meta: option.meta || titleCase(choice.kind) };
  });
}

function getFeatureChoice(record, choice) {
  if (choice.kind === "weapon_mastery") return state.draft.choices.weaponMasteryIds || [];
  const bucket = record.sourceKind === "species" ? state.draft.choices.speciesChoices : state.draft.choices.classChoices;
  const selected = bucket?.[choice.id];
  return Array.isArray(selected) ? selected : selected ? [selected] : [];
}

function setFeatureChoice(record, choice, values) {
  if (choice.kind === "weapon_mastery") {
    state.draft.choices.weaponMasteryIds = values;
    return;
  }
  const value = (choice.count || 1) === 1 ? values[0] : values;
  if (record.sourceKind === "species") state.draft.choices.speciesChoices[choice.id] = value;
  else {
    state.draft.choices.classChoices ??= {};
    state.draft.choices.classChoices[choice.id] = value;
  }
}

function subclassOptions(classRecord) {
  return Object.entries(classRecord?.subclasses || {}).map(([name, record]) => ({
    name,
    ...record,
  }));
}

function requiresSubclassSelection(classRecord) {
  if (!classRecord || !subclassOptions(classRecord).length) return false;
  const subclassChoice = (classRecord.choices || []).find((choice) => choice.kind === "subclass");
  return (state.draft.identity.level || 1) >= (subclassChoice?.level || 3);
}

function lineageOptions(species) {
  return Object.values(species?.lineages || {});
}

function speciesText(species) {
  if (!species) return "";
  return (species.features || []).map((feature) => feature.description || feature.name).filter(Boolean).slice(0, 3).join(" ") || `${species.name} ancestry carried through the existing character pipeline.`;
}

function lineageText(lineage) {
  if (!lineage) return "";
  return (lineage.features || []).map((feature) => feature.description || feature.name).filter(Boolean).join(" ") || "A lineage variant carried through the existing species resolver.";
}

function senseText(sense) {
  return `${titleCase(sense.type)} ${sense.rangeFt} ft.`;
}

function updateFeatSelection(pool, values) {
  state.draft.choices.advancementChoices ??= {};
  if (!values[0]) delete state.draft.choices.advancementChoices[pool.id];
  else state.draft.choices.advancementChoices[pool.id] = { kind: "feat", featId: values[0] };
}

function setGearSelection(pool, values) {
  const uniqueValues = [];
  for (const value of values) {
    if (value && !uniqueValues.includes(value)) uniqueValues.push(value);
  }
  values = uniqueValues.slice(0, pool.count.max);
  if (pool.id === "weapons") state.draft.gear.weaponIds = values;
  if (pool.id === "armor") state.draft.gear.armorId = values[0] || null;
  if (pool.id === "shield") state.draft.gear.shieldId = values[0] || null;
}

function setSpellSelection(pool, values) {
  const bucket = pool.path === "spells.preparedSpellIds" ? "preparedSpellIds" : "knownSpellIds";
  const optionIds = new Set((pool.options || []).map((option) => option.id));
  const retained = (state.draft.spells?.[bucket] || []).filter((spellId) => !optionIds.has(spellId));
  state.draft.spells[bucket] = [...new Set([...retained, ...values])];
}

function setDeviceSelection(pool, values) {
  const optionIds = new Set((pool.options || []).map((option) => option.id));
  state.draft.devices.preparedRecipeIds = values.filter((recipeId) => optionIds.has(recipeId)).slice(0, pool.count.max);
}

function getFeatChoice(featId, choiceId) {
  const selected = state.draft.choices.featChoices?.[featId]?.[choiceId];
  return Array.isArray(selected) ? selected : selected ? [selected] : [];
}

function setFeatChoice(featId, choiceId, values) {
  state.draft.choices.featChoices ??= {};
  state.draft.choices.featChoices[featId] ??= {};
  state.draft.choices.featChoices[featId][choiceId] = values;
}

function featChoiceOptions(feat, choice) {
  if (feat.id === "skilled" && choice.kind === "skill_or_tool") return skillOrToolOptions();
  if (choice.kind === "skill" || choice.kind === "skill_expertise") {
    return (choice.options || SKILL_OPTIONS).map((id) => ({ id, name: titleCase(id), meta: "Skill" }));
  }
  if (choice.kind === "tool") {
    return resolveToolPool(choice.pool || choice.options || "tools")
      .map((id) => ({ id, name: getToolById(id)?.name || titleCase(id), meta: "Tool" }));
  }
  if (choice.kind === "spell" || choice.kind === "spell_list") {
    return Object.values(SPELLS)
      .filter((spell) => spell?.active !== false)
      .filter((spell) => spellAllowedForChoice(choice, spell))
      .map((spell) => ({ id: spell.id, name: spell.name, meta: `${spell.level === 0 ? "Cantrip" : `Level ${spell.level}`} · ${spell.school}${spell.ritual ? " · Ritual" : ""}` }));
  }
  return (choice.options || []).map((option) => {
    if (typeof option === "string") return { id: option, name: titleCase(option), meta: titleCase(choice.kind) };
    return { id: option.id, name: option.name || titleCase(option.id), meta: option.meta || titleCase(choice.kind) };
  });
}

function choiceIsSpell(choice) {
  return choice?.kind === "spell" || choice?.kind === "spell_list";
}

function spellOptionFromId(spellId) {
  const spell = SPELLS[spellId];
  if (!spell || spell.active === false) return null;
  return {
    id: spell.id,
    name: spell.name,
    level: spell.level,
    school: spell.school,
    concentration: spell.concentration === true,
    ritual: spell.ritual === true,
    casting: structuredClone(spell.casting || {}),
    text: spell.text || "",
  };
}

function skillOrToolOptions() {
  return [
    ...SKILL_OPTIONS.map((id) => ({ id: `skill:${id}`, name: titleCase(id), meta: "Skill" })),
    ...resolveToolPool("tools").map((id) => ({ id: `tool:${id}`, name: getToolById(id)?.name || titleCase(id), meta: "Tool" })),
  ];
}

function resolveToolPool(pool) {
  if (Array.isArray(pool)) return pool.flatMap((entry) => listToolsByPool(entry).length ? listToolsByPool(entry) : [entry]);
  return listToolsByPool(pool).length ? listToolsByPool(pool) : [];
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

function choicePrompt(choice, feat) {
  return subchoiceTitle(choice, feat);
}

function choiceLabel(choice) {
  return titleCase(choice.kind || choice.id);
}

function subchoiceTitle(choice, owner) {
  const label = choiceLabel(choice).replace(/\bChoice\b/gi, "").trim();
  if (normalizeLabel(label) === normalizeLabel(owner.name)) return owner.name;
  return `${owner.name}: ${label}`;
}

function normalizeLabel(value) {
  return String(value || "").replace(/[_-]+/g, " ").trim().toLowerCase();
}

function markSelectedOptions(container, records, selectedId) {
  container?.querySelectorAll(".background-option").forEach((option, index) => {
    option.classList.toggle("is-selected", records[index]?.id === selectedId);
  });
}

function summarySections() {
  const background = selectedBackground();
  const species = selectedSpecies();
  const lineage = selectedLineage();
  const classRecord = selectedClass();
  const subclass = selectedSubclass();
  return [
    {
      title: state.name || "Unnamed",
      className: "summary-identity",
      lines: [
        `Proficiency Bonus: +2`,
        summaryRecordLine(`Background: ${background?.name || "None"}`, background, "background"),
        summaryRecordLine(`Species: ${species?.name || "None"}`, species, "species"),
        ...(lineage ? [summaryRecordLine(`Lineage: ${lineage.name}`, lineage, "lineage")] : []),
        summaryRecordLine(`Class: ${classRecord?.name || "None"}`, classRecord, "class"),
        ...(subclass ? [summaryRecordLine(`Subclass: ${subclass.name}`, subclass, "subclass")] : []),
      ],
    },
    {
      title: "Abilities",
      kind: "abilities",
      groups: summaryAbilityGroups(),
    },
    {
      title: "Skills",
      kind: "skills",
      groups: [{ kind: "skillList", lines: summarySkillLines() }],
    },
    { title: "Feats", className: "summary-feats", lines: summaryFeatLines() },
    { title: "Spells", kind: "spells", groups: summarySpellGroups() },
    { title: "Gear", className: "summary-gear", lines: summaryGearLines() },
  ].filter((section) => section.groups?.length || section.lines?.length);
}

function summarySectionNode(section) {
  const node = document.createElement("section");
  node.className = `summary-section${section.kind ? ` summary-${section.kind}` : ""}${section.className ? ` ${section.className}` : ""}`;
  const title = document.createElement("h2");
  title.textContent = section.title;
  if (section.groups) {
    node.replaceChildren(title, ...section.groups.map(summaryGroupNode));
    return node;
  }
  const list = document.createElement("ul");
  list.replaceChildren(...section.lines.map(summaryLineNode));
  node.replaceChildren(title, list);
  return node;
}

function summaryGroupNode(group) {
  const node = document.createElement("div");
  node.className = `summary-group${group.kind ? ` summary-group-${group.kind}` : ""}`;
  if (group.kind === "ability") {
    node.replaceChildren(summaryAbilityHeader(group));
    return node;
  }
  if (group.kind === "skillList") {
    node.replaceChildren(...group.lines.map(summarySkillRowNode));
    return node;
  }
  const title = document.createElement("h3");
  title.append(group.title);
  if (group.proficient) title.append(summaryProficiencyMark());
  const list = document.createElement("ul");
  list.replaceChildren(...group.lines.map(summaryLineNode));
  node.replaceChildren(title, list);
  return node;
}

function summaryAbilityHeader(group) {
  const header = document.createElement("div");
  header.className = "summary-ability-head";
  const name = document.createElement("h3");
  name.textContent = group.name;
  const score = document.createElement("span");
  score.className = "summary-ability-score";
  score.textContent = String(group.score);
  const mod = document.createElement("span");
  mod.className = "summary-ability-mod";
  mod.textContent = String(group.mod);
  const save = document.createElement("span");
  save.className = "summary-ability-save";
  save.textContent = `Save ${group.save}`;
  if (group.proficient) save.append(summaryProficiencyMark());
  const stats = document.createElement("div");
  stats.className = "summary-ability-stats";
  stats.replaceChildren(score, mod, save);
  header.replaceChildren(name, stats);
  return header;
}

function summarySkillRowNode(line) {
  const row = document.createElement("div");
  row.className = "summary-skill-row";
  const marker = document.createElement("span");
  marker.className = "summary-skill-marker";
  if (line.proficient) marker.append(summaryProficiencyMark());
  const name = document.createElement("span");
  name.className = "summary-skill-name";
  name.textContent = line.name;
  const bonus = document.createElement("span");
  bonus.className = "summary-skill-bonus";
  bonus.textContent = line.bonus;
  row.replaceChildren(name, bonus, marker);
  return row;
}

function summaryLineNode(line) {
  const item = document.createElement("li");
  const text = typeof line === "string" ? line : line.text;
  item.append(text);
  if (typeof line === "object" && line.proficient) item.append(summaryProficiencyMark());
  if (typeof line === "object" && line.preview) {
    item.tabIndex = 0;
    item.addEventListener("mouseenter", line.preview);
    item.addEventListener("focus", line.preview);
    item.addEventListener("mouseleave", hideTooltip);
    item.addEventListener("blur", hideTooltip);
  }
  if (typeof line === "object" && line.info) {
    attachTooltip(item, line.info, { placement: "top" });
    item.addEventListener("mouseleave", hideTooltip);
    item.addEventListener("blur", hideTooltip);
  }
  return item;
}

function summaryProficiencyMark() {
  const mark = document.createElement("sup");
  mark.className = "summary-prof-mark";
  mark.setAttribute("aria-label", "Proficient");
  mark.tabIndex = 0;
  attachTooltip(mark, "Proficient", { placement: "top" });
  return mark;
}

function summaryRecordLine(text, record, kind) {
  return {
    text,
    info: record?.description || record?.summary || record?.name || text,
    preview: () => {
      if (kind === "background") state.hoveredBackgroundId = record?.id || "";
      if (kind === "species") state.hoveredSpeciesId = record?.id || "";
      if (kind === "lineage") state.hoveredLineageId = record?.id || "";
      if (kind === "class") state.hoveredClassId = record?.id || "";
      if (kind === "subclass") state.hoveredSubclassId = record?.id || "";
      renderDetails();
    },
  };
}

function summaryAbilityGroups() {
  const saves = new Set((selectedClass()?.savingThrows || []).map(normalizeAbilityId));
  return ABILITY_IDS.map((id) => {
    const score = state.draft.abilities[id] ?? 10;
    const mod = abilityModifier(score);
    const save = mod + (saves.has(id) ? 2 : 0);
    return {
      name: titleCase(id),
      score,
      mod: signed(mod),
      save: signed(save),
      proficient: saves.has(id),
      kind: "ability",
    };
  });
}

function summarySkillLines() {
  const skillProficiencies = summarySkillProficiencies();
  return SKILL_OPTIONS.map((skill) => {
    const id = SKILL_ABILITY[skill];
    const score = state.draft.abilities[id] ?? 10;
    const mod = abilityModifier(score);
    const proficient = skillProficiencies.has(skill);
    const bonus = mod + (proficient ? 2 : 0);
    return {
      name: titleCase(skill),
      bonus: signed(bonus),
      proficient,
    };
  });
}

function summaryFeatLines() {
  const ids = [
    selectedBackground()?.legacyFeatId || selectedBackground()?.originFeat,
    ...Object.values(state.draft.choices?.advancementChoices || {}).map((choice) => choice?.featId),
    ...Object.values(state.draft.choices?.speciesChoices || {}).flatMap((value) => Array.isArray(value) ? value : [value]),
  ].filter((id) => getFeatById(id));
  return [...new Set(ids)].map((id) => ({
    text: getFeatById(id)?.name || titleCase(id),
    info: getFeatById(id)?.description || "Feat details are drawn from the existing character creator data.",
    preview: () => {
      state.hoveredFeatId = id;
      state.hoveredFeatSource = "Summary";
      renderDetails();
    },
  }));
}

function summarySpellGroups() {
  const ids = [...new Set([
    ...(state.draft.spells?.knownSpellIds || []),
    ...(state.draft.spells?.preparedSpellIds || []),
    ...fixedSpellGrantRecords().map((record) => record.option.id),
  ])].map((id) => SPELLS[id]).filter(Boolean).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  const levels = new Map();
  for (const spell of ids) {
    const key = spell.level || 0;
    if (!levels.has(key)) levels.set(key, []);
    levels.get(key).push({
      text: spell.name,
      info: spell.text || `${spell.name}, ${spell.school}`,
      preview: () => {
        state.hoveredSpellOption = { option: spellOptionFromId(spell.id), source: "Summary" };
        renderDetails();
      },
    });
  }
  return [...levels.entries()].map(([level, lines]) => ({
    title: level === 0 ? "Cantrips" : `Level ${level}`,
    lines,
  }));
}

function summaryGearLines() {
  const pools = createGearChoicePools(state.draft).pools;
  const gearLines = pools.flatMap((pool) => {
    return pool.selected.map((id) => {
      const option = pool.options.find((item) => item.id === id);
      return {
        text: `${pool.label}: ${option?.name || titleCase(id)}`,
        info: gearOption(option || { id, name: titleCase(id) }, pool).meta || pool.label,
        preview: () => {
          state.hoveredGearOption = option ? { pool, option } : null;
          renderDetails();
        },
      };
    });
  });
  const deviceLines = createDeviceRecipeChoicePools(state.draft).pools.flatMap((pool) =>
    pool.selected.map((id) => {
      const option = pool.options.find((item) => item.id === id);
      return {
        text: `Prepared Device: ${option?.name || titleCase(id)}`,
        info: option?.text || "Prepared device recipe.",
        preview: () => previewDeviceOption(option || { id, name: titleCase(id) }, "Prepared Device"),
      };
    })
  );
  return [...gearLines, ...deviceLines];
}

function spellName(id) {
  return SPELLS[id]?.name || titleCase(id);
}

function summarySkillProficiencies() {
  const values = [
    ...(selectedBackground()?.skillProficiencies || []),
  ];
  for (const featId of summaryFeatIds()) {
    const feat = getFeatById(featId);
    values.push(...(feat?.effects?.proficiencies?.skills || []));
    const choices = state.draft.choices?.featChoices?.[featId] || {};
    for (const choice of feat?.choices || []) {
      const selected = choices[choice.id];
      const selectedValues = Array.isArray(selected) ? selected : [selected].filter(Boolean);
      if (choice.kind === "skill") values.push(...selectedValues);
      if (choice.kind === "skill_or_tool") {
        values.push(...selectedValues.filter((value) => String(value).startsWith("skill:")).map((value) => String(value).slice(6)));
      }
    }
  }
  return new Set(values.filter(Boolean));
}

function summaryFeatIds() {
  return [
    selectedBackground()?.legacyFeatId || selectedBackground()?.originFeat,
    ...Object.values(state.draft.choices?.advancementChoices || {}).map((choice) => choice?.featId),
    ...Object.values(state.draft.choices?.speciesChoices || {}).flatMap((value) => Array.isArray(value) ? value : [value]),
  ].filter((id) => getFeatById(id));
}

function abilityAbbrev(id) {
  return ({ strength: "STR", dexterity: "DEX", constitution: "CON", intelligence: "INT", wisdom: "WIS", charisma: "CHA" })[id] || titleCase(id);
}

function detailSection(title, body) {
  return `<section class="creator-details-section"><h2>${escapeHtml(title)}</h2>${body}</section>`;
}

function grantLine(text, className = "") {
  const p = document.createElement("p");
  if (className) p.className = className;
  p.textContent = text;
  return p;
}

function originFeatLine(featId) {
  const p = document.createElement("p");
  p.append(`Origin feat: ${titleCase(featId)} `);

  const icon = document.createElement("span");
  icon.className = "feat-detail-icon";
  icon.setAttribute("aria-label", "Details provided later in the character creator");
  icon.tabIndex = 0;
  icon.append(createDiamondSvg());
  attachTooltip(icon, "Details provided later in the character creator", { placement: "bottom" });
  p.append(icon);

  return p;
}

function fadePageContent() {
  const nodes = [els.shell, els.diamonds, els.nextButton].filter(Boolean);
  for (const node of nodes) {
    node.classList.add("is-resetting");
    node.classList.remove("is-visible");
  }

  for (const node of nodes) void node.offsetWidth;

  requestAnimationFrame(() => {
    for (const node of nodes) {
      node.classList.remove("is-resetting");
      node.classList.add("is-visible");
    }
  });
}

function attachTooltip(node, text, options = {}) {
  node.addEventListener("pointerenter", () => showTooltip(node, text, options));
  node.addEventListener("focus", () => showTooltip(node, text, options));
  node.addEventListener("pointerleave", hideTooltip);
  node.addEventListener("blur", hideTooltip);
}

function showTooltip(node, text, options = {}) {
  if (!els.tooltip) return;
  const rect = node.getBoundingClientRect();
  els.tooltip.textContent = text;
  els.tooltip.hidden = false;
  const top = options.placement === "bottom"
    ? Math.min(window.innerHeight - els.tooltip.offsetHeight - 12, rect.bottom + 10)
    : Math.max(12, rect.top - els.tooltip.offsetHeight - 10);
  const left = Math.min(window.innerWidth - els.tooltip.offsetWidth - 12, Math.max(12, rect.left + rect.width / 2 - els.tooltip.offsetWidth / 2));
  els.tooltip.style.top = `${top}px`;
  els.tooltip.style.left = `${left}px`;
}

function hideTooltip() {
  if (!els.tooltip) return;
  els.tooltip.hidden = true;
}

function startGame() {
  const characterRecord = createStepCreatorCharacterRecord(state.draft);
  window.dispatchEvent(new CustomEvent("game:startFromCreator", { detail: { draft: structuredClone(state.draft), characterRecord } }));
  window.location.href = "../index.html";
}

function createDiamondSvg() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 18 18");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");

  const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  polygon.setAttribute("points", "9 2.2 15.8 9 9 15.8 2.2 9");
  svg.append(polygon);

  return svg;
}

function titleCase(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeAbilityId(value) {
  return String(value || "").toLowerCase();
}

function abilityModifier(score) {
  return Math.floor(((Number(score) || 10) - 10) / 2);
}

function signed(value) {
  return value >= 0 ? `+${value}` : String(value);
}

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[char]);
}
