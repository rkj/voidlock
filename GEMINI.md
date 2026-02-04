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
- **Type Check (Lint):** `npm run lint` (Full Project Check)
- **Run Tests:** `npm run test <FILE_PATH>` (Targeted) or `npm run test` (All)
- **Run E2E Tests:** `npm run test:e2e` (Requires visual environment)
- **Asset Processing:** `npm run process-assets` (Optimizes raw assets)
- **Balance Simulator:** `npm run balance-sim` (Runs headless simulation stats)

## Directory Structure

### Top-Level

- `src/`: Main source code. **CRITICAL:** Contains NO test files.
- `tests/`: Global test suite. Mirrors `src/` structure.
- `scripts/`: Build, maintenance, and asset processing scripts.
- `docs/`: Documentation, ADRs, and Design Specs.
- `public/`: Static assets (images, icons) served by Vite.

### Key Source Directories (`src/`)

- `src/engine/`: Core simulation logic (Web Worker). Deterministic, tick-based.
- `src/renderer/`: Visualization and UI (Main Thread).
- `src/shared/`: Types, constants, and utilities shared between Engine and Renderer.
- `src/content/`: Static game data (Tile definitions, Campaign events).
- `src/harness/`: Bot infrastructure and balance simulation tools.

## Development Guidelines

**CRITICAL:** Read @docs/dev_guide.md before making any code edits.

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

## Coding Standards & Quality Assurance

To prevent technical debt accumulation, all agents and contributors MUST adhere to these strict standards.

### 1. Strict Type Safety (Zero Tolerance for `any`)

- **NO `any`:** usage of the `any` type is strictly forbidden. Use `unknown` with type guards if the type is truly dynamic.
- **NO `as` Casting:** Avoid type assertions (`item as Weapon`). Use Type Guards (`isWeapon(item)`) or Zod/validation schemas for external data.
- **NO Non-Null Assertions:** Do not use `!` (e.g., `item!.id`). Handle `null`/`undefined` explicitly or throw meaningful errors.
- **Explicit Interfaces:** All component props, function parameters, and API payloads must be defined via `interface` or `type`.

### 2. Performance Hygeine

- **No Deep Cloning in Loops:** `JSON.parse(JSON.stringify(...))` is forbidden in the game loop (`update`, `render`). Use **Immer** or shallow copies with structural sharing.
- **Spatial Awareness:** Avoid O(N²) collision/visibility checks. Use **Spatial Partitioning** (Grids/Quadtrees) or Maps for entity lookups.
- **Object Stability:** Do not create new object references inside `render()` or frequently called methods (causes GC thrashing). Reuse vectors/objects where possible.

### 3. Architectural Hygiene

- **Single Responsibility:** "Manager" classes must not exceed ~500 lines. If a class grows too large, decompose it (e.g., `UnitManager` -> `FormationManager`, `UnitSpawner`).
- **DRY (Don't Repeat Yourself):** Do not duplicate utility logic (e.g., distance calculations). Create shared utilities in `src/shared/utils/`.
- **No Circular Dependencies:**
  - Engine must **never** import Renderer.
  - Child components (e.g., `UnitManager`) should not import Parent components (`CoreEngine`). Use Interfaces (`IDirector`) or Dependency Injection.

### 4. Verification Protocol

After **EVERY** code modification, you MUST perform the following checks before marking a task complete:

1. **Type Check:** `npm run lint` (Ensures 0 TypeScript errors).
1. **Unit Tests:** `npm run test <FILE_PATH>` (Ensures logic correctness).
1. **Self-Correction:** If errors occur, fix them immediately. Do not leave "cleanup" for later.

## Sub-Contexts

For deeper dives, refer to:

- [Engine Context](./src/engine/GEMINI.md)
- [Renderer Context](./src/renderer/GEMINI.md)
- [Shared Types Context](./src/shared/GEMINI.md)
- [Scripts Context](./scripts/GEMINI.md)
