# DNDT Area Author Tool

This folder contains the standalone traversal authoring tool.

## Run

From `DNDT`, either double-click `area-author.command` on macOS or run:

```text
./area-author.sh
```

The direct npm command also works:

```text
npm run area:author
```

Then open:

```text
http://127.0.0.1:8130/area_author_tool/index.html
```

## Folder Contract

```text
app/area_author_tool/imports/
```

Accepted 1920x1080 background images are copied here by the tool.

```text
app/area_author_tool/exports/
```

Final area JSON exports are written here.

## Authoring Scope

The tool only handles traversal-level area data:

- 1920x1080 background image
- area name, generated area id, map type
- traversal nodes
- curved paths with inflection points
- entry node
- node scale
- discovery label behavior
- node trigger: `none`, `conversation`, `area_transition`, or `combat`
- combat spawn points

Combat-grid presentation is deliberately left out for now.
