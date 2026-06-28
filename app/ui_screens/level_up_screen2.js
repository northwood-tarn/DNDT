import Wizard from "../data/classes/Wizard.js";
import { listFeats } from "../data/feats.js";
import { SPECIES } from "../data/species.js";
import { SPELLS as ALL_SPELLS, listSpellsByClass } from "../data/spells.js";
import { getToolById, listToolsByPool } from "../data/tools.js";
import { weapons } from "../data/weapons.js";
import { SKILL_OPTIONS } from "../character_creator/creatorHarnessOptions.js";

const SPELLS = listSpellsByClass("Wizard")
  .filter((spell) => spell.active !== false)
  .filter((spell) => !spell.hiddenUntilUnlocked && !spell.featureGate)
  .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

const FEATS = listFeats()
  .filter((feat) => feat.type === "general")
  .sort((a, b) => a.name.localeCompare(b.name));

const CHARACTER = {
  name: "Mara Vell",
  classId: "wizard",
  speciesId: "tiefling",
  lineageId: "chthonic",
  background: "Sage",
  abilities: { strength: 8, dexterity: 14, constitution: 14, intelligence: 16, wisdom: 12, charisma: 10 },
  cantripIds: ["fire_bolt", "mage_hand", "minor_magic"],
  spellbookIds: ["burning_hands", "detect_magic", "mage_armor", "magic_missile", "shield", "sleep"],
};

const LEVEL_RULES = {
  2: { spellLevel: 1, slots: "3" },
  3: { spellLevel: 2, slots: "4 / 2" },
  4: { spellLevel: 2, slots: "4 / 3", asi: true },
  5: { spellLevel: 3, slots: "4 / 3 / 2", cantripChoices: 1 },
  6: { spellLevel: 3, slots: "4 / 3 / 3" },
  7: { spellLevel: 4, slots: "4 / 3 / 3 / 1" },
  8: { spellLevel: 4, slots: "4 / 3 / 3 / 2", asi: true },
  9: { spellLevel: 5, slots: "4 / 3 / 3 / 3 / 1" },
  10: { spellLevel: 5, slots: "4 / 3 / 3 / 3 / 2", cantripChoices: 1, jester: true },
  11: { spellLevel: 6, slots: "4 / 3 / 3 / 3 / 2 / 1" },
  12: { spellLevel: 6, slots: "4 / 3 / 3 / 3 / 2 / 1", asi: true },
};

const state = {
  level: 2,
  hpRolls: {},
  spellChoices: {},
  cantripChoices: {},
  subclassId: null,
  armament: null,
  asiChoices: {},
  jesterSpellId: null,
  openSpellLevels: {},
  openCantripPicker: {},
  openFeatPicker: {},
  openFeatSubchoices: {},
};

const els = {
  levelTitle: document.querySelector("#levelTitle"),
  characterLine: document.querySelector("#characterLine"),
  hpTitle: document.querySelector("#hpTitle"),
  rollHpButton: document.querySelector("#rollHpButton"),
  hpRollResult: document.querySelector("#hpRollResult"),
  levelContent: document.querySelector("#levelContent"),
  detailTitle: document.querySelector("#detailTitle"),
  detailText: document.querySelector("#detailText"),
  completeLevelButton: document.querySelector("#completeLevelButton"),
};

init();

function init() {
  els.rollHpButton.addEventListener("click", () => {
    state.hpRolls[state.level] = rollWizardHp();
    render();
  });
  els.completeLevelButton.addEventListener("click", () => {
    if (!canCompleteLevel()) return;
    state.level = Math.min(12, state.level + 1);
    render();
  });
  seedDefaults();
  render();
}

function seedDefaults() {
  for (const level of levels()) {
    const rule = LEVEL_RULES[level];
    state.spellChoices[level] = state.spellChoices[level] || [];
    if (rule.cantripChoices) state.cantripChoices[level] = state.cantripChoices[level] || [];
  }
}

function render() {
  const rule = LEVEL_RULES[state.level];
  const species = SPECIES[CHARACTER.speciesId];
  const lineage = species.lineages[CHARACTER.lineageId];
  const subclass = selectedSubclass();
  els.levelTitle.textContent = `Level ${state.level}`;
  els.characterLine.textContent = `${CHARACTER.name}, ${lineage.name} ${species.name} ${subclass ? `${subclassName(subclass.id)} ` : ""}${Wizard.name}`;

  renderHp(rule);
  renderChoices(rule, species, lineage);
  els.completeLevelButton.disabled = !canCompleteLevel();
  showDetail("", "");
}

