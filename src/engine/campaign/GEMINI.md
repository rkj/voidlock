# src/engine/campaign

This directory contains specialized managers for the campaign mode logic, extracted from `CampaignManager` to improve maintainability and testability (ADR 0022).

## Components

- `CampaignManager.ts`: Orchestrates the strategic layer, managing persistent state, squad roster, and sector map progression. Implemented as a singleton that uses a `StorageProvider` for persistence. Now features standardized error handling with explicit exceptions for missing state.
- `MetaManager.ts`: Manages global statistics tracked across all campaigns (Total Kills, Campaigns Won/Lost, etc.). Implemented as a singleton that uses a `StorageProvider` for persistence.
- `RosterManager.ts`: Handles all roster-related operations, including recruitment, healing, revival, and equipment assignment.
- `MissionReconciler.ts`: Manages the reconciliation of mission results with the campaign state, including XP gain, level ups, node progression, and bankruptcy checks.
- `EventManager.ts`: Implements the logic for narrative events and player choices.

## Usage

These managers are typically used by the `CampaignManager` facade to perform specific domain operations while maintaining a central state and persistence layer.
