# ADR 0058: Tutorial Redesign - Observe Then Command

## Status

Proposed

## Context

### The Problem with ADR 0057

ADR 0057 correctly identified that the old tutorial was broken (hidden HUD, invulnerability, no direction). However, the replacement tutorial it designed was based on an **incorrect interaction model**.

ADR 0057's step sequence begins with "Click your soldier to select them" followed by "Click the highlighted cell to move." This describes an RTS-style select-and-click interaction (StarCraft, XCOM). **Voidlock does not work this way.**

Per `docs/spec/commands.md` Section 7.0:

> There is **no** persistent "currently selected soldier" state on the map. Any command that applies to one or more units must pass through **Unit Select** before execution.

Voidlock uses a **hierarchical menu-driven command system**:

1. Action Select (Orders / Engagement / Use Item / Pickup / Extract)
2. Sub-action (Move To Room / Overwatch / Explore / Hold / etc.)
3. Target Select (pick a room, intersection, or item on the map)
4. Unit Select (pick which soldiers execute the command)

Additionally, soldiers are **autonomous by default**:

- At mission start, all units automatically receive an `EXPLORE` command (spec Section 4.2)
- Soldiers auto-navigate fog of war, open doors, and engage enemies on sight
- The player's role is **strategic intervention** -- redirecting soldiers, changing engagement policy, using items, and ordering extraction

The ADR 0057 tutorial teaches a non-existent interaction model, creating an impossible-to-complete scenario for new players. The implementing agent faithfully coded the ADR's step sequence without questioning whether the described interaction actually works.

### What Actually Needs Teaching

After playing through custom missions, the actual learning curve for a new player is:

1. **Observation**: Soldiers move and fight on their own. The player needs to understand this before touching anything.
2. **UI Layout**: Where to find squad status, commands, objectives, and threat info.
3. **Simple intervention**: Changing engagement policy (2 keypresses, simplest command).
4. **Full command flow**: Navigating the menu hierarchy to issue a Move order.
5. **Objective mechanics**: Pickup and Extract.

### What ADR 0057 Got Right

These elements from ADR 0057 remain valid and are preserved:

- Always-visible HUD (never hide controls)
- Highlight system (pulse/glow on relevant elements)
- Input gating (restrict to highlighted action per step)
- Honest difficulty (no invulnerability, scripted rescue if needed)
- Director suppression (no random spawns)
- Sequential state machine step engine
- Hardcoded tutorial map
- Progressive disclosure across missions 2-3

## Decision

### Core Principle: Observe, Then Intervene

The tutorial teaches by letting the player **watch the game play itself**, then gradually introducing commands from simplest to most complex.

### 1. Prologue Map (Revised)

Linear layout optimized for the observe-then-command flow:

```
[Start Room] -> [Corridor] -> [Door] -> [Combat Room] -> [Medkit] -> [Objective Room] -> [Extraction]
```

- 7-8 walkable cells total
- Single soldier (eliminates Unit Select complexity -- auto-selects the only unit)
- One door between corridor and combat room
- One weak pre-placed enemy (20 HP, 5 damage, 30% accuracy) in combat room
- One data disk objective in objective room
- One medkit between combat and objective rooms
- Extraction point at the end

### 2. Desktop Step Sequence

