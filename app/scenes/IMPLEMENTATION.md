# Implementation Checklist (Scenes & Overlays)
_Last updated: 2025-09-26_

Use this to track progress per module. Columns: **Stubbed** (file exists), **Wired** (router can enter), **UI Pass** (visuals), **Content Complete** (logic/data), **Notes**.

> Tip: keep this list authoritative. Avoid marking "UI Pass" until interaction and layout are acceptable in-game.

## Scenes
| Scene | Stubbed | Wired | UI Pass | Content Complete | Notes |
|---|---|---|---|---|---|
| BootScene | [ ] | [ ] | [ ] | [ ] | |
| PreloadScene | [ ] | [ ] | [ ] | [ ] | |
| SplashScene | [ ] | [ ] | [ ] | [ ] | |
| MainMenuScene | [ ] | [ ] | [ ] | [ ] | |
| ProfileSelectScene | [ ] | [ ] | [ ] | [ ] | |
| CharacterSelectScene | [ ] | [ ] | [ ] | [ ] | |
| LoadGameScene | [ ] | [ ] | [ ] | [ ] | |
| SettingsScene | [ ] | [ ] | [ ] | [ ] | |
| CreditsScene | [ ] | [ ] | [ ] | [ ] | |
| SaveErrorScene | [ ] | [ ] | [ ] | [ ] | |
| IntroScene | [ ] | [ ] | [ ] | [ ] | |
| ExplorationScene | [ ] | [ ] | [ ] | [ ] | |
| DialogueScene | [ ] | [ ] | [ ] | [ ] | |
| BattleScene | [ ] | [ ] | [ ] | [ ] | |
| PostBattleRewardsScene | [ ] | [ ] | [ ] | [ ] | |
| LootScene | [ ] | [ ] | [ ] | [ ] | |
| RestScene | [ ] | [ ] | [ ] | [ ] | |
| MerchantScene | [ ] | [ ] | [ ] | [ ] | |
| AreaTransitionScene | [ ] | [ ] | [ ] | [ ] | |
| SystemCutsceneScene | [ ] | [ ] | [ ] | [ ] | |
| FinalBossScene | [ ] | [ ] | [ ] | [ ] | |
| EndingScene | [ ] | [ ] | [ ] | [ ] | |
| GameOverScene | [ ] | [ ] | [ ] | [ ] | |

## Overlays
| Overlay | Stubbed | Wired | UI Pass | Content Complete | Notes |
|---|---|---|---|---|---|
| PauseOverlay | [ ] | [ ] | [ ] | [ ] | |
| LanternaHUDOverlay | [ ] | [ ] | [ ] | [ ] | |
| NotificationOverlay | [ ] | [ ] | [ ] | [ ] | |
| StatusEffectsOverlay | [ ] | [ ] | [ ] | [ ] | |
| TargetInfoOverlay | [ ] | [ ] | [ ] | [ ] | |
| SkillCheckOverlay | [ ] | [ ] | [ ] | [ ] | |
| PromptOverlay | [ ] | [ ] | [ ] | [ ] | |
| JournalOverlay | [ ] | [ ] | [ ] | [ ] | |
| InventoryOverlay | [ ] | [ ] | [ ] | [ ] | |
| CharacterOverlay | [ ] | [ ] | [ ] | [ ] | |
| MapOverlay | [ ] | [ ] | [ ] | [ ] | |

## Routing/Validation
- [ ] `app/data/scenes.flow.json` present and up to date
- [ ] All nodes resolve to importable modules
- [ ] Edges validated at boot (fail fast on missing exports)
- [ ] Overlay stack captures/relinquishes input correctly
- [ ] PauseOverlay suspends scene updates where appropriate

## QA Smoke Paths
- [ ] Boot → MainMenu → CharacterSelect → Intro → Exploration (enter/exit)
- [ ] Exploration ↔ Dialogue
- [ ] Exploration → Battle → PostBattleRewards → Exploration
- [ ] Exploration → Rest → MapOverlay → AreaTransition → Exploration
- [ ] PauseOverlay opens/closes in Exploration & Battle
