import aya from "./characters/aya.json" with { type: "json" };
import { ayaBlueprintToActorDefinition, enemySourceToActorDefinition } from "../actors/actorAdapters.js";
import { enemies } from "./enemies.js";

export const actorDefinitions = Object.freeze({
  ...Object.fromEntries(Object.values(enemies).map((enemy) => {
    const definition = enemySourceToActorDefinition(enemy);
    return [definition.id, definition];
  })),
  "character.aya": ayaBlueprintToActorDefinition(aya),
});

export function getActorDefinitionById(id) {
  return actorDefinitions[id] || null;
}
