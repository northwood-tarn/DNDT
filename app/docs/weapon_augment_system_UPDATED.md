
# Weapon Augment System

## Module Contract
**Location:** docs/weapon_augment_system.md  
**Role:** Systems spec (equipment progression)  
**Calls:** `data/weapons.js`  
**Called By:** `systems/weaponAugmentSystem.js`, `ui/InventoryUI.js`  
**Side Effects:** Updates player equipment in `state.player.equipment`  
**Routing:** no  
**Notes:** Scene-agnostic; augments applied via UI or story events.

---

### Design
- Augments are modifiers to base weapons (damage, crit range, effects).
- Stored in `data/weapons.js` as augment definitions.
- Application handled in `systems/weaponAugmentSystem.js`:
  - `applyAugment(weaponId, augmentId, playerState)` → updated weapon entry.

### Event Flow
- Trigger: loot, vendor, or forge event.  
- System applies augment, updates state.  
- UI layer displays new stats; emits `ui:weaponAugmented` event.
