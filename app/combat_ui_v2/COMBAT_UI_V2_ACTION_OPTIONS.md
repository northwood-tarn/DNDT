# Combat UI v2 — Action Options lock

Status: **LOCKED**

This is the canonical reference for the external Action Options workspace and its corresponding expanded middle-combat presentation. Do not modify this implementation unless the user explicitly unlocks this part of Combat UI v2.

## Locked behavior

- The main combat window remains fixed-size and is never resized by external panes.
- External panes use the attached right-side host, may detach, and retain a top-right close control.
- Pointer hover is routed across every visible combat window so descriptions respond without first activating that OS window.
- The attached external host initially matches the main combat window's full height.
- Host tabs share the available width evenly and use subdued embedded pane chrome.
- The Action Options hierarchy is tabs, title, active actor name, Action, then Bonus Action.
- In the large-viewport display schema, the canonical right-hand pane group contains `Equipment` as its active first tab and `Action Options` as its second tab. The two headings divide the available tab area evenly, excluding the dedicated drag grip and shortcut control, and remain independently detachable or regroupable.
- Actor identity, actions, resources, spell slots, weapons, and descriptions come from combat scenario data rather than character-specific UI literals.
- Weapon Sets contains two sets with two icon positions each.
- Action categories are Weapon Sets, Spells, Channel Divinity, Tactics, Abilities, and Consumables where applicable. Prepared Saboteur devices and inventory items are Consumables; permanent class, subclass, species, and lineage powers are Abilities.
- Abilities that choose a device or item open a second-stage choice instead of listing every combined outcome at the top level. This applies to Catastrophic Charge, Quick Rigging, and Double Rig through shared action metadata.
- Parent abilities are the quick-bar assignments. Quick Rigging and Double Rig occupy Bonus Action positions; Catastrophic Charge occupies an Action position and opens its item choice when invoked.
- Quick-bar drops are economy-typed at drag time and at drop time, preventing Action and Bonus Action assignments from crossing slot types. Hovering an assigned slot reveals its name and description in one line across the top of the combat display; staged choices include the selected item in that line.
- Consumable availability comes from actor inventory and resources. Depleted consumables leave Action Options, while an existing quick-bar assignment becomes unavailable and explains that the actor has none left. Catastrophic Charge consumes both its own use and its selected prepared device.
- Weapon attacks may be assigned to Action quickslots directly from equipped weapon and weapon-capable casting-focus tiles as well as from Action Options.
- A staged parent's description applies to its heading and second-stage choices. A parent cannot appear as one of its own choices.
- Character-relative device text resolves proficiency-based durations and dice before it reaches any combat UI.
- Native spells precede a softer indented Upcast group at each casting level.
- Spell-slot pips use the compact laptop UI's square pale green-blue treatment.
- Hover descriptions use a green-fog layout row that physically contracts the scrollable choice viewport; list content cannot sit beneath the description.
- The quick bar contains six Action and four Bonus Action positions and accepts compatible action payloads from the external pane.
- The fixed cog remains in the main middle combat pane and owns External Panes, fullscreen availability, upcasting, and the future Reactions surface.
- Checked panes are external; unchecked panes retain laptop presentation behavior. Fullscreen is available only when all panes are unchecked.

## Locked presentation files

- `app/combat_ui_v2/index.html`
- `app/combat_ui_v2/combatUiV2.css`
- `app/combat_ui_v2/combatUiV2.js`
- `app/combat_ui_v2/action_options.html`
- `app/combat_ui_v2/actionOptions.css`
- `app/combat_ui_v2/actionOptions.js`

Electron window orchestration and shared data/rules code support this presentation but are not locked wholesale by this manifest.

## Reference checksums at lock time

```text
ebee590fb14f4026bac1beb4209629b9c4cbc9c23fb6fdfe2e016a4e22eb4055  app/combat_ui_v2/index.html
abb80c7be63c2515d1032a08ceae95bcdfab64d0900fa9ce7ac4c69ca2e6fd08  app/combat_ui_v2/combatUiV2.css
d03978c0f6c6411ca47f36210575123dce8a855bd2faf4abc1fcdeaffeb9e956  app/combat_ui_v2/combatUiV2.js
de1dbb7f40c25ee680f008aca99ef3b7beca76b5b4a0289af2e7b9c2a1f08953  app/combat_ui_v2/action_options.html
23278e6df682f8b393c3ec5077fc30c8f7379fc859a6154058d5d196f0af2e29  app/combat_ui_v2/actionOptions.css
8f877ad679f76813bc2e02e4835cd80d7ea1b73958854323dd2d3586f83a2631  app/combat_ui_v2/actionOptions.js
```
