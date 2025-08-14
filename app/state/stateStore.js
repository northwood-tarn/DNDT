export const state = {
  player: {
    isStealthed: false,
    x: 5,
    y: 5
  },
  map: {
    id: null,
    width: 0,
    height: 0
  }
,
  explore: {
    tileGrid: null,
    env: 'dim',          // 'daylight' | 'bright' | 'dim' | 'dark' | 'obscured' (future)
    lights: [],          // external static lights (e.g., embers, torches)
    camera: { x: 0, y: 0, w: 21, h: 13 },
    hover: { x: null, y: null },
    minimap: { enabled: true }
  }
};