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
  - **Map Size Scaling:** How fast maps grow in size.

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
- **Node Types:**
  - **Combat:** Standard mission. Reward: XP, Scrap.
  - **Elite:** Harder enemies. Reward: High XP, Item/Weapon.
  - **Supply Depot (Shop):** Buy recruits/gear.
  - **Event:** Narrative choice (risk/reward).
  - **Boss:** Sector climax.

### 3.2 Economy (Scrap)

- **Earned:** Mission objectives, extraction, elite kills.
- **Spent:** Recruitment, Healing/Revival, Equipment (Phase 2).

### 3.3 Progression (XP)

- Soldiers earn XP for actions.
- Leveling up increases base stats (HP, Aim).

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

### 4.3 Mission Launch Constraints

- **Configuration Locking**: When launching a mission from the Campaign Bridge:
  - The **Map Configuration** (Seed, Size, Generator) MUST be **HIDDEN**. The UI should skip directly to Squad Selection or display a read-only briefing.
  - The player CANNOT modify these settings.
  - The **Squad Selection** remains active.
  - **Roster Selection**: The player selects soldiers from their *Available Roster*, NOT by setting a generic "Number of Soldiers" slider. The slider is for Custom Missions only.
- **State Isolation**:
  - Campaign mission settings MUST NOT overwrite the "Custom Mission" defaults. The two modes must maintain separate persistent states for their last-used configurations.