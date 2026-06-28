import Warlock from "../data/classes/Warlock.js";
import { listFeats } from "../data/feats.js";
import { SPELLS as ALL_SPELLS, listSpellsByClass } from "../data/spells.js";
import { getToolById, listToolsByPool } from "../data/tools.js";
import { SKILL_OPTIONS } from "../character_creator/creatorHarnessOptions.js";

const ABILITIES = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];
const START = {
  name: "Generated Warlock",
  species: "Chthonic Tiefling",
  background: "Guide",
  abilities: { strength: 8, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 10, charisma: 16 },
  knownSpellIds: ["eldritch_blast", "mage_hand", "hex", "armor_of_agathys"],
};

const SPELLS = listSpellsByClass("Warlock")
  .filter((spell) => spell.active !== false)
  .filter((spell) => !spell.hiddenUntilUnlocked && !spell.featureGate)
  .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

const FEATS = listFeats()
  .filter((feat) => feat.type === "general")
  .sort((a, b) => a.name.localeCompare(b.name));

const LEVELS = Array.from({ length: 12 }, (_, index) => index + 2);
const PROGRESSION = {
  2: { cantrips: 2, spells: 2, maxSpellLevel: 1 },
  3: { cantrips: 2, spells: 2, maxSpellLevel: 2, subclass: true, pact: true },
  4: { cantrips: 3, spells: 3, maxSpellLevel: 2, asi: true },
  5: { cantrips: 3, spells: 3, maxSpellLevel: 3 },
  6: { cantrips: 3, spells: 3, maxSpellLevel: 3 },
  7: { cantrips: 3, spells: 3, maxSpellLevel: 4 },
  8: { cantrips: 3, spells: 7, maxSpellLevel: 4, asi: true },
  9: { cantrips: 3, spells: 7, maxSpellLevel: 5 },
  10: { cantrips: 4, spells: 10, maxSpellLevel: 5 },
  11: { cantrips: 4, spells: 10, maxSpellLevel: 5, arcanum: 6 },
  12: { cantrips: 4, spells: 11, maxSpellLevel: 5, asi: true },
  13: { cantrips: 4, spells: 11, maxSpellLevel: 5, arcanum: 7 },
};

const state = {
  level: 2,
  hpRolls: {},
  spellChoices: {},
  cantripChoices: {},
  subclassId: null,
  pactId: null,
  tomeCantrips: [],
  asiChoices: {},
  arcanumChoices: {},
  openPickers: {},
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
  for (const level of LEVELS) {
    state.spellChoices[level] = [];
    state.cantripChoices[level] = [];
  }
  els.rollHpButton.addEventListener("click", () => {
    const die = Math.floor(Math.random() * 7) + 2;
    state.hpRolls[state.level] = { die, total: die + conMod() };
    render();
  });
  els.completeLevelButton.addEventListener("click", () => {
    if (!canCompleteLevel()) return;
    state.level = Math.min(13, state.level + 1);
    render();
  });
  render();
}

function render() {
  const subclass = subclassName(state.subclassId);
  const pact = pactName(state.pactId);
  els.levelTitle.textContent = `Level ${state.level}`;
  els.characterLine.textContent = [START.name, START.species, subclass, pact, "Warlock"].filter(Boolean).join(", ");
  renderHp();
  renderChoices();
  els.completeLevelButton.disabled = !canCompleteLevel();
  showDetail("", "");
}

function renderHp() {
  const roll = state.hpRolls[state.level];
  els.hpTitle.textContent = "Hit points";
  els.hpRollResult.innerHTML = roll
    ? `<strong>+${roll.total}</strong><span>${roll.die} + ${conMod()}</span><small>dice + CON modifier</small>`
    : `<span></span><small>dice + CON modifier</small>`;
}

function renderChoices() {
  const blocks = [
    ...spellBlocks(),
    ...levelThreeBlocks(),
    ...asiBlocks(),
    ...arcanumBlocks(),
    ...featureBlocks(),
  ];
  els.levelContent.replaceChildren(...blocks.filter(Boolean));
}

