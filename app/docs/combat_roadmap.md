
# Combat Roadmap Checklist (Baseline)

> Scope: Full 5e-like combat up to level 14, modular systems-first. Use this file as a living checklist.

## 0. Initiative (do this first)
- [ ] d20 + DEX mod + bonuses
- [ ] Ties (DEX, then stable sort; re-roll optional)
- [ ] Surprise (optional toggle)
- [ ] Advantage/Disadvantage on initiative (e.g., Feral Instinct)
- [ ] Dynamic insert into order (summons, lair actions)

## 1. Action Economy & Turn Frame
- [ ] Track action, bonus action, movement (abstract), reaction
- [ ] Reset reaction at start of turn
- [ ] End-of-turn hooks (conditions/resources)

## 2. Core Actions
- [ ] Melee attack (done v0)
- [ ] Ranged attack (long range disadvantage)
- [ ] Help
- [ ] Dash / Disengage
- [ ] Use Item (potions)
- [ ] Dodge (done v0)

## 3. Damage Model & Defenses
- [ ] Damage types table
- [ ] Resistance / Vulnerability / Immunity
- [ ] Critical hit/auto-miss rules (done v0)
- [ ] AC modifiers (Shield, cover, prone, etc.)

## 4. Conditions v1 (flags)
- [ ] Prone
- [ ] Poisoned
- [ ] Restrained
- [ ] Charmed
- [ ] Frightened

## 5. Saving Throws
- [ ] Spell DC calc
- [ ] Per-ability saves w/ proficiency
- [ ] Half/none on save metadata

## 6. Concentration
- [ ] Attach concentration to effect & caster
- [ ] Con save on damage (DC 10 / half damage)
- [ ] One concentration at a time; new ends old

## 7. Durations & Scheduler
- [ ] Turn scheduler (start/end/every round)
- [ ] Central Condition Manager (apply/remove, stacking, timers)

## 8. Reactions
- [ ] Reaction window engine
- [ ] Opportunity Attack
- [ ] Shield / Absorb Elements
- [ ] Counterspell basic (same level)

## 9. Grapple & Shove
- [ ] Contested checks (Athletics vs Athletics/Acrobatics)
- [ ] Grappled (speed 0), Shove (prone/push)

## 10. Hide/Stealth (lightweight)
- [ ] Hidden state; advantage to attacker / targeting disadvantage
- [ ] Breaks on attack or reveal

## 11. Resources
- [ ] Spell slots
- [ ] Ki / Sorcery points / Channel Divinity / Rage / Bardic dice
- [ ] Short/Long rest recovery (out of combat)

## 12. Class Features (L1–6 core)
- [ ] Fighter: Second Wind, Action Surge, Extra Attack (L5), Indomitable
- [ ] Rogue: Sneak Attack, Cunning Action, Uncanny Dodge, Evasion
- [ ] Barbarian: Rage, Reckless Attack, Danger Sense
- [ ] Paladin: Lay on Hands, Divine Smite, Channel Divinity, Aura of Protection
- [ ] Ranger: Hunter’s Mark, Fighting Style, Extra Attack
- [ ] Monk: Ki core, Flurry/Patient/Step, Stunning Strike, Deflect Missiles
- [ ] Bard: Bardic Inspiration, Cutting Words (Lore)
- [ ] Cleric: Channel Divinity (Turn), Bless/Healing basics
- [ ] Warlock: Hex, Eldritch Blast scaling, key Invocations
- [ ] Sorcerer: Metamagic basics
- [ ] Wizard: Arcane Recovery (OOC), prep/DCs baseline

## 13. Spellcasting L0–L3
- [ ] Targeting: single, self, list-based AoE
- [ ] Cantrips: Fire Bolt, Sacred Flame, Eldritch Blast, Vicious Mockery, Toll the Dead
- [ ] L1: Bless, Cure Wounds, Shield, Absorb Elements, Magic Missile, Hunter’s Mark, Healing Word, Thunderwave
- [ ] L2: Hold Person, Invisibility, Misty Step, Lesser Restoration, Spiritual Weapon, Mirror Image
- [ ] L3: Fireball, Counterspell, Dispel Magic, Hypnotic Pattern, Haste, Slow, Revivify

## 14. Enemy Kit & AI (baseline)
- [ ] Multiattack
- [ ] Simple target selection (focus lowest HP / nearest / random)
- [ ] Scripted encounter specials (cooldowns)

## 15. Advanced Reactions & Interrupts
- [ ] Counterspell up/downcast levels
- [ ] Bardic Inspiration / Cutting Words windows
- [ ] War Caster (spell instead of OA)
- [ ] Sentinel / Polearm Master triggers

## 16. Summons & Companions
- [ ] Conjure/Summon family (entity stats, control, duration)
- [ ] Spiritual Weapon (bonus action, no concentration)

## 17. Auras & Ongoing Areas
- [ ] Spirit Guardians (start-of-turn tick, difficult terrain abstraction)
- [ ] Moonbeam / Sickening Radiance (enter/start rules)
- [ ] Guardian of Faith (sentinel damage)

## 18. Class Features (7–14 highlights)
- [ ] Paladin auras expansions, Improved Divine Smite
- [ ] Rogue Evasion complete, Blindsense
- [ ] Monk Diamond Soul, higher ki options
- [ ] Barbarian Feral Instinct, Brutal Critical
- [ ] Fighter Indomitable scaling, Battlemaster maneuvers
- [ ] Cleric higher domain features
- [ ] Wizard schools (Abjuration ward, Bladesinger baseline)
- [ ] Sorcerer broader Metamagic
- [ ] Warlock Lifedrinker, Chain familiar turn
- [ ] Druid higher CR Wild Shape

## 19. Spells L4–L7 (selected)
- [ ] Banishment, Polymorph, Wall of Fire/Force, Dimension Door, Greater Invisibility, Stoneskin
- [ ] Hold Monster, Synaptic Static, Animate Objects, Wall of Force specifics
- [ ] Globe of Invulnerability, Forcecage, Delayed Blast Fireball, Finger of Death, Summon Fiend/Fey
- [ ] Heroes’ Feast, Heal (combat), Teleportation/Plane Shift (OOC-gated)

## 20. Death & Dying (full)
- [ ] Death saves, stabilize, heal-from-0
- [ ] Massive damage instant death
- [ ] Optional lingering injuries
