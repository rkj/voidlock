# Campaign Mode Specification

## 1. Vision & Core Loop

The Campaign Mode transforms Xenopurge into a persistent, roguelite experience. The player assumes the role of a Commander aboard the "Xenopurge," managing a roster of soldiers and navigating a hostile sector to eliminate a Hive Cluster.

### 1.1 The "Command Bridge" Loop
1.  **Bridge View:** Analyze the Sector Map (a branching path of nodes) and select the next destination.
2.  **Barracks:** Manage the squad. Recruit new soldiers, heal the wounded, and equip gear.
3.  **Deployment:** Configure the squad for the chosen node's specific threat (e.g., "Dense Bio-Signature detected").
4.  **Mission Execution:** The tactical gameplay (existing engine).
5.  **Debrief:** Full-screen overlay showing mission stats, loot gained, XP earned, and casualties. Replay runs in the background.
6.  **Progress:** Return to Bridge. Node is cleared. New paths unlock.

## 2. Campaign Modes

The game supports two primary ways to play a campaign:

### 2.1 Custom Campaign (Sandbox)
For players who want full control or specific challenges.
*   **Configuration:**
    *   **Seed:** Deterministic generation of the sector map.
    *   **Starting Funds:** Initial Scrap amount.
    *   **Starting Roster:** Specific soldiers or random archetypes.
    *   **Difficulty Scaling:** How fast enemy threat/density ramps up per node.
    *   **Map Size Scaling:** How fast maps grow in size.

### 2.2 Preset Campaign (Narrative/Challenge)
Curated experiences with fixed parameters.
*   **Examples:** "The Long Retreat" (Low resources, high enemy speed), "Bug Hunt" (High resources, massive swarms).
*   **Overrides:** Can override specific node maps with hand-crafted layouts instead of procedural generation.

### 2.3 Death & Recovery Settings (Difficulty Rules)
These rules apply to both Custom and Preset campaigns.

*   **Iron Mode (Hardcore):**
    *   **Death:** Permanent. Dead soldiers are gone forever.
    *   **Healing:** Costly (Scrap). Wounds persist.
*   **Clone Mode (Standard):**
    *   **Death:** If the mission is *Successful*, dead bodies are recovered. They can be revived/cloned for a high Scrap cost.
    *   **Wipe:** If the squad wipes (Mission Failed), bodies are lost (Permadeath).
*   **Simulation Mode (Easy/Training):**
    *   **Death:** No consequence. Soldiers return to full health after every mission, successful or not.

## 3. Systems Overview

### 3.1 The Sector Map
*   **Structure:** A Directed Acyclic Graph (DAG) flowing from Start to Boss. "Slay the Spire" style.
*   **Node Types:**
    *   **Combat:** Standard mission. Reward: XP, Scrap.
    *   **Elite:** Harder enemies. Reward: High XP, Item/Weapon.
    *   **Supply Depot (Shop):** Buy recruits/gear.
    *   **Event:** Narrative choice (risk/reward).
    *   **Boss:** Sector climax.

### 3.2 Economy (Scrap)
*   **Earned:** Mission objectives, extraction, elite kills.
*   **Spent:** Recruitment, Healing/Revival, Equipment (Phase 2).

### 3.3 Progression (XP)
*   Soldiers earn XP for actions.
*   Leveling up increases base stats (HP, Aim).

## 4. User Experience (UX) Requirements

### 4.1 Debrief Screen
*   **Visual:** Full-screen overlay with semi-transparent background.
*   **Background:** The mission replay (time-accelerated) plays silently behind the stats.
*   **Content:**
    *   "Mission Success/Failure" Header.
    *   Loot Tally (Scrap).
    *   Squad Status (XP bars filling up, Level Up notifications, Injury reports).
    *   "Continue" button to return to Bridge.

### 4.2 Main Menu Integration
*   **New Campaign:** Opens a sub-menu to choose "Preset" or "Custom".
*   **Continue:** Resumes the active campaign state (if any).