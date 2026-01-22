# Voidlock

**Deterministic Real-Time with Pause (RTwP) tactical squad combat in a claustrophobic spaceship environment.**

This document provides a high-level overview of the project structure and context for AI agents.

## Project Overview

- **Type:** Web Application (Game)
- **Engine:** Custom deterministic engine running in a Web Worker.
- **Rendering:** HTML5 Canvas (World) + DOM (UI) running on the Main Thread.
- **Language:** TypeScript.
- **Build System:** Vite.
- **Testing:** Vitest (Unit/Integration) + Puppeteer (E2E).

## Build & Run Commands

Use these scripts from `package.json`:

- **Development Server:** `npm run dev` (Hosted on local network)
- **Build:** `npm run build` (Runs `tsc` then `vite build`)
- **Type Check (Lint):** `npm run lint` (`tsc --noEmit`)
- **Run Tests:** `npm run test` (Runs Vitest in "run" mode)
- **Run E2E Tests:** `npm run test:e2e` (Requires visual environment)
- **Asset Processing:** `npm run process-assets` (Optimizes raw assets)
- **Balance Simulator:** `npm run balance-sim` (Runs headless simulation stats)

## Directory Structure

### Top-Level

- `src/`: Main source code. **CRITICAL:** Contains NO test files.
- `tests/`: Global test suite. Mirrors `src/` structure.
- `scripts/`: Build, maintenance, and asset processing scripts.
- `docs/`: Documentation, ADRs, and Design Specs.
- `conductor/`: Project management, roadmaps, and track definitions.
- `public/`: Static assets (images, icons) served by Vite.

### Key Source Directories (`src/`)

- `src/engine/`: Core simulation logic (Web Worker). Deterministic, tick-based.
- `src/renderer/`: Visualization and UI (Main Thread).
- `src/shared/`: Types, constants, and utilities shared between Engine and Renderer.
- `src/content/`: Static game data (Tile definitions, Campaign events).
- `src/harness/`: Bot infrastructure and balance simulation tools.

## Development Guidelines

### 1. Architecture Restrictions
- **Decoupling:** The `engine` must NOT import from `renderer`. Communication is strictly via JSON protocol (Commands/Observations).
- **Determinism:** The `engine` must use the seeded `PRNG` for all random numbers. `Math.random()` is forbidden in the engine.
- **Testing:** All tests reside in `tests/`. Do not co-locate tests with source files.

### 2. Context Files (`GEMINI.md`)
- Detailed context for specific subsystems is found in local `GEMINI.md` files (e.g., `src/engine/GEMINI.md`).
- Keep these files updated when architecture or folder structure changes.

### 3. File conventions
- **Imports:** Use `@src/` alias for imports from the source directory.
- **Styles:** Use existing patterns (CSS variables, BEM-like naming) found in `src/styles`.

## Sub-Contexts

For deeper dives, refer to:
- [Engine Context](./src/engine/GEMINI.md)
- [Renderer Context](./src/renderer/GEMINI.md)
- [Shared Types Context](./src/shared/GEMINI.md)
- [Scripts Context](./scripts/GEMINI.md)
