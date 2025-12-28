# ADR 0002: Decoupled Time Scaling

**Status:** Implemented

## Context
In a Real-Time with Pause (RTwP) tactical game, players vary the game speed (0.05x - 5.0x) to manage tactical complexity. However, tying *all* game logic to this scaled time creates balance issues:
1.  **Trivializing Risks**: If "Extracting" takes 5 game-seconds, a player could switch to 5x speed to complete it instantly, bypassing the intended risk period where they must defend the extracting unit.
2.  **Pacing Inconsistency**: If enemy waves spawn every 45 game-seconds, playing at 0.5x speed means waves come very slowly, reducing tension. Playing at 5x floods the map.

## Solution
We decouple **Game Time** (`scaledDt`) from **Real Time** (`realDt`) in the simulation loop.

### Implementation
The `CoreEngine.update` signature is:
```typescript
public update(scaledDt: number, realDt: number = scaledDt)
```

-   **Game Time (`scaledDt`)**: Used for simulation physics and simulation-relative logic.
    -   Unit Movement (Speed * scaledDt)
    -   Weapon Fire Rates & Cooldowns
    -   Door Opening Animations
-   **Real Time (`realDt`)**: Used for absolute pacing and "channeling" actions.
    -   **Director**: Enemy waves spawn based on `realDt`. This ensures the player faces X enemies per minute of *play time*, preserving the "panic" factor regardless of speed setting.
    -   **Timed Actions**: "Collecting" or "Extracting" takes fixed real-world seconds (e.g., 5s). This forces the player to defend the unit for that duration, preventing speed-scumming.

## Consequences
-   **Positive**: Consistent difficulty curve and tactical risk management.
-   **Negative**: Slight complexity in Unit `update` methods which must handle both time deltas (moving vs channeling).
