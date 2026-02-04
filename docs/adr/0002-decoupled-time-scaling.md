# ADR 0002: Decoupled Time Scaling

**Status:** Superseded (by Refactor fgao: Unified Game Time)

## Context

In a Real-Time with Pause (RTwP) tactical game, players vary the game speed (0.05x - 5.0x) to manage tactical complexity. However, tying _all_ game logic to this scaled time creates balance issues:

1. **Trivializing Risks**: If "Extracting" takes 5 game-seconds, a player could switch to 5x speed to complete it instantly, bypassing the intended risk period where they must defend the extracting unit.
1. **Pacing Inconsistency**: If enemy waves spawn every 45 game-seconds, playing at 0.5x speed means waves come very slowly, reducing tension. Playing at 5x floods the map.

## Solution (Original)

We decoupled **Game Time** (`scaledDt`) from **Real Time** (`realDt`) in the simulation loop.

## Superseded (December 2025)

The decoupling was found to interfere with the "Pause" mechanic and created confusion regarding "Total Play Time". It was decided that **all** game logic should follow the `scaledDt` (Game Time).

1. **Unified Pacing**: Director spawning and Timed Actions (channeling) now use `scaledDt`.
1. **Pause Fix**: When `scaledDt` is 0, the engine stops updating entirely, ensuring threat and interactions freeze correctly.
1. **Simplicity**: Simplifies the engine logic and makes "Speed Scaling" a global multiplier for all game events.

### Implementation (New)

The `CoreEngine.update` now enforces `scaledDt` for all sub-systems and returns early if `scaledDt === 0`.
