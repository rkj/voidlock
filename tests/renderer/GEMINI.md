# src/renderer/tests

This directory contains the automated test suite for the Voidlock renderer, using Vitest.

## Testing Strategy

- **JSDOM Environment**: UI components (HUD, SquadBuilder) are tested using Vitest with the `jsdom` environment.
- **Manual Canvas Mocks**: The core `Renderer.ts` is tested using manual stubs for the Canvas API to avoid heavy native dependencies.

## Test Suites

- `SquadBuilder.test.ts`: Verifies squad selection logic and constraints.
- `ui/tests/HUDManager.test.ts`: Verifies soldier list rendering and HUD updates.
- `InputManager.test.ts`: Verifies keyboard shortcuts and debug overlay toggles.
- `Renderer.test.ts`: Verifies map, unit, and debug/LOS overlay rendering.
- `ConfigManager.migration.test.ts`: Verifies configuration migration and defaulting from old storage formats.
- `ConfigManager.isolation.test.ts`: Verifies that Custom and Campaign configurations are stored and loaded independently.
- `MenuController.discovery.test.ts`: Verifies room discovery filtering and stable numbering in the command menu.
- `regression_09cn_room_mapping.test.ts`: Verifies room mapping logic based on discovery order and stable key assignments.
- `regression_voidlock-hs8n_vip_selection.test.ts`: Verifies VIP availability logic in Custom Missions and its exclusion from Campaign Mode.

## Related ADRs

- [ADR 0006: Autonomous Agent Architecture](../../../docs/adr/0006-autonomous-agent-architecture.md)
- [ADR 0007: Command Pattern & Queue](../../../docs/adr/0007-command-pattern-queue.md)
- [ADR 0008: Renderer & UI Separation](../../../docs/adr/0008-renderer-ui-separation.md)
