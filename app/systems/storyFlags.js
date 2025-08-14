// systems/storyFlags.js
// Tiny, in-memory story flags. Swap to persistent later if needed.
const flags = new Set();

export function setFlag(key) { flags.add(String(key)); }
export function hasFlag(key) { return flags.has(String(key)); }
export function clearFlag(key) { flags.delete(String(key)); }
export function listFlags() { return Array.from(flags); }
