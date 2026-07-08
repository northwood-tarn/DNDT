# World Map

The campaign map should be stored as topology first and rendered second.

## Canonical Data

- `app/data/worldMap.js`

This owns the top-layer campaign geography:

- three act-scale areas
- subareas within each act area
- ember-travel model notes
- borders/adjacencies
- attached grid-exploration map slots
- placement notes for future map art

## Current Sketch

- `app/docs/layout_sketches/world_map_three_acts_negative_ink_v3.png`

This is a rough raster concept sketch of the three act-scale areas only. It is not final art and should not be treated as an implemented map surface.

## Current Topology

### Act I: Greyharbour

- Greyharbour / Harbour
- Oil Refinery
- No-Man's Land

Greyharbour and the Oil Refinery sit on the end of a broad promontory cut by a 100ft escarpment. The only way to the Oil Refinery is through Greyharbour. No-Man's Land sits between Greyharbour and the Necropolis.

### Act II: The Necropolis

- Inside the Walls
- The Twilight Bazaar
- The Regnant Eternal
- The Administrative Encasement

Inside the Walls faces No-Man's Land and stretches across the full city width. The Twilight Bazaar sits high/top and is small but culturally central. The Regnant Eternal is long and thin, culminating in the Black Apex Throne. The Administrative Encasement occupies the opposite full city edge.

### Act III: The Backlands

- The Endless Plain
- Untended Graves
- Carrow
- The Escarpment of Eyes
- The Portal

The Endless Plain runs along the Necropolis wall. Untended Graves punctuates the northern/top plain. Carrow begins as a small southern slip and blooms outward. The far center of the Plain leads by massive bridge toward the Escarpment of Eyes, then the Portal.

## Relegated

The earlier interactive `app/world_map/` canvas viewer was removed. It was not the right representation for this stage.

The earlier polygon-style topology sketch was also removed. It did not match the house negative-ink style.
