# 9. Top-Level Tests Directory

Date: 2026-01-03

## Status

Accepted

## Context

Currently, test files (`*.test.ts`) are located within the `src/` directory, either alongside the source files they test or in `tests/` subdirectories within modules (e.g., `src/engine/tests/`).

This structure has several drawbacks:

1. **Clutter:** It mixes source code with test code, making it harder to navigate the codebase.
1. **Build Configuration:** It complicates build scripts, as they need to explicitly exclude test files to avoid bundling them.
1. **Separation of Concerns:** It violates the principle of separating application logic from verification logic.

## Decision

We will move **ALL** test files, snapshots, and test-specific documentation out of `src/` and into a new top-level `tests/` directory at the project root.

The `tests/` directory will mirror the structure of the `src/` directory to maintain logical organization.

**Refactoring Strategy:**
To ensure the move is clean and robust, we will perform this in two distinct phases:

### Phase 1: Standardize Imports

Update all test files _in their current location_ (`src/`) to use the `@src` path alias for importing source modules. This eliminates fragile relative imports (e.g., `../../engine/CoreEngine`).

- **Change:** `import { CoreEngine } from "../CoreEngine"` -> `import { CoreEngine } from "@src/engine/CoreEngine"`
- **Verification:** Run tests to ensure the alias works correctly before moving any files.

### Phase 2: Relocate Files

Once imports are absolute (aliased), move the files to the `tests/` directory. This step involves **no content modification** to the test files themselves, preserving their integrity during the move.

- **Move:** `src/engine/CoreEngine.test.ts` -> `tests/engine/CoreEngine.test.ts`
- **Cleanup:** Remove empty `tests/` subdirectories from `src/`.

**Requirements:**

1. **Strict Separation:** The `src/` directory must contain **NO** `*.test.ts` files or `__snapshots__` directories.
1. **Path Aliases:** All tests must use `@src` for internal project imports.
1. **Configuration:**
   - `tsconfig.json`: Must include `tests/` for type-checking.
   - `vitest.config.ts`: Must be configured to find tests in the `tests/` directory.

## Consequences

### Positive

- **Clean Source Tree:** `src/` will only contain production code.
- **Robust Tests:** Tests become location-independent regarding their imports.
- **Standardization:** Aligns with common industry practices.

### Negative

- **Refactoring Effort:** Requires touching every test file to update imports.
