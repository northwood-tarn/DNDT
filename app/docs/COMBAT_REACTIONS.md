# Combat Reactions System

This document defines the **canonical rules and philosophy** for how reactions are handled in combat.  
It is engine-level design documentation and is authoritative over any class, spell, or UI description.

Reactions in this system are **not prompt-driven**. They are **pre-declared, condition-based interrupts** evaluated automatically by the combat engine.

---

## Design Goals

- Avoid reaction pop-up spam
- Preserve tactical intent without micro-decisions
- Support automation without removing player agency
- Keep player knowledge aligned with character knowledge
- Ensure symmetry between player characters and enemies

---

## Core Principle

A *reaction* is not a choice made at the moment of interruption.

A reaction is a **standing permission** granted by the player (or AI), evaluated automatically when its conditions are met.

---

## Reaction Evaluation Order

When a qualifying combat event occurs, reactions are resolved in the following order:

1. **Event occurs**
   - Attack roll resolves
   - Movement leaves engagement range
   - Spellcasting begins

2. **Knowledge resolution (if applicable)**
   - A hidden Arcana check is rolled for spellcasting events

3. **Reaction eligibility checks**
   - Master toggle enabled
   - Required conditions satisfied

4. **Reaction execution**
   - First valid reaction consumes the reaction resource
   - All other reactions are suppressed until the next round

No prompts are generated during this process.

---

## Arcana Check System

### Overview

Whenever any creature begins casting a spell, **all observers** automatically make a hidden Arcana check.

This applies equally to:
- Player characters
- Enemy NPCs

There is no player input and no UI interruption.

---

### Arcana Check Resolution

An Arcana check is rolled silently:

```
d20 + Arcana modifier + proficiency bonus (if proficient)
```

---

### Knowledge Thresholds

Each spell has an associated **knowledge DC**.

Based on the Arcana check result, the observer gains one of the following information tiers:

| Result | Information Revealed |
|------|----------------------|
| Fail | “A spell is being cast.” |
| Partial success | Spell school |
| Success | Spell identity and level |
| Exceptional success | Full spell details |

Only information actually revealed by this process may be used by reaction logic.

### Knowledge DCs

Spell identification uses a simple level-based DC:

DC = 10 + spell level

This is tuned so that a spellcaster will usually recognise spells below their own tier, while higher-level magic remains uncertain.

---

## Reaction Toggles

Reactions are controlled via **persistent toggles**, set outside of moment-to-moment combat resolution.

These toggles express *intent*, not immediate choices.

---

## Reaction Definitions

### Shield

**Trigger phase:** Attack resolution  
**Reaction type:** Hit negation

#### Conditions
Shield may only trigger if:
- The incoming attack hits
- Casting Shield would convert the hit into a miss

#### Toggles
- **Shield ON / OFF**
- **HP Threshold Condition (optional)**
  - OFF: Ignore HP
  - ON: Trigger only if current HP ≤ selected threshold
    - 100%
    - 50%
    - 25%

Shield never evaluates damage values.

---

### Opportunity Attacks

**Trigger phase:** Enemy movement  
**Reaction type:** Melee interrupt

#### Toggles
- **Opportunity Attacks ON / OFF**

If enabled, an opportunity attack is made automatically when an enemy leaves melee range.

No prompts are generated.

---

### Uncanny Dodge

**Trigger phase:** Post-hit damage resolution  
**Reaction type:** Damage mitigation

#### Conditions
- The attack hits
- The attacker is visible

#### Toggles
- **Uncanny Dodge ON / OFF**
- **HP Threshold Selector**
  - 100%
  - 75%
  - 50%
  - 25%

If enabled, Uncanny Dodge triggers only when current HP is at or below the selected percentage.

---

### Counterspell

**Trigger phase:** Spellcasting start  
**Reaction type:** Spell interruption

Counterspell is gated by **knowledge availability**.

#### Step 1: Knowledge Gate
If the Arcana check does not identify the spell, Counterspell may only trigger if:

- **Counterspell Unrecognised Spells** toggle is ON

If this toggle is OFF, no further checks occur.

---

#### Step 2: Level Gate (requires recognition)

- **Minimum Spell Level** toggle
- Counterspell only triggers if the recognised spell meets or exceeds this level

---

#### Step 3: Impact Gate (requires recognition)

- **Damage Threshold Toggle**
- Uses **average expected damage** of the spell
- Compared against **current HP** of the reacting creature

Example:
- Spell avg damage = 50
- Current HP = 100
- Threshold = 50%
- Counterspell eligible

---

## Symmetry Guarantee

All reaction logic applies identically to:
- Player characters
- Enemy NPCs

Enemies may Counterspell, Dodge, or Opportunity Attack using the same rules and knowledge constraints.

---

## Non-Goals

This system deliberately avoids:
- Prompt-driven reactions
- Perfect player knowledge
- Per-event decision spam
- Encoding reaction logic inside class or spell descriptions

---

## Notes for Implementation

- Reactions consume a single shared reaction resource
- Only one reaction may fire per round
- Reaction logic must be deterministic once toggles are set
- Class and spell files should reference this document, not duplicate it

---

## Status

This document defines **current intended behaviour**.  
Any future changes to reaction logic must update this file first.

---