function renderHp(rule) {
  const roll = state.hpRolls[state.level];
  els.hpTitle.textContent = "Hit points";
  els.hpRollResult.innerHTML = roll
    ? `<strong>+${roll.total}</strong><span>${roll.die} + ${conMod()}</span><small>dice + CON modifier</small>`
    : `<span></span><small>dice + CON modifier</small>`;
}

function renderChoices(rule, species, lineage) {
  const blocks = [
    renderSpellDropdown(rule),
    ...renderCantripChoice(rule),
    ...renderClassChoices(rule),
    ...renderFeatureGains(rule, species, lineage),
  ];
  els.levelContent.replaceChildren(...blocks);
}

function renderSpellDropdown(rule) {
  const legal = legalSpellOptions(rule);
  const selected = new Set(state.spellChoices[state.level] || []);
  const wrap = document.createElement("div");
  wrap.className = "spell-level-groups";
  const levelsAvailable = [...new Set(legal.map((spell) => spell.level))].sort((a, b) => b - a);

  for (const level of levelsAvailable) {
    const details = document.createElement("details");
    details.className = "choice-select spell-level-select";
    details.open = openSpellLevelsForCurrentLevel().has(level);
    details.addEventListener("toggle", () => {
      const open = openSpellLevelsForCurrentLevel();
      if (details.open) open.add(level);
      else open.delete(level);
    });

    const levelSpells = legal.filter((spell) => spell.level === level);
    const selectedCount = levelSpells.filter((spell) => selected.has(spell.id)).length;
    const summary = document.createElement("summary");
    summary.className = "choice-select-summary";
    summary.innerHTML = `<span>${ordinal(level)} level spells</span><small>${selectedCount}</small>`;
    summary.addEventListener("mouseenter", () => showDetail(`${ordinal(level)} level spells`, "Choose from this spell level."));

    const menu = document.createElement("div");
    menu.className = "choice-select-menu";
    for (const spell of orderedSpellOptions(levelSpells)) {
      const label = document.createElement("label");
      label.className = "spell-option";
      label.innerHTML = `
        <input type="checkbox" value="${spell.id}" ${selected.has(spell.id) ? "checked" : ""}>
        <span>${spell.name}</span>
      `;
      const input = label.querySelector("input");
      label.addEventListener("mouseenter", () => showSpellDetail(spell));
      input.addEventListener("change", () => {
        const next = updateLimitedSelection(input, state.spellChoices[state.level], 2);
        closeIfCompleteSelectionChanged(input, next.length, (count) => closeSpellLevelIfComplete(level, count));
        render();
      });
      menu.append(label);
    }

    details.append(summary, menu);
    wrap.append(details);
  }

  return choiceBlock("Spellbook", `Choose 2 Wizard spells. You have chosen ${selected.size}.`, wrap);
}

function renderCantripChoice(rule) {
  if (!rule.cantripChoices) return [];
  const known = new Set([...CHARACTER.cantripIds, ...Object.values(state.cantripChoices).flat()]);
  const selected = new Set(state.cantripChoices[state.level] || []);
  const legal = SPELLS.filter((spell) => spell.level === 0 && !known.has(spell.id));
  const details = document.createElement("details");
  details.className = "choice-select spell-level-select";
  details.open = !!state.openCantripPicker[state.level];
  details.addEventListener("toggle", () => {
    state.openCantripPicker[state.level] = details.open;
  });

  const summary = document.createElement("summary");
  summary.className = "choice-select-summary";
  summary.innerHTML = `<span>Cantrips</span><small>${selected.size}</small>`;
  summary.addEventListener("mouseenter", () => showDetail("New cantrip", "Choose one Wizard cantrip."));

  const menu = document.createElement("div");
  menu.className = "choice-select-menu";
  for (const spell of orderedSpellOptions(legal)) {
    const label = document.createElement("label");
    label.className = "spell-option";
    label.innerHTML = `
      <input type="checkbox" value="${spell.id}" ${selected.has(spell.id) ? "checked" : ""}>
      <span>${spell.name}</span>
    `;
    const input = label.querySelector("input");
    label.addEventListener("mouseenter", () => showSpellDetail(spell));
    input.addEventListener("change", () => {
      const next = updateCantripSelection(input);
      closeIfCompleteSelectionChanged(input, next.length, closeCantripIfComplete);
      render();
    });
    menu.append(label);
  }
  details.append(summary, menu);
  return [choiceBlock("New cantrip", "Wizard cantrip count increases at this level.", details, `${selected.size} / 1`)];
}

