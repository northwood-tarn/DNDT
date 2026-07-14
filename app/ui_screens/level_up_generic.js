import { applyLevelUpToDraft, createLevelUpManifest, createStarterCharacterDraft, validateLevelUpSubmission } from "../character/index.js";
import { dissipateGreenFog } from "../ui/fogDissolve.js";

const url = new URL(window.location.href);
const variantId = url.searchParams.get("variant") || "warlock";
const maxLevel = Number(url.searchParams.get("max") || 13);

const state = {
  draft: createStarterCharacterDraft(variantId),
  values: {},
  open: {},
};
state.draft.identity.level = Number(url.searchParams.get("from") || 1);

const els = {
  levelTitle: document.querySelector("#levelTitle"),
  characterLine: document.querySelector("#characterLine"),
  levelContent: document.querySelector("#levelContent"),
  detailTitle: document.querySelector("#detailTitle"),
  detailText: document.querySelector("#detailText"),
  completeLevelButton: document.querySelector("#completeLevelButton"),
};

render();

function render() {
  const toLevel = Math.min(maxLevel, (state.draft.identity.level || 1) + 1);
  const manifest = createLevelUpManifest(state.draft, { toLevel, values: state.values });
  els.levelTitle.textContent = `Level ${manifest.toLevel}`;
  els.characterLine.textContent = `${state.draft.identity.characterName}, ${manifest.className}`;
  els.levelContent.replaceChildren(...[
    ...manifest.steps.map((step) => renderStep(step)),
    ...renderGrants(manifest.grants),
  ].filter(Boolean));
  els.completeLevelButton.disabled = !validateLevelUpSubmission(manifest, state.values).valid;
  els.completeLevelButton.onclick = () => complete(manifest);
}

function renderStep(step) {
  if (step.kind === "hp_roll") return renderHpStep(step);
  if (step.kind === "single_choice") return renderChoiceStep(step, 1);
  if (step.kind === "multi_choice") return renderChoiceStep(step, step.count || 1);
  if (step.kind === "feat_or_asi") return renderFeatStep(step);
  return null;
}

function renderHpStep(step) {
  const value = state.values[step.id] || null;
  const wrap = document.createElement("section");
  wrap.className = "hp-roller";
  wrap.innerHTML = `<h2>${step.label}</h2><button class="roll-button" type="button">Roll HP</button><div class="roll-result">${value ? `<strong>+${value.total}</strong><span>${value.die} + ${conMod()}</span>` : "<span></span>"}<small>dice + CON modifier</small></div>`;
  wrap.querySelector("button").addEventListener("click", () => {
    const die = rollDieNoOne(step.hitDie || 8);
    state.values[step.id] = { die, total: die + conMod() };
    render();
  });
  return wrap;
}

function renderChoiceStep(step, count) {
  const selected = selectedValues(step);
  const groups = groupOptionsByLevel(step.options || []);
  const content = document.createElement("div");
  content.className = "spell-level-groups";
  for (const [group, options] of groups) {
    const details = document.createElement("details");
    details.className = "choice-select spell-level-select";
    details.open = !!state.open[`${step.id}:${group}`];
    details.addEventListener("toggle", () => { state.open[`${step.id}:${group}`] = details.open; });
    const summary = document.createElement("summary");
    summary.className = "choice-select-summary";
    summary.innerHTML = `<span>${group}</span><small>${options.filter((option) => selected.includes(option.id)).length}</small>`;
    const menu = document.createElement("div");
    menu.className = "choice-select-menu";
    for (const option of options) {
      const row = choiceRow(option.name, selected.includes(option.id) ? "selected" : "");
      row.addEventListener("mouseenter", () => showOptionDetail(option));
      row.addEventListener("click", () => {
        const next = step.kind === "single_choice"
          ? [option.id]
          : toggleLimited(selected, option.id, count);
        state.values[step.id] = next;
        if (next.length >= count) state.open[`${step.id}:${group}`] = false;
        render();
      });
      menu.append(row);
    }
    details.append(summary, menu);
    content.append(details);
  }
  return choiceBlock(step.label, `Choose ${count}. You have chosen ${selected.length}.`, content, `${selected.length} / ${count}`, step.choiceKind === "subclass" ? "is-subclass" : "");
}

function renderFeatStep(step) {
  const choice = state.values[step.id] || null;
  const content = document.createElement("div");
  content.className = "asi-choice-content";
  const details = document.createElement("details");
  details.className = "choice-select feat-select";
  details.open = !!state.open[step.id];
  details.addEventListener("toggle", () => { state.open[step.id] = details.open; });
  const summary = document.createElement("summary");
  summary.className = "choice-select-summary";
  summary.innerHTML = `<span>${choice ? choice.name : "Choose feat or ASI"}</span><small>${choice ? 1 : 0}</small>`;
  const menu = document.createElement("div");
  menu.className = "choice-select-menu feat-select-menu";
  for (const option of step.options || []) {
    const row = choiceRow(option.name, choice?.id === option.id ? "selected" : "");
    row.addEventListener("mouseenter", () => showOptionDetail(option));
    row.addEventListener("click", () => {
      state.values[step.id] = { id: option.id, name: option.name, choices: {} };
      state.open[step.id] = false;
      render();
    });
    menu.append(row);
  }
  details.append(summary, menu);
  content.append(details);
  if (choice) content.append(...renderNestedFeatChoices(step, choice));
  return choiceBlock(step.label, "Choose one advancement option.", content, `${featComplete(step, choice) ? 1 : 0} / 1`);
}

