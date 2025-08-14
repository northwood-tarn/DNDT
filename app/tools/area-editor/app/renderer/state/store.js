
// tools/area-editor/app/renderer/state/store.js
import { validateExplorationMap } from '../validate/rules.js';
import { importFromFile, exportToFile } from '../io/importExport.js';

export function initStore(){
  const state = {
    map: defaultMap(),
    scale: 1,
    selectedTool: 'start', // 'start' | 'label' | 'trigger'
    selectedItem: null,    // reference to selected label/trigger
    issues: [],
    palette: null // loaded from ./palette.json if present
  };

  const listeners = new Set();
  function notify(){ listeners.forEach(fn => fn(state)); }

  function defaultMap(){
    return {
      id: 'untitled',
      title: 'Untitled',
      profile: 'ExplorationMap',
      width: 40,
      height: 18,
      start: { x:1, y:1 },
      minimap: true,
      labels: [],
      triggers: []
    };
  }

  async function loadPalette(){
    try {
      const res = await fetch('./palette.json');
      if (!res.ok) return;
      state.palette = await res.json();
      notify();
    } catch {}
  }

  function setMap(map){
    state.map = map;
    runValidation();
    notify();
  }

  function setScale(s){ state.scale = s; notify(); }

  function zoomToFit(){
    const host = document.getElementById('grid-host');
    const wpx = state.map.width * 24;
    const hpx = state.map.height * 24 + 1; // grid gap insurance
    const pad = 24;
    const sx = (host.clientWidth - pad) / wpx;
    const sy = (host.clientHeight - pad) / hpx;
    const s = Math.max(0.1, Math.min(sx, sy));
    setScale(s);
  }

  function setTool(t){ state.selectedTool = t; notify(); }

  function placeAt(x, y){
    if (state.selectedTool === 'start'){
      state.map.start.x = x; state.map.start.y = y;
    } else if (state.selectedTool === 'label'){
      state.map.labels.push({ x, y, text: '' });
    } else if (state.selectedTool === 'trigger'){
      state.map.triggers.push({ x, y, type: 'room' });
    }
    runValidation(); notify();
  }

  function deleteAt(x, y){
    const key = (o)=>o.x===x && o.y===y;
    state.map.labels = state.map.labels.filter(l => !key(l));
    state.map.triggers = state.map.triggers.filter(t => !key(t));
    runValidation(); notify();
  }

  function updateSelected(field, value){
    if (!state.selectedItem) return;
    state.selectedItem[field] = value;
    runValidation(); notify();
  }

  function selectItem(kind, x, y){
    if (kind==='label'){
      state.selectedItem = state.map.labels.find(l => l.x===x && l.y===y) || null;
    } else if (kind==='trigger'){
      state.selectedItem = state.map.triggers.find(t => t.x===x && t.y===y) || null;
    } else {
      state.selectedItem = null;
    }
    notify();
  }

  function runValidation(){
    state.issues = validateExplorationMap(state.map);
  }

  async function doImport(fileInput){
    const map = await importFromFile(fileInput);
    if (map) setMap(map);
  }

  function doExport(){
    exportToFile(state.map);
  }

  loadPalette();
  runValidation();

  return {
    state,
    subscribe: (fn)=>{ listeners.add(fn); return ()=>listeners.delete(fn); },
    actions: {
      setMap, setScale, setTool, placeAt, deleteAt, selectItem, updateSelected,
      zoomToFit, doImport, doExport
    }
  };
}
