# Exploration Map Editor

- **New** clears the editor and starts a blank map.
- **Load** lists saved bundles under `app/areas/` and restores the selected area’s background and authored metadata.
- **Upload map here** loads a 1920 × 1080 exploration-map image by drag and drop or by clicking to select a file.
- **Area name** names the location.
- **Map mode** chooses exploration or grand exploration and sets the default character scale.
- **Act number** identifies the act that owns the map.
- **Distribution map name** is generated automatically from the act and area name, for example `a03_ritual_road`. This is the stable area ID.
- **Edit nav** places and edits the fixed nodes and paths the player follows.
- **Node**, **Connect**, and **Inflect** create nodes, join them, and shape bends in paths.
- **Character size** controls the player character’s scale at a node, allowing perspective changes along a path.
- **Node behaviour** controls whether a node starts discovered and whether its name appears after the player visits it.
- **Edit occlusion** outlines parts of the map that should appear in front of the player, such as arches and trees.
- **Edit water** outlines water so reflected-light effects remain inside water regions.
- **Show markup** shows or hides the authored water and occlusion regions.
- **Reset nav**, **Reset occlusion**, and **Reset water** clear their respective unsaved metadata.
- **Save map metadata** saves the background to `app/assets/map_backgrounds/` and the complete area bundle to `app/areas/<area-id>/area.json`.
