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

**2.0 Plan Commitment (ADR 0056):**

Units operate on committed plans, not per-tick decisions. A plan is a behavior + goal + path that the unit follows to completion.

- **Commitment:** Once a unit commits to a plan (e.g., "explore cell X" or "retreat to cell Y"), it follows the full pathfound route without re-evaluating on each intermediate cell.
- **Re-evaluation Triggers:** Plans are only reconsidered when a material world-state change occurs:
  - New enemy enters line of sight
  - All visible enemies die or flee
  - Unit HP drops below critical threshold (25%)
  - New area revealed (door opened, room entered)
  - Objective state changes (picked up by ally, new one discovered)
  - Unit reaches its plan goal (natural completion)
  - Path becomes blocked
  - Manual player command issued
- **Priority Interrupts:** A higher-priority behavior (Safety > Interaction > Combat > Objective > Exploration) can always interrupt a lower-priority plan. A same-or-lower priority behavior cannot override an active plan until the commitment expires or a re-evaluation trigger fires.
- **Anti-Backtracking:** A unit MUST NOT select a goal that would require revisiting its recent path (last 4-6 cells), unless it is a transitory cell on an A\*-planned route to a distant goal, or the unit is cornered with no forward options.

**2.1 Engagement Policies:**

- **ENGAGE (Default):**
  - **Behavior:** Unit stops current movement/task to engage visible hostiles.
  - **Priority:** Neutralize threats before resuming orders.
- **IGNORE:**
  - **Behavior:** Unit continues its primary order (Explore, Move, Pickup) without stopping.
  - **Suppressive Fire:** The unit MUST continue to fire at any visible hostiles within range **while moving**. It does not break its path to fight.
- **AVOID (Tactical Kiting):**
  - **Behavior:** If a unit has no active orders and detects a threat, it retreats to maintain distance.
  - **Retreat Planning:** The unit MUST pathfind to a retreat waypoint (a discovered cell >= N tiles from all visible threats), not hop cell-by-cell. The full retreat path is committed and followed without per-cell re-evaluation.
  - **LOS Constraint:** The unit MUST prioritize retreat waypoints that maintain Line of Sight with the enemy (e.g., backing down a corridor). It MUST NOT hide in already explored rooms unless cornered.
  - **VIP Exception:** VIP units ignore LOS constraints and flee directly toward the extraction zone or the nearest safe room.

**2.2 Shoot or Run Model:**

- **Armed Soldiers:** If an enemy is in LOS, the soldier will automatically shoot at the highest-priority target.
- **Unarmed/VIP Units:** If an enemy is in LOS, the unit will automatically move away from the threat toward the nearest "safe" discovered cell.

**2.3 Idle Behavior:**

- If no manual orders are queued, the soldier continues their last assigned task (e.g., MOVE, EXPLORE).
- If completely idle (no task), they will automatically engage any visible targets.

**2.4 Autonomous Exploration:**

- If no threats are present and no manual commands are queued, units prioritize exploring undiscovered rooms.
- **Path Commitment:** When an exploration target is selected, the unit pathfinds the full route and follows it. It does not re-evaluate on each intermediate cell. Re-evaluation occurs only when the target cell is discovered (by another unit or LOS expansion en route), or a higher-priority trigger fires.
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
