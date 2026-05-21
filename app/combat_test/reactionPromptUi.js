export function createReactionPromptUi({
  controller,
  dialogEl,
  titleEl,
  bodyEl,
  acceptEl,
  declineEl,
  render,
}) {
  function renderPrompt() {
    const prompt = controller.pendingReaction;
    if (!prompt) {
      if (dialogEl.open) dialogEl.close();
      return;
    }
    titleEl.textContent = prompt.name || "Reaction Available";
    bodyEl.textContent = `${prompt.preview} ${prompt.acceptLabel}?`;
    acceptEl.textContent = prompt.acceptLabel || "Use Reaction";
    declineEl.textContent = prompt.declineLabel || "Decline";
    if (!dialogEl.open) dialogEl.showModal();
  }

  function answer(useReaction) {
    const result = controller.answerReaction(useReaction);
    if (dialogEl.open) dialogEl.close();
    render();
    return result;
  }

  acceptEl.addEventListener("click", (event) => {
    event.preventDefault();
    answer(true);
  });
  declineEl.addEventListener("click", (event) => {
    event.preventDefault();
    answer(false);
  });

  return { renderPrompt, answer };
}
