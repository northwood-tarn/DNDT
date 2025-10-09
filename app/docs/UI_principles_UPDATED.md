
# UI Principles

## Module Contract
**Location:** docs/UI principles.md  
**Role:** Guidance (UI layer design policy)  
**Calls:** n/a  
**Called By:** All UI modules (`ui/*.js`, scene overlays)  
**Side Effects:** Establishes consistency rules for narrative overlays, choice menus, hotkeys  
**Routing:** no (UI must never change scenes directly)  
**Notes:** Aligns with `PROJECT_STRUCTURE.md`. UI is scene-local; navigation lives in `flow/`.

---

### Core Principles
- Narrative prose overlays should be **left-aligned**, max width ~70 characters, semi-opaque backdrop for readability.
- Choices stack vertically beneath prose; each choice has a hotkey binding displayed in the left gutter.
- Scene text must not fight with centered UI—center only titles or breadcrumbs.
- Use consistent typographic grid (4/8/12 spacing units).

### Color & Layout
- UI should differentiate sources (lantern flame menus vs left/right icons) via complementary colors (teal/violet/amber).
- Overlay text uses fixed max width with soft vignette.

### Integration Notes
- All UI components emit events (`ui:choice`, `ui:close`, etc.).  
- Scenes subscribe; `flow/` decides routing.
