# Level Up Manifest

The level-up UI should render a manifest for the current character and target level, not encode class rules directly in the screen.

The manifest can be generated from class, subclass, pact, species, lineage, feat, and spell data when level-up starts. Each entry is a modular choice or grant with a stable id, display text, completion rule, and detail payload.

```json
{
  "characterId": "generated-warlock",
  "fromLevel": 2,
  "toLevel": 3,
  "classId": "warlock",
  "summary": ["Subclass choice", "Pact choice"],
  "steps": [
    {
      "id": "hp",
      "kind": "hp_roll",
      "hitDie": 8,
      "reroll": [1],
      "conModifier": 2,
      "required": true
    },
    {
      "id": "class:warlock:level_3:subclass",
      "kind": "single_choice",
      "label": "Subclass",
      "required": true,
      "optionsSource": "class.subclasses",
      "detailMode": "hover"
    },
    {
      "id": "class:warlock:level_3:pact",
      "kind": "single_choice",
      "label": "Pact",
      "required": true,
      "optionsSource": "class.pacts",
      "detailMode": "hover"
    }
  ],
  "grants": [
    {
      "id": "subclass:warlock:selected:level_3:*",
      "kind": "feature_grant",
      "source": "selected_subclass"
    },
    {
      "id": "pact:warlock:selected:level_3:*",
      "kind": "feature_grant",
      "source": "selected_pact"
    }
  ]
}
```

Expected step kinds:

- `hp_roll`: hit-point increase with house reroll rules.
- `single_choice`: subclass, pact, arcanum, weapon, or one-of feature choice.
- `multi_choice`: spell, cantrip, skill, tool, or device selections.
- `repeated_choice`: repeated picks where duplicates may be legal, such as ASI choosing the same ability twice.
- `feat_or_asi`: advancement level wrapper, with feat subchoices as nested steps.
- `feature_grant`: automatic class, subclass, pact, species, or lineage gain.

Important UI rules:

- The screen should only render steps present in the manifest.
- Completion is computed per step, then rolled up to the Complete button.
- Prepared spell changes should not appear in level-up manifests; they belong to rest/preparation.
- Choice options must remain in source order or alphabetical order and should not jump when selected.
- Details are hover-driven and scrollable.
