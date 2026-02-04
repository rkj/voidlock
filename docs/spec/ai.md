# AI & Game Logic

## 1. Enemy AI Behavior

**1.1 Autonomous Roaming:**

- Enemies roam the ship autonomously when no soldiers are detected.
- **Prioritization:** Prioritize room centers and undiscovered floor cells.
- **Movement:** Roaming enemies move at 50% of their maximum speed.

**1.2 Engagement:**

- **Aggro:** Switch to Attack state immediately upon Line of Sight (LOS) of a soldier.
- **Melee Archetypes:** Pathfind directly to the target's current position to engage.
- **Ranged Archetypes (Spitters):** Maintain distance at maximum weapon range; retreat if a soldier closes to within 3 tiles.

## 2. Soldier AI (Automated Response)

**2.1 Shoot or Run Model:**

- **Armed Soldiers:** If an enemy is in LOS, the soldier will automatically shoot at the highest-priority target.
- **Unarmed/VIP Units:** If an enemy is in LOS, the unit will automatically move away from the threat toward the nearest "safe" discovered cell.

**2.2 Idle Behavior:**

- If no manual orders are queued, the soldier continues their last assigned task (e.g., MOVE, EXPLORE).
- If completely idle (no task), they will automatically engage any visible targets.

**2.3 Autonomous Exploration:**

- If no threats are present and no manual commands are queued, units prioritize exploring undiscovered rooms.
- **Objective Acquisition:** Units will automatically move to and pick up visible Loot or Objectives.
- **State Restoration:** Resume previous task (e.g., EXPLORE) automatically after picking up an item.

## 3. The Director (Scaling & Difficulty)

The Director manages the threat level and spends "Points" to spawn enemies.

**3.1 Difficulty Knobs:**

- **Starting Points:** The initial point budget for pre-spawning (0 to 50).
- **Point Growth Rate:** The number of points added to the budget for every 10% threat increment (Default: 1.0).
- **Threat Growth Rate:** The speed at which the 0-100% meter fills (Default: 1.0% per second).

**3.2 Spawning Logic:**

- **Pre-spawning (Mission Start):**
  - The Director spends the `Starting Points` budget once.
  - **Placement:** Enemies are placed randomly in **Rooms** only.
  - **Safety:** Enemies CANNOT spawn in the same map quadrant as the player.
- **Active Spawning:**
  - Triggered at every 10% threat increment boundary (10%, 20%... 90%).
  - **Formula:** `WaveBudget = floor(StartingPoints + (CurrentThreat/10 * PointGrowthRate))`.
  - **Wave Cap (Burst Prevention):**
    - Regardless of the `WaveBudget`, the number of enemies spawned in a single wave **MUST NOT** exceed **5** (configurable constant).
    - If `WaveBudget` allows for more, the excess points are discarded or carried over (depending on difficulty tuning), but the wave size is clamped.
  - **Placement:** Enemies MUST spawn at valid **Vents** (SpawnPoints).
- **Tier Locking:**
  - **Threat < 30%:** Only 1pt enemies (Xeno-Mites) allowed.
  - **Threat 30-60%:** Up to 3pt enemies (Drones, Spitters) allowed.
  - **Threat > 60%:** All archetypes allowed.
