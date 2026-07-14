# Dialogue Authoring Contract

This document defines the source format for writing dialogue scenes and the metadata required to connect them to maps, encounters, flags, items, NPC services, and other scenes.

The dialogue itself remains ordinary text. Technical behaviour is attached through a small mandatory header, option labels, and effect annotations. A future scene-upload tool will package and validate this source; it will not replace the writing process or act as a prose editor.

## Canonical ID Standard

All new canonical IDs use lowercase letters, a category followed by a colon, and full stops between descriptive segments:

```text
category:lowercase.words
```

Canonical IDs must not contain spaces, underscores, uppercase letters, or free-form punctuation.

Examples:

```text
pc:aya
npc:gate.captain
companion:tara
area:greyharbour
map:greyharbour.docks
map:greyharbour.docks.warehouse
scene:forest.gate
scene:forest.gate.after.bribe
encounter:forest.gate.guards
trigger:forest.gate.guards
flag:forest.gate.door.open
item:gold.key
service:harbour.host.sleep
```

Existing game IDs do not have to be renamed immediately. The catalogue may retain legacy IDs, but all newly created IDs must follow this standard.

## New-ID Placeholders

Use the `nid:` category when a required canonical ID does not yet exist:

```text
nid:gold.key
nid:forest.gate.guards.bribed
nid:warehouse.upper.floor
```

`nid:` means that the import process must:

1. Detect the unresolved ID.
2. Determine its category from its use or ask the author.
3. Generate a canonical ID.
4. Add that ID to the catalogue.
5. Replace every matching placeholder in the scene package.

No `nid:` value may remain in exported game data.

## ID Catalogue

The canonical catalogue must support at least these categories:

- `pc:`
- `npc:`
- `companion:`
- `area:`
- `map:`
- `scene:`
- `entry:`
- `encounter:`
- `trigger:`
- `flag:`
- `item:`
- `service:`

Each catalogue entry has this conceptual shape:

```js
{
  id: "npc:gate.captain",
  kind: "npc",
  label: "Gate Captain",
  aliases: [],
  status: "active",
  source: null
}
```

A dialogue file declares its own `scene.id`. That ID is added to the catalogue by the upload process and is not required to exist beforehand. Other IDs are references unless the upload tool explicitly offers to create them.

A narrative-only participant requires no actor statistics or behaviour. Its complete initial record may be only:

```js
{
  id: "npc:gate.captain",
  kind: "npc",
  label: "Gate Captain"
}
```

The catalogue should support search by ID, label, alias, and category. It should also report where an ID is produced and consumed.

## Scene and Location Naming

When a location has one principal dialogue scene, the map and scene should use the same descriptive stem while retaining different category prefixes:

```text
map:forest.gate
scene:forest.gate
```

Additional scenes extend that stem:

```text
scene:forest.gate.after.bribe
scene:forest.gate.after.combat
scene:forest.gate.sneak.success
```

Do not add `.main` merely because a location currently has one scene.

## Mandatory Dialogue Header

Every dialogue source file begins with this header. Every field shown below is required to be present, even when its value is `null` or an empty list.

```yaml
---
format.version: 1
act: 1_Greyharbour
scene.id: scene:forest.gate
scene.title: Forest Gate
dialogue.type: full
location.id: map:forest.gate
trigger.id: trigger:forest.gate.guards
participants:
  - npc:gate.captain
frequency: once
required.flags: []
forbidden.flags: []
start.effects: []
bypass.effects: []
completion.effects: []
success.destination: null
failure.destination: encounter:forest.gate.guards
---
```

### Header field meanings

`format.version`

: Source-format version. Currently `1`.

`act`

: Distribution group for the compiled scene. It must be exactly `1_Greyharbour`, `2_Necropolis`, or `3_Backlands`. The upload tool presents these as a dropdown and saves the compiled JSON under the corresponding act folder.

`scene.id`

: Stable canonical ID for the scene.

`scene.title`

: Human-facing working title. This is metadata and may contain spaces and uppercase letters.

`dialogue.type`

: One of `full`, `vignette`, or `emberside`. The type controls presentation and which effects the scene is permitted to contain.

`location.id`

: Canonical map or location ID where the scene principally belongs. Use `null` only for a genuinely location-independent scene.

`trigger.id`

: Fixed tile or node trigger ID that begins the scene, or `null` when the scene is reached from another scene or system. Tile and node coordinates belong to the map trigger record, not the dialogue header.

`participants`

