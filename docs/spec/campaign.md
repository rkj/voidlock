# Campaign Mode Specification

**Relevant ADRs:**

- [ADR 0003: Campaign System Architecture](../docs/adr/0003-campaign-system-architecture.md)

## 1. Vision & Core Loop

The Campaign Mode transforms Voidlock into a persistent, roguelite experience. The player assumes the role of a Commander aboard the "Voidlock," managing a roster of soldiers and navigating a hostile sector to eliminate a Hive Cluster.

### 1.1 The "Command Bridge" Loop

1. **Bridge View:** Analyze the Sector Map (a branching path of nodes) and select the next destination.
1. **Barracks:** Manage the squad. Recruit new soldiers, heal the wounded, and equip gear.
1. **Deployment:** Configure the squad for the chosen node's specific threat (e.g., "Dense Bio-Signature detected").
1. **Mission Execution:** The tactical gameplay (existing engine).
1. **Debrief:** Full-screen overlay showing mission stats, loot gained, XP earned, and casualties. Replay runs in the background.
1. **Progress:** Return to Bridge. Node is cleared. New paths unlock.

## 2. Campaign Modes

The game supports two primary ways to play a campaign:

### 2.1 Custom Campaign (Sandbox)

For players who want full control or specific challenges.

- **Configuration:**
  - **Seed:** Deterministic generation of the sector map.
  - **Starting Funds:** Initial Scrap amount.
  - **Starting Roster:** Specific soldiers or random archetypes.
  - **Difficulty Scaling:** How fast enemy threat/density ramps up per node.
  - **Map Generator:** Defaults to **DenseShip** for all procedurally generated nodes to ensure consistent, high-density layouts.
  - **Map Size Scaling:**
    - **Start:** 6x6 (Small skirmish).
    - **Growth Rate:**
      - **Standard:** +1.0 Width/Height per Rank (Short Campaign, ~6-8 Ranks).
      - **Extended (Rich):** +0.5 Width/Height per Rank (Long Campaign, ~12-16 Ranks). Used when Shops/Events are enabled.
    - **Cap:** 12x12 (Large Sector).
    - **Override:** Advanced Options can set fixed start/growth rates.
    - **Campaign Length:** The Sector Map generator must produce enough Ranks to reach the 12x12 cap based on the selected Growth Rate.
  - **Spawn Point Scaling:**
    - **Formula:** `Points = 1 + floor((MapSize - 6) / 2)`.
    - **Result:** 6x6=1, 8x8=2, 10x10=3, 12x12=4.
  - **Enemy Scaling (Director):**
    - **Base Intensity:** Starts at ~3 enemies per wave (Mission 1).
    - **Growth:** +1 Enemy per wave per Mission Depth.
    - **Configurable:** Advanced Options can override the Base and Growth rates.

### 2.2 Preset Campaign (Narrative/Challenge)

Curated experiences with fixed parameters.

- **Examples:** "The Long Retreat" (Low resources, high enemy speed), "Bug Hunt" (High resources, massive swarms).
- **Overrides:** Can override specific node maps with hand-crafted layouts instead of procedural generation.

### 2.3 Difficulty Levels

The game supports four difficulty presets defining failure consequences.

- **Simulation (Easy):**
  - **Mission Failure:** Option to **Retry**.
  - **Death:** Recovered on retry.
- **Clone Protocol (Normal):**
  - **Mission Failure:** Squad Wipe (Soldiers lost). Campaign continues.
  - **Death (Success):** Bodies recovered. Can be cloned (Revived) for Scrap.
- **Standard (Hard):**
  - **Mission Failure:** Squad Wipe.
  - **Death:** Permanent (No cloning).
- **Ironman (Extreme):**
  - **Mission Failure:** Campaign Over (Save deleted).

### 2.4 Tactical Settings

- **Tactical Assist (Time Dilation):**
  - **Enabled (Default):** Player can use Active Pause (0x) and Slow Motion (<1.0x) to issue commands.
  - **Disabled (Real-time):** Minimum speed is 1.0x. Active Pause is disabled (System pause via ESC still works but blocks commands).

## 3. Systems Overview

### 3.1 The Sector Map

- **Structure:** A Directed Acyclic Graph (DAG) flowing from Start to Boss. "Slay the Spire" style.
- **Topology (Lane-Based):**
  - **Lanes:** The map has 4 distinct horizontal lanes.
  - **Connections:** Nodes connect ONLY to the next Rank (Depth).
  - **Reachability:** A node in Lane `i` connects to 1-3 nodes in the next Rank.
  - **No Crossing (Monotonicity):** Connections must preserve relative order.
    - If Node A is "above" Node B in the current Rank, then ALL of Node A's targets must be "above" or "equal to" ALL of Node B's targets in the next Rank.
    - _Visually:_ Lines never form an 'X'.
