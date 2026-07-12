// Canonical map kind registry.
// Missing: no authored map records have been migrated to this contract yet.

export const MAP_FAMILIES = Object.freeze({
  NAVIGATION: "navigation",
  ENGAGED: "engaged",
});

export const MAP_KINDS = Object.freeze({
  WORLD: "world_map",
  AREA: "area_map",
  LOCATION: "location_map",
  LOCAL_EXPLORATION: "local_exploration_map",
  LARGE_EXPLORATION: "large_exploration_map",
  COMBAT: "combat_map",
});

export const NAVIGATION_MAP_KINDS = Object.freeze([
  MAP_KINDS.WORLD,
  MAP_KINDS.AREA,
  MAP_KINDS.LOCATION,
]);

export const ENGAGED_MAP_KINDS = Object.freeze([
  MAP_KINDS.LOCAL_EXPLORATION,
  MAP_KINDS.LARGE_EXPLORATION,
  MAP_KINDS.COMBAT,
]);

export const MAP_KIND_VALUES = Object.freeze([
  ...NAVIGATION_MAP_KINDS,
  ...ENGAGED_MAP_KINDS,
]);

export const MAP_KIND_DEFINITIONS = Object.freeze({
  [MAP_KINDS.WORLD]: Object.freeze({
    family: MAP_FAMILIES.NAVIGATION,
    label: "World map",
    purpose: "Top-level campaign geography and act-scale area selection.",
    requiredCollections: Object.freeze(["regions"]),
    routeModel: "hover_reveal_select_region",
  }),
  [MAP_KINDS.AREA]: Object.freeze({
    family: MAP_FAMILIES.NAVIGATION,
    label: "Area map",
    purpose: "Area-level geography and location selection inside one act area.",
    requiredCollections: Object.freeze(["regions"]),
    routeModel: "hover_reveal_select_location",
  }),
  [MAP_KINDS.LOCATION]: Object.freeze({
    family: MAP_FAMILIES.NAVIGATION,
    label: "Location map",
    purpose: "Display/navigation map for a named location and its exits into engaged maps.",
    requiredCollections: Object.freeze(["regions"]),
    routeModel: "hover_reveal_select_destination",
  }),
  [MAP_KINDS.LOCAL_EXPLORATION]: Object.freeze({
    family: MAP_FAMILIES.ENGAGED,
    label: "Local exploration map",
    purpose: "Small fixed-node traversal map for rooms, streets, interiors, or compact sites.",
    requiredCollections: Object.freeze(["nodes", "routes", "entryPoints", "exits"]),
    routeModel: "fixed_node_traversal",
  }),
  [MAP_KINDS.LARGE_EXPLORATION]: Object.freeze({
    family: MAP_FAMILIES.ENGAGED,
    label: "Large exploration map",
    purpose: "Large authored image with fixed traversal between major nodes.",
    requiredCollections: Object.freeze(["nodes", "routes", "entryPoints", "exits"]),
    routeModel: "fixed_node_traversal",
  }),
  [MAP_KINDS.COMBAT]: Object.freeze({
    family: MAP_FAMILIES.ENGAGED,
    label: "Combat map",
    purpose: "Tactical encounter map with grid, deployment, cover, hazards, and exits.",
    requiredCollections: Object.freeze(["grid", "nodes", "entryPoints", "exits"]),
    routeModel: "tactical_grid",
  }),
});

export function isMapKind(value) {
  return MAP_KIND_VALUES.includes(value);
}

export function isNavigationMapKind(value) {
  return NAVIGATION_MAP_KINDS.includes(value);
}

export function isEngagedMapKind(value) {
  return ENGAGED_MAP_KINDS.includes(value);
}

export function getMapKindDefinition(kind) {
  return MAP_KIND_DEFINITIONS[kind] || null;
}

export default MAP_KINDS;
