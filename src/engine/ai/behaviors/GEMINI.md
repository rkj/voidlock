# src/engine/ai/behaviors

Modular behavior components for unit AI. Evaluated in priority order by UnitAI (ADR 0006).

## Files

- `Behavior.ts`: Base interface and types for all behaviors.
- `BehaviorUtils.ts`: Shared utilities (cell scoring, target selection).
- `SafetyBehavior.ts`: Low-HP retreat and AVOID-mode kiting (ADR 0056).
- `InteractionBehavior.ts`: Door opening, item pickup.
- `CombatBehavior.ts`: Target engagement, suppressive fire.
- `ObjectiveBehavior.ts`: Mission objective pursuit.
- `ExplorationBehavior.ts`: Fog-of-war exploration with committed paths (ADR 0056).
- `VipBehavior.ts`: VIP-specific flee and extraction logic.

## Priority Order

Safety (0) > Interaction (1) > Combat (2) > Objective (3) > Exploration (4).

Higher-priority behaviors can interrupt lower-priority committed plans. See ADR 0056 for plan commitment rules and invalidation triggers.