| # | Phase | Directive | Highlight | Completion | Gated Input |
|---|-------|-----------|-----------|------------|-------------|
| 1 | Observe | "Your soldier explores autonomously. Watch them move." | Soldier card status text | Soldier moves 2+ cells | None (watch) |
| 2 | UI Tour | "This is your squad [highlight]. Commands [highlight]. Objectives [highlight]." | Flash: soldier panel, command menu, objectives | Auto-advance 5s or Continue | None (watch) |
| 3 | Doors | "Doors open automatically when your soldier approaches." | Door cell | Door opens | None (watch) |
| 4 | Combat | "Hostile contact! Your soldier engages automatically." | Enemy + threat meter | Enemy takes damage | None (watch) |
| 5 | Engagement: Ignore | "Try changing fire policy. Press [2] Engagement, then [2] Ignore." | Command menu "2. Engagement" | Engagement set to Ignore | SET_ENGAGEMENT |
| 6 | Engagement: Re-engage | "Your soldier stopped firing. Press [2] then [1] to re-engage." | Command menu "2. Engagement" | Engagement set to Engage AND enemy dies | SET_ENGAGEMENT |
| 7 | Move command | "Direct your soldier to the objective. Press [1] Orders, [1] Move To Room, select the Objective room, confirm." | Each menu level highlighted as player progresses; objective room on map | Soldier reaches objective room | MOVE_TO + nav |
| 8 | Pickup | "Recover the data disk. Press [4] Pickup, select the objective." | "4. Pickup" + objective icon | Objective collected | PICKUP |
| 9 | Extract | "Mission complete. Press [5] Extract, confirm." | "5. Extract" + extraction zone | Soldier extracts | EXTRACT |

**Step 7 detail**: The highlight system must track the player's position in the menu hierarchy and highlight the next expected input. When the player presses [1] (Orders), the highlight moves to "1. Move To Room" in the Orders submenu. When they press [1] again, the highlight moves to the objective room on the map. When they select the room, the highlight moves to the soldier in Unit Select. This "follow-along" highlighting is critical for teaching the multi-step menu flow.

### 3. Mobile Step Sequence (Differences)

Mobile replaces keyboard references with tap instructions and adds mobile-specific steps:

| # | Phase | Directive (Mobile) | Notes |
|---|-------|--------------------|-------|
| 1 | Observe | "Your soldier explores autonomously. Watch them move." | Same |
| 2 | UI Tour | "Tap 'Squad' to see your soldiers. Tap 'Objectives' for mission goals." | Teaches drawer toggles |
| 2b | Pause | "Tap Pause to freeze the action while you plan." | Mobile-specific: teaches pause |
| 3-4 | Doors/Combat | Same as desktop | Same |
| 5-6 | Engagement | "Tap 'Engagement' in the command panel, then tap 'Ignore'." | Tap instead of press |
| 7 | Move | "Tap 'Orders', then 'Move To Room', select the Objective room, confirm." | Tap instead of press |
| 8-9 | Pickup/Extract | Same pattern with tap | Same |

### 4. Advisor Messages

Each step with `blocking: true` pauses the game and shows a narrative advisor message:

- **Step 1** (mission start): "Commander, the Voidlock is failing. Your squad has been deployed with standing orders to explore and secure the area. Watch your soldier's progress on the tactical display."
- **Step 4** (combat): "Hostile contact! Your soldiers engage automatically when enemies enter their weapon range. The threat meter shows current swarm activity."
- **Step 5** (first command): "Time to take command. The right panel shows available actions. Each command is issued through the menu -- select an action, choose a target, then assign soldiers."
- **Step 7** (move): "Good. The objective terminal is in a room ahead. Use the Orders menu to direct your soldier there. The map shows room labels when you enter Move To Room."
- **Step 9** (extract): "Data secured. All units must reach the extraction zone to complete the mission. The extraction point is marked on the map."

### 5. Input Gating (Revised)

The gating model from ADR 0057 is preserved but the allowed actions are corrected:

- Steps 1-4: **No player input allowed.** The game plays itself. Menu is visible but all options disabled.
- Step 5-6: Only `SET_ENGAGEMENT` and menu navigation (number keys, Q/ESC for back) are enabled.
- Step 7: Only `MOVE_TO` and full menu navigation are enabled. Other action types (Engagement, Use Item, Pickup, Extract) are disabled.
- Step 8: Only `PICKUP` and menu navigation enabled.
- Step 9: Only `EXTRACT` and menu navigation enabled.

### 6. Single-Soldier Simplification

The prologue uses exactly one soldier. This means:

- Unit Select always has exactly one option (the soldier) plus "Back"
- The tutorial can say "confirm your soldier" without explaining multi-select
- No confusion about which unit receives the command
- Slot 2-4 restriction stays in place (carried over from current campaign setup)

