// app/systems/perceptionSystem.js
// Passive perception on movement when a hidden thing enters BRIGHT range.
// - Traps: never auto-reveal; only reveal if stepped on (but map fragment can reveal everything).
// - Hidden items/features: roll once when in bright; on fail log a hint and allow spending a map fragment.
// Utilities are pure; caller (ExplorationScene) owns logging, state, and consumption of fragments.

export function calcPassivePerception(actor){
  // Basic: 10 + Perception skill bonus if present
  const bonus = (actor?.skills && typeof actor.skills.Perception === 'number') ? actor.skills.Perception : 0;
  return 10 + bonus;
}

// Decide which hidden entries are within BRIGHT radius of (px,py)
export function hiddenInBrightRange(hiddenList, px, py, brightTiles){
  if (!Array.isArray(hiddenList) || brightTiles <= 0) return [];
  const out = [];
  for (const h of hiddenList){
    if (h?.revealed) continue;
    const dx = Math.abs((h.x|0) - px);
    const dy = Math.abs((h.y|0) - py);
    const dist = Math.max(dx, dy);
    if (dist <= brightTiles) out.push(h);
  }
  return out;
}

// Run passive check versus each candidate; return { revealed, hinted }
export function runPassiveChecks({ actor, candidates, d20 = () => Math.floor(Math.random()*20)+1, log = ()=>{} }){
  const revealed = [];
  const hinted = [];
  const passive = calcPassivePerception(actor);
  for (const h of (candidates||[])){
    if (h.type === 'trap'){
      // Traps never auto-reveal via passive-on-bright
      continue;
    }
    // Compare passive vs DC
    const success = passive >= (h.dc ?? 10);
    log(`Passive Perception vs DC ${h.dc ?? 10} → ${passive} ${success ? "≥" : "<"} DC`);
    if (success){
      revealed.push(h);
    } else {
      hinted.push(h);
    }
  }
  return { revealed, hinted, passive };
}

// Reveal everything currently on-screen (within given bounds) regardless of light — used when spending a map fragment.
// Set h.revealed = true and return list of revealed entries.
export function revealAllOnScreen(hiddenList, bounds){
  const out = [];
  for (const h of (hiddenList||[])){
    if (h.revealed) continue;
    if (h.x >= bounds.minX && h.x <= bounds.maxX && h.y >= bounds.minY && h.y <= bounds.maxY){
      h.revealed = true;
      out.push(h);
    }
  }
  return out;
}
