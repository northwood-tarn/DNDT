# Module: Ghost Oil

## Contract
- **Purpose**: Define a special lantern oil that confers temporary group invisibility during exploration, integrating with the Lanterna system without introducing full stealth mechanics or invisibility spells.
- **Inputs**: Player inventory (oil charges), Lanterna state (on/off, oil type, remaining burn), party proximity (within 10 ft of lantern bearer), encounter trigger state.
- **Outputs**: Exploration invisibility effect; optional Surprise on combat start; UI prompts and timers.
- **Constraints**: Exploration-only effect. No sustained combat invisibility. Scarce resource (limited bottles across the campaign). Must not circumvent Lanterna’s light economy.
- **Extension**: Additional specialty oils can share the same data schema (e.g., Bright Oil, Smoke Oil).

---

# Ghost Oil (Lanterna Consumable)

*A pallid, alchemical distillate of bone-lime and aether, sometimes called Veil-Oil. When burned, it throws no visible flame—only cold glass-glint—and the living fade from sight.*

## Core Effects
- **Exploration Invisibility (Group):** While the Lanterna burns **Ghost Oil**, all party members **within 10 ft** of the lantern bearer are **Invisible** in exploration contexts.
- **Duration:** **1 minute** (real-time or exploration-time). A visible countdown should tick on the Lanterna HUD. The flame is considered “ghostflame” (no navigational bright/dim light beyond your minimal sprite representation).
- **Scarcity:** Total supply is intentionally low (e.g., 3–6 bottles for the whole game, Act III+).

## Combat Hook (Ambush Only)
- If **combat begins while Ghost Oil is actively burning** *and* the party has not been detected:
  - **Surprise**: Enemies are **Surprised** on **Round 1** (they skip actions/reactions).
  - **Then End the Veil**: Ghost Oil’s invisibility ends immediately at the start of Round 2 (the lantern sputters back to visible light, or the veil lifts). The oil is **consumed** regardless.
- **No Sustained Combat Invis**: There is **no** per-round invisibility benefit once combat is underway. Ghost Oil is exploration-first, ambush-second.

## Behavior & Rules
- **Lanterna Binding**: Ghost Oil can only be used **via the Lanterna** (no pouring on weapons, etc.).
- **Group Radius**: Effect covers **10 ft** around the lantern bearer. Stepping outside the radius breaks the effect for that character until they re-enter the radius.
- **Breaking the Veil**: Loud actions during exploration (e.g., smashing crates, kicking doors) can **trigger detection** and pop a scripted encounter even while Ghost Oil burns.
- **Wisp & Light**: The Wisp cantrip’s momentary glow is too faint to break the veil, but using a standard oil or other bright light will. Ghost Oil itself **does not provide navigational light**.
- **Stacking**: Ghost Oil’s invisibility does **not** stack with spell-based invisibility. If a spell is later added, the stronger/more specific source takes precedence, but Ghost Oil still burns down.
- **Save/Load**: Persist remaining **seconds** and **active/inactive** state across saves.

## UI/UX
- **Lanterna Switcher**: A simple toggle to choose oil type (Standard / Ghost Oil / other). Ghost Oil shows a **veil icon** and a **burn-down timer**.
- **Exploration Icon**: While active, a small **“eye crossed-out”** icon appears near the sprite to indicate group invisibility.
- **Ambush Prompt**: If the player initiates combat while the veil burns, show a brief **“Ambush—Enemies Surprised (1 Round)”** banner.
- **Warning**: Flash a warning when <10 seconds remain: **“Veil thinning…”**

## Narrative Hooks
- **Acquisition**: Rare merchants, reliquaries of the Old Kingdoms, or rewards for clearing necromancer vaults.
- **Lore**: Derived from ossuary resins and phosgene of embalmer-lamps; once used by bone-legates to pass patrols.

## Edge Cases
- **Scripted Encounters**: Ghost Oil lets you bypass some roaming guards or checkpoint triggers, **but not** critical plot gates explicitly flagged as “Unskippable.”
- **Teleport Circles**: The veil carries through a jump if the burn is still active; the timer continues on arrival.
- **Companions**: The effect is purely radius-based; no separate toggles.

---

## Data Schema (Proposed)

Introduce a unified **Oils** data file (e.g., `data/oils.js` or `data/oils.json`) that the Lanterna references. Each oil shares a common shape.

```json
{
  "id": "ghost_oil",
  "name": "Ghost Oil",
  "rarity": "rare",
  "burnSeconds": 60,
  "lanternaLight": { "brightFt": 0, "dimFt": 0 }, 
  "auraRadiusFt": 10,
  "effects": [
    {
      "kind": "exploration_invisibility",
      "group": true,
      "breakOn": ["combat_round_start"]
    },
    {
      "kind": "combat_ambush",
      "surpriseOnStart": true,
      "endsVeilAt": "round_2_start"
    }
  ],
  "ui": { "icon": "veil", "warnAtSeconds": 10 },
  "notes": "No navigational light; scarce; exploration-first."
}
```

> **Why a unified oils file?**
> - **Single source of truth** for all oil behavior and tuning.
> - The Lanterna can simply load `currentOil` and **apply its effects declaratively**—no custom code per oil.
> - Easy to add new oils (e.g., **Bright Oil** for +bright radius, **Smoke Oil** to dim enemy Perception in radius, **Ash Oil** to reduce undead aggro range).

### Alternate Organization
- If you already have a generic **items** system, oils can be **item subtypes** with a `use: "lanterna"` tag, and a `payload` that mirrors the schema above. The Lanterna module then reads the payload at burn-time.
- Keep oil effects **data-driven**, not hard-coded into the Lanterna logic. This avoids one-offs and lets design iterate by editing JSON.

---

## Testing Plan
1. **Exploration**: Toggle Ghost Oil; verify invis icon; walk through a roaming sentry checkpoint—no trigger. Break a crate—encounter triggers as intended.
2. **Ambush**: Light Ghost Oil, walk into an enemy and manually initiate combat. Confirm **Surprised** on Round 1, veil ends on Round 2 start.
3. **Timer**: Let burn hit 0 while idle; confirm veil ends and lantern returns to normal “no light” state.
4. **Save/Load**: Save mid-burn; reload; timer resumes correctly.
5. **Radius**: Step a companion outside 10 ft; they lose invisibility; re-enter to regain it.

---

## Future Levers
- **Veil-Glass Lens** (Lanterna upgrade): +5 ft veil radius (late Act III).
- **Patron Distillate** (very rare): extends Ghost Oil burn to 90 seconds once per day.
- **Watcher Runes**: encounter zones that **negate** the ambush surprise even with Ghost Oil (keeps balance honest).
