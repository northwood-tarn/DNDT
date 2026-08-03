# Combat UI v2 — Fog Presentation Lock

Status: **LOCKED**

This manifest locks the original 10% fog-compositor presentation selected on 31 July 2026.

## Locked architecture

- Combat and menu panes remain separate Electron windows.
- `fog_compositor.html`, `fogCompositor.css`, and `fogCompositor.js` provide the transparent presentation layer spanning the connected window assembly.
- The compositor follows the connected panes without replacing, embedding, or duplicating their contents.
- The rejected shared-window and edge-mask experiments are not part of this presentation.

## Locked 10% treatment

- Particle outward velocity: `1.3 + random × 4.8`
- Tangential velocity: `(random − 0.5) × 5.2`
- Edge offset: `random × 3.4 − 1`
- Particle radius: `6 + random × 18`
- Particle alpha: `0.018 + random × 0.048`
- Emission rate: `max(6, pane count × 5)`
- Velocity wobble: `0.12 / 0.10`
- Radius growth: `0.009`
- Rift blur: `6.5 + pulse × 9.5`
- Rift shadow alpha: `0.04 + pulse × 0.032`
- Rift stroke alpha: `0.022 + pulse × 0.027`
- Rift width: `4.2 + pulse × 7.2`
- Compositor padding around the connected assembly: `19px`

Do not alter the architecture, rendering method, visual constants, lifecycle, or pane tracking described here unless the user explicitly unlocks this presentation.
