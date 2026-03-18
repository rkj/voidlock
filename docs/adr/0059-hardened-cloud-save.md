# ADR 0059: Hardened Cloud Save — Write Queue and Timestamp-based Conflict Resolution

## Status

Proposed

## Context

The current `SaveManager` implementation for cloud synchronization has two critical reliability issues identified in `docs/FUTURE.md`:

1.  **Sync Race Condition**: `SaveManager.syncToCloud()` silently drops save requests if a sync is already in progress (`syncInProgress === true`). Rapid, successive saves (e.g., node completion followed by event outcome) result in lost data on the cloud backup.
2.  **Fragile Conflict Resolution**: Conflict resolution currently relies solely on a `saveVersion` counter. If two fresh campaigns are started (e.g., on different devices while offline), both start at version 1. When they sync, the version-based logic cannot reliably determine which is the "latest" user intent.

## Decision

We will harden the cloud save system with the following changes:

1.  **Implementation of a Write Queue**:
    -   Replace the `syncInProgress` guard with a `WriteQueue` that coalesces rapid saves.
    -   The latest save request will always overwrite any pending request, ensuring that the most recent state is eventually persisted.
    -   Successive saves will be processed sequentially to maintain order and data integrity.

2.  **Timestamp-based Conflict Resolution**:
    -   Add a `lastModifiedAt` timestamp (ISO 8601 string) to the `CampaignState` interface.
    -   Update `SaveManager.resolveConflict()` to prioritize the save with the most recent `lastModifiedAt` timestamp when `saveVersion` counters are equal.

3.  **Cloud Deletion Support**:
    -   Update `SaveManager.remove()` to accept an optional `deleteFromCloud` flag.
    -   Implement the corresponding deletion logic in `CloudSyncService`.

4.  **Campaign Summary Validation**:
    -   Apply `CampaignSummarySchema.safeParse()` to the results of `CloudSyncService.listCampaigns()` to ensure consistent data validation.

## Consequences

- **Reliability**: Cloud backups will accurately reflect the most recent local state even during rapid saving sequences.
- **Robustness**: Conflict resolution will be more resilient to multi-device/offline start scenarios.
- **Consistency**: All cloud data access points will be protected by Zod runtime validation.
- **Complexity**: Slightly increased complexity in `SaveManager` to manage the asynchronous write queue.
