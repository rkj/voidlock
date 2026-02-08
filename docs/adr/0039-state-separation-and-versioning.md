# ADR 0039: State Separation and Versioning

**Date:** 2026-02-08
**Status:** Proposed

## Context

Voidlock manages two primary game modes: **Campaign** and **Custom Simulation**. Currently, there is leakage between these states. For example, dead soldiers from an ongoing campaign can be "revived" or selected during a custom mission setup. This violates the principle of mode isolation and leads to a confusing user experience.

As we move towards cloud persistence (ADR 0034) and more complex meta-progression, we need a robust architecture that ensures state separation, facilitates versioning, and maintains backward/forward compatibility.

### Current Issues

1.  **State Leakage**: UI components (e.g., `SoldierInspector`, `EquipmentScreen`) directly query `CampaignManager` even when in Custom mode.
2.  **Implicit Data Flow**: Configuration for missions is scattered across `ConfigManager`, `MissionSetupManager`, and mode-specific singletons.
3.  **No Versioning**: Persistent data lacks explicit versioning, making migrations risky and breaking changes hard to manage.

## Decision

We will implement a strict **Top-Down Immutable Data Flow** pattern and enforce **Domain Isolation** between Campaign and Custom states.

### 1. Principle of Strict Separation

Custom Missions and Campaign Missions must be treated as entirely different domains.

- **Custom Missions**: Use a "Sandboxed" state. Soldiers are generated from archetypes, equipment is "free" (or limited by custom rules), and results do not affect any persistent roster.
- **Campaign Missions**: Use the "Persistent" state. Soldiers are drawn from the campaign roster, equipment costs Scrap, and results (deaths, XP, loot) are written back to the campaign save.

**Implementation**: UI components MUST NOT query `CampaignManager` directly if they are meant to be mode-agnostic. Instead, they should receive all necessary data (available roster, budget, rules) via props/config during initialization.

### 2. Data Structure Flow

Mission configuration will flow from a single source of truth: `GameConfig`.

```typescript
interface GameConfig {
  gameMode: GameMode; // Campaign | Custom
  version: number;    // Schema version
  // ... map and engine settings ...
  squadConfig: SquadConfig;
  context: {
    campaignNodeId?: string;
    allowRevive: boolean;
    allowRecruit: boolean;
    economyMode: 'Open' | 'Limited' | 'Free';
  }
}
```

- In **Campaign mode**, `GameConfig` is populated from the `CampaignState`.
- In **Custom mode**, `GameConfig` is populated from defaults and user overrides in the Setup screen.

### 3. Versioning and Compatibility

To ensure maintainability and cloud-sync safety, all top-level state objects (Campaign, Global Config, Custom Config) will include a `version` field.

- **Backward Compatibility**: New fields must be optional or have clear defaults in the Zod schemas (ADR 0033).
- **Forward Compatibility**: The engine and renderer must ignore unknown fields instead of crashing.
- **Migrations**: When a breaking change is necessary, a migration function must be provided that transforms `State(V-1)` to `State(V)`.

### 4. Cloud Persistence Considerations

Separation ensures that:
- Saving a Custom Mission configuration does not trigger a Campaign save sync.
- Malformed data in one mode does not corrupt the other.
- Shared meta-progression (Intel, Unlocks) is handled via a third, independent `MetaManager` state.

## Consequences

### Positive

- **Stability**: Prevents "revive campaign soldier in custom mission" bugs.
- **Maintainability**: Clearer data flow makes it easier to track state changes.
- **Scalability**: Versioning allows us to add complex features (e.g., skill trees) without breaking existing saves.
- **Testability**: Mode-agnostic UI components are easier to unit test with mock data.

### Negative

- **Refactoring Effort**: Requires updates to `EquipmentScreen`, `SoldierInspector`, and `MissionSetupManager`.
- **Boilerplate**: Passing data down through multiple layers can increase code verbosity.

### Neutral

- **Strict Typing**: Requires disciplined use of TypeScript interfaces and Zod schemas.

## References

- [ADR 0033: Zod Runtime Schema Validation](../0033-zod-runtime-validation.md)
- [ADR 0034: Firebase Cloud Save](../0034-firebase-cloud-save.md)
- [Spec 8.1: Squad Configuration](../../spec/ui.md#8.1)
