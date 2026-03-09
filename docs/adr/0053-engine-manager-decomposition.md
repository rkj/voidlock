# ADR 0053: Engine Manager Decomposition (Item Effects)

## Status

Accepted

## Context

The `Director` class currently handles both threat management (wave spawning) and item effect execution (`handleUseItem`). This is a violation of the Single Responsibility Principle (SRP) and exhibits "Feature Envy" as the item logic heavily mutates game state entities (enemies, units, turrets) that the Director shouldn't necessarily manage directly.

## Decision

We will extract the item effect logic into a specialized `ItemEffectService`.

### 1. ItemEffectService

A new service will be created to implement the `ItemEffectHandler` interface. It will be responsible for:

- Healing logic (Medkits, Stimpacks).
- Damage and status effects (Grenades).
- Discovery/Fog of War removal (Scanners).
- Entity spawning for consumables (Mines, Turrets).

### 2. Dependency Injection

The `Director` will no longer implement item logic directly. Instead, it will delegate to the `ItemEffectService` or be bypassed entirely by the `CommandHandler` for item-related commands.

## Consequences

- **Positive:** Cleaner `Director` class focused on threat/pacing. Centralized item logic that is easier to test in isolation.
- **Negative:** Small increase in class count.
