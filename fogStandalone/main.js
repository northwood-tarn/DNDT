// main.js
import * as PIXI from "pixi.js";

let app;

function startGame() {
  // Create the PIXI app
  app = new PIXI.Application({
    width: 800,
    height: 600,
    backgroundColor: 0x000000,
  });

  document.body.appendChild(app.view);

  // NOTE: We intentionally removed createFogRoller().
  // If fog is needed later, it can be added back in via FogRoller.js
}

// Start automatically
startGame();