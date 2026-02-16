# Command System & AI Behaviors

## 1. Command Protocol

All interactions with units are mediated through the `Command` object structure. Commands can be issued by the Player (UI) or Autonomous AI Agents.

### 1.1 Command Types

| Command | Payload | Description |
| :---------------- | :------------------------------------------------------------ | :---------------------------------------------------------------------------- |
| `MOVE_TO` | `target: Vector2` | Move to a specific cell. Pathfinding handles obstacles. |
| `STOP` | - | Clear command queue and halt immediately. |
| `SET_ENGAGEMENT` | `mode: "ENGAGE" \| "IGNORE"` | **ENGAGE**: Auto-attack visible enemies. **IGNORE**: Hold fire (Stealth/Run). |
| `OPEN_DOOR` | `doorId: string` | Interact with a door. Unit moves to interaction range first. |
| `USE_ITEM` | `itemId: string`, `target?: Vector2`, `targetUnitId?: string` | Use an inventory item. May require channeling (e.g., Medkit). |
| `OVERWATCH_POINT` | `target: Vector2` | Move to a strategic point (Intersection/Dead End) and hold angle. |
| `EXPLORE` | - | Autonomous behavior: Move to nearest unexplored Fog of War. |
| `ESCORT_UNIT` | `targetId: string` | Form a protective formation around a target unit. |
| `PICKUP` | `targetId: string` | Move to and pick up a World Item (Loot). |
| `EXTRACT` | - | Attempt to extract at the Extraction Zone. |

> **Note:** `ATTACK_TARGET` has been removed. Soldiers autonomously prioritize targets based on logic (See Section 3).

## 2. Timed Actions (Channeling)

Certain actions require the unit to remain stationary and focus for a duration.

### 2.1 Mechanics

- **State:** Unit enters `UnitState.Busy` (or `Channeling`).
- **Duration Formula:**
  - All timed actions follow the global speed normalization rule.
  - `Actual Duration = Base Time * (SPEED_NORMALIZATION_CONST / Unit Speed)`
  - `SPEED_NORMALIZATION_CONST` = 30.
- **Exclusivity:**
  - Only one unit can channel the `PICKUP` or `USE_ITEM` (on object) action on a specific world entity at a time.
  - If multiple units are ordered to pick up the same item, only the first to arrive begins channeling; others will remain idle or follow their autonomous fallback.
- **Interruption & Cancellation:**
  - **Voluntary:** Issuing a `STOP` or `MOVE` command cancels the action immediately.
  - **Involuntary:** Taking damage does **NOT** interrupt (unless unit dies).
  - **Automatic Cancellation:** If the target item or objective disappears (e.g., picked up by another unit) while a unit is moving toward it or channeling, the command is automatically cancelled and the unit reverts to its previous or default state.

### 2.2 Standard Durations (Base Time)

- **Artifact Pickup:** **3.0 Seconds**.
- **Extracting:** **5.0 Seconds**.
- **Medkit / Mine:** **3.0 Seconds** (See [Items](items.md)).

## 3. Specialized Commands

### 3.1 Escort Command (`ESCORT_UNIT`)

- **Target:** High-Value Friendly Unit. Must be one of:
  - **VIP**: Unit with the `vip` archetype.
  - **Artifact Carrier**: Any unit currently carrying a mission objective (has a non-null `carriedObjectiveId`).
- **Behavior:** Participating units form a protective screen around the target.
  - **Vanguard:** 1 Unit moves to the tile _ahead_ of the target.
  - **Rearguard:** 1 Unit moves to the tile _behind_.
  - **Bodyguard:** Remaining units stay adjacent to the target.
- **Synchronization:** Escorts dynamically adjust speed to match the target.
- **AI State:** Disables autonomous wandering.

### 3.2 Overwatch Point (`OVERWATCH_POINT`)

- **Targets:** Restricted to **Intersections** and **Dead Ends** (identified by the Map Analysis).
- **Behavior:**
  1. Unit moves to the specified point.
  1. Upon arrival, unit faces the `target` direction.
  1. Unit enters `Stationary` state, gaining accuracy bonuses.
  1. **AI Override:** Disables autonomous wandering.

### 3.3 Use Item (`USE_ITEM`)

- **Behavior:** See [Items & Abilities](items.md).
- **Cost:** Consumes 1 item from Squad Inventory.

### 3.4 Pickup & Extract

- **PICKUP:** Moves to a World Item. Upon arrival, performs Timed Action (3.0s). Adds item to inventory.
- **EXTRACT:** Moves to Extraction Zone. Upon arrival, performs Timed Action (5.0s). Unit is removed from map (Saved).

## 4. AI Behavior & Targeting

### 4.1 Autonomous Targeting Logic

Soldiers decide _who_ to shoot based on a priority heuristic, removing the need for manual targeting.

1. **Stickiness:** If already attacking a target ($T$), continue attacking $T$ unless:
   - $T$ dies.
   - $T$ leaves Line of Fire (LOF).
   - $T$ moves out of range.
1. **Priority (New Target):**
   - **Score = (MaxHP - CurrentHP) + (100 / Distance)**
   - _Logic:_ Prioritize **Weakest** enemies (Kill confirm) > **Closest** enemies (Immediate threat).
   - If scores are equal, pick the Closest.

### 4.2 Default Behavior

- **Mission Start:** All units automatically receive an `EXPLORE` command upon deployment.
- **Idle Fallback:** If a unit completes its queue and has no active command, it reverts to `Idle` (Stationary) but maintains its `ENGAGEMENT` policy (Shoot if visible).

## 5. Command Queueing

- **Default Behavior:** Issuing a command **CLEARS** the current queue and executes immediately.
- **Queueing (`Shift` Key):** Holding `Shift` while issuing a command **APPENDS** it to the end of the queue.
- **Queue Display:** The UI should visualize the queued path/actions.

## 6. Debug & System Commands

These commands facilitate testing, balancing, and state reproduction.

| Type | Direction | Payload | Description |
| :--------------------- | :------------- | :--------------------- | :----------------------------------------------------- |
| `TOGGLE_DEBUG_OVERLAY` | Main -> Worker | `{ enabled: boolean }` | Toggles debug visualizations (Coordinates, Raycasts). |
| `TOGGLE_LOS_OVERLAY` | Main -> Worker | `{ enabled: boolean }` | Toggles Line-of-Sight polygons (Gradients). |
| `QUERY_STATE` | Main -> Worker | `null` | Requests an immediate state snapshot. |
| `STATE_UPDATE` | Worker -> Main | `GameState` | The serialized world state, including command history. |

## 7. UI Interaction & Menu Flow

### 7.1 Menu Hierarchy

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
