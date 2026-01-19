# tests/e2e

This directory contains End-to-End (E2E) visual tests for Voidlock, using Puppeteer and Vitest.

## Purpose

To verify visual fidelity and critical user journeys that cannot be fully tested in a JSDOM environment, such as:
- Z-Index layering issues.
- CSS layout and scrollbar behavior.
- WebGL canvas rendering.

## Structure

- `__snapshots__/`: Contains "golden" images for visual regression testing.
- `utils/`: E2E-specific helper functions.
  - `puppeteer.ts`: Manages the lifecycle of the Puppeteer browser and pages.
- `setup.ts`: Global setup and teardown for the E2E test suite, managing the lifecycle of the Vite dev server.

## Usage

Run the E2E tests using the following command:
```bash
npm run test:e2e
```
This will automatically start the Vite dev server before running tests and stop it afterwards.

## Related ADRs

- [ADR 0027: Integration & End-to-End Testing Strategy](../../docs/adr/0027-integration-testing-strategy.md)