function renderNestedFeatChoices(step, selectedFeat) {
  const feat = (step.options || []).find((option) => option.id === selectedFeat.id);
  return (feat?.choices || []).map((choice) => {
    const selected = selectedFeat.choices[choice.id] || [];
    const details = document.createElement("details");
    details.className = "choice-select feat-subchoice";
    details.open = !!state.open[`${step.id}:${choice.id}`];
    details.addEventListener("toggle", () => { state.open[`${step.id}:${choice.id}`] = details.open; });
    const summary = document.createElement("summary");
    summary.className = "choice-select-summary";
    summary.innerHTML = `<span>${feat.name}</span><small>${selected.filter(Boolean).length} / ${choice.count}</small>`;
    const menu = document.createElement("div");
    menu.className = "choice-select-menu feat-subchoice-menu";
    if (choice.kind === "repeated_choice") {
      for (let index = 0; index < choice.count; index += 1) {
        const list = document.createElement("div");
        list.className = "choice-list";
        for (const option of choice.options || []) {
          const row = choiceRow(option.name, selected[index] === option.id ? "selected" : "");
          row.addEventListener("click", () => {
            const next = [...selected];
            next[index] = option.id;
            selectedFeat.choices[choice.id] = next;
            if (next.filter(Boolean).length >= choice.count) state.open[`${step.id}:${choice.id}`] = false;
            render();
          });
          list.append(row);
        }
        menu.append(list);
      }
    } else {
      for (const option of choice.options || []) {
        const row = choiceRow(option.name, selected.includes(option.id) ? "selected" : "");
        row.addEventListener("click", () => {
          selectedFeat.choices[choice.id] = toggleLimited(selected, option.id, choice.count);
          if (selectedFeat.choices[choice.id].length >= choice.count) state.open[`${step.id}:${choice.id}`] = false;
          render();
        });
        menu.append(row);
      }
    }
    details.append(summary, menu);
    return details;
  });
}

function renderGrants(grants) {
  if (!grants.length) return [];
  const list = document.createElement("div");
  list.className = "choice-list";
  for (const grant of grants) {
    const row = choiceRow(grant.label, grant.source, true);
    row.addEventListener("mouseenter", () => showDetail(grant.label, grant.detail || ""));
    list.append(row);
  }
  return [choiceBlock("Feature gains", "Automatic gains at this level.", list)];
}

async function complete(manifest) {
  if (els.completeLevelButton.disabled) return;
  state.draft = applyLevelUpToDraft(state.draft, manifest, state.values);
  state.values = {};
  if (manifest.toLevel >= maxLevel) {
    els.completeLevelButton.disabled = true;
    els.completeLevelButton.textContent = "Complete";
    await dissipateGreenFog(document.querySelector(".inventory-screen"));
    return;
  }
  render();
}

function stepComplete(step) {
  if (step.kind === "hp_roll") return !!state.values[step.id];
  if (step.kind === "feat_or_asi") return featComplete(step, state.values[step.id]);
  return selectedValues(step).length === (step.count || 1);
}

function featComplete(step, choice) {
  if (!choice?.id) return false;
  const feat = (step.options || []).find((option) => option.id === choice.id);
  return (feat?.choices || []).every((nested) => (choice.choices[nested.id] || []).filter(Boolean).length === nested.count);
}

function selectedValues(step) {
  const value = state.values[step.id] || [];
  return Array.isArray(value) ? value : [value].filter(Boolean);
}

function groupOptionsByLevel(options) {
  const withLevels = options.some((option) => Number.isFinite(option.level));
  const groups = new Map();
  for (const option of options) {
    const key = withLevels ? (option.level === 0 ? "Cantrips" : `${ordinal(option.level)} level spells`) : "Choices";
    groups.set(key, [...(groups.get(key) || []), option]);
  }
  return [...groups.entries()];
}

function toggleLimited(values, id, max) {
  const set = new Set(values || []);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  return [...set].slice(0, max);
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

function showOptionDetail(option) {
  if (option.features?.length) {
    showDetailHtml(option.name, `<p>${option.description || ""}</p><ul class="detail-list">${option.features.map((feature) => `<li><strong>Level ${feature.level}: ${feature.name}</strong><span>${feature.description || ""}</span></li>`).join("")}</ul>`);
  } else {
    showDetail(option.name, option.description || "");
  }
}

function showDetail(title, text) {
  els.detailTitle.textContent = title;
  els.detailText.textContent = text;
}

function showDetailHtml(title, html) {
  els.detailTitle.textContent = title;
  els.detailText.innerHTML = html;
}

function conMod() {
  return Math.floor(((state.draft.abilities?.constitution || 10) - 10) / 2);
}

function rollDieNoOne(sides) {
  return Math.floor(Math.random() * (sides - 1)) + 2;
}

function ordinal(value) {
  if (value === 1) return "1st";
  if (value === 2) return "2nd";
  if (value === 3) return "3rd";
  return `${value}th`;
}
