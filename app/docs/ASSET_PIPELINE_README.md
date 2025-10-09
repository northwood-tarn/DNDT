# Asset refactor helpers

## Audit hard-coded asset paths
Report-only:
  node tools/audit-assets.js --root app

Rewrite JS/TS files (assumes ../utils/Assets.js import from each file):
  node tools/audit-assets.js --root app --write --assume-utils ../utils/Assets.js

If a file is deeper (e.g., app/scenes/sub/Thing.js), pass a different assumption:
  node tools/audit-assets.js --root app --write --assume-utils ../../utils/Assets.js

## ESLint
- Config is at .eslintrc.cjs
- Ignore list at .eslintignore
Add these to package.json scripts:
  "lint": "eslint .",
  "lint:fix": "eslint . --fix"
