# Greyharbour Dock Exploration Package Notes

## Summary

Draft exploration stage for a damp underground Greyharbour dock: a broad stone quay, timber piers, black harbour water, a warehouse threshold, a locked skiff route, and side inspection points. The clean plate is `greyharbour_dock.art.png`; runtime darkness and Lanterna reveal are applied separately.

## Question Gate Answers / Proposals

- Interactive objects: drain grate, locked skiff, stacked dock crates, warehouse door.
- Inspectable objects: central drain grate, east crates, skiff chain/mooring.
- Usable/openable/takable/movable/broken/lit/read/searched/talked-to: warehouse door can be opened if access is granted; skiff can be used if unlocked; crates can be searched once; drain grate can be inspected repeatedly. No lit/extinguish interactions are proposed because there are no fixed light sources in the clean plate.
- Optional interactions: drain grate inspection, crate search, skiff route discovery.
- Required for progression: warehouse door transition is proposed as story-gated; lower quay entry is always available.
- Conversation triggers: central quay party observation zone.
- Discovery triggers: left skiff mooring route discovery.
- Inspection triggers: drain grate and east crates.
- Area transitions: lower quay entry, warehouse door, east timber pier, left skiff mooring.
- Destination area ids: `greyharbour_cavern_approach`, `greyharbour_warehouse`, `greyharbour_east_pier`, `greyharbour_outer_mooring`.
- Destination cells / entry zones: proposed in `greyharbour_dock.area.json`; verify once destination maps exist.
- Transition availability: lower entry always available; warehouse locked/story-gated; east pier conditional; skiff locked until key/unlock flag.
- Player start: lower quay entry at `{ "x": 9, "y": 11 }`.
- Companion starts: `{ "x": 10, "y": 11 }`, `{ "x": 8, "y": 11 }`.
- NPC/neutral starts: none proposed.
- Cutscene/story trigger: first-entry dock reveal narration at lower quay entry.
- Trigger results: defined in `greyharbour_dock.area.json`.

## QA Notes

- The draft grid origin is a proposal: `{ "x": 832, "y": 96 }`. It should be validated with a visible absolute 128 x 64 overlay before production.
- The image’s stone paving contains many small decorative tile lines; these are not gameplay grid cells.
- Some props overlap route edges. The metadata treats several clutter cells as difficult rather than blocked; verify with the actual runtime character sprite.
- The warehouse threshold is readable, but the lock and destination are narrative proposals.
- No fixed light sources are declared. Runtime darkness should use Lanterna reveal and optional future fixed-light metadata only if the art is revised to show source objects.
- Preview files still need to be rendered: `greyharbour_dock.grid_preview.png`, `greyharbour_dock.traversal_preview.png`, and `greyharbour_dock.trigger_preview.png`.