: Canonical IDs for PCs, NPCs, or companions named in the scene. An empty list is permitted for narration-only scenes. A participant does not need a combat actor record: a narrative-only NPC may consist solely of its canonical ID and display name. Skill checks and other option mechanics belong to the dialogue, not to the participant.

`frequency`

: `once` or `repeat`.

`required.flags`

: Every listed flag must be true before the scene is eligible.

`forbidden.flags`

: Every listed flag must be false or absent before the scene is eligible.

`start.effects`

: Canonical effects applied when the scene begins.

`bypass.effects`

: Canonical effects applied when the associated encounter is bypassed.

`completion.effects`

: Canonical effects applied when the scene is completed.

`success.destination`

: Canonical destination reached by the scene's general success route, or `null` when success is resolved entirely by individual options.

`failure.destination`

: Canonical destination reached by the scene's general failure route, or `null` when failure is resolved entirely by individual options.

Destination values may reference `scene:`, `encounter:`, or `map:` IDs. Individual options may override the general destinations.

There is no scene-wide encounter field. If a particular option starts combat, that option references the encounter directly:

```text
oc. Attack. //start.combat=encounter:forest.gate.guards//
```

## Dialogue Types

### Full dialogue

```text
dialogue.type: full
```

Full dialogue is the normal full-screen scene. It may contain substantial prose, participants, choices, requirements, checks, effects, destinations, services, and combat handoffs.

Most authored dialogue scenes will use this type.

### Vignette

```text
dialogue.type: vignette
```

A vignette is a short text presentation shown without replacing exploration or combat. Typical uses include:

- Travel barks while the party moves across an exploration map
- Companion observations
- Short environmental descriptions
- Combat-specific barks
- Brief reactions to local events

Vignettes are mechanically inert. They only display text.

A vignette must not contain:

- Dialogue options
- Skill checks
- Required or forbidden flags
- Start, bypass, or completion effects
- Items, currency, or services
- Flag changes
- Scene, map, or encounter destinations
- Combat starts

Its mandatory header fields remain present, but inapplicable fields use `null` or empty lists:

```yaml
---
format.version: 1
act: 1_Greyharbour
scene.id: scene:greyharbour.travel.rain
scene.title: Rain on the Harbour Road
dialogue.type: vignette
location.id: map:greyharbour.docks
trigger.id: null
participants: []
frequency: repeat
required.flags: []
forbidden.flags: []
start.effects: []
bypass.effects: []
completion.effects: []
success.destination: null
failure.destination: null
---
```

The system that displays the vignette may decide when it appears, but the vignette itself cannot change game state.

### Emberside dialogue

```text
dialogue.type: emberside
```

An emberside dialogue occurs while the party is at an ember. It is narrative rather than transactional or combat-oriented. It may contain prose and dialogue options, but its effects must be narrative effects only.

Permitted emberside effects are limited to narrative state, principally:

- Setting or clearing story flags
- Moving to another emberside or full dialogue scene
- Recording that a conversation or character beat occurred

An emberside dialogue must not:

- Start combat
- Move the party to another map
- Give or remove items
- Change currency
- Open an NPC service
- Apply healing, damage, conditions, resources, or rests
- Modify combat or exploration state directly

Emberside scenes may use `set.flag`, `clear.flag`, and `go.scene`. Their flags describe narrative history; they must not be used as disguised mechanical rewards.

## Dialogue Options

Dialogue choices are written as lowercase option labels followed by a full stop:

```text
oa. That sounds great.
ob. That sounds like a terrible idea.
oc. I need time to think.
```

`oa.`, `ob.`, and `oc.` are structural labels. They are not displayed as part of the option text.

Option labels must be unique within their choice group. A later choice group may begin again at `oa.`. Use `oa.` through `oz.`; if a single choice group ever exceeds 26 options, continue with `oaa.`, `oab.`, and so on.

## Effect Annotations

Double slashes mark an authoring instruction:

```text
oa. That sounds great. //open gate//
ob. That sounds like a terrible idea.
```

Natural-language annotations such as `open gate` are scene-specific instructions. They are not canonical effects and therefore retain ordinary spaces. The upload process must resolve them before export.

Resolved canonical effect names use lowercase words separated by full stops and contain no spaces:

```text
set.flag
clear.flag
start.combat
give.item
remove.item
change.gold
go.scene
go.map
check.skill
open.service
```

A resolved effect may be written directly using `=` followed by a canonical ID:

```text
oa. Let us through. //set.flag=flag:forest.gate.door.open//
ob. Draw your weapon. //start.combat=encounter:forest.gate.guards//
```

Natural scene instructions must not be converted into effect-looking phrases merely by replacing their spaces:

