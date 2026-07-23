# Combat UI — Compact and Expanded Workspace

Status: **WORKING DESIGN NOTES**

This document gathers the current combat-interface decisions for the compact laptop layout, the optional expanded Action Options pane, the quick bar, action staging, and transient action/outcome sentences.

It is not an implementation contract yet. Details that still require interaction testing are identified as open questions.

## Current v2 prototype

The preliminary Action Options workspace is implemented in `app/combat_ui_v2/` for Sister Elian.

The current prototype includes:

- A shared external pane host that starts attached outside the right side of the invariant main pane
- Actions, Inventory, Equipment, and Quests tabs, with provisional non-action content
- Cog-menu visibility controls for each external pane identity
- Tab dragging that detaches an individual pane into a separate Electron window
- Title dragging that detaches and repositions the pane
- Bottom-edge height resizing
- Internal vertical overflow scrolling
- Initially collapsed Action and Bonus Action accordions
- Elian's generated Action and Bonus Action repertoire, with spell-level variants consolidated into readable ranges
- A Settings modal opened by the fixed cog
- An External Panes tab with an Action Options checkbox
- An intentionally empty Reactions tab
- The definitive compact menu restored when Action Options is switched off
- Expanded bottom controls and preliminary 6-Action/4-Bonus-Action quick-bar slots when Action Options is visible

This is an interaction and composition prototype. It does not yet implement the complete battlefield targeting, quick-bar persistence, or atomic action-commit flow described later in this document.

The attached host now uses native Electron parent-window attachment so it follows movement of the fixed main window synchronously rather than chasing main-window `move` events.

## Relationship to Combat UI v1

Combat UI v1 is locked. Its canonical manifest is `app/combat_ui_take2/COMBAT_UI_V1.md`.

Nothing in this document unlocks or replaces Combat UI v1. Any implementation arising from these notes belongs in a separate Combat UI v2 or later experiment. The locked Mara Vey, Nix Calder, and Sister Elian presentations and their exact portrait sources must remain unchanged.

## Core conclusion

The project does not need one spatial configuration for every player. It needs one set of combat capabilities that can be presented in more than one first-class layout.

- The **compact laptop layout** remains a valid, supported solution.
- The **expanded layout** adds a substantial Action Options pane for players with more screen space.
- A later **detached layout** may move that pane into its own window or onto another display.
- Expanded layouts offer visibility and comfort, not additional combat capability.

Sister Elian's level-13 Lantern Cleric build is deliberately an upper-bound stress test. She combines a large prepared spell list, cantrips, upcasting, healing, support, damage, control, subclass actions, species actions, Channel Divinity choices, consumables, concentration implications, and several independent resources. If the compact UI can correctly present her repertoire, it should work comfortably for many lower-level and less complex builds.

## Compact laptop layout

The current laptop-sized combat UI is the compact baseline.

**Definitive content decision:** the existing multiple-coloured, layered action menu in the locked Combat UI v1 presentation is the definitive compact content layer for the middle UI pane of the main combat screen. It is not a placeholder, a category sketch, or a surface to redesign as part of the expanded-pane work.

Its canonical presentation is the locked implementation listed in `app/combat_ui_take2/COMBAT_UI_V1.md`. Expanded Action Options work preserves it as the compact/laptop state.

Its responsibilities include:

- Keeping the battlefield primary.
- Showing the active character's identity, HP, conditions, and relevant combat state.
- Showing Movement, Action, Bonus Action, and End Turn controls.
- Presenting the full repertoire through nested, contextual choices.
- Separating actions by their economy cost.
- Presenting category layers such as weapon attacks, spells, Channel Divinity, tactics, features, and consumables.
- Showing spell levels and meaningful upcast choices.
- Showing resource availability and explaining unavailable actions.
- Supporting class-specific action structures such as the Saboteur's device choices.

The compact layout can be crowded at the most complex edge case. That is accepted. It has been tested against the deliberately most complex build rather than an average character. For a great many characters and levels, its density should be entirely reasonable.

The compact layout must not be described or treated as a degraded fallback.

## Expanded layout: division of responsibility

The expanded layout divides combat interaction into stable regions.

```text
RIGHT ACTION OPTIONS PANE  ->  BATTLEFIELD  ->  BOTTOM TURN CONTROLS
Discover an ability            Apply it          Stage and commit it
What can I do?                  Where/to whom?    What is ready or spent?
```

A transient action/outcome sentence appears just above the bottom combat UI and then fades.

### Settings cog

The small Settings cog is an important persistent control, not incidental decoration. It is the entry point for combat behaviour and combat-workspace configuration.