- **Progression (One Way):**
  - The player chooses **exactly one** node per Rank.
  - Upon clearing a node, the campaign advances to the next Rank.
  - All other nodes in the previous Rank become inaccessible (Skipped).
- **Node Types:** See `docs/spec/mission.md` for objective counts and reward scaling for **Combat**, **Elite**, and **Boss** nodes.
- **Non-Combat Nodes:**
  - **Supply Depot (Shop):**
    - **Interaction:** Opens a dedicated **Shop Screen** (Safe Haven).
    - **Features:** Purchase equipment/recruits. No combat.
    - **Exit:** "Leave Depot" button (advances Rank).
  - **Event (Signal):**
    - **Interaction:** Opens a **Narrative Dialog**.
    - **Mechanic:** Text-based choices with Risk/Reward.
    - **Types:**
      - **Derelict Ship:** 'Search' (Chance for Scrap vs Injury) vs 'Leave'.
      - **Distress Signal:** 'Rescue' (Chance for Free Recruit vs Ambush) vs 'Ignore'.
      - **Black Market:** 'Trade' (Scrap for Intel/Items) vs 'Leave'.
    - **Exit:** Choice selection advances Rank.
- **Bonus Loot (Intel):**
  - **Map Visibility:**
    - **Simulation/Clone:** The number of Scrap Crates (see `docs/spec/mission.md`) is visible on the Sector Map (e.g., via "⭐" pips).
    - **Standard/Ironman:** Crate count is hidden (Fog of War).

### 3.2 Economy (Scrap) & Modes

- **Earned:** Mission objectives, extraction, elite kills.
- **Spent:**
  - **Recruitment**: Hiring a new soldier costs Scrap. Recruits receive **auto-generated names** from a curated list of sci-fi/military flavors.
  - **Healing/Revival**: Restoring wounded or dead (if allowed) soldiers costs Scrap.
  - **Equipment**: Purchasing items (See Section 3.4).

### 3.3 Progression (XP)

- **Sources:**
  - **Mission Win:** Flat bonus for all survivors.
  - **Mission Loss:** Reduced flat bonus for survivors.
  - **Survival:** Bonus for extracting safely (Healthy/Wounded).
  - **Kills:** Per-enemy XP bonus.
- **Death Penalty:**
  - Soldiers who die during a mission (Status: **Dead**) receive **0 XP** total.
  - They forfeit all XP from kills made during that mission.
  - They forfeit all mission completion/participation bonuses.
  - They **cannot level up**.
- **Leveling:** Gaining enough XP triggers a Level Up, increasing base stats (HP, Aim).

### 3.4 Equipment Economy & Persistence

- **Persistence:**
  - Weapons and Armor assigned to a soldier are **persistent** across missions.
  - They remain equipped until manually removed or the soldier dies (unrecovered body = lost gear).
  - Changing equipment in Mission Setup immediately updates the Campaign Roster.
- **Soldier Customization**:
  - **Renaming**: The Soldier Inspector MUST allow the player to rename a soldier while in the Barracks.
- **Costs:**
  - **Pay-to-Equip:** Purchasing/Equipping an item costs Scrap.
  - **Ownership:** Once equipped, the item belongs to that soldier.
  - **Unequipping:** Removes the item. No refund (Scrap sink).
- **Global Inventory (Consumables):**
  - Grenades, Medkits, Scanners, etc., are purchased into a Global Stockpile.
  - **Mission Cap:** Max **2** of any single consumable type per mission (e.g., max 2 Grenades total for the squad).
  - **Usage:** Used items are removed from stockpile. Unused are returned.
- **Starting Funds (Scrap):**
  - Simulation: 1000
  - Clone: 500
  - Standard: 300
  - Ironman: 150

## 5. End Game Flow

### 5.1 Victory State

- **Trigger:** Successfully completing a mission at a node of type **"Boss"**.
- **State Change:** Campaign `status` changes to **"Victory"**.
- **UI:** The Campaign Screen is replaced by a **Victory Report**:
  - "Sector Secured" Heading.
  - Final Squad Roster (Survivors).
  - Total Statistics (Aliens Killed, Missions Won, Total Days).
  - **"New Campaign"** button (Returns to Main Menu).

### 5.2 Defeat State

- **Triggers:**
  - **Ironman:** Any Mission Loss.
  - **Standard/Clone:** **Bankruptcy**. Occurs when:
    - Active Roster is empty (All dead or wounded > 0).
    - AND Scrap < 100 (Cannot recruit).
