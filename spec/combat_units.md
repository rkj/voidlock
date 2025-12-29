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

### 3.3.1. The Model: Angular Dispersion
We use an **Angular Dispersion Model** (Inverse Square Law) to simulate a "Cone of Fire". As the distance to the target increases, the probability of hitting decreases quadratically, reflecting the expansion of the projectile's potential impact area.

### 3.3.2. The Accuracy Stat
The `accuracy` stat for a unit (0-100) represents the **"Percentage Hit Chance at 5 square distance"**. This stat is used to determine the dispersion parameter $A$ in the probability formula.

### 3.3.3. Formulas

#### 3.3.3.1 Parameter Derivation
Given an accuracy stat $S \in [0, 100)$, the dispersion parameter $A^2$ is derived as:
$$ A^2 = \frac{25 \cdot S}{100 - S} $$
If $S = 100$, $P(d) = 1.0$ for all $d$.

#### 3.3.3.2 Hit Probability
The probability of a hit ($P$) at a given distance ($d$) is:
$$ P(d) = \frac{A^2}{A^2 + d^2} $$
Combined:
$$ P(d) = \frac{25 \cdot S}{25 \cdot S + d^2 \cdot (100 - S)} $$

#### 3.3.3.3 Reference Points (Example: $S = 50$, which implies $A = 5$)
| Distance | Hit Chance | Logic |
| :--- | :--- | :--- |
| 0 Tiles | 100% | Point Point-Blank |
| 1 Tile | 96% | $25 / (25 + 1)$ |
| 5 Tiles | **50%** | $25 / (25 + 25)$ -- **The Stat Value** |
| 10 Tiles | 20% | $25 / (25 + 100)$ |
| 20 Tiles | 5.8% | $25 / (25 + 400)$ |

### 3.3.4. Range Interactions

#### 3.3.4.1 Weapon Range (`range`)
The `range` property on a weapon definition represents the **Absolute Maximum Range** (projectile lifespan). 
- If $Distance > WeaponRange$, the shot is impossible (0% chance).
- If $Distance \le WeaponRange$, the Hit Probability formula is applied.

#### 3.3.4.2 Effective Range
While the formula never reaches 0%, the "Effective Range" is a soft limit where the hit chance becomes negligibly low. In the UI, this may be visualized as the distance where hit chance is $> 10\%$.

## 4.4 Commands

| Command          | Payload              | Description                                              |
| :--------------- | :------------------- | :------------------------------------------------------- |
| `MOVE_TO`        | `unitIds`, `target`  | Pathfinds and moves. Can be queued.                      |
| `ATTACK_TARGET`  | `unitId`, `targetId` | Forces fire on specific enemy.                           |
| `SET_ENGAGEMENT` | `unitIds`, `mode`    | Toggle `ENGAGE` (Stop & Shoot) or `IGNORE` (Run).        |
| `STOP`           | `unitIds`            | Clears command queue, halts, and disables autonomous AI. |
| `RESUME_AI`      | `unitIds`            | Re-enables autonomous AI for the unit.                   |
