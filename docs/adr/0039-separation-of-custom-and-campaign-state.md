# 39. Separation of Custom and Campaign State

Date: 2026-02-07

## Status

Accepted

## Context

Voidlock provides two primary ways to play: **Campaign Mode** (persistent progression, roster, and economy) and **Custom Simulation** (a sandbox mode for testing maps, squads, and mechanics).

Previously, these states were not strictly isolated. Custom missions could inadvertently access or modify campaign soldiers. For example, a user could "revive" a dead campaign soldier by selecting them in a custom mission setup, or a custom mission's outcome could potentially leak into the campaign's persistent history. This violates the "sandbox" guarantee of custom missions and risks campaign state corruption.

Furthermore, as the data structures for Soldiers and Squads evolve, we need a clear strategy for handling versioning and persistence that respects this boundary.

## Decision

We will implement a strict architectural boundary between Campaign state and Custom Mission state.

### 1. Physical State Separation

Persistence will be handled via distinct storage keys in `LocalStorage` (and subsequently in Cloud Sync):

- `voidlock_campaign_config`: Stores the "Ready Room" configuration for the next mission in the active campaign.
- `voidlock_campaign_state`: Stores the persistent campaign data (roster, scrap, nodes).
- `voidlock_custom_config`: Stores the "Sandbox" configuration for custom simulations.

The `ConfigManager` and `CampaignManager` must ensure they never mix these keys.

### 2. Soldier Identity & ID Isolation

To prevent state leakage, we define two different "modes" for soldier data:

- **Campaign Soldiers**: These are persistent entities stored in `CampaignState.roster`. They possess a unique, immutable `id` (UUID). This ID is used to reconcile mission results (XP, kills, status) back to the roster.
- **Custom Soldiers**: These are transient entities used in sandbox missions. They **MUST NOT** possess an `id` that links them to the campaign roster.

**Implementation Rule**:
When `MissionSetupManager` loads a configuration for a **Custom Mission**, it must explicitly strip or ignore the `id` field from all soldiers in the squad. If a custom soldier needs a unique identifier for the duration of a mission (e.g., for engine tracking), a transient ID may be generated, but it must never be saved back to a persistent roster.

### 3. Versioning & Schema Evolution

Both Campaign and Custom states must support independent versioning:

- **Independent Versioning**: `CampaignState` and `GameConfig` (Custom Setup) will maintain their own `version` fields.
- **Mandatory Migration/Repair**:
  - `CampaignManager.validateAndRepair()` is responsible for upgrading old campaign saves to the current schema.
  - `ConfigManager.validateAndMerge()` is responsible for upgrading custom configurations.
- **Zod Validation**: All state loading must pass through Zod schemas (`CampaignStateSchema`, `GameConfigSchema`) to ensure structural integrity at the storage boundary.

### 4. Persistence of "Last Used" Squads

- The "Last Used Squad" for Custom Missions will be saved in `voidlock_custom_config`.
- This squad will contain `archetypeId`, `equipment`, and `stats`, but **no persistent IDs**.
- This allows users to jump back into a sandbox with their favorite setup without affecting their campaign soldiers.

## Consequences

### Positive

- **Sandbox Integrity**: Users can safely experiment in custom missions without any risk of damaging their campaign progress or "magically" reviving dead soldiers.
- **Data Safety**: Schema changes are handled locally within each manager, reducing the risk of a global "save wipe" when one part of the system changes.
- **Clarity**: Developers have a clear mental model: "If it has an ID, it belongs to a Campaign. If it doesn't, it's a Sandbox."

### Negative

- **Code Duplication**: There is slight duplication in the logic for "Hydrating" soldiers (one path for Campaign using IDs, one path for Custom using Archetypes).
- **Manual Management**: `MissionSetupManager` must be carefully maintained to ensure the `GameMode` check correctly branches the hydration logic.