**Locked placement decision:** the canonical Settings cog remains at the top-right of the middle combat pane, where it is located in the compact laptop UI. It stays there whether the Action Options pane is closed, docked, expanded, or detached. It does not move into the Action Options pane and is not duplicated there.

Its settings surface contains separate tabs or clearly separated sections for:

1. **Reaction Rules** — configure how available reactions are offered or handled.
2. **External Panes** — choose which panes use attached or detached external windows.

The External Panes tab may eventually include controls such as:

- Show or hide Action Options
- Dock or detach Action Options
- Show or hide a spellbook, character reference, or other supported pane
- Return a detached pane to the main window
- Restore a pane that is offscreen
- Reset the combat workspace to its default layout

A checked pane uses an attached or detached external Electron window. An unchecked pane remains available under the laptop presentation rules and opens over the right third of the main map when invoked. This choice is independent for every pane, allowing hybrid external/laptop arrangements.

Fullscreen is an option within External Panes, but it is available only when every pane is unchecked. Checking any external pane exits fullscreen immediately and prevents fullscreen from being enabled again until all external-pane checkboxes are clear.

The cog remains reachable when the Action Options pane is hidden or detached because it is owned by the persistent middle combat pane.

The Action Options pane does not display another Settings cog. Its header may eventually contain explicit pane-management controls such as close, dock, or detach, but these are distinct from global combat/workspace settings.

Pane visibility is a workspace preference, while reaction configuration is a combat-behaviour preference. They share an entry point for convenience but remain visibly distinct inside it.

### Right Action Options pane

The right pane is the character's complete combat repertoire. It remains spatially stable while actions are selected, targeted, and resolved.

**Locked layout rule:** opening, closing, attaching, detaching, scrolling, or resizing the Action Options pane never changes the dimensions or layout of the main combat pane. The battlefield and its primary UI retain exactly the same size and position. Action Options is a separate frameless Electron window that starts immediately outside the right edge of the main combat window.

**Locked main-pane rule:** the main combat pane itself is not resizable. Its 1280 × 800 Electron content area remains fixed; it cannot be maximized or fullscreen-resized. Only external attachable panes may change their own dimensions or detach.

Opening Action Options causes exactly one change inside the main combat pane: the **content** of the existing middle UI pane at the bottom of the screen switches from the definitive multilayer coloured laptop menu to the expanded-layout bottom controls. The middle bottom pane keeps exactly the same size and position. Closing Action Options restores the definitive laptop menu in that same footprint.

```text
ACTION OPTIONS CLOSED
Middle bottom pane: definitive existing multilayer coloured Combat UI v1 menu

ACTION OPTIONS OPEN
Middle bottom pane: Movement, Action, Bonus Action staging and quick bar
```

This is a content substitution, not a resize, reflow, shift, or additional pane.

Its top-level composition, in order from the top, is:

- The shared external-pane tabs
- The title `Action Options`
- The active PC or NPC name in small letters
- A small `X` button at the top-right that closes the pane
- A large collapsible `Action` section
- A large collapsible `Bonus Action` section

```text
┌────────────────────────────────────┐
│ ACTIONS  INVENTORY  EQUIPMENT ... │
│ ACTION OPTIONS                  ×  │
│ SISTER ELIAN                      │
│                                    │
│ ▸ ACTION                           │
│                                    │
│ ▸ BONUS ACTION                     │
│                                    │
└────────────────────────────────────┘
```

The Action and Bonus Action sections are accordion sections rather than ordinary command buttons. They may both remain open; opening one does not automatically close the other. Their expanded or collapsed state persists while the pane remains open.

Spell choices are grouped under their casting levels. Each level heading shows pips for that actor's current remaining slots at that level, using the same slot language as the compact laptop presentation. Every spell row begins with an empty square icon well. Until final icons exist, that well is the draggable object and its hover label identifies the spell.

Hovering or keyboard-focusing any spell, ability, weapon, consumable, or other action choice reveals its description across the bottom fifth of the pane. Its semi-opaque background covers the content beneath it until mouse-out or focus-out.

The description area has no dividing top rule; it should read as green fog gathering over the pane rather than another menu block. Spell descriptions contain only the spell name, a bold `C` when concentration applies, the applicable `V`, `S`, and `M` components with any costly material requirement, and a concise rules description retaining numerical damage, healing, saves, and other mechanical details. Source-book labels and catalogue metadata are omitted. Hovering the `C` explains that it means concentration.

Every actor has both `Weapon Set 1` and `Weapon Set 2` sections. A weapon's mastery description appears only when that actor has the corresponding weapon art; owning the weapon alone does not display mastery proficiency text.

