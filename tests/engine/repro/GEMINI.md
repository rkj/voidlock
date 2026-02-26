# src/engine/tests/repro

Reproduction tests for specific bugs or reported issues. Often uses real-world map data or complex scenarios to isolate and verify fixes for edge cases.

## Key Tests

- `TacticalAI.test.ts`: Reproduces issues with units in 'IGNORE' mode not firing while moving, units in 'AVOID' mode breaking LOS while kiting, and VIPs failing to flee toward extraction.
