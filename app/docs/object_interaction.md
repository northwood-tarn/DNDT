# Module: Object Interaction

## Contract
- **Purpose**: Defines the framework for environmental object interaction in exploration scenes, including context menus, requirements, and outcomes.  
- **Inputs**: Player character state (known spells, class features, resources), object metadata (id, verbs, requirements).  
- **Outputs**: Contextual interaction menu, triggered events or scripts (e.g., opening gates, pulling levers).  
- **Constraints**: Must integrate with Lanterna system (light economy) and with spell-based interaction (Wisp cantrip).  
- **Extension**: Future spells (e.g., Knock, Mending) may add new verbs; companions do not directly trigger interactions.

---

# Object Interaction System

This document describes how environmental objects can be interacted with during exploration, and how spells like **Wisp** enable special context actions.

---

## 1. Object Types

Every interactable object declares:
- **id** – unique reference string (e.g., `iron_gate_01`).  
- **interactionVerbs** – list of verbs available to the player (e.g., `open`, `inspect`, `climb`).  
- **requirements** – conditions that must be satisfied (e.g., `hasLanterna`, `hasWisp`, `strengthCheck`).  
- **outcome** – script or event triggered by the interaction.

Examples:
- **Gate** → verbs: `open`, `summon_wisp_to_open`.  
- **Lever** → verbs: `pull`, `summon_wisp_to_pull`.  
- **Loose Stone** → verbs: `inspect`, `summon_wisp_to_retrieve`.

---

## 2. Contextual UI

When the player highlights or clicks on an object:
- A list of **available verbs** is shown.  
- Verbs are filtered dynamically by requirements (e.g., “Summon Wisp to open gate” only appears if the caster knows *Wisp*).  
- Certain verbs may trigger **skill checks** (e.g., `strengthCheck`).

---

## 3. Wisp Integration

The **Wisp (cantrip)** allows ephemeral interaction:
- **Duration**: 1 round only, extinguishes after task.  
- **Uses**: 
  - Open an unlocked gate.  
  - Pull a lever.  
  - Retrieve a tiny object (≤5 lb).  
  - Shed a flicker of light for a momentary reveal.  
- **Rules**:
  - Wisps never enter initiative.  
  - Wisps vanish immediately after completing their action.  
  - Not a substitute for lantern light (flicker only).  
- **UI Hook**: verbs prefixed with `summon_wisp_to_...` should appear in the object’s context menu when the caster has the *Wisp* spell.

---

## 4. Exploration Flow Example

1. Player approaches a **grate**.  
2. UI shows verbs: `inspect`, `open`, `summon_wisp_to_open`.  
3. If the PC has *Wisp*, they can select `summon_wisp_to_open`.  
4. Wisp appears, flickers light, unlatches the grate, then vanishes.  
5. The grate’s `outcome` script is triggered (`state: open`).  

---

## 5. Design Notes

- Object verbs should be **minimal and thematic**.  
- Wisps provide a **story-driven bridge** between puzzles and necromantic lore — spectral help at a cost (spell slot/cantrip usage).  
- This system can later expand to support **other interaction spells** (e.g., *Knock*, *Mending*), but Wisp is the archetypal case.  
