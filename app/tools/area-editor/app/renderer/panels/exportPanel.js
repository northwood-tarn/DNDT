
// tools/area-editor/app/renderer/panels/exportPanel.js
export function mountExport(store, el, fileInput){
  el.innerHTML = `
    <h2>Import / Export</h2>
    <div style="display:flex; gap:6px; flex-wrap:wrap;">
      <button id="btn-open">Import JSON…</button>
      <button id="btn-export">Export JSON</button>
      <button id="btn-fit">Zoom to Fit</button>
    </div>
    <div style="margin-top:6px; font-size:12px; opacity:.75;">
      Schema: ExplorationMap (id, profile, width, height, start, minimap, labels[], triggers[]).
    </div>
  `;

  el.querySelector('#btn-open').onclick = async ()=>{
    await store.actions.doImport(fileInput);
  };
  el.querySelector('#btn-export').onclick = ()=>{
    store.actions.doExport();
  };
  el.querySelector('#btn-fit').onclick = ()=>{
    store.actions.zoomToFit();
  };
}
