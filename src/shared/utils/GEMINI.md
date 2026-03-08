# src/shared/utils

Shared utility classes and functions.

## Files

- `MathUtils.ts`: Common mathematical operations (Distance, Manhattan distance, etc.).
- `MapUtils.ts`: Common map-related utility functions (spawn validation, objective resolution). `resolveObjectivePosition` centralizes the logic for mapping an objective to a world position, returning `null` if the target (cell or enemy) is invalid or missing.
- `SpatialGrid.ts`: A simple spatial partitioning grid for efficient coordinate-based entity queries. Used to optimize visibility checks and entity lookups.
- `NameGenerator.ts`: Generates random sci-fi/military flavored names for units.
