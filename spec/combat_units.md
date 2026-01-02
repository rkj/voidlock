# Units & Combat Mechanics

## 3.2 Units (Soldiers & Enemies)

**Soldier Stats:**

- `hp`: Current Health.
- `speed`: Global Action Speed. Default: **20**.
  - **Movement**: `Speed / 10` tiles per second (e.g., 20 = 2.0 tiles/s).
  - **Timed Actions**: `Duration = BaseDuration * (10 / Speed)`.
  - **Firing Rate (FR)**: Impacted by unit speed. (See Formula below).
- `visibility`: **Infinite** (Blocked only by walls/doors). Not displayed in UI.
- `aiProfile`: Innate unit behavior profile:
  - `STAND_GROUND`: Stop and shoot when enemies are detected.
  - `RUSH`: Aggressively move toward detected enemies.
  - `RETREAT`: Move away from detected enemies while firing.
- `engagementPolicy`: (Manual Override)
  - `ENGAGE`: (Default) Follow `aiProfile` logic.
  - `IGNORE`: Ignore enemies, continue moving/performing actions.

**Weapon Definition:**

- **Range**: Infinite projectile path. The `range` stat represents the **Effective Range** for accuracy scaling.
- **Fire Rate (Stat)**: Defined as "Shots per 10 seconds at unit speed 10."
- **Internal Cooldown**: `Cooldown(ms) = 100,000 / (WeaponFR * UnitSpeed)`.
- **Stats**: `damage`, `range`, `fireRate`.

## 3.3 Shoot / Accuracy model

### 3.3.1. The Model: Linear Range Scaling

The hit chance follows a linear model where the base accuracy is modified by the ratio of the weapon's effective range to the current distance.

### 3.3.2. The Accuracy Stat

The `accuracy` stat ($S$) for a unit represents the hit percentage at the weapon's effective range ($R$). It is calculated as:
`S = SoldierAim + WeaponMod + EquipmentBonus`

### 3.3.3. Formula

The probability of a hit ($P$) at a given distance ($d$) is:
$$ P(d) = \\min\\left(1.0, \\frac{S}{100} \\cdot \\frac{R}{d}\\right) $$

#### 3.3.3.1 Reference Points (Example: $S = 80$, $R = 10$)

| Distance | Hit Chance | Logic                                                     |
| :------- | :--------- | :-------------------------------------------------------- |
| 1 Tile   | 100%       | $\\min(1.0, 0.8 \\cdot 10 / 1) = 8.0 \\rightarrow 1.0$    |
| 5 Tiles  | 100%       | $\\min(1.0, 0.8 \\cdot 10 / 5) = 1.6 \\rightarrow 1.0$    |
| 8 Tiles  | 100%       | $\\min(1.0, 0.8 \\cdot 10 / 8) = 1.0$                     |
| 10 Tiles | **80%**    | $0.8 \\cdot 10 / 10 = 0.8$ -- **The Stat Value at Range** |
| 20 Tiles | 40%        | $0.8 \\cdot 10 / 20 = 0.4$                                |

### 3.3.4. Range Interactions

#### 3.3.4.1 Weapon Range (`range`)

The `range` property ($R$) on a weapon definition represents the **Effective Range**.

- If $Distance > WeaponRange \\cdot 2$, the shot is considered impossible (optional, currently the formula just scales down).
- Units will generally only initiate attacks if $Distance \\le WeaponRange$ (plus a small buffer).

## 3.4 Equipment & Inventory

### 3.4.1 Soldier Loadout (Individual)

Each soldier has specific equipment slots that define their combat performance:

1. **Right Hand (Ranged):** Primary firearm.
   - **Stats**: `Damage`, `FR` (Firing Rate), `Range` (Effective).
1. **Left Hand (Melee):** CQC weapon.
   - **Stats**: `Damage`, `ASP` (Attack Speed).
   - **ASP Formula**: Same as Firing Rate (Actions per 10s at Speed 10).
1. **Body (Armor):** Passive protection.
1. **Feet (Shoes):** Passive mobility.

**Stat Ownership:**

- **Soldier**: Owns `HP`, `SPD` (Innate), and `ACC` (Base Aim).
- **Weapon**: Owns `Damage`, `Rate` (FR/ASP), and `Range`.
- **Final Performance**: The Engine calculates values dynamically: `Total_ACC = Soldier_ACC + Weapon_Mod + Equipment_Mod`.

### 3.4.2 Squad Inventory (Global / Commander Abilities)

Consumable items are **NOT** carried by individual soldiers. Instead, they exist in a **Global Squad Pool** accessible by the Commander.

- **Mechanic:** The Commander can activate these items anywhere on the map (or on any valid target) instantly or via a "Drone Delivery" mechanic.
- **Scope:**
  - **Medkits:** Heal any selected soldier instantly.
  - **Grenades:** Deal damage in a radius at any target location (Global cast).
  - **Mines:** Place a mine at any location.

## 4.4 Commands

See **[Command System & AI](commands.md)** for the full list of commands and their behaviors (Move, Overwatch, Explore, Escort, etc.).
