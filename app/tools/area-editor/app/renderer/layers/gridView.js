
// tools/area-editor/app/renderer/layers/gridView.js

export function mountGrid(store, host, statusEl){
  const wrap = document.createElement('div');
  wrap.className = 'grid-wrap';
  host.appendChild(wrap);

  function render(){
    const { map, scale } = store.state;
    wrap.style.transform = `scale(${scale})`;

    // Build base grid once per render
    const grid = document.createElement('div');
    grid.className = 'grid layer-tiles';
    grid.style.gridTemplateColumns = `repeat(${map.width}, 24px)`;
    grid.style.gridTemplateRows = `repeat(${map.height}, 24px)`;

    // Cells (empty — tiles not in schema yet)
    const total = map.width * map.height;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < total; i++){
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.index = i;
      const x = i % map.width;
      const y = (i / map.width) | 0;
      cell.dataset.x = x; cell.dataset.y = y;
      cell.onclick = () => {
        if (store.state.selectedTool) store.actions.placeAt(x,y);
      };
      cell.oncontextmenu = (e)=>{ e.preventDefault(); store.actions.deleteAt(x,y); };
      const g = document.createElement('span');
      g.className = 'g';
      g.textContent = ' ';
      cell.appendChild(g);
      frag.appendChild(cell);
    }
    grid.appendChild(frag);

    // Overlay: start
    const startLayer = document.createElement('div');
    startLayer.className = 'layer-start';
    startLayer.style.width = `${map.width*24}px`;
    startLayer.style.height = `${map.height*24}px`;
    addGlyph(startLayer, map.start.x, map.start.y, '@');

    // Overlay: labels (·)
    const labelsLayer = document.createElement('div');
    labelsLayer.className = 'layer-labels';
    labelsLayer.style.width = `${map.width*24}px`;
    labelsLayer.style.height = `${map.height*24}px`;
    for (const l of (map.labels||[])){
      addGlyph(labelsLayer, l.x, l.y, '·', ()=>store.actions.selectItem('label', l.x, l.y));
    }

    // Overlay: triggers (•)
    const triggersLayer = document.createElement('div');
    triggersLayer.className = 'layer-triggers';
    triggersLayer.style.width = `${map.width*24}px`;
    triggersLayer.style.height = `${map.height*24}px`;
    for (const t of (map.triggers||[])){
      addGlyph(triggersLayer, t.x, t.y, '•', ()=>store.actions.selectItem('trigger', t.x, t.y));
    }

    wrap.innerHTML = '';
    wrap.appendChild(grid);
    wrap.appendChild(startLayer);
    wrap.appendChild(labelsLayer);
    wrap.appendChild(triggersLayer);

    // Status
    statusEl.textContent = `${map.id} — ${map.width}×${map.height} — Start(${map.start.x},${map.start.y}) — Labels:${map.labels.length} Triggers:${map.triggers.length}`;
  }

  function addGlyph(layer, x, y, ch, onClick){
    const el = document.createElement('div');
    el.style.position = 'absolute';
    el.style.left = `${x*24}px`;
    el.style.top = `${y*24}px`;
    el.style.width = '24px';
    el.style.height = '24px';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.pointerEvents = 'auto';
    el.style.cursor = 'pointer';
    el.textContent = ch;
    el.onclick = (e)=>{ e.stopPropagation(); if (onClick) onClick(); };
    layer.appendChild(el);
  }

  store.subscribe(render);
  render();
  // initial zoom-to-fit
  setTimeout(()=>store.actions.zoomToFit(), 0);
}