The two sets live together inside one collapsible `Weapon Sets` section. Each set presents two square icon positions for its equipped weapons.

Within every spell level, native spells appear first. When upcasting is offered, a thin divider and small `Upcast` heading separate higher-slot versions from that level's native spells. Spell-slot pips reuse the compact laptop UI's square, pale green-blue treatment.

The green-fog description area begins at one fifth of the pane but grows upward when the displayed rules require more room, subject only to preserving a usable portion of the choice list. While visible, it becomes a dynamic inset: the list's scrollable viewport contracts above it rather than allowing the description to cover Features, Bonus Action, or other navigation. The active choice is kept in view as that viewport changes.

The former general Features section is divided into `Channel Divinity`, `Tactics`, and `Abilities`. Channel Divinity contains the cleric resource's choices; Tactics contains universal actions such as Dash, Dodge, Hide, and Disengage; Abilities contains class, subclass, species, and lineage actions.

The cog's External Panes menu includes `Offer spell upcasting?` inside the Action Options box. When enabled, meaningful higher-slot versions appear under their casting levels. When disabled, the pane lists only each spell's native level. These lists and their slot pips are generated from the active actor's combat state; they are not character-specific pane content.

When an economy has been spent, its heading communicates that state:

```text
▸ ACTION — USED
▾ BONUS ACTION — AVAILABLE
```

A spent section remains inspectable, but its choices cannot be staged.

The `X` closes the Action Options pane and restores the definitive multilayer coloured laptop menu inside the unchanged middle bottom pane. Closing the pane does not resize that pane, alter combat state, clear quick-bar assignments, or cancel an action already staged in the expanded bottom controls. The locked compact presentation remains canonical for that state.

Movement is not a section in this pane; it is performed on the battlefield and recorded in the bottom Movement box. Reactions remain behind the fixed Settings cog. The quick bar remains in the bottom UI.

#### Resizable height and overflow

The Action Options pane has a bottom-edge resize handle. The player can drag its lower edge to choose the pane's height within safe minimum and maximum bounds. This changes only the Action Options pane; it never resizes, compresses, shifts, or reflows the main combat pane.

If the expanded content exceeds the pane's current height, the content region displays a vertical scrollbar and scrolls internally. The header and close button should remain reachable while the content scrolls.

This allows a player to choose among several practical arrangements:

- A short lookup bar showing only a few choices at once
- A medium-height action library occupying less external screen space
- A tall pane showing much of a complex character's repertoire simultaneously

Resizing the pane must not reclassify, remove, or reorder its choices. It changes only how much of the stable repertoire is visible before scrolling. The chosen height should eventually be treated as a restorable workspace preference.

Opening Actions reveals the next layer of choices, including the material that currently appears under Action in the laptop UI:

- Attack with Weapon Set 1
- Attack with Weapon Set 2
- Spells
- Action-cost consumables
- Features and other action-cost character abilities

Opening Bonus Actions reveals the corresponding bonus-action repertoire:

- Bonus-action attacks, where applicable
- Bonus-action spells
- Bonus-action consumables
- Bonus-action features and character abilities

The exact category set is data-driven and may differ between characters.

Categories with no entries do not appear. Choice positions remain stable as availability changes.

The pane does **not** transform into an action-detail or execution pane when an ability is selected. The repertoire stays where the player expects it to be.

After an action resolves, later choices may become unavailable. For example, casting a levelled spell may prevent an incompatible bonus-action spell. Unavailable choices should generally remain spatially stable and visible but greyed out, with a clear reason. They should not silently disappear or cause the library to reflow.

### Bottom turn controls

The persistent Movement, Action, and Bonus Action boxes belong in the bottom UI, not at the top of the right pane.

These controls are the expanded-layout contents of the existing middle UI pane at the bottom of the screen. They replace the definitive multilayer coloured laptop menu only while Action Options is open. The footprint of the middle bottom pane is invariant between the two presentations.

This keeps essential turn state attached to the battlefield even when the Action Options pane is closed, detached, or placed on another display.

The bottom controls answer:

- How much movement remains?
- Is the Action available, being configured, or spent?
- Is the Bonus Action available, being configured, or spent?
- What action is presently armed?

The right pane's Action and Bonus Action section headings already communicate cost. Repeating three economy boxes at the top of that pane would duplicate the bottom controls.

### Movement box

Movement is a remaining budget, not a single-use slot equivalent to Action or Bonus Action.

The player manipulates the figure and path directly on the battlefield. The Movement box records the result:

