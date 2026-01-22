# ADR 0023: Refactor UnitAI (Behavior Decomposition)

## Status

Accepted

## Context

The `src/engine/managers/UnitAI.ts` contains the decision-making logic for all autonomous agents. The `process` method is a long procedural sequence handling safety, interactions, combat, and exploration. This violates SRP and OCP, making it hard to add new behaviors without regression risks.

## Decision

We will decompose `UnitAI` using a Strategy or Behavior pattern.

### Changes

1.  **Create `src/engine/ai/behaviors/`**:
    - `SafetyBehavior.ts`: Retreat and grouping logic.
    - `InteractionBehavior.ts`: Loot and objective pickup.
    - `CombatBehavior.ts`: Engagement and attacking.
    - `ExplorationBehavior.ts`: Map discovery.
2.  **Update `UnitAI.ts`**:
    - Orchestrate these behaviors.
    - The `process` method should become a sequence of delegated calls: `safety.evaluate() || interaction.evaluate() || combat.evaluate() ...`.

## Consequences

- **Positive**: Behaviors are modular and testable. New behaviors can be added easily.
- **Negative**: Slight performance overhead from object delegation (negligible for this turn-based/tick-based system).
