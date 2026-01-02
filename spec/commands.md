# Command System & AI Behaviors

## 1. Command Protocol

All interactions with units are mediated through the `Command` object structure. Commands can be issued by the Player (UI) or Autonomous AI Agents.

### 1.1 Command Types

| Command | Payload | Description |
| :--- | :--- | :--- |
| `MOVE_TO` | `target: Vector2` | Move to a specific cell. Pathfinding handles obstacles. |
| `STOP` | - | Clear command queue and halt immediately. |
| `ATTACK_TARGET` | `targetId: string` | Engage a specific enemy unit. Overrides auto-targeting. |
| `SET_ENGAGEMENT` | `mode: "ENGAGE" \| "IGNORE"` | **ENGAGE**: Auto-attack visible enemies. **IGNORE**: Hold fire (Stealth/Run). |
| `OPEN_DOOR` | `doorId: string` | Interact with a door. Unit moves to interaction range first. |
| `LOCK_DOOR` | `doorId: string` | Lock a door (requires Engineering skill/tool - TBD). |
| `USE_ITEM` | `itemId: string`, `target?: Vector2` | Use an inventory item (Medkit, Grenade). |
| `OVERWATCH_POINT` | `target: Vector2` | Move to position and hold angle. Grants reaction fire bonus (TBD). |
| `EXPLORE` | - | Autonomous behavior: Move to nearest unexplored Fog of War. |
| `ESCORT_UNIT` | `targetId: string` | Form a protective formation around a target unit. |

## 2. Specialized Commands

### 2.1 Escort Command (`ESCORT_UNIT`)

- **Target:** Friendly Unit (VIP or Artifact Carrier).
- **Behavior:** Participating units form a protective screen around the target.
  - **Vanguard:** 1 Unit moves to the tile *ahead* of the target (relative to destination/facing).
  - **Rearguard:** 1 Unit moves to the tile *behind*.
  - **Bodyguard:** Remaining units stay adjacent to the target (Sides).
- **Synchronization:** Escorts dynamically adjust speed to match the target, preventing separation.
- **AI State:** Disables autonomous wandering. Units strictly follow formation slots.

### 2.2 Overwatch Point (`OVERWATCH_POINT`)

- **Goal:** Secure a specific sightline or intersection.
- **Behavior:**
  1. Unit moves to the specified point.
  1. Upon arrival, unit faces the `target` direction (implied by path or explicit target).
  1. Unit enters `Stationary` state, gaining accuracy bonuses (if applicable).
  1. **AI Override:** Disables autonomous wandering. Unit will NOT chase enemies.

### 2.3 Explore (`EXPLORE`)

- **Goal:** Autonomous map discovery.
- **Behavior:**
  - AI calculates path to the nearest "Frontier" cell (adjacent to Fog of War).
  - Prioritizes areas that reveal the most new cells.
  - **Interrupts:**
    - **Engagement:** If `ENGAGE` policy is active, unit stops to fight enemies.
    - **Damage:** Taking damage may trigger retreat/cover logic (if `aiProfile` dictates).

### 2.4 Stop / Hold (`STOP`)

- **Goal:** Cancel all current actions.
- **Behavior:**
  - Clears `commandQueue`.
  - Sets state to `Idle`.
  - **AI Override:** Disables autonomous AI (e.g., stops `EXPLORE`).
  - **Combat:** Does NOT disable reaction fire. Unit will still shoot at visible enemies if `ENGAGE` policy is active.

### 2.5 Use Item (`USE_ITEM`)

- **Goal:** Activate a global inventory item.
- **Behavior:**
  - **Instant:** Action is performed immediately (no channeling time).
  - **Global Range:** Can target any valid location/unit (e.g., Drone Drop).
  - **Cost:** Consumes 1 charge from Squad Inventory.

## 3. Command Queueing

- **Structure:** `unit.commandQueue` is a FIFO list.
- **Execution:** The engine executes the first command in the queue. When complete, it pops and starts the next.
- **Interruption:** Issuing a `STOP` or an immediate (non-queued) command clears the queue.

## 4. UI Interaction & Menu Flow

The Command Menu facilitates issuing these commands via a hierarchical structure.

### 4.1 Menu Hierarchy

1. **Top Level (Action Select)**

   - `1. ORDERS` -> Transitions to **Orders Select**.
   - `2. ENGAGEMENT` -> Transitions to **Mode Select**.
   - `3. USE ITEM` -> Transitions to **Item Select**.

1. **Orders Select**

   - `1. MOVE TO ROOM` -> **Target Select** (Room IDs). Payload: `MOVE_TO`.
   - `2. OVERWATCH INTERSECTION` -> **Target Select** (Intersections). Payload: `OVERWATCH_POINT`.
   - `3. EXPLORE` -> **Unit Select**. Payload: `EXPLORE`.
   - `4. HOLD` -> **Unit Select**. Payload: `STOP`.

1. **Target Select**

   - Displays overlays on map (Rooms A-Z, Intersections 1-9).
   - Selection sets the `target` Vector2 for the command.

1. **Unit Select**

   - Selects which units receive the command (`u1`, `u2`, `ALL`).
