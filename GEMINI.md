# Project Structure

This document outlines the top-level structure of the Voidlock project.

## Directories

- `src/`: Main source code directory.
  - **CRITICAL**: Do NOT place any test files (`.test.ts`, `.spec.ts`) inside `src/`. All tests must be located in the `tests/` directory.
- `tests/`: Global test suite directory. All unit, integration, and regression tests must be placed here, mirroring the `src/` structure where appropriate (e.g., `tests/engine/` tests `src/engine/`).
- `scripts/`: Utility scripts for build, maintenance, and asset processing.
- `docs/`: Documentation, including Architecture Decision Records (ADRs) and task context.
- `public/`: Static assets served by the application.
- `conductor/`: Project management and planning documents.

## Guidelines

- **Testing**: All new tests must be created in the `tests/` directory. If you find tests in `src/`, they should be moved to `tests/`.
- **Documentation**: Keep `GEMINI.md` files updated in each directory to reflect changes in structure or key components.
