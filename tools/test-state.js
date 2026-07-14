import { runSaveGameStateTests } from "./state_tests/save_game_state.test.js";
import { runGameplayFoundationTests } from "./state_tests/gameplay_foundations.test.js";
import { runRuntimeSystemTests } from "./state_tests/runtime_systems.test.js";

async function main() {
  await runSaveGameStateTests();
  await runGameplayFoundationTests();
  runRuntimeSystemTests();
  console.log("[state:test] OK");
}

main().catch((error) => {
  console.error("[state:test] FAILED");
  console.error(error);
  process.exitCode = 1;
});
