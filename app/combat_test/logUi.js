import { formatEvent } from "../combat/combatLog.js";

export function renderCombatLog(logEl, events) {
  logEl.innerHTML = "";
  for (const event of events) {
    const item = document.createElement("li");
    appendFormattedLogText(item, event);
    logEl.appendChild(item);
  }
  logEl.scrollTop = logEl.scrollHeight;
}

function appendFormattedLogText(item, event) {
  const text = formatEvent(event);
  const actionNames = logActionNames(event);
  if (!actionNames.length) {
    item.textContent = text;
    return;
  }
  appendWithHighlights(item, text, actionNames);
}

function appendWithHighlights(item, text, actionNames) {
  const escapedNames = actionNames.map(escapeRegExp).sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`(${escapedNames.join("|")})`, "g");
  let lastIndex = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > lastIndex) item.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
    const strong = document.createElement("strong");
    strong.className = "log-action";
    strong.textContent = match[0];
    item.appendChild(strong);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) item.appendChild(document.createTextNode(text.slice(lastIndex)));
}

function logActionNames(event) {
  const detail = event.detail || {};
  return uniqueStrings([
    detail.actionName,
    detail.spellName,
    detail.objectName,
    detail.label,
  ]).filter((name) => name.length > 1);
}

function uniqueStrings(values) {
  return Array.from(new Set(values.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim())));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
