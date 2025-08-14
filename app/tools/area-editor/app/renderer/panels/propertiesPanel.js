
// tools/area-editor/app/renderer/panels/propertiesPanel.js
export function mountProperties(store, el){
  function render(){
    const sel = store.state.selectedItem;
    el.innerHTML = `<h2>Properties</h2>`;
    const box = document.createElement('div');
    box.className = 'props';

    if (!sel){
      box.innerHTML = `<div style="opacity:.7">Select a Label or Trigger to edit.</div>`;
    } else {
      const isLabel = 'text' in sel;
      if (isLabel){
        box.innerHTML = `
          <table>
            <tr><td>X</td><td><input id="p-x" type="number" value="${sel.x}"></td></tr>
            <tr><td>Y</td><td><input id="p-y" type="number" value="${sel.y}"></td></tr>
            <tr><td>Text</td><td><input id="p-text" type="text" value="${sel.text||''}"></td></tr>
          </table>`;
      } else {
        box.innerHTML = `
          <table>
            <tr><td>X</td><td><input id="p-x" type="number" value="${sel.x}"></td></tr>
            <tr><td>Y</td><td><input id="p-y" type="number" value="${sel.y}"></td></tr>
            <tr><td>Type</td><td>
              <select id="p-type">
                <option value="room">room</option>
                <option value="dialogue">dialogue</option>
                <option value="enter_area">enter_area</option>
              </select>
            </td></tr>
            <tr><td>areaId</td><td><input id="p-areaId" type="text" value="${sel.areaId||''}"></td></tr>
            <tr><td>entry</td><td><input id="p-entry" type="text" value="${sel.entry||''}"></td></tr>
            <tr><td>treeId</td><td><input id="p-treeId" type="text" value="${sel.treeId||''}"></td></tr>
          </table>`;
      }
    }

    el.appendChild(box);

    // Wire events
    if (sel){
      const isLabel = 'text' in sel;
      el.querySelector('#p-x').onchange = e => store.actions.updateSelected('x', parseInt(e.target.value,10)|0);
      el.querySelector('#p-y').onchange = e => store.actions.updateSelected('y', parseInt(e.target.value,10)|0);
      if (isLabel){
        el.querySelector('#p-text').onchange = e => store.actions.updateSelected('text', String(e.target.value||''));
      } else {
        const tSel = el.querySelector('#p-type');
        tSel.value = sel.type || 'room';
        tSel.onchange = e => store.actions.updateSelected('type', e.target.value);
        el.querySelector('#p-areaId').onchange = e => store.actions.updateSelected('areaId', e.target.value || undefined);
        el.querySelector('#p-entry').onchange = e => store.actions.updateSelected('entry', e.target.value || undefined);
        el.querySelector('#p-treeId').onchange = e => store.actions.updateSelected('treeId', e.target.value || undefined);
      }
    }
  }

  store.subscribe(render);
  render();
}
