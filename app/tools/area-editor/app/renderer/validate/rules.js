
// tools/area-editor/app/renderer/validate/rules.js
import { validateShape } from '../io/importExport.js';

export function validateExplorationMap(map){
  const issues = [];

  // Shape-level
  issues.push(...validateShape(map));

  // Start in-bounds
  if (map.start){
    if (map.start.x < 0 || map.start.y < 0 || map.start.x >= map.width || map.start.y >= map.height){
      issues.push(`Start (${map.start.x},${map.start.y}) is out of bounds.`);
    }
  }

  // Recommended: at least one exit OR one trigger
  if (!Array.isArray(map.triggers) || map.triggers.length === 0){
    issues.push('No triggers defined (recommend at least one).');
  }

  // Labels/Triggers in bounds
  for (const l of (map.labels||[])){
    if (l.x < 0 || l.y < 0 || l.x >= map.width || l.y >= map.height){
      issues.push(`Label out of bounds at (${l.x},${l.y}).`);
    }
  }
  for (const t of (map.triggers||[])){
    if (t.x < 0 || t.y < 0 || t.x >= map.width || t.y >= map.height){
      issues.push(`Trigger out of bounds at (${t.x},${t.y}).`);
    }
  }

  // Duplicate triggers on same tile
  const keys = new Set();
  for (const t of (map.triggers||[])){
    const k = `${t.x},${t.y}`;
    if (keys.has(k)) issues.push(`Duplicate trigger at (${t.x},${t.y}).`);
    keys.add(k);
  }

  return issues;
}
