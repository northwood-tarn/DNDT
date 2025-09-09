
# Single-Player Combat Roadmap (Ordered by Difficulty)

> Scope: Single-player only. Re-ordered to prioritize features with single-player value. Excludes or postpones features that rely on PvP/party coordination or synchronous timing.

## Implementation Order
1. Initiative (standardized)
2. Action Economy, Damage Types, Conditions v1
3. Saving Throws + Concentration + Duration Scheduler
4. Reactions (Shield/Absorb/Opportunity) — simple queue
5. Grapple/Shove, Hide/Stealth (lightweight)
6. Resources + L0–L3 Spells + Core Class Features (L1–6)
7. Advanced Reactions (Counterspell levels, Bardic windows), Feat Triggers (Sentinel, PAM, GWM/Sharpshooter toggles)
8. Summons/Companions + Auras/Ongoing Areas
9. Class Features 7–14 + L4–L7 spells (selected)
10. Death & Dying full

## Detailed Checklist

### 0. Initiative
- [ ] d20 + DEX; ties by DEX/name; surprise optional
- [ ] Advantage/bonus hooks; summon insert next round

### 1. Turn & Actions
- [ ] Track action/bonus/reaction; reset windows
- [ ] Melee, Ranged, Help, Dash, Disengage, Use Item, Dodge

### 2. Damage/Defense
- [ ] Types + resistance/vuln/immune
- [ ] AC modifiers (prone, cover-lite)
- [ ] Crit/auto-miss

### 3. Conditions v1
- [ ] Prone, Poisoned, Restrained, Charmed, Frightened

### 4. Saving Throws
- [ ] DC calc; prof flags; half/none logic

### 5. Concentration & Duration
- [ ] Con save on damage; one-at-a-time
- [ ] Condition Manager + scheduler

### 6. Reactions (core)
- [ ] OA
- [ ] Shield / Absorb Elements
- [ ] Simple reaction queue (no multi-controller arbitration)

### 7. Grapple/Shove
- [ ] Contested checks; grappled/shoved states

### 8. Hide/Stealth (SP)
- [ ] Hidden toggle; reveal on attack; simple perception gate

### 9. Resources
- [ ] Spell slots / ki / sorcery / channel / rage / bardic
- [ ] Rest recovery (menu/OOC)

### 10. Class Features (L1–6)
- [ ] Fighter: Second Wind, Action Surge, Extra Attack (5), Indomitable
- [ ] Rogue: Sneak Attack (ally-in-5ft relaxed rule option), Cunning Action, Uncanny Dodge, Evasion
- [ ] Barbarian: Rage, Reckless, Danger Sense
- [ ] Paladin: Lay on Hands, Divine Smite prompt, Aura of Protection
- [ ] Ranger: Hunter’s Mark, Fighting Style, Extra Attack
- [ ] Monk: Ki core, Flurry/Patient/Step, Stunning Strike, Deflect Missiles
- [ ] Bard: Bardic Inspiration (self/ally surrogate), Cutting Words (vs enemy only)
- [ ] Cleric: Channel Divinity, Bless/Healing
- [ ] Warlock: Hex, EB scaling + Invocations
- [ ] Sorcerer: Metamagic basics (Empowered/Quickened/Twinned gating)
- [ ] Wizard: Prep/DCs baseline

### 11. Spells (L0–L3)
- [ ] Cantrips: Fire Bolt, Sacred Flame, Eldritch Blast (beams), Vicious Mockery, Toll the Dead
- [ ] L1: Bless, Cure Wounds, Shield, Absorb Elements, Magic Missile, Hunter’s Mark, Healing Word, Thunderwave
- [ ] L2: Hold Person, Invisibility, Misty Step, Lesser Restoration, Spiritual Weapon, Mirror Image
- [ ] L3: Fireball, Counterspell, Dispel Magic, Hypnotic Pattern, Haste, Slow, Revivify

### 12. Advanced Reactions & Feats
- [ ] Counterspell up/downcast
- [ ] Bardic reaction windows
- [ ] War Caster; Sentinel; Polearm Master; GWM/Sharpshooter toggles; Defensive Duelist; Lucky

### 13. Summons & Companions
- [ ] Conjure/Summon family; Spiritual Weapon entity
- [ ] Initiative insert; player-controlled

### 14. Auras & Areas
- [ ] Spirit Guardians, Moonbeam/Sickening Radiance; Guardian of Faith

### 15. Class Features (7–14) & Spells (4–7)
- [ ] Paladin: Improved Divine Smite; Aura expansions
- [ ] Rogue: Evasion complete; Blindsense
- [ ] Monk: Diamond Soul
- [ ] Barbarian: Feral Instinct, Brutal Critical
- [ ] Fighter: Indomitable scaling; Battlemaster maneuvers
- [ ] Cleric: domain features
- [ ] Wizard: Abjuration ward; Bladesinger
- [ ] Sorcerer: broader metamagic
- [ ] Warlock: Lifedrinker, Chain familiar turn
- [ ] Druid: higher CR Wild Shape
- [ ] Spells: Banishment, Polymorph, Wall of Force/Fire, Greater Invisibility, Stoneskin, Hold Monster, Synaptic Static, Animate Objects, Globe of Invulnerability, Forcecage, Delayed Blast Fireball, Finger of Death, Summon Fiend/Fey, Heroes’ Feast, Heal

### 16. Death & Dying
- [ ] Death saves/stabilize/heal-from-0; massive damage rule

## Features Pointless or Reduced Value in Single-Player
- **Multicontroller arbitration** (multiple human players picking reactions simultaneously)
- **Network sync/rollback** (no netcode)
- **Party chat/ready checks**
- **Simultaneous initiative** (side-by-side simultaneous decisions)
- **GM-facing tools for live adjudication** (we’re scripting encounters)
- **PvP logic (hostile PCs)**
- **Out-of-turn UI messaging to *other* players**

### Implementation Order for “Pointless in SP” (kept only if ever needed)
1. (skip) Network sync
2. (skip) Multi-controller reaction arbitration
3. (skip) PvP rules
4. (optional) GM live tools for debugging single-player AI only
