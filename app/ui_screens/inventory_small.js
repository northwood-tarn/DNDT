const rows = [...document.querySelectorAll(".inventory-row")];
const menus = [...document.querySelectorAll(".inventory-row.has-menu")];
const summary = document.querySelector(".item-summary");
const summaryTitle = document.querySelector("#itemSummaryTitle");
const summaryDescription = document.querySelector("#itemSummaryDescription");
let selectedRow = null;

for (const row of rows) {
  const selectTarget = row.matches(".has-menu") ? row.querySelector(".item-main") : row;
  selectTarget?.addEventListener("click", () => {
    rows.forEach((item) => item.classList.remove("is-selected"));
    row.classList.add("is-selected");
    selectedRow = row;
    showSummary(row);
  });
  row.addEventListener("mouseenter", () => showSummary(row));
  row.addEventListener("mouseleave", () => {
    if (selectedRow) showSummary(selectedRow);
    else clearSummary();
  });
}

for (const row of menus) {
  const button = row.querySelector(".item-menu-button");
  const menu = row.querySelector(".item-menu");
  button?.addEventListener("click", (event) => {
    event.stopPropagation();
    const open = row.classList.contains("is-open");
    closeMenus();
    if (!open) {
      row.classList.add("is-open");
      button.setAttribute("aria-expanded", "true");
      menu.hidden = false;
    }
  });
}

document.addEventListener("click", (event) => {
  if (!event.target.closest(".inventory-row.has-menu")) closeMenus();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeMenus();
});

function closeMenus() {
  for (const row of menus) {
    row.classList.remove("is-open");
    row.querySelector(".item-menu-button")?.setAttribute("aria-expanded", "false");
    const menu = row.querySelector(".item-menu");
    if (menu) menu.hidden = true;
  }
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