Mission 2 (Ready Room) introduces the second soldier slot. Mission 3+ introduces full squad management.

### 7. Keyboard-First Messaging

Desktop directives always reference keyboard keys: "Press [1]", "Press [2]", "Press [Q] to go back". The tutorial never says "click" for menu actions on desktop. Map interactions (target select) may mention "click the room or press its number."

Mobile directives say "Tap" instead of "Press."

The platform is detected at tutorial start and the appropriate directive set is loaded.

## Alternatives Considered

### Teach click-to-move as an alternative input method

Could add a click-to-move shortcut that bypasses the menu. Rejected because: (1) it doesn't exist in the game and would need engine changes, (2) it would teach a shortcut instead of the actual command system, (3) the menu system IS the game's identity.

### Skip tutorial, use contextual tooltips on first encounter

Rejected (same as ADR 0057): tooltips don't provide the controlled "safe first encounter."

### Start with the Move command instead of Engagement

Rejected because Move requires 4 keypresses and target/unit selection, while Engagement requires only 2 keypresses. Starting with the simplest command builds confidence. Additionally, the player needs to see combat first (steps 3-4) to understand WHY engagement policy matters.

## Consequences

### Positive

- Tutorial teaches the actual game mechanics, not a fictional interaction model
- Observation phase prevents "what do I do?" paralysis
- Commands taught in order of complexity (2 keys -> 4 keys -> contextual)
- Keyboard-first messaging matches the game's design philosophy
- Mobile variant teaches mobile-specific interactions (drawers, tap targets)
- Single-soldier simplification removes Unit Select confusion

### Negative

- Steps 1-4 are passive (no player input). Some players may find this boring. Mitigated by keeping the observe phase under 30 seconds.
- "Follow-along" highlighting for step 7 (Move command) requires tracking menu state in the tutorial engine, which is more complex than static highlights.
- Platform-specific directive sets require maintaining two sets of text strings.

### Migration

- ADR 0057 is superseded for the step sequence. Its infrastructure (highlight system, input gating, step engine, always-visible HUD) is preserved.
- TutorialManager.ts prologueSteps array must be completely rewritten.
- Tutorial spec (docs/spec/tutorial.md) must be updated to match.
- The existing input gating integration in MenuController.ts is reusable but the allowed action sets change.

## Implementation Scope

**Task 1: Update tutorial spec and ADR**

- docs/spec/tutorial.md (rewrite step sequence, add mobile variant)
- This ADR (accepted)

**Task 2: Rewrite prologue step definitions**

- TutorialManager.ts: Replace prologueSteps array with observe-then-command sequence
- New condition functions for passive steps (unit moved, door opened, enemy damaged)
- Platform detection for desktop vs mobile directives

**Task 3: Follow-along menu highlighting for Move command**

- TutorialManager.ts: Track menu state transitions during step 7
- Highlight system: support highlighting menu items by data attribute (not just CSS selector)
- MenuController.ts: Expose current menu state for tutorial tracking

**Task 4: Mobile tutorial variant**

- TutorialManager.ts: Platform-specific directive text
- Mobile-specific steps (drawer toggles, pause control)
- Touch-friendly highlight targets

**Task 5: Tutorial map revision (if needed)**

- Verify existing prologue map layout works with observe-then-command flow
- Ensure corridor is long enough for step 1 (observation) before reaching the door

**Task 6: Regression tests**

- Step sequencing tests (desktop and mobile paths)
- Input gating verification (passive steps block all input, active steps allow only gated actions)
- Menu state tracking for follow-along highlights

## References

- ADR 0057: Tutorial Redesign (superseded for step sequence, infrastructure preserved)
- ADR 0042: Tutorial System - The Prologue (original design, superseded)
- ADR 0049: Guided Progressive Disclosure (Mission 2/3 flow, still valid)
- `docs/spec/commands.md` Section 7.0-7.1 (authoritative command interaction model)
- `docs/spec/tutorial.md` (spec to be updated alongside this ADR)
