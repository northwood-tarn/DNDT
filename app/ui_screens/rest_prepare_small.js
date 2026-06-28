const rows = [...document.querySelectorAll(".inventory-row")];
const spellRows = [...document.querySelectorAll(".spell-choice-row")];
const summary = document.querySelector(".item-summary");
const summaryTitle = document.querySelector("#itemSummaryTitle");
const summaryDescription = document.querySelector("#itemSummaryDescription");
const scrollArea = document.querySelector(".inventory-scroll");
let selectedRow = null;

for (const row of rows) {
  row.addEventListener("click", () => {
    rows.forEach((item) => item.classList.remove("is-selected"));
    row.classList.add("is-selected");
    selectedRow = row;
    if (row.classList.contains("spell-choice-row")) toggleSpellChoice(row);
    showSummary(row);
  });
  row.addEventListener("mouseenter", () => showSummary(row));
  row.addEventListener("mouseleave", () => {
    if (selectedRow) showSummary(selectedRow);
    else clearSummary();
  });
}

updateSpellCounts();
updateOverflowCounters();
window.addEventListener("resize", updateOverflowCounters);

function toggleSpellChoice(row) {
  const total = document.querySelector("[data-spell-total]");
  const max = Number(total?.dataset.max || 0);
  const selected = document.querySelectorAll(".spell-choice-row.is-prepared").length;
  if (row.classList.contains("is-prepared")) {
    row.classList.remove("is-prepared");
  } else if (selected < max) {
    row.classList.add("is-prepared");
  }
  updateSpellCounts();
}

function updateSpellCounts() {
  let totalSelected = 0;
  for (const group of document.querySelectorAll("[data-spell-group]")) {
    const selected = group.querySelectorAll(".spell-choice-row.is-prepared").length;
    totalSelected += selected;
    group.querySelector("[data-spell-group-count]").textContent = String(selected);
    const resource = document.querySelector(`[data-spell-count="${group.dataset.spellGroup}"] span:last-child`);
    if (resource) resource.textContent = String(selected);
  }
  const totalRow = document.querySelector("[data-spell-total]");
  const totalMax = Number(totalRow?.dataset.max || 0);
  const total = totalRow?.querySelector("span:last-child");
  if (total) total.textContent = `${totalSelected} / ${totalMax}`;
  spellRows.forEach((row) => {
    row.classList.toggle("is-choice-blocked", totalSelected >= totalMax && !row.classList.contains("is-prepared"));
  });
  updateOverflowCounters();
}

function updateOverflowCounters() {
  const hasOverflow = scrollArea ? scrollArea.scrollHeight > scrollArea.clientHeight + 1 : false;
  document.querySelectorAll(".resource-row.is-overflow-only").forEach((row) => {
    row.hidden = !hasOverflow;
  });
}

function showSummary(row) {
  const title = row.dataset.title || row.querySelector("span")?.textContent?.trim() || "";
  const description = row.dataset.description || "";
  if (!title && !description) {
    clearSummary();
    return;
  }
  if (summaryTitle) summaryTitle.textContent = title;
  if (summaryDescription) summaryDescription.textContent = description;
  summary?.classList.remove("is-empty");
}

function clearSummary() {
  if (summaryTitle) summaryTitle.textContent = "";
  if (summaryDescription) summaryDescription.textContent = "";
  summary?.classList.add("is-empty");
}