```text
MOVEMENT 30 FT
MOVEMENT 20/30 FT
MOVEMENT 5/30 FT
```

Movement may be split around an Action or Bonus Action. Each submitted path resolves when the miniature moves. The box continues to display the remaining distance.

Hovering or selecting the Movement box may redraw movement already taken during the current turn. It greys only when movement is exhausted or prohibited.

### Action and Bonus Action boxes

These boxes have three mechanical states:

1. **Available** — empty and ready to receive a choice.
2. **Configuring** — populated with an action whose targeting or parameters are editable or incomplete.
3. **Resolved** — spent and greyed out for the remainder of the turn.

An ability dragged from the Action Options pane or quick bar onto the battlefield is represented in its economy box. For example:

```text
ACTION: GUIDING BOLT · LEVEL 3
```

The populated box records the transition from available repertoire to selected action. This repetition of the action name is useful state, not wasteful duplication.

## Quick bar

The bottom UI includes a player-curated quick bar with ten positions divided by action economy:

- 6 Action positions
- 4 Bonus Action positions

This 6/4 allocation is preliminary and should be validated against the three level-13 test characters before becoming a locked dimension.

```text
ACTIONS
[1] [2] [3] [4] [5] [6]

BONUS ACTIONS
[1] [2] [3] [4]
```

The quick bar may contain a mixture of:

- Weapon attacks
- Spells
- Features
- Consumables
- Other frequently used combat choices

Players populate the quick bar by dragging choices from the complete repertoire in the Action Options pane.

- Dropping a choice into an empty compatible position adds it.
- Dropping a choice onto an occupied compatible position replaces the previous assignment.
- Dragging a choice off the quick bar removes its assignment.
- Action choices can populate only Action positions.
- Bonus Action choices can populate only Bonus Action positions.

Adding, removing, and replacing assignments is reversible workspace customization and does not expend an action, resource, or combat turn.

Quick-bar choices obey the same availability, resource, targeting, and economy rules as the corresponding entries in the complete repertoire.

Assignments are stored per character. Player characters and player-configurable NPC companions therefore each retain their own go-to Action and Bonus Action choices.

The quick bar may be edited during the active player character's turn and during NPC companion turns, allowing the player to tune each controllable character's bar when that character's combat surface is active. Whether editing is allowed during hostile NPC resolution should be decided later; it must never interrupt a required reaction or other modal decision.

Temporarily unavailable assigned choices remain in their positions but show their unavailable state and reason. A temporary resource or rules restriction must not silently erase the player's assignment.

### Quick-bar editing at the Embers

Recommended direction: the quick bar should also be editable during long rests at the Embers.

Combat editing supports immediate adjustment and discovery. The Embers provide a calmer, deliberate preparation context where the player can review each party member or configurable companion and establish their usual loadout before the next encounter.

The Embers editor should manipulate the same per-character assignments used in combat; it is not a separate preset system. Combat remains an allowed editing context rather than forcing players to wait for a long rest to correct or improve a bar.

The exact Embers presentation, whether multiple loadout presets exist, and whether quick bars may also be edited from a general character screen remain open design questions.

The exact position of the quick bar relative to the economy boxes still requires layout testing, especially at laptop widths.

## Dragging, targeting, and arming an action

Drag and drop is the primary tactile language of the expanded layout.

Dragging Guiding Bolt onto the battlefield should:

1. Present viable targets.
2. Distinguish invalid targets.
3. Indicate the attack roll needed for viable targets.
4. Show range, line of sight, cover, or other relevant targeting information.
5. Place a Guiding Bolt icon into the bottom Action box after a valid drop.

The action is then armed but unresolved. Its target and other parameters remain adjustable until committed.

Click-to-pick-up should provide an equivalent non-drag interaction for trackpads, keyboard operation, and accessibility. Selecting an entry attaches it to the cursor; the next appropriate map interaction places or targets it.

## Commit control

A populated Action or Bonus Action box has a half-height commit box beneath the main choice.

```text
┌──────────────────────────┐
│     GUIDING BOLT · L3    │
├──────────────────────────┤
│            ✓             │
└──────────────────────────┘
```

The tick softly glows in and out when the action is completely configured and ready to resolve.

The tick appears only when:

- All required targets have been assigned.
- All placements are legal.
- A required spell level or variant has been selected.
- Necessary resources are available.
- All internal choices for a compound action are complete.

Before readiness, the lower box states what remains:

```text
SELECT A TARGET
CHOOSE 1 MORE DEVICE
PLACE THE TEMPLATE
```

Clicking the upper portion reopens or adjusts the staged action. Clicking the tick commits it.

