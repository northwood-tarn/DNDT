document.getElementById("close")?.addEventListener("click", () => window.api?.quit?.());

for (const button of document.querySelectorAll("[data-tool]")) {
  button.addEventListener("click", () => {
    window.api?.launchAuthoringTool?.(button.dataset.tool);
  });
}
