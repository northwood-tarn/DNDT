# Exploration Interface Contract

Status: locked baseline. Changes to the launcher placement, launcher visibility while Map is open, full-viewport Map presentation, Map close behaviour, or Lanterna flame layering require an explicit new design decision.

This file is the canonical runtime interface contract for grand and local exploration. It governs what may be presented over exploration art, how discoverable elements are revealed, and how supporting information panels behave.

The governing principle is that exploration art remains unobstructed by default. Persistent interface elements must be limited to the small panel-launcher group defined below. Exploration does not receive a permanent objective tracker, location heading, actor roster, compass, travel-data block, or contextual-action bar.

## Scope

This contract applies to:

- grand exploration maps
- local exploration maps
- navigation-map nodes and regions where the same reveal and hover behaviours are relevant
- attached and detached supporting-information panels opened during exploration

It does not redefine combat presentation, dialogue presentation, map topology, map discovery state, or the underlying character, inventory, equipment, spell, and journal data contracts.

## Persistent Launcher Group

Exploration presents a minimal launcher system on the right edge. `M` occupies the top-right corner independently. The remaining launchers form a vertically centred group in this canonical order:

1. journal icon — Journal
2. inventory or bag icon — Inventory
3. equipment or armour icon — Equipment
4. spell or rune icon — Spells
5. character silhouette icon — Character

Rules:

- `M` remains a letter rather than an icon.
- `M` is spatially separate from the centred supporting-information launchers because Map uses the exceptional overlay rather than the attached-panel system.
- The remaining launchers use compact monochrome icons.
- Every launcher exposes its full name on hover or keyboard focus.
- Spells is present only when it is relevant to the current player character.
- The launcher group reflects only panels currently available inside the main game portal.
- When a panel is detached from the main portal, its launcher is removed from the group for as long as that panel remains detached.
- Remaining launchers immediately close up and retain their relative canonical order; detached panels do not leave gaps or placeholders.
- When a detached panel returns to the main portal, its launcher returns to its canonical position in the order above.
- `M` is always present. The launcher group therefore never contains fewer than the Map launcher.
- No additional persistent exploration buttons are introduced without revising this contract.

## Attached Information Panels

Journal, Inventory, Equipment, Spells, and Character use the shared attached-panel system.

- Each attached panel occupies one-third of the centred usable viewport width and the full usable viewport height. Equal fixed margins remain clear at the left and right edges; the right margin contains the launcher group.
- The first panel opens immediately to the left of the launcher margin.
- A second panel expands information coverage to two-thirds.
- A third panel expands information coverage to the full viewport.
- Three attached panels is the maximum.
- Opening a fourth attached panel replaces the most recently opened attached panel.
- The launcher for every open panel remains at the same brightness used for pointer hover.
- Attached panels use a strongly opaque fog surface with restrained backdrop blur. Where they pass over the Lanterna flame, the flame reads as a blurred background element rather than sitting above the panel content.
- Selecting an already-open panel closes it.
- Remaining panels collapse towards the right when a panel closes.
- Attached panels cover the exploration view; they do not resize or permanently reflow the underlying art.
- Opening and closing a panel must preserve the state of the exploration scene beneath it.

### Cross-panel item transfer

Inventory and Equipment must support direct drag-and-drop between their panel presentations.

- An inventory item may be dragged onto a compatible equipment destination to equip it.
- Clicking an equipment destination opens a dropdown inventory list containing only items currently eligible for that exact slot.
- Drag-and-drop and dropdown selection use the same canonical equip transaction and validation path.
- The drop is a request to the canonical equipment rules, not a direct visual mutation. Compatibility, slot availability, actor ownership, and all other equipment restrictions are validated before state changes.
- A valid drop updates the shared inventory and equipment state once; both panels then render that same result.
- An invalid drop leaves state unchanged and returns the item to its source presentation with clear, restrained feedback.
- Drag state must survive panel stacking and movement within the main portal.
- When detachable panels are implemented, Inventory-to-Equipment dragging must also work across connected Electron windows through the same canonical transaction path.
- The detailed item rows, equipment slots, drag preview, and rejection treatment will be designed with the Inventory and Equipment panel content. They are not defined by the empty shared shell.

