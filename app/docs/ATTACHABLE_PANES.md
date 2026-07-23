# Attachable Panes — Working Architecture

Status: **EARLY WORKING NOTES**

This document begins the broader design for panes that can be closed, docked, expanded, or detached. It is intentionally incomplete and should be refined after the first combat Action Options prototype.

## Purpose

Some game surfaces contain too much useful information to compress elegantly into a single laptop-sized pane. Attachable panes allow that complexity to occupy appropriate space without making additional space mandatory.

The initial motivating case is the combat Action Options pane, particularly for complex high-level characters such as Sister Elian. The same architecture may later support spellbooks, inventory, character details, journals, rules references, or other library-like surfaces.

## External pane host

The default external surface on the right of the main combat window is a shared pane host rather than an Action Options-only window.

The cog labels its pane-management tab `External Panes`. A checked pane uses the external host or a detached window. An unchecked pane remains available under laptop rules, opening over the right third of the main map when invoked. This decision is per pane, so hybrid layouts are supported. Fullscreen is available only when every pane is in laptop mode; externalising any pane exits and disables fullscreen.

Its visible tabs may include:

- Actions
- Inventory
- Equipment
- Quests

The fixed combat Settings cog controls which tabs are visible. Each visible tab normally lives in the attached right-side host. Dragging a tab out of the host detaches that surface into its own frameless Electron window; the remaining tabs stay in the host.

Tabs share the available host width evenly and read as subdued embedded pane chrome rather than a second command list. The host has one close control at its top-right; using it closes every tab currently contained by that host. An individually detached pane retains the same top-right close control for that pane alone.

The eventual content contracts for Inventory, Equipment, and Quests are separate work.

### Laptop presentation

The compact laptop workspace cannot depend on external display space. In that configuration these same surfaces extend inward from the right edge over the map area as temporary panes. They do not resize the fixed main combat pane or replace the definitive multilayer coloured bottom menu.

The attached external host and laptop overlay panes are two spatial presentations of the same pane identities and visibility preferences.

## Governing principles

### Compact remains first class

Every workflow that supports an attached pane must retain a complete compact configuration where required. A larger or detached pane offers simultaneous visibility and easier browsing, not exclusive capability.

### One capability, multiple spatial configurations

The underlying data, availability rules, resource state, descriptions, and commands are shared. Docking or detaching a pane must not create a separate implementation of the game rules.

### Stable responsibilities

A pane should keep the same conceptual job as it changes location.

For combat:

- The Action Options pane owns repertoire discovery.
- The battlefield owns spatial application and targeting.
- The bottom UI owns current turn state, staging, and commitment.

Detaching the repertoire must not move targeting or essential turn controls out of the primary window.

### Main-pane dimensions are invariant

**Locked rule:** no operation on an attachable pane changes the size, position, or internal layout of the main pane.

For the combat workspace, the 1280 × 800 main Electron pane is itself non-resizable and non-maximizable. Attachable panes may resize independently, but the main combat pane remains fixed.

This includes:

- Opening or closing a pane
- Docking or detaching a pane
- Resizing a pane
- Expanding or collapsing sections inside a pane
- Scrolling pane content

Attachable combat panes are separate frameless Electron windows positioned outside the main window. The main pane does not compress, shift, resize, reflow, or receive an overlay to make room for them.

#### Combat Action Options exception: content substitution only

The existing multiple-coloured, layered menu in the locked Combat UI v1 presentation is the definitive compact/laptop content for the middle UI pane at the bottom of the main combat screen. Attachable-pane work does not redesign or supersede it.

Opening the combat Action Options pane triggers one deliberate presentation change within the main pane: the content of that middle bottom pane switches from the definitive multilayer coloured laptop menu to the expanded Movement, Action, Bonus Action, and quick-bar controls.

The bottom middle pane retains exactly the same dimensions and position. Closing Action Options restores the definitive laptop menu in the same footprint. This is not a geometric exception to the invariant-main-pane rule; only the content occupying an existing region changes.

### Stable content

Selecting an item should not unexpectedly transform the entire pane into a different interface. Details may expand locally, but the player's repertoire should remain spatially predictable.

### No capability penalty when closed

Closing an optional pane returns the player to the compact workflow. It must not strand an armed action, hide the only route to a required command, or remove access to character capabilities.

### An always-reachable pane control

External pane presentation is controlled through the persistent Settings cog. The settings surface includes a dedicated **External Panes** tab, separate from tabs such as **Reaction Rules**.

**Locked combat placement decision:** the canonical cog remains at the top-right of the middle combat pane in every compact, docked, expanded, or detached combat configuration. It never relocates into the Action Options pane and is not duplicated there.

An attachable pane may eventually have explicit local controls for close, dock, or detach. Those controls are not substitutes for, or copies of, the shared Settings cog.

The External Panes tab is the recovery and management centre for the current pane arrangement. It should eventually support:

- Showing and hiding supported panes
- Docking and detaching panes
- Returning detached panes to the primary window
- Recovering an offscreen pane
- Resetting the workspace to a safe default

This makes pane management discoverable without permanently adding individual open/close controls for every possible pane to the combat UI.

## Proposed pane states

### Closed

The pane is absent. Its workflow is available through the compact interface. Pinned or recent choices may remain available through a quick bar.

### Docked

The pane sits immediately outside an edge of the primary window, initially on the right for combat Action Options.

The attached pane remains a separate Electron window. It follows the main window while attached and never overlaps, shifts, resizes, compresses, or reflows the main content.

