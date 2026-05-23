import { createCombatActorBridgeReport, resolvedSheetToCombatActor } from "../character/index.js";

export function renderPipelineExport({ buttons, output, exportView, draft, sheet }) {
  const payloads = {
    draft,
    sheet,
    actor: createCombatActorExport(sheet),
    bridge: createCombatActorBridgeReport(sheet, {
      actorOptions: { id: "creator_preview_actor", position: { x: 0, y: 0 } },
    }),
  };
  for (const button of buttons) {
    button.classList.toggle("is-active", button.dataset.exportView === exportView);
  }
  output.textContent = JSON.stringify(payloads[exportView] || payloads.draft, null, 2);
}

function createCombatActorExport(sheet) {
  try {
    return resolvedSheetToCombatActor(sheet, {
      id: "creator_preview_actor",
      position: { x: 0, y: 0 },
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
