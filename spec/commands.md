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

### 2.2 Overwatch Point (`OVERWATCH_POINT`)

- **Goal:** secure a sightline.
- **Behavior:**
  1. Unit moves to the specified point.
  2. Upon arrival, unit faces the `target` direction.
  3. Unit enters `Stationary` state, gaining accuracy bonuses (if applicable).
  4. **AI Override:** Disables autonomous wandering.

### 2.3 Explore (`EXPLORE`)

- **Goal:** Autonomous map discovery.
- **Behavior:**
  - AI calculates path to the nearest "Frontier" cell (adjacent to Fog of War).
  - Prioritizes areas that reveal the most new cells.
  - Interrupts if enemies are sighted (depending on Engagement Policy).

## 3. Command Queueing

- **Structure:** `unit.commandQueue` is a FIFO list.
- **Execution:** The engine executes the first command in the queue. When complete, it pops and starts the next.
- **Interruption:** Issuing a `STOP` or an immediate (non-queued) command clears the queue.
