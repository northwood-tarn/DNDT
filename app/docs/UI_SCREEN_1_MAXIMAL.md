# UI Screen Language

## Screen 1

Screen 1 is the maximal three-column view.

It uses the full fog field and the fixed Lanterna flame. Character creation is the current reference implementation. It should not rely on visible column partition lines; the columns should be held by spacing, alignment, hierarchy, and small local controls.

Current Screen 1 anchor:

- full-window animated fog
- top-center Lanterna flame
- three-column organisation
- small portrait tiles
- sparse linework only where a local control needs it
- no enclosing viewport border
- no column dividers

Primary uses:

- character creation
- character/inventory overview
- full character sheet
- major party or campaign management views

## Screen 2

Screen 2 is the two-column bounded view.

It uses the same fog and flame identity, but introduces one slender vertical partition line to bound a two-column split. The partition sits at the two-thirds mark, creating a larger primary area and a smaller supporting area.

Use Screen 2 for focused workflows where one main subject needs a persistent detail/context pane:

- equipment comparison
- shop/trade
- spell preparation
- quest entry plus journal list
- character detail plus inventory subset
- crafting recipe plus ingredient/source list

Partition style:

- 1px vertical line
- pale Lanterna teal
- very low opacity
- vertical fade at top and bottom
- no box frame around the full viewport

## Screen Small

Screen Small is the one-column lookup view.

It uses the same partition-line language as Screen 2, but the bounded area is one-third width. This creates a narrow lookup/list surface without turning the whole screen into a panel.

Use Screen Small for quick reference and narrow lists:

- inventory lookup
- spell list lookup
- condition glossary
- item inspection
- compact rules reference
- save/load list

Partition style:

- same slender fading line as Screen 2
- positioned to bound the one-third column
- the rest of the fog field remains visible and quiet

## Shared Rule

The screen type changes information density, not the visual world. Fog and Lanterna remain the identity. Lines should clarify structure only when spacing alone is not enough.
