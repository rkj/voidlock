# ADR 0011: Standardized Unit Speed & Game Pacing

**Status:** Draft

## Context

The initial implementation of unit movement and combat timing relied on a hardcoded magic number (`10`) scattered within `UnitManager.ts`.
-   **Movement Formula**: `dist = (speed / 10) * dt`
-   **Fire Rate Formula**: `delay = baseFireRate * (10 / speed)`

This resulted in a pacing that felt "too fast" for tactical control (e.g., a unit with Speed 20 moved 2 tiles/second), forcing players to use `0.3x` time scale as a baseline for playability. This made the default `1.0x` speed unusable and limited the effective range of the speed slider.

## Decision

We will standardize the simulation pacing by introducing a global constant: `SPEED_NORMALIZATION_CONST`.

1.  **Constant Value**: Set to `30`.
2.  **Definition**: A Unit with `Speed = 30` moves exactly **1 tile per second** (at 1.0x Time Scale).
3.  **Refactoring**: Replace all instances of the magic number `10` in `UnitManager` (and other managers) with `Constants.SPEED_NORMALIZATION_CONST`.

## Consequences

-   **Slower Baseline**: The game will run ~3x slower than the original implementation (since 30/10 = 3), aligning `1.0x` time scale with the user-preferred "Cinematic Real-Time".
-   **Slider Utility**: The Time Scale slider range can be extended to `10.0x` (Hyper Speed) without causing tunneling, as the base movement per tick is significantly reduced.
-   **Configurability**: Future pacing adjustments can be made by tweaking this single constant.
-   **Formula Updates**:
    -   `moveDist = (unit.stats.speed / SPEED_NORMALIZATION_CONST) * scaledDt`
    -   `fireDelay = weapon.fireRate * (unit.stats.speed > 0 ? SPEED_NORMALIZATION_CONST / unit.stats.speed : 1)`
