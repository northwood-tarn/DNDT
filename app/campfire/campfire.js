const steps = [
  "Pick one rough edge and make it boringly reliable.",
  "Write down the one rule the next feature must obey.",
  "Make the smallest playable slice easier to reach.",
  "Delete or park one idea that is making the room noisy.",
  "Name the next unknown, then leave the rest unnamed for now.",
  "Open a test, make it pass, and let that count.",
];

const dieButton = document.querySelector("#die-button");
const dieFace = document.querySelector("#die-face");
const nextStepText = document.querySelector("#next-step-text");

let index = 0;

dieButton?.addEventListener("click", () => {
  index = (index + 1) % steps.length;
  dieFace.textContent = String([8, 12, 4, 20, 6, 10][index]);
  nextStepText.animate(
    [
      { opacity: 0, transform: "translateY(0.3rem)" },
      { opacity: 1, transform: "translateY(0)" },
    ],
    { duration: 220, easing: "ease-out" },
  );
  nextStepText.textContent = steps[index];
});