function renderClassChoices(rule) {
  const out = [];
  if (state.level === 3) {
    out.push(subclassChoiceBlock(), armamentChoiceBlock());
  }
  if (rule.asi) out.push(asiChoiceBlock());
  if (rule.jester) out.push(jesterChoiceBlock());
  return out;
}

function subclassChoiceBlock() {
  const list = document.createElement("div");
  list.className = "choice-list";
  for (const subclass of Object.values(Wizard.subclasses)) {
    const selected = state.subclassId === subclass.id;
    const row = choiceRow(subclassName(subclass.id), selected ? "selected" : "available", selected);
    row.addEventListener("mouseenter", () => showSubclassDetail(subclass));
    row.addEventListener("click", () => {
      state.subclassId = subclass.id;
      render();
    });
    list.append(row);
  }
  return choiceBlock("Subclass", "Wizard subclass choice from the class definition.", list, `${state.subclassId ? 1 : 0} / 1`, "is-subclass");
}

function armamentChoiceBlock() {
  if (state.subclassId !== "battlemage") return document.createDocumentFragment();
  const list = document.createElement("div");
  list.className = "choice-list";
  for (const weapon of regularWeapons()) {
    const selected = state.armament === weapon.id;
    const row = choiceRow(weapon.name, selected ? "selected" : weapon.damage, selected);
    row.addEventListener("mouseenter", () => showDetail("Arcane Armament", `${weapon.description} Battlemage gains all regular and martial weapons at level 3, then chooses one proficient melee weapon as the arcane armament and can use Intelligence for attack and damage with it.`));
    row.addEventListener("click", () => {
      state.armament = weapon.id;
      render();
    });
    list.append(row);
  }
  return choiceBlock("Arcane armament", "Battlemage level 3 choice. All regular and martial weapons are available.", list, `${state.armament ? 1 : 0} / 1`);
}

function asiChoiceBlock() {
  const selectedChoice = state.asiChoices[state.level] || null;
  const details = document.createElement("details");
  details.className = "choice-select feat-select";
  details.open = !!state.openFeatPicker[state.level];
  details.addEventListener("toggle", () => {
    state.openFeatPicker[state.level] = details.open;
  });

  const summary = document.createElement("summary");
  summary.className = "choice-select-summary";
  summary.innerHTML = `<span>${selectedChoice ? selectedAsiLabel(selectedChoice) : "Choose feat or ASI"}</span><small>${selectedChoice ? 1 : 0}</small>`;
  summary.addEventListener("mouseenter", () => showDetail("Feat choice", "Choose from the full feat list. Ability Score Improvement lets you choose any two abilities."));

  const menu = document.createElement("div");
  menu.className = "choice-select-menu feat-select-menu";
  for (const feat of FEATS) {
    const row = choiceRow(feat.name, "", selectedChoice?.featId === feat.id);
    row.addEventListener("mouseenter", () => showFeatDetail(feat));
    row.addEventListener("click", () => {
      state.asiChoices[state.level] = { featId: feat.id, choices: {} };
      state.openFeatPicker[state.level] = false;
      render();
    });
    menu.append(row);
  }

  details.append(summary, menu);
  const content = document.createElement("div");
  content.className = "asi-choice-content";
  content.append(details);
  if (selectedChoice?.featId) content.append(...renderFeatSubchoices(selectedChoice));
  return choiceBlock("Feat / ASI", "Class advancement rule from Wizard features.", content, `${isAsiChoiceComplete(selectedChoice) ? 1 : 0} / 1`);
}

function jesterChoiceBlock() {
  const feature = Wizard.features[10].find((item) => item.name.includes("Jester"));
  const options = feature.effects.choiceRequirements[0].options;
  const list = document.createElement("div");
  list.className = "choice-list";
  for (const id of options) {
    const spell = spellById(id);
    const selected = state.jesterSpellId === id;
    const row = choiceRow(spell.name, selected ? "selected" : "available", selected);
    row.addEventListener("mouseenter", () => showDetail(feature.name, feature.description));
    row.addEventListener("click", () => {
      state.jesterSpellId = id;
      render();
    });
    list.append(row);
  }
  return choiceBlock("Jester's Book of Shortcuts", "Class feature choice from Wizard level 10.", list, `${state.jesterSpellId ? 1 : 0} / 1`);
}

