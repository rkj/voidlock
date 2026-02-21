# Campaign Mode Specification

**Relevant ADRs:**

- [ADR 0003: Campaign System Architecture](../docs/adr/0003-campaign-system-architecture.md)

## 1. Vision & Core Loop

The Campaign Mode transforms Voidlock into a persistent, roguelite experience. The player assumes the role of a Commander aboard the "Voidlock," managing a roster of soldiers and navigating a hostile sector to eliminate a Hive Cluster.

### 1.1 The "Command Bridge" Loop

1. **Bridge View:** Analyze the Sector Map (a branching path of nodes) and select the next destination.
2. **Equipment (Ready Room):** Configure the squad for the chosen node's threat. Recruit, heal, and equip soldiers here.
3. **Mission Execution:** Tactical gameplay.
4. **Debrief:** Full-screen overlay showing mission stats, loot gained, XP earned, and casualties. Replay runs in the background.
5. **Progress:** Return to Bridge. Node is cleared. New paths unlock.

## 2. Campaign Setup & Modes

### 2.1 New Campaign Configuration

When starting a new campaign, the player configures the following:

- **Difficulty Levels:**
  - **Simulation (Easy):** Mission Failure allows Retry. Dead soldiers are recovered on retry.
  - **Clone Protocol (Normal):** Mission Failure wipes the squad. Bodies can be cloned (Revived) for Scrap.
  - **Standard (Hard):** Mission Failure wipes the squad. Death is permanent.
  - **Ironman (Extreme):** Mission Failure deletes the save file.
- **Tactical Options:**
  - **Tactical Assist:** Toggle Active Pause (0x) and Slow Motion. If disabled, minimum speed is 1.0x.
- **Seed:** Optional custom seed for the sector map generation.

### 2.2 Game Rules (Fixed)

The campaign follows these fixed progression rules based on **Rank** (the column depth in the Sector Map):

- **Map Generator:** Defaults to **DenseShip** for consistent, high-density layouts.
- **Map Size Scaling:**
  - **Start:** 6x6 (at Rank 1).
  - **Growth:** +1 Width/Height every **2 Ranks**.
  - **Formula:** `Size = 6 + floor((Rank - 1) / 2)`.
  - **Cap:** 12x12.
- **Spawn Point Scaling:**
  - **Formula:** `1 + floor((MapSize - 6) / 2)`.
  - **Result:**
    - 6x6 (Ranks 1-2): 1 Enemy Spawn Point
    - 8x8 (Ranks 5-6): 2 Enemy Spawn Points
    - 10x10 (Ranks 9-10): 3 Enemy Spawn Points
    - 12x12 (Rank 13+): 4 Enemy Spawn Points
- **Enemy Scaling (Director):**
  - **Base Intensity:** ~3 enemies per wave (at Rank 1).
  - **Growth:** +1 Enemy per wave per Rank.

## 3. Gameplay Systems

### 3.1 The Sector Map

- **Structure:** A Directed Acyclic Graph (DAG) flowing from Start to Boss.
- **Rank (Depth):** Represents the progression stage.
  - **Rank 1:** The starting nodes.
  - **Rank N:** The final Boss node.
  - Completing a node advances the campaign to the next Rank.
- **Topology:** Lane-based with no crossing paths. Nodes connect only to the next Rank.
- **Navigation:** Keyboard arrow keys must snap to valid nodes in the graph topology.
- **Node Types:**
  - **Combat / Elite / Boss:** Combat missions.
  - **Supply Depot (Shop):** Purchase equipment/recruits. No combat.
  - **Event:** Narrative choices with Risk/Reward (e.g., Search Derelict, Rescue Signal).

### 3.2 Mission Launch Flow

1.  **Select Node:** Player chooses a node on the Sector Map.
2.  **Equipment Screen:**
    - **Manage Roster:** Assign gear, recruit new soldiers, heal wounded.
    - **Launch:** Clicking "Launch Mission" starts the game immediately.
    - _Note:_ There is no separate "Mission Setup" screen in Campaign mode. Configuration is derived entirely from the Node.

### 3.3 Economy (Scrap)

- **Earned:** Mission objectives, extraction, elite kills.
- **Spent:**
  - **Recruitment:** Hiring soldiers (auto-generated names).
  - **Healing/Revival:** Restoring status.
  - **Equipment:** Purchasing persistent items.

### 3.4 Progression (XP)

- **Sources:** Mission Win, Survival, Kills.
- **Death Penalty:** Dead soldiers receive **0 XP** and forfeit all mission bonuses.
- **Leveling:** XP thresholds trigger stat boosts (HP, Aim).

### 3.5 Equipment & Inventory

- **Persistence:** Items remain equipped until removed or lost (death).
- **Mandatory Slots:** Soldiers must always have a primary weapon.
- **Global Inventory:** Consumables (Grenades, Medkits) are purchased into a stockpile. Max 2 per type per mission.

## 4. End Game Flow

### 4.1 Victory

- **Trigger:** Completing a **Boss** node mission.
- **Outcome:** "Victory" status. Victory Report screen.

### 4.2 Defeat

- **Triggers:**
  - **Ironman:** Any Mission Loss.
  - **Bankruptcy:** Active Roster empty AND Scrap < 100.
- **Outcome:** "Defeat" status. Game Over screen.

### 4.3 Mission Abort

- **Outcome:** Treated as a Defeat (Squad Wipe). Returns to Campaign Hub or Game Over screen.

## 5. Meta-Progression

- **Global Stats:** Lifetime kills, wins, losses tracked across all saves.
- **Engineering Bay:** Spend **Intel** (currency retained after death) to unlock new Archetypes (Heavy, Sniper) and Equipment Licenses for future campaigns.
