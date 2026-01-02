# src/engine/persistence

This directory contains the persistence layer for the game.

## Files

- `StorageProvider.ts`: Interface for persistent storage.
- `LocalStorageProvider.ts`: Implementation using browser `localStorage`.
- `MockStorageProvider.ts`: In-memory implementation for testing.
- `FileStorageProvider.ts` (Planned): Implementation for Node.js environments.
