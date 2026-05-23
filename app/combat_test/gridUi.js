import { combatObjectCells } from "../combat/combatObjects.js";

export function renderCombatGrid({
  gridEl,
  snapshot,
  actor,
  reachable,
  targets,
  shouldPulseTargets,
  selectedTargetId,
  animation,
  getCoverAtSquare,
  getOccupantForDisplay,
  getConditionLabels,
  getActorHoverLines,
  classIconClass,
  onCellClick,
}) {
  gridEl.innerHTML = "";
  gridEl.style.gridTemplateColumns = `repeat(${snapshot.grid.width}, minmax(0, 1fr))`;
  gridEl.style.gridTemplateRows = `repeat(${snapshot.grid.height}, minmax(0, 1fr))`;
  gridEl.style.aspectRatio = `${snapshot.grid.width} / ${snapshot.grid.height}`;
  for (let y = 0; y < snapshot.grid.height; y++) {
    for (let x = 0; x < snapshot.grid.width; x++) {
      gridEl.appendChild(createGridCell({
        snapshot,
        actor,
        reachable,
        targets,
        shouldPulseTargets,
        selectedTargetId,
        animation,
        getCoverAtSquare,
        getOccupantForDisplay,
        getConditionLabels,
        getActorHoverLines,
        classIconClass,
        onCellClick,
        x,
        y,
      }));
    }
  }
}

function createGridCell(options) {
  const {
    snapshot,
    actor,
    reachable,
    targets,
    shouldPulseTargets,
    selectedTargetId,
    animation,
    getCoverAtSquare,
    getOccupantForDisplay,
    getConditionLabels,
    getActorHoverLines,
    classIconClass,
    onCellClick,
    x,
    y,
  } = options;
  const cell = document.createElement("button");
  cell.type = "button";
  cell.className = "cell";
  cell.dataset.x = String(x);
  cell.dataset.y = String(y);
  cell.dataset.cellKey = `${x},${y}`;

  decorateTerrainCell(cell, snapshot, x, y, getCoverAtSquare);
  if (reachable.has(cell.dataset.cellKey)) cell.classList.add("walkable");
  if (targets.has(cell.dataset.cellKey)) {
    cell.classList.add("targetable");
    if (shouldPulseTargets) cell.classList.add("target-pulse");
  }

  const zoneObjects = combatObjectsAtCell(snapshot, x, y);
  decorateZoneCell(cell, zoneObjects);
  decorateOccupantCell(cell, {
    occupant: getOccupantForDisplay(snapshot, { x, y }),
    actor,
    selectedTargetId,
    animation,
    zoneObjects,
    getConditionLabels,
    getActorHoverLines,
    classIconClass,
  });
  cell.addEventListener("click", () => onCellClick({ x, y }));
  return cell;
}

function decorateTerrainCell(cell, snapshot, x, y, getCoverAtSquare) {
  if (snapshot.grid.blocked.has(cell.dataset.cellKey)) {
    cell.classList.add("blocked");
    cell.title = "Blocked";
  }
  const terrainCover = getCoverAtSquare(snapshot, { x, y });
  if (terrainCover.kind === "half") {
    cell.classList.add("cover-half");
    cell.title = "Half cover terrain";
  } else if (terrainCover.kind === "three_quarters") {
    cell.classList.add("cover-three");
    cell.title = "Three-quarters cover terrain";
  }
}

function decorateZoneCell(cell, zoneObjects) {
  if (!zoneObjects.length) return;
  cell.classList.add("zone-glow");
  cell.title = zoneObjects.map((object) => object.name).join(", ");
}

function decorateOccupantCell(cell, options) {
  const { occupant, actor, selectedTargetId, animation, zoneObjects, getConditionLabels, getActorHoverLines, classIconClass } = options;
  if (!occupant) return;
  const hoverLines = getActorHoverLines
    ? getActorHoverLines(occupant, zoneObjects)
    : [`${occupant.name} ${occupant.hp}/${occupant.maxHp}`, ...getConditionLabels(occupant)];
  cell.title = hoverLines.join("\n");
  cell.classList.add(occupant.team === "heroes" ? "hero" : "enemy");
  if (occupant.hp <= 0) cell.classList.add("dead");
  if (occupant.hp > 0 && occupant.id === actor?.id) cell.classList.add("current");
  if (occupant.hp > 0 && occupant.id === selectedTargetId) cell.classList.add("selected-target");
  if (occupant.hp > 0 && occupant.id === animation?.actorId) cell.classList.add("animating");
  if (occupant.hp > 0 && occupant.id === animation?.targetId && animation.kind === "attack") cell.classList.add("attack-flash");
  if (occupant.hp > 0) appendRoleIcon(cell, occupant, classIconClass);
  const hp = document.createElement("small");
  hp.textContent = String(occupant.hp);
  cell.appendChild(hp);
}

function appendRoleIcon(cell, occupant, classIconClass) {
  const roleIcon = document.createElement("span");
  roleIcon.className = `class-icon ${classIconClass(occupant)}`;
  roleIcon.title = occupant.role || occupant.team;
  cell.appendChild(roleIcon);
}

function combatObjectsAtCell(snapshot, x, y) {
  return (snapshot.combatObjects || []).filter((object) =>
    combatObjectCells(snapshot, object).some((cellPos) => cellPos.x === x && cellPos.y === y)
  );
}
