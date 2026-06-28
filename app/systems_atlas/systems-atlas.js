const systemDetails = {
  entry: {
    title: "Entry & Presentation",
    percent: "70%",
    description: "Boot, preload, project splash, intro music, Lanterna ignition, and the main menu shell.",
    tasks: [
      ["Boot scene handoff", "Partial", "Startup reaches the main presentation path."],
      ["Project splash image", "Mostly done", "Uses mainscreen.png as the primary first impression."],
      ["Intro music", "Mostly done", "intro_theme.mp3 plays at launch and gates the ignition moment."],
      ["Lanterna flame ignition", "Mostly done", "The flame lights after the splash image and music are ready."],
      ["Main menu actions", "Partial", "Needs complete New, Load, Settings, Credits, and Quit behavior."],
      ["Credits polish", "Not started", "Needs final credit screen content and return flow."],
      ["Accessibility pass", "Not started", "Needs keyboard focus, reduced motion, and audio fallback checks."],
    ],
    connections: ["Flow & Saves", "Assets & Audio", "Story Spine", "Player UI & Overlays"],
  },
  flow: {
    title: "Flow & Saves",
    percent: "30%",
    description: "The router and persistence layer that keep the whole game moving from screen to screen.",
    tasks: [
      ["Scene route ownership", "Partial", "Flow docs define the target architecture; implementation is uneven."],
      ["New game route", "Partial", "Main menu can point toward character selection and intro paths."],
      ["Load game route", "Partial", "Load and save-error scenes exist, but persistence needs hardening."],
      ["Profile / slot selection", "Not started", "Needed before save files feel intentional."],
      ["Checkpoint and autosave policy", "Not started", "Define what saves at rests, transitions, and combat outcomes."],
      ["Area transition payloads", "Partial", "Exit routing exists but needs consistent scene state payloads."],
      ["Game over recovery", "Partial", "GameOverScene exists; reload-last-save path needs final behavior."],
    ],
    connections: ["Entry & Presentation", "Exploration & Areas", "Combat Staging", "Story Spine"],
  },
  story: {
    title: "Story Spine",
    percent: "20%",
    description: "The complete campaign path from opening premise through final outcome and credits.",
    tasks: [
      ["Opening premise", "Partial", "IntroScene exists; campaign onboarding still needs substance."],
      ["Act structure", "Partial", "Lore docs outline acts and escape campaign beats."],
      ["Anchor conversations", "Partial", "Five multi-step anchor conversations are drafted."],
      ["Chapter splash screens", "Not started", "Needed for major act transitions."],
      ["Quest milestone tracking", "Partial", "Docs exist; runtime journal/progression integration is early."],
      ["Final boss setup", "Not started", "Scene flow names the target but gameplay is not built."],
      ["Ending and credits", "Not started", "Needs ending state, summary cards, and credits sequence."],
    ],
    connections: ["Dialogue & Consequence", "Flow & Saves", "Entry & Presentation", "Player UI & Overlays"],
  },
  character: {
    title: "Characters & Growth",
    percent: "62%",
    description: "Character creation, resolved sheets, leveling, and player-facing growth decisions.",
    tasks: [
      ["Creation pipeline", "Strong", "Species, class, background, abilities, feats, and spells are represented."],
      ["Creator UI", "Partial", "Harness and step creator exist; production flow needs tightening."],
      ["Resolved character sheet", "Strong", "Sheet resolver and previews are built and tested."],
      ["Combat actor adapter", "Strong", "Character sheets feed combat actor contracts."],
      ["Level-up manifest", "Partial", "Manifest and tests exist; full UI integration remains."],
      ["High-level feature readiness", "Partial", "Reports exist for gaps in class and feature implementation."],
      ["Narrative access gates", "Partial", "Character data can support dialogue and story gates."],
    ],
    connections: ["Combat Rules", "Rules Content", "Dialogue & Consequence", "Player UI & Overlays"],
  },
  exploration: {
    title: "Exploration & Areas",
    percent: "42%",
    description: "The walking-around loop: areas, movement, light, perception, interactables, and transitions.",
    tasks: [
      ["Area data structure", "Partial", "Area folders and registry patterns exist."],
      ["Map loading", "Partial", "Map systems and builders exist; runtime polish remains."],
      ["Movement and collision", "Partial", "Collision, visibility, and exploration systems exist."],
      ["Lanterna / lighting rules", "Partial", "Lighting and perception systems are present."],
      ["Object interactions", "Early", "Interaction docs exist; runtime coverage is limited."],
      ["Area authoring tools", "Partial", "Area author tool and map sketcher exist."],
      ["Exploration-to-combat triggers", "Partial", "Needs consistent encounter launch contracts."],
    ],
    connections: ["Flow & Saves", "Dialogue & Consequence", "Combat Staging", "Assets & Audio"],
  },
  dialogue: {
    title: "Dialogue & Consequence",
    percent: "28%",
    description: "Conversation types, checks, disposition, lore inspection, and branching outcomes.",
    tasks: [
      ["Dialogue scene shell", "Partial", "DialogueScene and dialogueEngine exist."],
      ["Anchor conversation content", "Partial", "Key conversations are drafted in lore docs."],
      ["NPC branching", "Early", "Needs content format and runtime consequence hooks."],
      ["Object / lore inspect conversations", "Early", "Docs point the direction; integration is light."],
      ["Skill and class gates", "Partial", "Character and skill data can support this, but UI needs work."],
      ["Disposition outcomes", "Early", "Drafted for anchors; needs generic runtime model."],
      ["Combat escalation", "Partial", "Scene flow supports escalation; implementation needs contracts."],
    ],
    connections: ["Story Spine", "Characters & Growth", "Exploration & Areas", "Combat Rules"],
  },
  combat: {
    title: "Combat Rules",
    percent: "66%",
    description: "The deterministic rules layer for tactical encounters.",
    tasks: [
      ["Combat actor contract", "Strong", "Actor bridge and contract reports exist."],
      ["Action factory and schema", "Strong", "Actions, tags, mappers, and contracts are covered."],
      ["Attack, damage, and saves", "Strong", "Core resolution modules and tests exist."],
      ["Spells, slots, and scaling", "Partial", "Many spell mechanics exist; audit gaps remain."],
      ["Conditions and effects", "Strong", "Lifecycle, riders, auras, and triggers are represented."],
      ["Reactions and prompts", "Partial", "Policy and tests exist; presentation still needs work."],
      ["Enemy AI", "Partial", "AI profiles and compiler exist; encounter behavior needs tuning."],
    ],
    connections: ["Characters & Growth", "Rules Content", "Combat Staging", "Dialogue & Consequence"],
  },
  staging: {
    title: "Combat Staging",
    percent: "45%",
    description: "The bridge between combat rules and the playable, readable encounter screen.",
    tasks: [
      ["Combat harness UI", "Partial", "Grid, targeting, lifecycle, log, and summary UI exist."],
      ["Isometric grid", "Partial", "Grid and tests exist; production integration remains."],
      ["Stage metadata", "Partial", "Stage metadata and generated scenarios exist."],
      ["Encounter launch", "Partial", "Combat initiator exists; routing contracts need hardening."],
      ["Visibility and readability", "Partial", "Visual spike work explores fog, auras, and spell readability."],
      ["Victory / reward screen", "Early", "Post-combat outcome flow needs a real screen."],
      ["Defeat handling", "Partial", "Defeat modal and GameOverScene exist."],
    ],
    connections: ["Combat Rules", "Exploration & Areas", "Assets & Audio", "Flow & Saves"],
  },
  ui: {
    title: "Player UI & Overlays",
    percent: "32%",
    description: "The player-facing overlays and screens used repeatedly across the game.",
    tasks: [
      ["Inventory screen", "Spike", "Small inventory screen and inventory UI modules exist."],
      ["Rest / prepare screen", "Spike", "Rest UI and small rest screen exist."],
      ["Level-up screens", "Partial", "Generic and class-specific screen spikes exist."],
      ["HUD / top bar", "Partial", "Top bar and Lanterna visual language exist."],
      ["Journal / quest log", "Early", "Required by flow docs; runtime UI is not mature."],
      ["Map / fast travel overlay", "Early", "Flow docs define it; implementation is still needed."],
      ["Merchant and loot screens", "Early", "UI modules exist but need production integration."],
    ],
    connections: ["Characters & Growth", "Exploration & Areas", "Flow & Saves", "Assets & Audio"],
  },
  content: {
    title: "Rules Content",
    percent: "64%",
    description: "The structured rules and data that make characters, enemies, items, and actions possible.",
    tasks: [
      ["Classes and subclasses", "Partial", "Core class files exist with feature reports."],
      ["Species and backgrounds", "Partial", "Data and validators exist."],
      ["Spells", "Strong", "Levels 0-7 are represented with audit tooling."],
      ["Weapons, armor, tools", "Partial", "Data and validators exist."],
      ["Feats", "Partial", "Origin, general, and fighting style feats are represented."],
      ["Enemies and templates", "Partial", "Enemy data, templates, and factories exist."],
      ["Encounters and rewards", "Partial", "Encounter data exists; reward integration needs work."],
    ],
    connections: ["Characters & Growth", "Combat Rules", "Tooling & Tests", "Exploration & Areas"],
  },
  assets: {
    title: "Assets & Audio",
    percent: "48%",
    description: "The visual and sound assets that establish identity and support play readability.",
    tasks: [
      ["Project splash assets", "Mostly done", "mainscreen.png, source PSDs, intro theme, and lighter sound exist."],
      ["Lanterna flame assets", "Mostly done", "Flame masks and black flame variant are used across screens."],
      ["Fog assets", "Partial", "Still and video fog assets exist."],
      ["Combat stage art", "Partial", "Several generated and validated stage assets exist."],
      ["Style reference sheets", "Partial", "Act reference sheets and visual style docs exist."],
      ["Runtime audio set", "Early", "Only key intro/ignition sounds are obvious."],
      ["Asset loader discipline", "Partial", "Asset helper exists but usage is uneven."],
    ],
    connections: ["Entry & Presentation", "Exploration & Areas", "Combat Staging", "Player UI & Overlays"],
  },
  tooling: {
    title: "Tooling & Tests",
    percent: "68%",
    description: "The scripts, harnesses, validators, and reports that make the large system checkable.",
    tasks: [
      ["Combat tests", "Strong", "Broad combat test suite covers actions, AI, effects, scenarios, and systems."],
      ["Character tests", "Strong", "Creation, repository, level-up, spellcasting, and variants are covered."],
      ["Data validators", "Strong", "Validators exist for classes, spells, enemies, equipment, species, and more."],
      ["Readiness reports", "Partial", "Class feature, combat actor, and high-level reports exist."],
      ["Map generation tools", "Partial", "Grid, terrain, art validation, and package tools exist."],
      ["Authoring harnesses", "Partial", "Combat, creator, area author, sketcher, and visual spike tools exist."],
      ["CI / release automation", "Unknown", "Local tooling is strong; automated pipeline is not visible here."],
    ],
    connections: ["Rules Content", "Combat Rules", "Characters & Growth", "Assets & Audio"],
  },
};

