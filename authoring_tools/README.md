# Authoring tools

Standalone development tools live here rather than under the distributable `app/` tree.

Run `npm run authoring` to open the launcher and start any tool from one place.

- `exploration_map_editor/` — authors exploration-map backgrounds, navigation, occlusion, water, and area bundles.
- `audio_manager/` — assigns and previews game audio, area audio, playback modes, and mixer settings.
- `dialogue_scene_upload/` — parses, validates, packages, and saves authored dialogue scenes.

Generated game assets and area bundles are still written to their canonical runtime locations under `app/assets/` and `app/areas/`.