```text
//open gate//     correct natural instruction
//open.gate//     incorrect: falsely resembles a canonical effect
```

Several annotations may appear on one option:

```text
oa. Here is your money. //remove 10 gold// //open gate//
```

The upload tool must display and resolve each annotation separately.

## Skill-check Runtime Policy

Write a check as a canonical option annotation, for example:

```text
oa. Try to slip past the guards. //check.skill=stealth.dc.15//
```

The player is shown `Stealth — DC 15` before choosing. The check is rolled once when the option is selected. The runtime records the d20, modifier, total, DC, performer and success or failure; it then follows the header's `success.destination` or `failure.destination`.

Put outcome-specific flags, rewards and other consequences in the destination scene's `start.effects`. This keeps each consequence attached to the branch that actually occurred. Effects written directly on the checked option always occur regardless of the check result.

Options whose required flags are not satisfied are disabled with a reason by default. Individual options may instead be marked hidden in compiled content where revealing the option would disclose information the player should not have.

## Fixed Encounter Triggers

Fixed triggers connect maps to dialogue or combat without containing narrative prose. A trigger records:

- Trigger ID
- Map ID
- Tile or region location
- Encounter ID
- `once` or `repeat` frequency
- Required and forbidden flags
- Dialogue-first or direct-combat entry
- Success and failure destinations
- Flags set when triggered, bypassed, or completed

Example:

```js
{
  id: "trigger:forest.gate.guards",
  mapId: "map:forest.gate",
  location: { type: "tile", column: 4, row: 7 },
  encounterId: "encounter:forest.gate.guards",
  frequency: "once",
  entryMode: "dialogue",
  dialogueId: "scene:forest.gate",
  requirements: {
    requiredFlags: [],
    forbiddenFlags: ["flag:forest.gate.guards.defeated"]
  },
  destinations: {
    success: { type: "map", id: "map:forest.interior" },
    failure: { type: "combat", id: "encounter:forest.gate.guards" }
  },
  flags: {
    onTriggered: { "flag:forest.gate.guards.met": true },
    onBypassed: { "flag:forest.gate.guards.bypassed": true },
    onCompleted: { "flag:forest.gate.guards.defeated": true }
  }
}
```

Moving enemies and awareness simulation are not part of this contract. A description such as guards pacing before a gate is presented by the dialogue scene attached to a fixed trigger.

## Scene-Upload Tool Responsibilities

The future upload tool is a packaging and validation tool, not a narrative-writing environment. It should allow the author to paste or upload the text and then:

1. Parse and validate the mandatory header.
2. Extract option labels and player-facing option text.
3. Extract `//...//` effect annotations.
4. Match canonical IDs against the catalogue.
5. Present existing flags as searchable selections.
6. Separate required, forbidden, and resulting flags.
7. Resolve or create every `nid:` placeholder.
8. Convert natural-language annotations into confirmed structured effects.
9. Validate map, scene, encounter, item, NPC, companion, service, and destination references.
10. Preview the compiled scene package.
11. Refuse export while unresolved annotations, unknown IDs, or `nid:` placeholders remain.

The tool should warn about:

- Duplicate IDs
- Near-duplicate labels
- Requiring and forbidding the same flag
- Reading a flag that is never set
- Setting a flag that is never read
- Unknown effect names
- Missing effect arguments
- Invalid encounter or destination references
- Options with unresolved annotations
- Once-only scenes that have no persistent outcome
- Vignettes containing options, requirements, destinations, or effects
- Emberside scenes containing non-narrative effects
- Emberside scenes attached to a non-ember location

## Authoring Example

```text
---
format.version: 1
act: 1_Greyharbour
scene.id: scene:forest.gate
scene.title: Forest Gate
dialogue.type: full
location.id: map:forest.gate
trigger.id: trigger:forest.gate.guards
participants:
  - npc:gate.captain
frequency: once
required.flags: []
forbidden.flags:
  - flag:forest.gate.guards.defeated
start.effects:
  - set.flag=flag:forest.gate.guards.met
bypass.effects: []
completion.effects: []
success.destination: map:forest.interior
failure.destination: encounter:forest.gate.guards
---

Guards move backwards and forwards before the forest gate. Their captain watches the road without appearing to look directly at you.

oa. Approach openly. //start conversation with gate captain//
ob. Try to sneak past. //team stealth dc 15//
oc. Attack. //start.combat=encounter:forest.gate.guards//
od. Leave.
```

During ingestion, the natural annotations are resolved through the tool. The final scene package contains only canonical IDs and structured effects; the player sees only the authored prose and option text.
