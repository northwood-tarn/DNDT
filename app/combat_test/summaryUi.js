export function createSummaryUi({ controller, dialogEl, bodyEl, resetButtonEl, reset }) {
  function show() {
    if (dialogEl.open) return;
    const rows = controller.summary();
    bodyEl.innerHTML = `
      <div class="summary-grid">
        <div><strong>Actor</strong></div>
        <div><strong>Dealt</strong></div>
        <div><strong>Taken</strong></div>
        <div><strong>Hits</strong></div>
        <div><strong>Saves</strong></div>
        <div><strong>KOs</strong></div>
        ${rows.map((row) => `
          <div>${row.name}</div>
          <div>${row.damageDealt}</div>
          <div>${row.damageTaken}</div>
          <div>${row.hits}/${row.attacks}</div>
          <div>${row.failedSavesForced}/${row.savesForced}</div>
          <div>${row.kills}</div>
        `).join("")}
      </div>
    `;
    dialogEl.showModal();
  }

  resetButtonEl.addEventListener("click", (event) => {
    event.preventDefault();
    reset();
  });

  return { show };
}