function spellBlocks() {
  const out = [];
  const cantripNeed = Math.max(0, PROGRESSION[state.level].cantrips - knownCantripsBefore(state.level).length);
  const spellNeed = Math.max(0, PROGRESSION[state.level].spells - knownLeveledBefore(state.level).length);
  if (cantripNeed) {
    out.push(spellPickerBlock({
      id: "cantrips",
      title: "Cantrips",
      note: `Choose ${cantripNeed} Warlock cantrip${cantripNeed === 1 ? "" : "s"}.`,
      selectedIds: state.cantripChoices[state.level],
      setSelected: (ids) => { state.cantripChoices[state.level] = ids; },
      options: SPELLS.filter((spell) => spell.level === 0 && !knownCantripsBefore(state.level).includes(spell.id)),
      count: cantripNeed,
    }));
  }
  if (spellNeed) {
    out.push(spellPickerBlock({
      id: "spells",
      title: "Known spells",
      note: `Choose ${spellNeed} Warlock spell${spellNeed === 1 ? "" : "s"}.`,
      selectedIds: state.spellChoices[state.level],
      setSelected: (ids) => { state.spellChoices[state.level] = ids; },
      options: SPELLS.filter((spell) => spell.level > 0 && spell.level <= PROGRESSION[state.level].maxSpellLevel && !knownLeveledBefore(state.level).includes(spell.id)),
      count: spellNeed,
    }));
  }
  return out;
}

function levelThreeBlocks() {
  if (state.level !== 3) return [];
  return [subclassBlock(), pactBlock(), tomeCantripBlock()].filter(Boolean);
}

function subclassBlock() {
  const list = document.createElement("div");
  list.className = "choice-list";
  for (const [name, subclass] of Object.entries(Warlock.subclasses)) {
    const row = choiceRow(name, state.subclassId === subclass.id ? "selected" : "");
    row.addEventListener("mouseenter", () => showFeatureSet(name, subclass.summary, subclass.features));
    row.addEventListener("click", () => {
      state.subclassId = subclass.id;
      render();
    });
    list.append(row);
  }
  return choiceBlock("Subclass", "Choose a Warlock subclass.", list, `${state.subclassId ? 1 : 0} / 1`, "is-subclass");
}

function pactBlock() {
  const list = document.createElement("div");
  list.className = "choice-list";
  for (const [name, pact] of Object.entries(Warlock.pacts)) {
    const row = choiceRow(name, state.pactId === pact.id ? "selected" : "");
    row.addEventListener("mouseenter", () => showFeatureSet(name, pact.summary, pact.features));
    row.addEventListener("click", () => {
      state.pactId = pact.id;
      if (pact.id !== "pact_of_the_tome") state.tomeCantrips = [];
      render();
    });
    list.append(row);
  }
  return choiceBlock("Pact", "Choose a Warlock pact.", list, `${state.pactId ? 1 : 0} / 1`, "is-subclass");
}

function tomeCantripBlock() {
  if (state.pactId !== "pact_of_the_tome") return null;
  return spellPickerBlock({
    id: "tome_cantrips",
    title: "Book of Shadows",
    note: "Choose 2 cantrips from any class list.",
    selectedIds: state.tomeCantrips,
    setSelected: (ids) => { state.tomeCantrips = ids; },
    options: Object.values(ALL_SPELLS)
      .filter((spell) => spell.active !== false && spell.level === 0)
      .sort((a, b) => a.name.localeCompare(b.name)),
    count: 2,
  });
}

function asiBlocks() {
  if (!PROGRESSION[state.level].asi) return [];
  const selected = state.asiChoices[state.level] || null;
  const content = document.createElement("div");
  content.className = "asi-choice-content";
  const details = document.createElement("details");
  details.className = "choice-select feat-select";
  details.open = openKey("feat");
  details.addEventListener("toggle", () => setOpenKey("feat", details.open));
  const summary = document.createElement("summary");
  summary.className = "choice-select-summary";
  summary.innerHTML = `<span>${selected ? selectedAsiLabel(selected) : "Choose feat or ASI"}</span><small>${selected ? 1 : 0}</small>`;
  const menu = document.createElement("div");
  menu.className = "choice-select-menu feat-select-menu";
  for (const feat of FEATS) {
    const row = choiceRow(feat.name, selected?.featId === feat.id ? "selected" : "");
    row.addEventListener("mouseenter", () => showDetail(feat.name, feat.description || ""));
    row.addEventListener("click", () => {
      state.asiChoices[state.level] = { featId: feat.id, choices: {} };
      setOpenKey("feat", false);
      render();
    });
    menu.append(row);
  }
  details.append(summary, menu);
  content.append(details);
  if (selected?.featId) content.append(...renderFeatSubchoices(selected));
  return [choiceBlock("Feat / ASI", "Choose one advancement option.", content, `${isAsiChoiceComplete(selected) ? 1 : 0} / 1`)];
}

