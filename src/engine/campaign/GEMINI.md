# src/engine/campaign

This directory contains specialized managers for the campaign mode logic, extracted from `CampaignManager` to improve maintainability and testability (ADR 0022).

## Components

- `CampaignManager.ts`: Orchestrates the strategic layer, managing persistent state, squad roster, and sector map progression. Implemented as a singleton that uses a `StorageProvider` for persistence. Now incorporates global meta-unlocks (Archetypes, Items) from `MetaManager` when starting a new campaign.
- `MetaManager.ts`: Manages global statistics and persistent meta-progression (Intel, Unlocks) tracked across all campaigns. Implemented as a singleton that uses a `StorageProvider` for persistence. Supports spending Intel to unlock Archetypes and Item licenses globally.
- `RosterManager.ts`: Handles all roster-related operations, including recruitment, healing, revival, equipment assignment, and renaming soldiers.
- `MissionReconciler.ts`: Manages the reconciliation of mission results with the campaign state, including XP gain, level ups, node progression, and bankruptcy checks. Ensures `intelGained` is correctly propagated to both the per-campaign state and global meta-stats.
- `EventManager.ts`: Implements the logic for narrative events and player choices.

## Usage

These managers are typically used by the `CampaignManager` facade to perform specific domain operations while maintaining a central state and persistence layer.
