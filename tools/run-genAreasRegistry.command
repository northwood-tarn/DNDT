#!/bin/bash
# tools/run-genAreasRegistry.command
# Double-clickable launcher for genAreasRegistry.mjs (macOS)

cd "$(dirname "$0")/.."

echo "Running genAreasRegistry.mjs..."
node tools/genAreasRegistry.mjs --areasDir ./app/areas

echo
echo "Done. Press any key to close."
read -n 1