function arcanumBlocks() {
  const arcanumLevel = PROGRESSION[state.level].arcanum;
  if (!arcanumLevel) return [];
  const selectedIds = state.arcanumChoices[state.level] ? [state.arcanumChoices[state.level]] : [];
  return [spellPickerBlock({
    id: `arcanum_${arcanumLevel}`,
    title: "Mystic Arcanum",
    note: `Choose one ${ordinal(arcanumLevel)} level Warlock spell.`,
    selectedIds,
    setSelected: (ids) => { state.arcanumChoices[state.level] = ids[0] || null; },
    options: SPELLS.filter((spell) => spell.level === arcanumLevel),
    count: 1,
  })];
}

function featureBlocks() {
  const rows = [
    ...featureRows("Warlock", Warlock.features[state.level] || []),
    ...featureRows(subclassName(state.subclassId), selectedSubclass()?.features?.[state.level] || []),
    ...featureRows(pactName(state.pactId), selectedPact()?.features?.[state.level] || []),
  ];
  if (!rows.length) return [];
  const list = document.createElement("div");
  list.className = "choice-list";
  list.append(...rows);
  return [choiceBlock("Feature gains", "Automatic gains at this level.", list)];
}

function spellPickerBlock({ id, title, note, selectedIds, setSelected, options, count }) {
  const wrap = document.createElement("div");
  wrap.className = "spell-level-groups";
  const selected = new Set(selectedIds);
  const levels = [...new Set(options.map((spell) => spell.level))].sort((a, b) => b - a);
  for (const level of levels) {
    const levelOptions = options.filter((spell) => spell.level === level);
    const details = document.createElement("details");
    details.className = "choice-select spell-level-select";
    details.open = openKey(`${id}:${level}`);
    details.addEventListener("toggle", () => setOpenKey(`${id}:${level}`, details.open));
    const summary = document.createElement("summary");
    summary.className = "choice-select-summary";
    summary.innerHTML = `<span>${level === 0 ? "Cantrips" : `${ordinal(level)} level spells`}</span><small>${levelOptions.filter((spell) => selected.has(spell.id)).length}</small>`;
    const menu = document.createElement("div");
    menu.className = "choice-select-menu";
    for (const spell of levelOptions) {
      const label = document.createElement("label");
      label.className = "spell-option";
      label.innerHTML = `<input type="checkbox" value="${spell.id}" ${selected.has(spell.id) ? "checked" : ""}><span>${spell.name}</span>`;
      const input = label.querySelector("input");
      label.addEventListener("mouseenter", () => showSpellDetail(spell));
      input.addEventListener("change", () => {
        const next = updateLimited(selectedIds, input.value, input.checked, count);
        setSelected(next);
        if (input.checked && next.length >= count) setOpenKey(`${id}:${level}`, false);
        render();
      });
      menu.append(label);
    }
    details.append(summary, menu);
    wrap.append(details);
  }
  return choiceBlock(title, `${note} You have chosen ${selectedIds.length}.`, wrap, `${selectedIds.length} / ${count}`);
}

function renderFeatSubchoices(selection) {
  const feat = FEATS.find((item) => item.id === selection.featId);
  if (!feat?.choices?.length) return [];
  return feat.choices.map((choice) => renderFeatSubchoice(feat, choice, selection));
}