Native parent-window attachment should be used while attached so the host follows the main window synchronously. Repeated renderer or main-process `move` event corrections are not acceptable because they produce visible lag and jitter.

An attachable pane may offer player-controlled dimensions appropriate to its dock. The initial combat Action Options pane is vertically resizable from its bottom edge. Resizing affects only that pane. When its contents exceed its chosen height, its content region scrolls internally while its header and close control remain reachable.

### Expanded

The pane occupies a larger share of the same display for browsing-heavy work. This may be appropriate outside active targeting or on high-resolution screens.

### Detached

The pane is already a separate native window; detaching releases it from following the main window. It may then sit elsewhere or on another display.

The primary window retains all state essential to understanding and completing the current interaction.

## Shared state requirements

All representations of a capability must observe the same live state:

- Current actor
- Turn ownership
- Action-economy availability
- Movement remaining
- Resources and spell slots
- Conditions and concentration
- Valid and invalid actions
- Reasons for unavailability
- Current targeting or staged action
- Quick-bar assignments
- Reaction policy

Docking, detaching, closing, or reopening a pane must preserve this state.

No pane may maintain an independent authoritative copy of combat state.

## Cross-surface interaction

The desired combat interaction allows a player to drag an ability from an Action Options pane onto the battlefield.

This is straightforward when the pane is docked in the same document. A detached window introduces technical and interaction questions:

- Can the runtime support reliable cross-window drag and drop?
- How does the battlefield preview targeting while the pointer crosses window boundaries?
- What happens if the primary window is obscured or on another display?
- How are invalid drops cancelled?
- How does keyboard or click-to-pick-up selection cross windows?

The architecture must provide a non-drag equivalent. A likely fallback is:

1. Select or pick up the ability in the pane.
2. Focus the battlefield window.
3. Apply it with the next valid battlefield interaction.

This fallback should use the same staged-action state as dragging.

## Persistence

Potentially persistent player preferences include:

- Last pane state: closed, docked, expanded, or detached
- Dock side
- Docked width
- Docked height
- Detached window size and position
- Which display contained the detached pane
- Expanded or collapsed sections
- Search and filter preferences where appropriate
- Quick-bar assignments

Persistence must fail safely. If a stored display or window position no longer exists, the pane must return to a visible default location.

## Responsive behaviour

The application should choose safe defaults but avoid silently changing the player's established workspace unnecessarily. These defaults may change optional-pane visibility and geometry but never the main pane's dimensions or layout.

Possible defaults:

- Small laptop viewport: compact layout, pane closed
- Larger single display: pane docked on the right
- Previously detached pane with valid display geometry: restore detached state

The exact breakpoints and restoration rules are not yet decided.

## Accessibility and input

Every pane operation needs equivalents for:

- Pointer drag
- Trackpad
- Keyboard
- Reduced motion
- Screen-reader labelling
- Potential future controller navigation

Required commands are likely to include:

- Open the shared Settings surface
- Switch to External Panes
- Open or close pane
- Dock or detach pane
- Move focus between pane and primary surface
- Select an item without dragging
- Cancel a picked-up or staged item
- Return a detached pane to a visible default position

## Visual continuity

Pane state changes information density, not the visual world. Expanded and detached surfaces should remain part of the same interface language rather than looking like developer tools or operating-system inspectors.

Existing project guidance in `app/docs/UI_SCREEN_1_MAXIMAL.md` and `app/docs/UI_principles_UPDATED.md` should inform spacing, hierarchy, restrained linework, fog identity, and local controls. Combat-specific experiments may need their own adaptation of that language.

## Failure and lifecycle cases

The implementation must eventually define behaviour for:

- Closing a pane while an item from it is staged
- Detaching or docking during targeting
- Changing the active character
- Ending combat while a pane is detached
- Loading a save with a detached pane open
- Changing display configuration
- Losing window focus during a drag
- Opening the same pane more than once
- Attempting to detach on a platform that does not support it

The safest initial rule is one instance of each pane, backed by shared state, with docking treated as relocation rather than duplication.

## Initial combat application

The first candidate is the right-hand Action Options pane described in `app/docs/COMBAT_UI_EXPANDED_WORKSPACE.md`.

That prototype should establish:

- Closed and docked states
- Stable collapsed Action and Bonus Action sections
- Bottom-edge height resizing and internal vertical overflow scrolling
- Shared availability state with the bottom economy controls
- Drag and click-to-pick-up application to the battlefield
- Persistent quick-bar assignments
- Per-character quick bars provisionally divided into 6 Action and 4 Bonus Action positions
- Drag-to-add, drag-off-to-remove, and drop-to-replace customization
- Safe restoration of pane width and open state

Detachment should follow only after the docked interaction is proven. It carries additional cross-window input, focus, persistence, and display-management requirements.

## Open architectural questions

- Which layer owns pane state and persistence?
- What form does the shared Settings surface take?
- What exact settings and tabs belong in that surface? Its detailed contents are intentionally deferred.
- Are panes application-level components or scene-local surfaces?
- Which panes are allowed to detach?
- Can more than one different pane be detached simultaneously?
- What snap tolerances and multi-display rules should govern native pane attachment?
- How does a detached pane communicate with the primary window?
- What cross-window drag support is available in the target runtime?
- How are pane layouts restored across machines and display configurations?
- How do attachable panes relate to Screen 1, Screen 2, and Screen Small?
- What remains globally persistent when changing scenes?
