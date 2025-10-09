
# Unified Targeting

## Module Contract
**Location:** docs/unified targeting.md  
**Role:** Engine rules spec (AoE targeting)  
**Calls:** none  
**Called By:** `engine/spellShapes.js`, `engine/spellExecutor.js`  
**Side Effects:** Pure math only, no rendering  
**Routing:** no  
**Notes:** Defines unified model for line, cone, radius, single-target. Testable with grid coords.

---

### Design
- All spells resolve targets via one API: `getTargets(shape, origin, params, mapState)`.
- Shapes: **line**, **cone**, **radius**, **single**.  
- Returns: array of grid positions or actor IDs.

### Testing
- Each shape must have test cases with expected coordinates.
- System layer (`systems/combatSystem.js`) consumes results, applies damage/effects.
