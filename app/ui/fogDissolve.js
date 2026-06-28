const DEFAULT_DURATION_MS = 1100;

let activeRun = null;

export async function dissipateGreenFog(target, options = {}) {
  const screen = resolveTarget(target);
  if (!screen) return false;

  resetGreenFog(screen);
  const durationMs = Number(options.durationMs || DEFAULT_DURATION_MS);
  screen.style.setProperty("--fog-dissolve-duration", `${durationMs}ms`);
  screen.classList.remove("is-fog-dissipated");
  screen.classList.add("is-fog-dissipating");

  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      if (activeRun?.timeout === timeout) activeRun = null;
      finishDissolve(screen);
      resolve(true);
    }, durationMs);
    activeRun = { timeout };
  });
}

export function resetGreenFog(target) {
  const screen = resolveTarget(target);
  if (!screen) return false;
  if (activeRun) {
    window.clearTimeout(activeRun.timeout);
    activeRun = null;
  }
  screen.classList.remove("is-fog-dissipating");
  screen.classList.remove("is-fog-dissipated");
  screen.style.removeProperty("--fog-dissolve-duration");
  return true;
}

export function bindFogDissolveTriggers(root = document) {
  const triggers = root.querySelectorAll("[data-fog-dissolve-trigger]");
  for (const trigger of triggers) {
    trigger.addEventListener("click", () => {
      const selector = trigger.getAttribute("data-fog-dissolve-trigger") || ".inventory-screen";
      dissipateGreenFog(selector);
    });
  }
}

function resolveTarget(target) {
  if (!target) return document.querySelector(".inventory-screen");
  if (typeof target === "string") return document.querySelector(target);
  return target;
}

function finishDissolve(screen) {
  screen.classList.remove("is-fog-dissipating");
  screen.classList.add("is-fog-dissipated");
  screen.style.removeProperty("--fog-dissolve-duration");
  screen.dispatchEvent(new CustomEvent("green-fog:dissipated", { bubbles: true }));
}
