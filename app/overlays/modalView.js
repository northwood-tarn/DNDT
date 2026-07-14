export function createInformationModal({ className, title, sections, onClose }) {
  const root = document.createElement("section");
  root.className = `information-overlay ${className}`;
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", title);
  const panel = document.createElement("div");
  panel.className = "information-panel";
  const heading = document.createElement("h1");
  heading.textContent = title;
  panel.append(heading);
  for (const section of sections) panel.append(renderSection(section));
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Close";
  close.addEventListener("click", onClose);
  panel.append(close);
  root.append(panel);
  return { root, close };
}

function renderSection(section) {
  const element = document.createElement("section");
  element.className = "information-panel__section";
  const heading = document.createElement("h2");
  heading.textContent = section.title;
  element.append(heading);
  if (!section.entries.length) {
    const empty = document.createElement("p");
    empty.textContent = section.empty || "None";
    element.append(empty);
  }
  for (const entry of section.entries) {
    const row = document.createElement("div");
    row.className = "information-panel__row";
    const label = document.createElement("strong");
    label.textContent = entry.label;
    const value = document.createElement("span");
    value.textContent = entry.value;
    row.append(label, value);
    element.append(row);
  }
  return element;
}

export function titleCase(value) {
  return String(value || "").replace(/[_\.]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function signed(value) { return Number(value) >= 0 ? `+${Number(value)}` : String(Number(value)); }
