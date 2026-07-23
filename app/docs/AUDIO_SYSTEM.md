# Audio system

`app/audio/index.js` exposes the shared `audioRuntime`. Game code should request area, dialogue, or semantic event IDs; it should not create audio elements or reference filenames.

Authored project configuration is versioned in `app/data/audio-config.json`. It contains one asset registry, one profile per area (exactly one `exploration` or `combat` type, one optional music track, one optional ambience track, and rare dialogue clips), global events, mixer defaults, and dialogue ducking. Player volume overrides remain in the existing `dndt.settings` local-storage record.

Open **Audio Test** or **Audio Manager** from the Escape system menu. Both use the production runtime. Audio Manager file operations are development-only because packaged application resources are read-only.
