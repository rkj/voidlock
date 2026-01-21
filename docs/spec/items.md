# Items & Abilities

**Context:** Definitions for all consumable items, commander abilities, and equipment behavior.

## 1. Core Concepts

### 1.1 Global Inventory (The Pool)
- Consumable Items (Grenades, Medkits, Mines) are held in a **Global Squad Inventory**.
- They are **NOT** carried in individual soldier pockets unless specifically equipped as "Gear" (e.g. Weapons, Armor).
- **Usage:** When an item is used, it is decremented from the Global Pool immediately.
- **"One Item = One Use":** There is **NO** concept of "Charges". If the UI says "3 Grenades", you have 3 throwable objects. Using one leaves you with 2. The UI must never display "Charges: 2".

### 1.2 Action Duration (Speed-Dependent)
- Actions performed by units (Medkit, Landmine) are **NOT** fixed time.
- They depend on the unit's **Speed** stat.
- **Formula:** `Actual Duration = Base Time * (SPEED_NORMALIZATION_CONST / Unit Speed)`
- **Base Time Standard:** 3.0 Seconds (Default for most tactical actions).
- *Example:* A fast Scout (Speed 30) performs a 3s action in exactly 3s. A Heavy (Speed 15) takes 6s.

---

## 2. Commander Abilities
These are actions initiated by the player using the Global Inventory. They are instant and do not occupy a unit's timeline.

### 2.1 Frag Grenade
- **Type:** Commander Action (Instant).
- **Targeting:** **Visible Enemy Unit** ONLY.
  - *Constraint:* Cannot be thrown blindly into the dark or at empty floor tiles.
- **Effect:** Deals **100 Damage** to the target unit and any other entity in the **same 1x1 cell**.
- **Friendly Fire:** Enabled (if a soldier is melee-locked with the target).
- **Cost:** 1 Frag Grenade.

### 2.2 Scanner
- **Type:** Commander Action (Instant).
- **Targeting:** **Friendly Soldier**.
- **Effect:** Instantly reveals the Fog of War in a **5-tile radius** centered on the **selected soldier**.
- **Constraint:** Must target a unit to "ping" off their sensors.
- **Aggro:** Passive/Silent. Does not trigger enemy response.
- **Cost:** 1 Scanner.

### 2.3 Stimpack
- **Type:** Commander Action (Instant).
- **Targeting:** **Friendly Soldier**.
- **Effect:** Instantly restores **15 HP**.
- **Usage:** Combat triage.
- **Cost:** 1 Stimpack.

---

## 3. Tactical Actions (Unit-Driven)
These require a specific soldier to perform an action. The unit cannot move or shoot while performing the action.

### 3.1 Medkit
- **Type:** Unit Action.
- **Targeting:** **Friendly Soldier** (Self).
- **Flow:**
  1. Select Medkit.
  2. Select Soldier.
  3. Soldier immediately begins the action.
- **Duration:** **Base Time: 3.0s** (Scaled by Speed).
- **Effect:** Restores **50 HP** upon completion.
- **Interruption:** Taking damage interrupts the action? (TBD). Moving cancels it.
- **Cost:** 1 Medkit.

### 3.2 Landmine
- **Type:** Unit Action (Placement).
- **Flow:**
  1. Select Landmine.
  2. **Select Soldier:** Choose which unit will carry/place the mine.
  3. **Select Location:**
     - Option A: **Current Position** (Instant start).
     - Option B: **Corridor Intersection** (Unit must pathfind to location).
     - *Constraint:* Cannot place in open rooms or random floor tiles. Must be strategic chokepoints (Intersections) or Self.
- **Behavior:**
  1. Soldier moves to target location.
  2. Soldier begins action (e.g., "Placing Mine").
  3. **Duration:** **Base Time: 3.0s** (Scaled by Speed).
  4. Mine object spawns at location.
- **Trigger:** Explodes when an Enemy enters the cell.
- **Effect:** 100 DMG AOE (Same as Grenade).
- **Cost:** 1 Landmine.