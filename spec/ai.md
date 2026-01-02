# AI & Game Logic

## 3.4 Enemy

**Enemy AI Behavior:**

- **Archetypes:**
  - **Xeno-Mite (Easy):** Fast, weak, melee swarmer.
  - **Warrior-Drone (Medium):** Balanced stats, standard melee unit.
  - **Praetorian-Guard (Hard):** Slow, heavily armored, high melee damage.
  - **Spitter-Acid (Ranged):** Ranged attack. Logic: Kites players (moves to max range), flees if engaged in melee.
- **Melee Only:** For the current prototype, all enemies use melee-only attacks. (Obsolete - Spitter added)
- **Autonomous Roaming:** Enemies roam the ship autonomously when no soldiers are detected, prioritizing undiscovered or less-visited floor cells.
- **Aggro:** On LOS of a Soldier -> Switch to Attack state and pathfind directly to the closest soldier to engage. Spitters maintain distance.
- **Modular Design:** The AI should be implemented using an extensible interface/strategy pattern to support future enemy types (e.g., ranged units, different roaming strategies).

## 4.1 Soldier logic profile

The automated soldier AI follows a multi-tier logic profile when not under direct manual control:

1. **Threat Evaluation:**
   - Units continuously scan for visible enemies.
   - Threat level is calculated based on distance, enemy type, and unit's current HP.
   - Enemies attacking the unit or its squadmates receive highest priority.

1. **Engagement (Default Policy: `ENGAGE`):**
   - If a threat is detected and `engagementPolicy` is `ENGAGE`:
     - The unit will prioritize attacking the highest-priority target within `attackRange`.
     - If no targets are in `attackRange` but threats are visible, the unit will move toward the closest threat until in range.
     - Units will "Stop & Shoot" — pausing movement to resolve combat unless the command was explicitly queued with `IGNORE`.

1. **Self-preservation:**
   - **Retreat:** If HP falls below 25%, the unit's logic switches to `IGNORE` engagement and prioritizes moving away from the closest threat toward a discovered "safe" cell (no visible enemies).
   - **Group Up:** If a unit is isolated (no allies within 5 tiles) and threats are present, it prioritizes moving toward the closest ally.

1. **Autonomous Exploration & Objective Acquisition**:
   - If no threats are present and no manual commands are queued, units prioritize exploring the closest undiscovered floor cells.
   - **Priority Override**: If an objective item (e.g., Artifact) or a target (e.g., Hive) is visible in LOS, units **MUST** immediately prioritize its acquisition over general exploration.
   - Once the map is fully discovered and all objectives are complete, units automatically pathfind to the extraction point.

1. **VIP Logic (MissionType: EscortVIP)**:
   - **Unit Profile**:
     - **Unarmed**: Cannot attack (`damage: 0`, `fireRate: 0`).
     - **Stats**: ~50% HP of a standard soldier. Good speed.
     - **Squad**: Does NOT count towards the 4-soldier limit.
   - **Mission Rules**:
     - **Start**: VIP spawns in a separate, distant room (different quadrant).
     - **Reveal**: VIP's starting location is revealed in FOW at mission start.
     - **Goal**: Extract ALL VIPs. Any VIP death = Immediate Loss.
   - **AI Behavior**:
     - **Passive**: Stays in starting room until a soldier enters LOS ("Rescue").
     - **Active (Rescued)**:
       - **Priority 1**: Flee from visible enemies (Run away).
       - **Priority 2**: Move toward Extraction Zone.
       - **Priority 3**: Stay near armed squad members (Follow).
   - **Multiple VIPs**: Missions can support more than one VIP unit. All must be extracted for success.

1. **Timed Actions**:
   - Actions like extraction and picking up items take **5 seconds** (at 1x speed) to complete.
   - During this time, the unit is locked in place and cannot perform other actions until the process finishes.

1. **Task Coordination**:
   - Units must coordinate their autonomous tasks. Multiple units should NOT attempt the same task (e.g., picking up the same item) simultaneously. If one unit is already performing a task, others must prioritize different objectives.

### 4.3 The Director (Spawning)

Spawns occur on a fixed timer (default 30s).
**Starting Threat:**

- Missions can start at a configurable threat level (0% to 100%).
- If the starting threat is > 10%, enemies are pre-spawned and autonomously roaming the ship at mission start.
- Pre-spawning logic: For each completed 10% threat level increment, one full wave of enemies is spawned at mission initialization.

**Algorithm:**

1. **Base Amount:** Map difficulty defines `X` base enemies. Currently, waves start at 1 enemy and scale up.
1. **Scaling:** `+1` enemy added to the pool per wave (turn). Wave size = `1 + currentTurn`.
1. **Distribution:** Enemies are distributed randomly among valid `SpawnPoints`.
1. **Upgrade Logic:** Probabilistic replacement of weak enemies with strong ones based on current threat level.
1. **Threat Growth:** Threat level increases by 10% per turn (10s at 1x speed), capping at 100% after 10 turns.
