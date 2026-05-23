import { titleCase } from "./creatorHarnessOptions.js";

export function renderRequirementsList(report) {
  if (report.requirements.length === 0) return [requirementItem("No outstanding requirements.", "")];
  return report.requirements.map((item) => requirementItem(
    item.label,
    `${titleCase(item.stepId)} · ${titleCase(item.kind)}`
  ));
}

function requirementItem(label, meta) {
  const item = document.createElement("li");
  item.innerHTML = `${label}<span class="requirement-meta">${meta}</span>`;
  return item;
}
