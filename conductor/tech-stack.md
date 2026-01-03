# Technology Stack: Voidlock

## Core Technologies

- **Language:** TypeScript (~5.9.3) - Ensuring type safety and modern JS features.
- **Frontend / Build System:** Vite (^7.2.4) - Used for fast development and optimized production builds.
- **Engine Architecture:** Web Workers - The deterministic game engine runs in a background thread to ensure consistent simulation timing and UI responsiveness.
- **Rendering:** HTML5 Canvas - Direct rendering for the 2D tactical view.

## Development & Tooling

- **Testing:** Vitest (^3.2.4) - Fast, Vite-native testing framework for unit and integration tests.
- **Package Management:** NPM - Standard dependency management.
- **Issue Tracking:** Beads (`bd`) - AI-optimized issue tracker integrated with the development workflow.

## Project Structure

- `src/engine/`: Core simulation logic, pathfinding, and physics.
- `src/renderer/`: Canvas-based visual rendering and UI management.
- `src/shared/`: Common types and utilities used by both engine and renderer.
- `src/harness/`: Bot automation and testing infrastructure.
