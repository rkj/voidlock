# Command System & AI Behaviors

## 1. Command Protocol

All interactions with units are mediated through the `Command` object structure. Commands can be issued by the Player (UI) or Autonomous AI Agents.

### 1.1 Command Types

| Command           | Payload                              | Description                                                                   |
| :---------------- | :----------------------------------- | :---------------------------------------------------------------------------- |
| `MOVE_TO`         | `target: Vector2`                    | Move to a specific cell. Pathfinding handles obstacles.                       |
| `STOP`            | -                                    | Clear command queue and halt immediately.                                     |
| `SET_ENGAGEMENT`  | `mode: "ENGAGE" \| "IGNORE"`         | **ENGAGE**: Auto-attack visible enemies. **IGNORE**: Hold fire (Stealth/Run). |
| `OPEN_DOOR`       | `doorId: string`                     | Interact with a door. Unit moves to interaction range first.                  |
| `USE_ITEM`        | `itemId: string`, `target?: Vector2` | Use an inventory item. May require channeling (e.g., Medkit).                 |
| `OVERWATCH_POINT` | `target: Vector2`                    | Move to a strategic point (Intersection/Dead End) and hold angle.             |
| `EXPLORE`         | -                                    | Autonomous behavior: Move to nearest unexplored Fog of War.                   |
| `ESCORT_UNIT`     | `targetId: string`                   | Form a protective formation around a target unit.                             |
| `PICKUP`          | `targetId: string`                   | Move to and pick up a World Item (Loot).                                      |
| `EXTRACT`         | -                                    | Attempt to extract at the Extraction Zone.                                    |

> **Note:** `ATTACK_TARGET` has been removed. Soldiers autonomously prioritize targets based on logic (See Section 3).

## 2. Specialized Commands

### 2.1 Escort Command (`ESCORT_UNIT`)

- **Target:** Friendly Unit (VIP or Artifact Carrier).
- **Behavior:** Participating units form a protective screen around the target.
  - **Vanguard:** 1 Unit moves to the tile _ahead_ of the target.
  - **Rearguard:** 1 Unit moves to the tile _behind_.
  - **Bodyguard:** Remaining units stay adjacent to the target.
- **Synchronization:** Escorts dynamically adjust speed to match the target.
- **AI State:** Disables autonomous wandering.

### 2.2 Overwatch Point (`OVERWATCH_POINT`)

- **Targets:** Restricted to **Intersections** and **Dead Ends** (identified by the Map Analysis).
- **Behavior:**
  1. Unit moves to the specified point.
  1. Upon arrival, unit faces the `target` direction.
  1. Unit enters `Stationary` state, gaining accuracy bonuses.
  1. **AI Override:** Disables autonomous wandering.

### 2.3 Use Item (`USE_ITEM`)

- **Behavior:**
  - **Instant:** (e.g., Stimpack). Effect applied immediately.
  - **Channeled:** (e.g., Medkit, Mine). Unit enters `Channeling` state for `item.channelTime` ms. Effect applied on completion.
- **Cost:** Consumes 1 charge from Squad Inventory.

### 2.4 Pickup & Extract

- **PICKUP:** Moves to a World Item. Upon arrival, channels for 1s. Adds item to inventory.
- **EXTRACT:** Moves to Extraction Zone. Upon arrival, channels for 2s. Unit is removed from map (Saved).

## 3. AI Behavior & Targeting

### 3.1 Autonomous Targeting Logic

Soldiers decide _who_ to shoot based on a priority heuristic, removing the need for manual targeting.

1. **Stickiness:** If already attacking a target ($T$), continue attacking $T$ unless:
   - $T$ dies.
   - $T$ leaves Line of Fire (LOF).
   - $T$ moves out of range.
1. **Priority (New Target):**
   - **Score = (MaxHP - CurrentHP) + (100 / Distance)**
   - _Logic:_ Prioritize **Weakest** enemies (Kill confirm) > **Closest** enemies (Immediate threat).
   - If scores are equal, pick the Closest.

### 3.2 Default Behavior

- **Mission Start:** All units automatically receive an `EXPLORE` command upon deployment.
- **Idle Fallback:** If a unit completes its queue and has no active command, it reverts to `Idle` (Stationary) but maintains its `ENGAGEMENT` policy (Shoot if visible).

## 4. Command Queueing

- **Default Behavior:** Issuing a command **CLEARS** the current queue and executes immediately.
- **Queueing (`Shift` Key):** Holding `Shift` while issuing a command **APPENDS** it to the end of the queue.
- **Queue Display:** The UI should visualize the queued path/actions.

### 4. Debug & System Commands

| Type | Direction | Payload | Description |
| :--- | :--- | :--- | :--- |
| `TOGGLE_DEBUG_OVERLAY` | Main -> Worker | `{ enabled: boolean }` | Toggles debug visualizations and data generation. |
| `GET_FULL_STATE` | Main -> Worker | `null` | Requests a full dump of the engine state. |
| `FULL_STATE_DATA` | Worker -> Main | `{ state: GameState, seed: number, history: CommandLogEntry[] }` | The serialized world state. |

## 5. Determinism & validation
## 5. UI Interaction & Menu Flow

### 5.1 Menu Hierarchy

**Navigation:** `Q` or `ESC` to Go Back.

1. **Top Level (Action Select)**
   - `1. ORDERS` -> Transitions to **Orders Select**.
   - `2. ENGAGEMENT` -> Transitions to **Mode Select**.
   - `3. USE ITEM` -> Transitions to **Item Select**.
   - `4. PICKUP` -> **Target Select** (Visible Items).
   - `5. EXTRACT` -> Immediate action (if in zone) or Move Command.

1. **Orders Select**
   - `1. MOVE TO ROOM` -> **Target Select** (Room IDs).
   - `2. OVERWATCH INTERSECTION` -> **Target Select** (Intersections 1-9).
   - `3. ESCORT` -> **Unit Select** (Friendly Units).
   - `4. EXPLORE` -> **Unit Select**.
   - `5. HOLD` -> **Unit Select**.

1. **Target Select**
   - Displays overlays on map.
   - Selection sets the `target` Vector2 for the command.

1. **Unit Select**
   - Selects which units receive the command (`u1`, `u2`, `ALL`).
