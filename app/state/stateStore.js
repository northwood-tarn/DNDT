// Centralised, singleton game state store.
// Most code should access this via getState(), but we also export `state`
// for backwards compatibility with older modules that import { state }.

const state = {
  player: {
    isStealthed: false,
    x: 5,
    y: 5
  },
  map: {
    id: null,
    width: 0,
    height: 0
  },
  combat: null,
  explore: {
    tileGrid: null,
    env: "dim",          // 'daylight' | 'bright' | 'dim' | 'dark' | 'obscured' (future)
    lights: [],          // external static lights (e.g., embers, torches)
    camera: { x: 0, y: 0, w: 21, h: 13 },
    hover: { x: null, y: null },
    minimap: { enabled: true }
  }
};

export function getState() {
  return state;
}

// Legacy export: modules that still import { state } will receive
// the same singleton object returned by getState().
export { state };