- **State Change:** Campaign `status` changes to **"Defeat"**.
- **UI:** The Campaign Screen is replaced by a **Game Over** report:
  - "Mission Failed / Sector Lost".
  - Cause of Death (e.g., "Squad Wiped", "Funding Collapse").
  - **"Abandon Campaign"** button.

## 6. Meta-Progression

The game tracks cumulative statistics across all campaigns (regardless of Victory/Defeat) to provide long-term engagement.

### 6.1 Global Stats (Persistent)

Stored independently of individual save files (e.g., `voidlock_meta_v1`).

- **Campaigns:**
  - `totalCampaignsStarted`: Count.
  - **Campaign Mode Visualization:**
    - **Campaign Shell:** All campaign screens (Bridge, Barracks, Shop) are rendered within a consistent shell containing the global resource bar (Top Right) and navigation tabs (Top Center).
    - **Sector Map Layout:**
      - **Nodes:** Rendered in the main content area.
      - **Controls:** "New Campaign" and "Main Menu" buttons are positioned in the **Top Right** of the shell (or distinct from the bottom action bar).
      - **Bottom Bar:** Reserved for context-specific actions (e.g., "Deploy", "Visit Shop").
  - `campaignsWon`: Count (Victory State).
  - `campaignsLost`: Count (Defeat State).
- **Combat:**
  - `totalKills`: Global enemy kill count.
  - `totalCasualties`: Global soldier death count.
  - `totalMissionsPlayed`: Count.
  - `totalMissionsWon`: Count.
- **Economy:**
  - `totalScrapEarned`: Cumulative lifetime earnings.

### 6.2 Implementation

- **Update Trigger:**
  - Stats are updated incrementally at the end of each mission (for combat/eco stats) or at Campaign End (for Win/Loss counts).
  - _Constraint:_ Must support "Crash Recovery" (i.e., if game crashes, stats accrued during the mission might be lost unless synced carefully, but syncing at End of Mission is acceptable for MVP).
- **Visualization:**
  - **Profile Screen:** (Future Feature)
  - **Main Menu:** Simple tally (e.g., "Aliens Killed: 10,432") displayed in a corner.

## 4. User Experience (UX) Requirements

### 4.1 Debrief Screen

- **Visual:** Full-screen overlay with semi-transparent background.
- **Background:** The mission replay (time-accelerated) plays silently behind the stats.
- **Content:**
  - "Mission Success/Failure" Header.
  - Loot Tally (Scrap).
  - Squad Status (XP bars filling up, Level Up notifications, Injury reports).
  - "Continue" button to return to Bridge.

### 4.2 Main Menu Integration

- **New Campaign**: Opens a wizard:
  1. **Campaign Type**: Preset vs Custom.
  2. **Difficulty**: Simulation, Clone Protocol, Standard, Ironman.
  3. **Tactical Options**: Toggle "Enable Tactical Pause/Slowmo".
  4. **Start**: Launches the campaign.
- **Continue**: Resumes the active campaign state (if any).
  - **Restart**: If a campaign is already active (or game over), the "New Campaign" flow must warn the user that the current save will be overwritten.

### 4.4 Mission Abort Flow

- **Trigger**: User selects "Give Up" or "Abort Mission" from the Pause Menu.
- **State Cleanup**:
  - The Active Mission Session (Engine State) MUST be cleared from persistence immediately.
  - The `currentMission` pointer in `CampaignManager` implies a "Loss".
- **Outcome**:
  - **Campaign Mode**: Treated as a **Defeat** (Squad Wipe logic applies unless "Retreat" logic is implemented). Returns to Campaign Hub (or Game Over screen).
  - **Custom Mode**: Returns to Mission Setup.
- **Anti-Pattern**: The user MUST NOT be dropped back into the _same_ tactical state upon restarting the game or the mission.

### 4.3 Mission Launch Constraints

- **Configuration Locking**: When launching a mission from the Campaign Bridge:
  - The **Map Configuration** (Seed, Size, Generator) MUST be **HIDDEN**. The UI should skip directly to Squad Selection or display a read-only briefing.
  - The player CANNOT modify these settings.
  - The **Squad Selection** remains active.
  - **Roster Selection**: The UI must list individual soldiers from the player's _Available Roster_ using checkboxes or toggles.
    - **Selection Limit**: Enforce the maximum squad size (4 soldiers).
    - **Injury Handling**: Soldiers with a status other than "Healthy" (e.g., "Injured") must be listed but disabled for selection.
    - **Display**: Each entry should show the soldier's Name, Archetype, Level, and Status.
    - **No Sliders**: The generic "Number of Soldiers" slider is for Custom Missions only and MUST be hidden or disabled in Campaign mode.
- **State Isolation**:
  - Campaign mission settings MUST NOT overwrite the "Custom Mission" defaults. The two modes must maintain separate persistent states for their last-used configurations.
