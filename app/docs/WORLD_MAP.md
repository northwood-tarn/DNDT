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

## Current Spatial Reference

- `app/docs/layout_sketches/world_map_three_acts_negative_ink_v5.png`

This is the preserved top-level spatial reference from which the definitive act-map presentations were derived. Runtime map surfaces use the locked assets under `app/assets/maps/`.

## Current Topology

### Act I: Greyharbour

- Greyharbour / Harbour
- Oil Refinery
- No-Man's Land

Greyharbour and the Oil Refinery sit on the end of a broad promontory cut by a 100ft escarpment. The only way to the Oil Refinery is through Greyharbour. No-Man's Land sits between Greyharbour and the Necropolis.

The Greyharbour area map is fully revealed from the beginning of Act I. Its four areas—Old City, Settlement, Docks, and Oil Refinery—are all visible before the party visits them.

### Act II: Xebec

- Inside the Walls
- The Twilight Bazaar
- The Chalk Residences
- The Regnant Eternal
- The Administrative Encasement

Xebec is the city's fixed proper name; **the Necropolis** remains its ordinary descriptive name. Inside the Walls faces No-Man's Land and stretches across the full city width. The Twilight Bazaar sits high/top and is small but culturally central. The Chalk Residences form a distinct Necropolis subsection. The Regnant Eternal is long and thin, culminating in the Black Apex Throne. The Administrative Encasement occupies the opposite full city edge.

Act II areas do not appear on the area map merely because the party enters or crosses them. An area is revealed only after the party rests at an ember located inside that area.

### Act III: The Backlands

- The Endless Plain
- Untended Graves
- Carrow
- The Escarpment of Eyes
- Towards the Portal
- Memphremagog

The Endless Plain runs along the Necropolis wall. Untended Graves punctuates the northern/top plain. Carrow begins as a small southern slip and blooms outward. Memphremagog occupies the far top-left: a vast, low lake with shallow paths here and there. The far center of the Plain leads by massive bridge toward the Escarpment of Eyes, then Towards the Portal.

Act III uses the same ember-rest reveal rule as Act II: an area appears on the area map only after the party rests at an ember located inside that area.

## Relegated

The earlier interactive `app/world_map/` canvas viewer was removed. It was not the right representation for this stage.

The earlier polygon-style topology sketch was also removed. It did not match the house negative-ink style.
