# Tutorial & Prologue Flow

## 1. Vision & Goals

To prevent cognitive overload for new players, the game implements a **Guided Progressive Disclosure** flow. Mechanics, UI elements, and screens are unlocked across the first few missions of a new campaign.

## 2. Mission 1: The Prologue (Tactical Basics) (ADR 0057)

The player is thrown directly into a scripted tactical scenario with directed steps.

- **Entry**: Starting a new campaign skips the Sector Map and Equipment Screen entirely. The player immediately enters the Mission 1 Tactical View.
- **The Map**: A prescribed, hardcoded tutorial map (not procedurally generated) to ensure a controlled environment. 7-8 walkable cells: start room, corridor, combat room (with one pre-placed weak enemy), objective room, extraction point. One door between corridor and combat room. A medkit placed between combat and objective rooms.
- **Director Suppression**: The Director MUST NOT spawn additional enemies during the prologue. The only enemy is the one pre-placed on the map.
- **Always-Visible HUD**: The HUD (soldier panel, command buttons, objectives, threat meter) MUST be visible from the start. UI elements are never hidden with `display: none`. Non-relevant elements MAY be dimmed (reduced opacity) but must remain visible.
- **Highlight System**: Relevant UI elements and map cells pulse/glow to direct the player's attention. The highlight is visually distinct (animated border, arrow indicator).
- **Input Gating**: During each tutorial step, only the highlighted action is interactive. Other controls are visible but disabled. This prevents skipping ahead while keeping the full UI visible.
- **Honest Difficulty**: No invulnerability. The tutorial enemy has reduced stats (low HP, low damage, low accuracy) so the soldier wins easily but takes visible damage. If the soldier would die, a scripted rescue occurs (Advisor heals to 50% HP with a narrative message) instead of invisible HP clamping.
- **Scripted Step Sequence**:
  1. **Select unit**: "Click your soldier to select them" (highlight: soldier card). Completes when unit is selected.
  1. **Move**: "Click the highlighted cell to move" (highlight: target cell 2-3 cells ahead). Completes when unit reaches cell.
  1. **Door**: "Your soldier will open the door automatically" (highlight: door). Auto-advances when door opens.
  1. **Combat intro**: "Enemy spotted! Your soldier fires automatically" (highlight: enemy + threat meter). Pauses briefly to explain. Completes when enemy takes damage.
  1. **Survive combat**: Free play until enemy dies.
  1. **Objective**: "Move to the objective to recover it" (highlight: objective cell). Completes when objective collected.
  1. **Extract**: "Move to the extraction zone to complete the mission" (highlight: extraction cell). Completes when unit extracts.
- **Step Engine**: Steps are processed as a sequential state machine (current step index, not condition chains). Only the current step's completion condition is checked each tick. No dependency chains or fragile cross-step checks.

## 3. Mission 2: The Ready Room (Equipment & Roster)

After surviving the prologue, the player returns to the ship.

- **Entry**: The player starts in the **Ready Room (Equipment Screen)**. The Sector Map is still hidden.
- **Explanation**: The Advisor explains the roster, equipment slots, and stats.
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
