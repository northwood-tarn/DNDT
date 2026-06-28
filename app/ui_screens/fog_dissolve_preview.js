import { dissipateGreenFog, resetGreenFog } from "../ui/fogDissolve.js";

const screen = document.querySelector(".inventory-screen");
const dissolveButton = document.querySelector("#dissolveButton");
const resetButton = document.querySelector("#resetButton");

dissolveButton.addEventListener("click", async () => {
  dissolveButton.disabled = true;
  resetButton.disabled = true;
  await dissipateGreenFog(screen);
  resetButton.disabled = false;
});

resetButton.addEventListener("click", () => {
  resetGreenFog(screen);
  dissolveButton.disabled = false;
});

if (new URL(window.location.href).searchParams.get("auto") === "1") {
  window.setTimeout(() => dissolveButton.click(), 250);
}