const modal = document.querySelector("#system-modal");
const modalPanel = document.querySelector(".system-modal");
const modalTitle = document.querySelector("#modal-title");
const modalPercent = document.querySelector("#modal-percent");
const modalDescription = document.querySelector("#modal-description");
const modalTasks = document.querySelector("#modal-tasks");
const modalConnections = document.querySelector("#modal-connections");
const closeButton = document.querySelector("#modal-close");

let lastFocusedCard = null;

function taskMarkup([name, status, note]) {
  return `
    <li>
      <div>
        <span>${name}</span>
        <p>${note}</p>
      </div>
      <strong>${status}</strong>
    </li>
  `;
}

function openModal(systemId, trigger) {
  const detail = systemDetails[systemId];
  if (!detail || !modal) return;

  lastFocusedCard = trigger;
  modalTitle.textContent = detail.title;
  modalPercent.textContent = detail.percent;
  modalDescription.textContent = detail.description;
  modalTasks.innerHTML = detail.tasks.map(taskMarkup).join("");
  modalConnections.innerHTML = detail.connections.map((connection) => `<span>${connection}</span>`).join("");
  modal.hidden = false;
  document.body.classList.add("is-modal-open");
  modalPanel?.focus();
}

function closeModal() {
  if (!modal || modal.hidden) return;
  modal.hidden = true;
  document.body.classList.remove("is-modal-open");
  lastFocusedCard?.focus();
}

document.querySelectorAll("[data-system]").forEach((card) => {
  card.addEventListener("click", () => openModal(card.dataset.system, card));
  card.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openModal(card.dataset.system, card);
  });
});

closeButton?.addEventListener("click", closeModal);

modal?.addEventListener("click", (event) => {
  if (event.target === modal) closeModal();
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeModal();
});

const initialSystem = window.location.hash.replace("#", "");
if (initialSystem && systemDetails[initialSystem]) {
  openModal(initialSystem, document.querySelector(`[data-system="${initialSystem}"]`));
}
