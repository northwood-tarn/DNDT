const flameFogLayers = [...document.querySelectorAll(".map-flame-fog-layer")];
const areaZones = [...document.querySelectorAll(".map-area-zone")];
const areaInfo = document.querySelector("#mapAreaInfo");
const areaTitle = document.querySelector("#mapAreaTitle");
const areaDescription = document.querySelector("#mapAreaDescription");
let activeAreaId = "";
let textSwapTimer = 0;
let hideTimer = 0;

const AREA_INFO = new Map([
  [
    "greyharbour",
    {
      title: "Greyharbour",
      description: "Harbour, refinery, and the first exhausted border before the city of the dead.",
    },
  ],
  [
    "necropolis",
    {
      title: "Necropolis",
      description: "A walled death-city of civic residue, market pressure, and administrative power.",
    },
  ],
  [
    "endless-plains",
    {
      title: "The Endless Plains",
      description: "Open deadland beyond the walls, stretching toward graves, Carrow, and the portal road.",
    },
  ],
]);

initFlameFog(flameFogLayers);
initAreaHover();

function initAreaHover() {
  for (const zone of areaZones) {
    const areaId = zone.dataset.areaId;
    zone.addEventListener("pointerenter", () => showArea(areaId));
    zone.addEventListener("pointerleave", hideArea);
    zone.addEventListener("focus", () => showArea(areaId));
    zone.addEventListener("blur", hideArea);
  }
}

function showArea(areaId) {
  const area = AREA_INFO.get(areaId);
  if (!area || !areaInfo || !areaTitle || !areaDescription) return;

  window.clearTimeout(hideTimer);
  window.clearTimeout(textSwapTimer);
  areaInfo.hidden = false;

  if (!activeAreaId || activeAreaId === areaId || !areaInfo.classList.contains("is-visible")) {
    setAreaText(area);
    activeAreaId = areaId;
    requestAnimationFrame(() => areaInfo.classList.add("is-visible"));
    return;
  }

  areaInfo.classList.add("is-changing");
  textSwapTimer = window.setTimeout(() => {
    setAreaText(area);
    activeAreaId = areaId;
    requestAnimationFrame(() => areaInfo.classList.remove("is-changing"));
  }, 170);
}

function hideArea() {
  if (!areaInfo) return;
  window.clearTimeout(textSwapTimer);
  areaInfo.classList.remove("is-visible");
  areaInfo.classList.remove("is-changing");
  activeAreaId = "";
  hideTimer = window.setTimeout(() => {
    if (!areaInfo.classList.contains("is-visible")) areaInfo.hidden = true;
  }, 560);
}

function setAreaText(area) {
  areaTitle.textContent = area.title;
  areaDescription.textContent = area.description;
}

function initFlameFog(layers) {
  if (layers.length < 2) return;

  const sources = Array.from(
    { length: 10 },
    (_, index) => `../assets/fog/fog_${String(index + 1).padStart(2, "0")}.png`,
  );
  let sourceIndex = 0;
  let visibleLayer = 0;

  layers[0].setAttribute("href", sources[0]);
  layers[1].setAttribute("href", sources[1]);
  layers[0].classList.add("is-visible");

  setInterval(() => {
    const hiddenLayer = visibleLayer === 0 ? 1 : 0;
    sourceIndex = (sourceIndex + 1) % sources.length;
    const next = layers[hiddenLayer];
    const current = layers[visibleLayer];

    const reveal = () => {
      requestAnimationFrame(() => {
        next.classList.add("is-visible");
        current.classList.remove("is-visible");
        visibleLayer = hiddenLayer;
      });
    };

    next.setAttribute("href", sources[sourceIndex]);
    reveal();
  }, 7000);
}
