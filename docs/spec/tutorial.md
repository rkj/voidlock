# Tutorial & Prologue Flow

## 1. Vision & Goals
To prevent cognitive overload for new players, the game implements a **Guided Progressive Disclosure** flow. Mechanics, UI elements, and screens are unlocked across the first few missions of a new campaign. 

## 2. Mission 1: The Prologue (Tactical Basics)
The player is thrown directly into a prescribed tactical scenario.

- **Entry**: Starting a new campaign skips the Sector Map and Equipment Screen entirely. The player immediately enters the Mission 1 Tactical View.
- **The Map**: A prescribed, hardcoded tutorial map (not procedurally generated) to ensure a controlled environment.
- **Invulnerability**: The player's unit cannot die during this mission (health cannot drop below 1).
- **Progressive UI Disclosure**:
  - **Start**: The UI is completely hidden except for the game map. The Advisor ("Mother") explains the map and basic movement.
  - **Objectives**: When an objective comes into view or is triggered, the game pauses, the Objective UI becomes visible, and the Advisor explains it.
  - **Enemies**: When the first enemy is revealed, the game pauses, the Threat/Enemy UI is shown, and the Advisor explains combat.
  - **Interactions**: The player must be forced to issue specific orders (e.g., move to a specific tile, attack an enemy, extract) before the game resumes.

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