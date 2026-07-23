# Area bundles

Each authored exploration area has one folder named with its stable ID:

```text
app/areas/aNN_area_name/area.json
```

The `area.json` bundle contains the area identity, act, map mode, background reference, fixed-path navigation, node behaviour, occlusion regions, and water regions.

Background images live separately in `app/assets/map_backgrounds/` using the same stable ID. Audio, dialogue, encounters, and combat data remain in their existing systems until their runtime contracts are intentionally unified.
