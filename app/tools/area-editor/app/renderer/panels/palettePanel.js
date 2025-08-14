
// tools/area-editor/app/renderer/panels/palettePanel.js
export function mountPalette(store, el){
  el.innerHTML = `<h2>Palette</h2>
    <div class="item-list" id="palette-list"></div>
    <div style="margin-top:8px; display:flex; gap:6px;">
      <button id="tool-start">Start (PC)</button>
      <button id="tool-label">Label</button>
      <button id="tool-trigger">Trigger</button>
    </div>
    <small>Left‑click to place, right‑click to delete. Click glyphs to select for editing.</small>
  `;

  const list = el.querySelector('#palette-list');

  function render(){
    list.innerHTML = '';
    const pal = store.state.palette;
    // Show only glyphs relevant to current schema
    const rows = [
      { name:'Area Boundary', glyph: '#', hint:'(future terrain)' },
      { name:'PC (Start)', glyph: '@' },
      { name:'Label Point', glyph: '·' },
      { name:'Trigger Point', glyph: '•' }
    ];
    for (const r of rows){
      const item = document.createElement('div');
      item.className = 'item';
      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = r.name + (r.hint?` ${r.hint}`:'');
      const glyph = document.createElement('div');
      glyph.className = 'glyph';
      glyph.textContent = r.glyph;
      item.appendChild(name); item.appendChild(glyph);
      list.appendChild(item);
    }
  }

  el.querySelector('#tool-start').onclick = ()=>store.actions.setTool('start');
  el.querySelector('#tool-label').onclick = ()=>store.actions.setTool('label');
  el.querySelector('#tool-trigger').onclick = ()=>store.actions.setTool('trigger');

  store.subscribe(render);
  render();
}
