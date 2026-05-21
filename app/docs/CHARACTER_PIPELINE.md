# Character Pipeline

This is the DNDT character creation boundary. `charc6` may be used as a reference for content coverage and edge cases, but DNDT owns the contracts below.

## Rule

Raw data and creator UI state do not enter combat directly.

```text
CharacterDraft
  -> resolveCharacterSheet(draft)
ResolvedCharacterSheet
  -> combat actor factory
Combat runtime snapshot
```

## CharacterDraft

`CharacterDraft` is creator state only. It records selected IDs and player choices:

- identity: name, level, background, species, class, subclass
- abilities: selected or assigned ability scores
- choices: background, species, class, feat, proficiency, and spell choices
- gear: selected weapons, armor, shield, inventory, attuned items
- spells: known and prepared spell IDs

It must not calculate derived mechanics.

## ResolvedCharacterSheet

`ResolvedCharacterSheet` is the authoritative output of character creation. It contains:

- identity labels and IDs
- ability scores and modifiers
- proficiency bonus
- proficiencies
- combat basics
- durability
- attacks
- resources
- features
- spellcasting
- equipment
- unresolved metadata

Publishing and combat consume this shape. They do not derive character mechanics from draft state.

## Resolver Shape

`resolveCharacterSheet(draft)` is a pure projection from draft plus canonical data registries into a resolved sheet.

The resolver should grow in layers:

1. Identity and ability scores
2. Background grants
3. Species and lineage grants
4. Class and subclass progression
5. Feats
6. Gear
7. Spellcasting
8. Combat actor bridge

Unsupported data is recorded in `metadata.unresolved`. It is not silently ignored and not faked.

## Import Protocol

When drawing from `charc6`:

1. Define the DNDT contract first.
2. Extract only the useful content.
3. Normalize into DNDT IDs and shapes.
4. Validate immediately.
5. Do not import `charc6` resolver/UI code.
6. Do not add one-off mechanics for awkward records.