function renderFeatureGains(rule, species, lineage) {
  const rows = [
    ...featureRows("Wizard", automaticFeatures(Wizard.features, state.level)),
    ...featureRows(subclassName(state.subclassId), automaticFeatures(selectedSubclass()?.features, state.level)),
    ...featureRows(species.name, exactSpeciesFeatures(species.features, state.level)),
    ...featureRows(lineage.name, exactSpeciesFeatures(lineage.features, state.level)),
  ];
  if (!rows.length) return [];
  const list = document.createElement("div");
  list.className = "choice-list";
  for (const row of rows) list.append(row);
  return [choiceBlock("Feature gains", "Automatic gains from class, subclass, species, and lineage at this level.", list)];
}

function featureRows(source, features) {
  return features.map((feature) => {
    const row = choiceRow(feature.name, source, true, true);
    row.addEventListener("mouseenter", () => showDetail(feature.name, feature.description || feature.summary || "Feature gained at this level."));
    return row;
  });
}

function choiceBlock(title, note, content, count = "", extraClass = "") {
  const section = document.createElement("section");
  section.className = `choice-block ${extraClass}`.trim();
  const head = document.createElement("div");
  head.className = "choice-block-head";
  head.innerHTML = `<div><h2>${title}</h2><p>${note}</p></div><span class="choice-block-count">${count}</span>`;
  section.append(head, content);
  return section;
}

function choiceRow(name, meta, selected = false, granted = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "choice-row";
  if (selected) button.classList.add("is-selected");
  if (granted) button.classList.add("is-granted");
  button.innerHTML = meta ? `<span>${name}</span><small>${meta}</small>` : `<span>${name}</span>`;
  return button;
}

function updateLimitedSelection(input, values, max) {
  const selected = new Set(values || []);
  if (input.checked) selected.add(input.value);
  else selected.delete(input.value);
  const next = [...selected];
  if (next.length > max) {
    input.checked = false;
    return values || [];
  }
  state.spellChoices[state.level] = next;
  return next;
}

function updateCantripSelection(input) {
  if (!input.checked) {
    state.cantripChoices[state.level] = [];
    return [];
  }
  state.cantripChoices[state.level] = [input.value];
  return state.cantripChoices[state.level];
}

function renderFeatSubchoices(selection) {
  const feat = FEATS.find((item) => item.id === selection.featId);
  if (!feat?.choices?.length) return [];
  return feat.choices.map((choice) => renderFeatSubchoice(feat, choice, selection));
}

function renderFeatSubchoice(feat, choice, selection) {
  const selected = selectedFeatChoice(selection, choice.id);
  const options = featChoiceOptions(feat, choice);
  const requiredCount = choice.count || 1;
  const details = document.createElement("details");
  details.className = "choice-select feat-subchoice";
  const subchoiceKey = `${state.level}:${feat.id}:${choice.id}`;
  details.open = !!state.openFeatSubchoices[subchoiceKey];
  details.addEventListener("toggle", () => {
    state.openFeatSubchoices[subchoiceKey] = details.open;
  });

  const summary = document.createElement("summary");
  summary.className = "choice-select-summary";
  summary.innerHTML = `<span>${subchoiceTitle(choice, feat)}</span><small>${selected.filter(Boolean).length} / ${requiredCount}</small>`;
  summary.addEventListener("mouseenter", () => showDetail(feat.name, feat.description || "Feat choice."));

  const menu = document.createElement("div");
  menu.className = "choice-select-menu feat-subchoice-menu";
  if (choice.kind === "ability_score" || choice.kind === "saving_throw_ability") {
    menu.append(...repeatedFeatChoiceSelectors(feat, choice, selection, options));
  } else {
    for (const option of options) {
      const label = document.createElement("label");
      label.className = "spell-option feat-subchoice-option";
      label.innerHTML = `
        <input type="checkbox" value="${option.id}" ${selected.includes(option.id) ? "checked" : ""}>
        <span>${option.name}</span>
      `;
      const input = label.querySelector("input");
      label.addEventListener("mouseenter", () => showDetail(option.name, option.text || option.description || feat.description || ""));
      input.addEventListener("change", () => {
        const next = updateFeatSubchoiceSelection(selection, choice, input.value, input.checked);
        closeIfCompleteSelectionChanged(input, next.length, (count) => closeFeatSubchoiceIfComplete(selection, choice, count));
        render();
      });
      menu.append(label);
    }
  }

  details.append(summary, menu);
  return details;
}

