# 27. Integration & End-to-End Testing Strategy

Date: 2026-01-19

## Status

Accepted

## Context

The Voidlock project currently relies on Unit Tests and "Integration" tests running in a JSDOM environment. While effective for logic, JSDOM has significant limitations:

1. **No Visual Rendering:** It cannot detect Z-Index layering issues (e.g., "Blank Screen" bug where one layer obscures another).
1. **No Layout Engine:** It cannot detect CSS overflow or scrollbar issues (e.g., "Missing Scrollbars" bug).
1. **No WebGL:** It cannot verify the game canvas is actually rendering.

As a result, critical visual and interaction bugs are slipping through into `main`.

## Decision

We will adopt a **3-Tier Testing Strategy** to ensure both logical correctness and visual fidelity.

### Tier 1: Unit Tests (Fast)

- **Tool:** Vitest + JSDOM
- **Scope:** Individual functions, classes, and isolated UI components.
- **Location:** `tests/renderer/components/`, `tests/engine/`
- **Goal:** Verify logic branches and state transitions.

### Tier 2: Integration Tests (Medium)

- **Tool:** Vitest + JSDOM
- **Scope:** `GameApp` wiring, Screen transitions, Data flow between Managers.
- **Location:** `tests/renderer/integration/`
- **Goal:** Verify the application "glues" together correctly without crashing.
- **Constraint:** Mocks must be strictly typed. Avoid "permissive" mocks that swallow errors.

### Tier 3: End-to-End (E2E) Visual Tests (Slow, High Fidelity)

- **Tool:** **Puppeteer** + Vitest
- **Scope:** Critical User Journeys (CUJs) and Visual Layout verification.
- **Location:** `tests/e2e/`
- **Configuration:** `vitest.config.e2e.ts`
- **Goal:** Verify the user actually _sees_ the correct UI.
- **Methodology:**
  - **Headless Browser:** Launches a real Chrome instance.
  - **Visual Snapshots:** Takes screenshots of critical states.
  - **Layout Checks:** Verifies element visibility, bounding boxes, and scrollability.

## Implementation Details

### Directory Structure

```
tests/
  ├── e2e/
  │   ├── __snapshots__/    # Golden images
  │   ├── utils/            # E2E helpers (launch browser, etc.)
  │   └── CampaignLaunch.test.ts
```

### Infrastructure

- A dedicated `npm run test:e2e` script will be added.
- The test runner will manage the lifecycle of the Vite Dev Server (Start before tests, Stop after).

## Consequences

### Positive

- **Visual Assurance:** Catches "blank screen" and layout bugs before manual QA.
- **Regression Safety:** Prevents CSS changes from breaking critical flows.

### Negative

- **Execution Time:** E2E tests are significantly slower than JSDOM tests.
- **Maintenance:** Visual snapshots may require frequent updates if UI styling changes.
