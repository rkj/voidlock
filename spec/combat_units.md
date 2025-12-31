# Units & Combat Mechanics

## 3.2 Units (Soldiers & Enemies)

**Soldier Stats:**

- `hp`: Current Health.
- `speed`: Global Action Speed. Higher is faster. Internally stored as an integer (e.g., `15`).
  - **Movement**: `Speed / 10` tiles per second (e.g., 15 = 1.5 tiles/s).
  - **Timed Actions**: `Duration = BaseDuration * (10 / Speed)`. Faster units complete tasks like extraction sooner.
  - **Shooting**: `Cooldown = WeaponFireRate * (10 / Speed)`. Faster units cycle their weapons quicker.
- `sightRange`: Effective vision radius. For Soldiers, this is considered **Infinite** (blocked only by walls/obstacles).
- `weapon`: Reference to Weapon Definition.
- `engagementPolicy`:
  - `ENGAGE`: (Default) If an enemy is in LOS, stop moving and shoot.
  - `IGNORE`: Ignore enemies, continue moving/performing actions (used for fleeing/rushing). Units will NEVER auto-engage enemies in this mode, even if idle. They will only attack if explicitly ordered via `ATTACK_TARGET`.
- **Action Queue:** Units support a queue of commands (e.g., "Move to A", then "Move to B", then "Interact").

**Weapon Definition:**

- **No Ammo:** Weapons have infinite ammo.
- **Fire Rate:** Defined as a cooldown between shots.
- **Stats:** `damage`, `range`, `fireRateMs`.

## 3.3 Shoot / Accuracy model

### 3.3.1. The Model: Linear Range Scaling

The hit chance follows a linear model where the base accuracy is modified by the ratio of the weapon's effective range to the current distance.

### 3.3.2. The Accuracy Stat

The `accuracy` stat ($S$) for a unit represents the hit percentage at the weapon's effective range ($R$). It is calculated as:
`S = SoldierAim + WeaponMod + EquipmentBonus`

### 3.3.3. Formula

The probability of a hit ($P$) at a given distance ($d$) is:
$$ P(d) = \min\left(1.0, \frac{S}{100} \cdot \frac{R}{d}\right) $$

#### 3.3.3.1 Reference Points (Example: $S = 80$, $R = 10$)

| Distance | Hit Chance | Logic                                  |
| :------- | :--------- | :------------------------------------- |
| 1 Tile   | 100%       | $\min(1.0, 0.8 \cdot 10 / 1) = 8.0 \rightarrow 1.0$ |
| 5 Tiles  | 100%       | $\min(1.0, 0.8 \cdot 10 / 5) = 1.6 \rightarrow 1.0$ |
| 8 Tiles  | 100%       | $\min(1.0, 0.8 \cdot 10 / 8) = 1.0$    |
| 10 Tiles | **80%**    | $0.8 \cdot 10 / 10 = 0.8$ -- **The Stat Value at Range** |
| 20 Tiles | 40%        | $0.8 \cdot 10 / 20 = 0.4$              |

### 3.3.4. Range Interactions

#### 3.3.4.1 Weapon Range (`range`)

The `range` property ($R$) on a weapon definition represents the **Effective Range**.

- If $Distance > WeaponRange \cdot 2$, the shot is considered impossible (optional, currently the formula just scales down).
- Units will generally only initiate attacks if $Distance \le WeaponRange$ (plus a small buffer).


## 4.4 Commands

| Command          | Payload              | Description                                              |
| :--------------- | :------------------- | :------------------------------------------------------- |
| `MOVE_TO`        | `unitIds`, `target`  | Pathfinds and moves. Can be queued.                      |
| `ATTACK_TARGET`  | `unitId`, `targetId` | Forces fire on specific enemy.                           |
| `SET_ENGAGEMENT` | `unitIds`, `mode`    | Toggle `ENGAGE` (Stop & Shoot) or `IGNORE` (Run).        |
| `STOP`           | `unitIds`            | Clears command queue, halts, and disables autonomous AI. |
| `RESUME_AI`      | `unitIds`            | Re-enables autonomous AI for the unit.                   |
