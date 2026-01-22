# src

This is the main source directory for the Voidlock project.

## Core Files

- `index.html`: Main application entry point. Contains an inline resilience script for global error handling and emergency data reset (Spec 8.12).

## Subdirectories

- `content/`: Static data and tile definitions.
- `engine/`: Core simulation logic, managers, and map generation.
- `harness/`: Testing infrastructure and balance simulators.
- `map-viewer/`: Standalone map visualization tool.
- `renderer/`: Main thread rendering and UI logic.
- `shared/`: Types and utilities shared between engine and renderer.

## Architecture

Voidlock uses a decoupled architecture where the game simulation (`engine`) runs in a Web Worker, and the visual presentation (`renderer`) runs on the main thread. Communication between them happens via a JSON-based observation/command protocol.

### Path Aliases

The project uses TypeScript and Vitest path aliases for cleaner imports:

- `@src`: Points to the `src/` directory (e.g., `import { PRNG } from '@src/shared/PRNG'`).

### Relevant ADRs

- **ADR 0006: Autonomous Agent Architecture** - Defines the profile-based AI system and tick synchronization.
- **ADR 0007: Command Pattern & Queue** - Specifies the strict JSON protocol and deterministic command processing.
- **ADR 0008: Renderer & UI Separation** - Explains the split between Canvas world rendering and DOM-based UI.
- **ADR 0012: Theming System & Asset Pipeline** - Defines the automated asset processing and CSS-based theming.
