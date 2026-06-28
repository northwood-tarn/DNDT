# 0 Plateau Assault - Art Edit Attempt 01 Validation

Status: rejected. This is a failed process outcome, not merely a failed art attempt.

## Accepted

- The generated image preserves the broad battlefield structure: left approach, central void, raised right plateau, and two slope/ramp approaches.
- The overall tactical read is much stronger than a free-generation image because the placement plate visibly constrained the composition.
- The image is now available at true `1920 x 1080` for audit.

## Rejected

- The altitude contract fails. The +4 plateau does not read as a physically raised space with convincing vertical cliff faces, occlusion, and height separation. It reads mostly as one flat plane with darker pits.
- The image looks like the isometric control grid with stone texture applied. That is not acceptable as a final combat map style. The grid must remain an invisible construction scaffold, not the visible landscape language.
- The terrain has repeated diamond/tile seams and per-cell texture logic. Neighboring same-terrain cells should merge into larger painted terrain masses unless the grid explicitly marks a boundary.
- The burning tree does not stay inside the four orange `1` feature cells. Its trunk and fire mass are shifted up and right, so the authored feature footprint no longer matches the visible object.
- Several pillar-like cover objects appear outside the yellow `C` and `h` authored cover cells. These would mislead the player about available cover.
- The left-side cover cells are not visually represented with enough certainty at their exact authored locations.
- The art introduces scenic detail with tactical meaning in unmarked cells. Any object that looks like cover, a blocker, a climbable element, or a light source must be authored in the grid first.

## Process Finding

Using the placement control plate as the edit source improved macro silhouette control, but the current prompt/process is insufficient. It pushed the model toward a literal textured-grid repaint instead of a coherent landscape constrained by hidden masks.

The process needs two simultaneous constraints:

- The grid controls collision, object footprints, affordances, and altitude.
- The final image must conceal the grid as grid, merging cells into natural terrain surfaces while keeping all tactical boundaries true.

The next art attempt should be prompted even more mechanically:

- Treat every colored diamond as a hard mask.
- Do not leave the control grid visually present as repeated diamond tiles.
- Merge neighboring same-terrain cells into continuous painted terrain masses.
- Make altitude physically readable through cliff faces, occlusion, ledges, and cast shadows.
- Keep the burning tree entirely inside the four orange `1` diamonds.
- Put visible cover only inside yellow diamonds.
- Do not add pillars, stones, trunks, ruins, lanterns, ramps, stairs, holes, or raised lips outside marked cells.
- Preserve blocked voids as empty non-playable darkness.
