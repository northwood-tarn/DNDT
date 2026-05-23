export function populateScenarioSelect(selectEl, scenarios, currentScenarioId) {
  selectEl.innerHTML = "";
  const groups = new Map();
  for (const scenario of scenarios) {
    const option = document.createElement("option");
    option.value = scenario.id;
    option.textContent = scenario.name;
    const groupLabel = scenario.group || "Scenarios";
    if (!groups.has(groupLabel)) {
      const group = document.createElement("optgroup");
      group.label = groupLabel;
      groups.set(groupLabel, group);
      selectEl.appendChild(group);
    }
    groups.get(groupLabel).appendChild(option);
  }
  selectEl.value = currentScenarioId;
}
