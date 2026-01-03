# Task Context: xenopurge-gemini-3vv3

## Objective
Remove the explicit `ATTACK_TARGET` command and implement autonomous "Sticky Target" logic as per `spec/commands.md#31-autonomous-targeting-logic`.

## Requirements
1.  **Refactor Types**:
    -   Remove `ATTACK_TARGET` from `CommandType` in `src/shared/types.ts`.
    -   Remove `AttackTargetCommand` type.
2.  **Autonomous Targeting Logic**:
    -   Implement the heuristic: `Score = (MaxHP - CurrentHP) + (100 / Distance)`.
    -   Priority: **Weakest** (Kill confirm) > **Closest** (Immediate threat).
3.  **Sticky Targeting**:
    -   If a unit is already attacking a target, it should continue unless:
        -   Target dies.
        -   Target leaves Line of Fire (LOF).
        -   Target moves out of range.
4.  **Cleanup**:
    -   Remove `ATTACK_TARGET` handling from `CommandHandler.ts`, `UnitManager.ts`, and any other relevant files.
    -   Update any tests that rely on `ATTACK_TARGET` to use the autonomous logic.

## Verification
-   Ensure units automatically engage the best target based on the new heuristic.
-   Verify that units don't flip-flop between targets rapidly (Stickiness).
-   Run all existing tests and fix any that break due to the removal of `ATTACK_TARGET`.