function renderFeatSubchoice(feat, choice, selection) {
  const selected = selectedFeatChoice(selection, choice.id);
  const count = choice.count || 1;
  const options = featChoiceOptions(choice);
  const details = document.createElement("details");
  details.className = "choice-select feat-subchoice";
  const key = `feat:${feat.id}:${choice.id}`;
  details.open = openKey(key);
  details.addEventListener("toggle", () => setOpenKey(key, details.open));
  const summary = document.createElement("summary");
  summary.className = "choice-select-summary";
  summary.innerHTML = `<span>${feat.name}</span><small>${selected.filter(Boolean).length} / ${count}</small>`;
  const menu = document.createElement("div");
  menu.className = "choice-select-menu feat-subchoice-menu";
  if (choice.kind === "ability_score" || choice.kind === "saving_throw_ability") {
    menu.append(...repeatedChoiceRows({ feat, choice, selection, options, selected, count, key }));
  } else {
    for (const option of options) {
      const label = document.createElement("label");
      label.className = "spell-option feat-subchoice-option";
      label.innerHTML = `<input type="checkbox" value="${option.id}" ${selected.includes(option.id) ? "checked" : ""}><span>${option.name}</span>`;
      const input = label.querySelector("input");
      label.addEventListener("mouseenter", () => showDetail(option.name, option.text || feat.description || ""));
      input.addEventListener("change", () => {
        const next = updateLimited(selected, input.value, input.checked, count);
        setFeatSubchoice(selection, choice.id, next);
        if (input.checked && next.length >= count) setOpenKey(key, false);
        render();
      });
      menu.append(label);
    }
  }
  details.append(summary, menu);
  return details;
}

function repeatedChoiceRows({ feat, choice, selection, options, selected, count, key }) {
  return Array.from({ length: count }, (_, index) => {
    const group = document.createElement("div");
    group.className = "choice-list";
    for (const option of options) {
      const row = choiceRow(option.name, selected[index] === option.id ? "selected" : "");
      row.addEventListener("mouseenter", () => showDetail(option.name, feat.description || ""));
      row.addEventListener("click", () => {
        const next = [...selected];
        next[index] = option.id;
        setFeatSubchoice(selection, choice.id, next);
        if (next.filter(Boolean).length >= count) setOpenKey(key, false);
        render();
      });
      group.append(row);
    }
    return group;
  });
}

