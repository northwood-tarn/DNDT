# Debug Overlay (F9)

1) Place `ui/DebugOverlay.js` under your app's `ui/` folder.

2) In your `main.js` (or equivalent renderer entry), add:
```js
import { installDebugOverlay } from "./ui/DebugOverlay.js";
import { sceneManager } from "./engine/sceneManager.js"; // or wherever you export it

const debug = installDebugOverlay({
  sceneManager,
  // Optional: provide exact counts and area id if your scene shape is custom:
  // countersProvider: () => ({ actors: state.actors.length, enemies: state.enemies.length }),
  // areaIdProvider: () => state.currentAreaId,
});
```

3) Press **F9** in-game to toggle.
