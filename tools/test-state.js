import { runSaveGameStateTests } from "./state_tests/save_game_state.test.js";

async function main() {
  await runSaveGameStateTests();
  console.log("[state:test] OK");
}

main().catch((error) => {
  console.error("[state:test] FAILED");
  console.error(error);
  process.exitCode = 1;
});
