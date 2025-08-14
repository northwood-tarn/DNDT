
// tools/area-editor/app/renderer/io/importExport.js

export async function importFromFile(fileInput){
  return new Promise((resolve) => {
    fileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return resolve(null);
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        resolve(normalize(json));
      } catch (err) {
        alert('Import failed: ' + (err?.message || err));
        resolve(null);
      } finally {
        fileInput.value = '';
      }
    };
    fileInput.click();
  });
}

export function exportToFile(map){
  const file = new Blob([JSON.stringify(serialize(map), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = `${map.id || 'area'}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// --- Schema adapters (shore1.json shape) ---
const PROFILE = 'ExplorationMap';
const REQUIRED_KEYS = ['id','profile','width','height','start'];

export function validateShape(json){
  const issues = [];
  for (const k of REQUIRED_KEYS) if (!(k in json)) issues.push(`Missing key: ${k}`);
  if (json.profile !== PROFILE) issues.push(`profile must be "${PROFILE}"`);
  if (!Number.isInteger(json.width|0) || json.width<=0) issues.push('width must be a positive integer.');
  if (!Number.isInteger(json.height|0) || json.height<=0) issues.push('height must be a positive integer.');
  const sx = Number(json?.start?.x), sy = Number(json?.start?.y);
  if (!Number.isInteger(sx) || !Number.isInteger(sy)) issues.push('start.x/start.y must be integers.');
  return issues;
}

export function normalize(json){
  // Coerce minimal fields and preserve arrays
  return {
    id: String(json.id || 'untitled'),
    title: json.title ? String(json.title) : 'Untitled',
    profile: PROFILE,
    width: Number(json.width || 40),
    height: Number(json.height || 18),
    start: { x: Number(json?.start?.x||1), y: Number(json?.start?.y||1) },
    minimap: Boolean(json.minimap ?? true),
    labels: Array.isArray(json.labels) ? json.labels.map(l=>({ x: l.x|0, y: l.y|0, text: String(l.text||'') })) : [],
    triggers: Array.isArray(json.triggers) ? json.triggers.map(t=>({ x: t.x|0, y: t.y|0, type: String(t.type||'room'), ...t })) : []
  };
}

export function serialize(map){
  // Exact keys you already use in shore1.json
  return {
    id: map.id,
    title: map.title,
    profile: PROFILE,
    width: map.width|0,
    height: map.height|0,
    start: { x: map.start.x|0, y: map.start.y|0 },
    minimap: !!map.minimap,
    labels: map.labels.map(l=>({ x:l.x|0, y:l.y|0, text:String(l.text||'') })),
    triggers: map.triggers.map(t=>{
      const { x, y, type, areaId, entry, treeId } = t;
      const base = { x:x|0, y:y|0, type: String(type||'room') };
      if (areaId) base.areaId = String(areaId);
      if (entry) base.entry = String(entry);
      if (treeId) base.treeId = String(treeId);
      return base;
    })
  };
}
