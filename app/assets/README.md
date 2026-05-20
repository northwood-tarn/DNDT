# App Asset Layout

Runtime assets should live in predictable folders:

```text
app/assets/backgrounds/
```

Background images used by runtime loaders.

```text
app/assets/fx/
```

Small effect sprites and textures.

```text
app/assets/sprites/
```

Character, interface, monster, item, terrain, and placeholder sprites.

```text
app/assets/audio/
```

Runtime audio.

```text
app/assets/fog/
```

Fog frame source and generated fog loops.

```text
app/assets/sources/
```

Large working files such as PSDs. These are not runtime assets.

Area authoring imports and exports are kept separately:

```text
app/area_author_tool/imports/
app/area_author_tool/exports/
```
