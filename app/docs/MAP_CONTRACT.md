# Map Contract

This file locks the current map standard as an implementation contract. It covers maps only; other game images can exist outside this contract.

Runtime presentation over grand and local exploration maps is governed by `app/docs/EXPLORATION_INTERFACE_CONTRACT.md`. This map contract owns topology, discovery data, navigation, and traversal records; it does not independently define persistent HUD elements, the `Tab` ghost-light, hover cards, or supporting-information panels.

## Code Pieces

- `app/data/mapKinds.js` is the canonical registry of accepted map kinds and their families.
- `app/schemas/mapContract.schema.json` is the JSON Schema for authored map records.
- `tools/validate-maps.js` validates map records against the schema and checks graph references.

## Base Map Shape

Every map record must provide these shared fields:

- `id`: stable unique map identifier.
- `kind`: one of the accepted map kinds.
- `title`: display/debug title.
- `background`: full-screen map image source.
- `sourceSize`: native art dimensions used as the coordinate reference frame.
- `discovery`: default visibility/unlock/visited state for map elements.

These fields may also appear on any map:

- `code`: geography code such as `01`, `01.01`, or later `01.01.N09`.
- `slug`: stable human-readable identifier.
- `description`: author/runtime description.
- `status`: authoring maturity, currently `draft`, `blocked`, `review`, or `locked`.
- `parentMapId`: containing map, when this map is reached from another map.
- `ui`: presentation hints such as `fullscreen_image`, hover text anchor, or flame anchor.
- `missing`: temporary authoring notes for known gaps.

## Navigation Map Shape

Navigation maps are display/navigation surfaces. They show a full-screen image, expose hover/select regions, and move the player down to another map.

Kinds:

- `world_map`: top-level campaign geography. Current areas are `01 Greyharbour`, `02 Xebec` (commonly called the Necropolis), and `03 The Endless Plains`.
- `area_map`: one main area and its locations.
- `location_map`: one location and its exits into more engaged map content.

Required navigation-only field:

- `regions`: hover/click hit areas.

Navigation maps do not have `nodes`, `routes`, `entryPoints`, `exits`, `savePosition`, or `grid`. Their job is choosing where to go, not tracking traversal inside the place.

Each `region` must provide:

- `id`
- `title`
- `destinationMapId`
- `bounds`

Region `bounds` must be either normalized polygon points or an SVG path tied to `sourceSize`. Persistent visible region borders are not part of the default presentation.

## Engaged Map Shape

Engaged maps are interactive traversal or tactical surfaces. They track where the player is, what routes are open, and where the session should resume.

Kinds:

- `local_exploration_map`: small fixed-node traversal map for a compact site.
- `large_exploration_map`: large authored image with fixed traversal between major nodes.
- `combat_map`: tactical encounter map with grid, deployment, cover, hazards, and exits.

Required engaged-only fields:

- `nodes`: traversal or tactical points.
- `entryPoints`: valid arrival points from other maps.
- `exits`: valid departures to other maps.
- `savePosition`: where the game resumes if saved on this map.

Exploration maps also require:

- `routes`: allowed movement between nodes.

Combat maps also require:

- `grid`: tactical grid dimensions and cell size.

Engaged maps do not have `regions`. Their job is tracking player position and available actions inside the place.

## Discovery

`discovery` is required on every map so the runtime and save system have a single starting state.

It can define:

- `defaultState`: the fallback visibility state.
- `visibleIds`: elements visible immediately.
- `hiddenIds`: elements intentionally hidden.
- `lockedIds`: elements visible but unavailable.
- `visitedIds`: elements already treated as visited.
- `completedIds`: elements already treated as complete.

Element states on `regions`, `nodes`, `routes`, and `exits` can still express local defaults, but `discovery` is the shared map-level contract.

### Act-specific area-map reveal rules

- **Act I — Greyharbour:** every area is visible immediately. Old City, Settlement, Docks, and Oil Refinery must all begin in `visibleIds`; visiting or resting does not gate their first appearance.
- **Acts II and III:** areas begin hidden. Entering, crossing, or otherwise visiting an area does not reveal it on the area map. The area moves into canonical revealed/visible state only when the party rests at an ember located inside that area.
- The reveal is permanent save-state discovery. Once a qualifying ember rest reveals an area, subsequent map openings continue to show it.

## Numbering

The numbering convention is part of the data contract:

- Main areas use two digits: `01`, `02`, `03`.
- Locations use area plus location: `01.01`, `01.02`.
- Later interactive elements can append a typed tertiary code: `01.01.N09`.

## Current Missing Work

- Author the actual `app/data/maps/**/*.json` records.
- Extract or redraw final region coordinates from the Photoshop map documents.
- Create location-level line drawing maps once story details are known.
- Decide the final type-letter list for tertiary interactive elements.
- Add content-specific validation once authored interactions, encounters, and scene links exist.
- Keep route readability under visual review as maps are painted and tested.
