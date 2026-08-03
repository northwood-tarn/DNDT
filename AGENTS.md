Do not add anything that the user has not asked for.
When the user selects or locks an image, preserve that exact source image. Do not crop, regenerate, reinterpret, replace, or "improve" it unless the user explicitly asks for that specific change.

The Xebec area map is locked. Its canonical source, runtime copy, and checksum are recorded in `app/docs/layout_sketches/act_maps_v1/XEBEC_AREA_MAP_LOCK.md`. Do not alter or replace either PNG unless the user explicitly unlocks the Xebec area map.

The Endless Plains area map is locked. Its canonical source, runtime copy, and checksum are recorded in `app/docs/layout_sketches/act_maps_v1/ENDLESS_PLAINS_AREA_MAP_LOCK.md`. Do not alter or replace either PNG unless the user explicitly unlocks the Endless Plains area map.

SVG and vector graphics are banned throughout this repository unless the user explicitly asks for SVG or vector graphics. This ban includes final assets, drafts, intermediate source files, tracing, vector-based construction, and SVG/vector rendering pipelines. Use raster workflows for all image work by default.

When the user asks to see images in the chat, display every requested image directly with GitHub-flavored Markdown image syntax using its absolute local path, with each image visibly labelled. Do not use raw HTML, plain file addresses, ordinary clickable links, or tool-side image previews as a substitute, because those may be hidden or rendered as text in the user's interface. Before responding, verify that the number of Markdown images equals the number requested, and never claim that images are visible merely because they appeared in internal or collapsed tool output.

The opening sequence is locked. Do not change its placard, starting image, menu, timing, intro audio path, lighter cue, or transition behavior unless the user explicitly unlocks that exact part.

Combat UI v1 is locked. Its canonical manifest is `app/combat_ui_take2/COMBAT_UI_V1.md`. Do not change the locked Mara Vey, Nix Calder, or Sister Elian presentation files or their exact portrait sources unless the user explicitly unlocks Combat UI v1. Put subsequent combat-interface experiments in a separate Combat UI v2 implementation.

Combat UI v2 Action Options is locked. Its canonical manifest is `app/combat_ui_v2/COMBAT_UI_V2_ACTION_OPTIONS.md`. Do not change the locked external-pane composition, interaction rules, or presentation files unless the user explicitly unlocks that exact part of Combat UI v2.