## Detached Information Panels

When the game is running in its regular window, Journal, Inventory, Equipment, Spells, and Character panels may be detached into connected Electron windows.

- Detached panels may be positioned beside the main game window.
- A detached panel does not count towards the three-panel attached limit.
- Detaching a panel removes its launcher from the main portal; returning it restores that launcher in canonical order.
- Attached and detached forms read from the same live game state.
- A panel cannot exist as two independently editable copies. Its attached and detached forms are two presentations of the same panel state.
- Detaching and organising external panels is unavailable in Full Screen mode.
- Entering Full Screen must not create external windows.

The detailed Electron window lifecycle may be implemented later, but implementations must preserve this contract.

## Map Overlay

Map is the sole exception to the one-third panel system.

- Map opens as a full-viewport cover layer, filling the player's field of vision within the game portal.
- While Map is open, `M` retains its normal appearance and remains clickable as the control that closes Map. Its hover label changes to `Click to close`.
- The map artwork covers the full viewport without letterbox bars or decorative borders.
- Supporting-information launchers are hidden while Map is open.
- The Lanterna flame remains visible above the Map overlay. Attached information panels pass above and blur it as part of their background treatment.
- Map does not consume an attached-panel slot.
- While Map is open, the attached panel stack is hidden rather than destroyed.
- Closing Map restores the attached panel stack exactly as it was.
- Up and down controls move between available levels of map detail.
- An up or down control appears only when the corresponding level exists and is available to the player.
- Map nodes and regions may expose the compact, knowledge-aware hover information defined below.
- Every map detail level must define hoverable locations appropriate to that level. Changing detail level must never remove hover support as a capability, although the individual eligible locations may change.

## Ghost-Light Reveal

`Tab` invokes the exploration ghost-light. It is a temporary discovery aid, not a permanent overlay.

The ghost-light may identify only these four categories:

1. transitions and exits
2. NPCs
3. interactive items
4. areas of interest that may lead to skill checks

Behaviour:

- Pressing or holding `Tab` refreshes and reveals all currently eligible targets.
- The reveal fades in promptly without flashing abruptly onto the art.
- Releasing `Tab` begins a slow fade, with an initial target duration of four seconds.
- Pressing `Tab` again during the fade restores the reveal.
- Hovering a revealed target arrests that target's fade.
- The target remains revealed while its hover information is being inspected.
- Moving away resumes the target's fade from its current state.
- Targets that are hidden by canonical discovery or story state are not revealed merely because `Tab` was pressed.

The ghost-light must remain visually subordinate to the artwork. It indicates the position or extent of a target without replacing it with a permanent marker.

## Knowledge-Aware Hover Information

Revealed targets and grand-map nodes may display one compact hover card.

The card may contain:

- the known name
- a short known type or function
- one short piece of information already known to the player

Example:

> Fiona · Merchant  
> Fond of apple brandy. Sells finely crafted weapons.

Hover information must be derived from current player knowledge. It must not disclose:

- an undiscovered identity
- a hidden interaction or transition
- the existence or difficulty of an unrevealed skill check
- a secret route
- merchant stock or services the player has not learned about
- story information not yet established in state

If no descriptive information is known, the card may show only the known name or type. It must not invent explanatory text at runtime.

## Presentation Boundary

The following remain absent from the default exploration view:

- permanent labels over NPCs, items, exits, or points of interest
- permanent objective or quest markers
- always-visible location and map headings
- always-visible party or actor status blocks
- contextual action bars
- decorative interface frames that reduce the visible art area

Individual authored scenes may require exceptional information, but exceptions must be scene-specific and must not silently expand the global exploration interface.

## Implementation Ownership

Implementation should be divided into two reusable systems:

1. an exploration ghost-light and knowledge-aware hover service
2. an attached/detachable panel manager with the specialised Map overlay

Grand and local exploration consume these shared systems. They do not maintain divergent copies of the interaction rules.