function featChoiceOptions(choice) {
  if (choice.kind === "ability_score" || choice.kind === "saving_throw_ability") {
    return (choice.options || ABILITIES).map((id) => ({ id, name: titleCase(id) }));
  }
  if (choice.kind === "damage_type") return (choice.options || []).map((id) => ({ id, name: titleCase(id) }));
  if (choice.kind === "skill" || choice.kind === "skill_expertise") return (choice.options || SKILL_OPTIONS).map((id) => ({ id, name: titleCase(id) }));
  if (choice.kind === "tool") return resolveToolPool(choice.pool || choice.options || "tools").map((id) => ({ id, name: getToolById(id)?.name || titleCase(id) }));
  if (choice.kind === "skill_or_tool") return [
    ...SKILL_OPTIONS.map((id) => ({ id: `skill:${id}`, name: titleCase(id) })),
    ...resolveToolPool("tools").map((id) => ({ id: `tool:${id}`, name: getToolById(id)?.name || titleCase(id) })),
  ];
  if (choice.kind === "spell" || choice.kind === "spell_list") {
    return Object.values(ALL_SPELLS)
      .filter((spell) => spell.active !== false)
      .filter((spell) => spellAllowedForChoice(choice, spell))
      .map((spell) => ({ id: spell.id, name: spell.name, text: spell.text || "" }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  return (choice.options || []).map((id) => ({ id, name: titleCase(id) }));
}

function canCompleteLevel() {
  if (!state.hpRolls[state.level]) return false;
  const cantripNeed = Math.max(0, PROGRESSION[state.level].cantrips - knownCantripsBefore(state.level).length);
  const spellNeed = Math.max(0, PROGRESSION[state.level].spells - knownLeveledBefore(state.level).length);
  if ((state.cantripChoices[state.level] || []).length !== cantripNeed) return false;
  if ((state.spellChoices[state.level] || []).length !== spellNeed) return false;
  if (state.level === 3 && !state.subclassId) return false;
  if (state.level === 3 && !state.pactId) return false;
  if (state.level === 3 && state.pactId === "pact_of_the_tome" && state.tomeCantrips.length !== 2) return false;
  if (PROGRESSION[state.level].asi && !isAsiChoiceComplete(state.asiChoices[state.level])) return false;
  if (PROGRESSION[state.level].arcanum && !state.arcanumChoices[state.level]) return false;
  return true;
}

function knownCantripsBefore(level) {
  const ids = START.knownSpellIds.filter((id) => spellById(id)?.level === 0);
  for (const nextLevel of LEVELS) {
    if (nextLevel >= level) break;
    ids.push(...(state.cantripChoices[nextLevel] || []));
  }
  return [...new Set(ids)];
}

function knownLeveledBefore(level) {
  const ids = START.knownSpellIds.filter((id) => (spellById(id)?.level || 0) > 0);
  for (const nextLevel of LEVELS) {
    if (nextLevel >= level) break;
    ids.push(...(state.spellChoices[nextLevel] || []));
  }
  return [...new Set(ids)];
}

function updateLimited(values, id, checked, max) {
  const selected = new Set(values || []);
  if (checked) selected.add(id);
  else selected.delete(id);
  const next = [...selected];
  return next.length > max ? values || [] : next;
}

function isAsiChoiceComplete(choice) {
  if (!choice?.featId) return false;
  const feat = FEATS.find((item) => item.id === choice.featId);
  if (!feat?.choices?.length) return true;
  return feat.choices.every((requirement) => selectedFeatChoice(choice, requirement.id).filter(Boolean).length === (requirement.count || 1));
}

function selectedFeatChoice(selection, choiceId) {
  const value = selection.choices?.[choiceId];
  return Array.isArray(value) ? value : value ? [value] : [];
}

function setFeatSubchoice(selection, choiceId, values) {
  selection.choices = { ...(selection.choices || {}), [choiceId]: values };
  state.asiChoices[state.level] = selection;
}

function selectedAsiLabel(choice) {
  const feat = FEATS.find((item) => item.id === choice.featId);
  return feat?.name || "Feat";
}

function featureRows(source, features) {
  return features
    .filter((feature) => !feature.effects?.advancement?.length && !feature.effects?.choiceRequirements?.length)
    .map((feature) => {
      const row = choiceRow(feature.name, source, true);
      row.addEventListener("mouseenter", () => showDetail(feature.name, feature.description || ""));
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

function choiceRow(name, meta = "", selected = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "choice-row";
  if (selected || meta === "selected") button.classList.add("is-selected");
  button.innerHTML = meta ? `<span>${name}</span><small>${meta}</small>` : `<span>${name}</span>`;
  return button;
}

function showFeatureSet(title, summary, features) {
  const rows = Object.entries(features || {}).map(([level, items]) => (
    items.map((feature) => `<li><strong>Level ${level}: ${feature.name}</strong><span>${feature.description || ""}</span></li>`).join("")
  )).join("");
  showDetailHtml(title, `<p>${summary || ""}</p><ul class="detail-list">${rows}</ul>`);
}

function showSpellDetail(spell) {
  const tags = [];
  if (spell.concentration) tags.push("concentration");
  if (spell.ritual) tags.push("ritual");
  if (spell.casting?.unit) tags.push(spell.casting.unit.replace(/_/g, " "));
  showDetail(spell.name, `${spell.text || ""}${tags.length ? ` (${tags.join(", ")})` : ""}`);
}

function showDetail(title, text) {
  els.detailTitle.textContent = title;
  els.detailText.textContent = text;
}

function showDetailHtml(title, html) {
  els.detailTitle.textContent = title;
  els.detailText.innerHTML = html;
}

function selectedSubclass() {
  return Object.values(Warlock.subclasses).find((item) => item.id === state.subclassId) || null;
}

function selectedPact() {
  return Object.values(Warlock.pacts).find((item) => item.id === state.pactId) || null;
}

function subclassName(id) {
  return Object.entries(Warlock.subclasses).find(([, item]) => item.id === id)?.[0] || "";
}

function pactName(id) {
  return Object.entries(Warlock.pacts).find(([, item]) => item.id === id)?.[0] || "";
}

function spellById(id) {
  return ALL_SPELLS[id] || null;
}

function conMod() {
  return Math.floor((START.abilities.constitution - 10) / 2);
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
  if (Array.isArray(filter.classes) && filter.classes.length && !filter.classes.some((cls) => (spell.classes || []).includes(cls))) return false;
  if (Array.isArray(filter.schools) && filter.schools.length && !filter.schools.includes(spell.school)) return false;
  if (filter.ritual === true && spell.ritual !== true) return false;
  if (filter.concentration === false && spell.concentration === true) return false;
  return true;
}

function openKey(key) {
  return !!state.openPickers[`${state.level}:${key}`];
}

function setOpenKey(key, value) {
  state.openPickers[`${state.level}:${key}`] = value;
}

function titleCase(value) {
  return String(value || "").replace(/[_-]+/g, " ").replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}

function ordinal(value) {
  if (value === 1) return "1st";
  if (value === 2) return "2nd";
  if (value === 3) return "3rd";
  return `${value}th`;
}
