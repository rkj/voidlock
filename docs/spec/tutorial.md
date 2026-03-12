# Tutorial & Prologue Flow

## 1. Vision & Goals

To prevent cognitive overload for new players, the game implements a **Guided Progressive Disclosure** flow. Mechanics, UI elements, and screens are unlocked across the first few missions of a new campaign.

The tutorial teaches by letting the player **observe the game playing itself**, then gradually introducing commands from simplest to most complex. This matches the game's design: soldiers are autonomous, and the player's role is strategic intervention.

## 2. Mission 1: The Prologue (Tactical Basics) (ADR 0058)

The player is thrown directly into a scripted tactical scenario. The first several steps are **passive observation** -- the player watches their soldier auto-explore, open doors, and fight. Then the tutorial introduces commands in order of complexity.

### 2.1 Entry & Setup

- **Entry**: Starting a new campaign skips the Sector Map and Equipment Screen entirely. The player immediately enters the Mission 1 Tactical View.
- **Single Soldier**: The prologue deploys exactly one soldier. This eliminates Unit Select complexity (auto-selects the only unit). Slots 2-4 are restricted.
- **The Map**: A prescribed, hardcoded tutorial map (not procedurally generated). Linear layout: Start Room -> Corridor -> Door -> Combat Room -> Medkit -> Objective Room -> Extraction. 7-8 walkable cells total.
- **Director Suppression**: The Director MUST NOT spawn additional enemies during the prologue. The only enemy is the one pre-placed on the map.

### 2.2 HUD & Highlight System

- **Always-Visible HUD**: The HUD (soldier panel, command buttons, objectives, threat meter) MUST be visible from the start. UI elements are never hidden with `display: none`. Non-relevant elements MAY be dimmed (reduced opacity) but must remain visible.
- **Highlight System**: Relevant UI elements and map cells pulse/glow to direct the player's attention. The highlight is visually distinct (animated border, arrow indicator).
- **Follow-Along Highlighting**: During multi-step menu commands (e.g., Move To Room), the highlight tracks the player's position in the menu hierarchy and moves to the next expected input.

### 2.3 Input Gating

During each tutorial step, only the relevant action is interactive. Other controls are visible but disabled. This prevents skipping ahead while keeping the full UI visible.

- **Passive steps** (1-4): ALL player input is blocked. The game plays itself.
- **Active steps** (5+): Only the gated command type and menu navigation keys (number keys, Q/ESC) are enabled. Other action types are disabled.

### 2.4 Honest Difficulty

No invulnerability. The tutorial enemy has reduced stats (20 HP, 5 damage, 30% accuracy) so the soldier wins easily but takes visible damage. If the soldier would die, a scripted rescue occurs (Advisor heals to 50% HP with a narrative message) instead of invisible HP clamping.

### 2.5 Scripted Step Sequence (Desktop)

| # | Phase | Directive | Highlight | Completion Condition | Gated Input |
|---|-------|-----------|-----------|---------------------|-------------|
| 1 | Observe | "Your soldier explores autonomously. Watch them move." | Soldier card status text | Soldier moves 2+ cells from start | None (passive) |
| 2 | UI Tour | "This is your squad. Commands are issued from the right panel. Objectives are tracked below." | Flash: soldier panel -> command menu -> objectives | Auto-advance after 5s or Continue | None (passive) |
| 3 | Doors | "Doors open automatically when your soldier approaches." | Door cell | Door state changes to Open | None (passive) |
| 4 | Combat | "Hostile contact! Your soldier engages automatically." | Enemy + threat meter | Enemy takes damage | None (passive) |
| 5 | Engagement: Ignore | "Try changing fire policy. Press [2] Engagement, then [2] Ignore." | "2. Engagement" in command menu | Engagement policy set to Ignore | SET_ENGAGEMENT |
| 6 | Engagement: Re-engage | "Your soldier stopped firing. Press [2] then [1] to re-engage." | "2. Engagement" in command menu | Engagement set to Engage AND enemy dies | SET_ENGAGEMENT |
| 7 | Move | "Direct your soldier to the objective. Press [1] Orders, [1] Move To Room, select the Objective room, confirm." | Follow-along: each menu level as player progresses; objective room on map | Soldier reaches objective room | MOVE_TO + navigation |
| 8 | Pickup | "Recover the data disk. Press [4] Pickup, select the objective." | "4. Pickup" + objective icon | Objective collected | PICKUP |
| 9 | Extract | "Mission complete. Press [5] Extract, confirm." | "5. Extract" + extraction zone | Soldier extracts (mission Won) | EXTRACT |

