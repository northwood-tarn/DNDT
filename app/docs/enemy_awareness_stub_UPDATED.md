
# Enemy Awareness (Stub → Spec)

## Module Contract
**Location:** docs/enemy_awareness_stub.md  
**Role:** Systems spec (`systems/enemyAwareness.js`)  
**Calls:** `data/enemies.js`, `utils/visionUtils.js`  
**Called By:** `systems/combatSystem.js`, `scenes/ExplorationScene.js` (events)  
**Side Effects:** Emits events like `enemy:spotted`, `enemy:alerted`  
**Routing:** no  
**Notes:** Awareness must not route scenes; only emits state/events.

---

### Design Goals
- Determine when enemies detect the player based on vision, hostility, and distance.  
- Awareness model: cone/line-of-sight check using `utils/visionUtils.js`.  
- Enemy stats (`vision`, `hostility`, `visionRange`) live in `data/enemies.js`.  

### Event Flow
- Input: player position, lighting conditions, enemy position/stats.  
- Output events:  
  - `enemy:spotted` (player detected, combat trigger)  
  - `enemy:alerted` (heard noise, partial awareness)

### Next Steps
- Flesh out stub into a full spec with math functions and event emission.  
- Test awareness in both exploration and combat contexts.