After resolution, the complete box greys out and indicates that its economy has been spent.

The pulse should be a restrained luminance change rather than a scaling animation. It should stop or settle on hover and become a steady glow when reduced motion is requested.

## Atomicity and resolution timing

The governing rule is:

> **Configure sequentially; resolve atomically. Resolve one economy segment at a time.**

All internal choices for a single Action or Bonus Action are configured before that segment resolves. The whole turn is not pre-scripted and resolved at once.

This preserves D&D's decision rhythm: an outcome becomes known before the player decides what to do next. It avoids conditional turn programming, automatic replanning, and invalidated future instructions.

### Compound actions

Internal choices do not become additional temporal segments.

For Double Rig, the Action contains two device slots:

```text
DOUBLE RIG
[DEVICE 1] [DEVICE 2]
```

The player selects and places both devices sequentially. Neither resolves during configuration. Committing the Action resolves both together.

For Scorching Ray, the player assigns each ray to a target sequentially. Committing the Action resolves the complete spell as one event.

```text
SCORCHING RAY · LEVEL 3
[RAY] [RAY] [RAY] [RAY]
```

Sockets, rays, target markers, templates, and placements are parameters inside one economy capsule. They must not look like additional turns or timeline stages.

### Economy segments

Movement, Action, and Bonus Action resolve separately:

```text
Configure a movement path -> move and resolve
Configure an Action       -> commit and resolve
Configure a Bonus Action  -> commit and resolve
Continue movement         -> move and resolve
```

The player may leave movement, Action, or Bonus Action unused and end the turn.

## Transient action and outcome sentences

The sentence is not an action browser, a turn-programming system, or a persistent log. It is a momentary subtitle for play.

It appears just above the bottom combat UI after a committed segment and fades after a short period.

The action phrase leads naturally into its outcome phrase:

> As an **ACTION**, Sister Elian casts **Guiding Bolt at level 3** at the **Gutter Wraith**.  
> _The spell hits for 19 radiant damage. The next attack has advantage._

For a compound action:

> As an **ACTION**, Nix uses **Double Rig**, deploying a **Smoke Vial at the gantry** and **Thunder Wire across the northern passage**.  
> _Smoke engulfs the gantry while the wire electrifies the passage._

For movement:

> Sister Elian **moves 10 feet toward the brazier**.  
> _The Gutter Wraith makes an opportunity attack and misses._

Each Movement, Action, or Bonus Action segment produces its own sentence after it resolves. There is no conditional sentence construction and no pre-authored whole-turn script.

The sentence and economy boxes are not redundant:

- The boxes persistently state what is available, armed, or spent.
- The sentence briefly explains exactly what happened and what resulted.

An optional history surface may retain the same sentences for later inspection, but a persistent onscreen combat log is not required in the expanded presentation.

## Explicitly rejected directions

The following directions were considered and rejected for this approach:

- Making sentence construction the primary action-selection interface.
- Pre-programming a whole turn as a compound or conditional sentence.
- Building conditional branches such as `if the target fails, then...`.
- Resolving part of a compound Action before its other internal choices are made.
- Transforming the complete right pane into an action-detail pane after selection.
- Duplicating Movement, Action, and Bonus Action boxes in both the right pane and bottom UI.
- Treating the compact laptop layout as an inferior fallback.

## Open questions for prototyping

- Final snap tolerance and multi-display behaviour of the external right Action Options window.
- Exact content transition between the definitive multilayer coloured laptop menu and expanded bottom controls within the invariant middle bottom pane.
- Safe minimum and maximum heights for the resizable Action Options pane.
- Visual and pointer treatment of the bottom-edge resize handle.
- Settings surface form: popover, drawer, dialog, or another lightweight treatment.
- Exact contents and organisation of the Settings menu beyond its eventual Reaction Rules and External Panes responsibilities.
- Exact placement and responsive behaviour of the ten-slot 6-Action/4-Bonus-Action quick bar.
- Validation of the preliminary 6/4 allocation against Mara, Nix, and Sister Elian.
- Exact permissions for editing a player character or companion quick bar outside that character's active turn.
- Embers quick-bar editing presentation and whether any additional non-combat editing surface is needed.
- Visual treatment for compound action parameters without making them look temporal.
- Whether clicking an armed action is sufficient to edit it or needs a dedicated edit affordance.
- Timing of the sentence's appearance, hold, and fade.
- Whether hovering the transient sentence pauses its fade.
- How optional sentence history is opened and presented.
- Keyboard and controller equivalents for drag, drop, targeting, and commit.
- Whether detached panes can exchange drag operations reliably across windows.
