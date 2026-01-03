# Task Context: xenopurge-gemini-knoc

## Status Update
This task was previously marked as `in_progress`, but no code changes were found in the working copy or recent commits. You are being re-dispatched to implement the `ESCORT_UNIT` command and Formation Behavior.

## Objective
Implement `ESCORT_UNIT` command and formation behavior as per `spec/commands.md#21-escort-command` and `docs/adr/0006-autonomous-agent-architecture.md`.

## Requirements
1.  **Command Protocol**: Add `ESCORT_UNIT` to `CommandType` in `src/shared/types.ts`.
2.  **Formation Logic**: Implement the logic in `src/engine/managers/UnitManager.ts` (or relevant AI manager).
    -   **Vanguard**: 1 Unit moves to the tile ahead of the target.
    -   **Rearguard**: 1 Unit moves to the tile behind.
    -   **Bodyguard**: Remaining units stay adjacent to the target.
3.  **Synchronization**: Ensure escort units dynamically adjust their movement speed to match the target unit's speed.
4.  **AI State**: The command should disable autonomous wandering (Exploration AI) while active.

## Verification
-   Write unit tests in `tests/engine/` to verify formation positioning and speed synchronization.
-   Ensure the project builds and lints successfully.
