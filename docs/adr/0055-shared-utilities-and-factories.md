# ADR 0055: Shared Utilities and Factories

## Status

Accepted

## Context

Several logical patterns are duplicated across the codebase, leading to a maintenance burden and potential for logic drift. Specifically:

- **Spawn Validation:** Identical logic for checking if a cell is a valid squad spawn point appears in 4+ locations.
- **Objective Resolution:** Logic for resolving an objective's world position (cell vs enemy) appears in 3+ locations.
- **Soldier Construction:** Generation of soldier stats, names, and archetypes is duplicated across recruitment, initial roster, and narrative events.

## Decision

We will centralize these patterns into shared utilities and factories.

### 1. MapUtils

A new utility class `src/shared/utils/MapUtils.ts` will hold map-specific geometric and logical checks:

- `isValidSpawnPoint(map, cell)`
- `resolveObjectivePosition(objective, enemies)`

### 2. SoldierFactory

A new factory class `src/engine/campaign/SoldierFactory.ts` will centralize the creation of soldier entities, ensuring consistency across all recruitment and generation sources.

## Consequences

- **Positive:** Reduced code duplication (DRY). Easier to apply global changes to mission rules or soldier generation.
- **Negative:** None.
