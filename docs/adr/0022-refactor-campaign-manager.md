# ADR 0022: Refactor CampaignManager (Split Responsibilities)

## Status
Accepted

## Context
The `src/engine/managers/CampaignManager.ts` is a "God Object" (~800 lines) managing all aspects of the campaign: persistence, rules, roster manipulation, mission reconciliation, and narrative events. This violates SRP and makes the class hard to test and extend.

## Decision
We will decompose the `CampaignManager` into smaller, focused domain managers, keeping the main class as a facade.

### Changes
1.  **Create `src/engine/campaign/RosterManager.ts`**:
    *   Handle `recruitSoldier`, `healSoldier`, `reviveSoldier`, `assignEquipment`.
2.  **Create `src/engine/campaign/MissionReconciler.ts`**:
    *   Handle `processMissionResult` logic (XP calculation, level ups, resource updates).
3.  **Create `src/engine/campaign/EventManager.ts`**:
    *   Handle `applyEventChoice`.
4.  **Update `CampaignManager.ts`**:
    *   Delegate these operations to the new sub-managers.
    *   Maintain the singleton instance and storage access.

## Consequences
*   **Positive**: Clearer domain boundaries. Roster logic (which is complex) is isolated. Mission results (critical for progression) are isolated.
*   **Negative**: `CampaignManager` becomes a pass-through for many methods, but this is acceptable for a Facade pattern.
