# src/shared/validation

This directory contains schema validation logic for external data, ensuring type safety at the boundaries of the application.

## Files

- `MapValidator.ts`: Provides static methods to validate the structure of `MapDefinition` objects, typically used when loading maps from JSON files or user uploads.

## Functionality

- **Map Validation**: `MapValidator.validateMapData(data: unknown)` performs a deep check of the provided object against the expected `MapDefinition` schema, including required fields (`width`, `height`, `cells`) and optional fields (`walls`, `spawnPoints`, `objectives`, etc.).
- **Type Guards**: Leverages TypeScript type guards to safely narrow `unknown` types to `MapDefinition`.