function repeatedFeatChoiceSelectors(feat, choice, selection, options) {
  const selected = selectedFeatChoice(selection, choice.id);
  const count = choice.count || 1;
  return Array.from({ length: count }, (_, index) => {
    const wrap = document.createElement("div");
    wrap.className = "choice-list";
    for (const option of options) {
      const row = choiceRow(option.name, "", selected[index] === option.id);
      row.addEventListener("mouseenter", () => showDetail(feat.name, feat.description || "Feat choice."));
      row.addEventListener("click", () => {
        const next = [...selected];
        next[index] = option.id;
        setFeatSubchoice(selection, choice.id, next);
        if (next.filter(Boolean).length >= count) {
          state.openFeatSubchoices[`${state.level}:${feat.id}:${choice.id}`] = false;
        }
        render();
      });
      wrap.append(row);
    }
    return wrap;
  });
}

function closeSpellLevelIfComplete(level, count) {
  if (count >= 2) {
    openSpellLevelsForCurrentLevel().delete(level);
  }
}

function closeCantripIfComplete(count) {
  if (count >= 1) {
    state.openCantripPicker[state.level] = false;
  }
}

function closeFeatSubchoiceIfComplete(selection, choice, count) {
  if (count >= (choice.count || 1)) {
    state.openFeatSubchoices[`${state.level}:${selection.featId}:${choice.id}`] = false;
  }
}

function closeIfCompleteSelectionChanged(input, selectedCount, closeFn) {
  if (input.checked) {
    closeFn(selectedCount);
  }
}

function selectedFeatChoice(selection, choiceId) {
  const value = selection.choices?.[choiceId];
  return Array.isArray(value) ? value : value ? [value] : [];
}

function setFeatSubchoice(selection, choiceId, values) {
  const current = state.asiChoices[state.level] || selection;
  current.choices = { ...(current.choices || {}), [choiceId]: values };
  state.asiChoices[state.level] = current;
}

