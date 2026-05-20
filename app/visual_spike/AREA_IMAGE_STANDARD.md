# Area Image Standard

Traversal and exploration area backgrounds should use a fixed source size:

```text
1920 x 1080 px
16:9 aspect ratio
```

This is the production authoring size for illustrated area maps going forward.

## Rationale

- 1920x1080 is a recognized game/video standard.
- It is large enough for desktop presentation, labels, traversal overlays, and light camera movement.
- It keeps image generation, editing, export, and QA predictable.
- It avoids tying authored traversal data to the older visual spike world size.

## Authoring Rule

Area backgrounds are non-negotiable: if a selected image is not exactly 1920x1080, the area tool should reject it.

Traversal points should be saved directly against the accepted 1920x1080 image:

```json
{
  "image": {
    "width": 1920,
    "height": 1080
  }
}
```

The editor may scale the image to fit the viewport, but saved node and path positions should refer to the 1920x1080 source image.

## Area Authoring Model

The traversal area tool should stay deliberately small:

| Area | Item | Meaning |
|---|---|---|
| Area Metadata | Area name | The readable area name. |
| Area Metadata | Area ID | The generated stable ID used for saves and links. |
| Area Metadata | Background image | A 1920x1080 image; anything else is rejected. |
| Area Metadata | Map type | One of `combat`, `exploration`, or `grand_exploration`. |
| Traversal | Node | A place on the map that can be part of a path and may trigger something. |
| Traversal | Path | A connection between two nodes. |
| Traversal | Inflection point | A bend handle that shapes a path. |
| Traversal | Entry node | The node where the PC appears when entering the area. |
| Traversal | Node scale | The PC scale at that node. |
| Discovery | Discovery state | Nodes start unknown by default. |
| Discovery | Discovered name | When a node is discovered, its name can appear on the map. |
| Node Trigger | No trigger | The node is traversal only. |
| Node Trigger | Conversation | The node starts a conversation. |
| Node Trigger | Area transition | The node moves the PC to another area. |
| Node Trigger | Combat | The node starts combat. |
| Combat Spawn | Combat spawn point | A point where an enemy can appear when combat starts. |
| Validation | Image size check | Reject backgrounds that are not 1920x1080. |
| Validation | Entry node check | Warn if the area has no entry node. |
| Validation | Path check | Warn if a path does not connect two real nodes. |
| Validation | Trigger check | Warn if a trigger is missing required target data. |
| Validation | Combat spawn check | Warn if a combat trigger has no combat spawn point. |

## Existing Converted Assets

The first converted 1920x1080 assets are:

```text
app/visual_spike/assets/dockside_stage_uncluttered_v2_1920x1080.png
app/visual_spike/assets/dock_transition_dock_1920x1080.png
app/visual_spike/assets/ritual_road_ink_negative_space_1920x1080.png
```

Original spike assets may remain in place for comparison, but new authored traversal areas should use the 1920x1080 versions.

## Cropping

If a source image is not 16:9, scale it to fill 1920x1080 and crop from the center unless there is a specific compositional reason to do otherwise.
