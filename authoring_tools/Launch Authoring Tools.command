#!/bin/zsh
cd "/Volumes/Lacuna/Projects/dndt" || exit 1
exec env -u ELECTRON_RUN_AS_NODE npm run authoring
