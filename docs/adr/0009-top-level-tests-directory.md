# 9. Top-Level Tests Directory

Date: 2026-01-03

## Status

Accepted

## Context

Currently, test files (`*.test.ts`) are located within the `src/` directory, either alongside the source files they test or in `tests/` subdirectories within modules (e.g., `src/engine/tests/`).

This structure has several drawbacks:
1.  **Clutter:** It mixes source code with test code, making it harder to navigate the codebase and visualize the actual application structure.
2.  **Build Configuration:** It complicates `tsconfig.json` and build scripts, as they need to explicitly exclude test files to avoid bundling them into the production build.
3.  **Separation of Concerns:** It violates the principle of separating application logic from verification logic.

## Decision

We will move **ALL** test files, snapshots, and test-specific documentation out of `src/` and into a new top-level `tests/` directory at the project root.

The `tests/` directory will mirror the structure of the `src/` directory to maintain logical organization.

**Example Mapping:**
-   `src/engine/CoreEngine.ts` -> `tests/engine/CoreEngine.test.ts`
-   `src/renderer/Renderer.ts` -> `tests/renderer/Renderer.test.ts`
-   `src/shared/PRNG.ts` -> `tests/shared/PRNG.test.ts`

**Requirements:**
1.  **Strict Separation:** The `src/` directory must contain **NO** `*.test.ts` files or `__snapshots__` directories.
2.  **Path Aliases:** Test files must use the `@src` path alias (configured in `tsconfig.json`) for importing source modules. This prevents fragile relative imports (e.g., `../../src/engine/CoreEngine`) and ensures tests remain robust if moved.
    -   Example: `import { CoreEngine } from "@src/engine/CoreEngine";`
3.  **Configuration:**
    -   `tsconfig.json`: Must include `tests/` for type-checking during development but ensure `noEmit` is respected or that the build process (Vite) excludes them.
    -   `vitest.config.ts`: Must be configured to find tests in the `tests/` directory.

## Consequences

### Positive
-   **Clean Source Tree:** `src/` will only contain production code.
-   **Simplified Build:** Easier to define what should be included in the distribution bundle.
-   **Standardization:** Aligns with common industry practices for TypeScript projects.

### Negative
-   **Refactoring Effort:** Requires moving all existing tests and updating imports.
-   **Distance:** Tests are physically further from the code they test, which might slightly increase context switching overhead in IDEs without good "Go to Test" support (though most modern IDEs handle this well).
