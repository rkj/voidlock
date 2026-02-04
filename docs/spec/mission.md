# Mission Specifications

## 1. Mission Categories (Campaign Nodes)

- **Combat (Standard):** 1 Primary Objective.
- **Elite (Hard):** 2 Primary Objectives.
- **Boss (Final):** 3 Primary Objectives. Triggers Campaign Victory.

## 2. Primary Objectives

| Type                  | Goal             | Survival/Extraction Requirement                                             |
| :-------------------- | :--------------- | :-------------------------------------------------------------------------- |
| **Search & Recover**  | Secure Artifact  | The **Artifact** must be carried and reach the Extraction Zone.             |
| **Data Exfiltration** | Upload Data Disk | The **Data Disk** is uploaded after a 3s interaction. No extraction needed. |
| **Extermination**     | Destroy Hives    | None. Mission succeeds once all Hives are destroyed.                        |
| **Escort VIP**        | Extract VIP      | The **VIP** must reach the Extraction Zone alive.                           |

## 3. Success & Failure Conditions

**3.1 Success:**

- **Objective Complete:** All Primary Objectives are met.
  - _Extermination_: Hives destroyed.
  - _Data Exfiltration_: Data Disks uploaded.
  - _Search & Recover_: Artifact extracted.
  - _Escort_: VIP extracted.
- **Expendability:** Soldier survival is **NOT** a requirement for success. A mission is a success even if the entire squad is wiped, provided the objectives (including required extractions) were completed.

**3.2 Failure:**

- **VIP Death:** Death of the VIP results in immediate failure.
- **Total Wipe (Pre-Objective):** All soldiers die before the objectives (Hives, Uploads, etc.) are completed.
- **Total Wipe (Pre-Extraction):** For Search & Recover, all soldiers die while the Artifact is still on the ship.

## 4. Mission Entities

- **Artifacts:**
  - Physical relics that must be carried by a soldier.
  - **Indestructible:** Cannot be destroyed.
  - **Recovery:** If the carrier falls, the Artifact is dropped and can be picked up by survivors.
- **Data Disks:**
  - Stationary terminals or drives.
  - **Upload:** Requires a 3-second channeling action to "Upload." Once uploaded, the objective is complete.
- **Hives:** Static biological targets for destruction.
- **VIPs:** Unarmed personnel that must be escorted to safety. Unlike items, they CAN be killed.
- **Scrap Crates:** Optional bonus loot; not required for mission success.
  - **Quantity:** Each mission contains **0-3** optional Scrap Crates.
  - **Value:** Each crate is worth approximately **20%** of the base mission scrap reward.

## 5. Deployment Phase (Optional)

Before the mission timer starts (Tick 0), the player has an optional opportunity to tactically place their squad.

- **State:** The game starts in a "Deployment" state. The map is visible (Fog of War applies, but spawn room is revealed). Time is **PAUSED**.
- **Interface:**
  - **Quick Start:** A prominent "START MISSION" button is available immediately. Clicking it without moving units accepts the default random positions.
  - **Interaction:**
    - **Drag & Drop:** Player can drag a soldier from their default position to any valid Spawn Tile (highlighted Green).
    - **Swap:** Dragging a soldier onto an occupied tile swaps positions.
- **Constraints:**
  - If the player engages with deployment, all squad members must be on valid tiles before "START" is enabled.
  - If skipped, the engine proceeds with the pre-assigned random positions.
