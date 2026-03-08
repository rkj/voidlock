# src/engine/interfaces

Shared interfaces to break circular dependencies between engine modules.

## Files

- `IDirector.ts`: Interface for the Director (enemy spawning), used by managers that need to query threat/spawn state without importing Director directly.
- `AIContext.ts`: Context object passed to AI behaviors, providing access to engine services without direct manager imports.