### 2.6 Scripted Step Sequence (Mobile)

Mobile replaces keyboard references with tap instructions and adds mobile-specific steps:

| # | Phase | Directive | Notes |
|---|-------|-----------|-------|
| 1 | Observe | "Your soldier explores autonomously. Watch them move." | Same as desktop |
| 2 | UI Tour | "Tap 'Squad' to see your soldiers. Tap 'Objectives' for mission goals." | Teaches drawer toggles |
| 2b | Pause | "Tap Pause to freeze the action while you plan." | Mobile-specific step |
| 3 | Doors | Same | Same |
| 4 | Combat | Same | Same |
| 5 | Engagement: Ignore | "Tap 'Engagement' in the command panel, then tap 'Ignore'." | Tap instead of press |
| 6 | Engagement: Re-engage | "Tap 'Engagement' then 'Engage' to resume firing." | Tap instead of press |
| 7 | Move | "Tap 'Orders', then 'Move To Room', select the Objective room, confirm." | Tap instead of press |
| 8 | Pickup | "Tap 'Pickup', select the objective." | Tap instead of press |
| 9 | Extract | "Tap 'Extract', confirm." | Tap instead of press |

### 2.7 Advisor Messages

Blocking advisor messages pause the game at narrative beats:

- **Step 1** (mission start): "Commander, the Voidlock is failing. Your squad has been deployed with standing orders to explore and secure the area. Watch your soldier's progress on the tactical display."
- **Step 4** (combat): "Hostile contact! Your soldiers engage automatically when enemies enter their weapon range. The threat meter shows current swarm activity."
- **Step 5** (first command): "Time to take command. The right panel shows available actions. Each command is issued through the menu -- select an action, choose a target, then assign soldiers."
- **Step 7** (move): "The objective terminal is in a room ahead. Use the Orders menu to direct your soldier there. The map shows room labels when you enter Move To Room."
- **Step 9** (extract): "Data secured. All units must reach the extraction zone to complete the mission."

### 2.8 Step Engine

Steps are processed as a sequential state machine (current step index). Only the current step's completion condition is checked each tick. No dependency chains or fragile cross-step checks.

Platform is detected at tutorial start. The appropriate directive text set (desktop or mobile) is loaded. The step engine and completion conditions are identical across platforms.

## 3. Mission 2: The Ready Room (Equipment & Roster)

After surviving the prologue, the player returns to the ship.

- **Entry**: The player starts in the **Ready Room (Equipment Screen)**. The Sector Map is still hidden.
- **Explanation**: The Advisor explains the roster, equipment slots, and stats.
- **Second Soldier**: Slot 2 is unlocked. The player can now deploy two soldiers.
- **Lockdown**:
  - Non-essential tabs in the `CampaignShell` (Engineering, Statistics, Settings) are DISABLED or HIDDEN.
  - The Equipment Store is LOCKED.
  - The squad is pre-filled with the surviving soldier(s) from Mission 1.
- **Launch**: The primary action button is "Launch Mission", sending the player to Mission 2 (a simple generated map).

## 4. Mission 3: The Sector Map (Campaign Navigation)

After Mission 2, the strategic layer is introduced.

- **Entry**: The player starts at the **Sector Map**.
- **Explanation**: The Advisor explains node types, paths, and campaign progression.
- **Unlocking**:
  - The Sector Map is fully interactive.
  - Basic Squad Selection is unlocked.
  - The Equipment Store is unlocked in Supply Depot nodes.

## 5. Mission 5+: Advanced Systems

- **Unlocking**: Advanced Mission Setup and the Engineering Bay (meta-progression) are unlocked.
