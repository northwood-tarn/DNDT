
# Events Registry (DNDT)

**Purpose:** A single source of truth for game-wide events: names, payloads, emitters, listeners.  
**Policy:** Scenes & systems emit events; **only `flow/`** decides routing (calls `sceneManager.replace(...)`).  
**Naming:** `namespace:eventName` (lowercase, kebab or camel words joined by colon).

---

## Global Loop
- **`game:tick`**  
  **Payload:** `{ dt: number, now: DOMHighResTimeStamp }`  
  **Emitted by:** `engine/loop.js` (fixed 60Hz)  
  **Listened by:** any animating system (fog, particles, timers) and scenes via `gameLoop.onTick` or `addEventListener`.  
  **Notes:** Do not start your own RAF; subscribe to this.

---

## Boot & App
- **`app:booted`**  
  Payload: `{ version?: string }`  
  Emitted by: `boot/start.js` after initialisation  
  Listeners: telemetry/log, debug overlay

- **`app:error`**  
  Payload: `{ where: string, error: any }`  
  Emitted by: any module catching non-fatal errors  
  Listeners: debug overlay, logger

---

## Flow & Routing (the only layer that changes scenes)
- **`game:exit`**  
  Payload (one of):  
  - `{ toArea: string, entryX?: number, entryY?: number }`  
  - `{ toScene: "combat", encounter?: string, enemies?: any[], returnAreaId?: string }`  
  - `{ toScene: "dialogue", dialog?: string | object }`  
  Emitted by: scenes/systems (Exploration, Dialogue)  
  Listeners: `flow/ExitRouter` → performs routing

- **`game:postCombatOutcome`**  
  Payload: `{ outcome: "victory" | "defeat" | "retreat", encounterId?: string, returnAreaId?: string }`  
  Emitted by: `flow/PostCombatResolver` (after results calculated)  
  Listeners: `flow/ExitRouter` → returns to exploration on victory; defeat handled by modal

- **`game:encounterWon`**  
  Payload: `{ encounterId: string }`  
  Emitted by: `flow/PostCombatResolver` on victory  
  Listeners: reward/XP systems

---

## Exploration
- **`explore:enteredArea`**  
  Payload: `{ areaId: string }`  
  Emitted by: `scenes/ExplorationScene` when map is live  
  Listeners: music controller, ambient FX, quest triggers

- **`explore:interact`**  
  Payload: `{ targetId: string, action: string, pos?: {x:number,y:number} }`  
  Emitted by: input handlers / interaction raycasts  
  Listeners: dialogue/loot systems

---

## Dialogue
- **`dialog:started`**  
  Payload: `{ scriptId: string }`  
  Emitted by: `systems/dialogueSystem`  
  Listeners: UI, music

- **`dialog:choice`**  
  Payload: `{ choiceId: string }`  
  Emitted by: UI on user selection  
  Listeners: `systems/dialogueSystem`

- **`dialog:ended`**  
  Payload: `{ outcome?: any }`  
  Emitted by: `systems/dialogueSystem`  
  Listeners: `flow/ExitRouter` (may emit `game:exit` for combat/area)

---

## Combat
- **`combat:started`**  
  Payload: `{ encounterId: string }`  
  Emitted by: `flow/ExitRouter` after scene swap to Combat  
  Listeners: music controller, UI

- **`combat:turnBegan`**  
  Payload: `{ actorId: string, round: number }`  
  Emitted by: `systems/combatSystem`  
  Listeners: UI turn highlight, AI

- **`combat:turnEnded`**  
  Payload: `{ actorId: string, round: number }`  
  Emitted by: `systems/combatSystem`  
  Listeners: log, triggers

- **`combat:ended`**  
  Payload: `{ outcome: "victory"|"defeat"|"retreat", encounterId?: string, returnAreaId?: string }`  
  Emitted by: `systems/combatSystem`/resolver after detection  
  Listeners: `flow/PostCombatResolver` (which emits `game:postCombatOutcome`)

---

## Enemy Awareness
- **`enemy:spotted`**  
  Payload: `{ enemyId: string, playerPos: {x,y}, reason: "vision"|"sound" }`  
  Emitted by: `systems/enemyAwareness`  
  Listeners: exploration/combat triggers (may emit `game:exit` to combat)

- **`enemy:alerted`**  
  Payload: `{ enemyId: string, level: "low"|"high", cause: string }`  
  Emitted by: `systems/enemyAwareness`  
  Listeners: UI pings, AI state

---

## UI & Modals
- **`ui:open` / `ui:close`**  
  Payload: `{ id: string }`  
  Emitted by: UI components  
  Listeners: input manager, pause manager

- **`ui:loadGame` / `ui:mainMenu`**  
  Payload: `{ source?: string }`  
  Emitted by: `ui/DefeatModal` and others  
  Listeners: `flow/ExitRouter` (may route to Title), save system

---

## Audio & FX
- **`fx:request`**  
  Payload: `{ type: "fog"|"rain"|"flash", params: object }`  
  Emitted by: systems/scenes  
  Listeners: `renderer/fxLayer`

- **`music:set`**  
  Payload: `{ cue: string }`  
  Emitted by: scenes/systems  
  Listeners: audio controller

---

## Debug & Telemetry
- **`debug:log`**  
  Payload: `{ tag: string, msg: string }`  
  Emitted by: any module  
  Listeners: debug overlay, console

- **`debug:stats`**  
  Payload: `{ key: string, value: number }`  
  Emitted by: loops/systems  
  Listeners: debug overlay

---

## Conventions
1. **Emitters don’t route.** Emit events; `flow/` decides scene transitions.  
2. **Payloads are plain objects** (serializable).  
3. **Remove listeners in `cleanup()`.** Scenes/systems must unhook on exit to avoid leaks.  
4. **Versioning:** add minor versions with `event@v2` if payloads change incompatibly. Keep a short “Deprecated” section below.

---

## Deprecated
*(empty)*

---

## Renderer (Map/UI)

- **`map:hover`**  
  Payload: `{ x: number, y: number, tileId?: string }`  
  Emitted by: `renderer/domMapRenderer.js` (on hover)  
  Listeners: tooltip system, debug overlay