function updateFeatSubchoiceSelection(selection, choice, optionId, checked) {
  const selected = new Set(selectedFeatChoice(selection, choice.id));
  if (checked) selected.add(optionId);
  else selected.delete(optionId);
  const next = [...selected].slice(0, choice.count || 1);
  setFeatSubchoice(selection, choice.id, next);
  return next;
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
    return Object.values(ALL_SPELLS)
      .filter((spell) => spell?.active !== false)
      .filter((spell) => spellAllowedForChoice(choice, spell))
      .map((spell) => ({
        id: spell.id,
        name: spell.name,
        meta: `${spell.level === 0 ? "Cantrip" : `Level ${spell.level}`} · ${spell.school}${spell.ritual ? " · Ritual" : ""}`,
        text: spell.text || "",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  return (choice.options || []).map((option) => {
    if (typeof option === "string") return { id: option, name: titleCase(option), meta: titleCase(choice.kind) };
    return { id: option.id, name: option.name || titleCase(option.id), meta: option.meta || titleCase(choice.kind), text: option.text || option.description || "" };
  });
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

function legalSpellOptions(rule) {
  const knownBefore = new Set(knownSpellbookBefore(state.level));
  return SPELLS
    .filter((spell) => spell.level > 0 && spell.level <= rule.spellLevel)
    .filter((spell) => !knownBefore.has(spell.id));
}

function orderedSpellOptions(spells) {
  return [...spells].sort((a, b) => b.level - a.level || a.name.localeCompare(b.name));
}

function openSpellLevelsForCurrentLevel() {
  state.openSpellLevels[state.level] = state.openSpellLevels[state.level] || new Set();
  return state.openSpellLevels[state.level];
}

function canCompleteLevel() {
  const rule = LEVEL_RULES[state.level];
  if (!state.hpRolls[state.level]) return false;
  if ((state.spellChoices[state.level] || []).length !== 2) return false;
  if (rule.cantripChoices && (state.cantripChoices[state.level] || []).length !== rule.cantripChoices) return false;
  if (state.level === 3 && !state.subclassId) return false;
  if (state.level === 3 && state.subclassId === "battlemage" && !state.armament) return false;
  if (rule.asi && !isAsiChoiceComplete(state.asiChoices[state.level])) return false;
  if (rule.jester && !state.jesterSpellId) return false;
  return true;
}

function isAsiChoiceComplete(choice) {
  if (!choice?.featId) return false;
  const feat = FEATS.find((item) => item.id === choice.featId);
  if (!feat?.choices?.length) return true;
  return feat.choices.every((requirement) => {
    const selected = selectedFeatChoice(choice, requirement.id).filter(Boolean);
    return selected.length === (requirement.count || 1);
  });
}

function knownSpellbookBefore(level) {
  const ids = [...CHARACTER.spellbookIds];
  for (const nextLevel of levels()) {
    if (nextLevel >= level) break;
    ids.push(...(state.spellChoices[nextLevel] || []));
  }
  return ids;
}

function exactFeatures(featuresByLevel, level) {
  return featuresByLevel?.[level] || [];
}

function automaticFeatures(featuresByLevel, level) {
  return exactFeatures(featuresByLevel, level).filter((feature) => (
    !feature.effects?.advancement?.length && !feature.effects?.choiceRequirements?.length
  ));
}

function exactSpeciesFeatures(features, level) {
  return (features || []).filter((feature) => (feature.minLevel || 1) === level);
}

function selectedSubclass() {
  return Object.values(Wizard.subclasses).find((subclass) => subclass.id === state.subclassId) || null;
}

function regularWeapons() {
  return weapons
    .filter((weapon) => !weapon.magical && !weapon.effect && !weapon.modifiers)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function showSpellDetail(spell) {
  const tags = [];
  if (spell.concentration) tags.push("concentration");
  if (spell.ritual) tags.push("ritual");
  if (spell.casting?.unit) tags.push(spell.casting.unit.replace(/_/g, " "));
  showDetail(spell.name, `${spell.text || ""}${tags.length ? ` (${tags.join(", ")})` : ""}`);
}

function showSubclassDetail(subclass) {
  const rows = Object.entries(subclass.features || {}).map(([level, features]) => (
    features.map((feature) => `<li><strong>Level ${level}: ${feature.name}</strong><span>${feature.description || ""}</span></li>`).join("")
  ));
  if (subclass.id === "battlemage") {
    rows.unshift("<li><strong>Level 3: Weapon Training</strong><span>Battlemage gains all regular and martial weapons.</span></li>");
  }
  showDetailHtml(subclassName(subclass.id), `<p>${subclass.summary}</p><ul class="detail-list">${rows.join("")}</ul>`);
}

function showFeatDetail(feat) {
  showDetail(feat.name, feat.description || "Feat choice.");
}

function showDetail(title, text) {
  els.detailTitle.textContent = title;
  els.detailText.textContent = text;
}

function showDetailHtml(title, html) {
  els.detailTitle.textContent = title;
  els.detailText.innerHTML = html;
}

function rollWizardHp() {
  const die = randomD6NoOne();
  return { die, total: die + conMod() };
}

function randomD6NoOne() {
  return Math.floor(Math.random() * 5) + 2;
}

function conMod() {
  return abilityMod(CHARACTER.abilities.constitution);
}

function abilityMod(score) {
  return Math.floor((score - 10) / 2);
}

function spellById(id) {
  const spell = SPELLS.find((item) => item.id === id);
  if (!spell) throw new Error(`Missing Wizard spell: ${id}`);
  return spell;
}

function subclassName(id) {
  const found = Object.entries(Wizard.subclasses).find(([, subclass]) => subclass.id === id);
  return found?.[0] || id;
}

function selectedAsiLabel(choice) {
  const feat = FEATS.find((item) => item.id === choice.featId);
  if (choice.featId !== "ability_score_improvement") return feat?.name || "Feat";
  const abilities = selectedFeatChoice(choice, "abilities").filter(Boolean).map(formatAbility);
  return abilities.length ? `Ability Score Improvement: ${abilities.join(" / ")}` : "Ability Score Improvement";
}

function formatAbility(ability) {
  return ability.charAt(0).toUpperCase() + ability.slice(1);
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

function titleCase(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}

function summaryRow(label, value) {
  const row = document.createElement("div");
  row.className = "summary-row";
  row.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
  return row;
}

function levels() {
  return Object.keys(LEVEL_RULES).map(Number);
}

function ordinal(value) {
  if (value === 0) return "cantrip";
  if (value === 1) return "1st";
  if (value === 2) return "2nd";
  if (value === 3) return "3rd";
  return `${value}th`;
}
