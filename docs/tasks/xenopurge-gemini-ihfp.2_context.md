# Task Context: xenopurge-gemini-ihfp.2

## Objective
Implement and verify the Soldier XP and Leveling system for Campaign Mode.

## Requirements
1.  **XP Calculation**:
    -   Kills: +10 XP per kill.
    -   Mission Success: +50 XP.
    -   Mission Failure: +10 XP.
    -   Survival Bonus: +20 XP if the soldier survives (Healthy/Wounded).
2.  **Leveling Logic**:
    -   Use `calculateLevel` and `XP_THRESHOLDS` from `src/shared/campaign_types.ts`.
    -   When a level increases, apply stat boosts:
        -   HP: +20 Max HP per level.
        -   Aim: +5 Soldier Aim per level.
3.  **Engine Integration**:
    -   Refine `CampaignManager.processMissionResult` in `src/engine/managers/CampaignManager.ts` to correctly calculate and apply these values.
    -   Ensure that leveled-up stats are persisted in the `CampaignState`.
4.  **Renderer Integration**:
    -   Ensure `src/renderer/main.ts` correctly populates the `MissionReport` with kill counts and status before sending it to `processMissionResult`.

## Verification
-   Write unit tests in `tests/engine/managers/Progression.test.ts` (or similar) to verify XP gain and stat boosts over multiple levels.
-   Ensure existing campaign tests pass.
