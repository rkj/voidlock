# Enemy Specifications

## 1. Enemy Archetypes

Enemies are defined by their stats and their **Point Value**, which the Director uses for wave budgeting.

| Type | Name | Points | HP | Speed | Damage | Accuracy | Range |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Easy | Xeno-Mite | 1 | 10 | 35 | 5 | 80% | 1.0 (Melee) |
| Medium | Warrior-Drone | 2 | 25 | 25 | 15 | 85% | 1.0 (Melee) |
| Ranged | Spitter-Acid | 3 | 20 | 25 | 10 | 70% | 8.0 (Ranged) |
| Hard | Praetorian-Guard | 5 | 100 | 15 | 40 | 90% | 1.5 (Melee) |

## 2. Properties & Logic

**2.1 Core Stats:**

- `hp`: Total health. If reduced to 0, the enemy is destroyed.
- `speed`: Determines movement rate. Uses the same formula as soldiers: `Speed / 30` tiles per second.
- `damage`: The amount of health deducted from a soldier upon a successful hit.
- `accuracy`: The base hit chance at effective range. Applied to both Melee and Ranged.
- `range`: The effective range ($R$) used in the Hit Chance formula.

**2.2 Movement & Roaming:**

- Enemies roam autonomously when no targets are in Line of Sight (LOS).
- They prioritize moving between rooms and undiscovered map areas.
- **Vents:** Active spawns during a mission MUST emerge from designated SpawnPoints (Vents).

**2.3 Combat Logic:**

- **Aggro:** When a soldier enters LOS, the enemy switches to an Attack state.
- **Pathfinding:** Melee units pathfind directly to the closest soldier.
- **Kiting (Spitters):** Ranged units attempt to stay at their maximum weapon range. They will retreat if a soldier gets too close.
