
# Verify Events Tool

A small Node script that scans your codebase for event names used in `addEventListener`/`dispatchEvent`
and compares them against `docs/EVENTS_REGISTRY.md`.

## Install

No deps required. Place `tools/verify-events.js` in your repo.

## Usage

```bash
node tools/verify-events.js --root app --registry docs/EVENTS_REGISTRY.md
```

Options:
- `--root <dir>`        Root folder to scan (default: `app`)
- `--registry <file>`   Registry markdown file (default: `docs/EVENTS_REGISTRY.md`)
- `--ext <list>`        Comma-separated extensions (default: `js,mjs,ts,tsx,jsx`)
- `--no-fail`           Do not exit non-zero on unknown events
- `--json`              Output JSON report

## CI Example (package.json)

```json
{
  "scripts": {
    "verify:events": "node tools/verify-events.js --root app --registry docs/EVENTS_REGISTRY.md"
  }
}
```

Add to your CI pipeline to fail builds when new events aren’t added to the registry.

## Notes
- The registry is parsed by looking for backtick-wrapped tokens that look like `namespace:eventName` in the markdown (e.g., **`game:tick`**).
- The code scanner is heuristic (regex-based). It covers the common cases:
  - `window.addEventListener("name", ...)`
  - `addEventListener("name", ...)`
  - `dispatchEvent(new CustomEvent("name", ...))`
- If you use dynamic event names, the tool won’t catch those; prefer constants.
